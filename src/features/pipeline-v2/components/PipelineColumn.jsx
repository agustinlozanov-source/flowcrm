import clsx from 'clsx'
import { MoreVertical } from 'lucide-react'

/**
 * Columna de una etapa pre-handoff. El header lleva las métricas agregadas y
 * la barra de color de la etapa; el cuerpo scrollea solo y el footer tiene el
 * alta rápida.
 *
 * `color` es el color de la etapa: viene del pipeline, no está hardcodeado,
 * porque las etapas pre-handoff las define el admin de cada cliente.
 */
export default function PipelineColumn({
  name,
  color = '#6B7280',
  metrics = [],
  children,
  isEmpty = false,
  emptyLabel = 'Sin deals en esta etapa',
  onAdd,
  onMenu,
  addLabel = '+ Nuevo deal',
  addStyle,
  className,
  headerExtra,
}) {
  return (
    <section className={clsx('pv2-col', className)}>
      <header className="pv2-col__header">
        <div className="pv2-col__header-top">
          <h3 className="pv2-col__name">
            <span className="pv2-col__dot" style={{ background: color }} />
            {name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {headerExtra}
            <button className="pv2-icon-btn" onClick={onMenu} title="Opciones de la etapa">
              <MoreVertical size={13} />
            </button>
          </div>
        </div>

        {metrics.length > 0 && (
          <div className="pv2-col__metrics">
            {metrics.map(m => (
              <div key={m.label} className="pv2-col__metric">
                <div className="pv2-col__metric-label">{m.label}</div>
                <div className="pv2-col__metric-value" style={m.tone ? { color: `var(--${m.tone})` } : undefined}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pv2-col__bar" style={{ background: color }} />
      </header>

      <div className="pv2-col__body">
        {isEmpty ? <div className="pv2-col__empty">{emptyLabel}</div> : children}
      </div>

      <footer className="pv2-col__footer">
        <button className="pv2-add" onClick={onAdd} style={addStyle}>{addLabel}</button>
      </footer>
    </section>
  )
}
