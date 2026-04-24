// Creates or retrieves a Stripe Customer for an org, then attaches a payment method
// and optionally creates a subscription.
// Called from Superadmin Billing panel.

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
    const { orgId, orgName, ownerEmail, stripePriceId, paymentMethodId, billingCycle } = JSON.parse(event.body)

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

    // ── 3. Create subscription if priceId provided ────────────────────────────
    let subscription = null
    if (stripePriceId) {
      // Cancel any existing active subscription first
      if (orgData.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(orgData.stripeSubscriptionId)
        } catch (_) {}
      }

      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: stripePriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { orgId, billingCycle: billingCycle || 'monthly' },
      })

      // Save to Firestore
      await orgRef.update({
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: subscription.status,
        stripePriceId,
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
