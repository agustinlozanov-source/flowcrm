import { useState } from 'react'
import '../crm-v2.css'
import ScoreChip from '../components/ScoreChip'
import OwnerAvatar from '../components/OwnerAvatar'
import PipelineCard from '../components/PipelineCard'
import PipelineColumn from '../components/PipelineColumn'
import InsightsBar from '../components/InsightsBar'
import SidePanel from '../components/SidePanel'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import PeekPreview from '../components/PeekPreview'
import AIInsightCard from '../components/AIInsightCard'
import ScoreExplain from '../components/ScoreExplain'
import OpportunityRow from '../components/OpportunityRow'
import AppointmentCard from '../components/AppointmentCard'
import WhatsAppStatusBadge from '../components/WhatsAppStatusBadge'
import PauseAIToggle from '../components/PauseAIToggle'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState('kanban')
  const [filter, setFilter] = useState(null)
  const [peekIdx, setPeekIdx] = useState(null)
  const [paused, setPaused] = useState(false)

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

      <Section title="Sidebar" note="220 px, colapsable a 60 px. Reemplaza la sidebar actual del CRM.">
        <Variant label="Expandida" width={220}>
          <div style={{ height: 520, display: 'flex' }}>
            <Sidebar
              active="pipeline"
              counts={{ conversaciones: 14 }}
              pipelines={mock.pipelines}
              activePipeline="monte-sinai"
              user={{ name: 'Agustín Lozano', role: 'Admin · Flow Hub' }}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(v => !v)}
            />
          </div>
        </Variant>
        <Variant label="Colapsada" width={60}>
          <div style={{ height: 520, display: 'flex' }}>
            <Sidebar active="reuniones" collapsed user={{ name: 'Mario Ruiz', role: 'Recepción' }} />
          </div>
        </Variant>
        <Variant label="Rol Recepción (sin pipelines)" width={220}>
          <div style={{ height: 520, display: 'flex' }}>
            <Sidebar active="reuniones" counts={{}} pipelines={[]} user={{ name: 'Lucía Fonseca', role: 'Recepción' }} />
          </div>
        </Variant>
      </Section>

      <Section title="Topbar" note="56 px sticky con blur. Contextual: título, stats y botón primario los define la vista.">
        <Variant label="Pipeline (con stats y toggle)" width="100%">
          <Topbar
            breadcrumb="Pipeline" title="Monte Sinaí" onTitleClick={() => {}}
            stats={mock.topbarStats}
            activeView={view} onViewChange={setView}
            filterCount={2} onFilters={() => {}} onSearch={() => {}}
            primaryLabel="Nuevo deal" onPrimary={() => {}}
          />
        </Variant>
        <Variant label="Reuniones (sin toggle de vista)" width="100%">
          <Topbar
            breadcrumb="Reuniones" title="Hoy"
            stats={[{ label: 'Hoy', value: '8' }, { label: 'Asistencia 30d', value: '78%', tone: 'green' }, { label: 'No shows', value: '3', tone: 'amber' }]}
            onSearch={() => {}} primaryLabel="Nueva cita" onPrimary={() => {}}
          />
        </Variant>
        <Variant label="Mínima (sin stats ni acciones)" width="100%">
          <Topbar breadcrumb="Configuración" title="Conexiones" onSearch={() => {}} />
        </Variant>
      </Section>

      <Section title="ScoreChip" note="Neutro por defecto: el color ya lo lleva la tarjeta entera, y dos señales de color compitiendo anulan a las dos. El modo de color queda para listas y reportes, donde no hay tarjeta.">
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

      <Section title="PipelineCard" note="La tarjeta entera lleva el color de madurez. Un color por tarjeta: dice en qué punto está y en qué columna vive.">
        {mock.maturityCards.map(c => (
          <Variant key={c.maturity} label={c.levelLabel} width={280}>
            <PipelineCard deal={c} onWhatsApp={() => {}} onCall={() => {}} />
          </Variant>
        ))}
      </Section>

      <Section title="PipelineCard · densidades y alertas">
        <Variant label="Compact" width={280}>
          <PipelineCard deal={mock.maturityCards[2]} density="compact" />
        </Variant>
        <Variant label="Spacious" width={280}>
          <PipelineCard deal={mock.maturityCards[2]} density="spacious" />
        </Variant>
        <Variant label="Estancada (rotting)" width={280}>
          <PipelineCard deal={{ ...mock.maturityCards[1], rotting: true, nextAction: { text: 'Sin respuesta 2h', tone: 'overdue', icon: 'alert' } }} />
        </Variant>
        <Variant label="Seleccionada" width={280}>
          <PipelineCard deal={mock.maturityCards[3]} selected />
        </Variant>
      </Section>

      <Section title="PipelineColumn · las 3 columnas" note="Menos columnas, menos colores. La barra apilada filtra por nivel al hacer click.">
        <Variant label="En calentamiento" width={300}>
          <div style={{ height: 460 }}>
            <PipelineColumn
              variant="calentamiento" name="En calentamiento"
              metrics={[{ label: 'Tarjetas', value: '12' }, { label: 'Real', value: '$14,400' }, { label: 'Potencial', value: '$86K' }]}
              distribution={{ m1: 5, m2: 4, m3: 3 }}
              activeFilter={filter} onFilterChange={setFilter}
            >
              {mock.maturityCards.slice(0, 3).map(c => <PipelineCard key={c.id} deal={c} />)}
            </PipelineColumn>
          </div>
        </Variant>
        <Variant label="Handoff" width={300}>
          <div style={{ height: 460 }}>
            <PipelineColumn
              variant="handoff" name="Handoff"
              metrics={[{ label: 'Tarjetas', value: '2' }, { label: 'Real', value: '$3,100' }, { label: 'Pendiente', value: '1h', tone: 'amber' }]}
            >
              <PipelineCard deal={mock.maturityCards[3]} />
            </PipelineColumn>
          </div>
        </Variant>
        <Variant label="Cierre definitivo" width={300}>
          <div style={{ height: 460 }}>
            <PipelineColumn
              variant="cierre" name="Cierre definitivo"
              metrics={[{ label: 'Tarjetas', value: '9' }, { label: 'Cerrado', value: '$42,900' }]}
            >
              {mock.closingCards.map(c => <PipelineCard key={c.id} deal={c} />)}
            </PipelineColumn>
          </div>
        </Variant>
        <Variant label="Vacía" width={300}>
          <div style={{ height: 460 }}>
            <PipelineColumn variant="cierre" name="Cierre definitivo" metrics={[{ label: 'Tarjetas', value: '0' }]} isEmpty emptyLabel="Nada cerrado todavía" />
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

      <Section title="PeekPreview" note="320 px, solo lectura. Abre con Space sobre una tarjeta; ↑/↓ navegan y Esc cierra.">
        <Variant label="Abrir">
          <button className="pv2-btn pv2-btn--primary" onClick={() => setPeekIdx(2)}>Abrir peek</button>
        </Variant>
        <Variant label="Navegación">
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Con el peek abierto, <span className="pv2-kbd">↑</span> <span className="pv2-kbd">↓</span> cambian de tarjeta.
          </span>
        </Variant>
      </Section>

      <Section title="AIInsightCard" note="Lila y sparkle: la señal de que lo escribió la IA. Se usa solo para eso.">
        <Variant label="Con acción" width={430}>
          <AIInsightCard text={mock.panelDeal.aiInsight} onExecute={() => {}} />
        </Variant>
        <Variant label="Solo lectura (peek)" width={430}>
          <AIInsightCard text="Lleva <strong>3 días sin responder</strong>. Sugiero cerrar la oportunidad o reactivar con una promoción." readOnly />
        </Variant>
        <Variant label="Sin sugerencia" width={430}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No renderiza nada si no hay texto.</span>
          <AIInsightCard text={null} />
        </Variant>
      </Section>

      <Section title="ScoreExplain" note="El número se pinta con el color de madurez: misma escala que ordena el board.">
        <Variant label="Alto, subiendo" width={430}>
          <ScoreExplain score={78} delta={12} factors={mock.panelDeal.scoreFactors} />
        </Variant>
        <Variant label="Bajo" width={430}>
          <ScoreExplain score={18} factors={[{ text: 'Respondió el primer mensaje', value: 8 }, { text: 'No menciona ningún síntoma', value: -5 }]} />
        </Variant>
        <Variant label="Sin factores" width={430}>
          <ScoreExplain score={52} />
        </Variant>
      </Section>

      <Section title="OpportunityRow" note="La tarjeta no es un deal: acumula oportunidades y se cierran una por una. El sparkle marca las que vinculó la IA.">
        <Variant label="Abiertas, auto y manual" width={430}>
          {mock.opportunities.slice(0, 3).map(o => <OpportunityRow key={o.id} opportunity={o} />)}
        </Variant>
        <Variant label="Cerradas" width={430}>
          {mock.opportunities.slice(3).map(o => <OpportunityRow key={o.id} opportunity={o} />)}
        </Variant>
      </Section>

      <Section title="AppointmentCard" note="Tres tipos y status enriquecidos. El botón principal cambia según el tipo.">
        <Variant label="Los tres tipos" width={460}>
          {mock.appointments.slice(0, 3).map(a => <div key={a.id} style={{ marginBottom: 8 }}><AppointmentCard appointment={a} /></div>)}
        </Variant>
        <Variant label="Alerta de recepción (15 y 30 min)" width={460}>
          {mock.appointments.slice(3, 5).map(a => <div key={a.id} style={{ marginBottom: 8 }}><AppointmentCard appointment={a} /></div>)}
        </Variant>
        <Variant label="Resueltas" width={460}>
          {mock.appointments.slice(5).map(a => <div key={a.id} style={{ marginBottom: 8 }}><AppointmentCard appointment={a} /></div>)}
        </Variant>
      </Section>

      <Section title="WhatsAppStatusBadge" note="Nació del caso real de Monte Sinaí: el equipo operaba creyendo que todo andaba. Dice el motivo, no solo el color.">
        <Variant label="OK"><WhatsAppStatusBadge status="ok" /></Variant>
        <Variant label="Limitado"><WhatsAppStatusBadge status="warn" reasons={['window']} /></Variant>
        <Variant label="Bloqueado"><WhatsAppStatusBadge status="block" reasons={['payment', 'verification']} /></Variant>
        <Variant label="Compacto (sidebar)">
          <div style={{ display: 'flex', gap: 8 }}>
            <WhatsAppStatusBadge status="ok" compact />
            <WhatsAppStatusBadge status="warn" reasons={['templates']} compact />
            <WhatsAppStatusBadge status="block" reasons={['payment']} compact />
          </div>
        </Variant>
      </Section>

      <Section title="PauseAIToggle" note="Pausa por conversación, no por lead. Mientras está pausada, scoring y etapas se congelan.">
        <Variant label="Interactivo" width={300}>
          <PauseAIToggle paused={paused} onToggle={setPaused} />
        </Variant>
        <Variant label="Activa" width={300}><PauseAIToggle paused={false} /></Variant>
        <Variant label="Pausada" width={300}><PauseAIToggle paused /></Variant>
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
      <PeekPreview
        deal={peekIdx != null ? { ...mock.maturityCards[peekIdx], lastMessage: mock.peekDeal.lastMessage } : null}
        open={peekIdx != null}
        onClose={() => setPeekIdx(null)}
        onPrev={() => setPeekIdx(i => Math.max(0, i - 1))}
        onNext={() => setPeekIdx(i => Math.min(mock.maturityCards.length - 1, i + 1))}
      />
    </div>
  )
}
