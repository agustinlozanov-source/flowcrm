import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Sun, Moon, LogOut, Shield } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useLang } from '@/hooks/useLang'
import toast from 'react-hot-toast'
import SupportChat from './SupportChat'
import Sidebar from '@/features/crm-v2/components/Sidebar'
import { useNavItems } from '@/features/crm-v2/useNavItems'
import { ROUTES, esRediseñada } from '@/features/crm-v2/routes'
import '@/features/crm-v2/crm-v2.css'

const NAV_SECTIONS = [
  {
    labelKey: 'nav.crm',
    items: [
      {
        to: '/pipeline',
        moduleId: 'pipeline',
        labelKey: 'nav.pipeline',
        permission: null, // always visible
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="4" height="16" rx="1.5" fill="currentColor" />
            <rect x="7" y="5" width="4" height="12" rx="1.5" fill="currentColor" />
            <rect x="13" y="8" width="4" height="9" rx="1.5" fill="currentColor" />
          </svg>
        ),
      },
      {
        to: '/leads',
        moduleId: 'leads',
        labelKey: 'nav.contacts',
        permission: null,
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        to: '/products',
        moduleId: 'products',
        labelKey: 'nav.catalog',
        permission: null, // visible to all, readonly for sellers without permission
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        ),
      },
      {
        to: '/agent',
        moduleId: 'agent',
        labelKey: 'nav.agent',
        permission: 'can_configure_agent',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <path d="M9 1.5L11.47 6.5H16.5L12.5 9.97L14 15L9 12L4 15L5.5 9.97L1.5 6.5H6.53L9 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        to: '/inbox',
        moduleId: 'inbox',
        labelKey: 'nav.inbox',
        permission: null,
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <path d="M2 9a7 7 0 1114 0 7 7 0 01-14 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 16c1.6 0 3.1-.5 4.3-1.4L16 16l-1.4-2.7A7 7 0 002 9a7 7 0 007 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        to: '/meetings',
        moduleId: 'meetings',
        labelKey: 'nav.meetings',
        permission: null,
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="3" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 7h8M5 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        to: '/team',
        moduleId: 'team',
        labelKey: 'nav.team',
        permission: null, // visible to all — sellers see their own genealogy
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="13" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M1 15c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M13 11c1.657 0 3 .895 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    labelKey: 'nav.tools',
    items: [
      {
        to: '/import',
        moduleId: 'import',
        labelKey: 'nav.import',
        featureFlag: 'import',
        permission: null,
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <path d="M9 1v10M5 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 13v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        to: '/analytics',
        moduleId: 'analytics',
        labelKey: 'nav.analytics',
        permission: 'can_see_team_reports',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <path d="M3 12L6 9 9 11 13 6 16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="1" y="1" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        ),
      },
      {
        to: '/content',
        moduleId: 'content',
        labelKey: 'nav.content',
        permission: null,
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 8l4 2.5L7 13V8z" fill="currentColor" opacity="0.6" />
          </svg>
        ),
      },
      {
        to: '/landing',
        moduleId: 'landing',
        labelKey: 'nav.landing',
        featureFlag: 'landing',
        permission: null,
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 6h14M6 16V6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        ),
      },
      {
        to: '/referrals',
        moduleId: 'referrals',
        labelKey: 'nav.referrals',
        featureFlag: 'referrals',
        badge: null,
        permission: null,
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <path d="M9 1L11 7H17L12 11L14 17L9 13L4 17L6 11L1 7H7L9 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        to: '/goals',
        moduleId: 'goals',
        labelKey: 'nav.goals',
        permission: null,
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="9" cy="9" r="4" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="9" cy="9" r="1.5" fill="currentColor" />
          </svg>
        ),
      },
      {
        to: '/settings',
        moduleId: null,
        labelKey: 'nav.settings',
        permission: null,
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.42 1.42M13.36 13.36l1.42 1.42M3.22 14.78l1.42-1.42M13.36 4.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ),
      },
    ],
  },
]

/* ── Marco de toda la aplicación ─────────────────────────────────────────────
 *
 * Desde el rediseño el marco es uno solo: la sidebar nueva envuelve todas las
 * pantallas, las rediseñadas y las que todavía no. Antes había dos mundos y
 * cambiaba el entorno entero según dónde entrabas.
 *
 * NAV_SECTIONS de arriba ya no dibuja nada, pero se queda: es la fuente contra
 * la que se verifican las puertas de useNavItems (módulos, permisos, flags).
 */
export default function AppLayout() {
  const { org, user, memberData } = useAuthStore()
  const { isAdmin } = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()
  const [signingOut, setSigningOut] = useState(false)
  // La sidebar colapsada se recuerda: quien trabaja en pantalla chica no
  // quiere volver a cerrarla en cada recarga.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('pv2-sidebar-collapsed') === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('pv2-sidebar-collapsed', collapsed ? '1' : '0') } catch { /* ok */ }
  }, [collapsed])
  const { t } = useLang()
  const groups = useNavItems()

  // Claro por defecto: el marco nuevo envuelve pantallas que son claras, y
  // arrancar en oscuro dejaba la costura a la vista en todas ellas.
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('pv2-theme') || 'light' } catch { return 'light' }
  })
  useEffect(() => {
    try { localStorage.setItem('pv2-theme', theme) } catch { /* sin persistencia, no pasa nada */ }
  }, [theme])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut(auth)
      navigate('/login')
    } catch {
      toast.error('Error al cerrar sesión')
    } finally {
      setSigningOut(false)
    }
  }

  // Qué item se marca como activo sale de la ruta, no de un prop: así no hay
  // que acordarse de pasarlo en cada pantalla.
  const activeId = Object.entries(ROUTES).find(([, path]) => location.pathname.startsWith(path))?.[0]

  return (
    <div className={`pv2 pv2-app${theme === 'light' ? ' pv2--light' : ''}`}>
      <Sidebar
        active={activeId}
        groups={groups}
        t={t}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(v => !v)}
        logo={theme === 'light' ? '/logo.png' : '/flowhub-logo2.png'}
        onNavigate={id => ROUTES[id] && navigate(ROUTES[id])}
        badge={isAdmin ? <><Shield size={11} /> Administrador</> : null}
        user={{
          name: memberData?.name || user?.displayName || user?.email || 'Usuario',
          role: org?.name || 'Mi organización',
          photoURL: memberData?.photoURL || user?.photoURL || null,
        }}
        // Hacer clic en uno mismo abre la propia configuración: es lo que
        // cualquiera espera y antes no hacía nada.
        onUserClick={() => navigate('/settings')}
        actions={[
          {
            id: 'tema',
            title: theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
            icon: theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />,
            onClick: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')),
          },
          {
            id: 'salir',
            title: 'Cerrar sesión',
            icon: <LogOut size={13} />,
            onClick: handleSignOut,
            disabled: signingOut,
          },
        ]}
      />

      <main className={esRediseñada(location.pathname) ? 'pv2-main' : 'pv2-main pv2-main--scroll'}>
        <Outlet />
      </main>

      <SupportChat />
    </div>
  )
}
