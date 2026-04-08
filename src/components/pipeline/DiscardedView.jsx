import { useState, useMemo } from 'react'
import { usePipeline, DISCARD_CATEGORIES } from '@/hooks/usePipeline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import LeadDrawer from '@/components/pipeline/LeadDrawer'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  X, Search, Archive, RotateCcw, AlertTriangle,
  Clock, Filter, ChevronDown
} from 'lucide-react'

const CATEGORY_COLORS = {
  timing:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  price:         { color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
  geography:     { color: '#14b8a6', bg: 'rgba(20,184,166,0.1)'  },
  no_interest:   { color: '#6e6e73', bg: 'rgba(110,110,115,0.1)' },
  no_answer:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)'  },
  competition:   { color: '#ec4899', bg: 'rgba(236,72,153,0.1)'  },
  no_qualify:    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)'  },
  handoff_bound: { color: '#0066ff', bg: 'rgba(0,102,255,0.1)'   },
  blacklist:     { color: '#ff3b30', bg: 'rgba(255,59,48,0.1)'   },
}

function CountdownBadge({ retakeDate }) {
  if (!retakeDate) return null
  const date = new Date(retakeDate)
  const today = new Date()
  const days = Math.ceil((date - today) / (1000 * 60 * 60 * 24))
  const isOverdue = days < 0
  const isToday = days === 0
  const isSoon = days <= 7 && days > 0

  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
      isOverdue ? 'bg-red-50 text-red-600' :
        isToday ? 'bg-amber-50 text-amber-600' :
          isSoon ? 'bg-blue-50 text-blue-600' :
            'bg-surface-2 text-secondary'
    )}>
      <Clock size={9} />
      {isOverdue ? `Retoma vencida — ${Math.abs(days)}d` :
        isToday ? 'Retomar hoy' :
          `Retomar en ${days}d`}
    </span>
  )
}

