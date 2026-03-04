import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { seedDefaultStages } from '@/lib/stages'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'

// Generate a short unique referral code
const generateReferralCode = (name) => {
  const base = name.replace(/\s+/g, '').toUpperCase().slice(0, 4)
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${base}-${rand}`
}

export default function Register() {
  const [form, setForm] = useState({
    orgName: '',
    name: '',
    email: '',
    password: '',
    referralCode: '',
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleRegister = async (e) => {
    e.preventDefault()
    if (form.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      // 1. Create Firebase Auth user
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password)

      // 2. Create organization document
      const orgId = user.uid // Use uid as orgId for simplicity (1 org per owner initially)
      const referralCode = generateReferralCode(form.orgName)

      await setDoc(doc(db, 'organizations', orgId), {
        name: form.orgName,
        plan: 'starter',
        ownerId: user.uid,
        referralCode,
        referredBy: form.referralCode || null,
        createdAt: serverTimestamp(),
        membersCount: 1,
        leadsCount: 0,
      })

      // 3. Create user profile document
      await setDoc(doc(db, 'users', user.uid), {
        name: form.name,
        email: form.email,
        orgId,
        role: 'admin',
        createdAt: serverTimestamp(),
      })

      // 4. Seed default pipeline stages
      await seedDefaultStages(orgId)

      toast.success('¡Cuenta creada! Bienvenido a FlowCRM.')
      navigate('/pipeline')
    } catch (err) {
      const msg = {
        'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
        'auth/invalid-email': 'Email inválido.',
        'auth/weak-password': 'Contraseña muy débil.',
      }[err.code] || 'Error al crear la cuenta.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <img src="/logo.png" alt="Logo" className="h-10 object-contain" />
        </div>

        <div className="card p-8">
          <h1 className="font-display font-bold text-2xl tracking-tight text-primary mb-1">
            Crea tu cuenta
          </h1>
          <p className="text-secondary text-sm mb-6">
            Empieza gratis. Sin tarjeta de crédito.
          </p>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Nombre de tu empresa
              </label>
              <input
                type="text"
                value={form.orgName}
                onChange={set('orgName')}
                placeholder="Agencia Creativa S.A."
                className="input"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Tu nombre
              </label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Agustín García"
                className="input"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="tu@empresa.com"
                className="input"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                placeholder="Mínimo 6 caracteres"
                className="input"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Código de referido <span className="text-tertiary normal-case font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.referralCode}
                onChange={set('referralCode')}
                placeholder="FLOW-XXXX"
                className="input"
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
                  Creando cuenta...
                </>
              ) : 'Crear cuenta gratis'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-black/[0.06] text-center">
            <p className="text-sm text-secondary">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-accent-blue font-semibold hover:underline">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
