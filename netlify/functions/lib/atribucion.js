/* De qué post vino un lead.
 *
 * El post no trae los leads pegados: los trae la liga. Trafficker le pone a
 * cada post un código corto y lo mete dentro de la liga que publica, y acá se
 * recoge por los tres caminos por los que puede volver:
 *
 *   · el primer mensaje de WhatsApp, con el código en el texto precargado
 *   · un comentario en el post, que trae el id del post de la plataforma
 *   · un referral de m.me / ig.me, que devuelve el `ref` tal cual lo pusimos
 */
const admin = require('firebase-admin')

const COLECCION = 'trafficker_posts'

/* Gemela de la que vive en src/lib/trafficker.js, a propósito: la pantalla es
 * un módulo ESM y esto corre en CommonJS. Si cambia el alfabeto, cambia en
 * las dos o los códigos dejan de leerse. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LARGO = 5

function codigosEnTexto(texto) {
  const re = new RegExp(`\\b[${ALFABETO}]{${LARGO}}\\b`, 'g')
  return [...new Set(String(texto || '').toUpperCase().match(re) || [])]
}

/* El código entre corchetes, que es como lo escribe el módulo. Gemela de la
 * de src/lib/trafficker.js. */
function codigoEntreCorchetes(texto) {
  const m = String(texto || '').toUpperCase().match(new RegExp(`\\[([${ALFABETO}]{${LARGO}})\\]`))
  return m ? m[1] : null
}

/* Cuántos candidatos sueltos se alcanzan a buscar en la base.
 *
 * «Saber», «sobre», «antes» y «temas» son palabras normales que caen enteras
 * dentro del alfabeto del código. Sin tope, un mensaje largo dispara una
 * consulta por cada una, en el camino por el que pasa cada mensaje que entra
 * al CRM. Cuatro alcanza: el código real suele venir al principio del texto
 * precargado, y si alguien lo borró del todo, ninguna cantidad de consultas
 * lo va a encontrar. */
const TOPE_CANDIDATOS = 4

/* El post dueño de un código.
 *
 * Los candidatos que salen de un texto suelto se contrastan contra los
 * códigos que existen de verdad: cinco letras seguidas aparecen por
 * casualidad en cualquier mensaje largo, y dar por buena la primera
 * coincidencia atribuiría leads a un post al azar. */
async function postPorCodigo(db, orgId, candidatos) {
  for (const c of candidatos) {
    const snap = await db.collection('organizations').doc(orgId)
      .collection(COLECCION).where('codigo', '==', c).limit(1).get()
    if (!snap.empty) return snap.docs[0]
  }
  return null
}

/** El post por el id que le dio la plataforma, para comentarios. */
async function postPorIdDePlataforma(db, orgId, platformPostId) {
  if (!platformPostId) return null
  const snap = await db.collection('organizations').doc(orgId)
    .collection(COLECCION)
    .where('idsDePlataforma', 'array-contains', String(platformPostId))
    .limit(1).get()
  return snap.empty ? null : snap.docs[0]
}

/* Deja el origen escrito en el lead y suma uno al post.
 *
 * El primer origen gana y no se pisa. Alguien que comenta un post, después
 * escribe por WhatsApp y más tarde entra por una landing sigue siendo UN
 * lead de UN post; dejar que el último toque lo reescriba haría que los
 * números de los posts sumaran más leads de los que hubo.
 */
async function atribuir(db, orgId, leadRef, lead, postSnap) {
  if (!postSnap) return false
  if (lead?.origenPostId) return false

  await leadRef.update({
    origenPostId: postSnap.id,
    origenCodigo: postSnap.data().codigo || null,
    origenEn: admin.firestore.FieldValue.serverTimestamp(),
  })

  /* increment() y no leer-sumar-escribir: dos leads del mismo post entrando a
   * la vez se pisarían, y el contador quedaría por debajo del real sin que
   * nada falle. */
  await postSnap.ref.update({ leads: admin.firestore.FieldValue.increment(1) })

  console.log(`[atribucion] lead ${leadRef.id} viene del post ${postSnap.id} (${postSnap.data().codigo})`)
  return true
}

