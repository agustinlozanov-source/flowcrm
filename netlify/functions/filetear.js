// Fileteado: decide qué pedazos del video se van.
//
// Dos manos distintas, y a propósito:
//
//   Los silencios los calculamos nosotros, del hueco entre el fin de una
//   palabra y el principio de la siguiente. Es aritmética, no hace falta un
//   modelo y no se equivoca.
//
//   Las tomas repetidas, los arranques fallidos y las divagaciones las elige
//   Claude, porque eso es criterio sobre el texto.
//
// Y una precaución que importa: el modelo nunca escribe segundos. Devuelve
// números de palabra, y los segundos los sacamos de nuestros propios datos.
// Si le pidiéramos tiempos los inventaría, y un corte en el segundo
// equivocado se ve feísimo.
const Anthropic = require('@anthropic-ai/sdk')
const admin = require('firebase-admin')
const { initDb } = require('./lib/firebase')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/* Una pausa por debajo de esto es respirar, y respirar se queda. A 0.7s era
 * demasiado agresivo: a una persona hablando a cámara le quitaba veinte
 * pausas en cuatro minutos y quedaba dando brincos. */
const PAUSA_MINIMA = 1.2
// No se corta a hueso: queda un respiro a cada lado o suena atropellado.
const RESPIRO = 0.3

/* Dónde cortar entre dos palabras.
 *
 * Los tiempos que da el reconocimiento son aproximados: suele marcar el final
 * de una palabra un pelo antes de que termine el sonido. Cortar justo en ese
 * borde se come la cola de la palabra. Un editor humano corta en medio del
 * silencio que hay entre las dos, y eso es lo que hacemos: el punto medio
 * entre donde acaba una y empieza la siguiente. */
function entre(a, b) {
  if (a == null) return b
  if (b == null) return a
  return (a + b) / 2
}

/* Los silencios de verdad, los que midió el navegador al subir el video.
 * Cuando no los hay —piezas viejas— se cae al método pobre: adivinarlos por
 * el hueco entre palabras, que es lo que antes cortaba dentro del habla. */
function pausas(audio, palabras) {
  if (audio?.silencios?.length) {
    return audio.silencios
      .filter(s => s.fin - s.inicio >= PAUSA_MINIMA)
      .map(s => ({
        inicio: s.inicio + RESPIRO,
        fin: s.fin - RESPIRO,
        tipo: 'silencio',
        motivo: `Silencio de ${(s.fin - s.inicio).toFixed(1)}s`,
      }))
      .filter(c => c.fin - c.inicio >= 0.3)
  }

  const cortes = []
  for (let i = 1; i < palabras.length; i++) {
    const hueco = palabras[i].inicio - palabras[i - 1].fin
    if (hueco <= PAUSA_MINIMA) continue
    const inicio = palabras[i - 1].fin + RESPIRO
    const fin = palabras[i].inicio - RESPIRO
    if (fin - inicio < 0.3) continue
    cortes.push({ inicio, fin, tipo: 'silencio', motivo: `Pausa de ${hueco.toFixed(1)}s` })
  }
  return cortes
}

/* Dónde se puede cortar entre dos instantes: el centro del silencio real que
 * haya en medio. Si no hay silencio, devuelve null — y entonces NO se corta.
 * Es preferible dejar una muletilla que partir una palabra. */
function puntoDeCorte(silencios, desde, hasta) {
  const dentro = (silencios || []).filter(s => s.fin > desde && s.inicio < hasta)
  if (!dentro.length) return null
  const mayor = dentro.reduce((a, b) => (b.fin - b.inicio > a.fin - a.inicio ? b : a))
  return (Math.max(mayor.inicio, desde) + Math.min(mayor.fin, hasta)) / 2
}

/* Sonido que la transcripción no recogió: el "eeeh" arrastrado, la
 * respiración, el chasquido. Ninguna de las dos fuentes lo ve por separado —
 * el texto no lo escribió y el audio solo sabe que ahí suena algo. Cruzadas,
 * salen solos. */
function arrastres(audio, palabras) {
  if (!audio?.silencios?.length) return []
  const fuera = []
  for (let i = 1; i < palabras.length; i++) {
    const desde = palabras[i - 1].fin
    const hasta = palabras[i].inicio
    if (hasta - desde < 0.45) continue

    const callado = audio.silencios.reduce((a, s) => {
      const x = Math.max(desde, s.inicio)
      const y = Math.min(hasta, s.fin)
      return a + Math.max(0, y - x)
    }, 0)
    const conSonido = (hasta - desde) - callado
    if (conSonido < 0.33) continue

    fuera.push({
      inicio: desde + 0.05,
      fin: hasta - 0.05,
      tipo: 'arrastre',
      motivo: `${conSonido.toFixed(1)}s de sonido sin palabras`,
    })
  }
  return fuera
}

