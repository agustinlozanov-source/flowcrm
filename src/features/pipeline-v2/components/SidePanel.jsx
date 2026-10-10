import { useState } from 'react'
import clsx from 'clsx'
import {
  ChevronLeft, ChevronRight, Maximize2, X, MessageCircle,
  Phone, Mail, Calendar, Sparkles, CheckCircle2,
} from 'lucide-react'
import OwnerAvatar from './OwnerAvatar'

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'notas', label: 'Notas' },
  { id: 'archivos', label: 'Archivos' },
]

const ACTIONS = [
  { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { id: 'call', label: 'Llamar', Icon: Phone },
  { id: 'email', label: 'Email', Icon: Mail },
  { id: 'calendar', label: 'Agendar', Icon: Calendar },
]

/**
 * Panel lateral del deal. Es el destino de un click en tarjeta: nunca se
 * navega a página completa desde ahí, para eso está el botón de expandir.
 *
 * `peek` lo angosta a 320 px y deja solo lectura — es la vista rápida que se
 * abre con Space sobre una tarjeta.
 */
export default function SidePanel({
  deal,
  open = false,
  peek = false,
  onClose,
  onPrev,
  onNext,
  onOpenFull,
  onAction,
  onExecuteAi,
}) {
  const [tab, setTab] = useState('resumen')
  if (!deal) return null

  const { score, scoreTone = 'hot' } = deal

  return (
    <>
      <div
        className={clsx('pv2-overlay', open && 'pv2-overlay--visible')}
        onClick={onClose}
      />
      <aside className={clsx('pv2-panel', open && 'pv2-panel--open', peek && 'pv2-panel--peek')}>
        <header className="pv2-panel__header">
          <div className="pv2-panel__header-top">
            <span className="pv2-stage-chip">
              <span className="pv2-stage-chip__dot" style={{ background: deal.stageColor || 'var(--stage-4)' }} />
              {deal.stageName}
            </span>
            <div className="pv2-panel__nav">
              {!peek && (
                <>
                  <button className="pv2-icon-btn" onClick={onPrev} title="Anterior"><ChevronLeft size={13} /></button>
                  <button className="pv2-icon-btn" onClick={onNext} title="Siguiente"><ChevronRight size={13} /></button>
                  <button className="pv2-icon-btn" onClick={onOpenFull} title="Abrir completo"><Maximize2 size={13} /></button>
                </>
              )}
              <button className="pv2-icon-btn" onClick={onClose} title="Cerrar"><X size={13} /></button>
            </div>
          </div>

          <h2 className="pv2-panel__title">{deal.name}</h2>
          <div className="pv2-panel__subtitle">
            {[deal.service, deal.channel, deal.createdLabel].filter(Boolean).map((part, i) => (
              <span key={part} style={{ display: 'inline-flex', gap: 8 }}>
                {i > 0 && <span style={{ color: 'var(--text-muted)' }}>·</span>}
                {part}
              </span>
            ))}
          </div>

          <div className="pv2-panel__meta">
            <div className="pv2-panel__meta-item">
              <span className="pv2-panel__meta-label">Monto</span>
              <span className="pv2-panel__meta-value">
                ${Number(deal.amount).toLocaleString('es-MX')}
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}> {deal.currency || 'MXN'}</span>
              </span>
            </div>
            <div className="pv2-panel__meta-item">
              <span className="pv2-panel__meta-label">Asignado a</span>
              <span className="pv2-panel__meta-value" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <OwnerAvatar name={deal.owner?.name} bot={deal.owner?.bot} size={20} />
                {deal.owner?.name}
              </span>
            </div>
            {deal.nextActionLabel && (
              <div className="pv2-panel__meta-item">
                <span className="pv2-panel__meta-label">Próxima acción</span>
                <span className="pv2-pill" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
                  {deal.nextActionLabel}
                </span>
              </div>
            )}
          </div>
        </header>

        {!peek && (
          <div className="pv2-panel__actions">
            {ACTIONS.map(({ id, label, Icon }) => (
              <button key={id} className={`pv2-action pv2-action--${id}`} onClick={() => onAction?.(id)}>
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        )}

        {!peek && (
          <nav className="pv2-panel__tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                className={clsx('pv2-tab', tab === t.id && 'pv2-tab--active')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {deal.counts?.[t.id] != null && <span className="pv2-tab__count">{deal.counts[t.id]}</span>}
              </button>
            ))}
          </nav>
        )}

        <div className="pv2-panel__body">
          {deal.aiInsight && (
            <div className="pv2-ai">
              <div className="pv2-ai__header">
                <span className="pv2-ai__icon"><Sparkles size={11} /></span>
                <span className="pv2-ai__title">Siguiente mejor acción</span>
              </div>
              <p className="pv2-ai__text" dangerouslySetInnerHTML={{ __html: deal.aiInsight }} />
              {!peek && (
                <button className="pv2-ai__cta" onClick={onExecuteAi}>
                  <CheckCircle2 size={12} /> Ejecutar acción
                </button>
              )}
            </div>
          )}

          {deal.scoreFactors && (
            <div className="pv2-score-explain">
              <div className="pv2-score-explain__header">
                <span className="pv2-score-explain__title">Score</span>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="pv2-score-explain__number" style={{ color: `var(--${scoreTone === 'cold' ? 'text-secondary' : scoreTone === 'good' ? 'green' : scoreTone === 'warm' ? 'amber' : 'red'})` }}>
                    {score}
                  </span>
                  <span className="pv2-score-explain__max">/ 100</span>
                  {deal.scoreDelta && <span className="pv2-score-explain__trend">↑ +{deal.scoreDelta} hoy</span>}
                </span>
              </div>
              <div className="pv2-factors">
                {deal.scoreFactors.map(f => (
                  <div key={f.text} className="pv2-factor">
                    <span className={clsx('pv2-factor__sign', f.value >= 0 ? 'pv2-factor__sign--pos' : 'pv2-factor__sign--neg')}>
                      {f.value >= 0 ? '+' : '−'}
                    </span>
                    <span className="pv2-factor__text">{f.text}</span>
                    <span className={clsx('pv2-factor__value', f.value >= 0 ? 'pv2-factor__value--pos' : 'pv2-factor__value--neg')}>
                      {f.value >= 0 ? '+' : '−'}{Math.abs(f.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!peek && deal.fields && (
            <section className="pv2-section">
              <h4 className="pv2-section__title">
                Información del deal
                <button className="pv2-section__action">Editar</button>
              </h4>
              {deal.fields.map(f => (
                <div key={f.label} className="pv2-field">
                  <span className="pv2-field__label">{f.label}</span>
                  <span className="pv2-field__value">
                    {f.pill
                      ? <span className="pv2-pill" style={{ background: `var(--${f.pill}-bg)`, color: `var(--${f.pill})` }}>{f.value}</span>
                      : f.value}
                  </span>
                </div>
              ))}
            </section>
          )}

          {!peek && deal.timeline && (
            <section className="pv2-section">
              <h4 className="pv2-section__title">
                Últimas interacciones
                <button className="pv2-section__action">Ver timeline completo</button>
              </h4>
              <div className="pv2-timeline">
                {deal.timeline.map((item, i) => (
                  <article key={i} className={clsx('pv2-timeline__item', `pv2-timeline__item--${item.type}`)}>
                    <div className="pv2-timeline__header">
                      <span className="pv2-timeline__channel" style={item.color ? { color: `var(--${item.color})` } : undefined}>
                        {item.channel}
                      </span>
                      <span className="pv2-timeline__time">{item.time}</span>
                    </div>
                    <div className="pv2-timeline__body" dangerouslySetInnerHTML={{ __html: item.body }} />
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        {!peek && (
          <footer className="pv2-panel__footer">
            <button className="pv2-btn" style={{ flex: 1 }} onClick={onOpenFull}>
              <Maximize2 size={14} /> Abrir deal completo
            </button>
            <button className="pv2-btn pv2-btn--primary" style={{ flex: 1 }} onClick={() => onAction?.('calendar')}>
              Agendar cita
            </button>
          </footer>
        )}
      </aside>
    </>
  )
}
