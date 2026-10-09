// Responde en lote las conversaciones colgadas. Es una Background Function
// (el sufijo -background lo define): devuelve 202 al instante y sigue hasta
// 15 minutos, porque cada respuesta es una llamada al modelo de varios
// segundos y una función normal se corta a los 26.
//
// No devuelve resultado al navegador: el Inbox escucha Firestore y las
// respuestas van apareciendo solas.
const { initDb } = require('./lib/firebase')
const { retryLead } = require('./lib/retry')

// Tope duro: esto le manda WhatsApp a personas reales. Si hay más, se corre
// de nuevo. Mejor dos tandas que un envío masivo imposible de frenar.
const MAX = 50

exports.handler = async (event) => {
  const { orgId, leadIds } = JSON.parse(event.body || '{}')
  if (!orgId || !Array.isArray(leadIds) || !leadIds.length) {
    console.error('[bulk] faltan orgId o leadIds')
    return { statusCode: 400 }
  }

  const db = initDb()
  const targets = leadIds.slice(0, MAX)
  let ok = 0
  const fallos = []

  console.log(`[bulk] arrancando ${targets.length} de ${leadIds.length} pedidos (org ${orgId})`)

  for (const leadId of targets) {
    try {
      await retryLead(db, orgId, leadId)
      ok++
    } catch (e) {
      fallos.push(`${leadId}: ${e.message}`)
    }
    // Un respiro entre envíos: evita castigar los límites de tasa del modelo
    // y de WhatsApp si la tanda es grande.
    await new Promise(r => setTimeout(r, 1200))
  }

  console.log(`[bulk] terminado — ${ok} respondidas, ${fallos.length} con error`)
  if (fallos.length) console.error('[bulk] fallos:\n' + fallos.join('\n'))

  return { statusCode: 200 }
}
