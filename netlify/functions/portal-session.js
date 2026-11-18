/**
 * portal-session.js — Acceso del cliente al portal de implementación (/portal).
 *
 * El cliente no tiene cuenta en la app: entra con el email y la contraseña que
 * le generó el superadmin al crear su implementación. Antes esa revisión
 * ocurría en el navegador, lo que obligaba a dejar la colección
 * `implementations` legible para cualquiera, contraseñas incluidas.
 *
 * Aquí la revisión pasa al servidor y se devuelve un custom token de Firebase
 * con el claim `implId`. Las reglas de Firestore anclan cada sesión a ese
 * claim: un cliente solo alcanza su propia implementación.
 *
 * Mismo patrón que profile-session.js.
 *
 * POST { email, password } → 200 { token, implId } | 401 | 429
 */

const admin = require('firebase-admin')
const { credencial, hayCredencial } = require('./lib/credencial')
const crypto = require('crypto')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

// La contraseña son 8 caracteres: sin freno es adivinable por fuerza bruta.
const MAX_ATTEMPTS = 10
const LOCKOUT_MS = 15 * 60 * 1000

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(credencial()) })
}
const db = admin.firestore()

const reply = (statusCode, body) => ({ statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) })

function sameSecret(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8')
  const bufB = Buffer.from(String(b ?? ''), 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' })
  if (!hayCredencial()) {
    console.error('[portal-session] faltan credenciales de firebase-admin')
    return reply(500, { error: 'Servicio no configurado' })
  }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return reply(400, { error: 'JSON inválido' }) }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '').trim()
  if (!email || !password) return reply(400, { error: 'Ingresa tu email y contraseña' })

  // Mismo mensaje para email inexistente y contraseña incorrecta: distinguirlos
  // permitiría saber qué correos tienen portal.
  const GENERIC = { error: 'Email o contraseña incorrectos' }

  try {
    // Las implementaciones viejas pueden tener el email con mayúsculas: se
    // prueba tal cual y en minúsculas.
    let snap = await db.collection('implementations').where('email', '==', email).limit(1).get()
    if (snap.empty && body.email && String(body.email).trim() !== email) {
      snap = await db.collection('implementations').where('email', '==', String(body.email).trim()).limit(1).get()
    }
    if (snap.empty) return reply(401, GENERIC)

    const ref = snap.docs[0].ref
    const impl = snap.docs[0].data()

    const now = Date.now()
    const lockedUntil = impl.lockedUntil?.toMillis?.() ?? 0
    if (lockedUntil > now) {
      const mins = Math.ceil((lockedUntil - now) / 60000)
      return reply(429, { error: `Demasiados intentos. Vuelve a intentar en ${mins} minuto${mins === 1 ? '' : 's'}.` })
    }

    if (!impl.portalPassword) return reply(401, GENERIC)

    if (!sameSecret(impl.portalPassword, password)) {
      const failed = (impl.failedAttempts || 0) + 1
      const update = { failedAttempts: failed }
      if (failed >= MAX_ATTEMPTS) {
        update.lockedUntil = admin.firestore.Timestamp.fromMillis(now + LOCKOUT_MS)
        update.failedAttempts = 0
      }
      await ref.update(update)
      return reply(401, GENERIC)
    }

    const implId = ref.id
    const token = await admin.auth().createCustomToken(`impl:${implId}`, { implId })
    await ref.update({
      failedAttempts: 0,
      lockedUntil: admin.firestore.FieldValue.delete(),
      lastAccessAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return reply(200, { token, implId })
  } catch (e) {
    console.error('[portal-session] error:', e.message)
    return reply(500, { error: 'Error al validar el acceso' })
  }
}
