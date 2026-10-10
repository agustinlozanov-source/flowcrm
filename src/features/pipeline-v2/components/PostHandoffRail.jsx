import clsx from 'clsx'
import { Maximize2 } from 'lucide-react'

// Las cinco post-etapas son fijas del producto: no las define el cliente.
export const POST_STAGES = [
  { id: 'open', name: 'Oportunidad abierta', tone: null },
  { id: 'safe', name: 'Oportunidad segura', tone: 'safe' },
  { id: 'won', name: 'Venta cerrada', tone: 'won' },
  { id: 'dropped', name: 'Descartado', tone: 'dropped' },
  { id: 'closed', name: 'Cerrado', tone: 'closed' },
]

/**
 * Rail inferior con las cinco etapas posteriores al handoff, en cajas
 * compactas. Cada una se expande como drawer al hacer click.
 */
export default function PostHandoffRail({ stages = [], onExpand, onStageClick }) {
  const byId = Object.fromEntries(stages.map(s => [s.id, s]))

  return (
    <div className="pv2-rail">
      <div className="pv2-rail__header">
        <div className="pv2-rail__label">
          <span className="pv2-rail__dot" />
          Después del handoff
          <span style={{ color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 0, textTransform: 'none', marginLeft: 4 }}>
            · gestión manual
          </span>
        </div>
        <button className="pv2-rail__expand" onClick={onExpand}>
          <Maximize2 size={11} />
          Expandir vista
        </button>
      </div>

      <div className="pv2-rail__stages">
        {POST_STAGES.map(stage => {
          const data = byId[stage.id] || {}
          return (
            <button
              key={stage.id}
              className={clsx('pv2-post', stage.tone && `pv2-post--${stage.tone}`)}
              onClick={() => onStageClick?.(stage.id)}
            >
              <div className="pv2-post__top">
                <span className="pv2-post__name">{stage.name}</span>
                <span className="pv2-post__count">{data.count ?? 0}</span>
              </div>
              <div className="pv2-post__value">
                ${Number(data.value ?? 0).toLocaleString('es-MX')}
              </div>
              <div className="pv2-post__sub">
                {data.subTone
                  ? <span className={data.subTone}>{data.sub}</span>
                  : (data.sub || '—')}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
