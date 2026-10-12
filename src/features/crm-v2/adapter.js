/* Traduce un lead de Firestore a la tarjeta del board nuevo.
 *
 * Regla que se respeta en todo el archivo: si un dato no existe, el campo se
 * deja vacío y la tarjeta no lo dibuja. Nada se inventa — una tarjeta que
 * miente es peor que una tarjeta incompleta.
 *
 * Lo que todavía no se puede calcular y por eso queda afuera:
 *   scoreTrend  → no hay histórico de score (ver BACKEND-CHANGES-NEEDED.md)
 *   potential   → no existe el concepto de valor potencial en los leads
 */
import { maturityFromScore, MATURITY } from './maturity'

const HORAS = 36e5
const DIAS = 864e5

// Umbral para marcar una tarjeta como estancada. Es el default del briefing;
// cuando se pueda configurar por pipeline, sale de ahí.
const ROTTING_HORAS = 48

const CANAL = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
  facebook: 'Facebook', meta_ads: 'Meta Ads', web: 'Web',
  linkedin: 'LinkedIn', manual: 'Manual',
}

/** Las tres columnas se deducen de lo que ya está guardado. No hay migración:
 *  es una regla de lectura sobre systemStage. */
export function columnOf(lead) {
  const s = lead.systemStage
  if (!s || s === 'cold') return 'calentamiento'
  if (s === 'handoff') return 'handoff'
  return 'cierre'
}

/** Antes del cierre el color lo da el score. En Cierre lo da si quedó algo
 *  abierto: si todavía hay una oportunidad viva es cierre parcial, y solo
 *  cuando no queda ninguna es cierre total. Es la diferencia entre haberle
 *  vendido la consulta y haberle vendido además la cirugía. */
export function maturityOf(lead, thresholds) {
  const col = columnOf(lead)
  if (col === 'cierre') {
    const stats = lead.opportunityStats
    // Sin oportunidades cargadas se cae al dato viejo: un lead cerrado es
    // cierre total, cualquier otro es parcial.
    if (!stats || !stats.total) {
      return lead.systemStage === 'closed' ? MATURITY.c2 : MATURITY.c1
    }
    return stats.open > 0 ? MATURITY.c1 : MATURITY.c2
  }
  if (col === 'handoff') return MATURITY.m4
  return maturityFromScore(lead.score || 0, thresholds)
}

const ts = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null)

function relativo(date) {
  if (!date) return ''
  const ms = Date.now() - date.getTime()
  if (ms < HORAS) return `${Math.max(1, Math.round(ms / 6e4))}m`
  if (ms < DIAS) return `${Math.round(ms / HORAS)}h`
  return `${Math.round(ms / DIAS)}d`
}

/** La próxima acción no es un campo: se deduce del estado real del lead.
 *  El orden importa — lo más urgente primero. */
