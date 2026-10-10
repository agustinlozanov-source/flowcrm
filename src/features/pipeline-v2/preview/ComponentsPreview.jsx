import { useState } from 'react'
import '../pipeline-v2.css'
import ScoreChip from '../components/ScoreChip'
import OwnerAvatar from '../components/OwnerAvatar'
import PipelineCard from '../components/PipelineCard'
import PipelineColumn from '../components/PipelineColumn'
import HandoffColumn from '../components/HandoffColumn'
import PostHandoffRail from '../components/PostHandoffRail'
import InsightsBar from '../components/InsightsBar'
import SidePanel from '../components/SidePanel'
import * as mock from '../mockData'

/* Ruta de preview de la Fase 1: los componentes aislados, cada uno con sus
 * variantes (vacío, normal, con alerta). No es la vista del pipeline — esa
 * llega en la Fase 2. No toca la vista actual del CRM. */

function Section({ title, note, children }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 800,
        color: 'var(--text)', marginBottom: 4,
      }}>{title}</h2>
      {note && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>{note}</p>}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>{children}</div>
    </section>
  )
}

function Variant({ label, children, width }) {
  return (
    <div style={{ width }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  )
}

export default function ComponentsPreview() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [peekOpen, setPeekOpen] = useState(false)
  const [insightsCollapsed, setInsightsCollapsed] = useState(false)

  return (
    <div className="pv2" style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 40px' }}>
      <header style={{ marginBottom: 40 }}>
        <h1 style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 900,
          background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          Pipeline v2 · componentes
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
          Fase 1 — piezas aisladas con mock data. La vista completa llega en la Fase 2.
        </p>
      </header>

      <Section title="ScoreChip" note="Tri-color por umbral: hot 70+, warm 40-69, cold <40. Good es estado, no rango: aplica cuando ya está agendado o ganado.">
        <Variant label="Rangos">
          <div style={{ display: 'flex', gap: 12 }}>
            <ScoreChip score={81} /><ScoreChip score={52} /><ScoreChip score={28} /><ScoreChip score={88} won />
          </div>
        </Variant>
        <Variant label="Con tendencia">
          <div style={{ display: 'flex', gap: 12 }}>
            <ScoreChip score={78} trend="up" /><ScoreChip score={48} trend="down" />
          </div>
        </Variant>
        <Variant label="Límites">
          <div style={{ display: 'flex', gap: 12 }}>
            <ScoreChip score={0} /><ScoreChip score={70} /><ScoreChip score={100} won />
          </div>
        </Variant>
      </Section>

      <Section title="OwnerAvatar" note="El avatar de Flowi es deliberadamente distinto: fondo oscuro, borde teal e ícono. Nunca se confunde con una persona.">
        <Variant label="Personas">
          <div style={{ display: 'flex', gap: 10 }}>
            <OwnerAvatar name="Tere Guillén" /><OwnerAvatar name="Miguel Ortega" /><OwnerAvatar name="Ana Mendoza" />
          </div>
        </Variant>
        <Variant label="Bot">
          <OwnerAvatar name="Flowi" bot />
        </Variant>
        <Variant label="Sin nombre">
          <OwnerAvatar name="" />
        </Variant>
      </Section>

      <Section title="PipelineCard" note="Tres densidades. Click en la tarjeta abre el panel; click en el nombre abre la página completa.">
        <Variant label="Comfortable (default)" width={280}>
          <PipelineCard deal={mock.dealNormal} onWhatsApp={() => {}} onCall={() => {}} />
        </Variant>
        <Variant label="Compact" width={280}>
          <PipelineCard deal={mock.dealNormal} density="compact" />
        </Variant>
        <Variant label="Spacious" width={280}>
          <PipelineCard deal={mock.dealAi} density="spacious" />
        </Variant>
        <Variant label="Con alerta (rotting)" width={280}>
          <PipelineCard deal={mock.dealRotting} />
        </Variant>
        <Variant label="Bot + seleccionada" width={280}>
          <PipelineCard deal={mock.dealBot} selected />
        </Variant>
        <Variant label="Ganada" width={280}>
          <PipelineCard deal={mock.dealWon} />
        </Variant>
      </Section>

      <Section title="PipelineColumn / HandoffColumn" note="La columna Handoff no es una etapa más: gradiente de marca, borde teal, barra más gruesa y alta que dice mover, no crear.">
        <Variant label="Normal" width={300}>
          <div style={{ height: 420 }}>
            <PipelineColumn name="Nuevo" color="var(--stage-1)" metrics={mock.columnMetrics}>
              <PipelineCard deal={mock.dealBot} />
              <PipelineCard deal={mock.dealRotting} />
            </PipelineColumn>
          </div>
        </Variant>
        <Variant label="Vacía" width={300}>
          <div style={{ height: 420 }}>
            <PipelineColumn name="Datos recolectados" color="var(--stage-3)" metrics={[{ label: 'Deals', value: '0' }, { label: 'Valor', value: '$0' }]} isEmpty />
          </div>
        </Variant>
        <Variant label="Handoff" width={300}>
          <div style={{ height: 420 }}>
            <HandoffColumn metrics={mock.handoffMetrics}>
              <PipelineCard deal={{ ...mock.dealRotting, name: 'Jorge Tamez', sub: 'WhatsApp · Urgencia', score: 95, nextAction: { text: 'Bandera roja → recepción', tone: 'overdue', icon: 'alert' } }} />
            </HandoffColumn>
          </div>
        </Variant>
      </Section>

      <Section title="InsightsBar" note="Colapsable, no fija. Cada métrica hace drill-down.">
        <Variant label="Normal" width="100%">
          <InsightsBar metrics={mock.insights} collapsed={insightsCollapsed} onToggle={() => setInsightsCollapsed(v => !v)} />
          {insightsCollapsed && (
            <button className="pv2-btn" style={{ marginTop: 8 }} onClick={() => setInsightsCollapsed(false)}>
              Mostrar métricas (está colapsada)
            </button>
          )}
        </Variant>
        <Variant label="Con alerta" width="100%">
          <InsightsBar metrics={mock.insightsAlert} />
        </Variant>
      </Section>

      <Section title="PostHandoffRail" note="Las cinco post-etapas son fijas del producto. Click en una la expande como drawer (Fase 2).">
        <Variant label="Con datos" width="100%">
          <PostHandoffRail stages={mock.railStages} />
        </Variant>
        <Variant label="Vacío" width="100%">
          <PostHandoffRail stages={mock.railEmpty} />
        </Variant>
      </Section>

      <Section title="SidePanel" note="480 px con tabs, acciones, score explain y timeline. El peek es la variante de 320 px, solo lectura, que abre Space.">
        <Variant label="Completo">
          <button className="pv2-btn pv2-btn--primary" onClick={() => { setPeekOpen(false); setPanelOpen(true) }}>
            Abrir side panel
          </button>
        </Variant>
        <Variant label="Peek (solo lectura)">
          <button className="pv2-btn" onClick={() => { setPanelOpen(false); setPeekOpen(true) }}>
            Abrir peek
          </button>
        </Variant>
        <Variant label="Deal sin datos">
          <button className="pv2-btn" onClick={() => { setPeekOpen(false); setPanelOpen('empty') }}>
            Abrir deal vacío
          </button>
        </Variant>
      </Section>

      <SidePanel
        deal={panelOpen === 'empty' ? mock.panelDealEmpty : mock.panelDeal}
        open={!!panelOpen}
        onClose={() => setPanelOpen(false)}
      />
      <SidePanel
        deal={mock.panelDeal}
        open={peekOpen}
        peek
        onClose={() => setPeekOpen(false)}
      />
    </div>
  )
}
