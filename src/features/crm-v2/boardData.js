/* Mock del board de Monte Sinaí. 18 tarjetas repartidas en las tres columnas,
 * con los casos que importan: banderas rojas, oportunidades vinculadas,
 * scores variados y cierres parciales y totales.
 *
 * Esto desaparece en la Fase 3, cuando se conecte a Firestore. */

const bot = { name: 'Flowi', bot: true }
const mario = { name: 'Mario Ruiz' }
const lucia = { name: 'Lucía Fonseca' }

export const BOARD = {
  calentamiento: [
    { id: 'w1', maturity: 'm3', name: 'Tere Guillén', sub: 'WhatsApp · Angiografía', amount: 3500,
      score: 68, scoreTrend: 'up', potential: 18000, owner: mario,
      nextAction: { text: 'Confirmar día y hora', tone: 'today', icon: 'calendar' },
      tags: [{ label: 'Prescrito' }], ageLabel: '1d',
      lastMessage: '"Sí, tengo la indicación del Dr. Reyes. ¿Me atienden esta semana?"',
      service: 'Angiografía + OCT Macular', channel: 'WhatsApp', createdLabel: 'Creado hace 1d 4h',
      scoreDelta: 12, counts: { timeline: 24, notas: 2, archivos: 1 },
      aiInsight: 'Ya aceptó el precio y trae prescripción. Falta <strong>confirmar día y hora</strong>. Su médico le pidió el estudio esta semana: sugiero proponerle <strong>viernes 11:00 AM</strong>.',
      scoreFactors: [
        { text: 'Trae prescripción médica', value: 20 },
        { text: 'Especifica el estudio por nombre', value: 15 },
        { text: 'Preguntó disponibilidad esta semana', value: 10 },
        { text: 'Aún no confirma día concreto', value: -5 },
      ],
      fields: [
        { label: 'Servicio', value: 'Angiografía + OCT Macular' },
        { label: 'Requisitos', value: '4h ayuno · acompañante · lentes oscuros' },
        { label: 'Prescripción', value: 'Recibida', pill: 'green' },
      ] },
    { id: 'w2', maturity: 'm3', name: 'Sofía Ramírez', sub: 'WhatsApp · Prelasik', amount: 2150,
      score: 73, scoreTrend: 'up', potential: 45000, owner: bot,
      nextAction: { text: 'Verificar slot viernes 11am', tone: 'today', icon: 'calendar' },
      aiBadge: 'IA sugiere llamar', ageLabel: '2d',
      lastMessage: '"¿Cuánto sale la cirugía completa?"' },
    { id: 'w3', maturity: 'm2', name: 'Carla Robles', sub: 'WhatsApp · Consulta', amount: 1200,
      score: 44, potential: 12000, owner: bot, rotting: true,
      nextAction: { text: 'Sin respuesta 2h', tone: 'overdue', icon: 'alert' }, ageLabel: '2d',
      lastMessage: '"Déjame checarlo y te aviso."' },
    { id: 'w4', maturity: 'm2', name: 'Roberto Villarreal', sub: 'WhatsApp · OCT macular', amount: 1900,
      score: 48, owner: bot, nextAction: { text: 'Confirmar prescripción', icon: 'clock' }, ageLabel: '3d',
      lastMessage: '"Me dijeron que necesito un estudio de retina."' },
    { id: 'w5', maturity: 'm2', name: 'Ana Mendoza', sub: 'WhatsApp · Consulta', amount: 1200,
      score: 41, owner: bot, tags: [{ label: 'Para su mamá' }], ageLabel: '1d',
      nextAction: { text: 'Preguntar por la paciente', icon: 'clock' },
      lastMessage: '"Es para mi mamá, tiene 72 años."' },
    { id: 'w6', maturity: 'm1', name: 'María González', sub: 'WhatsApp · hace 12 min', amount: 1200,
      score: 18, owner: bot, nextAction: { text: 'Esperando respuesta al saludo', icon: 'clock' },
      lastMessage: '"Hola, buenas tardes."' },
    { id: 'w7', maturity: 'm1', name: 'Juan Pérez', sub: 'Instagram · hace 34 min', amount: 1200,
      score: 12, owner: bot, nextAction: { text: 'Pregunta general de precios', icon: 'clock' },
      lastMessage: '"¿Cuánto cuesta la consulta?"' },
    { id: 'w8', maturity: 'm1', name: 'Patricia Núñez', sub: 'WhatsApp · hace 45 min', amount: 1200,
      score: 22, owner: bot, rotting: true,
      nextAction: { text: 'Sin respuesta 4h', tone: 'overdue', icon: 'alert' }, ageLabel: '4h',
      lastMessage: '"Ok gracias."' },
    { id: 'w9', maturity: 'm1', name: 'Luis Hernández', sub: 'Messenger · hace 1h', amount: 1200,
      score: 25, owner: bot, tags: [{ label: 'Diabético' }],
      nextAction: { text: 'Calificar urgencia', icon: 'clock' },
      lastMessage: '"Soy diabético y veo borroso."' },
  ],
  handoff: [
    { id: 'h1', maturity: 'm4', name: 'Jorge Tamez', sub: 'WhatsApp · Urgencia', amount: 1900,
      score: 95, scoreTrend: 'up', potential: 32000, owner: mario,
      nextAction: { text: 'Bandera roja → recepción', tone: 'overdue', icon: 'alert' },
      tags: [{ label: 'Urgencia' }], ageLabel: '3h',
      lastMessage: '"Desde ayer veo manchas negras y destellos."',
      service: 'Valoración de urgencia', channel: 'WhatsApp', createdLabel: 'Creado hace 3h',
      counts: { timeline: 6, notas: 1, archivos: 0 },
      aiInsight: 'Describe <strong>manchas negras y destellos desde ayer</strong>, que puede indicar desprendimiento de retina. Marcado como bandera roja: <strong>pasar a recepción ahora</strong>, no esperar confirmación por chat.',
      scoreFactors: [
        { text: 'Síntoma compatible con urgencia retinal', value: 35 },
        { text: 'Inicio en las últimas 24 h', value: 20 },
        { text: 'Pidió atención inmediata', value: 15 },
      ],
      fields: [
        { label: 'Motivo', value: 'Manchas y destellos' },
        { label: 'Prioridad', value: 'Urgencia', pill: 'red' },
      ] },
    { id: 'h2', maturity: 'm4', name: 'Rocío Benavides', sub: 'Pidió hablar con una persona', amount: 1200,
      score: 82, owner: lucia, nextAction: { text: 'Llamar en 20 min', tone: 'today', icon: 'call' }, ageLabel: '1h',
      lastMessage: '"¿Me pueden marcar? Prefiero explicarlo por teléfono."' },
    { id: 'h3', maturity: 'm4', name: 'Fernando Castro', sub: 'Instagram · Catarata', amount: 1200,
      score: 79, scoreTrend: 'up', potential: 48000, owner: mario,
      nextAction: { text: 'Agendar valoración', tone: 'today', icon: 'calendar' }, ageLabel: '5h',
      lastMessage: '"Me dijeron que ya tengo catarata en los dos ojos."' },
  ],
  cierre: [
    { id: 'c1', maturity: 'c1', name: 'José Treviño', sub: 'Asistió · vie 11:00am', amount: 1200,
      score: 88, potential: 24000, owner: mario,
      nextAction: { text: '2 oportunidades abiertas', icon: 'check' },
      tags: [{ label: 'Cierre parcial' }], ageLabel: '6d' },
    { id: 'c2', maturity: 'c1', name: 'Miguel Ortega', sub: 'Asistió · jue 4:00pm', amount: 2900,
      score: 85, potential: 9000, owner: lucia,
      nextAction: { text: '1 oportunidad abierta', icon: 'check' },
      tags: [{ label: 'Cierre parcial' }], ageLabel: '8d' },
    { id: 'c3', maturity: 'c2', name: 'Elena Martínez', sub: 'Cerrada · sáb 10:30am', amount: 3500,
      score: 91, owner: mario, nextAction: { text: 'Todo cerrado', icon: 'check' },
      tags: [{ label: 'Cierre total' }], ageLabel: '12d' },
    { id: 'c4', maturity: 'c2', name: 'Alejandro Garza', sub: 'Cerrada · lun 9:30am', amount: 1900,
      score: 86, owner: lucia, nextAction: { text: 'Todo cerrado', icon: 'check' },
      tags: [{ label: 'Cierre total' }], ageLabel: '15d' },
    { id: 'c5', maturity: 'c2', name: 'Lupita Flores', sub: 'Descartada · no asistió', amount: 1200,
      score: 34, owner: lucia, nextAction: { text: 'Descartada tras 2 no-shows', icon: 'check' },
      tags: [{ label: 'Historial de no-show' }], ageLabel: '20d' },
  ],
}

