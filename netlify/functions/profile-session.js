/**
 * profile-session.js — Autenticación del Company Profile Builder (/perfil).
 *
 * El cliente final no tiene cuenta en la app: entra con el email y el código de
 * acceso que le generó el superadmin. Antes esa verificación ocurría en el
 * browser, lo que obligaba a que la colección `company_profiles` fuera legible
 * por cualquiera — incluidos los códigos de acceso de todos los clientes.
 *
 * Aquí la verificación pasa al servidor y se devuelve un custom token de
 * Firebase con un claim `profileId`. Con eso:
 *   - `accessPassword` nunca sale de la function.
 *   - Las reglas de Firestore y Storage pueden anclarse a request.auth.token.profileId.
 *   - La subida de archivos sigue yendo por el SDK del browser (que ya tiene
 *     CORS resuelto), sin necesidad de configurar CORS del bucket.
 *
 * POST { email, code } → 200 { token, profileId } | 401 | 429
 */

const admin = require('firebase-admin')
const crypto = require('crypto')

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

// Un código de acceso son 8 caracteres: sin freno, es adivinable por fuerza
// bruta. Se bloquea el perfil tras varios intentos fallidos seguidos.
const MAX_ATTEMPTS = 10
const LOCKOUT_MS = 15 * 60 * 1000

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

/** Comparación en tiempo constante — un `===` filtra el prefijo correcto. */
function sameSecret(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8')
  const bufB = Buffer.from(String(b ?? ''), 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Method not allowed' })
  }

  if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error('[profile-session] faltan credenciales de firebase-admin')
    return reply(500, { error: 'Servicio no configurado' })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return reply(400, { error: 'JSON inválido' })
  }

  const email = String(body.email || '').trim().toLowerCase()
  const code = String(body.code || '').trim()

  if (!email || !code) {
    return reply(400, { error: 'Faltan el email o el código de acceso' })
  }

  try {
    const snap = await db.collection('company_profiles').where('clientEmail', '==', email).limit(1).get()

    // Mismo mensaje para email inexistente y código incorrecto: distinguirlos
    // permitiría enumerar qué clientes tienen perfil.
    const GENERIC = { error: 'Email o código de acceso incorrecto' }
    if (snap.empty) return reply(401, GENERIC)

    const docRef = snap.docs[0].ref
    const profile = snap.docs[0].data()

    const now = Date.now()
    const lockedUntil = profile.lockedUntil?.toMillis?.() ?? 0
    if (lockedUntil > now) {
      const mins = Math.ceil((lockedUntil - now) / 60000)
      return reply(429, { error: `Demasiados intentos. Vuelve a intentar en ${mins} minuto${mins === 1 ? '' : 's'}.` })
    }

    // Un perfil sin código no debe poder validarse jamás: sin esto, dos valores
    // vacíos compararían iguales si alguien reordena las validaciones de arriba.
    if (!profile.accessPassword) {
      console.error('[profile-session] perfil sin accessPassword:', docRef.id)
      return reply(401, GENERIC)
    }

    if (!sameSecret(profile.accessPassword, code)) {
      const failed = (profile.failedAttempts || 0) + 1
      const update = { failedAttempts: failed }
      if (failed >= MAX_ATTEMPTS) {
        update.lockedUntil = admin.firestore.Timestamp.fromMillis(now + LOCKOUT_MS)
        update.failedAttempts = 0
      }
      await docRef.update(update)
      return reply(401, GENERIC)
    }

    const profileId = docRef.id

    // El uid identifica al perfil, no a una persona: el claim es lo que leen las
    // reglas para acotar cada sesión a su propio documento y a su carpeta.
    const token = await admin.auth().createCustomToken(`profile:${profileId}`, { profileId })

    await docRef.update({
      failedAttempts: 0,
      lockedUntil: admin.firestore.FieldValue.delete(),
      lastAccessAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return reply(200, { token, profileId })
  } catch (e) {
    console.error('[profile-session] error:', e.message)
    return reply(500, { error: 'Error al validar el acceso' })
  }
}
