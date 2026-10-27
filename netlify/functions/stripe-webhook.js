// Handles Stripe webhooks:
// - invoice.created            → cobra el excedente de leads del ciclo que cierra
// - invoice.payment_succeeded  → mark org as paid, save receipt
// - invoice.payment_failed     → flag org, send alert
// - customer.subscription.deleted → mark org as cancelled

const Stripe = require('stripe')
const { medirOrg } = require('./lib/consumo')
const facturacion = require('./lib/facturacion')
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

        /* Una factura pagada ES la prueba de que la suscripción está viva, así
         * que acá también se guarda su id.
         *
         * Antes no: el id lo escribía solo `checkout.session.completed`, y ese
         * evento se salta en silencio si le falta el metadata del orgId o si
         * no viene suscripción. Cuando eso pasaba quedaba lo peor de los dos
         * mundos — el cobro registrado y el recibo en el historial, pero la
         * pantalla mostrando "Sin activar", porque mira ese id. */
        const suscripcionPagada = data.subscription || data.parent?.subscription_details?.subscription

        await orgDoc.ref.update({
          stripeSubscriptionStatus: 'active',
          billingStatus: 'paid',
          lastPaymentDate: new Date(data.created * 1000).toISOString(),
          nextBillingDate: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          paymentFailedCount: 0,
          ...(suscripcionPagada ? { stripeSubscriptionId: suscripcionPagada } : {}),
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

        /* Y su factura, timbrada y enviada, sin que nadie mande un correo.
         *
         * Era la fricción que motivó todo esto: el cliente pagaba y después
         * tenía que pedir su factura por WhatsApp. Ahora pagó, y le llega.
         *
         * Va después de guardar el recibo y en su propio try: si el timbrado
         * falla —un RFC mal capturado, el SAT caído—, el pago ya quedó
         * registrado y la suscripción activa. Nunca al revés. */
        try {
          const org = orgDoc.data()
          const fiscal = org.fiscal || {}
          const yaFacturada = (await db.collection('organizations').doc(orgId)
            .collection('facturas').where('stripeInvoiceId', '==', data.id).limit(1).get())

          if (!yaFacturada.empty) {
            console.log(`[stripe-webhook] ${data.id} ya tiene CFDI`)
          } else {
            const mes = new Date((data.period_start || data.created) * 1000)
              .toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })

            const cfdi = await facturacion.emitir({
              fiscal,
              concepto: {
                descripcion: `Suscripción FlowHub CRM · ${org.planName || 'Plan'} · ${mes}`,
                total: data.amount_paid / 100,
              },
              email: org.ownerEmail,
            })

            /* Una factura de sandbox NO se le manda al cliente.
             *
             * Con la llave de pruebas el timbrado funciona igual, pero el
             * CFDI no tiene valor fiscal. Mandárselo sería peor que no
             * mandar nada: recibe algo que parece una factura, la da por
             * buena, y se entera en su cierre de mes. Se timbra y se guarda
             * para poder revisarla, y se envía solo en producción. */
            if (facturacion.esPrueba()) {
              console.warn(`[stripe-webhook] CFDI de PRUEBA para ${org.name} — no se envía. Cambia FACTURAPI_KEY por la de producción para facturar de verdad.`)
            } else {
              await facturacion.enviarPorCorreo(cfdi.id, org.ownerEmail)
                .catch(e => console.error('[stripe-webhook] timbrada pero no se pudo enviar:', e.message))
            }

            await db.collection('organizations').doc(orgId).collection('facturas').add({
              facturapiId: cfdi.id,
              uuid: cfdi.uuid,
              folio: `${cfdi.series || ''}${cfdi.folio_number || ''}`,
              total: cfdi.total,
              status: cfdi.status,
              verificacion: cfdi.verification_url,
              // Marca si salió del entorno de pruebas: una factura de sandbox
              // no tiene valor fiscal y no debe confundirse con una real.
              prueba: facturacion.esPrueba(),
              stripeInvoiceId: data.id,
              enviadaA: facturacion.esPrueba() ? null : (org.ownerEmail || null),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            })

            await orgDoc.ref.update({ facturaPendiente: admin.firestore.FieldValue.delete() })
            console.log(`[stripe-webhook] CFDI ${cfdi.uuid} para ${org.name}`)
          }
        } catch (e) {
          /* Queda anotado como pendiente con el motivo exacto, sea que falten
           * datos fiscales o que el SAT esté caído. El panel lo muestra y se
           * puede timbrar después sin perder el pago. Un CFDI con datos
           * adivinados sería peor que ninguno. */
          console.error('[stripe-webhook] no se pudo timbrar:', e.message)
          await orgDoc.ref.update({
            facturaPendiente: {
              stripeInvoiceId: data.id,
              total: data.amount_paid / 100,
              motivo: e.message,
              desde: new Date().toISOString(),
            },
          }).catch(() => {})
        }
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

        const orgCancelada = orgSnap.docs[0]
        await orgCancelada.ref.update({
          stripeSubscriptionStatus: 'cancelled',
          billingStatus: 'cancelled',
          stripeSubscriptionId: null,
          canceladaEn: new Date().toISOString(),
          motivoCancelacion: data.cancellation_details?.feedback || null,
          comentarioCancelacion: data.cancellation_details?.comment || null,
        })

        /* Avisarle al dueño del negocio, en el momento.
         *
         * El portal de Stripe deja al cliente cancelarse solo —y está bien
         * que así sea—, pero hasta ahora eso ocurría en silencio: la
         * organización quedaba marcada como cancelada y nadie se enteraba
         * hasta entrar a mirar. Enterarse el mismo día es la diferencia entre
         * poder llamar y recuperar al cliente, o descubrirlo un mes después.
         *
         * El destinatario sale del superadmin guardado en la base, no de una
         * variable de entorno: así no hay un correo que mantener en dos sitios.
         */
        try {
          const admins = await db.collection('users').where('role', '==', 'superadmin').limit(1).get()
          const para = admins.empty ? null : admins.docs[0].data()?.email
          if (!para) {
            console.warn('[stripe-webhook] canceló una org y no hay superadmin con correo a quien avisar')
          } else {
            const o = orgCancelada.data()
            const motivo = data.cancellation_details?.feedback || 'no lo dijo'
            const comentario = data.cancellation_details?.comment
            await fetch(`${process.env.URL || 'https://flowhubcrm.app'}/.netlify/functions/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'custom',
                to: para,
                data: {
                  subject: `Canceló ${o.name || orgCancelada.id}`,
                  bodyHtml: [
                    `<b>${o.name || orgCancelada.id}</b> acaba de cancelar desde el portal de Stripe.`,
                    `Plan: ${o.planName || o.planId || '—'}`,
                    `Motivo que dio: ${motivo}`,
                    comentario ? `Lo que escribió: "${comentario}"` : null,
                    `Contacto: ${o.ownerEmail || '—'}`,
                    'Sigue teniendo acceso hasta que termine el periodo que ya pagó.',
                  ].filter(Boolean).map(l => `<p style="margin:0 0 14px;font-size:15px;color:#3a3a3c;line-height:1.6;">${l}</p>`).join(''),
                },
              }),
            })
          }
        } catch (e) {
          // Que no se caiga el webhook por no poder mandar un correo: lo
          // importante —marcar la organización— ya ocurrió arriba.
          console.error('[stripe-webhook] no se pudo avisar la cancelación:', e.message)
        }
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
