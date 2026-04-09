import { useState, useMemo, useRef } from 'react'
import { normalizePhone } from '@/lib/utils'
import { usePipeline, SYSTEM_STAGES, DISCARD_CATEGORIES } from '@/hooks/usePipeline'
import LeadDrawer from '@/components/pipeline/LeadDrawer'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  Search, Users, MousePointerClick, Instagram, MessageCircle,
  Linkedin, Globe, Star, PenTool, Archive, Filter,
  Upload, X, Check, Download
} from 'lucide-react'

const SOURCE_CONFIG = {
  meta_ads:  { icon: <MousePointerClick size={14} className="text-blue-500" />,  label: 'Meta Ads'  },
  instagram: { icon: <Instagram size={14} className="text-pink-500" />,          label: 'Instagram' },
  whatsapp:  { icon: <MessageCircle size={14} className="text-green-500" />,     label: 'WhatsApp'  },
  linkedin:  { icon: <Linkedin size={14} className="text-blue-700" />,           label: 'LinkedIn'  },
  web:       { icon: <Globe size={14} className="text-indigo-500" />,            label: 'Web'       },
  referral:  { icon: <Star size={14} className="text-yellow-500" />,             label: 'Referido'  },
  manual:    { icon: <PenTool size={14} className="text-gray-500" />,            label: 'Manual'    },
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
  { value: 'createdAt', label: 'Más recientes'  },
  { value: 'name',      label: 'Nombre A-Z'     },
  { value: 'score',     label: 'Mayor score'    },
  { value: 'value',     label: 'Mayor valor'    },
]

const VIEW_OPTIONS = [
  { value: 'active',    label: 'Activos'     },
  { value: 'system',    label: 'En proceso'  },
  { value: 'discarded', label: 'Descartados' },
]

// ── CSV IMPORT ────────────────────────────────────────────────────
const LEAD_CSV_HEADERS = ['name', 'company', 'email', 'phone', 'source', 'value', 'notes']

function downloadLeadTemplate() {
  const rows = [
    LEAD_CSV_HEADERS.join(','),
    'Juan Pérez,Empresa SA,juan@empresa.com,5512345678,meta_ads,5000,Lead interesado en plan pro',
    'María García,Startup MX,maria@startup.com,5598765432,instagram,2500,Contacto por DM',
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'plantilla_contactos.csv'; a.click()
  URL.revokeObjectURL(url)
}

function parseLeadCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const fields = line.split(',').map(f => f.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = fields[i] || '' })
    return obj
  }).filter(r => r.name)
}

