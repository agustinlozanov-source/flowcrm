// Inicia el OAuth de Google Calendar. Reemplaza a GET /meetings/auth/google.
const { authUrl } = require('./lib/google')

exports.handler = async (event) => {
  const { orgId, redirect } = event.queryStringParameters || {}
  if (!orgId) return { statusCode: 400, body: 'orgId es requerido' }
  if (!process.env.GOOGLE_CLIENT_ID) return { statusCode: 500, body: 'GOOGLE_CLIENT_ID no está configurada' }

  // El state viaja hasta el callback: lleva la org y a qué pantalla volver.
  const state = `${orgId}|${redirect === 'settings' ? 'settings' : 'meetings'}`
  return { statusCode: 302, headers: { Location: authUrl(state) }, body: '' }
}
