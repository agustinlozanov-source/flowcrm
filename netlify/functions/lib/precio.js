/* De qué precio de Stripe se cobra a una organización.
 *
 * El precio vive en el plan, no en el cliente: el plan guarda un Price ID por
 * moneda y la organización dice en cuál paga. Antes había que pegarlo a mano
 * por organización, así que el mismo plan podía terminar cobrando distinto en
 * dos cuentas sin que nadie lo notara.
 *
 * Vive aquí y no dentro de una función porque lo necesitan las dos vías de
 * alta —crear la suscripción y mandar el link de pago— y tenerlo duplicado es
 * cómo se desincronizan.
 */

/**
 * @returns {{ precio: string, moneda: string }}
 * @throws  {Error} con un mensaje que se le puede enseñar a quien lo configura
 */
async function resolverPrecio(db, orgId, { explicito, monedaPedida, ciclo, orgData }) {
  const moneda = (monedaPedida || orgData?.currency || 'MXN').toUpperCase()
  const anual = String(ciclo || orgData?.billingCycle || 'monthly').toLowerCase().startsWith('a')

  // Un Price ID explícito manda: hace falta para casos sueltos y para no
  // romper lo que ya está andando con precios pegados a mano.
  if (explicito) return { precio: explicito, moneda }

  if (!orgData?.planId) {
    throw new Error('La organización no tiene plan asignado y no se mandó un Price ID.')
  }

  const plan = (await db.collection('plans').doc(orgData.planId).get()).data() || {}

  /* Cuatro casillas: dos monedas por dos ciclos. El anual no es el mensual
   * por doce — son diez meses— así que es un precio propio en Stripe y tiene
   * que tener su propio Price ID. */
  const campo = moneda === 'USD'
    ? (anual ? 'stripePriceIdUSDAnual' : 'stripePriceIdUSD')
    : (anual ? 'stripePriceIdMXNAnual' : 'stripePriceIdMXN')
  const precio = plan[campo]

  if (!precio) {
    throw new Error(`El plan "${plan.name || orgData.planId}" no tiene Price ID de Stripe ${anual ? 'anual' : 'mensual'} en ${moneda}. Configúralo en Superadmin → Planes.`)
  }
  return { precio, moneda, anual }
}

module.exports = { resolverPrecio }
