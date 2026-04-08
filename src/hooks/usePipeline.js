import { useEffect, useState, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, getDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useTeam } from '@/hooks/useTeam'

// ─── SYSTEM STAGES — fixed, not in Firestore ─────────────────────
export const SYSTEM_STAGES = {
  handoff: {
    id: 'handoff',
    name: 'Handoff',
    color: '#f59e0b',
    description: 'Lead listo para llamada — el humano toma el control',
    order: 100,
  },
  open_opportunity: {
    id: 'open_opportunity',
    name: 'Oportunidad abierta',
    color: '#6366f1',
    description: 'Hubo llamada pero sin fecha de pago confirmada',
    order: 101,
  },
  secure_opportunity: {
    id: 'secure_opportunity',
    name: 'Oportunidad segura',
    color: '#0066ff',
    description: 'Tiene fecha de pago confirmada',
    order: 102,
  },
  closed: {
    id: 'closed',
    name: 'Venta cerrada',
    color: '#00c853',
    description: 'Venta confirmada y registrada',
    order: 103,
  },
}

// ─── DISCARD CATEGORIES ───────────────────────────────────────────
export const DISCARD_CATEGORIES = [
  { value: 'timing',        label: 'Timing',              desc: 'No es el momento — puede retomarse', canRetake: true },
  { value: 'price',         label: 'Precio / Capacidad',  desc: 'Muy caro o sin presupuesto ahora',   canRetake: true },
  { value: 'geography',     label: 'Geografía',           desc: 'Fuera de zona de cobertura',         canRetake: true },
  { value: 'no_interest',   label: 'Sin interés real',    desc: 'El producto no resuelve su problema', canRetake: false },
  { value: 'no_answer',     label: 'No contesta',         desc: 'No atendió la llamada repetidamente', canRetake: true },
  { value: 'competition',   label: 'Competencia',         desc: 'Ya compró con otra empresa',          canRetake: true },
  { value: 'no_qualify',    label: 'No califica',         desc: 'El producto no aplica para su caso',  canRetake: false },
  { value: 'handoff_bound', label: 'Handoff Bound',       desc: 'Cayó por tiempo límite sin atención', canRetake: true },
  { value: 'blacklist',     label: 'Solicitud expresa',   desc: 'Pidió no ser contactado — permanente', canRetake: false },
]

// ─── HELPERS ─────────────────────────────────────────────────────
const fmt = (v) => {
  if (!v) return null
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
  return `$${v}`
}

export { fmt }

