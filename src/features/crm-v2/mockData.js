/* Datos de ejemplo para la vista de preview de componentes.
 * NO se conectan a Firestore: la Fase 3 es la que reemplaza esto por queries
 * reales. Modelado sobre el caso de Monte Sinaí. */

export const dealNormal = {
  id: 'd1',
  name: 'Tere Guillén',
  sub: 'WhatsApp · Angiografía',
  amount: 3500,
  currency: 'MXN',
  score: 78,
  scoreTrend: 'up',
  owner: { name: 'Tere Guillén', bot: false },
  nextAction: { text: 'Confirmar día y hora', tone: 'today', icon: 'calendar' },
  tags: [{ label: 'Flujo B · prescrito', tone: 'purple' }],
  ageLabel: '1d',
  hot: true,
}

export const dealBot = {
  id: 'd2',
  name: 'María González',
  sub: 'WhatsApp · hace 12 min',
  amount: 1200,
  score: 52,
  owner: { name: 'Flowi', bot: true },
  nextAction: { text: 'Esperando respuesta a saludo', tone: null, icon: 'clock' },
}

export const dealRotting = {
  id: 'd3',
  name: 'Carla Robles',
  sub: 'WhatsApp · hace 2h',
  amount: 1200,
  score: 48,
  scoreTrend: 'down',
  owner: { name: 'Flowi', bot: true },
  nextAction: { text: 'Sin respuesta 2h', tone: 'overdue', icon: 'alert' },
  rotting: true,
}

export const dealAi = {
  id: 'd4',
  name: 'Sofía Ramírez',
  sub: 'WhatsApp · Prelasik',
  amount: 2150,
  score: 81,
  scoreTrend: 'up',
  owner: { name: 'Sofía Ramírez', bot: false },
  nextAction: { text: 'Verificar slot vie 11am', tone: 'today', icon: 'calendar' },
  aiBadge: 'IA sugiere llamar',
}

export const dealWon = {
  id: 'd5',
  name: 'José Treviño',
  sub: 'Cita vie 11:00am',
  amount: 1200,
  score: 88,
  won: true,
  owner: { name: 'José Treviño', bot: false },
  nextAction: { text: 'Confirmada', tone: null, icon: 'check' },
}

export const columnMetrics = [
  { label: 'Deals', value: '12' },
  { label: 'Valor', value: '$14,400' },
  { label: 'Edad prom', value: '0.4d' },
]

export const handoffMetrics = [
  { label: 'Deals', value: '2' },
  { label: 'Valor', value: '$3,100' },
  { label: 'Pendiente', value: '1h', tone: 'amber' },
]

export const railStages = [
  { id: 'open', count: 7, value: 24800, sub: 'Edad prom: 3.2d' },
  { id: 'safe', count: 4, value: 18400, sub: 'Edad prom: 1.8d' },
  { id: 'won', count: 22, value: 42900, sub: '+$12K esta semana', subTone: 'pos' },
  { id: 'dropped', count: 4, value: 6100, sub: 'Motivo prom: precio' },
  { id: 'closed', count: 15, value: 28300, sub: 'Últimos 30 días' },
]

export const railEmpty = [
  { id: 'open', count: 0, value: 0, sub: 'Sin deals' },
  { id: 'safe', count: 0, value: 0, sub: 'Sin deals' },
  { id: 'won', count: 0, value: 0, sub: 'Sin deals' },
  { id: 'dropped', count: 0, value: 0, sub: 'Sin deals' },
  { id: 'closed', count: 0, value: 0, sub: 'Sin deals' },
]

export const insights = [
  { label: 'Agendadas esta semana', value: '17', trend: { dir: 'up', label: '23%' } },
  { label: 'Tasa de conversión', value: '42%', trend: { dir: 'up', label: '4pp' } },
  { label: 'Tiempo prom. de cierre', value: '2.4d', trend: { dir: 'down', label: '0.6d' } },
  { label: 'Valor ponderado', value: '$94,300' },
  { label: 'Ganados · 30d', value: '$142,800', color: 'green' },
]

export const insightsAlert = [
  { label: 'Agendadas esta semana', value: '3', trend: { dir: 'down', label: '71%' } },
  { label: 'Tasa de conversión', value: '11%', trend: { dir: 'down', label: '18pp' } },
  { label: 'Estancados', value: '14', color: 'red' },
  { label: 'Valor ponderado', value: '$12,100' },
  { label: 'Ganados · 30d', value: '$8,400', color: 'green' },
]

