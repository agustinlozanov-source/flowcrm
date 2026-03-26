import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/pipeline')
    } catch (err) {
      const msg = {
        'auth/user-not-found': 'No existe una cuenta con ese email.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/invalid-credential': 'Email o contraseña incorrectos.',
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
        {/* Overlay sutil para que el logo resalte */}
        <div className="absolute inset-0 bg-black/10" />

        {/* Logo top-left */}
        <div className="absolute top-8 left-8 z-10">
          <img src="/logo.png" alt="FlowCRM" className="h-8 object-contain brightness-0 invert" />
        </div>
      </div>

      {/* ── RIGHT: Login panel 1/4 ── */}
      <div className="w-full md:w-1/4 flex flex-col justify-between px-8 py-10 bg-white">

        {/* Top: lang button */}
        <div className="flex justify-end">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-gray-300 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            EN
          </button>
        </div>

        {/* Center: form */}
        <div className="w-full max-w-xs mx-auto">

          {/* Logo mobile */}
          <div className="flex md:hidden justify-center mb-10">
            <img src="/logo.png" alt="FlowCRM" className="h-8 object-contain" />
          </div>

          {/* Pill AI for Sales estilo Welcome */}
          <div className="flex flex-col items-start mb-6">
            <span
              className="text-sm font-semibold px-5 py-1.5 rounded-full flex items-center gap-2"
              style={{
                background: 'transparent',
                border: '1.5px solid transparent',
                backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #1aab99, #3533cd)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #1aab99, #3533cd)' }}
              />
              <span
                style={{
                  background: 'linear-gradient(135deg, #1aab99, #3533cd)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                AI for Sales
              </span>
            </span>
          </div>

          {/* Título en degradado */}
          <h1
            className="mb-1"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 900,
              fontSize: 'clamp(26px, 2.4vw, 36px)',
              lineHeight: 1.05,
              letterSpacing: '-1.5px',
              background: 'linear-gradient(135deg, #1aab99, #3533cd)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Bienvenido
          </h1>
          <p className="text-sm text-gray-400 mb-8">
            Inicia sesión en tu cuenta
          </p>

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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-transparent focus:ring-2 focus:ring-[#1aab99]/40 transition"
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-transparent focus:ring-2 focus:ring-[#1aab99]/40 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ background: 'linear-gradient(135deg, #1aab99, #3533cd)' }}
              className="w-full mt-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </>
              ) : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-400">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="font-semibold text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #1aab99, #3533cd)' }}>
                Registra tu empresa
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-300 mt-8 hidden">
            © 2026 FlowCRM. Todos los derechos reservados.
          </p>
        </div>

        {/* Footer bottom */}
        <p className="text-center text-xs text-gray-300">
          © 2026 FlowCRM. Todos los derechos reservados.
        </p>

      </div>

    </div>
  )
}
