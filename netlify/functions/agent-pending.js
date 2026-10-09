// Lista las conversaciones sin responder de las últimas 24 h, para que el
// Inbox pueda mostrar cuántas son ANTES de disparar el envío masivo.
const { initDb } = require('./lib/firebase')
const { findPending } = require('./lib/retry')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { orgId } = JSON.parse(event.body || '{}')
    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'orgId es requerido' }) }

    const pending = await findPending(initDb(), orgId)
    return { statusCode: 200, headers, body: JSON.stringify({ count: pending.length, leads: pending }) }
  } catch (e) {
    console.error('agent-pending error:', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
