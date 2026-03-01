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
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 bg-primary rounded-[10px] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="1" width="7" height="7" rx="2" fill="white"/>
              <rect x="10" y="1" width="7" height="7" rx="2" fill="white" opacity="0.5"/>
              <rect x="1" y="10" width="7" height="7" rx="2" fill="white" opacity="0.5"/>
              <rect x="10" y="10" width="7" height="7" rx="2" fill="white" opacity="0.3"/>
            </svg>
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-primary">FlowCRM</span>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h1 className="font-display font-bold text-2xl tracking-tight text-primary mb-1">
            Bienvenido
          </h1>
          <p className="text-secondary text-sm mb-6">
            Inicia sesión en tu cuenta
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="input"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
                  Entrando...
                </>
              ) : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-black/[0.06] text-center">
            <p className="text-sm text-secondary">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-accent-blue font-semibold hover:underline">
                Registra tu empresa
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-tertiary mt-6">
          © 2025 FlowCRM. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}
