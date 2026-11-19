/* Pedir una corrida del Scorecard.
 *
 * Verifica quién la pide —alguien de esa organización, o un superadmin— y que
 * la organización tenga el módulo encendido. Recién entonces crea la corrida
 * y le pasa el trabajo a scorecard-background, que es la que tarda.
 *
 * Las corridas viven en una colección propia, `scorecards`, que el navegador
 * puede leer y nunca escribir. Así, ni el dueño de la cuenta puede cambiar un
 * número: el documento lo escribe solo el servidor.
 */
const admin = require('firebase-admin')
const { initDb } = require('./lib/firebase')

const ADDON = 'scorecard'
const DIA = 864e5
const MAX_DIAS = 370
const EN_CURSO = ['en_cola', 'datos', 'conversaciones', 'agregando', 'escribiendo']

const responder = (statusCode, datos) => ({
  statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
})

function appUrl() {
  return process.env.URL || process.env.DEPLOY_URL || 'https://flowhubcrm.app'
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return responder(405, { error: 'Solo POST' })

  let datos
  try { datos = JSON.parse(event.body || '{}') } catch { return responder(400, { error: 'Cuerpo mal formado' }) }
  const { orgId, desde, hasta } = datos
  if (!orgId) return responder(400, { error: 'Falta orgId' })

  const db = initDb()

  const cabecera = event.headers.authorization || event.headers.Authorization || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : ''
  if (!token) return responder(401, { error: 'Falta el token de sesión' })
  let claims
  try { claims = await admin.auth().verifyIdToken(token) } catch { return responder(401, { error: 'Token inválido o expirado' }) }
  if (claims.orgId !== orgId && claims.superadmin !== true) {
    return responder(403, { error: 'Esta organización no es tuya' })
  }

  const org = (await db.collection('organizations').doc(orgId).get()).data()
  if (!org) return responder(404, { error: 'La organización no existe' })
  if (!(org.addons || []).includes(ADDON)) {
    return responder(403, { error: 'Esta organización no tiene el Scorecard activado' })
  }

  /* El periodo llega en milisegundos. «Hasta» se lleva al final de su día. */
  const d = Number(desde)
  const h = Number(hasta)
  if (!Number.isFinite(d) || !Number.isFinite(h) || d >= h) {
    return responder(400, { error: 'El periodo no es válido: «desde» tiene que ser antes que «hasta».' })
  }
  if ((h - d) / DIA > MAX_DIAS) return responder(400, { error: `El periodo no puede pasar de ${MAX_DIAS} días.` })
  if (d > Date.now()) return responder(400, { error: 'El periodo empieza en el futuro.' })

  /* Una corrida a la vez por organización. Dos en paralelo leerían las mismas
     conversaciones dos veces y pagarían doble. Una que lleva más de una hora
     sin moverse se da por caída y no bloquea. */
  const previas = await db.collection('scorecards').where('orgId', '==', orgId).get()
  const viva = previas.docs.map(x => x.data()).find(r =>
    EN_CURSO.includes(r.estado) && Date.now() - (r.actualizadoEn?.toMillis?.() || r.creadoEnMs || 0) < 60 * 60000)
  if (viva) return responder(409, { error: 'Ya hay un análisis corriendo para esta organización. Espera a que termine.' })

  const ref = db.collection('scorecards').doc()
  await ref.set({
    orgId,
    desde: d,
    hasta: h,
    estado: 'en_cola',
    pasada: 1,
    progreso: { conversaciones: 0, leidas: 0, errores: 0 },
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    creadoEnMs: Date.now(),
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    creadoPor: { uid: claims.uid, email: claims.email || null, superadmin: claims.superadmin === true },
  })

  /* La función de fondo contesta 202 al instante: esto no espera el análisis. */
  try {
    const r = await fetch(`${appUrl()}/.netlify/functions/scorecard-background`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: ref.id, pasada: 1 }),
    })
    if (!r.ok && r.status !== 202) throw new Error(`HTTP ${r.status}`)
  } catch (e) {
    await ref.update({ estado: 'error', motivo: `No se pudo arrancar el análisis: ${e.message}` })
    return responder(502, { error: 'No se pudo arrancar el análisis' })
  }

  return responder(200, { runId: ref.id })
}
