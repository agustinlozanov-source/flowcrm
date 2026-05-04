// netlify/functions/mercadopago-create-subscription.js
// Crea un preapproval (suscripción recurrente) en Mercado Pago via REST API.
// NO usa el SDK oficial — solo fetch nativo.
//
// Body: { orgId, orgName, ownerEmail, planId, mode }
//   mode: 'test' | 'prod'  (default: 'test')
//
// Devuelve: { initPoint, preapprovalId }

const admin = require('firebase-admin')

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

const CORS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }

const APP_URL = 'https://flowhubcrm.app'

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body || '{}') } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { orgId, orgName, ownerEmail, planId, mode = 'test' } = body

  if (!orgId || !planId || !ownerEmail) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'orgId, planId y ownerEmail son requeridos' }) }
  }

  if (!['test', 'prod'].includes(mode)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'mode debe ser "test" o "prod"' }) }
  }

  // Seleccionar access token según modo
  const accessToken = mode === 'prod'
    ? process.env.MP_ACCESS_TOKEN_PROD
    : process.env.MP_ACCESS_TOKEN_TEST

  if (!accessToken) {
    console.error(`[mp-create-sub] MP_ACCESS_TOKEN_${mode.toUpperCase()} no configurado`)
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Mercado Pago no configurado' }) }
  }

  try {
    // 1. Leer el plan de Firestore
    const planSnap = await db.collection('plans').doc(planId).get()
    if (!planSnap.exists) {
      return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Plan no encontrado' }) }
    }
    const plan = planSnap.data()

    if (!plan.monthlyMXN || plan.monthlyMXN <= 0) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Este plan no tiene precio en MXN configurado' }) }
    }

    // 2. Crear preapproval en Mercado Pago
    // API de preapproval (suscripciones sin plan previo, "sin template"):
    // https://www.mercadopago.com.mx/developers/es/reference/subscriptions/_preapproval/post
    const mpPayload = {
      reason: `Flow Hub CRM — ${plan.name}`,
      external_reference: orgId,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: plan.monthlyMXN,
        currency_id: 'MXN',
      },
      back_url: `${APP_URL}/?mp_result=success`,
    }

    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${orgId}-${planId}-${Date.now()}`,
      },
      body: JSON.stringify(mpPayload),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error('[mp-create-sub] Error MP API:', JSON.stringify(mpData))
      const cause = mpData.cause?.[0]?.description || mpData.error || ''
      const msg = [mpData.message, cause].filter(Boolean).join(' — ')
      return {
        statusCode: mpRes.status,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: msg || 'Error al crear suscripción en Mercado Pago', detail: mpData }),
      }
    }

    const preapprovalId = mpData.id
    const initPoint    = mpData.init_point

    if (!preapprovalId || !initPoint) {
      console.error('[mp-create-sub] Respuesta inesperada de MP:', JSON.stringify(mpData))
      return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Respuesta inesperada de Mercado Pago' }) }
    }

    // 3. Guardar en Firestore
    await db.collection('organizations').doc(orgId).update({
      mpPreapprovalId: preapprovalId,
      mpStatus: 'pending',
      mpInitPoint: initPoint,
      mpMode: mode,
      mpPlanId: planId,
      paymentProvider: 'mercadopago',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`[mp-create-sub] Preapproval creado: ${preapprovalId} para org ${orgId} (${orgName})`)

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ initPoint, preapprovalId }),
    }
  } catch (err) {
    console.error('[mp-create-sub] Error interno:', err.message)
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Error interno', detail: err.message }) }
  }
}
