import clsx from 'clsx'
import { ChevronUp } from 'lucide-react'

/**
 * Barra de métricas del pipeline. Colapsable, no fija: por defecto visible.
 * Cada métrica es clickeable para hacer drill-down.
 */
export default function InsightsBar({ metrics = [], collapsed = false, onToggle, onDrillDown }) {
  if (collapsed) return null

  return (
    <div className="pv2-insights">
      {metrics.map((m, i) => (
        <div key={m.label} style={{ display: 'contents' }}>
          {i > 0 && <span className="pv2-insights__divider" />}
          <button className="pv2-insight" onClick={() => onDrillDown?.(m)}>
            <span className="pv2-insight__label">{m.label}</span>
            <span className="pv2-insight__value" style={m.color ? { color: `var(--${m.color})` } : undefined}>
              {m.value}
              {m.trend && (
                <span className={clsx(`pv2-insight__trend--${m.trend.dir}`)}>
                  {m.trend.dir === 'up' ? '↑' : '↓'} {m.trend.label}
                </span>
              )}
            </span>
          </button>
        </div>
      ))}
      <button className="pv2-icon-btn pv2-insights__toggle" onClick={onToggle} title="Ocultar métricas">
        <ChevronUp size={13} />
      </button>
    </div>
  )
}
