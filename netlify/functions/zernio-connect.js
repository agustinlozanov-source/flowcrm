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
    await ensureWebhook()

    // 'ch' y no 'platform': Zernio agrega su propio platform= al volver.
    const redirectUrl = `${appUrl()}/.netlify/functions/zernio-callback?ch=${platform}`
    const params = new URLSearchParams({ profileId, redirect_url: redirectUrl })

    if (platform === 'whatsapp') {
      // Sin onboarding, Meta muestra la pantalla de coexistencia (conectar una
      // app de WhatsApp Business ya existente). Para un número de API hace
      // falta 'api', que es la que muestra el selector de WABA y número.
      params.set('onboarding', 'api')
      // Página guiada de Zernio con nuestra marca en vez del popup crudo de
      // Meta. Si el número ya está provisionado en el perfil, lo señala por
      // nombre y avisa que no le van a pedir código.
      params.set('signup', 'hosted')
      params.set('brandName', 'Flow Hub')
      params.set('primaryColor', '#3533cd')
      params.set('language', 'es')
    }
    // Estos parámetros son exclusivos de WhatsApp: en otra plataforma Zernio
    // los rechaza con 400 INVALID_FIELD_VALUE.

    const res = await zernioFetch(`/connect/${platform}?${params}`)
    if (!res.authUrl) throw new Error('Zernio no devolvió un authUrl')

    return { statusCode: 200, headers, body: JSON.stringify({ authUrl: res.authUrl }) }
  } catch (e) {
    console.error('zernio-connect error:', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
