import clsx from 'clsx'
import { MoreVertical, Search, X } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
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
  accent,
  metrics = [],
  distribution,
  activeFilter,
  onFilterChange,
  children,
  isEmpty = false,
  emptyLabel,
  onAdd,
  onMenu,
  // Sin droppableId la columna no acepta tarjetas: así la página de
  // componentes puede montarla fuera de un DndContext.
  droppableId,
  canDrop = true,
  /* Buscar y filtrar dentro de la columna.
   *
   * Con doscientas tarjetas en una fase, el buscador de arriba no alcanza:
   * busca en todo el tablero y te deja igual de perdido. Lo que hace falta es
   * encontrar a alguien dentro de la fase donde sabes que está, sin scroll. */
  busqueda = '',
  onBusqueda,
  etapas = [],
  etapaFiltro = null,
  onEtapaFiltro,
  totalSinFiltrar,
}) {
  const isHandoff = variant === 'handoff'
  const total = distribution ? Object.values(distribution).reduce((a, b) => a + b, 0) : 0

  return (
    <section className="pv2-col">
      <div className="pv2-col__accent" style={{ background: accent }} />
      <header className="pv2-col__header">
        <div className="pv2-col__header-top">
          <h3 className="pv2-col__name">{name}</h3>
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

        {onBusqueda && (
          <div className="pv2-col__buscar">
            <Search size={12} className="pv2-col__buscar-icono" />
            <input
              className="pv2-col__buscar-input"
              value={busqueda}
              onChange={e => onBusqueda(e.target.value)}
              placeholder="Buscar en esta fase"
              autoComplete="off"
            />
            {busqueda && (
              <button className="pv2-col__buscar-limpiar" onClick={() => onBusqueda('')} title="Limpiar">
                <X size={11} />
              </button>
            )}
          </div>
        )}

        {/* Cuántos hay en cada etapa, y el filtro, en la misma ficha. El dato
          * sin la acción obliga a buscar a mano lo que acabas de contar. */}
        {etapas.length > 0 && (
          <div className="pv2-etapas-chips">
            {etapas.map(e => (
              <button
                key={e.id}
                className={clsx('pv2-etapa-chip',
                  etapaFiltro === e.id && 'is-activo',
                  etapaFiltro && etapaFiltro !== e.id && 'is-apagado')}
                style={{ '--chip': e.color || 'var(--text-dim)' }}
                onClick={() => onEtapaFiltro?.(etapaFiltro === e.id ? null : e.id)}
                title={`${e.name}: ${e.cuantos}`}
              >
                <span className="pv2-etapa-chip__punto" />
                <span className="pv2-etapa-chip__nombre">{e.name}</span>
                <span className="pv2-etapa-chip__n">{e.cuantos}</span>
              </button>
            ))}
          </div>
        )}

        {(busqueda || etapaFiltro) && typeof totalSinFiltrar === 'number' && (
          <p className="pv2-col__filtrado">
            {metrics[0]?.value ?? 0} de {totalSinFiltrar}
          </p>
        )}

      </header>

      <ColumnBody droppableId={droppableId} canDrop={canDrop}>
        {isEmpty
          ? <div className="pv2-col__empty">{emptyLabel || 'Sin tarjetas acá'}</div>
          : children}
      </ColumnBody>

      <footer className="pv2-col__footer" style={(onAdd || isHandoff) ? undefined : { visibility: 'hidden' }}>
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

/* El cuerpo es lo que recibe la tarjeta. Va aparte porque useDroppable es un
 * hook y no puede llamarse condicionalmente dentro de la columna. */
function ColumnBody({ droppableId, canDrop, children }) {
  if (!droppableId) return <div className="pv2-col__body">{children}</div>
  return <DroppableBody id={droppableId} canDrop={canDrop}>{children}</DroppableBody>
}

function DroppableBody({ id, canDrop, children }) {
  // A propósito no se deshabilita el droppable: deshabilitado nunca reporta
  // isOver y el destino inválido quedaba sin marcar — la tarjeta no caía y no
  // se entendía por qué. Se marca en rojo y el rechazo lo hace quien suelta.
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'pv2-col__body',
        isOver && canDrop && 'pv2-col__body--over',
        isOver && !canDrop && 'pv2-col__body--blocked',
      )}
    >
      {children}
    </div>
  )
}
