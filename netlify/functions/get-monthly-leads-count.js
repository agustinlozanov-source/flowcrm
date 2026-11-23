// Consumo de UNA organización, para cuando se abre su ficha en el panel.
//
// La cuenta real la hace lib/consumo.js, que comparte con la tarea diaria
// medir-consumo. Esto es solo la puerta HTTP: tenerlo duplicado era lo que
// hacía que la pantalla y las alertas pudieran discrepar.
//
// Body  : { orgId: string, year?: number, month?: number }
// Return: { orgId, year, month, leadsCount, prevYear, prevMonth, prevLeadsCount, leadsIncluidos, pct, lastUpdated }

const admin = require('firebase-admin')
const { credencial } = require('./lib/credencial')
const Stripe = require('stripe')
const { medirOrg, periodoDe } = require('./lib/consumo')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credencial()),
  })
}

const db = admin.firestore()
const CORS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body || '{}') } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { orgId } = body
  if (!orgId || typeof orgId !== 'string' || !orgId.trim()) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'orgId is required' }) }
  }

  try {
    /* El mismo periodo con el que se cobra: el ciclo de la suscripción. Antes
     * contaba el mes calendario, así que la tarjeta decía 342 leads y «mes
     * anterior: 28» (octubre entero) mientras la factura cobraba sobre el
     * ciclo del 23 al 23, que tenía 367. Dos números para la misma pregunta.
     *
     * Sin avisos: los correos de 80% y 100% los manda la tarea diaria. Abrir
     * la ficha en el panel no debe mandarle nada al cliente. */
    let ciclo = null
    const org = (await db.collection('organizations').doc(orgId.trim()).get()).data() || {}
    if (org.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
      ciclo = await periodoDe(new Stripe(process.env.STRIPE_SECRET_KEY), org.stripeSubscriptionId)
        .catch(e => { console.warn('[get-monthly-leads-count] sin ciclo de Stripe:', e.message); return null })
    }
    const r = await medirOrg(db, orgId.trim(), ciclo
      ? { ...ciclo, avisos: false }
      : { year: body.year, month: body.month, avisos: false })
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(r) }
  } catch (err) {
    console.error('[get-monthly-leads-count] Error:', err.message)
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Internal error', detail: err.message }),
    }
  }
}
