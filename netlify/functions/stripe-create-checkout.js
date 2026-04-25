// Creates a Stripe Checkout Session (subscription mode) for an org.
// The customer enters their card once; Stripe handles all future charges automatically.

const Stripe = require('stripe')
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
const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const { orgId, stripePriceId, ownerEmail, orgName } = JSON.parse(event.body)

    if (!orgId || !stripePriceId || !ownerEmail) {
      return { statusCode: 400, body: JSON.stringify({ error: 'orgId, stripePriceId y ownerEmail son requeridos' }) }
    }

    const orgRef = db.collection('organizations').doc(orgId)
    const orgSnap = await orgRef.get()
    const orgData = orgSnap.data() || {}

    // Crear o recuperar Customer en Stripe
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
      line_items: [{ price: stripePriceId, quantity: 1 }],
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
