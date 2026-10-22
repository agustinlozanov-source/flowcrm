// Handles Stripe webhooks:
// - invoice.created            → cobra el excedente de leads del ciclo que cierra
// - invoice.payment_succeeded  → mark org as paid, save receipt
// - invoice.payment_failed     → flag org, send alert
// - customer.subscription.deleted → mark org as cancelled

const Stripe = require('stripe')
const { medirOrg } = require('./lib/consumo')
const admin = require('firebase-admin')
const { credencial } = require('./lib/credencial')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credencial()),
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

      /* ── Factura en borrador: aquí se cobra el excedente de leads ─────────
       *
       * Cuando a un cliente le toca renovar, Stripe prepara la factura y
       * espera cerca de una hora antes de cobrarla. En esa ventana manda este
       * aviso y la factura todavía se puede editar: es el único momento en el
       * que se le puede agregar el excedente al mismo cargo.
       *
       * Cada cliente dispara su propio aviso el día que le corresponde, que
       * es justo lo que una tarea programada no podía hacer: el ciclo de cada
       * uno empieza el día que se suscribió, no el 1 del mes.
       *
       * El `invoice` en el item es obligatorio. Sin él, Stripe lo guarda como
       * pendiente y lo cobra en la factura SIGUIENTE — un mes tarde y sobre
       * el periodo equivocado.
       */
      case 'invoice.created': {
        // Solo las renovaciones. La primera factura no tiene periodo previo
        // que medir, y las manuales o de prorrateo no llevan excedente.
        if (data.billing_reason !== 'subscription_cycle') break
        /* La suscripción de una factura cambió de sitio: antes colgaba de
         * `invoice.subscription` y ahora de `parent.subscription_details`.
         * Se aceptan los dos para no depender de la versión de API con la
         * que Stripe firme el aviso. */
        const suscripcion = data.subscription || data.parent?.subscription_details?.subscription
        if (!suscripcion) break

        const orgSnap = await db.collection('organizations')
          .where('stripeCustomerId', '==', data.customer).limit(1).get()
        if (orgSnap.empty) break
        const orgDoc = orgSnap.docs[0]
        const org = orgDoc.data()

        /* El periodo que se cobra es el que la factura misma declara: el que
         * acaba de cerrarse. No se recalcula por nuestra cuenta — si Stripe
         * movió el ciclo por un cambio de plan, su número es el bueno. */
        const desde = new Date(data.period_start * 1000)
        const hasta = new Date(data.period_end * 1000)
        const clave = desde.toISOString().slice(0, 10)

        // Stripe reintenta los avisos. Sin esto, un reintento le cobraría dos
        // veces el mismo excedente al mismo cliente.
        if (org.excedenteCobrado?.[clave]) {
          console.log(`[stripe-webhook] excedente de ${clave} ya cobrado a ${org.name}`)
          break
        }

        const r = await medirOrg(db, orgDoc.id, { desde, hasta, avisos: false })
        if (!r.excedente || r.excedente <= 0) break

        const moneda = (org.currency || 'MXN').toUpperCase()
        const plan = org.planId ? (await db.collection('plans').doc(org.planId).get()).data() || {} : {}
        const porLead = moneda === 'USD' ? plan.precioLeadExtraUSD : plan.precioLeadExtraMXN

        if (!porLead || porLead <= 0) {
          console.warn(`[stripe-webhook] ${org.name}: ${r.excedente} leads de más y el plan no tiene precio por lead extra en ${moneda}`)
          break
        }

        const item = await stripe.invoiceItems.create({
          customer: data.customer,
          invoice: data.id,
          currency: moneda.toLowerCase(),
          amount: Math.round(r.excedente * porLead * 100),
          description: `${r.excedente.toLocaleString('es-MX')} leads adicionales · $${Number(porLead).toLocaleString('es-MX')} ${moneda} c/u`,
          metadata: { orgId: orgDoc.id, periodo: clave, leads: String(r.excedente) },
        })

        await orgDoc.ref.update({
          [`excedenteCobrado.${clave}`]: {
            invoiceItemId: item.id, invoiceId: data.id,
            leads: r.excedente, porLead, moneda,
            cobradoEn: new Date().toISOString(),
          },
        })
        console.log(`[stripe-webhook] ${org.name}: ${r.excedente} leads × ${porLead} ${moneda} → ${item.id}`)
        break
      }

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
