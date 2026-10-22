/* Cobra los leads que se pasaron del plan, una vez al mes.
 *
 * El medidor diario ya deja escrito cuántos leads de más lleva cada
 * organización. Esto lo convierte en dinero: al arrancar el mes, le agrega a
 * la próxima factura del cliente una línea con el excedente del mes que
 * acaba de cerrar.
 *
 * Se eligió agregar una línea a la factura y no un precio medido de Stripe a
 * propósito. Stripe hoy empuja los precios por consumo hacia Metronome, que
 * es una plataforma aparte y desproporcionada para cobrar unos pesos por
 * lead. Una línea de factura es una API vieja, estable y —lo que más
 * importa cuando vendes de la mano— legible: el cliente ve "340 leads
 * adicionales x $15.00" en vez de un cargo que no sabe de dónde salió.
 *
 * Dos clocks que no coinciden y conviene tener presentes: el cupo de leads
 * es por mes calendario, y el ciclo de cobro de Stripe empieza el día que
 * cada cliente se suscribió. Por eso la línea se agrega al cierre del mes
 * calendario y Stripe la cobra en la factura que le toque a cada uno.
 */
const admin = require('firebase-admin')
const Stripe = require('stripe')
const { credencial } = require('./lib/credencial')
const { medirOrg } = require('./lib/consumo')

let base = null
function laBase() {
  if (!base) {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(credencial()) })
    }
    base = admin.firestore()
  }
  return base
}

/** El mes que acaba de cerrar, en hora de México. */
function mesCerrado() {
  const mx = new Date(Date.now() - 6 * 60 * 60 * 1000)
  const y = mx.getUTCFullYear()
  const m = mx.getUTCMonth() + 1
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 }
}

exports.handler = async () => {
  const db = laBase()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const { year, month } = mesCerrado()
  const clave = `${year}-${String(month).padStart(2, '0')}`

  /* Se traen todas y se filtra aquí. Un `where('stripeSubscriptionId','!=',null)`
   * deja fuera los documentos que no tienen el campo y puede exigir un índice
   * compuesto; son unas decenas de organizaciones y no vale el riesgo. */
  const orgs = await db.collection('organizations').get()
  const resumen = { revisadas: 0, cobradas: 0, sinExcedente: 0, yaCobradas: 0, sinPrecio: 0, fallos: 0 }

  for (const org of orgs.docs) {
    const d = org.data()
    resumen.revisadas++

    try {
      // Una sola vez por mes y por organización. Sin esto, un reintento de la
      // tarea le cobraría dos veces el mismo excedente al mismo cliente.
      if (!d.stripeSubscriptionId || !d.stripeCustomerId) { resumen.revisadas--; continue }
      if (d.excedenteCobrado?.[clave]) { resumen.yaCobradas++; continue }

      // Se vuelve a medir el mes cerrado en vez de usar el `consumo` guardado:
      // ese lleva el mes en curso, no el que se va a cobrar.
      const r = await medirOrg(db, org.id, { year, month, avisos: false })
      if (!r.excedente || r.excedente <= 0) { resumen.sinExcedente++; continue }

      const moneda = (d.currency || 'MXN').toUpperCase()
      const plan = d.planId ? (await db.collection('plans').doc(d.planId).get()).data() || {} : {}
      const porLead = moneda === 'USD' ? plan.precioLeadExtraUSD : plan.precioLeadExtraMXN

      if (!porLead || porLead <= 0) {
        resumen.sinPrecio++
        console.warn(`[cobrar-excedente] ${r.orgName}: ${r.excedente} leads de más pero el plan no tiene precio por lead extra en ${moneda}`)
        continue
      }

      const mesLargo = new Date(Date.UTC(year, month - 1, 1))
        .toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })

      const item = await stripe.invoiceItems.create({
        customer: d.stripeCustomerId,
        subscription: d.stripeSubscriptionId,
        currency: moneda.toLowerCase(),
        // Stripe cobra en la unidad mínima: centavos.
        amount: Math.round(r.excedente * porLead * 100),
        description: `${r.excedente.toLocaleString('es-MX')} leads adicionales de ${mesLargo} · $${Number(porLead).toLocaleString('es-MX')} ${moneda} c/u`,
        metadata: { orgId: org.id, periodo: clave, leads: String(r.excedente) },
      })

      await org.ref.update({
        [`excedenteCobrado.${clave}`]: {
          invoiceItemId: item.id,
          leads: r.excedente,
          porLead,
          moneda,
          cobradoEn: new Date().toISOString(),
        },
      })

      resumen.cobradas++
      console.log(`[cobrar-excedente] ${r.orgName}: ${r.excedente} leads × ${porLead} ${moneda} → ${item.id}`)
    } catch (e) {
      resumen.fallos++
      console.error(`[cobrar-excedente] ${org.id}:`, e.message)
    }
  }

  console.log('[cobrar-excedente]', clave, JSON.stringify(resumen))
  return { statusCode: 200, body: JSON.stringify({ periodo: clave, ...resumen }) }
}
