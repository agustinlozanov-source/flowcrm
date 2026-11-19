/* El Scorecard: los números duros.
 *
 * Todo lo que aquí se calcula sale de lo que pasó —leads, citas, actividades,
 * oportunidades, mensajes— y nada se teclea. Ni el dueño de la cuenta ni
 * FlowHub escriben un porcentaje: se recalcula desde los hechos, con las
 * reglas de este archivo, que están descritas en la vista del Método.
 *
 * No toca la base ni la red. Recibe todo ya leído y con las fechas en
 * milisegundos, y devuelve números. Así se prueba entero con datos inventados.
 */

const DIA = 864e5
const HORA = 36e5

/* Versión del método. Si cambia una regla de cálculo, sube este número: dos
 * reportes con versiones distintas no se comparan como si fueran iguales. */
const VERSION_METODO = 2

const ETAPAS_DE_CIERRE = ['open_opportunity', 'secure_opportunity', 'closed']
const ROL_CLIENTE = ['user']
const ROL_AGENTE_IA = ['assistant', 'bot']
const ROL_PERSONA = ['agent', 'admin']

const en = (t, desde, hasta) => t > 0 && t >= desde && t <= hasta
const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null)
const mediana = (xs) => {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}
const promedio = (xs) => {
  const v = xs.filter(Number.isFinite)
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
}

/* ── Índices ────────────────────────────────────────────────────────── */

function agrupar(lista, clave) {
  const m = new Map()
  for (const x of lista) {
    const k = x[clave]
    if (!k) continue
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(x)
  }
  return m
}

/** Lo que se sabe de cada lead, ya cruzado: sus citas, actividades y oportunidades. */
function indexar({ leads = [], citas = [], actividades = [], oportunidades = [] }) {
  const citasDe = agrupar(citas, 'leadId')
  const actsDe = agrupar(actividades, 'leadId')
  const oppsDe = agrupar(oportunidades, 'leadId')
  const porId = new Map(leads.map(l => [l.id, l]))
  return { porId, citasDe, actsDe, oppsDe }
}

/* Una actividad cuenta como contacto cuando la hizo una persona y ya ocurrió.
 * Las automáticas —el rescate de 24 horas— no cuentan: lo que la bolsa mide
 * es si alguien de carne y hueso se ocupó. Las pendientes tampoco: una
 * llamada agendada no es una llamada hecha. */
const esContactoHumano = (a) => a.estado === 'hecha' && !a.automatica
const momentoActividad = (a) => a.occurredAt || a.createdAt || 0

/* ── Los pasos del embudo ───────────────────────────────────────────── */

/* Los orígenes que no vienen de una conversación: alguien dio de alta el lead
 * a mano o lo importó. Todo lo demás —WhatsApp, Instagram, Messenger, un
 * formulario— es contacto. */
const SIN_CONTACTO_PROPIO = ['manual', 'import', 'importado', 'importacion', 'csv']

/* Qué tan lejos llegó un lead.
 *
 * Una oportunidad abierta NO cuenta como propuesta ni como handoff: el agente
 * abre oportunidades solo, en cuanto detecta qué producto le interesa al lead.
 * Eso es interés detectado, y se cuenta aparte. Contarlo como avance infló el
 * embudo de la primera corrida real a más de 100%.
 *
 * El contacto no se mide solo con lastInboundAt, que se guarda desde hace poco
 * y dejaba fuera a los leads viejos: también cuenta el origen del lead y
 * cualquier paso posterior, porque nadie agenda sin haber tenido contacto. */
function pasosDe(lead, ix, ahora) {
  const citas = ix.citasDe.get(lead.id) || []
  const opps = ix.oppsDe.get(lead.id) || []
  const ss = lead.systemStage || null

  const venta = ss === 'closed' || opps.some(o => o.status === 'ganada')
  const cierre = venta || ETAPAS_DE_CIERRE.includes(ss)
  const agendo = citas.length > 0
  const asistio = citas.some(c => c.status === 'completed')
  const citaPasada = citas.some(c => c.scheduledAt && c.scheduledAt <= ahora)
  const handoff = Boolean(lead.handoffAt) || ss === 'handoff' || cierre || agendo
  const origenConContacto = lead.source
    ? !SIN_CONTACTO_PROPIO.includes(String(lead.source).toLowerCase())
    : Boolean(lead.lastMessageAt)
  const contacto = Boolean(lead.lastInboundAt) || origenConContacto || handoff
  const interes = opps.length > 0

  return { contacto, interes, handoff, agendo, citaPasada, asistio, cierre, venta }
}

