import { useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { seedDefaultStages } from '@/lib/stages'
import toast from 'react-hot-toast'

export default function Setup() {
  const [orgName, setOrgName] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSetup = async (e) => {
    e.preventDefault()
    const user = auth.currentUser
    if (!user) { toast.error('No hay sesión activa'); return }

    setLoading(true)
    try {
      const orgId = user.uid
      const code = orgName.replace(/\s+/g, '').toUpperCase().slice(0, 4)
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase()

      await setDoc(doc(db, 'organizations', orgId), {
        name: orgName,
        plan: 'starter',
        ownerId: user.uid,
        referralCode: `${code}-${rand}`,
        referredBy: null,
        membersCount: 1,
        leadsCount: 0,
        createdAt: serverTimestamp(),
      })

      await setDoc(doc(db, 'users', user.uid), {
        name,
        email: user.email,
        orgId,
        role: 'admin',
        createdAt: serverTimestamp(),
      })

      await seedDefaultStages(orgId)

      toast.success('¡Todo listo!')
      window.location.href = '/pipeline'
    } catch (err) {
      console.error(err)
      toast.error('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 bg-primary rounded-[10px] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="1" width="7" height="7" rx="2" fill="white"/>
              <rect x="10" y="1" width="7" height="7" rx="2" fill="white" opacity="0.5"/>
              <rect x="1" y="10" width="7" height="7" rx="2" fill="white" opacity="0.5"/>
              <rect x="10" y="10" width="7" height="7" rx="2" fill="white" opacity="0.3"/>
            </svg>
          </div>
          <span className="font-display font-bold text-xl tracking-tight">FlowCRM</span>
        </div>

        <div className="card p-8">
          <h1 className="font-display font-bold text-2xl tracking-tight mb-1">Configura tu cuenta</h1>
          <p className="text-secondary text-sm mb-6">Un clic y todo queda listo.</p>

          <form onSubmit={handleSetup} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Tu nombre
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Agustín García"
                className="input"
                required autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Nombre de tu empresa
              </label>
              <input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Mi Agencia"
                className="input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 py-2.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Configurando...
                </>
              ) : 'Crear mi espacio de trabajo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
