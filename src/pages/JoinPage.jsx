import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { DEFAULT_PERMISSIONS } from '@/hooks/usePermissions'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Eye, EyeOff, Check, X, AlertTriangle, Users } from 'lucide-react'

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// ── Password strength checker ─────────────────────────────────────
function PasswordStrength({ password }) {
  const checks = [
    { label: 'Mínimo 8 caracteres', valid: password.length >= 8 },
    { label: 'Una letra mayúscula',  valid: /[A-Z]/.test(password) },
    { label: 'Un número',            valid: /[0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.valid).length
  const color = score === 3 ? 'bg-green-500' : score === 2 ? 'bg-amber-400' : score === 1 ? 'bg-red-400' : 'bg-black/10'

  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-2">
        {[0, 1, 2].map(i => (
          <div key={i} className={clsx('h-1 flex-1 rounded-full transition-all', i < score ? color : 'bg-black/10')} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {checks.map(c => (
          <div key={c.label} className={clsx('flex items-center gap-1.5 text-[11px]', c.valid ? 'text-green-600' : 'text-tertiary')}>
            {c.valid ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-current" />}
            {c.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function JoinPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const orgId = params.get('org')
  const code  = params.get('code')

  const [step, setStep] = useState('loading') // loading | invalid | expired | used | register | success
  const [invite, setInvite] = useState(null)
  const [org, setOrg] = useState(null)
  const [inviterName, setInviterName] = useState('')

  const [form, setForm] = useState({ name: '', lastName: '', email: '', password: '', confirmPassword: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  // Validate invite on mount
  useEffect(() => {
    if (!orgId || !code) { setStep('invalid'); return }
    validateInvite()
  }, [orgId, code])

  const validateInvite = async () => {
    try {
      // Load org
      const orgDoc = await getDoc(doc(db, 'organizations', orgId))
      if (!orgDoc.exists()) { setStep('invalid'); return }
      setOrg({ id: orgDoc.id, ...orgDoc.data() })

      // Find invite by code
      const invitesSnap = await getDocs(
        query(collection(db, 'organizations', orgId, 'invites'), where('code', '==', code))
      )
      if (invitesSnap.empty) { setStep('invalid'); return }

      const inviteDoc = invitesSnap.docs[0]
      const inviteData = { id: inviteDoc.id, ...inviteDoc.data() }
      setInvite(inviteData)

      // Check status
      if (inviteData.status === 'used') { setStep('used'); return }
      if (inviteData.status === 'expired') { setStep('expired'); return }

      // Check expiration date
      const expiresAt = inviteData.expiresAt?.toDate?.() || new Date(inviteData.expiresAt)
      if (expiresAt < new Date()) {
        await updateDoc(inviteDoc.ref, { status: 'expired' })
        setStep('expired')
        return
      }

      // Load inviter name
      if (inviteData.createdBy) {
        const memberDoc = await getDoc(doc(db, 'organizations', orgId, 'members', inviteData.createdBy))
        if (memberDoc.exists()) setInviterName(memberDoc.data().name || '')
      }

      setStep('register')
    } catch (err) {
      console.error(err)
      setStep('invalid')
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    if (!form.email.trim()) { toast.error('El email es requerido'); return }
    if (form.password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return }
    if (form.password !== form.confirmPassword) { toast.error('Las contraseñas no coinciden'); return }

    setLoading(true)
    try {
      // 1. Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password)
      const uid = credential.user.uid
      const fullName = `${form.name.trim()} ${form.lastName.trim()}`.trim()

      // Update display name
      await updateProfile(credential.user, { displayName: fullName })

      // 2. Get parent member level
      let parentLevel = 0
      if (invite.createdBy) {
        const parentDoc = await getDoc(doc(db, 'organizations', orgId, 'members', invite.createdBy))
        if (parentDoc.exists()) parentLevel = parentDoc.data().level || 0
      }

      // 3. Create user document in global users collection
      await setDoc(doc(db, 'users', uid), {
        name: fullName,
        email: form.email.trim().toLowerCase(),
        orgId,
        role: 'seller',
        createdAt: serverTimestamp(),
      })

      // 4. Create member document in organization
      const myInviteCode = generateInviteCode()
      await setDoc(doc(db, 'organizations', orgId, 'members', uid), {
        name: fullName,
        email: form.email.trim().toLowerCase(),
        role: 'seller',
        type: 'ambos',
        parentId: invite.createdBy || null,
        level: parentLevel + 1,
        active: true,
        inRoundRobin: true,
        inviteCode: myInviteCode,
        permissions: DEFAULT_PERMISSIONS.seller,
        stats: {
          activeLeads: 0,
          closedThisMonth: 0,
          closedTotal: 0,
          conversionRate: 0,
          lastUpdated: null,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // 5. Mark invite as used
      await updateDoc(doc(db, 'organizations', orgId, 'invites', invite.id), {
        status: 'used',
        usedBy: uid,
        usedByName: fullName,
        usedAt: serverTimestamp(),
      })

      setStep('success')

      // Redirect to CRM after 2 seconds
      setTimeout(() => navigate('/pipeline'), 2000)

    } catch (err) {
      console.error(err)
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Este email ya está registrado. Intenta iniciar sesión.')
      } else if (err.code === 'auth/weak-password') {
        toast.error('La contraseña es muy débil')
      } else {
        toast.error('Error al crear tu cuenta. Intenta de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── STATES ─────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-secondary">Validando invitación...</p>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-green-500" />
          </div>
          <h1 className="font-display font-bold text-2xl text-primary mb-2">¡Bienvenido al equipo!</h1>
          <p className="text-secondary text-sm mb-4">
            Tu cuenta ha sido creada exitosamente. En un momento serás redirigido al CRM.
          </p>
          <div className="flex items-center justify-center gap-2 text-[11px] text-tertiary">
            <div className="w-3 h-3 border border-black/20 border-t-primary rounded-full animate-spin" />
            Redirigiendo...
          </div>
        </div>
      </div>
    )
  }

  if (step === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-4">
            <X size={28} className="text-red-500" />
          </div>
          <h1 className="font-display font-bold text-xl text-primary mb-2">Link inválido</h1>
          <p className="text-secondary text-sm">
            Este link de invitación no existe o no es válido. Pide a quien te invitó que genere un nuevo link.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-amber-500" />
          </div>
          <h1 className="font-display font-bold text-xl text-primary mb-2">Invitación expirada</h1>
          <p className="text-secondary text-sm">
            Este link de invitación venció. Los links son válidos por 7 días. Pide a quien te invitó que genere uno nuevo.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'used') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-blue-500" />
          </div>
          <h1 className="font-display font-bold text-xl text-primary mb-2">Invitación ya utilizada</h1>
          <p className="text-secondary text-sm mb-4">
            Este link ya fue usado para crear una cuenta. Si eres tú, intenta iniciar sesión.
          </p>
          <button onClick={() => navigate('/login')}
            className="btn-primary text-sm py-2 px-6">
            Ir al login
          </button>
        </div>
      </div>
    )
  }

  // ── REGISTER FORM ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Flow Hub" className="h-8 object-contain mx-auto mb-6" />

          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Users size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-[11px] text-tertiary">Invitado por</p>
              <p className="font-display font-bold text-[14px] text-primary">{inviterName || org?.name || 'tu equipo'}</p>
            </div>
          </div>

          <h1 className="font-display font-bold text-2xl tracking-tight text-primary mb-1">
            Únete al equipo
          </h1>
          <p className="text-secondary text-sm">
            Crea tu cuenta para acceder a <strong>{org?.name || 'Flow Hub'}</strong>
          </p>
        </div>

        {/* Form card */}
        <div className="bg-surface rounded-[20px] border border-black/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-8">
          <form onSubmit={handleRegister} className="flex flex-col gap-4">

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                  Nombre *
                </label>
                <input value={form.name} onChange={set('name')}
                  placeholder="Carlos" className="input" required autoFocus />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                  Apellido
                </label>
                <input value={form.lastName} onChange={set('lastName')}
                  placeholder="Ramírez" className="input" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Email *
              </label>
              <input type="email" value={form.email} onChange={set('email')}
                placeholder="carlos@empresa.com" className="input" required />
            </div>

            {/* Password */}
            <div>
              <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Contraseña *
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Mínimo 8 caracteres"
                  className="input pr-10"
                  required
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary transition-colors">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <PasswordStrength password={form.password} />
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Confirmar contraseña *
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                placeholder="Repite tu contraseña"
                className={clsx('input', form.confirmPassword && form.password !== form.confirmPassword && 'border-red-300 focus:border-red-400')}
                required
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                  <X size={10} /> Las contraseñas no coinciden
                </p>
              )}
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-[14px] font-bold flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creando cuenta...</>
                : 'Crear mi cuenta y unirme'}
            </button>

          </form>

          {/* Already have account */}
          <div className="text-center mt-5 pt-5 border-t border-black/[0.06]">
            <p className="text-[12.5px] text-secondary">
              ¿Ya tienes cuenta?{' '}
              <button onClick={() => navigate('/login')}
                className="text-primary font-semibold hover:underline">
                Inicia sesión
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-tertiary mt-6">
          Al crear tu cuenta aceptas los términos de uso de Flow Hub.
        </p>
      </div>
    </div>
  )
}