const HERRAMIENTA = {
  name: 'cortes',
  description: 'Entrega los tramos que hay que quitar del video',
  input_schema: {
    type: 'object',
    properties: {
      cortes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            desdePalabra: { type: 'integer', description: 'Número de la primera palabra que se va' },
            hastaPalabra: { type: 'integer', description: 'Número de la última palabra que se va' },
            tipo: {
              type: 'string',
              enum: ['muletilla', 'repeticion', 'arranque', 'divagacion'],
            },
            motivo: { type: 'string', description: 'Una frase corta explicando por qué' },
          },
          required: ['desdePalabra', 'hastaPalabra', 'tipo', 'motivo'],
        },
      },
      resumen: { type: 'string', description: 'Una o dos frases sobre cómo quedó' },
    },
    required: ['cortes', 'resumen'],
  },
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const responder = (statusCode, datos) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })

  const { orgId, brandId, piezaId } = JSON.parse(event.body || '{}')
  if (!orgId || !brandId || !piezaId) return responder(400, { error: 'FALTAN_DATOS' })

  /* Arrancar la base iba fuera del try: si la credencial fallaba, el error
   * se escapaba del manejador y Netlify devolvía un 502 pelado, sin una sola
   * pista de qué había pasado. */
  let piezaRef
  try {
    const db = initDb()
    piezaRef = db.collection('organizations').doc(orgId)
      .collection('brands').doc(brandId)
      .collection('piezas').doc(piezaId)
  } catch (e) {
    console.error('sin base de datos:', e)
    return responder(500, { error: 'SIN_BASE', detalle: e.message })
  }

  try {
    const snap = await piezaRef.get()
    if (!snap.exists) return responder(404, { error: 'PIEZA_NO_EXISTE' })
    const pieza = snap.data()
    const palabras = pieza.transcripcion?.palabras || []
    if (!palabras.length) return responder(400, { error: 'SIN_TRANSCRIPCION' })

    const numerado = palabras.map((p, i) => `[${i}] ${p.texto}`).join(' ')

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      tools: [HERRAMIENTA],
      tool_choice: { type: 'tool', name: 'cortes' },
      messages: [{
        role: 'user',
        content: `Esta es la transcripción de una grabación en crudo de una persona hablando a cámara. Cada palabra lleva su número delante.

${numerado}

Tu trabajo es decir qué tramos hay que quitar para que quede limpio, sin que se note el corte y sin perder nada de lo que dice.

Quita:
- Muletillas sueltas y sonidos de relleno: "este", "o sea", "eh", "mmm", "¿no?" cuando no aportan.
- Arranques fallidos: empezó una frase, se trabó y la volvió a empezar. Se queda la buena.
- Tomas repetidas: dijo lo mismo dos o tres veces buscando la toma. Se queda la mejor, normalmente la última.
- Divagaciones que se van del tema y vuelven sin haber aportado.

NO quites:
- Ideas, datos, ejemplos ni anécdotas, aunque estén dichos con torpeza.
- Pausas dramáticas o frases cortas que dan ritmo.
- Nada que deje la frase siguiente sin sentido.

Reglas:
- Devuelve números de palabra, nunca segundos.
- Los tramos no se pueden solapar y van en orden.
- Ante la duda, no cortes. Es más fácil que la persona quite algo después a que note que le falta.`,
      }],
    })

    const uso = res.content.find(c => c.type === 'tool_use')
    if (!uso) return responder(502, { error: 'SIN_CORTES' })

    const audio = pieza.audio || null
    const sil = audio?.silencios || []
    let sinSitio = 0

    // Los segundos salen de nuestros datos, no de lo que diga el modelo.
    const delModelo = (uso.input.cortes || [])
      .filter(c => Number.isInteger(c.desdePalabra) && Number.isInteger(c.hastaPalabra))
      .filter(c => c.desdePalabra >= 0 && c.hastaPalabra < palabras.length && c.hastaPalabra >= c.desdePalabra)
      .map(c => {
        const antes = palabras[c.desdePalabra - 1]?.fin
        const despues = palabras[c.hastaPalabra + 1]?.inicio
        const a = palabras[c.desdePalabra].inicio
        const b = palabras[c.hastaPalabra].fin

        // Con oído: se corta en el silencio real. Sin silencio en ningún
        // lado, no se corta — eso es lo que partía palabras.
        const ini = sil.length ? puntoDeCorte(sil, antes ?? 0, a) : entre(antes, a)
        const fin = sil.length ? puntoDeCorte(sil, b, despues ?? b + 1) : entre(b, despues)
        if (sil.length && ini === null && fin === null) { sinSitio++; return null }

        return {
          inicio: ini ?? a,
          fin: fin ?? b,
          tipo: c.tipo,
          motivo: c.motivo,
          desdePalabra: c.desdePalabra,
          hastaPalabra: c.hastaPalabra,
        }
      })
      .filter(Boolean)

    const todos = [...pausas(audio, palabras), ...arrastres(audio, palabras), ...delModelo]
      .sort((a, b) => a.inicio - b.inicio)
      .map((c, i) => ({ ...c, id: `c${i}`, activo: true }))

    const quitado = todos.reduce((a, c) => a + (c.fin - c.inicio), 0)
    const duracion = pieza.video?.duracion || palabras[palabras.length - 1]?.fin || 0

    await piezaRef?.set({
      estado: 'fileteada',
      fileteado: {
        cortes: todos,
        resumen: uso.input.resumen || '',
        conOido: Boolean(sil.length),
        sinSitio,
        duracionOriginal: duracion,
        duracionFinal: Math.max(0, duracion - quitado),
        hechoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    return responder(200, {
      ok: true,
      conOido: Boolean(sil.length),
      sinSitio,
      cortes: todos.length,
      quitado,
      duracionFinal: Math.max(0, duracion - quitado),
    })
  } catch (e) {
    console.error('filetear error:', e)
    await piezaRef?.set({ error: String(e.message || e).slice(0, 200) }, { merge: true }).catch(() => {})
    return responder(400, { error: 'NO_SE_PUDO_FILETEAR', detalle: e.message })
  }
}
