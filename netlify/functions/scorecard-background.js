/* Una corrida del Scorecard.
 *
 * Es una Background Function: Netlify le da 15 minutos y no espera respuesta.
 * Leer cada conversación de un periodo largo puede tomar más que eso, así que
 * la corrida avanza por fases y, si se le acaba el tiempo, se vuelve a llamar
 * a sí misma y sigue donde iba. Lo hecho no se repite: cada ficha se guarda en
 * cuanto se termina.
 *
 *   1. datos           los números duros, sin modelo
 *   2. conversaciones  una ficha por conversación, con el modelo económico
 *   3. agregando       las fichas contadas y el mapa de horarios
 *   4. escribiendo     la lectura del periodo, con el modelo más capaz
 *
 * Nadie llama a esta función desde el navegador. La llama scorecard.js
 * después de verificar quién pide la corrida, y ella misma para continuar.
 * Solo procesa una corrida que ya existe, en la pasada que le corresponde: si
 * alguien la llama de más, no pasa nada.
 */
const admin = require('firebase-admin')
const crypto = require('crypto')
const { initDb } = require('./lib/firebase')
const C = require('./lib/scorecard/calculo')
const { resumirFichas } = require('./lib/scorecard/insights')
const { leerConversacion, MODELO: MODELO_LECTURA } = require('./lib/scorecard/lectura')
const { escribirReporte, MODELO: MODELO_REPORTE } = require('./lib/scorecard/reporte')
const { cargar, candidatos, mensajesDe } = require('./lib/scorecard/datos')

const MIN = 60000
const LIMITE = 14.5 * MIN           // lo que da Netlify, con margen
const PARA_LEER_HASTA = 11 * MIN    // después de esto no se empieza otra tanda
const PARA_AGREGAR = 4 * MIN        // tiempo mínimo que hay que tener para agregar
const PARA_ESCRIBIR = 9 * MIN       // la escritura va en una pasada fresca si no alcanza
const EN_PARALELO = 8
const TOPE_IDS_POR_BOLSA = 2000

const ahoraSrv = () => admin.firestore.FieldValue.serverTimestamp()

function appUrl() {
  return process.env.URL || process.env.DEPLOY_URL || 'https://flowhubcrm.app'
}

/* Pasa la corrida a la pasada siguiente y se vuelve a llamar. */
async function continuar(ref, pasada, motivo) {
  await ref.update({ pasada: pasada + 1, actualizadoEn: ahoraSrv() })
  console.log(`[scorecard] ${ref.id}: sigue en la pasada ${pasada + 1} (${motivo})`)
  await fetch(`${appUrl()}/.netlify/functions/scorecard-background`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId: ref.id, pasada: pasada + 1 }),
  })
}

/* El reporte anterior de la misma organización, para comparar el plan y
 * contar cuántos de sus rescatables se recuperaron. */
async function corridaAnterior(db, run) {
  const s = await db.collection('scorecards').where('orgId', '==', run.orgId).get()
  const previas = s.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.estado === 'listo' && r.metricas && (r.creadoEnMs || 0) < (run.creadoEnMs || Infinity))
    .sort((a, b) => (b.creadoEnMs || 0) - (a.creadoEnMs || 0))
  const r = previas[0]
  if (!r) return null
  return {
    id: r.id,
    periodo: r.metricas.periodo,
    plan: r.reporte?.plan || null,
    bolsasAnteriores: (r.metricas.bolsas || []).map(b => ({ id: b.id, nombre: b.nombre, ids: r.metricas.bolsasIds?.[b.id] || [] })),
    fechaAnterior: r.metricas.periodo?.calculadoEn || 0,
  }
}

/* ── Fase 1 ─────────────────────────────────────────────────────────── */

async function faseDatos(db, ref, run) {
  await ref.update({ estado: 'datos', actualizadoEn: ahoraSrv() })
  const datos = await cargar(db, run.orgId)
  const anterior = await corridaAnterior(db, run)
  const metricas = C.calcular({
    ...datos, desde: run.desde, hasta: run.hasta, ahora: Date.now(),
    zona: datos.organizacion.zona, anterior,
  })
  /* Los ids de cada bolsa se guardan para que el próximo reporte cuente
     cuántos se recuperaron. Con tope, para no reventar el documento. */
  for (const k of Object.keys(metricas.bolsasIds)) metricas.bolsasIds[k] = metricas.bolsasIds[k].slice(0, TOPE_IDS_POR_BOLSA)

  await ref.update({
    metricas,
    organizacion: { nombre: datos.organizacion.nombre, zona: datos.organizacion.zona },
    embudos: datos.pipelines.map(p => ({ id: p.id, nombre: p.name })),
    miembros: datos.miembros,
    anteriorId: anterior?.id || null,
    advertencias: datos.advertencias,
    actualizadoEn: ahoraSrv(),
  })
  return metricas
}

