/* Cliente de la API de Instagram (login de Instagram, no el de Facebook).
 *
 * Sin SDK: son cuatro llamadas HTTP y el paquete oficial se trae media
 * aplicación. Mismo criterio que lib/google.js.
 *
 * El token se guarda CIFRADO. Aunque las reglas de Firestore tapen la
 * colección, un token en claro dentro de la base es una llave suelta: quien
 * lea el documento entra a la cuenta de Instagram del cliente. La llave de
 * cifrado sale de IG_APP_SECRET, que solo existe del lado del servidor.
 */
const crypto = require('crypto')

const BASE = process.env.IG_API_BASE || 'https://graph.instagram.com/v23.0'
const OAUTH_AUTHORIZE = 'https://www.instagram.com/oauth/authorize'
const OAUTH_TOKEN = 'https://api.instagram.com/oauth/access_token'

// instagram_business_basic da perfil y publicaciones; _manage_insights es el
// que trae los números. Sin el segundo la conexión funciona y no mide nada.
const SCOPE = 'instagram_business_basic,instagram_business_manage_insights'

/** El token largo de Instagram vive 60 días. */
const DIAS_DE_VIDA = 60

function appUrl() {
  return process.env.URL || process.env.DEPLOY_URL || 'https://flowhubcrm.app'
}

function redirectUri() {
  return process.env.IG_REDIRECT_URI || `${appUrl()}/.netlify/functions/instagram-callback`
}

function authUrl(state) {
  const p = new URLSearchParams({
    client_id: process.env.IG_APP_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    state,
  })
  return `${OAUTH_AUTHORIZE}?${p}`
}

// ── Cifrado del token ────────────────────────────────────────────────────
function llave() {
  const secreto = process.env.IG_APP_SECRET
  if (!secreto) throw new Error('IG_APP_SECRET no está configurada')
  return crypto.createHash('sha256').update(secreto).digest()
}

function cifrar(texto) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', llave(), iv)
  const datos = Buffer.concat([c.update(String(texto), 'utf8'), c.final()])
  return {
    v: 1,
    iv: iv.toString('base64'),
    datos: datos.toString('base64'),
    tag: c.getAuthTag().toString('base64'),
  }
}

function descifrar(sobre) {
  if (!sobre?.datos) throw new Error('No hay token guardado')
  const d = crypto.createDecipheriv('aes-256-gcm', llave(), Buffer.from(sobre.iv, 'base64'))
  d.setAuthTag(Buffer.from(sobre.tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(sobre.datos, 'base64')), d.final()]).toString('utf8')
}

// ── OAuth ────────────────────────────────────────────────────────────────
async function pedir(url, opciones) {
  const res = await fetch(url, opciones)
  const cuerpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = cuerpo?.error?.message || cuerpo?.error_message || `HTTP ${res.status}`
    const err = new Error(msg)
    err.codigo = cuerpo?.error?.code
    err.estado = res.status
    throw err
  }
  return cuerpo
}

/** code → token corto (1 hora). */
async function canjearCodigo(code) {
  const cuerpo = new URLSearchParams({
    client_id: process.env.IG_APP_ID,
    client_secret: process.env.IG_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(),
    code,
  })
  return pedir(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo.toString(),
  })
}

/** token corto → token largo (60 días). */
async function aTokenLargo(tokenCorto) {
  const p = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: process.env.IG_APP_SECRET,
    access_token: tokenCorto,
  })
  return pedir(`https://graph.instagram.com/access_token?${p}`)
}

/** Renueva un token largo antes de que muera. Instagram exige que tenga al
 *  menos 24 horas de vida y no esté caducado. */
async function renovarToken(tokenLargo) {
  const p = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: tokenLargo,
  })
  return pedir(`https://graph.instagram.com/refresh_access_token?${p}`)
}

// ── Datos ────────────────────────────────────────────────────────────────
async function perfil(token) {
  const p = new URLSearchParams({
    fields: 'user_id,username,account_type,followers_count,follows_count,media_count,profile_picture_url',
    access_token: token,
  })
  return pedir(`${BASE}/me?${p}`)
}

async function publicaciones(token, limite = 25) {
  const p = new URLSearchParams({
    fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count',
    limit: String(limite),
    access_token: token,
  })
  const r = await pedir(`${BASE}/me/media?${p}`)
  return r.data || []
}

// Las métricas no son las mismas para un reel que para una foto, y la API
// rechaza la petición entera si una sola métrica no aplica. Por eso se pide
// por tandas y se va recortando en lugar de darse por vencido.
const METRICAS_REEL = ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions']
const METRICAS_REEL_EXTRA = ['ig_reels_avg_watch_time', 'ig_reels_video_view_total_time']
const METRICAS_FOTO = ['reach', 'likes', 'comments', 'saved', 'total_interactions']

async function metricasDe(token, media) {
  const esReel = media.media_product_type === 'REELS' || media.media_type === 'VIDEO'
  const tandas = esReel
    ? [[...METRICAS_REEL, ...METRICAS_REEL_EXTRA], METRICAS_REEL, ['views', 'reach']]
    : [METRICAS_FOTO, ['reach']]

  for (const tanda of tandas) {
    try {
      const p = new URLSearchParams({ metric: tanda.join(','), access_token: token })
      const r = await pedir(`${BASE}/${media.id}/insights?${p}`)
      const out = {}
      for (const m of r.data || []) {
        out[m.name] = m.values?.[0]?.value ?? m.total_value?.value ?? 0
      }
      return out
    } catch (e) {
      // Una publicación de hace años puede no tener métricas: no es un fallo
      // de la conexión, es que no hay nada que traer.
      if (e.estado === 400) continue
      throw e
    }
  }
  return {}
}