function LeadImportModal({ onClose, onImport }) {
  const [step, setStep] = useState('upload')
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseLeadCSV(ev.target.result)
      const errs = []
      parsed.forEach((row, i) => {
        if (!row.name) errs.push(`Fila ${i + 2}: falta el nombre`)
      })
      setRows(parsed)
      setErrors(errs)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    setStep('importing')
    try {
      await onImport(rows)
      toast.success(`${rows.length} contactos importados`)
      onClose()
    } catch { toast.error('Error al importar') }
    finally { setImporting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-lg border border-black/[0.08]">

        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06]">
          <div>
            <h2 className="font-display font-bold text-lg tracking-tight">Importar contactos</h2>
            <p className="text-xs text-secondary mt-0.5">Sube un CSV con tus leads</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <button onClick={downloadLeadTemplate}
                className="flex items-center gap-2 text-[12.5px] text-secondary hover:text-primary transition-colors">
                <Download size={13} /> Descargar plantilla CSV
              </button>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-black/[0.12] rounded-[12px] p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all">
                <Upload size={24} className="text-tertiary mx-auto mb-2" />
                <p className="text-[13px] font-semibold text-primary mb-1">Selecciona un archivo CSV</p>
                <p className="text-xs text-secondary">O arrastra y suéltalo aquí</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col gap-4">
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-[10px] p-3">
                  {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
              <p className="text-[13px] font-semibold text-primary">
                {rows.length} contactos encontrados{errors.length > 0 ? ` · ${errors.length} advertencias` : ''}
              </p>
              <div className="max-h-52 overflow-y-auto border border-black/[0.08] rounded-[10px] divide-y divide-black/[0.05]">
                {rows.map((row, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="font-semibold text-[13px] text-primary">{row.name}</span>
                    {row.company && <span className="text-[11px] text-secondary">{row.company}</span>}
                    {row.email && <span className="text-[11px] text-tertiary ml-auto">{row.email}</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('upload')} className="btn-secondary flex-1">← Volver</button>
                <button onClick={handleImport} disabled={rows.length === 0}
                  className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                  <Check size={13} /> Importar {rows.length} contactos
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-8 h-8 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-secondary">Importando contactos...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Contacts() {
  const { stages, leads, systemLeads, discardedLeads, loading, createLead } = usePipeline()
  const [selectedLead, setSelectedLead] = useState(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')
  const [viewMode, setViewMode] = useState('active')
  const [showImport, setShowImport] = useState(false)

  // Combine leads based on view mode
  const allLeadsForView = useMemo(() => {
    if (viewMode === 'active') return leads
    if (viewMode === 'system') return systemLeads
    if (viewMode === 'discarded') return discardedLeads
    return leads
  }, [viewMode, leads, systemLeads, discardedLeads])

  const filtered = useMemo(() => {
    let result = [...allLeadsForView]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        normalizePhone(l.phone).includes(q)
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
      const at = a.createdAt?.toDate?.() || new Date(0)
      const bt = b.createdAt?.toDate?.() || new Date(0)
      return bt - at
    })

    return result
  }, [allLeadsForView, search, stageFilter, sourceFilter, sortBy])

  const totalValue = filtered.reduce((sum, l) => sum + (l.value || 0), 0)

  // Get stage or system stage label for a lead
  const getStageLabel = (lead) => {
    if (lead.systemStage && SYSTEM_STAGES[lead.systemStage]) {
      return {
        name: SYSTEM_STAGES[lead.systemStage].name,
        color: SYSTEM_STAGES[lead.systemStage].color,
        isSystem: true,
      }
    }
    if (lead.discarded) {
      const cat = DISCARD_CATEGORIES.find(c => c.value === lead.discardCategory)
      return {
        name: cat?.label || 'Descartado',
        color: '#ff3b30',
        isSystem: true,
      }
    }
    const stage = stages.find(s => s.id === lead.stageId)
    if (stage) return { name: stage.name, color: stage.color, isSystem: false }
    return null
  }

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
      <div className="bg-surface border-b border-black/[0.08] px-5 py-3 flex flex-col gap-2.5 flex-shrink-0">
        {/* Row 1 — título + tabs + valor + acciones */}
        <div className="flex items-center gap-3">
          <h1 className="font-display font-bold text-[15px] tracking-tight">Contactos</h1>

          {/* View mode tabs */}
          <div className="flex bg-surface-2 border border-black/[0.08] rounded-[8px] p-0.5 ml-1">
            {VIEW_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setViewMode(opt.value)}
                className={clsx('px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all flex items-center gap-1.5',
                  viewMode === opt.value ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary')}>
                {opt.value === 'discarded' && <Archive size={11} />}
                {opt.label}
                <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  viewMode === opt.value ? 'bg-primary/10 text-primary' : 'bg-black/[0.06] text-tertiary')}>
                  {opt.value === 'active' ? leads.length :
                    opt.value === 'system' ? systemLeads.length :
                      discardedLeads.length}
                </span>
              </button>
            ))}
          </div>

          {totalValue > 0 && (
            <span className="text-[11px] font-semibold bg-blue-50 text-accent-blue px-2.5 py-1 rounded-full">
              {formatValue(totalValue)} total
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowImport(true)}
              className="btn-secondary text-[12.5px] py-1.5 px-3 flex items-center gap-1.5">
              <Upload size={13} /> Importar
            </button>
          </div>
        </div>

        {/* Row 2 — búsqueda + filtros */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 w-52">
            <Search size={14} strokeWidth={2.5} className="text-tertiary flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="bg-transparent text-[12.5px] text-primary placeholder-tertiary flex-1 outline-none" />
          </div>

          {viewMode === 'active' && (
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
              className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer">
              <option value="all">Todas las etapas</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer">
            <option value="all">Todas las fuentes</option>
            {Object.entries(SOURCE_CONFIG).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>

          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                : viewMode === 'discarded'
                  ? 'No hay leads descartados'
                  : viewMode === 'system'
                    ? 'No hay leads en proceso de cierre'
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
                const stageInfo = getStageLabel(lead)
                const source = SOURCE_CONFIG[lead.source] || SOURCE_CONFIG.manual
                const initials = lead.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
                const date = lead.createdAt?.toDate
                  ? lead.createdAt.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
                  : '—'
                const displayValue = lead.closedProduct?.price || lead.value

                return (
                  <tr key={lead.id} onClick={() => setSelectedLead(lead)}
                    className="border-b border-black/[0.04] hover:bg-surface-2 cursor-pointer transition-colors">

                    {/* Contacto */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                          style={{ background: stageInfo?.color || '#0a0a0a' }}>
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[13px] text-primary leading-tight">{lead.name}</span>
                            {lead.profileB && <Star size={10} className="text-blue-500" fill="currentColor" />}
                            {lead.handoffBoundFrom && (
                              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-600">HB</span>
                            )}
                          </div>
                          {lead.company && <div className="text-[11px] text-tertiary">{lead.company}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Etapa */}
                    <td className="px-4 py-3">
                      {stageInfo ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold"
                          style={{ background: `${stageInfo.color}15`, color: stageInfo.color }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: stageInfo.color }} />
                          {stageInfo.name}
                        </span>
                      ) : '—'}
                    </td>

                    {/* Fuente */}
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-[12px] text-secondary">
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
                      <span className={clsx('font-display font-semibold text-[13px]',
                        lead.systemStage === 'closed' ? 'text-green-600' : 'text-primary')}>
                        {formatValue(displayValue)}
                      </span>
                    </td>

                    {/* Teléfono */}
                    <td className="px-4 py-3 text-[12.5px] text-secondary">
                      {normalizePhone(lead.phone) || '—'}
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
          lead={[...leads, ...systemLeads, ...discardedLeads].find(l => l.id === selectedLead.id) || selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}

      {/* IMPORT MODAL */}
      {showImport && (
        <LeadImportModal
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            const firstStage = stages[0]
            for (const row of rows) {
              await createLead({
                name: row.name,
                company: row.company || '',
                email: row.email || '',
                phone: row.phone || '',
                source: row.source || 'manual',
                value: Number(row.value) || 0,
                notes: row.notes || '',
                stageId: firstStage?.id || null,
                score: 0,
              })
            }
          }}
        />
      )}
    </div>
  )
}