export const panelDeal = {
  ...dealNormal,
  stageName: 'Intención identificada',
  stageColor: 'var(--stage-2)',
  service: 'Angiografía + OCT Macular',
  channel: 'WhatsApp',
  createdLabel: 'Creado hace 1d 4h',
  owner: { name: 'Flowi (bot)', bot: true },
  nextActionLabel: 'Confirmar hoy',
  scoreTone: 'hot',
  scoreDelta: 12,
  counts: { timeline: 24, notas: 2, archivos: 1 },
  aiInsight: 'Tere ya aceptó el precio y trae prescripción. Falta <strong>confirmar día y hora</strong>. Dado que su médico le pidió el estudio esta semana, sugiero proponerle <strong>viernes 11:00 AM</strong>.',
  scoreFactors: [
    { text: 'Trae prescripción médica (Flujo B)', value: 20 },
    { text: 'Especifica estudio por nombre', value: 15 },
    { text: 'Preguntó por disponibilidad esta semana', value: 10 },
    { text: 'Confirma rango de edad del perfil (45-65)', value: 8 },
    { text: 'Aún no confirma día concreto', value: -5 },
  ],
  fields: [
    { label: 'Flujo', value: 'Flujo B · estudio prescrito' },
    { label: 'Servicio', value: 'Angiografía + OCT Macular' },
    { label: 'Requisitos previos', value: '4h ayuno · acompañante · lentes oscuros' },
    { label: 'Prescripción', value: 'Recibida', pill: 'green' },
    { label: 'Origen', value: 'WhatsApp Business' },
  ],
  timeline: [
    {
      type: 'ai', channel: '⚡ IA · Scoring actualizado', color: 'purple', time: 'Hace 15 min',
      body: 'Score subió de <strong>66 → 78</strong> tras confirmar prescripción médica.',
    },
    {
      type: 'whatsapp', channel: 'WhatsApp', time: 'Hace 32 min',
      body: '<strong>Tere:</strong> "Sí, tengo la indicación del Dr. Reyes. ¿Me pueden atender esta semana?"',
    },
    {
      type: 'stage', channel: 'Movimiento de etapa', color: 'teal', time: 'Hace 1d 2h',
      body: 'Avanzó de <strong>Nuevo</strong> → <strong>Intención identificada</strong>.',
    },
  ],
}

export const panelDealEmpty = {
  id: 'empty',
  name: 'Juan Pérez',
  stageName: 'Nuevo',
  stageColor: 'var(--stage-1)',
  service: 'Sin servicio identificado',
  channel: 'Instagram',
  createdLabel: 'Creado hace 4 min',
  amount: 0,
  score: 12,
  scoreTone: 'cold',
  owner: { name: 'Flowi', bot: true },
  counts: { timeline: 1, notas: 0, archivos: 0 },
}

export const pipelines = [
  { id: 'monte-sinai', name: 'Monte Sinaí', color: '#1AAB99' },
  { id: 'activz', name: 'Activz · Consumo', color: '#F79009' },
  { id: 'tere', name: 'Tere Guillén', color: '#9E77ED' },
]

export const topbarStats = [
  { label: 'Deals activos', value: '34' },
  { label: 'Valor real', value: '$187,400' },
  { label: 'Potencial', value: '$412,000', tone: 'purple' },
  { label: 'Estancados', value: '4', tone: 'amber' },
]

/* Una tarjeta por nivel de madurez, para ver la escala completa de un vistazo. */
export const maturityCards = [
  { id: 'c1', maturity: 'm1', levelLabel: 'Nuevo (0-25)', name: 'María González', sub: 'WhatsApp · hace 12 min',
    amount: 1200, score: 18, owner: { name: 'Flowi', bot: true },
    nextAction: { text: 'Esperando respuesta a saludo', icon: 'clock' } },
  { id: 'c2', maturity: 'm2', levelLabel: 'Avanzando (26-50)', name: 'Carla Robles', sub: 'WhatsApp · Consulta',
    amount: 1200, score: 44, potential: 12000, owner: { name: 'Flowi', bot: true },
    nextAction: { text: 'Confirmar motivo de consulta', icon: 'clock' }, ageLabel: '2d' },
  { id: 'c3', maturity: 'm3', levelLabel: 'Maduro (51-75)', name: 'Tere Guillén', sub: 'WhatsApp · Angiografía',
    amount: 3500, score: 68, scoreTrend: 'up', potential: 18000, owner: { name: 'Tere Guillén' },
    nextAction: { text: 'Confirmar día y hora', tone: 'today', icon: 'calendar' },
    tags: [{ label: 'Prescrito' }], ageLabel: '1d' },
  { id: 'c4', maturity: 'm4', levelLabel: 'Listo · handoff (76+)', name: 'Jorge Tamez', sub: 'WhatsApp · Urgencia',
    amount: 1900, score: 95, scoreTrend: 'up', potential: 32000, owner: { name: 'Mario Ruiz' },
    nextAction: { text: 'Llamar para confirmar', tone: 'today', icon: 'call' }, ageLabel: '3h' },
]

export const closingCards = [
  { id: 'cc1', maturity: 'c1', name: 'José Treviño', sub: 'Asistió · vie 11:00am',
    amount: 1200, score: 88, potential: 24000, owner: { name: 'José Treviño' },
    nextAction: { text: '2 oportunidades abiertas', icon: 'check' }, tags: [{ label: 'Cierre parcial' }] },
  { id: 'cc2', maturity: 'c2', name: 'Elena Martínez', sub: 'Cerrada · sáb 10:30am',
    amount: 3500, score: 91, owner: { name: 'Elena Martínez' },
    nextAction: { text: 'Todo cerrado', icon: 'check' }, tags: [{ label: 'Cierre total' }] },
]

