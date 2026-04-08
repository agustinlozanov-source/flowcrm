import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import LeadCard from './LeadCard'
import clsx from 'clsx'
import { Plus } from 'lucide-react'
import { fmt } from '@/hooks/usePipeline'

export default function KanbanColumn({ stage, leads, onLeadClick, onAddLead, onAssignProduct }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  const openLeads = leads.filter(l => !l.systemStage && !l.discarded)
  const totalValue = openLeads.reduce((sum, l) => sum + (l.value || 0), 0)
  const closedValue = leads
    .filter(l => l.systemStage === 'closed')
    .reduce((sum, l) => sum + (l.closedProduct?.price || l.value || 0), 0)

  return (
    <div className="flex flex-col w-[272px] min-w-[272px]">

      {/* Column header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
        <span className="font-display font-bold text-[13px] text-primary flex-1 truncate">
          {stage.name}
        </span>
        <span
          className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${stage.color}15`, color: stage.color }}
        >
          {leads.length}
        </span>
      </div>

      {/* Value row */}
      {(totalValue > 0 || closedValue > 0) && (
        <div className="flex items-center gap-2 px-1 mb-2.5">
          {totalValue > 0 && (
            <span className="text-[10px] font-semibold text-tertiary">
              {fmt(totalValue)} potencial
            </span>
          )}
          {totalValue > 0 && closedValue > 0 && (
            <span className="text-[10px] text-tertiary opacity-40">·</span>
          )}
          {closedValue > 0 && (
            <span className="text-[10px] font-semibold text-green-600">
              {fmt(closedValue)} cerrado
            </span>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 flex flex-col gap-2 rounded-[12px] p-2 min-h-[120px] transition-colors duration-150',
          isOver ? 'bg-black/[0.04]' : 'bg-black/[0.02]'
        )}
        style={{
          outline: isOver ? `2px dashed ${stage.color}60` : '2px dashed transparent',
        }}
      >
        <SortableContext
          items={leads.map(l => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map(lead => (
            <div key={lead.id} className="relative">
              <LeadCard
                lead={lead}
                stageColor={stage.color}
                onClick={() => onLeadClick(lead)}
                onAssignProduct={onAssignProduct}
              />
            </div>
          ))}
        </SortableContext>

        {/* Add lead button */}
        <button
          onClick={() => onAddLead(stage.id)}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-2 rounded-[8px] text-[12px] font-medium',
            'text-tertiary hover:text-secondary hover:bg-black/[0.04]',
            'transition-all duration-150 w-full mt-auto'
          )}
        >
          <Plus size={14} strokeWidth={2.5} />
          Agregar lead
        </button>
      </div>
    </div>
  )
}
