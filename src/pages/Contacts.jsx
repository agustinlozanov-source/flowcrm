import { useState, useMemo, useRef, useEffect } from 'react'
import { normalizePhone } from '@/lib/utils'
import { coincide } from '@/features/crm-v2/buscar'
import { usePipeline, SYSTEM_STAGES, DISCARD_CATEGORIES } from '@/hooks/usePipeline'
import LeadDrawer from '@/components/pipeline/LeadDrawer'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import { descargarCSV, COLUMNAS_LEADS } from '@/lib/exportar'
import { COLUMNAS_CONTACTO, leerContactosCSV, descargarPlantillaContactos } from '@/lib/contactosCSV'
import { db, auth } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import {
  Search, Users, MousePointerClick, Instagram, MessageCircle,
  Linkedin, Globe, Star, PenTool, Archive, Filter,
  Upload, X, Check, Download, Trash2, RotateCcw, AlertTriangle
} from 'lucide-react'

const SOURCE_CONFIG = {
  meta_ads:  { icon: <MousePointerClick size={14} className="text-blue-500" />,  label: 'Meta Ads'  },
  facebook:  { icon: <img src="/icons/Facebook Icon.png" style={{width:14,height:14,objectFit:'contain'}} alt="" />, label: 'Facebook' },
  messenger: { icon: <img src="/icons/Facebook Icon.png" style={{width:14,height:14,objectFit:'contain'}} alt="" />, label: 'Facebook' },
  instagram: { icon: <Instagram size={14} className="text-pink-500" />,          label: 'Instagram' },
  whatsapp:  { icon: <MessageCircle size={14} className="text-green-500" />,     label: 'WhatsApp'  },
  linkedin:  { icon: <Linkedin size={14} className="text-blue-700" />,           label: 'LinkedIn'  },
  web:       { icon: <Globe size={14} className="text-indigo-500" />,            label: 'Web'       },
  referral:  { icon: <Star size={14} className="text-yellow-500" />,             label: 'Referido'  },
  manual:    { icon: <PenTool size={14} className="text-gray-500" />,            label: 'Manual'    },
}

/** Solo los ids y las etiquetas, para que el CSV pueda validar el origen sin
 *  arrastrar los iconos. */
const ORIGENES = Object.fromEntries(Object.entries(SOURCE_CONFIG).map(([k, c]) => [k, c.label]))

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

