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

/* Horario de atención por día.
 *
 * Cada día tiene sus propios tramos, y pueden ser varios: una clínica que
 * cierra al mediodía tiene dos. Un día sin tramos es un día cerrado.
 *
 * 0 = domingo.
 */
const HORARIO_POR_DEFECTO = {
  porDia: {
    1: [{ desde: '09:00', hasta: '19:00' }],
    2: [{ desde: '09:00', hasta: '19:00' }],
    3: [{ desde: '09:00', hasta: '19:00' }],
    4: [{ desde: '09:00', hasta: '19:00' }],
    5: [{ desde: '09:00', hasta: '19:00' }],
  },
}

/** Acepta el formato viejo —un solo rango para varios días— y lo traduce.
 *  Las organizaciones que ya lo tenían configurado así no se enteran.
 *
 *  Un horario que no se puede leer cae al de por omisión, igual que una
 *  organización sin configurar: son el mismo caso. Antes reventaba, y como el
 *  error subía hasta la herramienta del agente, el agente se quedaba sin saber
 *  la agenda y mandaba al cliente a llamar por teléfono. */
function normalizarHorario(h) {
  if (!h || typeof h !== 'object') return HORARIO_POR_DEFECTO
  if (h.porDia && typeof h.porDia === 'object') return h
  if (!Array.isArray(h.dias)) return HORARIO_POR_DEFECTO
  const tramo = [{ desde: h.desde || '09:00', hasta: h.hasta || '19:00' }]
  return { porDia: Object.fromEntries(h.dias.map(d => [d, tramo])) }
}

