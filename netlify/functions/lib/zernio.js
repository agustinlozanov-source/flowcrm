// Cliente y helpers compartidos para la API de Zernio.
// Zernio es el proveedor que está entre FlowHub y Meta: él resuelve la compra
// del número, el OTP del número propio y el Embedded Signup de WhatsApp.
const crypto = require('crypto')
const { initDb } = require('./firebase')

const ZERNIO_BASE = 'https://zernio.com/api/v1'

const WEBHOOK_EVENTS = [
  'account.connected',
  'account.disconnected',
  'whatsapp.number.activated',
  'message.received',
]

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
  if (!res.ok) {
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { /* Zernio no siempre responde JSON */ }
    const err = new Error(`Zernio ${res.status}: ${text}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return res.json()
}

function appUrl() {
  return process.env.URL || process.env.DEPLOY_URL || 'https://flowhubcrm.app'
}

// Crea el perfil del cliente en Zernio una sola vez y lo guarda en la org.
async function ensureProfile(db, orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const snap = await orgRef.get()
  if (!snap.exists) throw new Error('Organización no encontrada')

  const org = snap.data()
  if (org.zernioProfileId) return org.zernioProfileId

  let profileId
  try {
    const res = await zernioFetch('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name: org.name || orgId, description: 'FlowHub CRM' }),
    })
    profileId = res.profile?._id || res.profile?.id || res._id || res.id
  } catch (e) {
    // Las orgs creadas cuando el backend viejo seguía vivo ya tienen perfil en
    // Zernio. El 409 trae el id existente, así que lo adoptamos en vez de fallar.
    const existing = e.status === 409 ? e.body?.details?.existingProfileId : null
    if (!existing) throw e

    // Zernio detecta el conflicto por NOMBRE. Si dos orgs se llaman igual,
    // adoptar a ciegas cruzaría los canales de dos clientes distintos.
    const dup = await db.collection('organizations')
      .where('zernioProfileId', '==', existing).limit(1).get()
    if (!dup.empty && dup.docs[0].id !== orgId) {
      throw new Error(
        `El perfil de Zernio "${org.name}" ya pertenece a otra organización ` +
        `(${dup.docs[0].id}). Renombrá una de las dos antes de conectar.`
      )
    }

    profileId = existing
    console.log(`[zernio] perfil existente adoptado para org ${orgId}: ${existing}`)
  }
  if (!profileId) throw new Error('Zernio no devolvió un profile válido')

  await orgRef.update({ zernioProfileId: profileId })
  console.log(`[zernio] profile creado para org ${orgId}: ${profileId}`)
  return profileId
}

// El webhook de Zernio es a nivel de CUENTA, no por perfil: el endpoint
// /webhooks/settings no acepta profileId. Con uno solo alcanza para todas las
// orgs, porque cada evento trae el profileId y con eso resolvemos de quién es.
// Idempotente: lista los existentes y solo crea si no está el nuestro.
async function ensureWebhook() {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET
  if (!secret) throw new Error('ZERNIO_WEBHOOK_SECRET no está configurada en Netlify')

  const url = `${appUrl()}/.netlify/functions/zernio-webhook`

  const list = await zernioFetch('/webhooks/settings')
  const mine = (list.webhooks || []).find(w => w.url === url)

  if (mine) {
    // Puede haberse creado con una lista de eventos anterior: completarla.
    const have = new Set(mine.events || [])
    const missing = WEBHOOK_EVENTS.filter(e => !have.has(e))
    if (missing.length) {
      await zernioFetch('/webhooks/settings', {
        method: 'PUT',
        body: JSON.stringify({
          webhookId: mine.webhookId || mine._id || mine.id,
          events: [...have, ...missing],
        }),
      })
      console.log('[zernio] webhook actualizado con eventos:', missing.join(', '))
    }
    return
  }

  const res = await zernioFetch('/webhooks/settings', {
    method: 'POST',
    body: JSON.stringify({ name: 'FlowHub CRM', url, secret, events: WEBHOOK_EVENTS }),
  })
  console.log('[zernio] webhook global registrado:', url, res.webhook?._id || res.webhook?.id || '')
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

// Responde dentro de una conversación existente del inbox de Zernio.
// Con `attachment` manda el archivo como adjunto real de WhatsApp en vez de
// pegar la URL en el texto.
async function sendMessage(conversationId, accountId, text, attachment = null) {
  const body = { accountId }
  if (text) body.message = text
  if (attachment?.url) {
    body.attachmentUrl = attachment.url
    body.attachmentType = attachment.type || 'file'
    // Sin nombre, WhatsApp lo deriva de la URL y al destinatario le llega un
    // nombre ilegible.
    if (attachment.name) body.attachmentName = attachment.name
  }
  return zernioFetch(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// Los tipos de recurso del CRM contra los que acepta Zernio.
const ATTACHMENT_TYPES = { imagen: 'image', video: 'video', archivo: 'file' }

function attachmentName(resource) {
  if (!resource.name) return null
  // WhatsApp muestra mejor el documento si el nombre conserva la extensión.
  const ext = (resource.url || '').split('?')[0].match(/\.([a-z0-9]{2,5})$/i)?.[1]
  const hasExt = /\.[a-z0-9]{2,5}$/i.test(resource.name)
  return ext && !hasExt ? `${resource.name}.${ext}` : resource.name
}

// Manda la respuesta y después cada recurso como adjunto, uno por mensaje.
// Los de tipo 'enlace' no se adjuntan: su URL va dentro del texto.
async function sendReply(conversationId, accountId, text, resources = []) {
  // Sin texto se manda solo el adjunto: un mensaje vacío lo rechaza Zernio.
  if (text?.trim()) await sendMessage(conversationId, accountId, text)

  // Devuelve los que salieron para poder dejarlos en el hilo: si solo se
  // guarda el texto, el Inbox no muestra los archivos que el lead sí recibió.
  const sent = []
  for (const r of resources) {
    const type = ATTACHMENT_TYPES[r.type]
    if (!type || !r.url) continue
    const name = attachmentName(r)
    try {
      await sendMessage(conversationId, accountId, null, { url: r.url, type, name })
      sent.push({ name, url: r.url, type })
    } catch (e) {
      console.error(`[zernio] no se pudo adjuntar "${r.name}":`, e.message)
    }
  }
  return sent
}

module.exports = {
  initDb, zernioFetch, appUrl, sendMessage, sendReply,
  ensureProfile, ensureWebhook, verifyWebhookSignature,
  WEBHOOK_EVENTS,
}