// ── Guardado ─────────────────────────────────────────────────────────────
// Lo público (usuario, foto, seguidores) va en el documento de la marca,
// porque la pantalla lo pinta. El token va aparte y cifrado.
function marcaRef(db, orgId, brandId) {
  return db.collection('organizations').doc(orgId).collection('brands').doc(brandId)
}

async function guardarConexion(db, orgId, brandId, { token, perfil: datos, admin }) {
  const ahora = admin.firestore.FieldValue.serverTimestamp()
  const igUserId = String(datos.user_id || datos.id || '')

  /* Índice de cuenta → organización y marca.
   *
   * Cuando Meta avisa de un mensaje, lo único que manda es el id de la cuenta
   * que lo recibió. Sin esta tabla habría que recorrer todas las
   * organizaciones para saber de quién es. Se escribe aquí, que es el único
   * momento en que se conoce el vínculo. */
  if (igUserId) {
    await db.collection('_ig_cuentas').doc(igUserId).set({
      orgId, brandId, username: datos.username || '', actualizadoEn: ahora,
    })
  }
  await marcaRef(db, orgId, brandId).collection('privado').doc('instagram').set({
    token: cifrar(token),
    guardadoEn: ahora,
  })
  await marcaRef(db, orgId, brandId).set({
    handle: (datos.username || '').toLowerCase(),
    fotoURL: datos.profile_picture_url || null,
    ig: {
      userId: String(datos.user_id || datos.id || ''),
      username: datos.username || '',
      tipoDeCuenta: datos.account_type || '',
      seguidores: datos.followers_count ?? null,
      publicaciones: datos.media_count ?? null,
      conectadaEn: ahora,
      tokenRenovadoEn: ahora,
      error: null,
    },
    updatedAt: ahora,
  }, { merge: true })
}

/* Reescribe el índice cuenta → organización y marca. Las cuentas conectadas
 * antes de que este índice existiera no lo tienen, y sin él el webhook recibe
 * el evento pero no sabe de quién es. */
async function anotarCuenta(db, { igUserId, orgId, brandId, username, admin }) {
  if (!igUserId) return
  await db.collection('_ig_cuentas').doc(String(igUserId)).set({
    orgId, brandId, username: username || '',
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
}

/** De quién es la cuenta que recibió el evento. */
async function cuentaDeInstagram(db, igUserId) {
  if (!igUserId) return null
  const snap = await db.collection('_ig_cuentas').doc(String(igUserId)).get()
  return snap.exists ? snap.data() : null
}

/* Meta firma cada webhook con el secreto de la app. Sin comprobarlo,
 * cualquiera que sepa la URL puede inventarse mensajes de clientes. */
function verificarFirma(cuerpoCrudo, firma) {
  const secreto = process.env.IG_APP_SECRET
  if (!secreto || !firma) return false
  const esperada = 'sha256=' + crypto.createHmac('sha256', secreto).update(cuerpoCrudo, 'utf8').digest('hex')
  const a = Buffer.from(esperada)
  const b = Buffer.from(firma)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/* Pide a Meta que mande los eventos de esta cuenta. Autorizar la app no
 * basta: hay que suscribirla explícitamente, y sin eso el webhook queda
 * verificado pero nunca recibe nada. */
async function suscribirEventos(token) {
  const p = new URLSearchParams({
    subscribed_fields: 'messages,comments',
    access_token: token,
  })
  return pedir(`${BASE}/me/subscribed_apps?${p}`, { method: 'POST' })
}

// ── Mensajes y comentarios ───────────────────────────────────────────────
async function enviarMensaje(token, destinatario, texto) {
  return pedir(`${BASE}/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: destinatario,
      message: { text: String(texto).slice(0, 950) },
      access_token: token,
    }),
  })
}

/* La respuesta privada a un comentario es el mecanismo del "comenta X y te
 * mando el PDF". Hay una sola por comentario y NO abre la conversación: hasta
 * que la persona conteste, no se le puede escribir otra vez. Por eso ese
 * primer mensaje tiene que llevar ya lo prometido y una pregunta. */
async function respuestaPrivada(token, comentarioId, texto) {
  return enviarMensaje(token, { comment_id: String(comentarioId) }, texto)
}

async function responderComentario(token, comentarioId, texto) {
  const p = new URLSearchParams({ message: String(texto).slice(0, 2000), access_token: token })
  return pedir(`${BASE}/${comentarioId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: p.toString(),
  })
}

async function leerToken(db, orgId, brandId) {
  const snap = await marcaRef(db, orgId, brandId).collection('privado').doc('instagram').get()
  if (!snap.exists) return null
  return descifrar(snap.data().token)
}

/** Deja el problema escrito en la marca para que la pantalla lo explique en
 *  vez de mostrar números viejos como si fueran de hoy. */
async function anotarError(db, orgId, brandId, mensaje) {
  await marcaRef(db, orgId, brandId).set(
    { ig: { error: String(mensaje).slice(0, 200) } },
    { merge: true }
  )
}

module.exports = {
  BASE, SCOPE, DIAS_DE_VIDA,
  marcaRef, guardarConexion, leerToken, anotarError, cuentaDeInstagram,
  verificarFirma, enviarMensaje, respuestaPrivada, responderComentario,
  suscribirEventos, anotarCuenta,
  appUrl, redirectUri, authUrl,
  cifrar, descifrar,
  canjearCodigo, aTokenLargo, renovarToken,
  perfil, publicaciones, metricasDe,
}
