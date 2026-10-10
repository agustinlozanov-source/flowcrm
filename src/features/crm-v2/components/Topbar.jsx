import clsx from 'clsx'
import { ChevronDown, SlidersHorizontal, Search, Plus, LayoutGrid, List, TrendingUp } from 'lucide-react'

const VIEWS = [
  { id: 'kanban', label: 'Kanban', Icon: LayoutGrid },
  { id: 'tabla', label: 'Tabla', Icon: List },
  { id: 'forecast', label: 'Forecast', Icon: TrendingUp },
]

// El atajo se muestra según plataforma: en Mac es Cmd, en el resto Ctrl.
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '')

/**
 * Topbar global sticky de 56 px (A.5). Es contextual: el título, las stats y
 * el botón primario los define la vista que la monta.
 *
 * El view toggle solo aparece si se le pasan vistas — Reuniones o Inbox no lo
 * necesitan y no deberían tener que ocultarlo a mano.
 */
export default function Topbar({
  breadcrumb,
  title,
  onTitleClick,
  stats = [],
  views = VIEWS,
  activeView,
  onViewChange,
  filterCount = 0,
  onFilters,
  onSearch,
  primaryLabel,
  onPrimary,
}) {
  return (
    <header className="pv2-topbar">
      <div className="pv2-topbar__title">
        {breadcrumb && <span className="pv2-topbar__breadcrumb">{breadcrumb}</span>}
        <button className="pv2-topbar__name" onClick={onTitleClick}>
          {title}
          {onTitleClick && <ChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} />}
        </button>
      </div>

      {stats.length > 0 && (
        <>
          <span className="pv2-topbar__divider" />
          <div className="pv2-topbar__stats">
            {stats.map(s => (
              <div key={s.label} className="pv2-topbar__stat">
                <span className="pv2-topbar__stat-label">{s.label}</span>
                <span className="pv2-topbar__stat-value" style={s.tone ? { color: `var(--${s.tone})` } : undefined}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <span className="pv2-topbar__spacer" />

      {activeView && views.length > 0 && (
        <>
          <div className="pv2-view-toggle">
            {views.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={clsx(activeView === id && 'is-active')}
                onClick={() => onViewChange?.(id)}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
          <span className="pv2-topbar__divider" />
        </>
      )}

      {onFilters && (
        <button className="pv2-btn" onClick={onFilters}>
          <SlidersHorizontal size={14} />
          Filtros
          {filterCount > 0 && <span className="pv2-kbd" style={{ marginLeft: 4 }}>{filterCount}</span>}
        </button>
      )}

      <button className="pv2-search" onClick={onSearch}>
        <Search size={14} style={{ opacity: 0.7 }} />
        Buscar
        <span className="pv2-search__kbd">
          <span className="pv2-kbd">{isMac ? '⌘' : 'Ctrl'}</span><span className="pv2-kbd">K</span>
        </span>
      </button>

      {primaryLabel && (
        <button className="pv2-btn pv2-btn--primary" onClick={onPrimary}>
          <Plus size={14} strokeWidth={2.5} />
          {primaryLabel}
        </button>
      )}
    </header>
  )
}