function nextActionOf(lead, proximaCita) {
  if (proximaCita) {
    const d = ts(proximaCita.scheduledAt)
    const hoy = d && d.toDateString() === new Date().toDateString()
    return {
      text: hoy ? `Cita hoy ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : 'Cita agendada',
      icon: 'calendar',
      tone: hoy ? 'today' : undefined,
    }
  }
  if (lead.systemStage === 'handoff') {
    return { text: 'Listo para llamada', icon: 'call', tone: 'today' }
  }
  if (lead.systemStage === 'secure_opportunity' && lead.paymentDate) {
    const vencido = new Date(lead.paymentDate) < new Date()
    return {
      text: vencido ? 'Pago vencido' : 'Esperando pago',
      icon: vencido ? 'alert' : 'clock',
      tone: vencido ? 'overdue' : undefined,
    }
  }
  if (lead.systemStage === 'open_opportunity') {
    // Es justo lo que define a esta etapa: hubo llamada pero nadie fijó fecha.
    return { text: 'Falta fecha de pago', icon: 'clock', tone: 'today' }
  }
  if (lead.systemStage === 'closed') return { text: 'Venta cerrada', icon: 'check' }

  const ultimo = ts(lead.lastMessageAt)
  if (lead.hasUnread) return { text: 'Sin responder', icon: 'alert', tone: 'overdue' }
  if (ultimo && Date.now() - ultimo.getTime() > ROTTING_HORAS * HORAS) {
    return { text: `Sin respuesta ${relativo(ultimo)}`, icon: 'alert', tone: 'overdue' }
  }
  return { text: 'Esperando respuesta', icon: 'clock' }
}

/**
 * @param lead          documento de Firestore
 * @param members       equipo, para resolver a quién está asignado
 * @param citasDelLead  citas futuras de ese lead, ya ordenadas
 */
export function toCard(lead, { members = [], citasDelLead = [], products = [] } = {}) {
  const asignado = lead.assignedTo
    ? members.find(m => m.id === lead.assignedTo || m.uid === lead.assignedTo)
    : null
  const ultimo = ts(lead.lastMessageAt)
  const proximaCita = citasDelLead.find(a => ['pending', 'scheduled'].includes(a.status))
  // El monto de la tarjeta es el precio de este producto; sin el nombre, el
  // número no dice de qué es.
  const stats = lead.opportunityStats
  const producto = lead.closedProduct?.name
    || (lead.productId ? products.find(p => p.id === lead.productId)?.name : null)

  const canal = CANAL[lead.lastMessageChannel] || CANAL[lead.source] || ''
  const cuando = relativo(ultimo || ts(lead.createdAt))

  return {
    id: lead.id,
    name: [lead.name, lead.lastName].filter(Boolean).join(' ') || 'Sin nombre',
    sub: [canal, cuando && `hace ${cuando}`].filter(Boolean).join(' · '),
    // Real es la oportunidad de entrada —la cita, la consulta— y potencial es
    // lo que viene detrás por el problema que contó. No es vendido contra no
    // vendido: en calentamiento todavía no se vendió nada.
    amount: stats?.total
      ? (stats.valueReal || 0)
      : (lead.systemStage === 'closed'
          ? (lead.closedProduct?.price || lead.value || 0)
          : (lead.value || 0)),
    potential: stats?.valuePotencial || 0,
    score: lead.score || 0,
    maturity: maturityOf(lead).id,
    // Mientras no haya una persona a cargo, el que atiende es el agente. Pero
    // pasado el handoff eso ya no es cierto: ahí un lead sin asignar no tiene
    // dueño, y poner al bot haría creer que el agente cerró la venta.
    owner: asignado
      ? { name: asignado.name || asignado.email || 'Sin nombre' }
      : (columnOf(lead) === 'calentamiento' ? { name: 'Flowi', bot: true } : null),
    nextAction: nextActionOf(lead, proximaCita),
    tags: [
      producto && { label: producto },
      lead.profileB && { label: 'Perfil B' },
    ].filter(Boolean),
    ageLabel: relativo(ts(lead.createdAt)),
    rotting: !!ultimo && Date.now() - ultimo.getTime() > ROTTING_HORAS * HORAS && columnOf(lead) === 'calentamiento',
    // Para el panel lateral, que muestra el contexto sin volver a Firestore.
    // Solo campos con contenido: el panel los dibuja todos, y una fila vacía
    // ocupa el mismo lugar que una con información.
    lastMessage: lead.lastMessage || '',
    // El Inbox solo lista leads que ya conversaron; sin esto el botón llevaría
    // a una lista donde el lead no aparece.
    hasConversation: !!lead.lastMessageAt,
    channel: canal,
    phone: lead.phone || '',
    email: lead.email || '',
    createdLabel: lead.createdAt ? `Creado hace ${relativo(ts(lead.createdAt))}` : '',
    fields: [
      lead.phone && { label: 'Teléfono', value: lead.phone },
      lead.email && { label: 'Email', value: lead.email },
      lead.company && { label: 'Empresa', value: lead.company },
      producto && { label: 'Producto', value: producto, pill: lead.closedProduct?.name ? 'green' : undefined },
      stats?.open > 0 && { label: 'Abiertas', value: `${stats.open} oportunidad${stats.open === 1 ? '' : 'es'}` },
      lead.paymentDate && { label: 'Fecha de pago', value: lead.paymentDate },
    ].filter(Boolean),
    _lead: lead,
  }
}
