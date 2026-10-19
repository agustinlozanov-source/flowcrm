// Trae las publicaciones de una marca con sus métricas y deja calculados los
// números derivados, que son los que de verdad dicen algo.
//
// Los likes no predicen nada. Lo que predice es cuánta gente lo compartió y
// cuánta lo guardó, y si el video salió o no de la audiencia propia. Esas tres
// no vienen de Instagram: se calculan aquí, una sola vez, para que ninguna
// pantalla tenga que volver a hacerlo.
const admin = require('firebase-admin')
const { initDb } = require('./lib/firebase')
const ig = require('./lib/instagram')

const POR_TANDA = 5          // peticiones de métricas en paralelo
const MAXIMO = 25            // publicaciones por sincronización

function mediana(nums) {
  const xs = nums.filter(n => typeof n === 'number').sort((a, b) => a - b)
  if (!xs.length) return null
  const m = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2
}

/* Los derivados que importan, calculados contra los seguidores del momento.
 *
 * Una publicación de la que Instagram no devolvió nada NO es una publicación
 * con cero: es una publicación sin datos. Son cosas distintas y confundirlas
 * arrastra todas las medianas al suelo — una cuenta sana parece muerta porque
 * sus fotos viejas, que nunca tuvieron métricas, votan como ceros. Por eso lo
 * que no se sabe queda en null y se cae solo de los cálculos. */
function derivados(m, seguidores) {
  const vistas = m.views ?? m.reach ?? 0
  const hayDatos = vistas > 0
  const entreVistas = (n) => (hayDatos && typeof n === 'number' ? n / vistas : null)

  return {
    vistas,
    alcance: m.reach ?? null,
    likes: m.likes ?? null,
    comentarios: m.comments ?? null,
    compartidos: m.shares ?? null,
    guardados: m.saved ?? null,
    interacciones: m.total_interactions ?? null,
    // Viene en milisegundos; en segundos se lee.
    tiempoMedio: m.ig_reels_avg_watch_time ? m.ig_reels_avg_watch_time / 1000 : null,
    // Compartidos entre vistas: el mejor predictor de viralidad que existe.
    propagacion: entreVistas(m.shares),
    // Guardados entre vistas: dice si el video enseña algo o solo entretiene.
    utilidad: entreVistas(m.saved),
    // Vistas entre seguidores: arriba de 1 el video salió de la audiencia.
    multiplicador: hayDatos && seguidores > 0 ? vistas / seguidores : null,
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const responder = (statusCode, datos) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })

  const { orgId, brandId } = JSON.parse(event.body || '{}')
  if (!orgId || !brandId) return responder(400, { error: 'FALTAN_DATOS' })

  const db = initDb()

  try {
    const token = await ig.leerToken(db, orgId, brandId)
    if (!token) return responder(400, { error: 'SIN_CONEXION' })

    const datos = await ig.perfil(token)
    const seguidores = datos.followers_count ?? 0
    const medios = await ig.publicaciones(token, MAXIMO)

    // En tandas: veinticinco peticiones seguidas no caben en el tiempo que
    // Netlify le da a una función.
    const conMetricas = []
    for (let i = 0; i < medios.length; i += POR_TANDA) {
      const tanda = medios.slice(i, i + POR_TANDA)
      const res = await Promise.all(tanda.map(async m => {
        try { return { media: m, metricas: await ig.metricasDe(token, m) } }
        catch { return { media: m, metricas: {} } }
      }))
      conMetricas.push(...res)
    }

    const lote = db.batch()
    const col = ig.marcaRef(db, orgId, brandId).collection('posts')
    const resumen = []

    for (const { media, metricas } of conMetricas) {
      const d = derivados(metricas, seguidores)
      resumen.push(d)
      lote.set(col.doc(media.id), {
        mediaId: media.id,
        tipo: media.media_product_type || media.media_type || null,
        caption: media.caption || '',
        permalink: media.permalink || null,
        miniatura: media.thumbnail_url || media.media_url || null,
        publicadoEn: media.timestamp ? admin.firestore.Timestamp.fromDate(new Date(media.timestamp)) : null,
        seguidoresEntonces: seguidores,
        ...d,
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }

    // Cadencia: lo único que el creador controla de verdad.
    const hace30 = Date.now() - 30 * 86400000
    const ultimos30 = conMetricas.filter(x => x.media.timestamp && new Date(x.media.timestamp).getTime() >= hace30)
    const ultima = medios[0]?.timestamp ? new Date(medios[0].timestamp) : null

    const vistas = resumen.map(r => r.vistas).filter(n => n > 0)
    const props = resumen.map(r => r.propagacion).filter(n => typeof n === 'number')
    const mults = resumen.map(r => r.multiplicador).filter(n => typeof n === 'number')

    lote.set(ig.marcaRef(db, orgId, brandId), {
      ig: {
        seguidores,
        publicaciones: datos.media_count ?? null,
        username: datos.username || '',
        error: null,
      },
      resumen: {
        publicadosUltimos30: ultimos30.length,
        medianaVistas: mediana(vistas),
        propagacionMedia: mediana(props),
        multiplicadorMedio: mediana(mults),
        ultimaPublicacion: ultima ? admin.firestore.Timestamp.fromDate(ultima) : null,
        analizados: resumen.length,
        sincronizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    await lote.commit()

    return responder(200, { ok: true, publicaciones: resumen.length, seguidores })
  } catch (e) {
    console.error('instagram-sync error:', e)
    // Que la marca lo diga en pantalla, en vez de enseñar números viejos como
    // si fueran de hoy.
    await ig.anotarError(db, orgId, brandId, e.message).catch(() => {})
    return responder(400, { error: 'NO_SE_PUDO_SINCRONIZAR', detalle: e.message })
  }
}