function LeadImportModal({ existentes = [], onClose, onImport }) {
  const [step, setStep] = useState('upload')
  const [lectura, setLectura] = useState({ listas: [], sueltas: [], sinColumnas: false })
  const fileRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setLectura(leerContactosCSV(String(ev.target.result || ''), { existentes, origenes: ORIGENES }))
      setStep('preview')
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleImport = async () => {
    setStep('importing')
    try {
      await onImport(lectura.listas)
      toast.success(`${lectura.listas.length} contactos importados`)
      onClose()
    } catch { toast.error('Error al importar'); setStep('preview') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-lg border border-black/[0.08]">

        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06]">
          <div>
            <h2 className="font-display font-bold text-lg tracking-tight">Importar contactos</h2>
            <p className="text-xs text-secondary mt-0.5">Las mismas columnas que la exportación</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <button onClick={descargarPlantillaContactos}
                className="flex items-center gap-2 text-[12.5px] text-secondary hover:text-primary transition-colors">
                <Download size={13} /> Descargar plantilla CSV
              </button>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-black/[0.12] rounded-[12px] p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all">
                <Upload size={24} className="text-tertiary mx-auto mb-2" />
                <p className="text-[13px] font-semibold text-primary mb-1">Selecciona un archivo CSV</p>
                <p className="text-xs text-secondary">O arrastra y suéltalo aquí</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={handleFile} />
              <div className="bg-surface-2 rounded-[10px] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-1.5">Columnas que se reconocen</p>
                <p className="text-[12.5px] text-primary">{COLUMNAS_CONTACTO.join(' · ')}</p>
                <p className="text-xs text-secondary mt-1.5">
                  Basta con el nombre o el teléfono. El archivo que descargas desde «Exportar» se vuelve
                  a subir tal cual.
                </p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col gap-4">
              {lectura.sinColumnas && (
                <div className="bg-red-50 border border-red-200 rounded-[10px] p-3">
                  <p className="text-xs text-red-600">
                    No encuentro el encabezado. La primera fila tiene que traer los nombres de las columnas.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4 text-[13px]">
                <span className="flex items-center gap-1.5 font-semibold text-green-600">
                  <Check size={13} /> {lectura.listas.length} listos para crear
                </span>
                {lectura.sueltas.length > 0 && (
                  <span className="flex items-center gap-1.5 font-semibold text-amber-600">
                    <AlertTriangle size={13} /> {lectura.sueltas.length} se quedan fuera
                  </span>
                )}
              </div>

              {lectura.listas.length > 0 && (
                <div className="max-h-52 overflow-y-auto border border-black/[0.08] rounded-[10px] divide-y divide-black/[0.05]">
                  {lectura.listas.map((row, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="font-semibold text-[13px] text-primary">
                        {[row.name, row.lastName].filter(Boolean).join(' ')}
                      </span>
                      {row.company && <span className="text-[11px] text-secondary">{row.company}</span>}
                      {(row.email || row.phone) && (
                        <span className="text-[11px] text-tertiary ml-auto">{row.email || row.phone}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {lectura.sueltas.length > 0 && (
                <div className="bg-surface-2 rounded-[10px] px-4 py-3 flex flex-col gap-1">
                  {lectura.sueltas.slice(0, 6).map(s => (
                    <p key={s.renglon} className="text-xs text-secondary">
                      <b className="text-primary">Renglón {s.renglon}</b> · {s.nombre} — {s.motivo}
                    </p>
                  ))}
                  {lectura.sueltas.length > 6 && (
                    <p className="text-xs text-secondary">y {lectura.sueltas.length - 6} más.</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('upload')} className="btn-secondary flex-1">← Volver</button>
                <button onClick={handleImport} disabled={lectura.listas.length === 0}
                  className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                  <Check size={13} /> Importar {lectura.listas.length || ''}
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
  const { org } = useAuthStore()
  const { canExportData } = usePermissions()
  const orgId = org?.id
  const { stages, allStages, leads, systemLeads, discardedLeads, loading, createLead, updateLead } = usePipeline()
  const [selectedLead, setSelectedLead] = useState(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')
  const [viewMode, setViewMode] = useState('active')
  const [showImport, setShowImport] = useState(false)
  const [reactivando, setReactivando] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [featureFlags, setFeatureFlags] = useState({})

  useEffect(() => {
    const unsub = onSnapshot(doc(db, '_global_config', 'feature_flags'), snap => {
      if (snap.exists()) setFeatureFlags(snap.data())
    })
    return unsub
  }, [])

  /* Limpia la base para poder volver a probar desde el mismo WhatsApp: si el
   * lead ya existe, el sistema reconoce el número y retoma la conversación
   * anterior en vez de empezar de cero.
   *
   * La organización la decide el servidor a partir de quién pide, no se manda
   * desde acá: antes se mandaba el id junto a una contraseña escrita en el
   * código del navegador, y con eso se le podía borrar la base a cualquiera.
   */
  /* Exportar la base. Se lleva lo que está a la vista con los filtros puestos,
   * no todo siempre: si alguien filtró por descartados, eso es lo que quiere
   * bajarse. */
  const handleExport = () => {
    const filas = [...leads, ...systemLeads, ...discardedLeads]
    if (!filas.length) { toast.error('No hay contactos para exportar'); return }
    const n = descargarCSV('contactos', COLUMNAS_LEADS, filas)
    toast.success(`${n} contactos exportados`)
  }

  const handleClearAllLeads = async () => {
    const total = leads.length + systemLeads.length + discardedLeads.length
    const escrito = window.prompt(
      `Esto borra los ${total} leads de ${org?.name || 'esta organización'}, sus conversaciones, sus oportunidades y todas las citas.\n\nNo se puede deshacer. Escribí BORRAR para confirmar.`,
    )
    if (escrito !== 'BORRAR') return

    setClearing(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/.netlify/functions/clear-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: 'BORRAR' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al limpiar')
      toast.success(`${data.leads} leads, ${data.subdocs} mensajes y ${data.citas} citas eliminados`)
    } catch (e) {
      toast.error(e.message || 'Error de conexión')
    } finally {
      setClearing(false)
    }
  }

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
      result = result.filter(l => coincide(l, search))
    }

    if (stageFilter !== 'all') {
      result = result.filter(l => l.stageId === stageFilter)
    }

    if (sourceFilter !== 'all') {
      const matchSources = sourceFilter === 'facebook' ? ['facebook', 'messenger'] : [sourceFilter]
      result = result.filter(l => matchSources.includes(l.source))
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

  /* Reactivar un descartado.
   *
   * Vuelve a donde estaba, no al principio. El trabajo pasó de verdad: la
   * cotización se mandó, la junta ocurrió, y descartarlo no deshizo nada de
   * eso. Mandarlo a la primera etapa obliga a arrastrarlo cinco veces a mano
   * y hace mentir al tablero en la otra dirección.
   *
   * El riesgo es el contrario: uno que se descartó en cierre porque
   * desapareció vuelve a cierre e infla el pronóstico. Por eso queda marcado
   * como reactivado, con la fecha en que se había descartado. Si fue hace tres
   * días está igual que estaba; si lleva ocho meses, se ve y se arrastra
   * hacia atrás a mano.
   *
   * Las razones que no se retoman no ofrecen el botón. La solicitud expresa
   * no es una razón comercial: es consentimiento. */
  const puedeRetomar = (categoria) =>
    DISCARD_CATEGORIES.find(c => c.value === categoria)?.canRetake !== false

  const reactivar = async (lead) => {
    const sabemosDonde = lead.systemStageAntes || lead.stageId
    const vuelveA = sabemosDonde
      ? null
      : allStages.find(s => s.pipelineId === lead.pipelineId)
    if (!sabemosDonde && !vuelveA) { toast.error('Ese embudo ya no tiene etapas'); return }

    setReactivando(lead.id)
    try {
      await updateLead(lead.id, {
        discarded: false,
        discardedAt: null,
        discardedBy: null,
        discardCategory: null,
        discardNotes: null,
        retakeDate: null,
        reactivadoAt: new Date(),
        descartadoAntesEl: lead.discardedAt || null,
        systemStage: lead.systemStageAntes || null,
        systemStageAntes: null,
        ...(vuelveA ? { stageId: vuelveA.id } : {}),
      })
      const donde = lead.systemStageAntes
        ? SYSTEM_STAGES[lead.systemStageAntes]?.name
        : (vuelveA
            ? vuelveA.name
            : allStages.find(s => s.id === lead.stageId)?.name || 'su etapa')
      toast.success(`${lead.name} volvió a "${donde}"`)
    } catch {
      toast.error('No se pudo reactivar')
    } finally {
      setReactivando(null)
    }
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
            {canExportData && (
              <button onClick={handleExport}
                className="btn-secondary text-[12.5px] py-1.5 px-3 flex items-center gap-1.5">
                <Download size={13} /> Exportar
              </button>
            )}
            {featureFlags.clear_leads === true && (
              <button onClick={handleClearAllLeads} disabled={clearing}
                className="btn-secondary text-[12.5px] py-1.5 px-3 flex items-center gap-1.5 text-red-500 hover:bg-red-50 border-red-200">
                <Trash2 size={13} /> {clearing ? 'Borrando...' : 'Limpiar leads'}
              </button>
            )}
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
            {Object.entries(SOURCE_CONFIG).filter(([v]) => v !== 'messenger').map(([v, c]) => (
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
                {['Contacto', 'Etapa', 'Fuente', 'Score', 'Valor', 'Teléfono', 'Email', 'Fecha',
                  ...(viewMode === 'discarded' ? [''] : [])].map((h, hi) => (
                  <th key={h || hi} className="text-left text-[11px] font-semibold uppercase tracking-wide text-tertiary px-4 py-3 whitespace-nowrap">
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

                    {/* Reactivar — solo en descartados */}
                    {viewMode === 'discarded' && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {puedeRetomar(lead.discardCategory) ? (
                          <button
                            onClick={e => { e.stopPropagation(); reactivar(lead) }}
                            disabled={reactivando === lead.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black/[0.08] text-[11.5px] font-semibold text-secondary hover:text-primary hover:border-black/[0.16] disabled:opacity-40 transition-colors">
                            <RotateCcw size={12} />
                            {reactivando === lead.id ? 'Reactivando…' : 'Reactivar'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-tertiary">No se retoma</span>
                        )}
                      </td>
                    )}
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
          existentes={[...leads, ...systemLeads, ...discardedLeads]}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            const firstStage = stages[0]
            for (const row of rows) {
              await createLead({ ...row, stageId: firstStage?.id || null })
            }
          }}
        />
      )}
    </div>
  )
}
