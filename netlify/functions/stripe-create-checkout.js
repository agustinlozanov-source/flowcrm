// Creates a Stripe Checkout Session (subscription mode) for an org.
// The customer enters their card once; Stripe handles all future charges automatically.

const Stripe = require('stripe')
const admin = require('firebase-admin')
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
    const { orgId, stripePriceId, ownerEmail, orgName, currency } = JSON.parse(event.body)

    if (!orgId || !ownerEmail) {
      return { statusCode: 400, body: JSON.stringify({ error: 'orgId y ownerEmail son requeridos' }) }
    }

    const orgRef = db.collection('organizations').doc(orgId)
    const orgSnap = await orgRef.get()
    const orgData = orgSnap.data() || {}

    /* El precio vive en el plan, no en el cliente.
     *
     * Antes había que pegar el Price ID a mano por organización, así que el
     * mismo plan podía quedar cobrando distinto en dos cuentas sin que nadie
     * lo notara. Ahora se resuelve: el plan guarda su Price ID en cada moneda
     * y la organización dice en cuál paga.
     *
     * Stripe amarra al cliente a una moneda en cuanto tiene suscripción
     * activa, así que esto se decide una vez y no se cambia sin cancelar.
     *
     * El Price ID explícito sigue aceptándose y manda sobre el del plan: hace
     * falta para casos sueltos y para no romper lo que ya está andando. */
    let precio = stripePriceId || null
    const moneda = (currency || orgData.currency || 'MXN').toUpperCase()

    // Queda escrita en la organización: a partir de aquí Stripe la amarra, y
    // el resto del sistema necesita saber en qué moneda factura este cliente.
    if (moneda !== orgData.currency) await orgRef.update({ currency: moneda })

    if (!precio) {
      if (!orgData.planId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'La organización no tiene plan asignado y no se mandó un Price ID' }) }
      }
      const plan = (await db.collection('plans').doc(orgData.planId).get()).data() || {}
      precio = moneda === 'USD' ? plan.stripePriceIdUSD : plan.stripePriceIdMXN
      if (!precio) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `El plan "${plan.name || orgData.planId}" no tiene Price ID de Stripe en ${moneda}. Configúralo en Superadmin → Planes.` }),
        }
      }
    }

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
