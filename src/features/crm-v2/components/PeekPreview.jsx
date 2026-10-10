import { useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import ScoreChip from './ScoreChip'
import { maturityFromScore } from '../maturity'

/**
 * Vista rápida de 320 px, solo lectura, que abre Space sobre una tarjeta.
 * Más chica que el side panel a propósito: es un vistazo de 60 segundos, no
 * un lugar para trabajar.
 *
 * ↑/↓ navegan sin cerrarla y Esc la cierra. Los atajos viven acá y no en el
 * board para que la navegación funcione aunque el foco esté en otro lado.
 */
export default function PeekPreview({ deal, open = false, onClose, onPrev, onNext }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.() }
      if (e.key === 'ArrowUp') { e.preventDefault(); onPrev?.() }
      if (e.key === 'ArrowDown') { e.preventDefault(); onNext?.() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, onPrev, onNext])

  if (!open || !deal) return null
  const level = maturityFromScore(deal.score)

  return (
    <aside className="pv2-peek" style={{ borderLeft: `8px solid ${level.color}` }}>
      <header className="pv2-peek__header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div className="pv2-peek__title">{deal.name}</div>
            <div className="pv2-peek__sub">{deal.sub}</div>
          </div>
          <ScoreChip score={deal.score} trend={deal.scoreTrend} />
        </div>
      </header>

      <div className="pv2-peek__body">
        <div className="pv2-peek__row">
          <span className="pv2-peek__label">Monto</span>
          <span className="pv2-peek__value">
            ${Number(deal.amount).toLocaleString('es-MX')} {deal.currency || 'MXN'}
            {deal.potential > 0 && <span className="pv2-potential" style={{ marginLeft: 6 }}>🎯 +${Math.round(deal.potential / 1000)}K</span>}
          </span>
        </div>
        <div className="pv2-peek__row">
          <span className="pv2-peek__label">Nivel</span>
          <span className="pv2-peek__value" style={{ color: level.color, fontWeight: 600 }}>{level.label}</span>
        </div>
        {deal.nextAction && (
          <div className="pv2-peek__row">
            <span className="pv2-peek__label">Siguiente</span>
            <span className="pv2-peek__value">{deal.nextAction.text}</span>
          </div>
        )}
        {deal.lastMessage && (
          <div>
            <div className="pv2-peek__label" style={{ marginBottom: 5 }}>Última comunicación</div>
            <div className="pv2-peek__last">
              <MessageCircle size={11} style={{ marginRight: 5, verticalAlign: -1 }} />
              {deal.lastMessage}
            </div>
          </div>
        )}
      </div>

      <footer className="pv2-peek__footer">
        <span className="pv2-kbd">↑</span><span className="pv2-kbd">↓</span> navegar
        <span style={{ marginLeft: 'auto' }}><span className="pv2-kbd">Esc</span> cerrar</span>
      </footer>
    </aside>
  )
}
