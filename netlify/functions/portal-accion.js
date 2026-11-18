/**
 * portal-accion.js — Las constancias del cliente en el portal de implementación.
 *
 *   enterado → el cliente se da por enterado de un acuerdo
 *   aprobar  → aprueba una entrega
 *   cambios  → pide cambios a una entrega (con comentario obligatorio)
 *
 * Pasan por aquí, y no directo a Firestore, para que el nombre y la hora los
 * ponga el servidor: nadie puede firmar por otro ni cambiar la hora, y la
 * constancia sirve como evidencia de lo acordado y lo recibido.
 *
 * Requiere la sesión que emite portal-session.js (claim implId) o un
 * superadmin.
 *
 * POST { implId, accion, acuerdoId? , entregableId?, comentario? }
 *   Authorization: Bearer <idToken>
 */

const admin = require('firebase-admin')
const { credencial, hayCredencial } = require('./lib/credencial')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(credencial()) })
}
const db = admin.firestore()

const reply = (statusCode, body) => ({ statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) })

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' })
  if (!hayCredencial()) return reply(500, { error: 'Servicio no configurado' })

  const idToken = String(event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '')
  if (!idToken) return reply(401, { error: 'Vuelve a entrar al portal' })

  let quien
  try { quien = await admin.auth().verifyIdToken(idToken) } catch { return reply(401, { error: 'Vuelve a entrar al portal' }) }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return reply(400, { error: 'JSON inválido' }) }
  const { implId, accion } = body
  const comentario = String(body.comentario || '').trim().slice(0, 2000)

  if (!implId || (quien.implId !== implId && quien.superadmin !== true)) {
    return reply(403, { error: 'Sin acceso a este proyecto' })
  }

  try {
    const implRef = db.collection('implementations').doc(implId)
    const impl = (await implRef.get()).data()
    if (!impl) return reply(404, { error: 'El proyecto no existe' })

    // El portal es de una persona: el contacto de la implementación.
    const firma = {
      nombre: quien.superadmin === true && quien.implId !== implId ? 'Flow Hub' : (impl.name || impl.email),
      correo: quien.superadmin === true && quien.implId !== implId ? (quien.email || 'flowhub') : String(impl.email || '').toLowerCase(),
      en: admin.firestore.Timestamp.now(),
    }

    if (accion === 'enterado') {
      const ref = implRef.collection('acuerdos').doc(String(body.acuerdoId || ''))
      await db.runTransaction(async (tx) => {
        const a = (await tx.get(ref)).data()
        if (!a) throw Object.assign(new Error('El acuerdo no existe'), { code: 404 })
        const enterados = a.enterados || []
        if (enterados.some((f) => f.correo === firma.correo)) return
        tx.update(ref, { enterados: [...enterados, firma] })
      })
      return reply(200, { ok: true })
    }

    if (accion === 'aprobar' || accion === 'cambios') {
      if (accion === 'cambios' && !comentario) return reply(400, { error: 'Cuéntanos qué hay que cambiar' })
      const ref = implRef.collection('entregables').doc(String(body.entregableId || ''))
      await db.runTransaction(async (tx) => {
        const e = (await tx.get(ref)).data()
        if (!e) throw Object.assign(new Error('La entrega no existe'), { code: 404 })
        if (e.estado !== 'entregado') throw Object.assign(new Error('Esta entrega ya no espera respuesta'), { code: 409 })
        tx.update(ref, {
          estado: accion === 'aprobar' ? 'aprobado' : 'con_cambios',
          respuesta: comentario ? { ...firma, comentario } : firma,
        })
      })
      return reply(200, { ok: true })
    }

    return reply(400, { error: 'Acción desconocida' })
  } catch (e) {
    if (e.code === 404 || e.code === 409) return reply(e.code, { error: e.message })
    console.error('[portal-accion] error:', e.message)
    return reply(500, { error: 'No se pudo guardar' })
  }
}
