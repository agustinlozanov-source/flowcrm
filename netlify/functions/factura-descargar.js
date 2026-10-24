/* Baja el PDF o el XML de una factura ya timbrada.
 *
 * No se guardan los archivos de nuestro lado: se piden al proveedor en el
 * momento. Guardarlos sería duplicar algo que ya está en dos sitios —el PAC y
 * el SAT— y que nunca cambia, a cambio de tener que sincronizarlo.
 *
 * El id de la factura no alcanza como permiso: se comprueba que esa factura
 * pertenezca a la organización que la pide. Sin eso, cualquiera con un id
 * podría bajarse el CFDI de otro.
 */
const admin = require('firebase-admin')
const { credencial } = require('./lib/credencial')
const facturacion = require('./lib/facturacion')

let base = null
function laBase() {
  if (!base) {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(credencial()) })
    }
    base = admin.firestore()
  }
  return base
}

exports.handler = async (event) => {
  const { orgId, facturaId, formato = 'pdf' } = event.queryStringParameters || {}
  if (!orgId || !facturaId) return { statusCode: 400, body: 'Faltan orgId y facturaId' }
  if (!['pdf', 'xml'].includes(formato)) return { statusCode: 400, body: 'Formato no válido' }

  try {
    const db = laBase()
    const snap = await db.collection('organizations').doc(orgId)
      .collection('facturas').where('facturapiId', '==', facturaId).limit(1).get()
    if (snap.empty) return { statusCode: 404, body: 'Esa factura no es de esta organización' }

    const f = snap.docs[0].data()
    const archivo = await facturacion.descargar(facturaId, formato)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': formato === 'pdf' ? 'application/pdf' : 'application/xml',
        'Content-Disposition': `attachment; filename="${f.folio || f.uuid || 'factura'}.${formato}"`,
      },
      body: archivo.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (e) {
    console.error('[factura-descargar]', e.message)
    return { statusCode: 500, body: e.message }
  }
}
