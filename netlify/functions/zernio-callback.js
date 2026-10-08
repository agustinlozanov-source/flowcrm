// Zernio devuelve al cliente acá al terminar (o cancelar) la conexión, con
// ?connected=...&profileId=...&accountId=...
// Esto solo normaliza el resultado para el toast de /settings. El estado real
// lo escribe zernio-webhook, que es la única fuente de verdad.
exports.handler = async (event) => {
  const p = event.queryStringParameters || {}
  const platform = p.ch || p.platform || 'whatsapp'
  // El éxito llega como connected=whatsapp (el nombre de la plataforma, no un
  // booleano); el fallo trae error=<motivo>. Comparar contra 'true' nunca daba.
  const ok = !p.error && !!p.connected
  const base = process.env.URL || process.env.DEPLOY_URL || 'https://flowhubcrm.app'

  // El motivo del fallo viaja para poder mostrarlo en vez de un error mudo.
  const qs = ok
    ? `${platform}=connected`
    : `${platform}=error&msg=${encodeURIComponent((p.error_message || p.error || '').slice(0, 120))}`

  return { statusCode: 302, headers: { Location: `${base}/settings?${qs}` }, body: '' }
}
