import clsx from 'clsx'
import { Clock, AlertTriangle, Calendar, Phone, CheckCircle2, Sparkles, MessageCircle } from 'lucide-react'
import ScoreChip from './ScoreChip'
import OwnerAvatar from './OwnerAvatar'

const NEXT_ICONS = { clock: Clock, alert: AlertTriangle, calendar: Calendar, call: Phone, check: CheckCircle2 }

/**
 * Tarjeta del deal. Tres densidades: compact (solo identidad y score),
 * comfortable (la default) y spacious.
 *
 * Dos destinos de click a propósito, como pide el briefing: la tarjeta abre el
 * side panel y el NOMBRE abre la página completa. Por eso el nombre es un
 * botón propio que detiene la propagación.
 */
export default function PipelineCard({
  deal,
  density = 'comfortable',
  selected = false,
  onOpen,
  onOpenFull,
  onWhatsApp,
  onCall,
}) {
  const {
    name, sub, amount, currency = 'MXN', score, scoreTrend,
    owner, nextAction, tags = [], ageLabel, aiBadge, rotting,
    maturity, potential,
  } = deal

  const compact = density === 'compact'
  const NextIcon = NEXT_ICONS[nextAction?.icon] || Clock

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen?.() }}
      className={clsx(
        'pv2-card',
        maturity && `pv2-card--${maturity}`,
        density !== 'comfortable' && `pv2-card--${density}`,
        selected && 'pv2-card--selected',
        rotting && 'pv2-card--rotting',
      )}
    >
      <div className="pv2-card__row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            className="pv2-card__title"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}
            onClick={e => { e.stopPropagation(); onOpenFull?.() }}
            title="Abrir deal completo"
          >
            {name}
          </button>
          {sub && <div className="pv2-card__sub">{sub}</div>}
        </div>
        <ScoreChip score={score} trend={scoreTrend} />
      </div>

      {!compact && (
        <>
          <div className="pv2-card__amount">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
              <span className="pv2-card__amount-value">${Number(amount).toLocaleString('es-MX')}</span>
              <span className="pv2-card__currency">{currency}</span>
              {potential > 0 && (
                <span className="pv2-potential" title="Oportunidades potenciales vinculadas">
                  🎯 +${Math.round(potential / 1000)}K
                </span>
              )}
            </div>
            {owner && <OwnerAvatar name={owner.name} bot={owner.bot} />}
          </div>

          {nextAction && (
            <div className={clsx('pv2-next', nextAction.tone && `pv2-next--${nextAction.tone}`)}>
              <NextIcon size={12} style={{ flexShrink: 0 }} />
              <span className="pv2-next__text">{nextAction.text}</span>
              {(onWhatsApp || onCall) && (
                <span className="pv2-quick">
                  {onWhatsApp && (
                    <button
                      className="pv2-quick__btn pv2-quick__btn--whatsapp"
                      onClick={e => { e.stopPropagation(); onWhatsApp() }}
                      title="Responder por WhatsApp"
                    >
                      <MessageCircle size={12} />
                    </button>
                  )}
                  {onCall && (
                    <button
                      className="pv2-quick__btn"
                      onClick={e => { e.stopPropagation(); onCall() }}
                      title="Llamar"
                    >
                      <Phone size={12} />
                    </button>
                  )}
                </span>
              )}
            </div>
          )}

          {(tags.length > 0 || ageLabel || aiBadge) && (
            <div className="pv2-card__footer">
              {aiBadge ? (
                <span className="pv2-ai-badge"><Sparkles size={9} /> {aiBadge}</span>
              ) : (
                <div className="pv2-tags">
                  {tags.map(t => (
                    <span key={t.label} className="pv2-tag pv2-tag--muted">{t.label}</span>
                  ))}
                </div>
              )}
              {ageLabel && (
                <div className="pv2-card__meta">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{ageLabel}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
