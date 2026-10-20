/* Escáner de referencias: videos ajenos que valen la pena emular.
 *
 * Instagram no deja buscar contenido de otros por su API oficial, así que esto
 * va por un proveedor externo (EnsembleData). El proveedor se cambia tocando
 * solo este archivo: hacia afuera todo sale con la misma forma.
 *
 * Lo que el proveedor SÍ da de contenido ajeno: vistas, likes, comentarios,
 * duración, audio y autor. Lo que NO da nadie, porque Instagram no lo enseña
 * en público: compartidos y guardados. Esos dos existen solo para las cuentas
 * propias, por la vía oficial.
 */
const BASE = 'https://ensembledata.com/apis'

function hayProveedor() {
  return Boolean(process.env.ENSEMBLEDATA_TOKEN)
}

async function pedir(ruta, params) {
  if (!hayProveedor()) {
    const e = new Error('SIN_PROVEEDOR')
    e.sinProveedor = true
    throw e
  }
  const p = new URLSearchParams({ ...params, token: process.env.ENSEMBLEDATA_TOKEN })
  const res = await fetch(`${BASE}${ruta}?${p}`)
  const cuerpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = cuerpo?.detail || cuerpo?.message || `HTTP ${res.status}`
    const e = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    e.estado = res.status
    // El cupo diario es lo primero que se agota, y el mensaje crudo no lo dice.
    if (res.status === 403 || res.status === 429) e.sinCupo = true
    throw e
  }
  return cuerpo
}

/** Un reel, con la forma que usa toda la aplicación. */
function normalizar(media) {
  if (!media) return null
  const vistas = media.play_count ?? media.view_count ?? 0
  const likes = media.like_count ?? 0
  const comentarios = media.comment_count ?? 0
  const clips = media.clips_metadata || {}
  const musica = clips.music_info?.music_asset_info || null
  const propio = clips.original_sound_info || null

  return {
    codigo: media.code || null,
    url: media.code ? `https://www.instagram.com/reel/${media.code}/` : null,
    autor: {
      usuario: media.user?.username || '',
      nombre: media.user?.full_name || '',
      fotoURL: media.user?.profile_pic_url || null,
      verificado: Boolean(media.user?.is_verified),
    },
    texto: media.caption?.text || '',
    publicadoEn: media.taken_at ? new Date(media.taken_at * 1000) : null,
    duracion: media.video_duration ?? null,
    miniatura: media.image_versions2?.candidates?.[0]?.url || null,
    vistas,
    likes,
    comentarios,
    // Sin compartidos ni guardados no hay propagación: lo más cerca que se
    // puede estar con datos públicos es cuánta de la gente que lo vio
    // reaccionó. No es lo mismo, pero ordena.
    interaccion: vistas > 0 ? (likes + comentarios) / vistas : null,
    audio: musica
      ? { id: musica.audio_cluster_id || null, titulo: musica.title || '', artista: musica.display_artist || '' }
      : propio
        ? { id: propio.audio_asset_id || null, titulo: 'Audio original', artista: propio.ig_artist?.username || '' }
        : null,
  }
}

// ── Búsquedas ────────────────────────────────────────────────────────────
/* Buscar un tema no devuelve videos: devuelve cuentas y hashtags. Instagram
 * no expone un buscador de publicaciones, ni siquiera por esta vía. Así que el
 * camino es de dos pasos — se busca el tema, se elige a quién emular, y se
 * escanean sus reels. Que, pensándolo bien, es como trabaja quien de verdad
 * sabe: no persigue videos sueltos, sigue a gente. */
async function buscarTema(texto) {
  const r = await pedir('/instagram/search', { text: texto })
  const d = r.data || {}
  return {
    unidades: r.units_charged ?? null,
    cuentas: (d.users || []).map(u => ({
      usuario: u.user?.username || '',
      nombre: u.user?.full_name || '',
      fotoURL: u.user?.profile_pic_url || null,
      verificado: Boolean(u.user?.is_verified),
    })).filter(u => u.usuario),
    hashtags: (d.hashtags || []).map(h => ({
      nombre: h.hashtag?.name || '',
      publicaciones: h.hashtag?.media_count ?? null,
    })).filter(h => h.nombre),
  }
}

async function idDeUsuario(usuario) {
  const r = await pedir('/instagram/user/info', { username: usuario })
  return { id: r.data?.pk || null, unidades: r.units_charged ?? null }
}

/* Seguidores de la cuenta. Va aparte porque el endpoint de perfil no los
 * trae, y cuesta sus unidades. Vale la pena: sin saber el tamaño de la
 * cuenta, un 4x no se puede leer — con 2.000 seguidores un solo compartido
 * ajeno te produce ese 4x y no tiene nada que ver con cómo está hecho el
 * video; con 300.000, casi seguro es el contenido. */
async function estadisticasDe(userId) {
  const r = await pedir('/instagram/user/basic-info', { user_id: userId })
  const d = r.data || {}
  return {
    seguidores: typeof d.followers === 'number' ? d.followers : null,
    unidades: r.units_charged ?? null,
  }
}

async function reelsDe(userId, { profundidad = 1 } = {}) {
  const r = await pedir('/instagram/user/reels', { user_id: userId, depth: profundidad })
  const reels = (r.data?.reels || []).map(x => normalizar(x.media)).filter(Boolean)
  return { reels, unidades: r.units_charged ?? null }
}

async function reelPorCodigo(codigo) {
  const r = await pedir('/instagram/post/details', { code: codigo, fetch_play_count: true })
  const media = r.data?.items?.[0] || r.data?.item || r.data
  return { reel: normalizar(media), unidades: r.units_charged ?? null }
}

async function reelsDeAudio(audioId) {
  const r = await pedir('/instagram/music/posts', { id: audioId })
  const items = r.data?.items || r.data?.posts || []
  return { reels: items.map(x => normalizar(x.media || x)).filter(Boolean), unidades: r.units_charged ?? null }
}

/** De una URL de Instagram saca el shortcode. Acepta /reel/, /p/ y /tv/. */
function codigoDeUrl(url) {
  const m = String(url || '').match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i)
  return m ? m[1] : null
}

module.exports = {
  hayProveedor, normalizar, codigoDeUrl,
  buscarTema, idDeUsuario, estadisticasDe, reelsDe, reelPorCodigo, reelsDeAudio,
}