/** Los tramos de atención de una fecha, ya como instantes. */
function tramosDeLaFecha(fecha, horario, tz) {
  const h = normalizarHorario(horario)
  const dia = localDe(instanteDesdeLocal(fecha, '12:00', tz), tz).dia
  return (h.porDia?.[dia] || [])
    .filter(t => t?.desde && t?.hasta)
    .map(t => ({
      abre: instanteDesdeLocal(fecha, t.desde, tz),
      cierra: instanteDesdeLocal(fecha, t.hasta, tz),
      texto: `${t.desde} a ${t.hasta}`,
    }))
    .filter(t => t.cierra > t.abre)
    .sort((a, b) => a.abre - b.abre)
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

/** Una fecha como 'YYYY-MM-DD'.
 *
 *  El agente no siempre manda ese formato aunque el esquema lo pida: un ISO
 *  completo ('2026-10-27T10:00:00') reventaba con "Invalid time value", y la
 *  fecha al revés ('27-10-2026') devolvía cero huecos EN SILENCIO — que es
 *  peor, porque el agente le dice al cliente que no hay espacios cuando sí
 *  hay. Lo que de plano no se entiende se rechaza diciendo por qué. */
function normalizarFecha(f) {
  if (f instanceof Date && !isNaN(f)) return f.toISOString().slice(0, 10)
  const s = String(f ?? '').trim()
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  // Día primero: la forma en que se escribe una fecha en México.
  const diaPrimero = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (diaPrimero) return `${diaPrimero[3]}-${diaPrimero[2].padStart(2, '0')}-${diaPrimero[1].padStart(2, '0')}`
  throw new Error(`no entiendo la fecha "${f}": se espera YYYY-MM-DD`)
}

/** Convierte una hora de pared ("2026-10-15 15:00" en Ciudad de México) al
 *  instante real. Se resuelve en dos pasos porque el offset depende de la
 *  fecha, y la fecha depende del offset. */
function instanteDesdeLocal(fechaISO, hhmm, tz) {
  const [a, m, d] = normalizarFecha(fechaISO).split('-').map(Number)
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
function huecosDelDia({ fecha, ocupados = [], duracion = 30, buffer = 0, paso = 0, horario = HORARIO_POR_DEFECTO, tz = 'America/Mexico_City', ahora = new Date() }) {
  const tramos = tramosDeLaFecha(fecha, horario, tz)
  if (!tramos.length) return []

  // Cada cuánto puede empezar una cita. Es propio y no se deduce del buffer:
  // con la agenda vacía no hay razón para ofrecer horarios espaciados.
  const salto = Math.max(5, paso || duracion)
  const libres = []

  for (const tramo of tramos) {
    for (let t = tramo.abre.getTime(); t + duracion * 60000 <= tramo.cierra.getTime(); t += salto * 60000) {
      const inicio = new Date(t)
      const fin = new Date(t + duracion * 60000)
      if (inicio <= ahora) continue // no se ofrece algo que ya pasó

      // El buffer solo pesa contra lo que ya está tomado: es el respiro entre
      // una cita y la siguiente, no una forma de ralear la agenda.
      const chocaCon = ocupados.some(o =>
        solapan(
          new Date(inicio.getTime() - buffer * 60000),
          new Date(fin.getTime() + buffer * 60000),
          o.inicio, o.fin,
        ))
      if (!chocaCon) libres.push({ inicio, fin, hora: localDe(inicio, tz).hora })
    }
  }

  return libres
}

/**
 * ¿Se puede agendar a esta hora exacta?
 *
 * Distinto de pedir que la hora esté en la grilla de huecos. La grilla sirve
 * para OFRECER —son arranques parejos, cómodos de leer— y su paso depende de
 * la duración: con 20 minutos da 11:30 y 12:20, con 30 da 11:00 y 12:00. Si
 * se ofrece con una duración y se valida con otra, una hora recién ofrecida
 * aparece como inexistente.
 *
 * Para validar lo único que importa es si choca con algo.
 */
function estaLibre({ fecha, hora, duracion = 30, buffer = 0, horario = HORARIO_POR_DEFECTO, tz = 'America/Mexico_City', ocupados = [], ahora = new Date() }) {
  const inicio = instanteDesdeLocal(fecha, hora, tz)
  const fin = new Date(inicio.getTime() + duracion * 60000)

  const tramos = tramosDeLaFecha(fecha, horario, tz)
  if (!tramos.length) {
    return { libre: false, motivo: 'ese día no se atiende' }
  }

  // Tiene que entrar completa en UN tramo: una cita no puede empezar antes de
  // cerrar al mediodía y terminar después de reabrir.
  const entra = tramos.some(t => inicio >= t.abre && fin <= t.cierra)
  if (!entra) {
    return {
      libre: false,
      motivo: `está fuera del horario de atención (ese día se atiende de ${tramos.map(t => t.texto).join(' y de ')})`,
    }
  }
  if (inicio <= ahora) {
    return { libre: false, motivo: 'ya pasó' }
  }

  const choca = ocupados.some(o =>
    solapan(new Date(inicio.getTime() - buffer * 60000), new Date(fin.getTime() + buffer * 60000), o.inicio, o.fin))
  if (choca) return { libre: false, motivo: 'se empalma con otra cita' }

  return { libre: true }
}

module.exports = {
  HORARIO_POR_DEFECTO,
  normalizarHorario,
  tramosDeLaFecha,
  estaLibre,
  offsetMinutos,
  instanteDesdeLocal,
  localDe,
  huecosDelDia,
  normalizarFecha,
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
    // La interfaz crea las citas como 'pending' y el agente las creaba como
    // 'scheduled': filtrar por uno solo dejaba la mitad de la agenda invisible
    // y el agente podía agendar encima de una cita cargada a mano.
    .filter(a => ['pending', 'scheduled'].includes(a.status))
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
    // Respiro entre una cita y la siguiente.
    buffer: Number.isFinite(agente.meetingBuffer) ? agente.meetingBuffer : 15,
    // Cada cuánto puede empezar una cita. Sin configurar, cada 30 minutos.
    paso: Number.isFinite(agente.slotStep) ? agente.slotStep : 30,
    /* Cuánto dura una cita.
     *
     * Antes no se configuraba en ningún lado: el modelo la mandaba en cada
     * llamada o, si no la mandaba, la agenda asumía 30. A un consultorio de
     * consultas de 20 minutos eso le borraba los huecos de en medio —cada
     * cita pedía 60 minutos limpios en vez de 50, y un espacio de una hora
     * entre dos compromisos dejaba de servir— y encima cambiaba de un mensaje
     * al otro según lo que el modelo decidiera mandar. */
    duracion: Number.isFinite(agente.meetingDuration) ? agente.meetingDuration : 30,
    horario: normalizarHorario(agente.workingHours),
  }
}

/**
 * Huecos reales de un día, cruzando las tres fuentes.
 * @returns { slots: [{inicio, fin, hora}], tz, buffer, horario }
 */
/** Lo ocupado de ese día, de las dos fuentes. Se separa de `disponibilidad`
 *  porque validar una hora puntual necesita lo mismo pero sin la grilla. */
async function ocupadosDelDia(db, orgId, fecha) {
  const desde = new Date(`${normalizarFecha(fecha)}T00:00:00Z`)
  const hasta = new Date(desde.getTime() + 48 * 36e5)
  const ventanaDesde = new Date(desde.getTime() - 24 * 36e5)
  const [citas, google] = await Promise.all([
    ocupadoEnFlowHub(db, orgId, ventanaDesde, hasta),
    ocupadoEnGoogle(db, orgId, ventanaDesde, hasta),
  ])
  return [...citas, ...google]
}

/** Valida una hora concreta contra la agenda real. */
async function puedeAgendar(db, orgId, { fecha, hora, duracion }) {
  const cfg = await configDeAgenda(db, orgId)
  const { tz, buffer, horario } = cfg
  const dura = Number.isFinite(duracion) ? duracion : cfg.duracion
  const ocupados = await ocupadosDelDia(db, orgId, fecha)
  // El paso no entra acá: valida una hora concreta, no propone.
  return { ...estaLibre({ fecha, hora, duracion: dura, buffer, horario, tz, ocupados }), tz }
}

async function disponibilidad(db, orgId, { fecha, duracion }) {
  const cfg = await configDeAgenda(db, orgId)
  const { tz, buffer, paso, horario } = cfg
  // Quien llama puede pedir otra duración —un estudio largo, una cirugía—,
  // pero lo normal es que no mande nada y que gobierne la configuración.
  duracion = Number.isFinite(duracion) ? duracion : cfg.duracion

  // Se pide el día entero en UTC para no perder citas por el corrimiento.
  const desde = new Date(`${normalizarFecha(fecha)}T00:00:00Z`)
  const hasta = new Date(desde.getTime() + 48 * 36e5)

  const [citas, google] = await Promise.all([
    ocupadoEnFlowHub(db, orgId, new Date(desde.getTime() - 24 * 36e5), hasta),
    ocupadoEnGoogle(db, orgId, new Date(desde.getTime() - 24 * 36e5), hasta),
  ])

  const slots = huecosDelDia({
    fecha, duracion, buffer, paso, horario, tz,
    ocupados: [...citas, ...google],
  })

  /* Por qué quedó así.
   *
   * Un día sin huecos es indistinguible de un día cerrado, de un calendario
   * de Google lleno y de un buffer demasiado grande — y el agente le dice lo
   * mismo al cliente en los cuatro casos. Sin esta línea hay que deducirlo
   * cruzando logs a mano, que fue justo lo que costó horas. */
  const tramos = tramosDeLaFecha(fecha, horario, tz)
  console.log(
    `[agenda] ${fecha} · ${tz} · ` +
    (tramos.length ? `atiende ${tramos.map(t => t.texto).join(' y ')}` : 'DIA CERRADO') +
    ` · cita ${duracion}min + buffer ${buffer}min (necesita ${duracion + buffer * 2} libres)` +
    ` · ocupado: Google ${google.length}, FlowHub ${citas.length}` +
    ` · HUECOS: ${slots.length}` +
    (slots.length ? ` (${slots.slice(0, 4).map(x => x.hora).join(', ')}${slots.length > 4 ? '…' : ''})` : ''),
  )

  return { slots, tz, buffer, paso, horario, duracion }
}

module.exports.ocupadosDelDia = ocupadosDelDia
module.exports.puedeAgendar = puedeAgendar
module.exports.ocupadoEnGoogle = ocupadoEnGoogle
module.exports.ocupadoEnFlowHub = ocupadoEnFlowHub
module.exports.configDeAgenda = configDeAgenda
module.exports.disponibilidad = disponibilidad
