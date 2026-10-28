import clsx from 'clsx'
import {
  BarChart3, MessageSquare, CalendarDays, Users, Package, Sparkles,
  UserCog, Upload, PieChart, Clapperboard, Globe, Gift, Target, Megaphone,
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
    labelKey: 'nav.crm',
    items: [
      { id: 'pipeline', label: 'Pipeline', labelKey: 'nav.pipeline', Icon: BarChart3 },
      { id: 'conversaciones', label: 'Conversaciones', labelKey: 'nav.inbox', Icon: MessageSquare, badge: true },
      { id: 'reuniones', label: 'Reuniones', labelKey: 'nav.meetings', Icon: CalendarDays },
      { id: 'contactos', label: 'Contactos', labelKey: 'nav.contacts', Icon: Users },
      { id: 'catalogo', label: 'Catálogo', labelKey: 'nav.catalog', Icon: Package },
      { id: 'agente', label: 'Agente IA', labelKey: 'nav.agent', Icon: Sparkles },
      { id: 'equipo', label: 'Equipo', labelKey: 'nav.team', Icon: UserCog },
    ],
  },
  {
    label: 'Herramientas',
    labelKey: 'nav.tools',
    items: [
      { id: 'importar', label: 'Importar', labelKey: 'nav.import', Icon: Upload },
      { id: 'reportes', label: 'Reportes', labelKey: 'nav.analytics', Icon: PieChart },
      { id: 'contenido', label: 'Contenido', labelKey: 'nav.content', Icon: Clapperboard },
      { id: 'marcas', label: 'Marca personal', labelKey: 'nav.brands', Icon: Megaphone },
      { id: 'landing', label: 'Landing pages', labelKey: 'nav.landing', Icon: Globe },
      { id: 'referidos', label: 'Referidos', labelKey: 'nav.referrals', Icon: Gift },
      { id: 'metas', label: 'Metas', labelKey: 'nav.goals', Icon: Target },
      { id: 'ajustes', label: 'Ajustes', labelKey: 'nav.settings', Icon: Settings },
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
  onUserClick,
  // Traductor opcional: sin él se usan las etiquetas en español.
  t,
  // Botones del pie. Antes era uno solo y la sidebar global necesita varios
  // (tema, idioma, cerrar sesión).
  actions = [],
  badge,
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

      {/* Todo lo de en medio va en un contenedor que puede desplazarse.
          Antes eran hermanos sueltos dentro de una barra con overflow hidden:
          con suficientes pipelines, el bloque del usuario —con su acceso a la
          configuración y a cerrar sesión— se empujaba fuera de la pantalla y
          no había forma de llegar a él sin reducir el zoom del navegador. */}
      <div className="pv2-sidebar__scroll">
      {groups.map(group => (
        <nav className="pv2-sidebar__nav" key={group.label}>
          {/* Colapsada no hay lugar para el título del grupo; los separa el
              espacio entre bloques. */}
          {!collapsed && (
            <div className="pv2-sidebar__label">
              {t && group.labelKey ? t(group.labelKey) : group.label}
            </div>
          )}
          {group.items.map(item => {
            const { id, Icon } = item
            const label = t && item.labelKey ? t(item.labelKey) : item.label
            return (
              <button
                key={id}
                className={clsx('pv2-nav-item', active === id && 'pv2-nav-item--active')}
                onClick={() => onNavigate?.(id)}
                title={collapsed ? label : undefined}
              >
                <span className="pv2-nav-item__icon"><Icon size={16} /></span>
                <span className="pv2-nav-item__text">{label}</span>
                {item.badge && counts[id] > 0 && <span className="pv2-nav-item__count">{counts[id]}</span>}
              </button>
            )
          })}
        </nav>
      ))}

      {!collapsed && onNewPipeline && (
        <div className="pv2-sidebar__nav">
          <div className="pv2-sidebar__label">Pipelines</div>
          {pipelines.length === 0 && (
            <div className="pv2-pipeline-item" style={{ opacity: 0.5, cursor: 'default' }}>
              Todavía ninguno
            </div>
          )}
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

      {/* Distintivo de administrador: lo tenía la sidebar anterior y sirve
          para saber de un vistazo con qué rol estás entrando. */}
      {badge && !collapsed && (
        <div className="pv2-sidebar__badge">{badge}</div>
      )}
      </div>

      <div className="pv2-sidebar__user">
        <button
          className="pv2-sidebar__user-btn"
          onClick={onUserClick}
          disabled={!onUserClick}
          title={onUserClick ? 'Mi configuración' : undefined}
        >
          <OwnerAvatar name={user?.name} src={user?.photoURL} size={32} />
          {!collapsed && (
            <div className="pv2-sidebar__user-info">
              <div className="pv2-sidebar__user-name">{user?.name}</div>
              <div className="pv2-sidebar__user-role">{user?.role}</div>
            </div>
          )}
        </button>
        <div className="pv2-sidebar__actions">
          {actions.length > 0
            ? actions.map(a => (
                <button key={a.id} className="pv2-icon-btn" onClick={a.onClick} disabled={a.disabled} title={a.title}>
                  {a.icon}
                </button>
              ))
            : (
              <button className="pv2-icon-btn" onClick={onSettings} title={settingsTitle}>
                {settingsIcon || <Settings size={13} />}
              </button>
            )}
        </div>
      </div>
    </aside>
  )
}
