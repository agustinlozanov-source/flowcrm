/* Trafficker — publicar a las redes de la organización, desde el CRM.
 *
 * Quién puede llamar: alguien con sesión iniciada EN ESA organización, o un
 * superadmin. Se comprueba aquí contra el token y no en la pantalla: una
 * función de Netlify es una URL pública, y sin esta comprobación cualquiera
 * podría publicar en la página de Facebook de un cliente.
 *
 * El post nunca se publica dentro de esta llamada. Se programa un minuto
 * adelante y el resultado llega por webhook, porque un video a Facebook tarda
 * más que los 26 segundos que vive una función de Netlify.
 */
const admin = require('firebase-admin')
const {
  initDb, ensureProfile, ensureWebhook,
  listarCuentas, crearPost, cancelarPost, analiticasDePost,
} = require('./lib/zernio')

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }
const responder = (codigo, cuerpo) => ({ statusCode: codigo, headers: JSON_HEADERS, body: JSON.stringify(cuerpo) })

const COLECCION = 'trafficker_posts'

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return responder(405, { error: 'Solo POST' })

  let datos
  try { datos = JSON.parse(event.body || '{}') } catch { return responder(400, { error: 'Cuerpo mal formado' }) }

  const { accion, orgId } = datos
  if (!orgId) return responder(400, { error: 'Falta orgId' })

  const db = initDb()

  /* El token va en la cabecera y no en la URL: una URL queda escrita en el
   * historial, en los registros del servidor y en cualquier proxy. */
  const cabecera = event.headers.authorization || event.headers.Authorization || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : ''
  if (!token) return responder(401, { error: 'Falta el token de sesión' })

  let claims
  try {
    claims = await admin.auth().verifyIdToken(token)
  } catch {
    return responder(401, { error: 'Token inválido o expirado' })
  }

  /* El claim `orgId` es el mismo con el que las reglas de Firestore deciden
   * todo lo demás. Comparar contra él deja esta función exactamente igual de
   * cerrada que la base. */
  const suya = claims.orgId === orgId
  const esSuperadmin = claims.superadmin === true
  if (!suya && !esSuperadmin) {
    return responder(403, { error: 'Esta organización no es tuya' })
  }

  try {
    if (accion === 'cuentas') return await cuentas(db, orgId)
    if (accion === 'publicar') return await publicar(db, orgId, datos, claims)
    if (accion === 'metricas') return await metricas(db, orgId, datos)
    if (accion === 'cancelar') return await cancelar(db, orgId, datos)
    return responder(400, { error: `Acción desconocida: ${accion}` })
  } catch (e) {
    console.error('[trafficker]', accion, e.message, e.body || '')
    /* El mensaje de Zernio tal cual: dice qué campo rechazó Meta, y esa frase
     * es lo único que le permite a quien publica arreglarlo. */
    return responder(400, { error: e.message })
  }
}

/* ── Cuentas conectadas ─────────────────────────────────────────────── */

async function cuentas(db, orgId) {
  const profileId = await ensureProfile(db, orgId)

  /* De paso se completan los eventos del webhook. Las orgs que conectaron sus
   * canales antes de que existiera Trafficker tienen el webhook registrado
   * con la lista vieja, y sin esto nunca se enterarían de un post publicado.
   * Es idempotente y falla hacia adelante: sin cuentas no hay nada que
   * publicar, así que no vale la pena tumbar la pantalla por esto. */
  try { await ensureWebhook() } catch (e) {
    console.error('[trafficker] no se pudo completar el webhook:', e.message)
  }

  const { cuentas: lista, descartadas, camposVistos } = await listarCuentas(profileId)

  /* El aviso solo cuando el filtro dejó la lista vacía habiendo cuentas: ahí
   * es cuando la pantalla mentiría diciendo que no hay nada conectado. */
  const aviso = !lista.length && descartadas
    ? `Zernio devolvió ${descartadas} cuenta(s) que no son de esta organización y se descartaron. ` +
      `Campos que trajo: ${camposVistos.join(', ') || 'ninguno'}.`
    : null

  return responder(200, { cuentas: lista, aviso })
}

/* ── Publicar ───────────────────────────────────────────────────────── */

