import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, org, role, loading, setUser, setOrg, setRole, setLoading, reset } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        reset()
        return
      }

      setUser(firebaseUser)

      try {
        // Load user profile from Firestore to get orgId and role
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))

        if (userDoc.exists()) {
          const userData = userDoc.data()
          setRole(userData.role)

          // Load organization data
          const orgDoc = await getDoc(doc(db, 'organizations', userData.orgId))
          if (orgDoc.exists()) {
            setOrg({ id: orgDoc.id, ...orgDoc.data() })
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

  return { user, org, role, loading }
}
