// Desconecta un canal del lado de FlowHub. La cuenta sigue vinculada en Zernio:
// esto solo deja de considerarla activa acá, igual que hace phot8can. Para
// soltarla también en Zernio hay que hacerlo desde su portal.
const admin = require('firebase-admin')
const { initDb } = require('./lib/zernio')

const PLATFORMS = ['whatsapp', 'facebook', 'instagram', 'telegram']

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { orgId, platform } = JSON.parse(event.body || '{}')
    if (!orgId || !PLATFORMS.includes(platform)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'orgId y platform válidos son requeridos' }) }
    }

    const db = initDb()
    await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations')
      .set({
        [platform]: {
          connected: false,
          accountId: null,
          disconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }, { merge: true })

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
  } catch (e) {
    console.error('zernio-disconnect error:', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
