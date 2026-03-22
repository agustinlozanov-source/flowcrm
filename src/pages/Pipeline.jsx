import { useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { usePipeline } from '@/hooks/usePipeline'
import { useProducts } from '@/hooks/useProducts'
import KanbanColumn from '@/components/pipeline/KanbanColumn'
import LeadCard from '@/components/pipeline/LeadCard'
import NewLeadModal from '@/components/pipeline/NewLeadModal'
import LeadDrawer from '@/components/pipeline/LeadDrawer'
import { Search, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

const SOURCES = [
  { value: 'all', label: 'Todas las fuentes' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'web', label: 'Web' },
  { value: 'manual', label: 'Manual' },
]

export default function Pipeline() {
  const { stages, leads, leadsByStage, loading, moveLead, createLead } = usePipeline()
  const { products } = useProducts()
  const [activeId, setActiveId] = useState(null)
  const [showNewLead, setShowNewLead] = useState(false)
  const [defaultStageId, setDefaultStageId] = useState(null)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null
  const activeStage = activeLead ? stages.find(s => s.id === activeLead.stageId) : null

  const filteredLeadsByStage = stages.reduce((acc, stage) => {
    let stageLeads = leadsByStage[stage.id] || []
    if (sourceFilter !== 'all') stageLeads = stageLeads.filter(l => l.source === sourceFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      stageLeads = stageLeads.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q)
      )
    }
    acc[stage.id] = stageLeads
    return acc
  }, {})

  const handleDragStart = ({ active }) => setActiveId(active.id)

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const lead = leads.find(l => l.id === active.id)
    if (!lead) return
    let targetStageId = over.id
    const overLead = leads.find(l => l.id === over.id)
    if (overLead) targetStageId = overLead.stageId
    if (lead.stageId !== targetStageId) {
      try {
        await moveLead(lead.id, targetStageId)
      } catch {
        toast.error('Error al mover el lead')
      }
    }
  }, [leads, moveLead])

  const handleAddLead = (stageId) => {
    setDefaultStageId(stageId)
    setShowNewLead(true)
  }

  const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0)
  const formatBig = (v) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
    return `$${v}`
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-secondary">Cargando pipeline...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-[15px] tracking-tight">Pipeline</h1>

        <div className="flex items-center gap-2 ml-2">
          <span className="text-[11px] font-semibold bg-surface-2 border border-black/[0.08] px-2.5 py-1 rounded-full text-secondary">
            {leads.length} leads
          </span>
          {totalValue > 0 && (
            <span className="text-[11px] font-semibold bg-blue-50 text-accent-blue px-2.5 py-1 rounded-full">
              {formatBig(totalValue)} en pipeline
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 ml-2 w-52">
          <Search size={14} strokeWidth={2.5} className="text-tertiary flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar lead..."
            className="bg-transparent text-[12.5px] text-primary placeholder-tertiary flex-1 outline-none"
          />
        </div>

        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer"
        >
          {SOURCES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="ml-auto">
          <button
            onClick={() => setShowNewLead(true)}
            className="btn-primary text-[12.5px] py-1.5 px-3.5 flex items-center gap-1.5"
          >
            <Plus size={14} strokeWidth={3} color="white" />
            Nuevo lead
          </button>
        </div>
      </div>

      {/* KANBAN */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full p-5 w-max">
            {stages.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={filteredLeadsByStage[stage.id] || []}
                onLeadClick={(lead) => setSelectedLead(lead)}
                onAddLead={handleAddLead}
              />
            ))}

            <div className="w-[240px] min-w-[240px] flex items-start pt-1">
              <button className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-dashed border-black/[0.14] text-[12.5px] text-tertiary hover:text-secondary hover:border-black/25 transition-all duration-150 w-full">
                <Plus size={14} strokeWidth={2.5} />
                Nueva etapa
              </button>
            </div>
          </div>

          <DragOverlay>
            {activeLead && activeStage && (
              <div className="rotate-1 scale-105">
                <LeadCard lead={activeLead} stageColor={activeStage.color} onClick={() => { }} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {showNewLead && (
        <NewLeadModal
          stages={stages}
          defaultStageId={defaultStageId}
          products={products}
          onClose={() => { setShowNewLead(false); setDefaultStageId(null) }}
          onCreate={async (data) => {
            await createLead({ ...data, stageId: data.stageId || defaultStageId })
          }}
        />
      )}

      {selectedLead && (
        <LeadDrawer
          lead={leads.find(l => l.id === selectedLead.id) || selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  )
}
