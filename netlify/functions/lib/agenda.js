/* Disponibilidad real de la agenda.
 *
 * Mira tres fuentes y las cruza: las citas de FlowHub, lo que ya está ocupado
 * en Google Calendar, y los horarios de atención de la organización. El buffer
 * entre reuniones sale de la configuración del agente — hasta ahora se
 * configuraba en pantalla y no lo leía nadie.
 *
 * Todo el cálculo se hace en la zona horaria de la organización. Si no, un
 * cliente en México pide las 3 de la tarde y el servidor, que corre en UTC,
 * entiende las 9 de la mañana.
 */

const HORARIO_POR_DEFECTO = {
  // 0 = domingo. Lunes a viernes de 9 a 19, que es lo más común y lo que la
  // organización puede cambiar desde la pantalla del agente.
  dias: [1, 2, 3, 4, 5],
  desde: '09:00',
  hasta: '19:00',
}

/** Minutos que la zona horaria está corrida respecto de UTC en ese instante. */
function offsetMinutos(instante, tz) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instante).reduce((acc, p) => (acc[p.type] = p.value, acc), {})

  const comoUTC = Date.UTC(
    Number(partes.year), Number(partes.month) - 1, Number(partes.day),
    Number(partes.hour === '24' ? '00' : partes.hour), Number(partes.minute), Number(partes.second),
  )
  return (comoUTC - instante.getTime()) / 60000
}

/** Convierte una hora de pared ("2026-10-15 15:00" en Ciudad de México) al
 *  instante real. Se resuelve en dos pasos porque el offset depende de la
 *  fecha, y la fecha depende del offset. */
function instanteDesdeLocal(fechaISO, hhmm, tz) {
  const [a, m, d] = fechaISO.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  const tentativo = new Date(Date.UTC(a, m - 1, d, h, min))
  const off1 = offsetMinutos(tentativo, tz)
  const ajustado = new Date(tentativo.getTime() - off1 * 60000)
  const off2 = offsetMinutos(ajustado, tz)
  return off1 === off2 ? ajustado : new Date(tentativo.getTime() - off2 * 60000)
}

/** Día de la semana y hora de pared de un instante, en esa zona. */
function localDe(instante, tz) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(instante).reduce((acc, x) => (acc[x.type] = x.value, acc), {})
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    dia: dias[p.weekday],
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: `${p.hour === '24' ? '00' : p.hora || p.hour}:${p.minute}`,
  }
}

function solapan(aIni, aFin, bIni, bFin) {
  return aIni < bFin && bIni < aFin
}

/**
 * Huecos libres de un día.
 *
 * @param ocupados  [{ inicio: Date, fin: Date }] citas y eventos ya tomados
 * @param fecha     'YYYY-MM-DD' en la zona de la organización
 * @param duracion  minutos que dura la cita a agendar
 * @param buffer    minutos mínimos entre una cita y la siguiente
 */
function huecosDelDia({ fecha, ocupados = [], duracion = 30, buffer = 0, horario = HORARIO_POR_DEFECTO, tz = 'America/Mexico_City', ahora = new Date() }) {
  const inicioJornada = instanteDesdeLocal(fecha, horario.desde || '09:00', tz)
  const finJornada = instanteDesdeLocal(fecha, horario.hasta || '19:00', tz)

  const dias = horario.dias || HORARIO_POR_DEFECTO.dias
  if (!dias.includes(localDe(inicioJornada, tz).dia)) return []

  // El paso es la duración más el buffer: si hay una a las 7:30 y el buffer es
  // de 30, el siguiente arranque posible es a las 8, no a las 7:45.
  const paso = Math.max(5, duracion + buffer)
  const libres = []

  for (let t = inicioJornada.getTime(); t + duracion * 60000 <= finJornada.getTime(); t += paso * 60000) {
    const inicio = new Date(t)
    const fin = new Date(t + duracion * 60000)
    if (inicio <= ahora) continue // no se ofrece algo que ya pasó

    const chocaCon = ocupados.some(o =>
      solapan(
        new Date(inicio.getTime() - buffer * 60000),
        new Date(fin.getTime() + buffer * 60000),
        o.inicio, o.fin,
      ))
    if (!chocaCon) libres.push({ inicio, fin, hora: localDe(inicio, tz).hora })
  }

  return libres
}

