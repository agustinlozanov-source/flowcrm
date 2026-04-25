// Handles Stripe webhooks:
// - invoice.payment_succeeded  → mark org as paid, save receipt
// - invoice.payment_failed     → flag org, send alert
// - customer.subscription.deleted → mark org as cancelled

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
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  let stripeEvent
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return { statusCode: 400, body: `Webhook Error: ${err.message}` }
  }

  const data = stripeEvent.data.object

  try {
    switch (stripeEvent.type) {

      // ── Payment succeeded ──────────────────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const customerId = data.customer
        const orgSnap = await db.collection('organizations')
          .where('stripeCustomerId', '==', customerId).limit(1).get()
        if (orgSnap.empty) break

        const orgDoc = orgSnap.docs[0]
        const orgId = orgDoc.id
        const periodEnd = data.lines?.data?.[0]?.period?.end

        // Update org status
        await orgDoc.ref.update({
          stripeSubscriptionStatus: 'active',
          billingStatus: 'paid',
          lastPaymentDate: new Date(data.created * 1000).toISOString(),
          nextBillingDate: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          paymentFailedCount: 0,
        })

        // Save receipt to subcollection
        await db.collection('organizations').doc(orgId)
          .collection('billing_receipts').add({
            invoiceId: data.id,
            amountPaid: data.amount_paid / 100,
            currency: data.currency.toUpperCase(),
            periodStart: data.period_start ? new Date(data.period_start * 1000).toISOString() : null,
            periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            pdfUrl: data.invoice_pdf,
            hostedUrl: data.hosted_invoice_url,
            status: 'paid',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        break
      }

      // ── Payment failed ─────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const customerId = data.customer
        const orgSnap = await db.collection('organizations')
          .where('stripeCustomerId', '==', customerId).limit(1).get()
        if (orgSnap.empty) break

        const orgDoc = orgSnap.docs[0]
        const current = orgDoc.data()
        const failCount = (current.paymentFailedCount || 0) + 1

        await orgDoc.ref.update({
          billingStatus: 'past_due',
          stripeSubscriptionStatus: 'past_due',
          paymentFailedCount: failCount,
          lastPaymentFailedAt: new Date(data.created * 1000).toISOString(),
        })
        break
      }

      // ── Subscription deleted ───────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const customerId = data.customer
        const orgSnap = await db.collection('organizations')
          .where('stripeCustomerId', '==', customerId).limit(1).get()
        if (orgSnap.empty) break

        await orgSnap.docs[0].ref.update({
          stripeSubscriptionStatus: 'cancelled',
          billingStatus: 'cancelled',
          stripeSubscriptionId: null,
        })
        break
      }

      // ── Checkout completed → suscripción activa ───────────────────────────
      case 'checkout.session.completed': {
        const orgId = data.metadata?.orgId
        if (!orgId) break

        const subscriptionId = data.subscription
        let nextBillingDate = null

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          nextBillingDate = new Date(sub.current_period_end * 1000).toISOString()

          await db.collection('organizations').doc(orgId).update({
            stripeSubscriptionId: subscriptionId,
            stripeSubscriptionStatus: 'active',
            billingStatus: 'paid',
            nextBillingDate,
            stripeCheckoutSessionId: data.id,
          })
        }
        break
      }

      // ── Subscription updated (plan change) ────────────────────────────────
      case 'customer.subscription.updated': {
        const customerId = data.customer
        const orgSnap = await db.collection('organizations')
          .where('stripeCustomerId', '==', customerId).limit(1).get()
        if (orgSnap.empty) break

        await orgSnap.docs[0].ref.update({
          stripeSubscriptionStatus: data.status,
          billingStatus: data.status === 'active' ? 'paid' : data.status,
          nextBillingDate: new Date(data.current_period_end * 1000).toISOString(),
        })
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return { statusCode: 500, body: 'Webhook handler failed' }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}
