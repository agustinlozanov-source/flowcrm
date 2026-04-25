// Billing actions: cancel subscription, sync status from Stripe, record manual payment
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
    const { action, orgId, note, amount, currency } = JSON.parse(event.body)

    if (!orgId) return { statusCode: 400, body: JSON.stringify({ error: 'orgId required' }) }

    const orgRef = db.collection('organizations').doc(orgId)
    const orgSnap = await orgRef.get()
    const orgData = orgSnap.data() || {}

    // ── Cancel subscription ────────────────────────────────────────────────
    if (action === 'cancel') {
      if (orgData.stripeSubscriptionId) {
        await stripe.subscriptions.cancel(orgData.stripeSubscriptionId)
      }
      await orgRef.update({
        stripeSubscriptionStatus: 'cancelled',
        billingStatus: 'cancelled',
        stripeSubscriptionId: null,
      })
      return { statusCode: 200, body: JSON.stringify({ ok: true }) }
    }

    // ── Sync status from Stripe ────────────────────────────────────────────
    if (action === 'sync') {
      let sub = null

      if (orgData.stripeSubscriptionId) {
        sub = await stripe.subscriptions.retrieve(orgData.stripeSubscriptionId, { expand: ['latest_invoice'] })
      } else if (orgData.stripeCustomerId) {
        const subs = await stripe.subscriptions.list({ customer: orgData.stripeCustomerId, limit: 1, status: 'all', expand: ['data.latest_invoice'] })
        sub = subs.data[0] || null
      }

      if (!sub) {
        return { statusCode: 200, body: JSON.stringify({ status: 'no_subscription' }) }
      }

      const invoice = sub.latest_invoice
      const periodEnd = sub.current_period_end
      const lastPayment = invoice?.status === 'paid' ? new Date(invoice.created * 1000).toISOString() : null

      await orgRef.update({
        stripeSubscriptionId: sub.id,
        stripeSubscriptionStatus: sub.status,
        billingStatus: sub.status === 'active' ? 'paid' : sub.status,
        ...(periodEnd ? { nextBillingDate: new Date(periodEnd * 1000).toISOString() } : {}),
        ...(lastPayment ? { lastPaymentDate: lastPayment } : {}),
      })

      // Guardar recibo si existe una invoice pagada y no está ya registrada
      if (invoice?.status === 'paid' && invoice?.id) {
        const existingReceipt = await db.collection('organizations').doc(orgId)
          .collection('billing_receipts').where('invoiceId', '==', invoice.id).limit(1).get()
        if (existingReceipt.empty) {
          const periodEndInv = invoice.lines?.data?.[0]?.period?.end
          await db.collection('organizations').doc(orgId).collection('billing_receipts').add({
            invoiceId: invoice.id,
            amountPaid: (invoice.amount_paid || 0) / 100,
            currency: (invoice.currency || 'usd').toUpperCase(),
            periodStart: invoice.lines?.data?.[0]?.period?.start ? new Date(invoice.lines.data[0].period.start * 1000).toISOString() : null,
            periodEnd: periodEndInv ? new Date(periodEndInv * 1000).toISOString() : null,
            pdfUrl: invoice.invoice_pdf || null,
            hostedUrl: invoice.hosted_invoice_url || null,
            status: 'paid',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }
      }

      return { statusCode: 200, body: JSON.stringify({ status: sub.status, subscriptionId: sub.id }) }
    }

    // ── Record manual payment (cash / transfer / etc.) ────────────────────
    if (action === 'manual_payment') {
      const receipt = {
        invoiceId: `manual_${Date.now()}`,
        amountPaid: amount || 0,
        currency: currency || 'USD',
        note: note || 'Pago manual registrado por Superadmin',
        status: 'paid',
        manual: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }
      await db.collection('organizations').doc(orgId)
        .collection('billing_receipts').add(receipt)
      await orgRef.update({
        billingStatus: 'paid',
        lastPaymentDate: new Date().toISOString(),
        paymentFailedCount: 0,
      })
      return { statusCode: 200, body: JSON.stringify({ ok: true }) }
    }

    // ── Get receipts ──────────────────────────────────────────────────────
    if (action === 'get_receipts') {
      const snap = await db.collection('organizations').doc(orgId)
        .collection('billing_receipts')
        .orderBy('createdAt', 'desc')
        .limit(24)
        .get()
      const receipts = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() }))
      return { statusCode: 200, body: JSON.stringify({ receipts }) }
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) }

  } catch (err) {
    console.error('stripe-billing-action error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
