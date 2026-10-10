import clsx from 'clsx'
import {
  Sun, BarChart3, MessageSquare, CalendarDays, Users, Building2,
  Package, Zap, PieChart, Settings, PanelLeftClose, PanelLeft,
} from 'lucide-react'
import OwnerAvatar from './OwnerAvatar'

// Orden exacto del briefing (A.4). Pipeline es la vista default.
export const NAV_ITEMS = [
  { id: 'hoy', label: 'Hoy', Icon: Sun },
  { id: 'pipeline', label: 'Pipeline', Icon: BarChart3 },
  { id: 'conversaciones', label: 'Conversaciones', Icon: MessageSquare, badge: true },
  { id: 'reuniones', label: 'Reuniones', Icon: CalendarDays },
  { id: 'contactos', label: 'Contactos', Icon: Users },
  { id: 'empresas', label: 'Empresas', Icon: Building2 },
  { id: 'catalogo', label: 'Catálogo', Icon: Package },
  { id: 'automatizaciones', label: 'Automatizaciones', Icon: Zap },
  { id: 'reportes', label: 'Reportes', Icon: PieChart },
]

/**
 * Sidebar global del CRM rediseñado. Colapsa a 60 px mostrando solo íconos.
 *
 * `counts` lleva los badges por item (hoy solo Conversaciones los usa, pero
 * queda abierto para que cualquiera muestre el suyo sin tocar el componente).
 */
export default function Sidebar({
  active = 'pipeline',
  collapsed = false,
  onToggleCollapse,
  counts = {},
  pipelines = [],
  activePipeline,
  onNavigate,
  onSelectPipeline,
  onNewPipeline,
  user,
  onSettings,
}) {
  return (
    <aside className={clsx('pv2-sidebar', collapsed && 'pv2-sidebar--collapsed')}>
      <div className="pv2-sidebar__logo">
        {collapsed
          ? <button className="pv2-icon-btn" onClick={onToggleCollapse} title="Expandir"><PanelLeft size={15} /></button>
          : (
            <>
              <img src="/flowhub-logo2.png" alt="Flow Hub" />
              <button className="pv2-icon-btn" style={{ marginLeft: 'auto' }} onClick={onToggleCollapse} title="Colapsar">
                <PanelLeftClose size={14} />
              </button>
            </>
          )}
      </div>

      <nav className="pv2-sidebar__nav">
        {NAV_ITEMS.map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            className={clsx('pv2-nav-item', active === id && 'pv2-nav-item--active')}
            onClick={() => onNavigate?.(id)}
            title={collapsed ? label : undefined}
          >
            <span className="pv2-nav-item__icon"><Icon size={16} /></span>
            <span className="pv2-nav-item__text">{label}</span>
            {badge && counts[id] > 0 && <span className="pv2-nav-item__count">{counts[id]}</span>}
          </button>
        ))}
      </nav>

      {!collapsed && pipelines.length > 0 && (
        <div className="pv2-sidebar__nav">
          <div className="pv2-sidebar__label">Pipelines</div>
          {pipelines.map(p => (
            <button
              key={p.id}
              className={clsx('pv2-pipeline-item', activePipeline === p.id && 'pv2-pipeline-item--active')}
              onClick={() => onSelectPipeline?.(p.id)}
            >
              <span className="pv2-pipeline-dot" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
          <button className="pv2-pipeline-item" onClick={onNewPipeline}>
            <span className="pv2-pipeline-dot" style={{ background: 'var(--text-muted)' }} />
            + Nuevo pipeline
          </button>
        </div>
      )}

      <div className="pv2-sidebar__user">
        <OwnerAvatar name={user?.name} size={32} />
        <div className="pv2-sidebar__user-info">
          <div className="pv2-sidebar__user-name">{user?.name}</div>
          <div className="pv2-sidebar__user-role">{user?.role}</div>
        </div>
        <button className="pv2-icon-btn" onClick={onSettings} title="Configuración">
          <Settings size={13} />
        </button>
      </div>
    </aside>
  )
}
