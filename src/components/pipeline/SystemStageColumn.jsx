import LeadCard from './LeadCard'
import { Lock, DollarSign } from 'lucide-react'
import { fmt } from '@/hooks/usePipeline'
import clsx from 'clsx'

export default function SystemStageColumn({
  systemStage, leads, onLeadClick, onAssignProduct, handoffBoundDays
}) {
  const openLeads = leads.filter(l => l.systemStage !== 'closed')
  const closedLeads = leads.filter(l => l.systemStage === 'closed')

  const totalOpen = openLeads.reduce((s, l) => s + (l.value || 0), 0)
  const totalClosed = closedLeads.reduce((s, l) => s + (l.closedProduct?.price || l.value || 0), 0)

  // Payment date alerts for secure_opportunity
  const overdueLeads = systemStage.id === 'secure_opportunity'
    ? leads.filter(l => {
        if (!l.paymentDate) return false
        return new Date(l.paymentDate) < new Date()
      })
    : []

  return (
    <div className="flex flex-col w-[272px] min-w-[272px]">

      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: systemStage.color }} />
        <span className="font-display font-bold text-[13px] text-primary flex-1 truncate">
          {systemStage.name}
        </span>
        <Lock size={10} className="text-tertiary flex-shrink-0" />
        <span
          className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${systemStage.color}15`, color: systemStage.color }}
        >
          {leads.length}
        </span>
      </div>

      {/* Value row */}
      {(totalOpen > 0 || totalClosed > 0) && (
        <div className="flex items-center gap-2 px-1 mb-2.5 flex-wrap">
          {totalOpen > 0 && (
            <span className="text-[10px] font-semibold text-tertiary">
              {fmt(totalOpen)} en juego
            </span>
          )}
          {totalClosed > 0 && (
            <span className="text-[10px] font-semibold text-green-600 flex items-center gap-0.5">
              <DollarSign size={9} />{fmt(totalClosed)} cerrado
            </span>
          )}
        </div>
      )}

      {/* Overdue warning */}
      {overdueLeads.length > 0 && (
        <div className="px-1 mb-2">
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[8px] bg-red-50 border border-red-200 text-red-600 text-[10px] font-semibold">
            ⚠ {overdueLeads.length} pago{overdueLeads.length !== 1 ? 's' : ''} vencido{overdueLeads.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Column body — not droppable (system stages don't accept drag) */}
      <div
        className={clsx(
          'flex-1 flex flex-col gap-2 rounded-[12px] p-2 min-h-[120px]',
          'bg-black/[0.02]'
        )}
        style={{ border: `2px solid ${systemStage.color}20` }}
      >
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-full py-8">
            <p className="text-[11px] text-tertiary text-center">Sin leads en esta etapa</p>
          </div>
        )}

        {leads.map(lead => (
          <div key={lead.id} className="relative">
            <LeadCard
              lead={lead}
              stageColor={systemStage.color}
              onClick={() => onLeadClick(lead)}
              onAssignProduct={onAssignProduct}
              handoffBoundDays={systemStage.id === 'handoff' ? handoffBoundDays : null}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