const PASOS = [
  { id: 'entraron', nombre: 'Entraron' },
  { id: 'contacto', nombre: 'Tuvieron contacto' },
  { id: 'handoff', nombre: 'Llegaron a Handoff' },
  { id: 'agendo', nombre: 'Agendaron' },
  { id: 'asistio', nombre: 'Asistieron' },
  { id: 'cierre', nombre: 'Pasaron a Cierre' },
  { id: 'venta', nombre: 'Compraron' },
]

/* La cadena de un grupo de leads.
 *
 * Cada paso trae su conteo completo —cuántos llegaron, por cualquier
 * camino— y una tasa que se mide SOLO entre quienes llegaron al paso
 * anterior. Así la tasa nunca pasa de 100%, y el conteo no esconde a quien
 * llegó saltándose un paso, como el que compró sin cita registrada.
 *
 * La asistencia se mide contra quienes ya tuvieron su cita, no contra todos
 * los que agendaron: una cita de la semana que viene no es una falta. */
function cadenaDe(leads, ix, ahora) {
  const marcas = leads.map(l => pasosDe(l, ix, ahora))
  const entraron = leads.length
  const cuenta = (f) => marcas.filter(f).length

  const pasos = PASOS.map((p, i) => {
    if (i === 0) return { ...p, valor: entraron, deLaGeneracion: entraron ? 100 : null, tasa: null, base: null }
    const anterior = PASOS[i - 1].id
    const enAnterior = anterior === 'entraron' ? () => true : (m) => m[anterior]
    const valor = cuenta(m => m[p.id])
    const base = p.id === 'asistio'
      ? cuenta(m => m.agendo && m.citaPasada)
      : cuenta(enAnterior)
    const avanzaron = p.id === 'asistio'
      ? cuenta(m => m.agendo && m.citaPasada && m.asistio)
      : cuenta(m => enAnterior(m) && m[p.id])
    return { ...p, valor, deLaGeneracion: pct(valor, entraron), base, tasa: pct(avanzaron, base) }
  })

  return {
    pasos,
    puntaAPunta: pct(cuenta(m => m.venta), entraron),
    interesDetectado: cuenta(m => m.interes),
    ventasSinAsistencia: cuenta(m => m.venta && !m.asistio),
    citasPorOcurrir: cuenta(m => m.agendo && !m.citaPasada),
    descartados: leads.filter(l => l.discarded).length,
  }
}

/** La cadena por embudo y en total, para la generación de leads del periodo y la anterior. */
function conversiones({ leads, pipelines, desde, hasta, ahora, ix }) {
  const duracion = hasta - desde
  const cohorte = leads.filter(l => en(l.createdAt, desde, hasta))
  const anterior = leads.filter(l => en(l.createdAt, desde - duracion - 1, desde - 1))

  const porEmbudo = pipelines.map(p => {
    const actual = cadenaDe(cohorte.filter(l => l.pipelineId === p.id), ix, ahora)
    const previo = cadenaDe(anterior.filter(l => l.pipelineId === p.id), ix, ahora)
    return { pipelineId: p.id, nombre: p.name, actual, previo }
  }).filter(e => e.actual.pasos[0].valor > 0 || e.previo.pasos[0].valor > 0)

  const sinEmbudo = cohorte.filter(l => !l.pipelineId)
  return {
    total: { actual: cadenaDe(cohorte, ix, ahora), previo: cadenaDe(anterior, ix, ahora) },
    porEmbudo,
    sinEmbudo: sinEmbudo.length,
    motivosDeDescarte: contar(cohorte.filter(l => l.discarded), l => l.discardCategory || 'sin_motivo'),
  }
}

