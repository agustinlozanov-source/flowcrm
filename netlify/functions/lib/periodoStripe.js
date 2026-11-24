/* Dónde guarda Stripe los periodos, que no es donde parece.
 *
 * 1. La suscripción ya no trae `current_period_start/end` arriba: viven en el
 *    ítem (`sub.items.data[0]`). Leerlos de arriba da undefined, y
 *    `new Date(undefined * 1000).toISOString()` revienta.
 *
 * 2. Una factura de renovación trae varias líneas, y la primera no siempre es
 *    la de la suscripción. Cuando se agregó el excedente de leads, la primera
 *    pasó a ser esa, cuyo periodo es el ciclo que acaba de cerrar. Por eso el
 *    23 de noviembre de 2026 Monte Sinai quedó con «próximo cobro: 23 nov»
 *    el mismo día que pagó el mes hasta el 23 de diciembre.
 */

const iso = (seg) => (Number.isFinite(seg) ? new Date(seg * 1000).toISOString() : null)

/** La línea de la factura que corresponde a la suscripción: la que termina
 *  más tarde. Las líneas sueltas (excedente, ajustes) cubren el ciclo que
 *  cerró, así que nunca le ganan. */
function lineaDeSuscripcion(invoice) {
  const lineas = invoice?.lines?.data || []
  const conPeriodo = lineas.filter(l => Number.isFinite(l?.period?.end))
  if (!conPeriodo.length) return null
  return conPeriodo.reduce((a, b) => (b.period.end > a.period.end ? b : a))
}

/** El periodo que paga una factura: { desde, hasta } en ISO, o nulls. */
function periodoDeFactura(invoice) {
  const l = lineaDeSuscripcion(invoice)
  return { desde: iso(l?.period?.start), hasta: iso(l?.period?.end) }
}

/** El ciclo vigente de una suscripción, en ISO. */
function periodoDeSuscripcion(sub) {
  const item = sub?.items?.data?.[0]
  return {
    desde: iso(item?.current_period_start ?? sub?.current_period_start),
    hasta: iso(item?.current_period_end ?? sub?.current_period_end),
  }
}

/** 'monthly' | 'annual' | null, según el precio de la suscripción. */
function cicloDeSuscripcion(sub) {
  const intervalo = sub?.items?.data?.[0]?.price?.recurring?.interval
  if (intervalo === 'year') return 'annual'
  if (intervalo === 'month') return 'monthly'
  return null
}

/** Lo mismo deducido de una factura, por el largo de su periodo. */
function cicloDeFactura(invoice) {
  const l = lineaDeSuscripcion(invoice)
  if (!l) return null
  const dias = (l.period.end - l.period.start) / 86400
  if (dias > 300) return 'annual'
  if (dias > 25) return 'monthly'
  return null
}

module.exports = { lineaDeSuscripcion, periodoDeFactura, periodoDeSuscripcion, cicloDeSuscripcion, cicloDeFactura }

/* El excedente de leads que viaja en una factura, si lo hay. Se reconoce por
 * la descripción que le pone stripe-webhook al crearlo («67 leads adicionales
 * · $15 MXN c/u»). Sirve para que el historial diga que ese cobro incluye
 * leads del ciclo anterior, y no parezca que se cobró de más. */
function excedenteDeFactura(invoice) {
  const linea = (invoice?.lines?.data || []).find(l => /leads adicionales/i.test(l?.description || ''))
  if (!linea) return null
  const leads = Number(String(linea.description).match(/^([\d.,]+)/)?.[1]?.replace(/[.,]/g, '')) || null
  return { leads, monto: (linea.amount || 0) / 100 }
}

module.exports.excedenteDeFactura = excedenteDeFactura
