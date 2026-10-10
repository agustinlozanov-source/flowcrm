import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../crm-v2.css'
import Sidebar from '../components/Sidebar'
import { PIPELINES, USER } from '../boardData'

/* Rutas v2 por item de la sidebar. Las que todavía no existen quedan sin
 * entrada y el click no hace nada — mejor eso que llevar a un 404. */
const ROUTES = {
  pipeline: '/pipeline-v2',
  reuniones: '/reuniones-v2',
  conversaciones: '/inbox-v2',
}

/**
 * Shell de las vistas v2: sidebar propia, tema oscuro y el contenido.
 *
 * Monta la sidebar nueva y no la del CRM actual: el briefing v2 pide
 * reemplazar la global (A.4) y en claro la costura se vería mal.
 */
export default function AppShellV2({ active, children }) {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="pv2 pv2-app">
      <Sidebar
        active={active}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(v => !v)}
        counts={{ conversaciones: 14 }}
        pipelines={PIPELINES}
        activePipeline="monte-sinai"
        user={USER}
        onNavigate={id => ROUTES[id] && navigate(ROUTES[id])}
      />
      <main className="pv2-main">{children}</main>
    </div>
  )
}