/* ── Fase 2 ─────────────────────────────────────────────────────────── */

const TOPE_TEXTO_CLIENTE = 3000

async function fichaDe(db, run, leadId) {
  const mensajes = await mensajesDe(db, run.orgId, leadId, run.desde, run.hasta)
  const delCliente = mensajes.filter(m => m.de === 'cliente')
  const ficha = {
    leadId,
    msgs: mensajes.slice(-400).map(m => ({ de: m.de, t: m.t })),
    textoCliente: delCliente.map(m => m.texto).join('\n').slice(0, TOPE_TEXTO_CLIENTE),
    extraccion: null,
    error: null,
    leidaEn: ahoraSrv(),
  }
  /* Una conversación de un solo mensaje, o sin nada del cliente, no tiene qué
     leer. Igual se guarda: sus horarios cuentan para el mapa. */
  const hayQueLeer = mensajes.length >= 2 && delCliente.some(m => String(m.texto || '').trim().length >= 3)
  if (hayQueLeer) {
    const r = await leerConversacion(mensajes)
    ficha.extraccion = r.extraccion || null
    ficha.error = r.error || null
  }
  return ficha
}

async function faseConversaciones(db, ref, run, inicio) {
  const fichasRef = ref.collection('fichas')
  const hechas = new Set((await fichasRef.select().get()).docs.map(d => d.id))
  const todos = await candidatos(db, run.orgId, run.desde, run.hasta)
  const pendientes = todos.filter(id => !hechas.has(id))

  await ref.update({
    estado: 'conversaciones',
    progreso: { conversaciones: todos.length, leidas: hechas.size },
    actualizadoEn: ahoraSrv(),
  })

  let leidas = hechas.size
  let errores = 0
  let i = 0
  const trabajador = async () => {
    while (i < pendientes.length) {
      if (Date.now() - inicio > PARA_LEER_HASTA) return
      const leadId = pendientes[i++]
      try {
        const f = await fichaDe(db, run, leadId)
        if (f.error) errores++
        await fichasRef.doc(leadId).set(f)
        leidas++
        if (leidas % 25 === 0) {
          await ref.update({ 'progreso.leidas': leidas, actualizadoEn: ahoraSrv() })
        }
      } catch (e) {
        errores++
        console.error(`[scorecard] ${ref.id}/${leadId}:`, e.message)
        await fichasRef.doc(leadId).set({ leadId, msgs: [], textoCliente: '', extraccion: null, error: e.message, leidaEn: ahoraSrv() })
        leidas++
      }
    }
  }
  await Promise.all(Array.from({ length: EN_PARALELO }, trabajador))
  await ref.update({ 'progreso.leidas': leidas, 'progreso.errores': admin.firestore.FieldValue.increment(errores), actualizadoEn: ahoraSrv() })
  return leidas >= todos.length
}

/* ── Fase 3 ─────────────────────────────────────────────────────────── */

async function faseAgregar(db, ref, run) {
  await ref.update({ estado: 'agregando', actualizadoEn: ahoraSrv() })
  const datos = await cargar(db, run.orgId)
  const ix = C.indexar(datos)
  const ahora = Date.now()
  const fichasSnap = await ref.collection('fichas').get()
  const fichas = fichasSnap.docs.map(d => d.data())

  const reloj = C.reloj({
    mensajesPorLead: Object.fromEntries(fichas.map(f => [f.leadId, f.msgs || []])),
    citas: datos.citas, leads: datos.leads, ix,
    desde: run.desde, hasta: run.hasta, ahora, zona: datos.organizacion.zona,
  })

  /* Avanzar es haber agendado o comprado: es lo que separa una conversación
     que sirvió de una que no, sin esperar a que madure la venta. */
  const insights = resumirFichas(fichas.map(f => {
    const lead = ix.porId.get(f.leadId)
    const p = lead ? C.pasosDe(lead, ix, ahora) : {}
    return { leadId: f.leadId, extraccion: f.extraccion, textoCliente: f.textoCliente, avanzo: Boolean(p.agendo || p.venta), compro: Boolean(p.venta) }
  }))
  insights.fichasConError = fichas.filter(f => f.error).length

  await ref.update({ 'metricas.reloj': reloj, insights, actualizadoEn: ahoraSrv() })
  return insights
}

