// Conecta una marca a Instagram con un token pegado a mano.
//
// Es el camino corto: en la consola de Meta, cada cuenta ya dada de alta tiene
// un botón "Generar token". Para dos o tres marcas propias eso es más rápido y
// más fiable que mandar a nadie por el OAuth.
const admin = require('firebase-admin')
const { initDb } = require('./lib/firebase')
const ig = require('./lib/instagram')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const responder = (statusCode, datos) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })

  try {
    const { orgId, brandId, token } = JSON.parse(event.body || '{}')
    if (!orgId || !brandId || !token) return responder(400, { error: 'FALTAN_DATOS' })

    const db = initDb()
    const marca = await ig.marcaRef(db, orgId, brandId).get()
    if (!marca.exists) return responder(404, { error: 'MARCA_NO_EXISTE' })

    // El token de la consola ya es largo, pero el de un flujo manual puede ser
    // corto. Se intenta canjear y si ya era largo, Instagram se queja y nos
    // quedamos con el que nos dieron.
    let tokenFinal = token.trim()
    try {
      const largo = await ig.aTokenLargo(tokenFinal)
      if (largo?.access_token) tokenFinal = largo.access_token
    } catch { /* ya era largo */ }

    // Antes de guardar nada, comprobamos que sirve. Guardar un token muerto
    // deja la marca "conectada" sin estarlo.
    const datos = await ig.perfil(tokenFinal)

    await ig.guardarConexion(db, orgId, brandId, { token: tokenFinal, perfil: datos, admin })

    return responder(200, {
      ok: true,
      username: datos.username,
      seguidores: datos.followers_count ?? null,
      tipoDeCuenta: datos.account_type || null,
    })
  } catch (e) {
    console.error('instagram-connect error:', e)
    // El error de Instagram dice mucho más que un 500 pelado: lo pasamos tal
    // cual para que la pantalla pueda explicarlo.
    return responder(400, { error: 'NO_SE_PUDO_CONECTAR', detalle: e.message })
  }
}