export function usePipeline() {
  const { org, user } = useAuthStore()
  const orgId = org?.id
  const userId = user?.uid
  const { updateMemberStats } = useTeam()

  const [pipelines, setPipelines] = useState([])
  const [activePipelineId, setActivePipelineId] = useState(null)
  const [allStages, setAllStages] = useState([])
  const [leads, setLeads] = useState([])
  const [members, setMembers] = useState([])
  const [loadingStages, setLoadingStages] = useState(true)
  const [loadingLeads, setLoadingLeads] = useState(true)

  // ── Listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      query(collection(db, 'organizations', orgId, 'pipelines'), orderBy('createdAt', 'asc')),
      snap => setPipelines(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      query(collection(db, 'organizations', orgId, 'pipeline_stages'), orderBy('order', 'asc')),
      snap => { setAllStages(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingStages(false) }
    )
    return unsub
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      query(collection(db, 'organizations', orgId, 'leads'), orderBy('createdAt', 'desc')),
      snap => { setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingLeads(false) }
    )
    return unsub
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    const unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'members'),
      snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [orgId])

  // ── Computed ───────────────────────────────────────────────────
  const stages = activePipelineId === '__all__'
    ? allStages
    : activePipelineId
      ? allStages.filter(s => s.pipelineId === activePipelineId)
      : allStages.filter(s => !s.pipelineId)

  // Active leads — in configurable stages (not system stages, not discarded)
  const activeLeads = leads.filter(l => !l.systemStage && !l.discarded)

  const filteredLeads = activePipelineId === '__all__'
    ? activeLeads
    : activePipelineId
      ? activeLeads.filter(l => l.pipelineId === activePipelineId)
      : activeLeads.filter(l => !l.pipelineId)

  // System stage leads — always shown regardless of pipeline filter
  const systemLeads = leads.filter(l => l.systemStage && !l.discarded)
  const discardedLeads = leads.filter(l => l.discarded)

  const leadsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = filteredLeads.filter(l => l.stageId === stage.id)
    return acc
  }, {})

  const leadsBySystemStage = Object.keys(SYSTEM_STAGES).reduce((acc, key) => {
    acc[key] = systemLeads.filter(l => l.systemStage === key)
    return acc
  }, {})

  // Pipeline value stats
  const pipelineStats = {
    potential: filteredLeads.reduce((s, l) => s + (l.value || 0), 0),
    closed: leads.filter(l => l.systemStage === 'closed' &&
      (activePipelineId === '__all__' || l.pipelineId === activePipelineId || (!activePipelineId && !l.pipelineId))
    ).reduce((s, l) => s + (l.closedProduct?.price || l.value || 0), 0),
    secure: systemLeads.filter(l => l.systemStage === 'secure_opportunity').reduce((s, l) => s + (l.value || 0), 0),
  }

  // Best closer — most closed deals in last N days
  const getBestCloser = useCallback(async (days = 30) => {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const closedRecent = leads.filter(l =>
      l.systemStage === 'closed' &&
      l.closedAt?.toDate?.() >= since
    )
    const counts = {}
    closedRecent.forEach(l => {
      if (l.closedBy) counts[l.closedBy] = (counts[l.closedBy] || 0) + 1
    })
    if (!Object.keys(counts).length) return null
    const bestId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    return bestId
  }, [leads])

  // ── Round Robin assignment ─────────────────────────────────────
  const getNextAssignee = useCallback(async () => {
    const orgSnap = await getDoc(doc(db, 'organizations', orgId))
    const orgData = orgSnap.data()
    if (!orgData?.autoAssign) return userId // fallback to current user

    const activeMembers = members.filter(m => m.active && m.role === 'seller')
    if (!activeMembers.length) return userId

    const currentIndex = orgData.roundRobinIndex || 0
    const nextMember = activeMembers[currentIndex % activeMembers.length]

    // Advance index
    await updateDoc(doc(db, 'organizations', orgId), {
      roundRobinIndex: (currentIndex + 1) % activeMembers.length
    })

    return nextMember.id
  }, [orgId, userId, members])

  // ── LEAD OPERATIONS ────────────────────────────────────────────

  const moveLead = async (leadId, newStageId) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
      stageId: newStageId, updatedAt: serverTimestamp()
    })
  }

  const createLead = async (data) => {
    if (!orgId) return
    const assignedTo = await getNextAssignee()
    const ref = await addDoc(collection(db, 'organizations', orgId, 'leads'), {
      name: data.name,
      lastName: data.lastName || '',
      company: data.company || '',
      email: data.email || '',
      phone: data.phone || '',
      value: Number(data.value) || 0,
      source: data.source || 'manual',
      stageId: data.stageId,
      pipelineId: activePipelineId || null,
      score: 0,
      profileB: false,
      systemStage: null,
      discarded: false,
      assignedTo,
      assignedAt: serverTimestamp(),
      productId: data.productId || null,
      notes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  const updateLead = async (leadId, data) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
      ...data, updatedAt: serverTimestamp()
    })
  }

  const deleteLead = async (leadId) => {
    if (!orgId) return
    await deleteDoc(doc(db, 'organizations', orgId, 'leads', leadId))
  }

  // Move lead to a system stage
  const moveToSystemStage = async (leadId, systemStage, extraData = {}) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
      systemStage,
      systemStageAt: serverTimestamp(),
      stageId: null, // remove from configurable stage
      ...extraData,
      updatedAt: serverTimestamp(),
    })
  }

  // Move to HANDOFF
  const moveToHandoff = async (leadId, assignToUserId = null) => {
    if (!orgId) return
    const assignee = assignToUserId || userId
    await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
      systemStage: 'handoff',
      systemStageAt: serverTimestamp(),
      stageId: null,
      assignedTo: assignee,
      assignedAt: serverTimestamp(),
      handoffAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    // Create alert for assignee
    await createAlert({
      type: 'handoff_assigned',
      leadId,
      assignedTo: assignee,
      message: 'Nuevo lead listo para llamada',
    })
  }

  // Move from HANDOFF → OPEN or SECURE opportunity
  const resolveHandoff = async (leadId, outcome, extraData = {}) => {
    if (!orgId) return
    // outcome: 'open_opportunity' | 'secure_opportunity' | 'discard'
    if (outcome === 'discard') {
      await discardLead(leadId, extraData)
      return
    }
    await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
      systemStage: outcome,
      systemStageAt: serverTimestamp(),
      handoffResolvedAt: serverTimestamp(),
      handoffResolvedBy: userId,
      ...extraData,
      updatedAt: serverTimestamp(),
    })
  }

  // Close a lead — VENTA CERRADA
  const closeLead = async (leadId, { productId, productName, price, currency, notes }) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
      systemStage: 'closed',
      systemStageAt: serverTimestamp(),
      closedAt: serverTimestamp(),
      closedBy: userId,
      closedProduct: { id: productId || null, name: productName, price: Number(price), currency: currency || 'USD' },
      closedNotes: notes || '',
      updatedAt: serverTimestamp(),
    })
    // Log interaction
    await addDoc(collection(db, 'organizations', orgId, 'leads', leadId, 'interactions'), {
      type: 'close',
      content: `Venta cerrada — ${productName} · $${Number(price).toLocaleString()} ${currency || 'USD'}`,
      createdAt: serverTimestamp(),
      createdBy: userId,
    })
    // Update stats for assigned member and closer
    const closedLead = leads.find(l => l.id === leadId)
    await updateMemberStats(closedLead?.assignedTo)
    await updateMemberStats(userId)
  }

  // Discard a lead
  const discardLead = async (leadId, { category, retakeDate, notes, handoffBound = false }) => {
    if (!orgId) return
    const lead = leads.find(l => l.id === leadId)
    await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
      discarded: true,
      discardedAt: serverTimestamp(),
      discardedBy: userId,
      discardCategory: category,
      discardNotes: notes || '',
      retakeDate: retakeDate || null,
      handoffBound,
      handoffBoundFrom: handoffBound ? (lead?.assignedTo || null) : null,
      systemStage: null,
      updatedAt: serverTimestamp(),
    })
    // Log
    await addDoc(collection(db, 'organizations', orgId, 'leads', leadId, 'interactions'), {
      type: 'discard',
      content: `Descartado — ${DISCARD_CATEGORIES.find(c => c.value === category)?.label || category}${notes ? ': ' + notes : ''}`,
      createdAt: serverTimestamp(),
      createdBy: userId,
    })
    // Update stats for assigned member and discarding user
    await updateMemberStats(lead?.assignedTo)
    await updateMemberStats(userId)
  }

  // Handoff Bound — called when timer expires
  const triggerHandoffBound = async (leadId) => {
    if (!orgId) return
    const bestCloser = await getBestCloser(30)
    const lead = leads.find(l => l.id === leadId)

    // Discard with handoff_bound category
    await discardLead(leadId, {
      category: 'handoff_bound',
      notes: `Cayó por Handoff Bound — no fue trabajado en tiempo`,
      handoffBound: true,
    })

    // If best closer exists and is different, create reassigned lead
    if (bestCloser && bestCloser !== lead?.assignedTo) {
      await createAlert({
        type: 'handoff_bound_reassigned',
        leadId,
        leadName: lead?.name,
        fromUserId: lead?.assignedTo,
        toUserId: bestCloser,
        message: `Lead reasignado por Handoff Bound desde ${lead?.assignedTo || 'sin asignar'}`,
        assignedTo: bestCloser,
      })
      // Move discarded lead back to handoff assigned to best closer
      await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
        discarded: false,
        discardedAt: null,
        discardedBy: null,
        discardCategory: null,
        systemStage: 'handoff',
        systemStageAt: serverTimestamp(),
        assignedTo: bestCloser,
        assignedAt: serverTimestamp(),
        handoffBoundFrom: lead?.assignedTo,
        handoffBoundReasignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
  }

  // Mark profileB — potential distributor
  const markProfileB = async (leadId) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
      profileB: true,
      profileBDetectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await createAlert({
      type: 'profile_b',
      leadId,
      leadName: leads.find(l => l.id === leadId)?.name,
      message: 'Lead con perfil de distribuidor detectado',
      assignedTo: userId,
    })
  }

  // Create system alert
  const createAlert = async (data) => {
    if (!orgId) return
    await addDoc(collection(db, 'organizations', orgId, 'alerts'), {
      ...data,
      seen: false,
      createdAt: serverTimestamp(),
    })
  }

  // Assign lead to user
  const assignLead = async (leadId, toUserId) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
      assignedTo: toUserId,
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  // ── STAGE OPERATIONS ───────────────────────────────────────────

  const createStage = async (name, color) => {
    if (!orgId) return
    const maxOrder = stages.reduce((max, s) => Math.max(max, s.order ?? 0), 0)
    await addDoc(collection(db, 'organizations', orgId, 'pipeline_stages'), {
      name,
      color: color || '#6366f1',
      order: maxOrder + 1,
      pipelineId: activePipelineId || null,
      scoreMin: 0,
      scoreMax: 100,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  const createPipeline = async ({ name, purpose, stages: stageList }) => {
    if (!orgId) return
    const pipelineRef = await addDoc(collection(db, 'organizations', orgId, 'pipelines'), {
      name, purpose: purpose || null,
      handoffBoundDays: 3,
      handoffBoundActive: false,
      autoAssign: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    })
    for (let i = 0; i < stageList.length; i++) {
      const s = stageList[i]
      await addDoc(collection(db, 'organizations', orgId, 'pipeline_stages'), {
        name: s.name, color: s.color || '#6366f1', order: i + 1,
        pipelineId: pipelineRef.id,
        scoreMin: s.scoreMin ?? 0,
        scoreMax: s.scoreMax ?? 100,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
    }
    return pipelineRef.id
  }

  const updatePipeline = async (pipelineId, data) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'pipelines', pipelineId), {
      ...data, updatedAt: serverTimestamp()
    })
  }

  const updateStage = async (stageId, data) => {
    if (!orgId) return
    await updateDoc(doc(db, 'organizations', orgId, 'pipeline_stages', stageId), {
      ...data, updatedAt: serverTimestamp()
    })
  }

  const deleteStage = async (stageId) => {
    if (!orgId) return
    await deleteDoc(doc(db, 'organizations', orgId, 'pipeline_stages', stageId))
  }

  const adoptOrphanStages = async ({ name, purpose }) => {
    if (!orgId) return
    const pipelineRef = await addDoc(collection(db, 'organizations', orgId, 'pipelines'), {
      name, purpose: purpose || null,
      handoffBoundDays: 3,
      handoffBoundActive: false,
      autoAssign: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    })
    const pipelineId = pipelineRef.id
    const stagesSnap = await getDocs(collection(db, 'organizations', orgId, 'pipeline_stages'))
    for (const d of stagesSnap.docs) {
      if (!d.data().pipelineId) {
        await updateDoc(d.ref, { pipelineId, updatedAt: serverTimestamp() })
      }
    }
    const leadsSnap = await getDocs(collection(db, 'organizations', orgId, 'leads'))
    for (const d of leadsSnap.docs) {
      if (!d.data().pipelineId) {
        await updateDoc(d.ref, { pipelineId, updatedAt: serverTimestamp() })
      }
    }
    return pipelineId
  }

  return {
    // Data
    pipelines,
    activePipelineId,
    setActivePipelineId,
    allStages,
    stages,
    leads: filteredLeads,
    systemLeads,
    discardedLeads,
    leadsByStage,
    leadsBySystemStage,
    members,
    pipelineStats,
    loading: loadingStages || loadingLeads,
    // Lead ops
    moveLead,
    createLead,
    updateLead,
    deleteLead,
    moveToHandoff,
    moveToSystemStage,
    resolveHandoff,
    closeLead,
    discardLead,
    triggerHandoffBound,
    markProfileB,
    assignLead,
    createAlert,
    // Stage / pipeline ops
    createStage,
    updateStage,
    deleteStage,
    createPipeline,
    updatePipeline,
    adoptOrphanStages,
  }
}