export const COLUMNS = [
  { id: 'calentamiento', variant: 'calentamiento', name: 'En calentamiento' },
  { id: 'handoff', variant: 'handoff', name: 'Handoff' },
  { id: 'cierre', variant: 'cierre', name: 'Cierre definitivo' },
]

const money = n => `$${n.toLocaleString('es-MX')}`

/** Métricas del header, calculadas desde las tarjetas para que no se
 *  desincronicen de lo que se ve. */
export function columnMetrics(cards, { pending } = {}) {
  const real = cards.reduce((s, c) => s + (c.amount || 0), 0)
  const pot = cards.reduce((s, c) => s + (c.potential || 0), 0)
  const m = [
    { label: 'Tarjetas', value: String(cards.length) },
    { label: 'Real', value: money(real) },
  ]
  if (pot > 0) m.push({ label: 'Potencial', value: `$${Math.round(pot / 1000)}K` })
  if (pending) m.push({ label: 'Pendiente', value: pending, tone: 'amber' })
  return m
}

export function distribution(cards) {
  return cards.reduce((acc, c) => ({ ...acc, [c.maturity]: (acc[c.maturity] || 0) + 1 }), {})
}

export const INSIGHTS = [
  { label: 'Tarjetas activas', value: '17' },
  { label: 'Valor real', value: '$28,350' },
  { label: 'Potencial', value: '$188K', color: 'purple' },
  { label: 'Asistencia 30d', value: '78%', trend: { dir: 'up', label: '6pp' } },
  { label: 'Ganados · 30d', value: '$42,900', color: 'green' },
]

export const TOPBAR_STATS = [
  { label: 'Tarjetas', value: '17' },
  { label: 'Real', value: '$28,350' },
  { label: 'Estancadas', value: '2', tone: 'amber' },
]

export const PIPELINES = [
  { id: 'monte-sinai', name: 'Monte Sinaí', color: '#1AAB99' },
  { id: 'activz', name: 'Activz · Consumo', color: '#F79009' },
  { id: 'tere', name: 'Tere Guillén', color: '#9E77ED' },
]

export const USER = { name: 'Agustín Lozano', role: 'Admin · Flow Hub' }
