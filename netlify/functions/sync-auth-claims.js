/**
 * sync-auth-claims.js — Copia orgId y superadmin de users/{uid} a los custom
 * claims del token de Firebase Auth.
 *
 * POR QUÉ EXISTE
 *
 * Las reglas de Firestore necesitan saber a qué organización pertenece quien
 * hace la petición. La vía natural sería consultarlo dentro de la regla:
 *
 *   exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid))
 *
 * pero el motor devolvía "Function not found error: Name: [exists]" en esa ruta,
 * con argumento y sin él, sin causa clara. Con el orgId dentro del token la
 * regla se vuelve una comparación directa —request.auth.token.orgId == orgId—
 * que no consulta Firestore, no cuesta lecturas y no depende de esa función.
 *
 * SEGURIDAD
 *
 * El claim se calcula SOLO desde users/{uid} del lado del servidor, y solo para
 * el uid del token que llega. Nadie puede pedir el claim de otra organización:
 * el cuerpo de la petición ni se lee.
 *
 * POST  ·  Authorization: Bearer <idToken>
 *   200 { orgId, superadmin, changed }
 *   401 sin token o token inválido
 *
 * El cliente debe llamar getIdToken(true) después de un `changed: true`, porque
 * los claims solo entran al token cuando se refresca.
 */

const admin = require('firebase-admin')

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = admin.firestore()

const reply = (statusCode, body) => ({ statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) })

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Method not allowed' })
  }
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error('[sync-auth-claims] faltan credenciales de firebase-admin')
    return reply(500, { error: 'Servicio no configurado' })
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) return reply(401, { error: 'Falta el token de sesión' })

  let uid
  try {
    uid = (await admin.auth().verifyIdToken(idToken)).uid
  } catch {
    return reply(401, { error: 'Token inválido o expirado' })
  }

  try {
    const snap = await db.collection('users').doc(uid).get()

    // Sin documento no hay nada que reclamar. Se limpian los claims por si el
    // usuario perdió su organización o su rol.
    const data = snap.exists ? snap.data() : {}
    const orgId = data.orgId || null
    const superadmin = data.role === 'superadmin'

    const nuevos = {}
    if (orgId) nuevos.orgId = orgId
    if (superadmin) nuevos.superadmin = true

    const actuales = (await admin.auth().getUser(uid)).customClaims || {}
    const iguales = (actuales.orgId || null) === orgId
      && (actuales.superadmin === true) === superadmin

    if (iguales) {
      return reply(200, { orgId, superadmin, changed: false })
    }

    // setCustomUserClaims reemplaza el objeto completo, no hace merge: por eso
    // se manda el conjunto entero y no solo lo que cambió.
    await admin.auth().setCustomUserClaims(uid, nuevos)

    console.log(`[sync-auth-claims] ${uid}: orgId=${orgId} superadmin=${superadmin}`)
    return reply(200, { orgId, superadmin, changed: true })
  } catch (e) {
    console.error('[sync-auth-claims] error:', e.message)
    return reply(500, { error: 'No se pudieron sincronizar los permisos' })
  }
}
