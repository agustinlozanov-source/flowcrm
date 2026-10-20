// Transcribe el crudo de una pieza y deja el texto con sus tiempos.
//
// Es el primer paso del fileteado: todo lo que viene después —qué se queda,
// qué se va, dónde están los silencios— se decide sobre este texto, no sobre
// el video. Nosotros nunca tocamos los píxeles.
const admin = require('firebase-admin')
const { initDb } = require('./lib/firebase')
const { transcribir } = require('./lib/transcribir')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const responder = (statusCode, datos) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })

  const { orgId, brandId, piezaId } = JSON.parse(event.body || '{}')
  if (!orgId || !brandId || !piezaId) return responder(400, { error: 'FALTAN_DATOS' })

  const db = initDb()
  const piezaRef = db.collection('organizations').doc(orgId)
    .collection('brands').doc(brandId)
    .collection('piezas').doc(piezaId)

  try {
    const snap = await piezaRef.get()
    if (!snap.exists) return responder(404, { error: 'PIEZA_NO_EXISTE' })
    const pieza = snap.data()
    if (!pieza.video?.url) return responder(400, { error: 'SIN_VIDEO' })

    await piezaRef.set({ estado: 'transcribiendo', error: null }, { merge: true })

    const t = await transcribir(pieza.video.url, { idioma: pieza.idioma })

    await piezaRef.set({
      estado: 'transcrita',
      transcripcion: {
        texto: t.texto,
        palabras: t.palabras,
        idioma: t.idioma,
        modelo: t.modelo,
        hechaEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      video: { ...pieza.video, duracion: t.duracion ?? pieza.video.duracion ?? null },
      error: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    return responder(200, { ok: true, palabras: t.palabras.length, duracion: t.duracion })
  } catch (e) {
    console.error('transcribe error:', e)
    // Que la pieza lo diga en pantalla: si se queda en "transcribiendo" para
    // siempre, nadie sabe si está trabajando o si se murió.
    await piezaRef.set({
      estado: 'crudo',
      error: String(e.message || e).slice(0, 200),
    }, { merge: true }).catch(() => {})

    if (e.sinProveedor) {
      return responder(400, {
        error: 'SIN_PROVEEDOR',
        detalle: 'Falta configurar DEEPGRAM_API_KEY en Netlify.',
      })
    }
    return responder(400, { error: 'NO_SE_PUDO_TRANSCRIBIR', detalle: e.message })
  }
}
