// Cliente y helpers compartidos para la API de Zernio.
// Zernio es el proveedor que está entre FlowHub y Meta: él resuelve la compra
// del número, el OTP del número propio y el Embedded Signup de WhatsApp.
const crypto = require('crypto')
const admin = require('firebase-admin')

const ZERNIO_BASE = 'https://zernio.com/api/v1'

// Solo los eventos de estado de conexión. Los de mensajería se agregan cuando
// se migre el inbox; suscribirse ahora sería recibir eventos que nadie procesa.
const WEBHOOK_EVENTS = [
  'account.connected',
  'account.disconnected',
  'whatsapp.number.activated',
]

function initDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return admin.firestore()
}

async function zernioFetch(path, options = {}) {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) throw new Error('ZERNIO_API_KEY no está configurada en Netlify')

  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Zernio ${res.status}: ${await res.text()}`)
  return res.json()
}

function appUrl() {
  return process.env.URL || process.env.DEPLOY_URL || 'https://app.flowhubcrm.app'
}

// Crea el perfil del cliente en Zernio una sola vez y lo guarda en la org.
async function ensureProfile(db, orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const snap = await orgRef.get()
  if (!snap.exists) throw new Error('Organización no encontrada')

  const org = snap.data()
  if (org.zernioProfileId) return org.zernioProfileId

  const res = await zernioFetch('/profiles', {
    method: 'POST',
    body: JSON.stringify({ name: org.name || orgId, description: 'FlowHub CRM' }),
  })
  const profileId = res.profile?._id || res.profile?.id || res._id || res.id
  if (!profileId) throw new Error('Zernio no devolvió un profile válido')

  await orgRef.update({ zernioProfileId: profileId })
  console.log(`[zernio] profile creado para org ${orgId}: ${profileId}`)
  return profileId
}

// Registra el webhook de la org una sola vez. Usa el secret global para que la
// verificación de firma no necesite leer Firestore antes de responder.
async function ensureWebhook(db, orgId, profileId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const existing = (await orgRef.get()).data()?.zernioWebhookId
  if (existing) return existing

  const secret = process.env.ZERNIO_WEBHOOK_SECRET
  if (!secret) throw new Error('ZERNIO_WEBHOOK_SECRET no está configurada en Netlify')

  const res = await zernioFetch('/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      url: `${appUrl()}/.netlify/functions/zernio-webhook`,
      events: WEBHOOK_EVENTS,
      secret,
      profileId,
    }),
  })
  const webhookId = res.webhook?._id || res.webhook?.id || res._id || res.id
  if (!webhookId) throw new Error('Zernio no devolvió un webhook válido')

  await orgRef.update({ zernioWebhookId: webhookId })
  console.log(`[zernio] webhook registrado para org ${orgId}: ${webhookId}`)
  return webhookId
}

// A diferencia de la versión de phot8can, sin secret devolvemos false en vez de
// true: saltarse la verificación en producción deja que cualquiera marque un
// canal como conectado.
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET
  if (!secret || !signature) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    const a = Buffer.from(signature.trim())
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

module.exports = {
  initDb, zernioFetch, appUrl,
  ensureProfile, ensureWebhook, verifyWebhookSignature,
  WEBHOOK_EVENTS,
}
