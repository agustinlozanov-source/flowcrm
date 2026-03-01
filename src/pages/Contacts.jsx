import { useState, useMemo } from 'react'
import { usePipeline } from '@/hooks/usePipeline'
import LeadDrawer from '@/components/pipeline/LeadDrawer'
import clsx from 'clsx'
import { Search, Users, MousePointerClick, Instagram, MessageCircle, Linkedin, Globe, Star, PenTool } from 'lucide-react'

const SOURCE_CONFIG = {
  meta_ads: { icon: <MousePointerClick size={14} className="text-blue-500" />, label: 'Meta Ads' },
  instagram: { icon: <Instagram size={14} className="text-pink-500" />, label: 'Instagram' },
  whatsapp: { icon: <MessageCircle size={14} className="text-green-500" />, label: 'WhatsApp' },
  linkedin: { icon: <Linkedin size={14} className="text-blue-700" />, label: 'LinkedIn' },
  web: { icon: <Globe size={14} className="text-indigo-500" />, label: 'Web' },
  referral: { icon: <Star size={14} className="text-yellow-500" />, label: 'Referido' },
  manual: { icon: <PenTool size={14} className="text-gray-500" />, label: 'Manual' },
}

const scoreColor = (score) => {
  if (score >= 80) return 'text-green-600 bg-green-50'
  if (score >= 50) return 'text-amber-600 bg-amber-50'
  return 'text-secondary bg-surface-2'
}

const formatValue = (v) => {
  if (!v) return '—'
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
  return `$${v}`
}

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Más recientes' },
  { value: 'name', label: 'Nombre A-Z' },
  { value: 'score', label: 'Mayor score' },
  { value: 'value', label: 'Mayor valor' },
]

export default function Contacts() {
  const { stages, leads, loading } = usePipeline()
  const [selectedLead, setSelectedLead] = useState(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')

  const filtered = useMemo(() => {
    let result = [...leads]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q)
      )
    }

    if (stageFilter !== 'all') {
      result = result.filter(l => l.stageId === stageFilter)
    }

    if (sourceFilter !== 'all') {
      result = result.filter(l => l.source === sourceFilter)
    }

    result.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'score') return (b.score || 0) - (a.score || 0)
      if (sortBy === 'value') return (b.value || 0) - (a.value || 0)
      // createdAt default
      const at = a.createdAt?.toDate?.() || new Date(0)
      const bt = b.createdAt?.toDate?.() || new Date(0)
      return bt - at
    })

    return result
  }, [leads, search, stageFilter, sourceFilter, sortBy])

  const totalValue = filtered.reduce((sum, l) => sum + (l.value || 0), 0)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-[15px] tracking-tight">Contactos</h1>

        <div className="flex items-center gap-2 ml-2">
          <span className="text-[11px] font-semibold bg-surface-2 border border-black/[0.08] px-2.5 py-1 rounded-full text-secondary">
            {filtered.length} contactos
          </span>
          {totalValue > 0 && (
            <span className="text-[11px] font-semibold bg-blue-50 text-accent-blue px-2.5 py-1 rounded-full">
              {formatValue(totalValue)} total
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2 bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 w-52">
            <Search size={14} strokeWidth={2.5} className="text-tertiary flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="bg-transparent text-[12.5px] text-primary placeholder-tertiary flex-1 outline-none"
            />
          </div>

          {/* Stage filter */}
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer"
          >
            <option value="all">Todas las etapas</option>
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Source filter */}
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer"
          >
            <option value="all">Todas las fuentes</option>
            {Object.entries(SOURCE_CONFIG).map(([v, c]) => (
              <option key={v} value={v}>{c.icon} {c.label}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-16 h-16 rounded-2xl bg-black/[0.02] border border-black/[0.05] flex items-center justify-center text-tertiary mb-2">
              <Users size={32} strokeWidth={1.5} />
            </div>
            <p className="font-display font-bold text-lg text-primary">Sin contactos</p>
            <p className="text-sm text-secondary">
              {search || stageFilter !== 'all' || sourceFilter !== 'all'
                ? 'No hay resultados para estos filtros'
                : 'Agrega leads desde el Pipeline'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-surface border-b border-black/[0.08] z-10">
              <tr>
                {['Contacto', 'Etapa', 'Fuente', 'Score', 'Valor', 'Teléfono', 'Email', 'Fecha'].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-tertiary px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const stage = stages.find(s => s.id === lead.stageId)
                const source = SOURCE_CONFIG[lead.source] || SOURCE_CONFIG.manual
                const initials = lead.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
                const date = lead.createdAt?.toDate
                  ? lead.createdAt.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
                  : '—'

                return (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="border-b border-black/[0.04] hover:bg-surface-2 cursor-pointer transition-colors"
                  >
                    {/* Contacto */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                          style={{ background: stage?.color || '#0a0a0a' }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-[13px] text-primary leading-tight">{lead.name}</div>
                          {lead.company && <div className="text-[11px] text-tertiary">{lead.company}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Etapa */}
                    <td className="px-4 py-3">
                      {stage ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold"
                          style={{ background: `${stage.color}15`, color: stage.color }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }} />
                          {stage.name}
                        </span>
                      ) : '—'}
                    </td>

                    {/* Fuente */}
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-secondary">
                        {source.icon} {source.label}
                      </span>
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3">
                      {lead.score > 0 ? (
                        <span className={clsx('text-[11px] font-bold px-2 py-1 rounded-lg', scoreColor(lead.score))}>
                          {lead.score}
                        </span>
                      ) : <span className="text-tertiary text-xs">—</span>}
                    </td>

                    {/* Valor */}
                    <td className="px-4 py-3">
                      <span className="font-display font-semibold text-[13px] text-primary">
                        {formatValue(lead.value)}
                      </span>
                    </td>

                    {/* Teléfono */}
                    <td className="px-4 py-3 text-[12.5px] text-secondary">
                      {lead.phone || '—'}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-[12.5px] text-secondary max-w-[180px] truncate">
                      {lead.email || '—'}
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-3 text-[12px] text-tertiary whitespace-nowrap">
                      {date}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* LEAD DRAWER */}
      {selectedLead && (
        <LeadDrawer
          lead={leads.find(l => l.id === selectedLead.id) || selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  )
}
