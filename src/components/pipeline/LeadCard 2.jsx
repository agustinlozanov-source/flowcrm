import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'

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

export default function LeadCard({ lead, stageColor, onClick }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={clsx(
        'bg-surface rounded-[10px] border border-black/[0.08] p-3 cursor-grab active:cursor-grabbing',
        'hover:border-black/[0.14] hover:shadow-card transition-all duration-150 select-none',
        isDragging && 'shadow-card-md ring-2 ring-black/10'
      )}
    >
      {/* Color top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[10px]"
        style={{ background: stageColor }}
      />

      {/* Header row */}
      <div className="flex items-start gap-2.5 mb-2.5 relative">
        <div
          className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
          style={{ background: stageColor }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] text-primary leading-tight truncate font-display">
            {lead.name}
          </div>
          {lead.company && (
            <div className="text-[11px] text-tertiary truncate">{lead.company}</div>
          )}
        </div>
      </div>

      {/* Source chip */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold"
          style={{ background: 'rgba(0,0,0,0.04)', color: '#6e6e73' }}
        >
          <span>{source.icon}</span>
          {source.label}
        </span>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2">
        {lead.value ? (
          <span className="font-display font-bold text-[12.5px] text-primary">
            {formatValue(lead.value)}
          </span>
        ) : (
          <span />
        )}

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
  )
}
