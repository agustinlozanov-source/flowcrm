import { useEffect, useState, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  getDoc, where, getDocs
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { DEFAULT_PERMISSIONS } from '@/hooks/usePermissions'

// ─── HELPERS ─────────────────────────────────────────────────────
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function buildTree(members, rootId = null) {
  const genealogyMembers = members.filter(m => !m.isInternal)
  const map = {}
  genealogyMembers.forEach(m => { map[m.id] = { ...m, children: [] } })

  const roots = []
  genealogyMembers.forEach(m => {
    if (m.parentId && map[m.parentId]) {
      map[m.parentId].children.push(map[m.id])
    } else if (!m.parentId || m.id === rootId) {
      roots.push(map[m.id])
    }
  })
  return roots
}

// Build subtree for a specific user (only their branch down)
function buildSubTree(members, userId) {
  const genealogyMembers = members.filter(m => !m.isInternal)
  const map = {}
  genealogyMembers.forEach(m => { map[m.id] = { ...m, children: [] } })

  // Find all descendants of userId
  const descendants = new Set()
  const findDescendants = (id) => {
    genealogyMembers.forEach(m => {
      if (m.parentId === id) {
        descendants.add(m.id)
        findDescendants(m.id)
      }
    })
  }
  findDescendants(userId)
  descendants.add(userId)

  const filteredMembers = genealogyMembers.filter(m => descendants.has(m.id))
  filteredMembers.forEach(m => { map[m.id] = { ...m, children: [] } })

  const roots = []
  filteredMembers.forEach(m => {
    if (m.id === userId) {
      roots.push(map[m.id])
    } else if (m.parentId && map[m.parentId]) {
      map[m.parentId].children.push(map[m.id])
    }
  })
  return roots
}

// ─── HOOK ─────────────────────────────────────────────────────────
export function useTeam() {
  const { org, user, role } = useAuthStore()
  const orgId = org?.id
  const userId = user?.uid

  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)

  // Real-time members listener
  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      query(collection(db, 'organizations', orgId, 'members'), orderBy('createdAt', 'asc')),
      snap => {
        setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }
    )
    return unsub
  }, [orgId])

  // Real-time invites listener
  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      query(collection(db, 'organizations', orgId, 'invites'), orderBy('createdAt', 'desc')),
      snap => setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [orgId])

  // ── COMPUTED ───────────────────────────────────────────────────

  // Full tree (admin only)
  const fullTree = buildTree(members)

  // My subtree (from current user down)
  const myTree = buildSubTree(members, userId)

  // Current user's member data
  const currentMember = members.find(m => m.id === userId)

  // Active members for round robin
  const activeMembers = members.filter(m => m.active && m.role === 'seller')

  // Stats summary
  const teamStats = {
    total: members.length,
    active: members.filter(m => m.active).length,
    sellers: members.filter(m => m.role === 'seller').length,
    totalClosedThisMonth: members.reduce((s, m) => s + (m.stats?.closedThisMonth || 0), 0),
    totalActiveLeads: members.reduce((s, m) => s + (m.stats?.activeLeads || 0), 0),
  }

  // ── MEMBER OPERATIONS ──────────────────────────────────────────

  const createMember = async ({
    name, email, password, role: memberRole, type,
    parentId, inRoundRobin, customPermissions
  }) => {
    if (!orgId) return
    const res = await fetch('/.netlify/functions/create-org-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        memberMode: true,
        memberData: {
          orgId,
          name: name.trim(),
          role: memberRole || 'seller',
          type: type || 'ambos',
          parentId: parentId || null,
          level: (members.find(m => m.id === (parentId || userId))?.level || 0) + 1,
          inRoundRobin: inRoundRobin ?? true,
          permissions: customPermissions || DEFAULT_PERMISSIONS[memberRole || 'seller'],
        },
      }),
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || 'Error al crear vendedor')
    return result.uid
  }

  const updateMember = async (memberId, data) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'members', memberId), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  const updateMemberPermissions = async (memberId, permissions) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'members', memberId), {
      permissions,
      updatedAt: serverTimestamp(),
    })
  }

  const toggleMemberActive = async (memberId, active) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'members', memberId), {
      active,
      updatedAt: serverTimestamp(),
    })
  }

  const deleteMember = async (memberId) => {
    if (!orgId) return
    await deleteDoc(doc(db, 'organizations', orgId, 'members', memberId))
  }

  // Update member stats — called from usePipeline when closing/discarding leads
  const updateMemberStats = async (memberId) => {
    if (!orgId || !memberId) return
    try {
      // Count active leads
      const activeLeadsSnap = await getDocs(
        query(
          collection(db, 'organizations', orgId, 'leads'),
          where('assignedTo', '==', memberId),
          where('discarded', '==', false)
        )
      )

      // Count closed this month
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const closedSnap = await getDocs(
        query(
          collection(db, 'organizations', orgId, 'leads'),
          where('closedBy', '==', memberId),
          where('systemStage', '==', 'closed')
        )
      )
      const closedThisMonth = closedSnap.docs.filter(d => {
        const closedAt = d.data().closedAt?.toDate?.()
        return closedAt && closedAt >= startOfMonth
      }).length

      const activeLeads = activeLeadsSnap.size
      const closedTotal = closedSnap.size
      const conversionRate = closedTotal > 0 && activeLeads > 0
        ? Math.round((closedTotal / (closedTotal + activeLeads)) * 100) / 100
        : 0

      await updateDoc(doc(db, 'organizations', orgId, 'members', memberId), {
        stats: {
          activeLeads,
          closedThisMonth,
          closedTotal,
          conversionRate,
          lastUpdated: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('Error updating member stats:', err)
    }
  }

  // ── INVITE OPERATIONS ──────────────────────────────────────────

  const createInvite = async (parentId) => {
    if (!orgId) return
    const code = generateInviteCode()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    const ref = await addDoc(collection(db, 'organizations', orgId, 'invites'), {
      code,
      createdBy: parentId || userId,
      orgId,
      usedBy: null,
      status: 'pending',
      expiresAt,
      link: `${window.location.origin}/join?org=${orgId}&code=${code}`,
      createdAt: serverTimestamp(),
    })
    return { id: ref.id, code, link: `${window.location.origin}/join?org=${orgId}&code=${code}` }
  }

  const useInvite = async (code, newUserId, newUserName, newUserEmail) => {
    if (!orgId) return { success: false, error: 'Sin organización' }

    // Find invite
    const invitesSnap = await getDocs(
      query(
        collection(db, 'organizations', orgId, 'invites'),
        where('code', '==', code),
        where('status', '==', 'pending')
      )
    )

    if (invitesSnap.empty) return { success: false, error: 'Código inválido o expirado' }

    const inviteDoc = invitesSnap.docs[0]
    const invite = inviteDoc.data()

    // Check expiration
    if (invite.expiresAt?.toDate?.() < new Date()) {
      await updateDoc(inviteDoc.ref, { status: 'expired' })
      return { success: false, error: 'El código ha expirado' }
    }

    // Create member
    const inviteCode = generateInviteCode()
    await addDoc(collection(db, 'organizations', orgId, 'members'), {
      id: newUserId,
      name: newUserName,
      email: newUserEmail,
      role: 'seller',
      type: 'ambos',
      parentId: invite.createdBy,
      level: (members.find(m => m.id === invite.createdBy)?.level || 0) + 1,
      active: true,
      inRoundRobin: true,
      inviteCode,
      permissions: DEFAULT_PERMISSIONS.seller,
      stats: { activeLeads: 0, closedThisMonth: 0, closedTotal: 0, conversionRate: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Mark invite as used
    await updateDoc(inviteDoc.ref, {
      status: 'used',
      usedBy: newUserId,
      usedAt: serverTimestamp(),
    })

    return { success: true }
  }

  const revokeInvite = async (inviteId) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'invites', inviteId), {
      status: 'expired',
      updatedAt: serverTimestamp(),
    })
  }

  return {
    members,
    invites,
    loading,
    currentMember,
    activeMembers,
    fullTree,
    myTree,
    teamStats,
    // Member ops
    createMember,
    updateMember,
    updateMemberPermissions,
    toggleMemberActive,
    deleteMember,
    updateMemberStats,
    // Invite ops
    createInvite,
    useInvite,
    revokeInvite,
  }
}
