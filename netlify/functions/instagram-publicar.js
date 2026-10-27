/* Publicar en Instagram desde FlowHub.
 *
 * Son dos llamadas desde el navegador, no una, y es a propósito.
 *
 * Instagram procesa el video por su cuenta antes de dejar publicarlo, y un
 * reel puede tardar minutos. Una función de Netlify muere a los 26 segundos,
 * así que esperar aquí dentro era garantizar que los videos largos fallaran.
 * En su lugar: `crear` devuelve el contenedor de inmediato, el navegador
 * pregunta por el estado cada pocos segundos, y cuando está listo llama a
 * `publicar`.
 *
 * El archivo tiene que estar ya en Storage con su enlace público: Instagram
 * no recibe el archivo, lo descarga él.
 */
const admin = require('firebase-admin')
const { credencial } = require('./lib/credencial')
const ig = require('./lib/instagram')

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

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }
const responder = (código, cuerpo) => ({ statusCode: código, headers: JSON_HEADERS, body: JSON.stringify(cuerpo) })

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return responder(405, { error: 'Method not allowed' })

  let cuerpo
  try { cuerpo = JSON.parse(event.body || '{}') } catch { return responder(400, { error: 'JSON inválido' }) }

  const { accion, orgId, brandId } = cuerpo
  if (!orgId || !brandId) return responder(400, { error: 'Faltan orgId y brandId' })

  try {
    const db = laBase()
    const token = await ig.leerToken(db, orgId, brandId)
    if (!token) return responder(400, { error: 'Esta marca no tiene Instagram conectado.' })

    const marca = (await ig.marcaRef(db, orgId, brandId).get()).data() || {}
    const igUserId = marca.ig?.userId
    if (!igUserId) return responder(400, { error: 'La marca no tiene cuenta de Instagram.' })

    /* ── El carrusel, primer tiempo: los hijos ────────────────────────────
     *
     * Va en dos tiempos porque Instagram lo pide así: primero un contenedor
     * por cada imagen, marcado como pieza de carrusel y SIN caption —el
     * caption vive en el padre—, y después el padre que los agrupa.
     *
     * El padre se pide aparte, desde la pantalla, cuando los N hijos
     * terminaron de procesarse. Crearlo antes devuelve `invalid_children`,
     * que no dice cuál de todos no estaba listo. */
    if (accion === 'crear-hijos') {
      const urls = Array.isArray(cuerpo.urls) ? cuerpo.urls.filter(Boolean) : []
      if (urls.length < 2 || urls.length > 10) {
        return responder(400, { error: 'Un carrusel lleva entre 2 y 10 imágenes.' })
      }
      const hijos = []
      for (const u of urls) {
        const c = await ig.crearContenedor(token, igUserId, { image_url: u, is_carousel_item: true })
        hijos.push(c.id)
      }
      return responder(200, { hijos })
    }

    // ── El carrusel, segundo tiempo: el padre que los agrupa ──────────────
    if (accion === 'crear-padre') {
      const hijos = Array.isArray(cuerpo.hijos) ? cuerpo.hijos.filter(Boolean) : []
      if (hijos.length < 2) return responder(400, { error: 'Faltan los contenedores del carrusel' })
      const padre = await ig.crearContenedor(token, igUserId, {
        media_type: 'CAROUSEL',
        children: hijos.join(','),
        caption: cuerpo.caption,
      })
      return responder(200, { contenedorId: padre.id })
    }

    // ── Crear el contenedor ───────────────────────────────────────────────
    if (accion === 'crear') {
      const { tipo, url, caption, portada } = cuerpo
      if (!url) return responder(400, { error: 'Falta la URL del archivo' })

      /* El tipo decide qué campo espera Instagram, y mandar el equivocado da
       * un error que no explica nada. REELS es el único tipo de video que
       * acepta esta API; un video "normal" ya no existe. */
      const datos = tipo === 'imagen'
        ? { image_url: url, caption }
        : { media_type: 'REELS', video_url: url, caption, cover_url: portada || undefined }

      const contenedor = await ig.crearContenedor(token, igUserId, datos)
      return responder(200, { contenedorId: contenedor.id })
    }

    // ── Preguntar si ya terminó de procesarse ─────────────────────────────
    if (accion === 'estado') {
      if (!cuerpo.contenedorId) return responder(400, { error: 'Falta contenedorId' })
      const r = await ig.estadoContenedor(token, cuerpo.contenedorId)
      return responder(200, { estado: r.status_code || 'IN_PROGRESS', detalle: r.status || null })
    }

    // ── Publicarlo ────────────────────────────────────────────────────────
    if (accion === 'publicar') {
      if (!cuerpo.contenedorId) return responder(400, { error: 'Falta contenedorId' })
      const r = await ig.publicarContenedor(token, igUserId, cuerpo.contenedorId)

      /* Se guarda la publicación del lado de FlowHub.
       *
       * No es por tener una copia: es lo que permite cerrar el círculo. Los
       * comentarios que lleguen traen el id de la publicación, así que con
       * esto se puede decir qué reel trajo qué leads — que es lo único que
       * ningún editor de video le va a dar al cliente. */
      await ig.marcaRef(db, orgId, brandId).collection('publicaciones').doc(String(r.id)).set({
        mediaId: String(r.id),
        tipo: cuerpo.tipo || 'reel',
        caption: cuerpo.caption || '',
        url: cuerpo.url || '',
        publicadoEn: admin.firestore.FieldValue.serverTimestamp(),
        publicadoPor: cuerpo.usuario || null,
        leads: 0,
      })

      return responder(200, { mediaId: r.id })
    }

    // ── Cuánto cupo le queda hoy ──────────────────────────────────────────
    if (accion === 'cupo') {
      const r = await ig.cupoDePublicacion(token, igUserId)
      const d = r.data?.[0] || {}
      return responder(200, { usadas: d.quota_usage ?? null, tope: d.config?.quota_total ?? 100 })
    }

    return responder(400, { error: `Acción desconocida: ${accion}` })
  } catch (e) {
    console.error('[instagram-publicar]', accion, e.message)
    return responder(500, { error: e.message })
  }
}
