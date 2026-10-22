// Creates a Stripe Checkout Session (subscription mode) for an org.
// The customer enters their card once; Stripe handles all future charges automatically.

const Stripe = require('stripe')
const admin = require('firebase-admin')
const { resolverPrecio } = require('./lib/precio')
const { credencial } = require('./lib/credencial')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credencial()),
  })
}

const db = admin.firestore()
const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const { orgId, stripePriceId, ownerEmail, orgName, currency, billingCycle } = JSON.parse(event.body)

    if (!orgId || !ownerEmail) {
      return { statusCode: 400, body: JSON.stringify({ error: 'orgId y ownerEmail son requeridos' }) }
    }

    const orgRef = db.collection('organizations').doc(orgId)
    const orgSnap = await orgRef.get()
    const orgData = orgSnap.data() || {}

    let precio, moneda
    try {
      ({ precio, moneda } = await resolverPrecio(db, orgId, {
        explicito: stripePriceId, monedaPedida: currency, ciclo: billingCycle, orgData,
      }))
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: e.message }) }
    }

    // Queda escrita en la organización: a partir de aquí Stripe la amarra, y
    // el resto del sistema necesita saber en qué moneda factura este cliente.
    if (moneda !== orgData.currency) await orgRef.update({ currency: moneda })

    // Crear o recuperar el Customer en Stripe. Se guarda en la organización
    // para que el mismo cliente no se duplique en cada intento de cobro.
    let customerId = orgData.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ownerEmail,
        name: orgName || orgData.name,
        metadata: { orgId, source: 'flowhub_superadmin' },
      })
      customerId = customer.id
      await orgRef.update({ stripeCustomerId: customerId })
    }

    const appUrl = process.env.APP_URL || 'https://flowhubcrm.app'

    // Crear Checkout Session en modo subscription
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: precio, quantity: 1 }],
      // Stripe ancla el ciclo al día en que el cliente completa el checkout
      subscription_data: {
        metadata: { orgId },
      },
      success_url: `${appUrl}/billing-success?session_id={CHECKOUT_SESSION_ID}&org=${orgId}`,
      cancel_url: `${appUrl}/billing-cancel?org=${orgId}`,
      metadata: { orgId },
    })

    // Guardar el sessionId en Firestore para referencia
    await orgRef.update({
      stripeCheckoutSessionId: session.id,
      billingStatus: 'pending_checkout',
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
    }
  } catch (err) {
    console.error('stripe-create-checkout error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
