import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'

const GRADIENT = 'linear-gradient(135deg, #0066ff, #7c3aed)'

export default function DistribuidorLoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/portal-distribuidor')
    } catch (err) {
      const msg = {
        'auth/user-not-found':    'No existe una cuenta con ese email.',
        'auth/wrong-password':    'Contraseña incorrecta.',
        'auth/invalid-credential':'Email o contraseña incorrectos.',
        'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
      }[err.code] || 'Error al iniciar sesión.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">

      {/* ── LEFT: Video 3/4 ── */}
      <div className="relative hidden md:flex md:w-3/4 h-full overflow-hidden">
        <video
          src="/video-login.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-8 left-8 z-10">
          <img src="/logo.png" alt="Flow Hub CRM" className="h-8 object-contain brightness-0 invert" />
        </div>
      </div>

      {/* ── RIGHT: Login panel 1/4 ── */}
      <div className="w-full md:w-1/4 flex flex-col justify-between px-8 py-10 bg-white">

        {/* Top: spacer */}
        <div />

        {/* Center: form */}
        <div className="w-full max-w-xs mx-auto">

          {/* Logo mobile */}
          <div className="flex md:hidden justify-center mb-10">
            <img src="/logo.png" alt="Flow Hub CRM" className="h-8 object-contain" />
          </div>

          {/* Pill */}
          <div className="flex flex-col items-start mb-6">
            <span
              className="text-sm font-semibold px-5 py-1.5 rounded-full flex items-center gap-2"
              style={{
                background: 'transparent',
                border: '1.5px solid transparent',
                backgroundImage: `linear-gradient(white, white), ${GRADIENT}`,
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
              }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: GRADIENT }} />
              <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Red de Distribuidores
              </span>
            </span>
          </div>

          {/* Título */}
          <h1
            className="mb-1"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 900,
              fontSize: 'clamp(22px, 2.2vw, 32px)',
              lineHeight: 1.05,
              letterSpacing: '-1.5px',
              background: GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Portal Distribuidores
          </h1>
          <p className="text-sm text-gray-400 mb-8">Flow Hub CRM · Acceso exclusivo</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-transparent focus:ring-2 focus:ring-[#7c3aed]/30 transition"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-transparent focus:ring-2 focus:ring-[#7c3aed]/30 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ background: GRADIENT }}
              className="w-full mt-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando…
                </>
              ) : 'Entrar al portal'}
            </button>
          </form>

          {/* Link a /unirse */}
          <div className="mt-6 text-center">
            <Link
              to="/unirse"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ¿Aún no eres distribuidor?{' '}
              <span style={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                className="font-semibold">
                Solicita tu acceso
              </span>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-300">© {new Date().getFullYear()} Flow Hub CRM</p>

      </div>
    </div>
  )
}
