// Vuelta de Instagram: canjea el código, guarda el token largo y devuelve al
// usuario a su marca.
//
// Meta pide además una URL de desautorización y otra de borrado de datos. Son
// la misma función con ?action=, porque pedirle tres endpoints a Netlify para
// esto no aporta nada.
const admin = require('firebase-admin')
const { initDb } = require('./lib/firebase')
const ig = require('./lib/instagram')

exports.handler = async (event) => {
  const { code, state, error, action } = event.queryStringParameters || {}

  // Meta llama aquí cuando alguien quita la app desde Instagram, o cuando pide
  // que borremos sus datos. Confirmamos recepción; el borrado real lo hace el
  // dueño de la cuenta desde FlowCRM.
  if (action === 'deauth' || action === 'delete') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `${ig.appUrl()}/marcas`, confirmation_code: String(Date.now()) }),
    }
  }

  const [orgId, brandId] = (state || '').split('|')
  const volver = (estado, msg) => ({
    statusCode: 302,
    headers: {
      Location: `${ig.appUrl()}/marcas?ig=${estado}${msg ? `&msg=${encodeURIComponent(String(msg).slice(0, 120))}` : ''}`,
    },
    body: '',
  })

  // El usuario puede cancelar en la pantalla de Instagram.
  if (error || !code || !orgId || !brandId) return volver('error', error)

  try {
    const corto = await ig.canjearCodigo(code)
    const largo = await ig.aTokenLargo(corto.access_token)
    const token = largo?.access_token || corto.access_token

    const datos = await ig.perfil(token)
    const db = initDb()
    await ig.guardarConexion(db, orgId, brandId, { token, perfil: datos, admin })

    return volver('connected')
  } catch (e) {
    console.error('instagram-callback error:', e)
    return volver('error', e.message)
  }
}
