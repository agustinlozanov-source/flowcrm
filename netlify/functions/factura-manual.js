/* Facturación manual, desde el Superadmin.
 *
 * El camino de Stripe timbra solo cuando entra un pago por Stripe. Todo lo
 * demás —una transferencia, una consultoría, un diagnóstico, cualquier cosa
 * que no sea una suscripción al CRM— no tenía por dónde salir, y había que
 * entrar al panel del proveedor a mano.
 *
 * Quién puede llamar: solo un superadmin, comprobado AQUÍ contra el token.
 * Que la pantalla esté escondida en el Superadmin no es un permiso: una
 * función de Netlify es una URL pública, y sin esta comprobación cualquiera
 * podría timbrar a nombre de Flow Hub. Mismo patrón que change-owner-email.
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

const COLECCION = 'facturas_manuales'

const responder = (statusCode, datos) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(datos),
})

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return responder(405, { error: 'Solo POST' })
  }

  let db
  try {
    db = laBase()
  } catch (e) {
    console.error('[factura-manual] sin base:', e)
    return responder(500, { error: 'No hay conexión con la base de datos' })
  }

  /* El token viaja en la cabecera y no en la URL: una URL queda escrita en
   * el historial, en los registros del servidor y en cualquier proxy. */
  const cabecera = event.headers.authorization || event.headers.Authorization || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : ''
  if (!token) return responder(401, { error: 'Falta el token de sesión' })

  let uid
  try {
    uid = (await admin.auth().verifyIdToken(token)).uid
  } catch {
    return responder(401, { error: 'Token inválido o expirado' })
  }

  const quien = await db.collection('users').doc(uid).get()
  if (!quien.exists || quien.data().role !== 'superadmin') {
    return responder(403, { error: 'Se requieren permisos de superadmin' })
  }
  const correoDeQuien = quien.data().email || ''

  let datos
  try {
    datos = JSON.parse(event.body || '{}')
  } catch {
    return responder(400, { error: 'Cuerpo mal formado' })
  }

  const { accion } = datos

  try {
    if (accion === 'emitir') return await emitirFactura(db, datos, correoDeQuien)
    if (accion === 'reenviar') return await reenviar(db, datos)
    if (accion === 'cancelar') return await cancelarFactura(db, datos)
    if (accion === 'descargar') return await descargar(db, datos)
    if (accion === 'buscar-clave') return await buscarClave(datos)
    return responder(400, { error: `Acción desconocida: ${accion}` })
  } catch (e) {
    /* El mensaje del proveedor tal cual: dice qué campo está mal, y esa
     * frase es lo único que le permite a quien captura arreglarlo. */
    console.error('[factura-manual]', accion, e.message, e.detalles || '')
    return responder(400, { error: e.message, detalles: e.detalles || null })
  }
}

/* ── Emitir ─────────────────────────────────────────────────────────── */

