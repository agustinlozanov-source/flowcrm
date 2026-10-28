import { useRef, useEffect } from 'react'
import clsx from 'clsx'
import { ChevronDown, SlidersHorizontal, Search, Plus, LayoutGrid, List, TrendingUp, X } from 'lucide-react'

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
  searchValue = '',
  primaryLabel,
  onPrimary,
}) {
  const buscador = useRef(null)

  // El atajo que el propio botón anunciaba y no existía.
  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        buscador.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="pv2-topbar">
      <div className="pv2-topbar__title">
        {breadcrumb && <span className="pv2-topbar__breadcrumb">{breadcrumb}</span>}
        {/* Sin acción no es un botón: era uno siempre, así que en las pantallas
            que no le pasan nada se veía pulsable y no pasaba nada al hacer
            clic. */}
        {onTitleClick ? (
          <button className="pv2-topbar__name" onClick={onTitleClick} title="Editar este pipeline">
            {title}
            <ChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        ) : (
          <span className="pv2-topbar__name">{title}</span>
        )}
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

      <div className="pv2-search">
        <Search size={14} style={{ opacity: 0.7, flexShrink: 0 }} />
        <input
          ref={buscador}
          className="pv2-search__input"
          value={searchValue}
          onChange={e => onSearch?.(e.target.value)}
          placeholder="Buscar por nombre, empresa o teléfono"
        />
        {searchValue
          ? (
            <button className="pv2-search__clear" onClick={() => onSearch?.('')} title="Limpiar">
              <X size={13} />
            </button>
          ) : (
            <span className="pv2-search__kbd">
              <span className="pv2-kbd">{isMac ? '⌘' : 'Ctrl'}</span><span className="pv2-kbd">K</span>
            </span>
          )}
      </div>

      {primaryLabel && (
        <button className="pv2-btn pv2-btn--primary" onClick={onPrimary}>
          <Plus size={14} strokeWidth={2.5} />
          {primaryLabel}
        </button>
      )}
    </header>
  )
}
