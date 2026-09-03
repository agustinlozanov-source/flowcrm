/**
 * change-owner-email.js — Cambia el correo del administrador de una organización.
 *
 * El correo del dueño vive en cuatro lugares y todos tienen que moverse juntos:
 *
 *   1. Firebase Authentication          → es la cuenta con la que se entra
 *   2. organizations/{orgId}.ownerEmail → lo que muestra el panel
 *   3. users/{uid}.email
 *   4. organizations/{orgId}/members/{uid}.email
 *
 * Por eso el campo estaba deshabilitado en el panel: editarlo suelto cambiaba lo
 * que se ve sin cambiar con qué correo se entra, y dejaba el panel diciendo una
 * cosa y el login pidiendo otra.
 *
 * Solo el Auth Admin SDK puede tocar el punto 1, así que esto vive en el
 * servidor. Requiere un ID token de un usuario con role 'superadmin'.
 *
 * POST { orgId, newEmail }  ·  Authorization: Bearer <idToken>
 *   200 { ok, uid, oldEmail, newEmail }
 *   401 sin token o token inválido · 403 no es superadmin
 *   409 el correo ya lo usa otra cuenta
 *   404 la organización no existe
 *   424 la organización todavía no tiene cuenta en Auth
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Method not allowed' })
  }
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error('[change-owner-email] faltan credenciales de firebase-admin')
    return reply(500, { error: 'Servicio no configurado' })
  }

  // ── Quién llama ─────────────────────────────────────────────────────────
  // Esta operación cambia con qué correo entra un cliente: no puede quedar
  // abierta a cualquiera que conozca la URL de la function.
  const authHeader = event.headers.authorization || event.headers.Authorization || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) return reply(401, { error: 'Falta el token de sesión' })

  let callerUid
  try {
    callerUid = (await admin.auth().verifyIdToken(idToken)).uid
  } catch {
    return reply(401, { error: 'Token inválido o expirado' })
  }

  const callerSnap = await db.collection('users').doc(callerUid).get()
  if (!callerSnap.exists || callerSnap.data().role !== 'superadmin') {
    return reply(403, { error: 'Se requieren permisos de superadmin' })
  }

  // ── Entrada ─────────────────────────────────────────────────────────────
  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return reply(400, { error: 'JSON inválido' })
  }

  const orgId = String(body.orgId || '').trim()
  const newEmail = String(body.newEmail || '').trim().toLowerCase()

  if (!orgId) return reply(400, { error: 'Falta el orgId' })
  if (!EMAIL_RE.test(newEmail)) return reply(400, { error: 'El correo no tiene un formato válido' })

  try {
    const orgRef = db.collection('organizations').doc(orgId)
    const orgSnap = await orgRef.get()
    if (!orgSnap.exists) return reply(404, { error: 'La organización no existe' })

    const org = orgSnap.data()
    const oldEmail = (org.ownerEmail || '').toLowerCase()

    if (oldEmail === newEmail) {
      return reply(200, { ok: true, unchanged: true, oldEmail, newEmail })
    }

    // El ownerId es la vía confiable; el correo viejo es el respaldo para
    // organizaciones creadas antes de que se empezara a guardar ownerId.
    let uid = org.ownerId || null
    if (!uid && oldEmail) {
      try {
        uid = (await admin.auth().getUserByEmail(oldEmail)).uid
      } catch { /* no hay cuenta con ese correo */ }
    }

    if (!uid) {
      return reply(424, {
        error: 'Esta organización todavía no tiene cuenta de acceso. Usa "Asignar contraseña" para crearla y después cambia el correo.',
      })
    }

    // Mejor descubrir aquí que el correo está ocupado y no a medio camino,
    // con Auth ya cambiado y Firestore sin cambiar.
    try {
      const taken = await admin.auth().getUserByEmail(newEmail)
      if (taken.uid !== uid) {
        return reply(409, { error: 'Ese correo ya lo usa otra cuenta' })
      }
    } catch { /* libre, que es lo que se busca */ }

    // 1. La cuenta de acceso. Va primero: es la que puede fallar, y si falla no
    //    conviene haber tocado nada más.
    await admin.auth().updateUser(uid, { email: newEmail, emailVerified: false })

    // 2, 3 y 4. Los tres documentos, en un batch para que no queden a medias.
    const batch = db.batch()
    batch.update(orgRef, { ownerEmail: newEmail, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
    batch.set(db.collection('users').doc(uid), { email: newEmail }, { merge: true })
    batch.set(orgRef.collection('members').doc(uid), { email: newEmail }, { merge: true })
    await batch.commit()

    console.log(`[change-owner-email] ${orgId}: ${oldEmail} → ${newEmail} (uid ${uid})`)
    return reply(200, { ok: true, uid, oldEmail, newEmail })
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      return reply(409, { error: 'Ese correo ya lo usa otra cuenta' })
    }
    if (e.code === 'auth/invalid-email') {
      return reply(400, { error: 'El correo no tiene un formato válido' })
    }
    console.error('[change-owner-email] error:', e.message)
    return reply(500, { error: 'No se pudo cambiar el correo' })
  }
}
