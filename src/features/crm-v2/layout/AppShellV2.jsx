import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
import '../crm-v2.css'
import Sidebar from '../components/Sidebar'
import { useAuthStore } from '@/store/authStore'

/* Rutas por item de la sidebar. Donde todavía no hay vista v2 se va a la
 * pantalla actual del CRM: es menos bonito que quedarse en el mundo nuevo,
 * pero deja la app entera navegable en vez de hacer un callejón sin salida.
 * Los items sin entrada no hacen nada — mejor eso que llevar a un 404. */
const ROUTES = {
  pipeline: '/pipeline-v2',
  conversaciones: '/inbox-v2',
  reuniones: '/reuniones-v2',
  contactos: '/leads',
  catalogo: '/products',
  agente: '/agent',
  equipo: '/team',
  importar: '/import',
  reportes: '/analytics',
  contenido: '/content',
  landing: '/landing',
  referidos: '/referrals',
  metas: '/goals',
  ajustes: '/settings',
}

/**
 * Shell de las vistas v2: sidebar propia, tema oscuro y el contenido.
 *
 * Monta la sidebar nueva y no la del CRM actual: el briefing v2 pide
 * reemplazar la global (A.4) y en claro la costura se vería mal.
 */
export default function AppShellV2({
  active, children,
  pipelines = [], activePipelineId = null, onSelectPipeline, onNewPipeline,
}) {
  const { user, org } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  // El tema se recuerda por usuario. El try/catch es porque en una ventana
  // privada localStorage puede tirar al leer.
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('pv2-theme') || 'dark' } catch { return 'dark' }
  })
  const navigate = useNavigate()

  useEffect(() => {
    try { localStorage.setItem('pv2-theme', theme) } catch { /* sin persistencia, no pasa nada */ }
  }, [theme])

  return (
    <div className={`pv2 pv2-app${theme === 'light' ? ' pv2--light' : ''}`}>
      <Sidebar
        active={active}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(v => !v)}
        pipelines={pipelines}
        activePipeline={activePipelineId}
        onSelectPipeline={onSelectPipeline}
        onNewPipeline={onNewPipeline}
        user={{
          name: user?.name || user?.email || 'Sin sesión',
          role: [user?.role === 'superadmin' ? 'Superadmin' : 'Admin', org?.name].filter(Boolean).join(' · '),
        }}
        logo={theme === 'light' ? '/logo.png' : '/flowhub-logo2.png'}
        onNavigate={id => ROUTES[id] && navigate(ROUTES[id])}
        onSettings={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        settingsIcon={theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        settingsTitle={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      />
      <main className="pv2-main">{children}</main>
    </div>
  )
}
