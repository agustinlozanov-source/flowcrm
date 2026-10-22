// Creates or retrieves a Stripe Customer for an org, then attaches a payment method
// and optionally creates a subscription.
// Called from Superadmin Billing panel.

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
    const { orgId, orgName, ownerEmail, stripePriceId, paymentMethodId, billingCycle, currency } = JSON.parse(event.body)

    if (!orgId || !ownerEmail) {
      return { statusCode: 400, body: JSON.stringify({ error: 'orgId and ownerEmail are required' }) }
    }

    const orgRef = db.collection('organizations').doc(orgId)
    const orgSnap = await orgRef.get()
    const orgData = orgSnap.data() || {}

    // ── 1. Get or create Stripe Customer ──────────────────────────────────────
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

    // ── 2. Attach payment method if provided ──────────────────────────────────
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      })
    }

    // ── 3. Crear o cambiar la suscripción ─────────────────────────────────────
    let subscription = null
    {
      let precio, moneda
      try {
        ({ precio, moneda } = await resolverPrecio(db, orgId, {
          explicito: stripePriceId, monedaPedida: currency, ciclo: billingCycle, orgData,
        }))
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: e.message }) }
      }

      /* Subir o bajar de plan se hace actualizando la suscripción, no
       * cancelándola y creando otra.
       *
       * Cancelar y recrear cobraba el plan nuevo completo desde el día uno sin
       * devolver lo ya pagado del viejo, y además movía la fecha de corte a
       * hoy. Actualizando, Stripe prorratea la diferencia y respeta el ciclo.
       *
       * La excepción es la moneda: Stripe no deja cambiarla en una suscripción
       * viva, así que ahí sí hay que cancelar y volver a empezar. */
      const cambiaMoneda = orgData.currency && orgData.currency.toUpperCase() !== moneda
      const vigente = orgData.stripeSubscriptionId

      if (vigente && !cambiaMoneda) {
        const actual = await stripe.subscriptions.retrieve(vigente)
        if (['active', 'trialing', 'past_due'].includes(actual.status)) {
          subscription = await stripe.subscriptions.update(vigente, {
            items: [{ id: actual.items.data[0].id, price: precio }],
            proration_behavior: 'create_prorations',
            metadata: { orgId, billingCycle: billingCycle || 'monthly' },
          })
        }
      }

      if (!subscription) {
        if (vigente) {
          try { await stripe.subscriptions.cancel(vigente) } catch (_) {}
        }
        subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: precio }],
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent'],
          metadata: { orgId, billingCycle: billingCycle || 'monthly' },
        })
      }

      // Save to Firestore
      await orgRef.update({
        currency: moneda,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: subscription.status,
        stripePriceId: precio,
        billingCycle: billingCycle || 'monthly',
        nextBillingDate: new Date(subscription.current_period_end * 1000).toISOString(),
        billingUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        subscriptionId: subscription?.id,
        subscriptionStatus: subscription?.status,
        clientSecret: subscription?.latest_invoice?.payment_intent?.client_secret,
      }),
    }
  } catch (err) {
    console.error('stripe-create-customer error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
