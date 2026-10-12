import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors, useDraggable,
} from '@dnd-kit/core'
import toast from 'react-hot-toast'
import Topbar from '../components/Topbar'
import InsightsBar from '../components/InsightsBar'
import PipelineColumn from '../components/PipelineColumn'
import PipelineCard from '../components/PipelineCard'
import SidePanel from '../components/SidePanel'
import PeekPreview from '../components/PeekPreview'
import NewCardDialog from '../components/NewCardDialog'
import { OportunidadesSection, ContactoSection, CitasSection } from '../components/LeadSections'
import LeadTimeline from '../components/LeadTimeline'
import NotasLead from '../components/NotasLead'
import { COLUMNS, columnMetrics, distribution } from '../boardData'
import { toCard, columnOf } from '../adapter'
import { usePipeline } from '@/hooks/usePipeline'
import { useAppointments } from '@/hooks/useAppointments'
import { useProducts } from '@/hooks/useProducts'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()
  const {
    leads, systemLeads, members, loading, stages,
    pipelines, activePipelineId, setActivePipelineId,
    moveToHandoff, resolveHandoff, updateLead, createLead,
  } = usePipeline()
  const { appointments } = useAppointments()
  const { products } = useProducts()

  const [view, setView] = useState('kanban')
  const [insightsOpen, setInsightsOpen] = useState(true)
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [peek, setPeek] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [creating, setCreating] = useState(false)
  // Contador y no booleano: hacer clic en el nombre otra vez tiene que volver
  // a abrir el editor aunque ya se haya cerrado.
  const [editandoContacto, setEditandoContacto] = useState(0)
  const hovered = useRef(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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
      out[columnOf(lead)].push(
        toCard(lead, { members, products, citasDelLead: citasPorLead[lead.id] || [] }),
      )
    }
    // Dentro de cada columna, primero lo más maduro.
    for (const k of Object.keys(out)) out[k].sort((a, b) => b.score - a.score)
    return out
  }, [leads, systemLeads, members, products, citasPorLead, search])

  const flat = useMemo(() => COLUMNS.flatMap(c => board[c.id]), [board])

  // Solo métricas que se pueden calcular de verdad. Las del briefing que
  // dependen de histórico (conversión, tiempo de cierre) llegan cuando exista
  // ese histórico — ver BACKEND-CHANGES-NEEDED.md.
  const insights = useMemo(() => {
    const activas = board.calentamiento.length + board.handoff.length
    const money = n => `$${Math.round(n).toLocaleString('es-MX')}`

    /* Ganado sale de las oportunidades cerradas, no del producto del lead.
     *
     * Antes exigía que el lead tuviera fecha de cierre, y esa fecha solo la
     * escribe el camino viejo de cerrar venta: ganar oportunidades desde la
     * ficha dejaba el número en cero para siempre. Tampoco se declara una
     * ventana de 30 días, porque la fecha de cada cierre vive en la
     * oportunidad y acá solo llegan los totales del lead. */
    const todos = [...leads, ...systemLeads].filter(l => !l.discarded)
    const ganado = todos.reduce((s, l) => s + (l.opportunityStats?.valueWon || 0), 0)

    return [
      { label: 'Tarjetas activas', value: String(activas) },
      { label: 'En cierre', value: String(board.cierre.length) },
      { label: 'Real', value: money(flat.reduce((s, c) => s + (c.amount || 0), 0)) },
      { label: 'Potencial', value: money(flat.reduce((s, c) => s + (c.potential || 0), 0)), color: 'purple' },
      { label: 'Ganado', value: money(ganado), color: 'green' },
    ]
  }, [board, flat, leads, systemLeads])

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

  /* Qué movimientos tienen sentido.
   *
   * Una venta cerrada no se arrastra: sacarla de Cierre la descerraría y
   * descuadraría las estadísticas del equipo. Se reabre desde la ficha, que
   * pregunta y deja rastro.
   *
   * Calentamiento → Cierre tampoco: pasar directo a oportunidad saltea la
   * llamada, que es justamente lo que Handoff representa. */
  const puedeMover = useCallback((card, destino) => {
    const origen = columnOf(card._lead)
    if (origen === destino) return false
    if (card._lead.systemStage === 'closed') return false
    if (origen === 'calentamiento' && destino === 'cierre') return false
    return true
  }, [])

  const handleCreate = useCallback(async ({ name, phone, value }) => {
    try {
      // Sin etapa el lead no aparecería en ninguna columna, así que entra en
      // la primera del pipeline activo.
      await createLead({ name, phone, value, source: 'manual', stageId: stages[0]?.id || null })
      toast.success(`${name} entró al pipeline`)
    } catch {
      toast.error('No se pudo crear la tarjeta')
    }
  }, [createLead, stages])

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setDragging(null)
    if (!over) return
    const card = flat.find(c => c.id === active.id)
    const destino = over.id
    if (!card) return
    if (!puedeMover(card, destino)) {
      // Callarse acá deja al usuario pensando que la app falló.
      const origen = columnOf(card._lead)
      if (origen === destino) return
      if (card._lead.systemStage === 'closed') {
        toast.error('Una venta cerrada se reabre desde la ficha, no arrastrando')
      } else {
        toast.error('De Calentamiento se pasa por Handoff: ahí es donde alguien llama')
      }
      return
    }

    try {
      if (destino === 'handoff') {
        await moveToHandoff(card.id)
        toast.success(`${card.name} pasó a Handoff`)
      } else if (destino === 'cierre') {
        // Hubo llamada pero todavía no hay fecha de pago: eso es exactamente
        // una oportunidad abierta. La fecha se carga después en la ficha.
        await resolveHandoff(card.id, 'open_opportunity')
        toast.success(`${card.name} pasó a Cierre — falta fecha de pago`)
      } else {
        // Volver a calentamiento. moveToHandoff había borrado la etapa, así
        // que hay que devolverle una o el lead queda sin columna.
        await updateLead(card.id, { systemStage: null, stageId: card._lead.stageId || stages[0]?.id || null })
        toast.success(`${card.name} volvió a Calentamiento`)
      }
    } catch {
      toast.error('No se pudo mover la tarjeta')
    }
  }, [flat, puedeMover, moveToHandoff, resolveHandoff, updateLead, stages])

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
    <>
      <Topbar
        breadcrumb="Pipeline"
        title={pipelines.find(p => p.id === activePipelineId)?.name || org?.name || 'Pipeline'}
        stats={topbarStats}
        activeView={view} onViewChange={setView}
        filterCount={Object.values(filters).filter(Boolean).length}
        onFilters={() => {}} onSearch={setSearch}
        primaryLabel="Nueva tarjeta" onPrimary={() => setCreating(true)}
      />

      {/* Cambiar de pipeline. Como en el board anterior, solo aparece si hay
          más de uno: con uno solo es una fila que no decide nada. */}
      {pipelinesSidebar.length > 1 && (
        <div className="pv2-pipeline-switch">
          {pipelinesSidebar.map(p => (
            <button
              key={p.id}
              className={clsx('pv2-chip-btn', activePipelineId === p.id && 'pv2-chip-btn--active')}
              onClick={() => setActivePipelineId(p.id)}
            >
              <span className="pv2-pipeline-dot" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      )}

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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={({ active }) => setDragging(flat.find(c => c.id === active.id) || null)}
            onDragCancel={() => setDragging(null)}
            onDragEnd={handleDragEnd}
          >
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
                  droppableId={col.id}
                  canDrop={!dragging || puedeMover(dragging, col.id)}
                  onAdd={col.id === 'calentamiento' ? () => setCreating(true) : undefined}
                >
                  {cards.map(deal => (
                    <DraggableCard
                      key={deal.id}
                      deal={deal}
                      selected={selected?.id === deal.id}
                      onHover={h => { hovered.current = h ? deal : (hovered.current?.id === deal.id ? null : hovered.current) }}
                      onOpen={() => { setPeek(null); setSelected(deal) }}
                      onWhatsApp={deal.hasConversation ? () => navigate(`/inbox?lead=${deal.id}`) : undefined}
                      onCall={deal.phone ? () => { window.location.href = `tel:${deal.phone}` } : undefined}
                    />
                  ))}
                </PipelineColumn>
              )
            })}
          </div>

          <DragOverlay>
            {dragging && (
              <div className="pv2-drag-overlay">
                <PipelineCard deal={dragging} onOpen={() => {}} />
              </div>
            )}
          </DragOverlay>
          </DndContext>
        )}
      </div>

      <SidePanel
        onTitleClick={() => setEditandoContacto(n => n + 1)}
        extraResumen={selected && (
          <>
            <CitasSection leadId={selected.id} onEditar={id => navigate(`/meetings?editar=${id}`)} />
            <OportunidadesSection leadId={selected.id} products={products} />
            <ContactoSection
              key={`contacto-${editandoContacto}`}
              lead={selected._lead}
              autoEdit={editandoContacto > 0}
              onSave={datos => updateLead(selected.id, datos)}
            />
          </>
        )}
        tabContent={selected ? {
          timeline: <LeadTimeline leadId={selected.id} />,
          notas: <NotasLead lead={selected._lead} onSave={notes => updateLead(selected.id, { notes })} />,
          archivos: <p className="pv2-empty-tab">Los archivos del lead todavía no se guardan acá. Los que manda el agente quedan en la conversación.</p>,
        } : undefined}
        onAction={id => {
          if (!selected) return
          if (id === 'whatsapp') return navigate(`/inbox?lead=${selected.id}`)
          if (id === 'call' && selected.phone) return (window.location.href = `tel:${selected.phone}`)
          if (id === 'email' && selected.email) return (window.location.href = `mailto:${selected.email}`)
          if (id === 'calendar') return navigate(`/meetings?lead=${selected.id}&nueva=1`)
          toast.error('Ese contacto no tiene ese dato cargado todavía')
        }}
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

      {creating && <NewCardDialog onClose={() => setCreating(false)} onCreate={handleCreate} />}

      <PeekPreview
        deal={peek}
        open={!!peek}
        onClose={() => setPeek(null)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
    </>
  )
}

/* La tarjeta arrastrable envuelve a PipelineCard en vez de modificarla: así
 * la tarjeta sigue sirviendo fuera de un DndContext, como en la página de
 * componentes. */
function DraggableCard({ deal, selected, onHover, onOpen, onWhatsApp, onCall }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={isDragging ? 'pv2-card--dragging' : undefined}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <PipelineCard
        deal={deal}
        selected={selected}
        onOpen={onOpen}
        onWhatsApp={onWhatsApp}
        onCall={onCall}
      />
    </div>
  )
}
