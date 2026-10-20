// Busca efectos de sonido en Freesound.
//
// Filtrado a CC0 a propósito, y no es un capricho: CC0 es dominio público,
// así que vale para contenido comercial sin atribución y sin que nadie tenga
// que acordarse de poner créditos. Las otras licencias de Freesound —CC-BY,
// CC-BY-NC— obligan a atribuir o prohíben el uso comercial, y en una pieza
// de marca personal eso es una infracción esperando a pasar.
const BASE = 'https://freesound.org/apiv2/search/text/'

// Solo dominio público. El día que se quiera abrir a CC-BY habrá que
// arrastrar la atribución hasta el video, y eso es otro problema.
const SOLO_LIBRES = 'license:"Creative Commons 0"'

const CAMPOS = 'id,name,tags,license,duration,filesize,previews,username,avg_rating,num_downloads'

exports.handler = async (event) => {
  const responder = (statusCode, datos) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })

  if (!process.env.FREESOUND_API_KEY) {
    return responder(400, {
      error: 'SIN_PROVEEDOR',
      detalle: 'Falta configurar FREESOUND_API_KEY en Netlify.',
    })
  }

  try {
    const { q = '', pagina = 1, maxDuracion = 30 } = event.queryStringParameters || {}
    if (!q.trim()) return responder(400, { error: 'SIN_BUSQUEDA' })

    const p = new URLSearchParams({
      query: q,
      // Los efectos largos no sirven para puntuar un video: estorban y pesan.
      filter: `${SOLO_LIBRES} duration:[0 TO ${Number(maxDuracion) || 30}]`,
      fields: CAMPOS,
      sort: 'score',
      page_size: '24',
      page: String(pagina),
      token: process.env.FREESOUND_API_KEY,
    })

    const res = await fetch(`${BASE}?${p}`)
    const cuerpo = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = cuerpo?.detail || cuerpo?.message || `HTTP ${res.status}`
      return responder(400, { error: 'NO_SE_PUDO_BUSCAR', detalle: String(msg) })
    }

    const sonidos = (cuerpo.results || []).map(s => ({
      id: String(s.id),
      nombre: s.name || '',
      autor: s.username || '',
      duracion: s.duration ?? null,
      licencia: s.license || '',
      etiquetas: (s.tags || []).slice(0, 6),
      descargas: s.num_downloads ?? null,
      // La previa en mp3 es lo que se oye y lo que se usa: no hace falta el
      // original, que además exigiría otro tipo de permiso.
      audio: s.previews?.['preview-hq-mp3'] || s.previews?.['preview-lq-mp3'] || null,
      origen: `https://freesound.org/s/${s.id}/`,
    })).filter(s => s.audio)

    return responder(200, { ok: true, sonidos, total: cuerpo.count ?? sonidos.length })
  } catch (e) {
    console.error('buscar-sonidos error:', e)
    return responder(400, { error: 'NO_SE_PUDO_BUSCAR', detalle: e.message })
  }
}