async function emitirFactura(db, datos, emitidaPor) {
  const { fiscal, conceptos, formaPago, metodoPago, moneda, tipoCambio, serie, notas, enviar = true } = datos

  if (!Array.isArray(conceptos) || conceptos.length === 0) {
    return responder(400, { error: 'La factura no tiene conceptos' })
  }

  const cfdi = await facturacion.emitir({
    fiscal,
    conceptos,
    email: fiscal?.correo || null,
    formaPago: formaPago || '03',
    metodoPago: metodoPago || 'PUE',
    moneda: moneda || 'MXN',
    tipoCambio: tipoCambio || null,
    serie: serie || null,
  })

  const prueba = facturacion.esPrueba()

  /* Se guarda ANTES de intentar el envío. Si el correo falla, la factura ya
   * existe ante el SAT y perderla de vista sería lo peor que podría pasar:
   * quedaría timbrada, consumiendo un folio, y sin rastro de nuestro lado. */
  const ref = await db.collection(COLECCION).add({
    facturapiId: cfdi.id,
    uuid: cfdi.uuid || null,
    folio: cfdi.folio_number ?? null,
    serie: cfdi.series || null,
    fiscal,
    conceptos,
    totales: facturacion.previsualizar({ conceptos }),
    moneda: moneda || 'MXN',
    formaPago: formaPago || '03',
    metodoPago: metodoPago || 'PUE',
    notas: notas || '',
    estado: 'timbrada',
    prueba,
    enviada: false,
    emitidaPor,
    creadaEn: admin.firestore.FieldValue.serverTimestamp(),
  })

  /* El receptor queda guardado para no volver a teclearlo, con el RFC como
   * identificador. Va después del timbrado a propósito: si Facturapi rechazó
   * los datos, no sirve de nada guardarlos — se volverían a rechazar la
   * próxima vez, y encima con la confianza de venir de la lista. */
  try {
    await db.collection('facturacion_clientes').doc(String(fiscal.rfc).toUpperCase()).set({
      ...fiscal,
      ultimaFacturaEn: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  } catch (e) {
    console.error('[factura-manual] no se pudo guardar el receptor:', e.message)
  }

  /* Con llave de pruebas se timbra y se guarda, pero NO se manda.
   *
   * Un CFDI de sandbox no vale ante el SAT. Mandárselo al cliente es peor
   * que no mandar nada: recibe algo que parece una factura, la da por buena,
   * y se entera en su cierre de mes. */
  let avisoEnvio = null
  if (prueba) {
    avisoEnvio = 'Llave de pruebas: se timbró y se guardó, pero no se envió. Ese CFDI no vale ante el SAT.'
  } else if (enviar && fiscal?.correo) {
    try {
      await facturacion.enviarPorCorreo(cfdi.id, fiscal.correo)
      await ref.update({ enviada: true, enviadaEn: admin.firestore.FieldValue.serverTimestamp() })
    } catch (e) {
      avisoEnvio = `La factura se timbró pero el correo no salió: ${e.message}`
      await ref.update({ errorEnvio: e.message })
    }
  }

  return responder(200, {
    id: ref.id,
    facturapiId: cfdi.id,
    uuid: cfdi.uuid || null,
    folio: cfdi.folio_number ?? null,
    prueba,
    avisoEnvio,
  })
}

/* ── Reenviar ───────────────────────────────────────────────────────── */

async function reenviar(db, { id, correo }) {
  const snap = await db.collection(COLECCION).doc(id).get()
  if (!snap.exists) return responder(404, { error: 'Esa factura no existe' })
  const f = snap.data()

  if (f.prueba) {
    return responder(400, { error: 'Es una factura de pruebas y no se envía: no vale ante el SAT.' })
  }

  const destino = correo || f.fiscal?.correo
  if (!destino) return responder(400, { error: 'No hay correo a dónde mandarla' })

  await facturacion.enviarPorCorreo(f.facturapiId, destino)
  await snap.ref.update({
    enviada: true,
    enviadaEn: admin.firestore.FieldValue.serverTimestamp(),
    errorEnvio: admin.firestore.FieldValue.delete(),
  })
  return responder(200, { ok: true, destino })
}

/* ── Cancelar ───────────────────────────────────────────────────────── */

async function cancelarFactura(db, { id, motivo = '02', sustituye = null }) {
  const snap = await db.collection(COLECCION).doc(id).get()
  if (!snap.exists) return responder(404, { error: 'Esa factura no existe' })
  const f = snap.data()

  /* El motivo 01 —emitida con errores, con relación— exige decir cuál la
   * sustituye. Sin ese dato el SAT la rechaza, así que se para aquí en vez
   * de mandar una petición que ya sabemos que va a fallar. */
  if (motivo === '01' && !sustituye) {
    return responder(400, { error: 'El motivo 01 exige el UUID de la factura que la sustituye' })
  }

  const r = await facturacion.cancelar(f.facturapiId, { motivo, sustituye })
  await snap.ref.update({
    estado: 'cancelada',
    canceladaEn: admin.firestore.FieldValue.serverTimestamp(),
    motivoCancelacion: motivo,
    sustituyeA: sustituye || null,
  })
  return responder(200, { ok: true, estado: r?.status || 'cancelada' })
}

/* ── Buscar en el catálogo del SAT ──────────────────────────────────── */

/* El catálogo de productos y servicios tiene decenas de miles de claves. Una
 * lista escrita a mano con las que se nos ocurrieron no es un catálogo: es un
 * techo, y el día que haya que facturar algo que no está obliga a elegir la
 * más parecida — o sea, a declarar mal.
 *
 * Se consulta el del proveedor en vez de copiarlo aquí, porque el SAT lo
 * actualiza y una copia nuestra envejecería sin que nadie se diera cuenta.
 *
 * Si la consulta falla, no se rompe nada: la pantalla deja escribir la clave
 * a mano igual. Buscar es una ayuda, no un requisito. */
async function buscarClave({ texto, tipo = 'productos' }) {
  const q = String(texto || '').trim()
  if (q.length < 3) return responder(200, { resultados: [] })

  const ruta = tipo === 'unidades' ? 'units' : 'products'
  try {
    const r = await facturacion.buscarCatalogo(ruta, q)
    return responder(200, { resultados: r })
  } catch (e) {
    /* 200 con la lista vacía y el motivo: un error aquí no debe teñir de rojo
     * una pantalla donde lo único que pasó es que la búsqueda no contestó. */
    return responder(200, { resultados: [], aviso: e.message })
  }
}

/* ── Descargar ──────────────────────────────────────────────────────── */

/* Devuelve el archivo en base64 en vez de un enlace.
 *
 * Una descarga directa tendría que llevar el token en la URL para poder
 * comprobar quién la pide, y un token de sesión en una URL queda escrito en
 * el historial del navegador y en los registros de cualquier intermediario.
 * Así el token viaja en la cabecera y el navegador arma el archivo. */
async function descargar(db, { id, formato = 'pdf' }) {
  if (!['pdf', 'xml'].includes(formato)) {
    return responder(400, { error: 'Formato no válido' })
  }
  const snap = await db.collection(COLECCION).doc(id).get()
  if (!snap.exists) return responder(404, { error: 'Esa factura no existe' })

  const archivo = await facturacion.descargar(snap.data().facturapiId, formato)
  return responder(200, {
    nombre: `factura-${snap.data().uuid || id}.${formato}`,
    tipo: formato === 'pdf' ? 'application/pdf' : 'application/xml',
    base64: archivo.toString('base64'),
  })
}
