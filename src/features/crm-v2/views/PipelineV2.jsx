import { useState, useEffect, useMemo, useRef } from 'react'
import AppShellV2 from '../layout/AppShellV2'
import Topbar from '../components/Topbar'
import InsightsBar from '../components/InsightsBar'
import PipelineColumn from '../components/PipelineColumn'
import PipelineCard from '../components/PipelineCard'
import SidePanel from '../components/SidePanel'
import PeekPreview from '../components/PeekPreview'
import { COLUMNS, columnMetrics, distribution } from '../boardData'
import { toCard, columnOf } from '../adapter'
import { usePipeline } from '@/hooks/usePipeline'
import { useAppointments } from '@/hooks/useAppointments'
import { useAuthStore } from '@/store/authStore'

/**
 * Pipeline rediseñado, con datos reales de Firestore.
 *
 * Las tres columnas no son un campo nuevo: se deducen de systemStage, que ya
 * se guarda hoy. Por eso esta vista convive con la vieja sin migrar nada.
 *
 * Los atajos (Space para peek, Esc para cerrar) viven acá y no en la tarjeta
 * porque dependen de cuál está hovereada, que es estado del board.
 */
export default function PipelineV2() {
  const { org } = useAuthStore()
  const {
    leads, systemLeads, members, loading,
    pipelines, activePipelineId, setActivePipelineId,
  } = usePipeline()
  const { appointments } = useAppointments()

  const [view, setView] = useState('kanban')
  const [insightsOpen, setInsightsOpen] = useState(true)
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [peek, setPeek] = useState(null)
  const hovered = useRef(null)

  // Citas futuras agrupadas por lead: la tarjeta necesita saber si hay una
  // agendada para decir cuál es la próxima acción.
  const citasPorLead = useMemo(() => {
    const now = Date.now()
    return appointments.reduce((acc, a) => {
      const d = a.scheduledAt?.toDate?.() || null
      if (!d || d.getTime() < now) return acc
      ;(acc[a.leadId] ||= []).push(a)
      return acc
    }, {})
  }, [appointments])

  const board = useMemo(() => {
    const todos = [...leads, ...systemLeads].filter(l => !l.discarded)
    const q = search.trim().toLowerCase()
    const visibles = q
      ? todos.filter(l =>
          l.name?.toLowerCase().includes(q) ||
          l.company?.toLowerCase().includes(q) ||
          l.phone?.includes(q))
      : todos

    const out = { calentamiento: [], handoff: [], cierre: [] }
    for (const lead of visibles) {
      out[columnOf(lead)].push(toCard(lead, { members, citasDelLead: citasPorLead[lead.id] || [] }))
    }
    // Dentro de cada columna, primero lo más maduro.
    for (const k of Object.keys(out)) out[k].sort((a, b) => b.score - a.score)
    return out
  }, [leads, systemLeads, members, citasPorLead, search])

  const flat = useMemo(() => COLUMNS.flatMap(c => board[c.id]), [board])

  // Solo métricas que se pueden calcular de verdad. Las del briefing que
  // dependen de histórico (conversión, tiempo de cierre) llegan cuando exista
  // ese histórico — ver BACKEND-CHANGES-NEEDED.md.
  const insights = useMemo(() => {
    const activas = board.calentamiento.length + board.handoff.length
    const valor = flat.reduce((s, c) => s + (c.amount || 0), 0)
    const hace30 = Date.now() - 30 * 864e5
    const ganados = systemLeads
      .filter(l => l.systemStage === 'closed' && (l.closedAt?.toDate?.()?.getTime() || 0) > hace30)
      .reduce((s, l) => s + (l.closedProduct?.price || l.value || 0), 0)
    const money = n => `$${Math.round(n).toLocaleString('es-MX')}`
    return [
      { label: 'Tarjetas activas', value: String(activas) },
      { label: 'En cierre', value: String(board.cierre.length) },
      { label: 'Valor en juego', value: money(valor) },
      { label: 'Ganados · 30d', value: money(ganados), color: 'green' },
    ]
  }, [board, flat, systemLeads])

  // Los pipelines de Firestore no guardan color; la sidebar sí lo necesita
  // para el punto de cada uno, así que se asigna por posición.
  const COLORES = ['#1AAB99', '#F79009', '#9E77ED', '#2E90FA', '#F04438']
  const pipelinesSidebar = useMemo(
    () => pipelines.map((p, i) => ({ id: p.id, name: p.name, color: p.color || COLORES[i % COLORES.length] })),
    [pipelines],
  )

  const topbarStats = useMemo(() => ([
    { label: 'Tarjetas', value: String(flat.length) },
    { label: 'Handoff', value: String(board.handoff.length) },
  ]), [flat, board])

  useEffect(() => {
    const onKey = e => {
      const typing = ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
      if (typing) return

      if (e.code === 'Space' && hovered.current && !selected) {
        e.preventDefault()
        setPeek(hovered.current)
      }
      if (e.key === 'Escape') { setPeek(null); setSelected(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const step = dir => setPeek(cur => {
    const i = flat.findIndex(d => d.id === cur?.id)
    if (i < 0) return cur
    return flat[Math.min(flat.length - 1, Math.max(0, i + dir))] || cur
  })

  return (
    <AppShellV2
      active="pipeline"
      pipelines={pipelinesSidebar}
      activePipelineId={activePipelineId}
      onSelectPipeline={setActivePipelineId}
    >
      <Topbar
        breadcrumb="Pipeline" title={org?.name || 'Pipeline'} onTitleClick={() => {}}
        stats={topbarStats}
        activeView={view} onViewChange={setView}
        filterCount={Object.values(filters).filter(Boolean).length}
        onFilters={() => {}} onSearch={setSearch}
        primaryLabel="Nueva tarjeta" onPrimary={() => {}}
      />

      <InsightsBar
        metrics={insights}
        collapsed={!insightsOpen}
        onToggle={() => setInsightsOpen(v => !v)}
      />

      <div className="pv2-content">
        {loading ? (
          <div className="pv2-placeholder"><strong>Cargando el pipeline…</strong></div>
        ) : view !== 'kanban' ? (
          <div className="pv2-placeholder">
            <strong>Vista {view === 'tabla' ? 'Tabla' : 'Forecast'}</strong>
            Llega en una fase posterior. Por ahora, Kanban.
          </div>
        ) : (
          <div className="pv2-board">
            {COLUMNS.map(col => {
              const all = board[col.id]
              const active = filters[col.id]
              const cards = active ? all.filter(c => c.maturity === active) : all

              return (
                <PipelineColumn
                  key={col.id}
                  variant={col.variant}
                  name={col.name}
                  accent={col.accent}
                  metrics={columnMetrics(all)}
                  distribution={col.id === 'calentamiento' ? distribution(all) : undefined}
                  activeFilter={active}
                  onFilterChange={level => setFilters(f => ({ ...f, [col.id]: level }))}
                  isEmpty={cards.length === 0}
                  emptyLabel={active ? 'Ninguna tarjeta en este nivel' : 'Sin tarjetas en esta columna'}
                >
                  {cards.map(deal => (
                    <div
                      key={deal.id}
                      onMouseEnter={() => { hovered.current = deal }}
                      onMouseLeave={() => { if (hovered.current?.id === deal.id) hovered.current = null }}
                    >
                      <PipelineCard
                        deal={deal}
                        selected={selected?.id === deal.id}
                        onOpen={() => { setPeek(null); setSelected(deal) }}
                        onOpenFull={() => {}}
                        onWhatsApp={() => {}}
                        onCall={() => {}}
                      />
                    </div>
                  ))}
                </PipelineColumn>
              )
            })}
          </div>
        )}
      </div>

      <SidePanel
        deal={selected ? {
          ...selected,
          stageName: COLUMNS.find(c => board[c.id].some(d => d.id === selected.id))?.name,
          nextActionLabel: selected.nextAction?.text,
        } : null}
        open={!!selected}
        onClose={() => setSelected(null)}
        onPrev={() => {
          const i = flat.findIndex(d => d.id === selected?.id)
          if (i > 0) setSelected(flat[i - 1])
        }}
        onNext={() => {
          const i = flat.findIndex(d => d.id === selected?.id)
          if (i >= 0 && i < flat.length - 1) setSelected(flat[i + 1])
        }}
      />

      <PeekPreview
        deal={peek}
        open={!!peek}
        onClose={() => setPeek(null)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
    </AppShellV2>
  )
}