/* ── Fase 4 ─────────────────────────────────────────────────────────── */

async function faseEscribir(db, ref) {
  await ref.update({ estado: 'escribiendo', actualizadoEn: ahoraSrv() })
  const run = (await ref.get()).data()
  const anterior = run.anteriorId ? (await db.collection('scorecards').doc(run.anteriorId).get()).data() : null

  let escrito
  try {
    escrito = await escribirReporte({
      organizacion: { nombre: run.organizacion?.nombre || '', embudos: (run.embudos || []).map(e => e.nombre) },
      metricas: run.metricas,
      insights: run.insights,
      anterior: anterior ? { periodo: anterior.metricas?.periodo, plan: anterior.reporte?.plan } : null,
    }, { esfuerzo: run.esfuerzoReporte || 'medium' })
  } catch (e) {
    /* Si se quedó sin espacio, un segundo intento con menos esfuerzo, en una
       pasada nueva para que tenga todo el tiempo. Solo uno: si tampoco
       alcanza, la corrida falla con el motivo a la vista. */
    if (e.codigo === 'INCOMPLETO' && !run.reintentoReporte) {
      await ref.update({ reintentoReporte: true, esfuerzoReporte: 'low', actualizadoEn: ahoraSrv() })
      return 'reintentar'
    }
    throw e
  }
  const { reporte, modelo, tokens } = escrito

  /* La huella del reporte. Si alguien cambiara un número guardado, la huella
     ya no coincidiría con la que se calculó aquí. */
  const huella = crypto.createHash('sha256')
    .update(JSON.stringify({ metricas: run.metricas, insights: run.insights, reporte }))
    .digest('hex')

  await ref.update({
    estado: 'listo',
    reporte,
    huella,
    modelos: { lectura: MODELO_LECTURA, reporte: modelo || MODELO_REPORTE },
    tokensReporte: tokens || null,
    terminadoEn: ahoraSrv(),
    actualizadoEn: ahoraSrv(),
  })
}

/* ── Puerta ─────────────────────────────────────────────────────────── */

exports.handler = async (event) => {
  const inicio = Date.now()
  let runId, pasada
  try {
    ({ runId, pasada } = JSON.parse(event.body || '{}'))
  } catch {
    return { statusCode: 400, body: 'JSON inválido' }
  }
  if (!runId) return { statusCode: 400, body: 'Falta runId' }

  const db = initDb()
  const ref = db.collection('scorecards').doc(runId)

  try {
    const snap = await ref.get()
    if (!snap.exists) return { statusCode: 200, body: 'no existe' }
    const run = snap.data()
    /* Solo la pasada que toca. Una llamada repetida o atrasada no hace nada. */
    if (run.pasada !== pasada || run.estado === 'listo' || run.estado === 'error') {
      return { statusCode: 200, body: 'nada que hacer' }
    }
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY en el servidor')

    if (!run.metricas) await faseDatos(db, ref, run)

    if (!run.insights) {
      const completo = await faseConversaciones(db, ref, run, inicio)
      if (!completo) {
        await continuar(ref, pasada, 'faltan conversaciones')
        return { statusCode: 200, body: 'sigue' }
      }
      if (LIMITE - (Date.now() - inicio) < PARA_AGREGAR) {
        await continuar(ref, pasada, 'antes de agregar')
        return { statusCode: 200, body: 'sigue' }
      }
      await faseAgregar(db, ref, run)
    }

    if (LIMITE - (Date.now() - inicio) < PARA_ESCRIBIR) {
      await continuar(ref, pasada, 'antes de escribir')
      return { statusCode: 200, body: 'sigue' }
    }
    if (await faseEscribir(db, ref) === 'reintentar') {
      await continuar(ref, pasada, 'reintento del reporte con menos esfuerzo')
      return { statusCode: 200, body: 'sigue' }
    }
    console.log(`[scorecard] ${runId} listo en la pasada ${pasada}`)
  } catch (e) {
    console.error(`[scorecard] ${runId}:`, e)
    await ref.update({ estado: 'error', motivo: e.message || String(e), actualizadoEn: ahoraSrv() }).catch(() => {})
  }
  return { statusCode: 200, body: 'ok' }
}