/** Desde el texto de un mensaje. Devuelve true si quedó atribuido. */
async function porTexto(db, orgId, leadRef, lead, texto) {
  // El camino normal: una sola consulta, sin falsos candidatos.
  const exacto = codigoEntreCorchetes(texto)
  const candidatos = exacto ? [exacto] : codigosEnTexto(texto).slice(0, TOPE_CANDIDATOS)
  if (!candidatos.length) return false
  const post = await postPorCodigo(db, orgId, candidatos)
  return atribuir(db, orgId, leadRef, lead, post)
}

/** Desde el `ref` de una liga m.me / ig.me. */
async function porRef(db, orgId, leadRef, lead, ref) {
  const limpio = String(ref || '').trim().toUpperCase()
  if (!limpio) return false
  const post = await postPorCodigo(db, orgId, [limpio, ...codigosEnTexto(limpio)])
  return atribuir(db, orgId, leadRef, lead, post)
}

/** Desde un comentario, que trae el id del post en la plataforma. */
async function porComentario(db, orgId, leadRef, lead, platformPostId) {
  const post = await postPorIdDePlataforma(db, orgId, platformPostId)
  return atribuir(db, orgId, leadRef, lead, post)
}

/* ── Estado del post ────────────────────────────────────────────────── */

/* Lo que Zernio llama a cada estado, en nuestras palabras. */
const ESTADO = { published: 'publicado', partial: 'parcial', failed: 'fallido', scheduled: 'programado' }

/* Guarda el resultado de un post que salió (o que no).
 *
 * Encuentra el expediente por el id que mandamos dentro de metadata, y si no
 * está, por el id de Zernio. El primero cubre el caso feo: que la función
 * haya muerto justo después de que Zernio aceptara el post, sin alcanzar a
 * guardar su id de nuestro lado. */
async function guardarResultado(db, orgId, post, evento) {
  const nuestroId = post?.metadata?.flowhubPostId || null

  let snap = null
  if (nuestroId) {
    const d = await db.collection('organizations').doc(orgId)
      .collection(COLECCION).doc(nuestroId).get()
    if (d.exists) snap = d
  }
  if (!snap && post?.id) {
    const q = await db.collection('organizations').doc(orgId)
      .collection(COLECCION).where('zernioPostId', '==', post.id).limit(1).get()
    if (!q.empty) snap = q.docs[0]
  }
  if (!snap) {
    console.warn(`[atribucion] llegó ${evento} de un post que no es nuestro: ${post?.id}`)
    return
  }

  const resultados = {}
  const ids = []
  for (const p of post.platforms || []) {
    resultados[p.platform] = {
      estado: p.status || null,
      url: p.publishedUrl || null,
      idEnPlataforma: p.platformPostId || null,
      error: p.error || p.platformError || null,
    }
    if (p.platformPostId) ids.push(String(p.platformPostId))
  }

  await snap.ref.update({
    estado: ESTADO[evento] || ESTADO[post.status] || 'publicado',
    zernioPostId: post.id || snap.data().zernioPostId || null,
    resultados,
    /* Plano y aparte, porque Firestore no sabe buscar dentro de un mapa: el
     * comentario que llega después trae este id y con él hay que dar con el
     * post. */
    idsDePlataforma: ids,
    publicadoEn: post.publishedAt
      ? admin.firestore.Timestamp.fromDate(new Date(post.publishedAt))
      : admin.firestore.FieldValue.serverTimestamp(),
  })

  console.log(`[atribucion] post ${snap.id} quedó ${ESTADO[evento] || evento}`)
}

module.exports = {
  codigosEnTexto, codigoEntreCorchetes, porTexto, porRef, porComentario, guardarResultado,
  postPorCodigo, postPorIdDePlataforma,
}
