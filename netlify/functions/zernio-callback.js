// Zernio devuelve al cliente acá al terminar (o cancelar) la conexión, con
// ?connected=...&profileId=...&accountId=...
// Esto solo normaliza el resultado para el toast de /settings. El estado real
// lo escribe zernio-webhook, que es la única fuente de verdad.
exports.handler = async (event) => {
  const p = event.queryStringParameters || {}
  const platform = p.platform || 'whatsapp'
  const ok = p.connected === 'true' || p.connected === '1'
  const base = process.env.URL || process.env.DEPLOY_URL || 'https://app.flowhubcrm.app'

  return {
    statusCode: 302,
    headers: { Location: `${base}/settings?${platform}=${ok ? 'connected' : 'error'}` },
    body: '',
  }
}