export const peekDeal = {
  ...maturityCards[2],
  lastMessage: '"Sí, tengo la indicación del Dr. Reyes. ¿Me pueden atender esta semana?"',
}

export const opportunities = [
  { id: 'o1', name: 'Angiografía + OCT macular', value: 3500, probability: 'alta', status: 'abierta', auto: true, reason: 'Detectada por "me mandaron a hacer un estudio de retina"' },
  { id: 'o2', name: 'Cirugía de catarata · ojo derecho', value: 24000, probability: 'media', status: 'abierta', auto: true, reason: 'Detectada por "veo nublado de un ojo"' },
  { id: 'o3', name: 'Lentes intraoculares premium', value: 18000, probability: 'baja', status: 'abierta' },
  { id: 'o4', name: 'Consulta de valoración', value: 1200, probability: 'alta', status: 'ganada' },
  { id: 'o5', name: 'Tratamiento de ojo seco', value: 4800, probability: 'baja', status: 'descartada' },
]

export const appointments = [
  { id: 'a1', name: 'José Treviño', hour: '9:30', ampm: 'AM', type: 'presencial', status: 'confirmada',
    location: 'Sede Centro', requirements: '4h ayuno · acompañante · lentes oscuros', reason: 'Angiografía' },
  { id: 'a2', name: 'Elena Martínez', hour: '10:30', ampm: 'AM', type: 'video', status: 'pendiente', reason: 'Seguimiento posoperatorio' },
  { id: 'a3', name: 'Alejandro Garza', hour: '11:00', ampm: 'AM', type: 'llamada', status: 'curso', reason: 'Resultados' },
  { id: 'a4', name: 'Lupita Flores', hour: '11:30', ampm: 'AM', type: 'presencial', status: 'confirmada',
    location: 'Sede Valle', reason: 'Consulta', lateMinutes: 18 },
  { id: 'a5', name: 'Miguel Ortega', hour: '12:00', ampm: 'PM', type: 'presencial', status: 'confirmada',
    location: 'Sede Centro', reason: 'Campimetría', lateMinutes: 34 },
  { id: 'a6', name: 'Patricia Núñez', hour: '1:00', ampm: 'PM', type: 'presencial', status: 'asistio', location: 'Sede Centro' },
  { id: 'a7', name: 'Juan Pérez', hour: '2:00', ampm: 'PM', type: 'presencial', status: 'noshow', location: 'Sede Centro' },
]

export const conversations = [
  { id: 'v1', name: 'Jorge Tamez', time: '3h', unread: true, paused: false,
    last: 'Desde ayer veo manchas negras y destellos.',
    thread: [
      { who: 'in', text: 'Hola, buenas tardes. Necesito una cita urgente.' },
      { who: 'bot', text: '¡Hola! Con gusto te ayudo. ¿Me cuentas qué molestia tienes?' },
      { who: 'in', text: 'Desde ayer veo manchas negras y destellos.' },
      { who: 'bot', text: 'Entiendo, y lo que describes necesita valoración pronta. Déjame pasarte con recepción ahora mismo para darte el espacio más cercano.' },
    ] },
  { id: 'v2', name: 'Rocío Benavides', time: '1h', unread: true, paused: true,
    last: '¿Me pueden marcar? Prefiero explicarlo por teléfono.',
    thread: [
      { who: 'in', text: 'Buenas, quería preguntar por una consulta.' },
      { who: 'bot', text: '¡Claro! ¿Qué molestia te trae por aquí?' },
      { who: 'in', text: '¿Me pueden marcar? Prefiero explicarlo por teléfono.' },
      { who: 'human', text: 'Hola Rocío, soy Lucía de Monte Sinaí. Te marco en 20 minutos, ¿te queda bien?' },
    ] },
  { id: 'v3', name: 'Tere Guillén', time: '32m', unread: false, paused: false,
    last: 'Sí, tengo la indicación del Dr. Reyes.',
    thread: [
      { who: 'bot', text: 'El estudio cuesta $3,500 MXN. Requiere 4 horas de ayuno y venir acompañada. ¿Tienes la indicación de tu médico?' },
      { who: 'in', text: 'Sí, tengo la indicación del Dr. Reyes. ¿Me atienden esta semana?' },
    ] },
  { id: 'v4', name: 'Carla Robles', time: '2d', unread: false, paused: false,
    last: 'Déjame checarlo y te aviso.',
    thread: [
      { who: 'bot', text: 'La consulta de valoración son $1,200 MXN. ¿Te agendo esta semana?' },
      { who: 'in', text: 'Déjame checarlo y te aviso.' },
    ] },
]