module.exports = {
  HORARIO_POR_DEFECTO,
  offsetMinutos,
  instanteDesdeLocal,
  localDe,
  huecosDelDia,
}

/* ── Lectura de las fuentes reales ──────────────────────────────────── */
const admin = require('firebase-admin')

/** Lo que Google ya tiene ocupado en esa franja. Si la organización no conectó
 *  el calendario, devuelve vacío en vez de fallar: la agenda interna sigue
 *  sirviendo. */
async function ocupadoEnGoogle(db, orgId, desde, hasta) {
  let getAccessToken, getCalendarId
  try {
    ({ getAccessToken, getCalendarId } = require('./google'))
  } catch { return [] }

  try {
    const token = await getAccessToken(db, orgId)
    const calendarId = await getCalendarId(db, orgId)
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: desde.toISOString(),
        timeMax: hasta.toISOString(),
        items: [{ id: calendarId }],
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const cal = data.calendars?.[calendarId] || Object.values(data.calendars || {})[0]
    return (cal?.busy || []).map(b => ({ inicio: new Date(b.start), fin: new Date(b.end) }))
  } catch (e) {
    // Calendario no conectado o token vencido: no es motivo para no agendar.
    console.warn('[agenda] Google no disponible:', e.message)
    return []
  }
}

/** Citas de FlowHub de ese día que siguen en pie. */
async function ocupadoEnFlowHub(db, orgId, desde, hasta) {
  const snap = await db.collection('organizations').doc(orgId).collection('appointments')
    .where('scheduledAt', '>=', admin.firestore.Timestamp.fromDate(desde))
    .where('scheduledAt', '<=', admin.firestore.Timestamp.fromDate(hasta))
    .get()

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.status === 'scheduled')
    .map(a => {
      const inicio = a.scheduledAt.toDate()
      return { inicio, fin: new Date(inicio.getTime() + (a.duration || 30) * 60000) }
    })
}

/** Configuración que afecta a la agenda: zona horaria, buffer y horarios. */
async function configDeAgenda(db, orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const [orgSnap, agentSnap] = await Promise.all([
    orgRef.get(),
    orgRef.collection('settings').doc('agent').get(),
  ])
  const agente = agentSnap.data() || {}
  return {
    tz: orgSnap.data()?.timezone || 'America/Mexico_City',
    buffer: Number.isFinite(agente.meetingBuffer) ? agente.meetingBuffer : 30,
    horario: agente.workingHours || HORARIO_POR_DEFECTO,
  }
}

/**
 * Huecos reales de un día, cruzando las tres fuentes.
 * @returns { slots: [{inicio, fin, hora}], tz, buffer, horario }
 */
async function disponibilidad(db, orgId, { fecha, duracion = 30 }) {
  const { tz, buffer, horario } = await configDeAgenda(db, orgId)

  // Se pide el día entero en UTC para no perder citas por el corrimiento.
  const desde = new Date(`${fecha}T00:00:00Z`)
  const hasta = new Date(desde.getTime() + 48 * 36e5)

  const [citas, google] = await Promise.all([
    ocupadoEnFlowHub(db, orgId, new Date(desde.getTime() - 24 * 36e5), hasta),
    ocupadoEnGoogle(db, orgId, new Date(desde.getTime() - 24 * 36e5), hasta),
  ])

  const slots = huecosDelDia({
    fecha, duracion, buffer, horario, tz,
    ocupados: [...citas, ...google],
  })
  return { slots, tz, buffer, horario }
}

module.exports.ocupadoEnGoogle = ocupadoEnGoogle
module.exports.ocupadoEnFlowHub = ocupadoEnFlowHub
module.exports.configDeAgenda = configDeAgenda
module.exports.disponibilidad = disponibilidad
