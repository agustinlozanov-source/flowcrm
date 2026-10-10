import { useState, useEffect, useMemo, useRef } from 'react'
import AppShellV2 from '../layout/AppShellV2'
import Topbar from '../components/Topbar'
import InsightsBar from '../components/InsightsBar'
import PipelineColumn from '../components/PipelineColumn'
import PipelineCard from '../components/PipelineCard'
import SidePanel from '../components/SidePanel'
import PeekPreview from '../components/PeekPreview'
import WhatsAppStatusBadge from '../components/WhatsAppStatusBadge'
import { BOARD, COLUMNS, columnMetrics, distribution, INSIGHTS, TOPBAR_STATS } from '../boardData'

/**
 * Vista del pipeline rediseñado. Mock data: nada de esto toca backend.
 *
 * Los atajos (Space para peek, Esc para cerrar) viven acá y no en la tarjeta
 * porque dependen de cuál está hovereada, que es estado del board.
 */
export default function PipelineV2() {
  const [view, setView] = useState('kanban')
  const [insightsOpen, setInsightsOpen] = useState(true)
  const [filters, setFilters] = useState({})
  const [selected, setSelected] = useState(null)
  const [peek, setPeek] = useState(null)
  const hovered = useRef(null)

  // Lista plana en el orden visual: es la que recorren ↑/↓ en el peek.
  const flat = useMemo(() => COLUMNS.flatMap(c => BOARD[c.id]), [])

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
    <AppShellV2 active="pipeline">
      <Topbar
        breadcrumb="Pipeline" title="Monte Sinaí" onTitleClick={() => {}}
        stats={TOPBAR_STATS}
        activeView={view} onViewChange={setView}
        filterCount={Object.values(filters).filter(Boolean).length}
        onFilters={() => {}} onSearch={() => {}}
        primaryLabel="Nueva tarjeta" onPrimary={() => {}}
      />

      {/* El estado de WhatsApp vive arriba del canvas, no escondido en
          configuración: el equipo tiene que verlo antes de intentar escribir. */}
      <div className="pv2-banner pv2-banner--warn">
        <WhatsAppStatusBadge status="warn" reasons={['payment', 'verification']} compact />
        No se pueden iniciar conversaciones nuevas. Las respuestas dentro de las 24 h siguen funcionando.
        <button className="pv2-banner__action">Ver cómo resolverlo</button>
      </div>

      <InsightsBar
        metrics={INSIGHTS}
        collapsed={!insightsOpen}
        onToggle={() => setInsightsOpen(v => !v)}
      />

      <div className="pv2-content">
        {view !== 'kanban' ? (
          <div className="pv2-placeholder">
            <strong>Vista {view === 'tabla' ? 'Tabla' : 'Forecast'}</strong>
            Llega en una fase posterior. Por ahora, Kanban.
          </div>
        ) : (
          <div className="pv2-board">
            {COLUMNS.map(col => {
              const all = BOARD[col.id]
              const active = filters[col.id]
              const cards = active ? all.filter(c => c.maturity === active) : all

              return (
                <PipelineColumn
                  key={col.id}
                  variant={col.variant}
                  name={col.name}
                  metrics={columnMetrics(all, col.id === 'handoff' ? { pending: '1h' } : undefined)}
                  distribution={col.id === 'calentamiento' ? distribution(all) : undefined}
                  activeFilter={active}
                  onFilterChange={level => setFilters(f => ({ ...f, [col.id]: level }))}
                  isEmpty={cards.length === 0}
                  emptyLabel={active ? 'Ninguna tarjeta en este nivel' : undefined}
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
          // Solo lo que la tarjeta trae: nada de heredar el contenido de otra,
          // que en una demo hace creer que el panel muestra datos equivocados.
          stageName: COLUMNS.find(c => BOARD[c.id].some(d => d.id === selected.id))?.name,
          channel: selected.channel || selected.sub,
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
