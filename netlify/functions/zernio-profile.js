// Crea (idempotente) el perfil del cliente en Zernio y registra su webhook.
// Reemplaza al viejo POST /zernio/create-profile del backend de Railway.
const { initDb, ensureProfile, ensureWebhook } = require('./lib/zernio')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { orgId } = JSON.parse(event.body || '{}')
    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'orgId es requerido' }) }

    const db = initDb()
    const profileId = await ensureProfile(db, orgId)
    await ensureWebhook()

    return { statusCode: 200, headers, body: JSON.stringify({ profileId }) }
  } catch (e) {
    console.error('zernio-profile error:', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
