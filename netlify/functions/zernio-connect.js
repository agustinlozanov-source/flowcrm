// Devuelve la URL de Zernio donde el cliente elige cómo conectar el canal.
// No construimos nosotros la pantalla de comprar número: Zernio muestra sus
// propias opciones, con sus precios y países reales, y maneja el OTP y el
// Embedded Signup de Meta según corresponda.
const { initDb, zernioFetch, appUrl, ensureProfile, ensureWebhook } = require('./lib/zernio')

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
    const profileId = await ensureProfile(db, orgId)
    await ensureWebhook(db, orgId, profileId)

    const redirectUrl = `${appUrl()}/.netlify/functions/zernio-callback?platform=${platform}`
    const res = await zernioFetch(
      `/connect/${platform}?profileId=${encodeURIComponent(profileId)}` +
      `&redirect_url=${encodeURIComponent(redirectUrl)}`
    )
    if (!res.authUrl) throw new Error('Zernio no devolvió un authUrl')

    return { statusCode: 200, headers, body: JSON.stringify({ authUrl: res.authUrl }) }
  } catch (e) {
    console.error('zernio-connect error:', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
