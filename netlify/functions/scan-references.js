// Escanea referencias y las deja en la biblioteca de la organización.
//
// Las referencias viven a nivel organización, no dentro de cada marca: una
// referencia es un hecho público, cuesta dinero traerla, y quien lleva varias
// marcas la quiere reusar entre clientes. Cada marca la adopta.
//
// El consumo se anota en la marca que pidió el escaneo, porque el cupo diario
// del proveedor es limitado y hay que poder repartirlo entre clientes.
const admin = require('firebase-admin')
const { initDb } = require('./lib/firebase')
const esc = require('./lib/escaner')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const responder = (statusCode, datos) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })

  try {
    const { orgId, brandId, tipo, consulta, profundidad } = JSON.parse(event.body || '{}')
    if (!orgId || !tipo) return responder(400, { error: 'FALTAN_DATOS' })

    const db = initDb()
    const org = db.collection('organizations').doc(orgId)
    let reels = []
    let unidades = 0
    let cuentas = null
    let hashtags = null

    if (tipo === 'tema') {
      const r = await esc.buscarTema(consulta)
      cuentas = r.cuentas
      hashtags = r.hashtags
      unidades += r.unidades || 0

    } else if (tipo === 'creador') {
      const usuario = String(consulta || '').replace(/^@/, '').trim()
      const u = await esc.idDeUsuario(usuario)
      unidades += u.unidades || 0
      if (!u.id) return responder(404, { error: 'CUENTA_NO_ENCONTRADA' })
      const r = await esc.reelsDe(u.id, { profundidad: profundidad || 1 })
      reels = r.reels
      unidades += r.unidades || 0

    } else if (tipo === 'url') {
      const codigo = esc.codigoDeUrl(consulta)
      if (!codigo) return responder(400, { error: 'URL_NO_VALIDA' })
      const r = await esc.reelPorCodigo(codigo)
      if (r.reel) reels = [r.reel]
      unidades += r.unidades || 0

    } else if (tipo === 'audio') {
      const r = await esc.reelsDeAudio(consulta)
      reels = r.reels
      unidades += r.unidades || 0

    } else {
      return responder(400, { error: 'TIPO_NO_VALIDO' })
    }

    // Guardar lo que se encontró. El shortcode es el identificador natural:
    // escanear dos veces al mismo creador actualiza, no duplica.
    if (reels.length) {
      const lote = db.batch()
      for (const r of reels) {
        if (!r.codigo) continue
        lote.set(org.collection('references').doc(r.codigo), {
          ...r,
          publicadoEn: r.publicadoEn ? admin.firestore.Timestamp.fromDate(r.publicadoEn) : null,
          origen: { tipo, consulta: String(consulta || '').slice(0, 120) },
          vistaEn: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true })
      }
      await lote.commit()
    }

    if (brandId && unidades) {
      await org.collection('brands').doc(brandId).set({
        uso: {
          escaneos: admin.firestore.FieldValue.increment(1),
          unidades: admin.firestore.FieldValue.increment(unidades),
          ultimoEscaneo: admin.firestore.FieldValue.serverTimestamp(),
        },
      }, { merge: true })
    }

    return responder(200, { ok: true, encontrados: reels.length, unidades, cuentas, hashtags })
  } catch (e) {
    console.error('scan-references error:', e)
    if (e.sinProveedor) {
      return responder(400, {
        error: 'SIN_PROVEEDOR',
        detalle: 'Falta configurar ENSEMBLEDATA_TOKEN. Mientras tanto puedes agregar referencias pegando la URL.',
      })
    }
    if (e.sinCupo) {
      return responder(400, {
        error: 'SIN_CUPO',
        detalle: 'Se acabó el cupo diario del escáner. Vuelve mañana o amplía el plan.',
      })
    }
    return responder(400, { error: 'NO_SE_PUDO_ESCANEAR', detalle: e.message })
  }
}
