import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import LeadCard from './LeadCard'
import clsx from 'clsx'
import { Plus } from 'lucide-react'

const formatTotal = (leads) => {
  const total = leads.reduce((sum, l) => sum + (l.value || 0), 0)
  if (!total) return null
  if (total >= 1000000) return `$${(total / 1000000).toFixed(1)}M`
  if (total >= 1000) return `$${(total / 1000).toFixed(0)}K`
  return `$${total}`
}

export default function KanbanColumn({ stage, leads, onLeadClick, onAddLead }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className="flex flex-col w-[272px] min-w-[272px]">

      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
        <span className="font-display font-bold text-[13px] text-primary flex-1 truncate">
          {stage.name}
        </span>
        <span
          className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: `${stage.color}15`, color: stage.color }}
        >
          {leads.length}
        </span>
        {formatTotal(leads) && (
          <span className="text-[10.5px] font-semibold text-tertiary">
            {formatTotal(leads)}
          </span>
        )}
      </div>

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
