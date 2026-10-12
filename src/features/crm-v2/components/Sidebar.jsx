import clsx from 'clsx'
import {
  BarChart3, MessageSquare, CalendarDays, Users, Package, Sparkles,
  UserCog, Upload, PieChart, Clapperboard, Globe, Gift, Target,
  Settings, PanelLeftClose, PanelLeft,
} from 'lucide-react'
import OwnerAvatar from './OwnerAvatar'

/* Toda la navegación del CRM, agrupada como en la sidebar actual. El orden de
 * la parte de arriba es el del briefing (A.4); lo que el briefing no nombraba
 * no se elimina, se conserva: ninguna pantalla puede desaparecer porque la
 * sidebar se haya rediseñado. */
export const NAV_GROUPS = [
  {
    label: 'CRM',
    items: [
      { id: 'pipeline', label: 'Pipeline', Icon: BarChart3 },
      { id: 'conversaciones', label: 'Conversaciones', Icon: MessageSquare, badge: true },
      { id: 'reuniones', label: 'Reuniones', Icon: CalendarDays },
      { id: 'contactos', label: 'Contactos', Icon: Users },
      { id: 'catalogo', label: 'Catálogo', Icon: Package },
      { id: 'agente', label: 'Agente IA', Icon: Sparkles },
      { id: 'equipo', label: 'Equipo', Icon: UserCog },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      { id: 'importar', label: 'Importar', Icon: Upload },
      { id: 'reportes', label: 'Reportes', Icon: PieChart },
      { id: 'contenido', label: 'Contenido', Icon: Clapperboard },
      { id: 'landing', label: 'Landing pages', Icon: Globe },
      { id: 'referidos', label: 'Referidos', Icon: Gift },
      { id: 'metas', label: 'Metas', Icon: Target },
      { id: 'ajustes', label: 'Ajustes', Icon: Settings },
    ],
  },
]

// Lista plana, para quien solo necesite recorrer los items.
export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

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
  // Los grupos llegan ya filtrados por permisos y módulos; el default es la
  // lista completa, para la página de componentes.
  groups = NAV_GROUPS,
  counts = {},
  pipelines = [],
  activePipeline,
  onNavigate,
  onSelectPipeline,
  onNewPipeline,
  user,
  onSettings,
  settingsIcon,
  settingsTitle = 'Configuración',
  // El logo de marca es claro y desaparece sobre blanco; public/logo.png es
  // la variante oscura.
  logo = '/flowhub-logo2.png',
}) {
  return (
    <aside className={clsx('pv2-sidebar', collapsed && 'pv2-sidebar--collapsed')}>
      <div className="pv2-sidebar__logo">
        {collapsed
          ? <button className="pv2-icon-btn" onClick={onToggleCollapse} title="Expandir"><PanelLeft size={15} /></button>
          : (
            <>
              <img src={logo} alt="Flow Hub" />
              <button className="pv2-icon-btn" style={{ marginLeft: 'auto' }} onClick={onToggleCollapse} title="Colapsar">
                <PanelLeftClose size={14} />
              </button>
            </>
          )}
      </div>

      {groups.map(group => (
        <nav className="pv2-sidebar__nav" key={group.label}>
          {/* Colapsada no hay lugar para el título del grupo; los separa el
              espacio entre bloques. */}
          {!collapsed && <div className="pv2-sidebar__label">{group.label}</div>}
          {group.items.map(({ id, label, Icon, badge }) => (
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
      ))}

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
        <button className="pv2-icon-btn" onClick={onSettings} title={settingsTitle}>
          {settingsIcon || <Settings size={13} />}
        </button>
      </div>
    </aside>
  )
}