export default function DiscardedView({ onClose }) {
  const { discardedLeads, updateLead, allStages } = usePipeline()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedLead, setSelectedLead] = useState(null)
  const [reactivating, setReactivating] = useState(null)

  const filtered = useMemo(() => {
    let result = [...discardedLeads]
    if (categoryFilter !== 'all') {
      result = result.filter(l => l.discardCategory === categoryFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q)
      )
    }
    // Sort: retake date overdue first, then by retake date, then by discard date
    return result.sort((a, b) => {
      const aRetake = a.retakeDate ? new Date(a.retakeDate) : null
      const bRetake = b.retakeDate ? new Date(b.retakeDate) : null
      const today = new Date()
      if (aRetake && bRetake) return aRetake - bRetake
      if (aRetake) return -1
      if (bRetake) return 1
      const aDiscard = a.discardedAt?.toDate?.() || 0
      const bDiscard = b.discardedAt?.toDate?.() || 0
      return bDiscard - aDiscard
    })
  }, [discardedLeads, categoryFilter, search])

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts = {}
    discardedLeads.forEach(l => {
      counts[l.discardCategory] = (counts[l.discardCategory] || 0) + 1
    })
    return counts
  }, [discardedLeads])

  const handleReactivate = async (lead) => {
    const firstStage = allStages.find(s => s.pipelineId === lead.pipelineId)
    if (!firstStage) { toast.error('No se encontró etapa para reactivar'); return }
    setReactivating(lead.id)
    try {
      await updateLead(lead.id, {
        discarded: false,
        discardedAt: null,
        discardedBy: null,
        discardCategory: null,
        discardNotes: null,
        retakeDate: null,
        systemStage: null,
        stageId: firstStage.id,
      })
      toast.success(`${lead.name} reactivado en "${firstStage.name}"`)
    } catch { toast.error('Error al reactivar') }
    finally { setReactivating(null) }
  }

  const canRetake = (category) => {
    const cat = DISCARD_CATEGORIES.find(c => c.value === category)
    return cat?.canRetake !== false
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl bg-surface h-full flex flex-col shadow-[−8px_0_40px_rgba(0,0,0,0.12)] border-l border-black/[0.08]">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-black/[0.08] flex-shrink-0">
          <div className="w-8 h-8 rounded-[8px] bg-surface-2 flex items-center justify-center">
            <Archive size={15} className="text-secondary" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-[15px]">Leads descartados</h2>
            <p className="text-[11px] text-secondary mt-0.5">{discardedLeads.length} en archivo</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} />
          </button>
        </div>

        {/* Search + filter */}
        <div className="px-6 py-3 border-b border-black/[0.06] flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 flex-1">
            <Search size={13} className="text-tertiary flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar lead..." className="bg-transparent text-[12.5px] text-primary placeholder-tertiary flex-1 outline-none" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer">
            <option value="all">Todas las razones</option>
            {DISCARD_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>
                {c.label} {categoryCounts[c.value] ? `(${categoryCounts[c.value]})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Category summary pills */}
        <div className="px-6 py-3 border-b border-black/[0.06] flex flex-wrap gap-1.5 flex-shrink-0">
          {DISCARD_CATEGORIES.filter(c => categoryCounts[c.value]).map(c => {
            const cfg = CATEGORY_COLORS[c.value] || { color: '#6e6e73', bg: 'rgba(110,110,115,0.1)' }
            return (
              <button key={c.value} onClick={() => setCategoryFilter(prev => prev === c.value ? 'all' : c.value)}
                className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full transition-all',
                  categoryFilter === c.value ? 'ring-2' : ''
                )}
                style={{ background: cfg.bg, color: cfg.color, ringColor: cfg.color }}>
                {c.label} · {categoryCounts[c.value]}
              </button>
            )
          })}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <Archive size={32} className="text-tertiary" strokeWidth={1.5} />
              <p className="font-display font-bold text-base text-primary">Sin resultados</p>
              <p className="text-sm text-secondary">
                {categoryFilter !== 'all' ? 'Prueba con otra categoría' : 'No hay leads descartados'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {filtered.map(lead => {
                const cat = DISCARD_CATEGORIES.find(c => c.value === lead.discardCategory)
                const cfg = CATEGORY_COLORS[lead.discardCategory] || { color: '#6e6e73', bg: 'rgba(110,110,115,0.1)' }
                const discardDate = lead.discardedAt?.toDate?.()
                const isBlacklist = lead.discardCategory === 'blacklist'
                const isHandoffBound = lead.discardCategory === 'handoff_bound'

                return (
                  <div key={lead.id}
                    className="px-6 py-4 hover:bg-surface-2 transition-colors cursor-pointer"
                    onClick={() => setSelectedLead(lead)}>
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                        style={{ background: cfg.color }}>
                        {lead.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-display font-bold text-[13px] text-primary">{lead.name}</span>
                          {lead.company && <span className="text-[11px] text-tertiary">{lead.company}</span>}
                          {isBlacklist && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                              LISTA NEGRA
                            </span>
                          )}
                          {isHandoffBound && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">
                              HANDOFF BOUND
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            {cat?.label || lead.discardCategory}
                          </span>
                          {discardDate && (
                            <span className="text-[10px] text-tertiary">
                              {format(discardDate, "d 'de' MMM yyyy", { locale: es })}
                            </span>
                          )}
                          <CountdownBadge retakeDate={lead.retakeDate} />
                        </div>
                        {lead.discardNotes && (
                          <p className="text-[11.5px] text-secondary mt-1.5 line-clamp-1">{lead.discardNotes}</p>
                        )}
                        {isHandoffBound && lead.handoffBoundFrom && (
                          <p className="text-[10.5px] text-purple-500 mt-1">
                            Cayó de: {lead.handoffBoundFrom}
                          </p>
                        )}
                      </div>
                      {/* Reactivate button */}
                      {!isBlacklist && canRetake(lead.discardCategory) && (
                        <button
                          onClick={e => { e.stopPropagation(); handleReactivate(lead) }}
                          disabled={reactivating === lead.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-black/[0.1] text-[11px] font-semibold text-secondary hover:border-primary/40 hover:text-primary transition-all flex-shrink-0">
                          {reactivating === lead.id
                            ? <div className="w-3 h-3 border border-black/20 border-t-primary rounded-full animate-spin" />
                            : <><RotateCcw size={11} /> Reactivar</>}
                        </button>
                      )}
                      {isBlacklist && (
                        <span className="text-[10px] text-red-400 flex-shrink-0 flex items-center gap-1">
                          <AlertTriangle size={10} /> Permanente
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  )
}
