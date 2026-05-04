// netlify/functions/mercadopago-webhook.js
// Recibe notificaciones de Mercado Pago (tipo preapproval).
// Siempre devuelve 200 para evitar reintentos infinitos de MP.
//
// MP envía: POST /?id=<preapprovalId>&topic=preapproval
// o en el body: { id, topic, type, data: { id } }
//
// Valida firma HMAC-SHA256 via header x-signature si MP_WEBHOOK_SECRET está configurado.

const admin = require('firebase-admin')
const crypto = require('crypto')

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

/**
 * Valida la firma HMAC-SHA256 que MP incluye en x-signature.
 * Formato del header: "ts=<timestamp>,v1=<hmac>"
 * Manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * Ref: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
 */
function validateMpSignature(event, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    // Si no está configurado, loguear advertencia pero no bloquear
    console.warn('[mp-webhook] MP_WEBHOOK_SECRET no configurado — validación de firma omitida')
    return true
  }

  const xSignature  = event.headers?.['x-signature'] || event.headers?.['X-Signature'] || ''
  const xRequestId  = event.headers?.['x-request-id'] || event.headers?.['X-Request-Id'] || ''

  if (!xSignature) {
    console.warn('[mp-webhook] Header x-signature ausente')
    return false
  }

  // Extraer ts y v1 del header
  const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')))
  const ts = parts.ts
  const v1 = parts.v1

  if (!ts || !v1) {
    console.warn('[mp-webhook] Header x-signature malformado:', xSignature)
    return false
  }

  // Construir manifest según spec de MP
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  const valid = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))
  if (!valid) console.warn('[mp-webhook] Firma inválida — posible request no autorizado')
  return valid
}

// MP envía la notificación sin Content-Type JSON en algunos casos,
// así que siempre devolvemos 200 inmediatamente (patrón recomendado por MP docs).
exports.handler = async (event) => {
  // Responder 200 inmediatamente — MP espera ACK rápido
  const OK = { statusCode: 200, body: '' }

  try {
    // Extraer el id del preapproval desde query params o body
    const params = event.queryStringParameters || {}
    let preapprovalId = params.id
    let topic = params.topic

    // También puede venir en el body (formato v2 de MP)
    if (!preapprovalId && event.body) {
      try {
        const parsed = JSON.parse(event.body)
        // Formato v1: { id, topic }
        // Formato v2: { type, data: { id } }
        if (parsed.type === 'preapproval' || parsed.topic === 'preapproval') {
          preapprovalId = parsed.data?.id || parsed.id
          topic = parsed.type || parsed.topic
        }
      } catch { /* body no es JSON, ignorar */ }
    }

    // Solo procesamos eventos de preapproval
    if (!preapprovalId || (topic && topic !== 'preapproval')) {
      console.log(`[mp-webhook] Evento ignorado — topic: ${topic}, id: ${preapprovalId}`)
      return OK
    }

    // Validar firma HMAC-SHA256 de MP
    if (!validateMpSignature(event, preapprovalId)) {
      console.warn(`[mp-webhook] Firma inválida para preapprovalId: ${preapprovalId} — request ignorado`)
      return OK
    }

    console.log(`[mp-webhook] Procesando preapproval: ${preapprovalId}`)

    // Determinar qué access token usar
    // Buscamos la org por mpPreapprovalId para saber el modo
    const orgsSnap = await db.collection('organizations')
      .where('mpPreapprovalId', '==', preapprovalId)
      .limit(1)
      .get()

    if (orgsSnap.empty) {
      console.warn(`[mp-webhook] No se encontró org para preapprovalId: ${preapprovalId}`)
      return OK
    }

    const orgDoc  = orgsSnap.docs[0]
    const orgData = orgDoc.data()
    const mode    = orgData.mpMode || 'test'
    const accessToken = mode === 'prod'
      ? process.env.MP_ACCESS_TOKEN_PROD
      : process.env.MP_ACCESS_TOKEN_TEST

    if (!accessToken) {
      console.error(`[mp-webhook] Access token no configurado para mode: ${mode}`)
      return OK
    }

    // Consultar estado real del preapproval en MP
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!mpRes.ok) {
      console.error(`[mp-webhook] Error consultando MP API: ${mpRes.status}`)
      return OK
    }

    const mpData = await mpRes.json()
    const mpStatus = mpData.status // 'authorized' | 'pending' | 'cancelled' | 'paused'

    // Mapear estado MP → billingStatus interno
    const billingStatusMap = {
      authorized: 'paid',
      pending:    'trialing',
      paused:     'past_due',
      cancelled:  'cancelled',
    }
    const billingStatus = billingStatusMap[mpStatus] || 'none'

    // Construir update para la org
    const orgUpdate = {
      mpStatus,
      billingStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    if (mpStatus === 'authorized') {
      orgUpdate.lastPaymentAt = admin.firestore.FieldValue.serverTimestamp()
      // Calcular próximo cobro (~30 días)
      const nextDate = new Date()
      nextDate.setDate(nextDate.getDate() + 30)
      orgUpdate.nextBillingDate = nextDate.toISOString()
    }

    await orgDoc.ref.update(orgUpdate)

    // Loguear el evento en subcollección mpEvents
    await orgDoc.ref.collection('mpEvents').add({
      preapprovalId,
      mpStatus,
      billingStatus,
      mpData: {
        id: mpData.id,
        status: mpData.status,
        payer_email: mpData.payer_email || null,
        external_reference: mpData.external_reference || null,
        last_modified: mpData.last_modified || null,
      },
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`[mp-webhook] Org ${orgDoc.id} actualizada — mpStatus: ${mpStatus}, billingStatus: ${billingStatus}`)
  } catch (err) {
    // Nunca devolver error a MP para evitar reintentos
    console.error('[mp-webhook] Error procesando webhook:', err.message)
  }

  return OK
}
