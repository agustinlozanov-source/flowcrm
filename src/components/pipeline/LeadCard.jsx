import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'
import { Package, Clock, AlertTriangle, Star } from 'lucide-react'
import { SYSTEM_STAGES } from '@/hooks/usePipeline'

const SOURCE_CONFIG = {
  meta_ads:  { icon: '🔵', label: 'Meta Ads' },
  instagram: { icon: '📸', label: 'Instagram' },
  whatsapp:  { icon: '💬', label: 'WhatsApp' },
  linkedin:  { icon: '💼', label: 'LinkedIn' },
  web:       { icon: '🌐', label: 'Web' },
  referral:  { icon: '⭐', label: 'Referido' },
  manual:    { icon: '✏️', label: 'Manual' },
}

const scoreColor = (score) => {
  if (score >= 80) return { bg: 'rgba(0,200,83,0.1)', text: '#00a844' }
  if (score >= 50) return { bg: 'rgba(245,158,11,0.1)', text: '#d97706' }
  return { bg: 'rgba(0,0,0,0.05)', text: '#6e6e73' }
}

const formatValue = (v) => {
  if (!v) return null
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
  return `$${v}`
}

// Days elapsed since a Firestore timestamp
const daysSince = (ts) => {
  if (!ts?.toDate) return null
  const diff = Date.now() - ts.toDate().getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export default function LeadCard({ lead, stageColor, onClick, onAssignProduct, handoffBoundDays }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: 'lead', lead },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const source = SOURCE_CONFIG[lead.source] || SOURCE_CONFIG.manual
  const sc = scoreColor(lead.score || 0)
  const initials = lead.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const isClosed = lead.systemStage === 'closed'
  const isHandoff = lead.systemStage === 'handoff'
  const isSecure = lead.systemStage === 'secure_opportunity'

  // Handoff Bound countdown
  const handoffDaysElapsed = isHandoff ? daysSince(lead.handoffAt || lead.systemStageAt) : null
  const boundDays = handoffBoundDays || 3
  const boundDaysLeft = isHandoff ? boundDays - (handoffDaysElapsed || 0) : null
  const isAtRisk = boundDaysLeft !== null && boundDaysLeft <= 1
  const isExpired = boundDaysLeft !== null && boundDaysLeft < 0

  // Payment date countdown for secure opportunity
  const paymentDate = isSecure && lead.paymentDate ? new Date(lead.paymentDate) : null
  const paymentDaysLeft = paymentDate ? Math.ceil((paymentDate - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const paymentOverdue = paymentDaysLeft !== null && paymentDaysLeft < 0

  const cardColor = lead.systemStage
    ? SYSTEM_STAGES[lead.systemStage]?.color || stageColor
    : stageColor

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={clsx(
        'bg-surface rounded-[10px] border cursor-grab active:cursor-grabbing relative overflow-hidden',
        'hover:shadow-card transition-all duration-150 select-none',
        isDragging && 'shadow-card-md ring-2 ring-black/10',
        isClosed ? 'border-green-200' : isExpired ? 'border-red-200' : isAtRisk ? 'border-amber-200' : 'border-black/[0.08]',
        isClosed && 'opacity-80',
      )}
    >
      {/* Color top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[10px]"
        style={{ background: cardColor }}
      />

      <div className="p-3 pt-4">

        {/* Handoff Bound warning */}
        {isHandoff && handoffBoundDays && (
          <div className={clsx(
            'flex items-center gap-1.5 px-2 py-1 rounded-[6px] mb-2 text-[10px] font-semibold',
            isExpired ? 'bg-red-50 text-red-600' : isAtRisk ? 'bg-amber-50 text-amber-600' : 'bg-surface-2 text-tertiary'
          )}>
            <Clock size={10} />
            {isExpired
              ? `Expirado — ${Math.abs(boundDaysLeft)}d sin atender`
              : boundDaysLeft === 0
                ? 'Vence hoy'
                : `${boundDaysLeft}d restante${boundDaysLeft !== 1 ? 's' : ''}`
            }
          </div>
        )}

        {/* Handoff Bound reasigned badge */}
        {lead.handoffBoundFrom && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] mb-2 bg-purple-50 text-purple-600 text-[10px] font-semibold">
            <AlertTriangle size={9} />
            Reasignado por Handoff Bound
          </div>
        )}

        {/* Payment date for secure opportunity */}
        {isSecure && paymentDate && (
          <div className={clsx(
            'flex items-center gap-1.5 px-2 py-1 rounded-[6px] mb-2 text-[10px] font-semibold',
            paymentOverdue ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
          )}>
            <Clock size={10} />
            {paymentOverdue
              ? `Pago vencido — ${Math.abs(paymentDaysLeft)}d`
              : paymentDaysLeft === 0
                ? 'Pago hoy'
                : `Pago en ${paymentDaysLeft}d`
            }
          </div>
        )}

        {/* Header row */}
        <div className="flex items-start gap-2.5 mb-2.5">
          <div
            className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
            style={{ background: cardColor }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[13px] text-primary leading-tight truncate font-display flex items-center gap-1.5">
              {lead.name}
              {lead.profileB && (
                <Star size={10} className="text-blue-500 flex-shrink-0" fill="currentColor" />
              )}
            </div>
            {lead.company && (
              <div className="text-[11px] text-tertiary truncate">{lead.company}</div>
            )}
          </div>
        </div>

        {/* Source chip */}
        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold"
            style={{ background: 'rgba(0,0,0,0.04)', color: '#6e6e73' }}
          >
            <span>{source.icon}</span>
            {source.label}
          </span>

          {/* System stage badge */}
          {lead.systemStage && SYSTEM_STAGES[lead.systemStage] && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] text-[10px] font-bold"
              style={{
                background: SYSTEM_STAGES[lead.systemStage].color + '18',
                color: SYSTEM_STAGES[lead.systemStage].color,
              }}
            >
              {SYSTEM_STAGES[lead.systemStage].name}
            </span>
          )}

          {/* Closed badge */}
          {isClosed && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] text-[10px] font-bold bg-green-50 text-green-600">
              ✓ Cerrado
            </span>
          )}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Value */}
            {(lead.closedProduct?.price || lead.value) ? (
              <span className="font-display font-bold text-[12.5px] text-primary">
                {isClosed
                  ? formatValue(lead.closedProduct?.price)
                  : formatValue(lead.value)
                }
              </span>
            ) : (
              /* No product button */
              !isClosed && onAssignProduct && (
                <button
                  onClick={e => { e.stopPropagation(); onAssignProduct(lead) }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] border border-dashed border-black/[0.14] text-[10px] text-tertiary hover:border-primary/40 hover:text-primary transition-all"
                >
                  <Package size={10} /> + Producto
                </button>
              )
            )}
          </div>

          {lead.score > 0 && (
            <span
              className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-[5px]"
              style={{ background: sc.bg, color: sc.text }}
            >
              {lead.score}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
