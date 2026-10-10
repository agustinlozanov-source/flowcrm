import clsx from 'clsx'
import { MoreVertical } from 'lucide-react'
import { MATURITY } from '../maturity'

/**
 * Columna del board. Tres variantes, una por fase del pipeline:
 *
 *   calentamiento — la IA trabaja. Lleva barra apilada de distribución por
 *                   nivel de madurez, y cada segmento filtra la columna.
 *   handoff       — la bisagra. Tratamiento de marca: gradiente y borde teal.
 *   cierre        — gestión manual. Dos colores según queden oportunidades.
 *
 * Las tarjetas ya llevan su color, así que la columna no repite paleta: solo
 * la barra de distribución usa color, y es para agregar, no para decorar.
 */
export default function PipelineColumn({
  variant = 'calentamiento',
  name,
  metrics = [],
  distribution,
  activeFilter,
  onFilterChange,
  children,
  isEmpty = false,
  emptyLabel,
  onAdd,
  onMenu,
}) {
  const isHandoff = variant === 'handoff'
  const total = distribution ? Object.values(distribution).reduce((a, b) => a + b, 0) : 0

  return (
    <section className={clsx('pv2-col', isHandoff && 'pv2-col--handoff')}>
      <header className="pv2-col__header">
        <div className="pv2-col__header-top">
          <h3 className="pv2-col__name">
            {isHandoff && <span className="pv2-col__dot" />}
            {name}
          </h3>
          <button className="pv2-icon-btn" onClick={onMenu} title="Opciones de la columna">
            <MoreVertical size={13} />
          </button>
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

        {distribution && total > 0 && (
          <>
            <div className="pv2-dist">
              {Object.entries(distribution).map(([level, count]) => count > 0 && (
                <button
                  key={level}
                  className={clsx('pv2-dist__seg', activeFilter && activeFilter !== level && 'pv2-dist__seg--muted')}
                  style={{ width: `${(count / total) * 100}%`, background: MATURITY[level].color }}
                  onClick={() => onFilterChange?.(activeFilter === level ? null : level)}
                  title={`${MATURITY[level].label}: ${count}`}
                />
              ))}
            </div>
            <div className="pv2-dist__legend">
              {Object.entries(distribution).map(([level, count]) => (
                <button
                  key={level}
                  className="pv2-dist__item"
                  style={activeFilter && activeFilter !== level ? { opacity: 0.4 } : undefined}
                  onClick={() => onFilterChange?.(activeFilter === level ? null : level)}
                >
                  <span className="pv2-dist__dot" style={{ background: MATURITY[level].color }} />
                  {count}
                </button>
              ))}
            </div>
          </>
        )}

        {isHandoff && <div className="pv2-col__bar" />}
      </header>

      <div className="pv2-col__body">
        {isEmpty
          ? <div className="pv2-col__empty">{emptyLabel || 'Sin tarjetas acá'}</div>
          : children}
      </div>

      <footer className="pv2-col__footer">
        <button
          className="pv2-add"
          onClick={onAdd}
          style={isHandoff ? { borderColor: 'rgba(26,171,153,0.4)', color: 'var(--teal)' } : undefined}
        >
          {isHandoff ? '+ Mover tarjeta aquí' : '+ Nueva tarjeta'}
        </button>
      </footer>
    </section>
  )
}
