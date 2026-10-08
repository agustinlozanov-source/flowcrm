// Recibe el code de Google, guarda los tokens y devuelve al usuario.
// Reemplaza a GET /meetings/auth/google/callback.
const { initDb } = require('./lib/firebase')
const { exchangeCode, saveTokens, appUrl } = require('./lib/google')

exports.handler = async (event) => {
  const { code, state, error } = event.queryStringParameters || {}
  const [orgId, page = 'meetings'] = (state || '').split('|')
  const back = (status) => ({
    statusCode: 302,
    headers: { Location: `${appUrl()}/${page}?google=${status}` },
    body: '',
  })

  // El usuario puede cancelar en la pantalla de Google.
  if (error || !code || !orgId) return back('error')

  try {
    const tokens = await exchangeCode(code)
    await saveTokens(initDb(), orgId, tokens)
    return back('connected')
  } catch (e) {
    console.error('google-callback error:', e)
    return {
      statusCode: 302,
      headers: { Location: `${appUrl()}/${page}?google=error&msg=${encodeURIComponent(e.message.slice(0, 120))}` },
      body: '',
    }
  }
}