/* ── Las etapas, hoy ────────────────────────────────────────────────── */

const ATORADO_DIAS = 7

/* Una foto de cómo está el embudo hoy: cuánta gente hay en cada etapa, con
 * qué score y desde cuándo nadie la mueve.
 *
 * «Sin movimiento» se mide con el último mensaje o la última modificación del
 * lead, lo que sea más reciente. El sistema todavía no guarda cuándo entró
 * cada lead a cada etapa, así que este es el mejor reloj disponible y la vista
 * del Método lo dice. */
function etapas({ leads, pipelines, stages, ahora }) {
  const vivos = leads.filter(l => !l.discarded)
  const quieto = (l) => (ahora - Math.max(l.lastMessageAt || 0, l.updatedAt || 0, l.createdAt || 0)) / DIA

  const resumen = (grupo) => {
    const dias = grupo.map(quieto)
    return {
      personas: grupo.length,
      scorePromedio: promedio(grupo.map(l => Number(l.score) || 0)),
      scoreMin: grupo.length ? Math.min(...grupo.map(l => Number(l.score) || 0)) : null,
      scoreMax: grupo.length ? Math.max(...grupo.map(l => Number(l.score) || 0)) : null,
      diasSinMovimiento: mediana(dias) == null ? null : Math.round(mediana(dias) * 10) / 10,
      atorados: dias.filter(d => d > ATORADO_DIAS).length,
    }
  }

  return pipelines.map(p => {
    const propias = stages.filter(s => s.pipelineId === p.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const delEmbudo = vivos.filter(l => l.pipelineId === p.id)
    const enCalentamiento = delEmbudo.filter(l => !l.systemStage || l.systemStage === 'cold')
    const filas = propias.map(s => ({
      stageId: s.id,
      nombre: s.name,
      fase: s.fase || 'calentamiento',
      rango: [s.scoreMin ?? 0, s.scoreMax ?? 100],
      ...resumen(enCalentamiento.filter(l => l.stageId === s.id)),
    }))
    const sinEtapa = enCalentamiento.filter(l => !propias.some(s => s.id === l.stageId))
    if (sinEtapa.length) filas.push({ stageId: null, nombre: 'Sin etapa', fase: 'calentamiento', rango: null, ...resumen(sinEtapa) })
    filas.push({ stageId: '__handoff__', nombre: 'Handoff', fase: 'handoff', rango: null, ...resumen(delEmbudo.filter(l => l.systemStage === 'handoff')) })
    filas.push({ stageId: '__cierre__', nombre: 'Oportunidad abierta', fase: 'cierre', rango: null, ...resumen(delEmbudo.filter(l => l.systemStage === 'open_opportunity' || l.systemStage === 'secure_opportunity')) })
    return { pipelineId: p.id, nombre: p.name, filas }
  }).filter(e => e.filas.some(f => f.personas > 0))
}

/* ── Asistencia ─────────────────────────────────────────────────────── */

const ANTICIPACION = [
  { id: '0-1', nombre: 'Mismo día o al siguiente', hasta: 1 },
  { id: '2-3', nombre: 'De 2 a 3 días', hasta: 3 },
  { id: '4-7', nombre: 'De 4 a 7 días', hasta: 7 },
  { id: '8+', nombre: '8 días o más', hasta: Infinity },
]

/* Las citas cuya fecha cayó en el periodo y ya pasó. La tasa se mide sobre
 * las que se marcaron —asistió o no asistió—, y las que nadie marcó se
 * cuentan aparte: son lo primero que dice cuánto confiar en el número. */
function asistencia({ citas, desde, hasta, ahora }) {
  const tope = Math.min(hasta, ahora)
  const delPeriodo = citas.filter(c => en(c.scheduledAt, desde, tope))
  const resueltas = (g) => g.filter(c => c.status === 'completed' || c.status === 'no_show')
  const tasa = (g) => pct(g.filter(c => c.status === 'completed').length, resueltas(g).length)
  const corte = (g) => ({ citas: g.length, marcadas: resueltas(g).length, asistencia: tasa(g) })

  const anticipacion = ANTICIPACION.map((b, i) => {
    const min = i === 0 ? -Infinity : ANTICIPACION[i - 1].hasta
    const g = delPeriodo.filter(c => {
      if (!c.createdAt) return false
      const d = (c.scheduledAt - c.createdAt) / DIA
      return d > min && d <= b.hasta
    })
    return { id: b.id, nombre: b.nombre, ...corte(g) }
  })

  return {
    citas: delPeriodo.length,
    asistieron: delPeriodo.filter(c => c.status === 'completed').length,
    faltaron: delPeriodo.filter(c => c.status === 'no_show').length,
    canceladas: delPeriodo.filter(c => c.status === 'cancelled').length,
    reagendadas: delPeriodo.filter(c => c.status === 'rescheduled').length,
    sinMarcar: delPeriodo.filter(c => !c.status || c.status === 'pending').length,
    tasa: tasa(delPeriodo),
    porQuienAgendo: {
      agente: corte(delPeriodo.filter(c => c.createdByAgent)),
      persona: corte(delPeriodo.filter(c => !c.createdByAgent)),
    },
    anticipacion,
    porTipo: Object.entries(agrupar(delPeriodo, 'type')).length
      ? [...agrupar(delPeriodo, 'type').entries()].map(([tipo, g]) => ({ tipo, ...corte(g) }))
      : [],
  }
}

/* ── Cuánto confiar en los datos ────────────────────────────────────── */

function calidad({ leads, citas, oportunidades, desde, hasta, ahora }) {
  const tope = Math.min(hasta, ahora)
  const citasPasadas = citas.filter(c => en(c.scheduledAt, desde, tope))
  const sinMarcar = citasPasadas.filter(c => !c.status || c.status === 'pending')
  const vivos = leads.filter(l => !l.discarded)
  const conPersona = vivos.filter(l => l.systemStage === 'handoff' || ETAPAS_DE_CIERRE.includes(l.systemStage))
  const sinResponsable = conPersona.filter(l => !l.assignedTo)
  const cohorte = leads.filter(l => en(l.createdAt, desde, hasta))
  const sinEmbudo = cohorte.filter(l => !l.pipelineId)
  const oppsVivas = oportunidades.filter(o => o.status === 'abierta' || o.status === 'ganada')
  const sinMonto = oppsVivas.filter(o => !(Number(o.value) > 0))

  const chequeos = [
    { id: 'citas_sin_marcar', nombre: 'Citas pasadas sin marcar si asistió', malos: sinMarcar.length, total: citasPasadas.length },
    { id: 'sin_responsable', nombre: 'Leads con una persona a cargo pero sin responsable', malos: sinResponsable.length, total: conPersona.length },
    { id: 'sin_embudo', nombre: 'Leads del periodo sin embudo', malos: sinEmbudo.length, total: cohorte.length },
    { id: 'sin_monto', nombre: 'Oportunidades sin monto', malos: sinMonto.length, total: oppsVivas.length },
  ].map(c => ({ ...c, porcentaje: pct(c.malos, c.total) }))

  /* La confianza la marca el peor chequeo, no el promedio: un 40% de citas
   * sin marcar invalida la asistencia aunque todo lo demás esté perfecto. */
  const peor = Math.max(0, ...chequeos.map(c => c.porcentaje || 0))
  const nivel = peor < 10 ? 'alta' : peor < 30 ? 'media' : 'baja'
  return { nivel, peorPorcentaje: peor, chequeos }
}

/* ── A quién rescatar ───────────────────────────────────────────────── */

const TOPE_LISTA = 150

/* Las bolsas van en el orden en que conviene rescatarlas: primero quien
 * estuvo más cerca de comprar. */
const BOLSAS = [
  { id: 'asistio_sin_compra', nombre: 'Asistieron y no compraron', accion: 'Llamar para cerrar' },
  { id: 'falto_sin_seguimiento', nombre: 'Agendaron, faltaron y nadie los ha buscado', accion: 'Llamar para reagendar' },
  { id: 'oportunidad_fria', nombre: 'Propuesta abierta sin seguimiento en 5 días', accion: 'Dar seguimiento a la propuesta' },
  { id: 'handoff_sin_tocar', nombre: 'En Handoff y ninguna persona los ha atendido', accion: 'Llamar hoy' },
  { id: 'calificado_sin_cita', nombre: 'Score alto y sin cita', accion: 'Ofrecer cita' },
  { id: 'sin_respuesta', nombre: 'Escribieron y nadie les contestó', accion: 'Contestar' },
]

/** El score desde el cual un lead de ese embudo cuenta como calificado: el
 *  piso de su última etapa. Sin etapas configuradas, 70. */
function umbralDe(pipelineId, stages) {
  const propias = stages.filter(s => s.pipelineId === pipelineId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const ultima = propias[propias.length - 1]
  return Number.isFinite(ultima?.scoreMin) && ultima.scoreMin > 0 ? ultima.scoreMin : 70
}

function bolsas({ leads, stages, ix, desde, hasta, ahora }) {
  const vivos = leads.filter(l => !l.discarded)
  const contactoHumanoDespues = (leadId, t) =>
    (ix.actsDe.get(leadId) || []).some(a => esContactoHumano(a) && momentoActividad(a) > t)
  const esVenta = (l) => pasosDe(l, ix, ahora).venta

  const r = Object.fromEntries(BOLSAS.map(b => [b.id, []]))
  const meter = (id, l, detalle, desdeMs) => r[id].push({
    id: l.id, nombre: [l.name, l.lastName].filter(Boolean).join(' ') || 'Sin nombre',
    responsable: l.assignedTo || null, pipelineId: l.pipelineId || null, detalle, desde: desdeMs || null,
  })

  for (const l of vivos) {
    if (esVenta(l)) continue
    const citas = ix.citasDe.get(l.id) || []

    const asistida = citas.filter(c => c.status === 'completed' && en(c.scheduledAt, desde, hasta))
      .sort((a, b) => b.scheduledAt - a.scheduledAt)[0]
    if (asistida) meter('asistio_sin_compra', l, 'Asistió a su cita', asistida.scheduledAt)

    const falta = citas.filter(c => c.status === 'no_show' && en(c.scheduledAt, desde, hasta))
      .sort((a, b) => b.scheduledAt - a.scheduledAt)[0]
    if (falta) {
      const otraCita = citas.some(c => c.id !== falta.id && (c.createdAt || 0) > falta.scheduledAt)
      if (!otraCita && !contactoHumanoDespues(l.id, falta.scheduledAt)) {
        meter('falto_sin_seguimiento', l, 'No asistió y no hay llamada ni cita nueva', falta.scheduledAt)
      }
    }

    const opps = ix.oppsDe.get(l.id) || []
    const abierta = opps.some(o => o.status === 'abierta') || l.systemStage === 'open_opportunity' || l.systemStage === 'secure_opportunity'
    if (abierta) {
      const hace5 = ahora - 5 * DIA
      const tocado = contactoHumanoDespues(l.id, hace5) || (l.lastMessageAt || 0) > hace5
      if (!tocado) meter('oportunidad_fria', l, 'Propuesta abierta sin contacto en 5 días', l.lastMessageAt)
    }

    if (l.systemStage === 'handoff' && l.handoffAt && l.handoffAt < ahora - 2 * DIA) {
      const citaFutura = citas.some(c => c.scheduledAt > ahora && (!c.status || c.status === 'pending'))
      if (!citaFutura && !contactoHumanoDespues(l.id, l.handoffAt)) {
        meter('handoff_sin_tocar', l, 'Entregado por el agente hace más de 2 días', l.handoffAt)
      }
    }

    const enCalentamiento = !l.systemStage || l.systemStage === 'cold'
    if (enCalentamiento && !citas.length && (Number(l.score) || 0) >= umbralDe(l.pipelineId, stages)
        && (l.lastMessageAt || 0) >= desde) {
      meter('calificado_sin_cita', l, `Score ${l.score}`, l.lastMessageAt)
    }

    if (l.hasUnread && l.lastInboundAt && l.lastInboundAt < ahora - 2 * HORA) {
      meter('sin_respuesta', l, 'Su último mensaje sigue sin contestar', l.lastInboundAt)
    }
  }

  return BOLSAS.map(b => {
    const lista = r[b.id].sort((a, z) => (z.desde || 0) - (a.desde || 0))
    return { ...b, personas: lista.length, lista: lista.slice(0, TOPE_LISTA), ids: lista.map(x => x.id) }
  })
}

/* Cuántos de las bolsas del reporte anterior salieron de la bolsa por la vía
 * buena. Es lo que le da dientes al reporte: sin esta cuenta, la lista de
 * rescate es una lista de pendientes que nadie revisa. */
function recuperados({ bolsasAnteriores = [], fechaAnterior, leads, ix, ahora }) {
  const porId = new Map(leads.map(l => [l.id, l]))
  return bolsasAnteriores.map(b => {
    let n = 0
    for (const id of b.ids || []) {
      const l = porId.get(id)
      if (!l) continue
      const p = pasosDe(l, ix, ahora)
      const citas = ix.citasDe.get(id) || []
      const acts = ix.actsDe.get(id) || []
      const huboContacto = acts.some(a => esContactoHumano(a) && momentoActividad(a) > fechaAnterior)
      const citaNueva = citas.some(c => (c.createdAt || 0) > fechaAnterior)
      const ok = {
        asistio_sin_compra: p.venta,
        falto_sin_seguimiento: p.venta || citaNueva || huboContacto,
        oportunidad_fria: p.venta || huboContacto,
        handoff_sin_tocar: p.venta || huboContacto || ETAPAS_DE_CIERRE.includes(l.systemStage),
        calificado_sin_cita: citaNueva || p.venta,
        sin_respuesta: !l.hasUnread,
      }[b.id]
      if (ok) n++
    }
    return { id: b.id, nombre: b.nombre, eran: (b.ids || []).length, recuperados: n, tasa: pct(n, (b.ids || []).length) }
  })
}

/* ── El reloj ───────────────────────────────────────────────────────── */

const DIAS_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const ORDEN_DIA = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

/** Día de la semana (0 = lunes) y hora, en la zona horaria del negocio. */
function diaYHora(ms, zona) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: zona, weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
  const partes = Object.fromEntries(f.formatToParts(new Date(ms)).map(p => [p.type, p.value]))
  return [ORDEN_DIA[partes.weekday] ?? 0, Number(partes.hour) % 24]
}

const matriz = () => Array.from({ length: 7 }, () => Array(24).fill(0))

const RESPUESTA_TARDE_MIN = 15

/* El mapa de horarios, en cuatro capas.
 *
 * `mensajesPorLead` trae solo marcas de tiempo y quién habló, sin el texto:
 * para contar horarios no hace falta leer nada. Una ráfaga de mensajes
 * seguidos del cliente cuenta como una sola espera, la del primero: si no, un
 * cliente que manda cinco mensajes cortos aparece como cinco desatendidos. */
function reloj({ mensajesPorLead, citas, leads, ix, desde, hasta, ahora, zona }) {
  const entrantes = matriz()
  const tardias = matriz()
  const citasCreadas = matriz()
  const perdidas = matriz()
  const esperas = []
  const esperasPorHora = Array.from({ length: 24 }, () => [])

  for (const [leadId, msgs] of Object.entries(mensajesPorLead || {})) {
    const orden = [...msgs].filter(m => m.t > 0).sort((a, b) => a.t - b.t)
    for (let i = 0; i < orden.length; i++) {
      const m = orden[i]
      if (m.de !== 'cliente' || !en(m.t, desde, hasta)) continue
      const [d, h] = diaYHora(m.t, zona)
      entrantes[d][h]++
      if (i > 0 && orden[i - 1].de === 'cliente') continue      // sigue la misma ráfaga
      const respuesta = orden.slice(i + 1).find(x => x.de !== 'cliente')
      const minutos = respuesta ? (respuesta.t - m.t) / 60000 : null
      if (minutos != null) { esperas.push(minutos); esperasPorHora[h].push(minutos) }
      if (minutos == null ? (ahora - m.t) > RESPUESTA_TARDE_MIN * 60000 : minutos > RESPUESTA_TARDE_MIN) tardias[d][h]++
    }

    /* Una conversación perdida: el cliente se calló hace más de tres días y
     * no llegó a agendar ni a comprar. Se anota la hora de su último mensaje,
     * que es la hora en que se nos fue. */
    const lead = ix.porId.get(leadId)
    const ultimoCliente = [...orden].reverse().find(x => x.de === 'cliente')
    if (lead && ultimoCliente && en(ultimoCliente.t, desde, hasta) && ahora - ultimoCliente.t > 3 * DIA) {
      const p = pasosDe(lead, ix, ahora)
      if (!p.agendo && !p.venta) {
        const [d, h] = diaYHora(ultimoCliente.t, zona)
        perdidas[d][h]++
      }
    }
  }

  for (const c of citas) {
    if (!en(c.createdAt, desde, hasta)) continue
    const [d, h] = diaYHora(c.createdAt, zona)
    citasCreadas[d][h]++
  }

  const totalHora = (mtx) => Array.from({ length: 24 }, (_, h) => mtx.reduce((s, fila) => s + fila[h], 0))
  const horaPico = (mtx) => {
    const t = totalHora(mtx)
    const max = Math.max(...t)
    return max > 0 ? t.indexOf(max) : null
  }

  return {
    zona,
    dias: DIAS_SEMANA,
    capas: { entrantes, tardias, citasCreadas, perdidas },
    esperaMedianaMin: mediana(esperas) == null ? null : Math.round(mediana(esperas)),
    esperaMedianaPorHora: esperasPorHora.map(v => (mediana(v) == null ? null : Math.round(mediana(v)))),
    picos: {
      entrantes: horaPico(entrantes),
      tardias: horaPico(tardias),
      citasCreadas: horaPico(citasCreadas),
      perdidas: horaPico(perdidas),
    },
    respuestaTardeMin: RESPUESTA_TARDE_MIN,
  }
}

/* ── Utilidades que se exportan para el resto del módulo ────────────── */

function contar(lista, clave) {
  const m = {}
  for (const x of lista) {
    const k = clave(x)
    if (!k) continue
    m[k] = (m[k] || 0) + 1
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([nombre, n]) => ({ nombre, n }))
}

/** Quién habló, en las tres voces que el reporte distingue. */
function voz(role) {
  if (ROL_CLIENTE.includes(role)) return 'cliente'
  if (ROL_AGENTE_IA.includes(role)) return 'agente'
  if (ROL_PERSONA.includes(role)) return 'persona'
  return 'otro'
}

/** Todo el cálculo determinista de una corrida. */
function calcular(entrada) {
  const { desde, hasta, ahora, zona = 'America/Mexico_City' } = entrada
  const datos = {
    leads: entrada.leads || [], citas: entrada.citas || [], actividades: entrada.actividades || [],
    oportunidades: entrada.oportunidades || [], pipelines: entrada.pipelines || [], stages: entrada.stages || [],
  }
  const ix = indexar(datos)
  const base = { ...datos, desde, hasta, ahora, ix }
  const b = bolsas(base)
  return {
    versionMetodo: VERSION_METODO,
    periodo: { desde, hasta, calculadoEn: ahora, zona, dias: Math.round((hasta - desde) / DIA) },
    calidad: calidad(base),
    conversiones: conversiones(base),
    etapas: etapas(base),
    asistencia: asistencia(base),
    bolsas: b.map(({ ids, ...resto }) => resto),
    bolsasIds: Object.fromEntries(b.map(x => [x.id, x.ids])),
    recuperados: entrada.anterior
      ? recuperados({ ...entrada.anterior, leads: datos.leads, ix, ahora })
      : null,
    reloj: reloj({ ...base, mensajesPorLead: entrada.mensajesPorLead || {}, zona }),
  }
}

module.exports = {
  VERSION_METODO, PASOS, BOLSAS, DIAS_SEMANA,
  calcular, indexar, pasosDe, cadenaDe, conversiones, etapas, asistencia,
  calidad, bolsas, recuperados, reloj, diaYHora, umbralDe, voz, contar,
  pct, mediana, promedio, DIA, HORA,
}