async function publicar(db, orgId, datos, claims) {
  const {
    contenido = '', media = [], destinos = [], primerComentario = '',
    saleEn, zonaHoraria, tags = [], codigo = null, liga = null,
    campana = '', tactica = '', destino = 'ninguno',
  } = datos

  if (!Array.isArray(destinos) || !destinos.length) {
    return responder(400, { error: 'El post no tiene a dónde salir' })
  }
  if (!saleEn) return responder(400, { error: 'Falta la fecha de publicación' })

  /* El expediente se crea ANTES de llamar a Zernio, y su id viaja en la
   * clave de idempotencia y dentro de metadata.
   *
   * Si esta función muere después de que Zernio aceptó el post, el webhook
   * llega con un post que de otro modo no sabríamos de quién es. Con el id
   * adentro, el webhook lo encuentra igual y el expediente no queda huérfano
   * con un post publicado del otro lado. */
  const ref = db.collection('organizations').doc(orgId).collection(COLECCION).doc()

  const base = {
    contenido,
    media,
    destinos,
    primerComentario: primerComentario || '',
    codigo,
    liga,
    destinoLiga: destino,
    campana,
    tactica,
    tags,
    saleEn: admin.firestore.Timestamp.fromDate(new Date(saleEn)),
    estado: 'publicando',
    resultados: {},
    leads: 0,
    publicadoPor: claims.email || claims.uid,
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
  }
  await ref.set(base)

  const cuerpo = {
    ...(contenido.trim() ? { content: contenido } : {}),
    ...(media.length ? { mediaItems: media.map(m => ({ url: m.url })) } : {}),
    platforms: destinos.map(d => ({
      platform: d.plataforma,
      accountId: d.cuentaId,
      ...(d.customContent ? { customContent: d.customContent } : {}),
      ...(d.contentType || primerComentario
        ? {
            platformSpecificData: {
              ...(d.contentType ? { contentType: d.contentType } : {}),
              /* La historia no admite primer comentario: mandarlo ahí hace
               * que Zernio rechace el post entero. */
              ...(primerComentario && d.contentType !== 'story'
                ? { firstComment: primerComentario }
                : {}),
            },
          }
        : {}),
    })),
    scheduledFor: new Date(saleEn).toISOString(),
    ...(zonaHoraria ? { timezone: zonaHoraria } : {}),
    ...(tags.length ? { tags } : {}),
    metadata: { flowhubPostId: ref.id, flowhubOrgId: orgId, ...(codigo ? { flowhubCodigo: codigo } : {}) },
  }

  let creado
  try {
    creado = await crearPost(cuerpo, ref.id)
  } catch (e) {
    /* El expediente se marca como fallido en vez de borrarse: quien publicó
     * tiene que poder ver qué escribió y por qué lo rechazaron, sin volver a
     * escribirlo desde cero. */
    await ref.update({ estado: 'fallido', error: e.message })
    throw e
  }

  const post = creado.post || creado
  const zernioPostId = post._id || post.id || null
  await ref.update({
    zernioPostId,
    estado: 'programado',
  })

  return responder(200, { id: ref.id, zernioPostId, saleEn })
}

/* ── Números ────────────────────────────────────────────────────────── */

async function metricas(db, orgId, { id }) {
  const snap = await db.collection('organizations').doc(orgId).collection(COLECCION).doc(id).get()
  if (!snap.exists) return responder(404, { error: 'Ese post no existe' })

  const zernioPostId = snap.data().zernioPostId
  if (!zernioPostId) return responder(400, { error: 'Ese post nunca llegó a salir' })

  const r = await analiticasDePost(zernioPostId)

  /* La forma de la respuesta cambia según si Zernio devuelve un post suelto o
   * una lista. Se normaliza a un objeto plano acá, para que la pantalla no
   * tenga que conocer las dos. */
  const fila = r?.post || (Array.isArray(r?.posts) ? r.posts[0] : null) || r
  const a = fila?.analytics || fila?.metrics || {}
  const numeros = {
    alcance: a.reach ?? a.impressions ?? null,
    interacciones: a.engagement ?? a.totalEngagement ?? null,
    clics: a.clicks ?? a.linkClicks ?? null,
    comentarios: a.comments ?? null,
    compartidos: a.shares ?? null,
    likes: a.likes ?? null,
  }

  await snap.ref.update({ numeros, numerosEn: admin.firestore.FieldValue.serverTimestamp() })
  return responder(200, { numeros })
}

/* ── Cancelar ───────────────────────────────────────────────────────── */

async function cancelar(db, orgId, { id }) {
  const snap = await db.collection('organizations').doc(orgId).collection(COLECCION).doc(id).get()
  if (!snap.exists) return responder(404, { error: 'Ese post no existe' })
  const p = snap.data()

  if (p.estado === 'publicado') {
    return responder(400, { error: 'Ese post ya salió. Cancelarlo acá no lo borra de Facebook.' })
  }

  if (p.zernioPostId) await cancelarPost(p.zernioPostId)
  await snap.ref.update({ estado: 'cancelado', canceladoEn: admin.firestore.FieldValue.serverTimestamp() })
  return responder(200, { ok: true })
}
