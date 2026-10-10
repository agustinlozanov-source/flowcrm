import clsx from 'clsx'
import { Sparkles, Check, X, Pencil } from 'lucide-react'

const ESTADOS = {
  abierta:  { label: 'Abierta',  tone: null },
  ganada:   { label: 'Ganada',   tone: 'green' },
  perdida:  { label: 'Perdida',  tone: 'red' },
  descartada: { label: 'Descartada', tone: null },
}

/**
 * Una oportunidad vinculada al contacto. La tarjeta no es un deal: acumula
 * varias de estas y se van cerrando una por una.
 *
 * `auto` marca las que vinculó la IA por matching de problemTags — se señala
 * con el sparkle lila, igual que el resto de lo que escribe la IA.
 */
export default function OpportunityRow({ opportunity, onClose, onDiscard, onEdit }) {
  const { name, value, probability = 'media', status = 'abierta', auto, reason } = opportunity
  const estado = ESTADOS[status] || ESTADOS.abierta
  const cerrada = status !== 'abierta'

  return (
    <div className={clsx('pv2-opp', cerrada && 'pv2-opp--closed')}>
      <div className="pv2-opp__main">
        <div className="pv2-opp__name">{name}</div>
        <div className="pv2-opp__meta">
          {auto && (
            <span className="pv2-opp__ai" title={reason || 'Vinculada automáticamente por la IA'}>
              <Sparkles size={10} />
            </span>
          )}
          <span className={`pv2-opp__prob pv2-opp__prob--${probability}`}>{probability}</span>
          {cerrada && <span style={{ color: estado.tone ? `var(--${estado.tone})` : undefined }}>{estado.label}</span>}
        </div>
      </div>

      <span className="pv2-opp__value">${Number(value).toLocaleString('es-MX')}</span>

      {!cerrada && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="pv2-icon-btn" onClick={onEdit} title="Editar precio"><Pencil size={12} /></button>
          <button className="pv2-icon-btn" onClick={onDiscard} title="Descartar"><X size={12} /></button>
          <button className="pv2-icon-btn" onClick={onClose} title="Cerrar como ganada" style={{ color: 'var(--green)' }}>
            <Check size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
