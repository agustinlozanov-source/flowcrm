// Manda al usuario a Instagram a autorizar la conexión de una marca.
const ig = require('./lib/instagram')

exports.handler = async (event) => {
  const { orgId, brandId } = event.queryStringParameters || {}
  if (!orgId || !brandId) return { statusCode: 400, body: 'Faltan orgId y brandId' }
  if (!process.env.IG_APP_ID) return { statusCode: 500, body: 'IG_APP_ID no está configurada' }

  return {
    statusCode: 302,
    headers: { Location: ig.authUrl(`${orgId}|${brandId}`) },
    body: '',
  }
}
