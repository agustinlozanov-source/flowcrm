import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { DEFAULT_PERMISSIONS } from '@/hooks/usePermissions'

export function useAuth() {
  const {
    user, org, role, memberData, loading,
    setUser, setOrg, setRole, setMemberData, setLoading, reset
  } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        reset()
        return
      }

      setUser(firebaseUser)

      try {
        // 1. Load user document from global users collection
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))

        if (!userDoc.exists()) {
          // User authenticated but no profile yet — happens during registration
          setLoading(false)
          return
        }

        const userData = userDoc.data()
        const orgId = userData.orgId

        if (!orgId) {
          setLoading(false)
          return
        }

        // 2. Load organization
        const orgDoc = await getDoc(doc(db, 'organizations', orgId))
        if (orgDoc.exists()) {
          setOrg({ id: orgDoc.id, ...orgDoc.data() })
        }

        // 3. Load member document (role + permissions + stats)
        const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', firebaseUser.uid))

        if (memberDoc.exists()) {
          const member = memberDoc.data()
          setRole(member.role || 'seller')
          setMemberData({ id: firebaseUser.uid, ...member })
        } else {
          // Member document doesn't exist yet
          const isOwner = orgDoc.exists() && orgDoc.data().ownerId === firebaseUser.uid

          if (isOwner || userData.role === 'admin') {
            // Bootstrap admin member document
            const adminMember = {
              name: firebaseUser.displayName || userData.name || firebaseUser.email?.split('@')[0] || 'Admin',
              email: firebaseUser.email,
              role: 'admin',
              type: 'ambos',
              parentId: null,
              level: 0,
              active: true,
              inRoundRobin: false,
              inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
              permissions: DEFAULT_PERMISSIONS.admin,
              stats: {
                activeLeads: 0,
                closedThisMonth: 0,
                closedTotal: 0,
                conversionRate: 0,
                lastUpdated: null,
              },
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }
            await setDoc(doc(db, 'organizations', orgId, 'members', firebaseUser.uid), adminMember)
            setRole('admin')
            setMemberData({ id: firebaseUser.uid, ...adminMember })
          } else {
            setRole(userData.role || 'seller')
            setMemberData(null)
          }
        }

      } catch (err) {
        console.error('Error loading user profile:', err)
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [])

  return { user, org, role, memberData, loading }
}
