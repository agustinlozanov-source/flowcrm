/* Desconecta el Instagram de una marca.
 *
 * Borra el índice que usa el webhook, el token guardado y los datos de la
 * cuenta en la marca, y le pide a Meta que deje de mandar sus eventos. Desde
 * ese momento lo que le escriban a esa cuenta no entra a FlowHub.
 *
 * La pantalla lo llama al pulsar «Desconectar» y también antes de borrar una
 * marca: borrar solo la ficha dejaba la cuenta conectada por debajo.
 *
 * Quién puede llamar: alguien con sesión en esa organización, o un superadmin.
 */
const admin = require('firebase-admin')
const { initDb } = require('./lib/firebase')
const ig = require('./lib/instagram')

const responder = (statusCode, datos) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(datos),
})

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return responder(405, { error: 'Method Not Allowed' })

  let orgId, brandId
  try {
    ({ orgId, brandId } = JSON.parse(event.body || '{}'))
  } catch {
    return responder(400, { error: 'Cuerpo inválido' })
  }
  if (!orgId || !brandId) return responder(400, { error: 'Faltan orgId y brandId' })

  let db
  try {
    db = initDb()
  } catch (e) {
    return responder(500, { error: e.message })
  }

  const cabecera = event.headers.authorization || event.headers.Authorization || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : ''
  if (!token) return responder(401, { error: 'Falta el token de sesión' })
  let claims
  try {
    claims = await admin.auth().verifyIdToken(token)
  } catch {
    return responder(401, { error: 'Token inválido o expirado' })
  }
  if (claims.orgId !== orgId && claims.superadmin !== true) {
    return responder(403, { error: 'Esta organización no es tuya' })
  }

  try {
    const marca = await ig.marcaRef(db, orgId, brandId).get()
    const igUserId = marca.exists ? String(marca.data()?.ig?.userId || '') : ''

    await ig.soltarCuenta(db, { igUserId, orgId, brandId, admin })

    /* Cualquier otra entrada del índice que apunte a esta marca es de una
     * conexión anterior que nunca se limpió. Se va también. */
    const viejas = await db.collection('_ig_cuentas')
      .where('orgId', '==', orgId).where('brandId', '==', brandId).get()
    await Promise.all(viejas.docs.map(d => d.ref.delete()))

    return responder(200, { ok: true, soltadas: viejas.size + (igUserId ? 1 : 0) })
  } catch (e) {
    console.error('instagram-desconectar:', e)
    return responder(500, { error: e.message })
  }
}
