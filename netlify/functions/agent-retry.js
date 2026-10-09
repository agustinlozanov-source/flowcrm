// Reintenta la respuesta del agente en UNA conversación.
const { initDb } = require('./lib/firebase')
const { retryLead } = require('./lib/retry')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { orgId, leadId } = JSON.parse(event.body || '{}')
    if (!orgId || !leadId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'orgId y leadId son requeridos' }) }
    }
    const response = await retryLead(initDb(), orgId, leadId)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, response }) }
  } catch (e) {
    console.error('agent-retry error:', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
