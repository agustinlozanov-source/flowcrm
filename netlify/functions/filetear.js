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

function silencios(palabras) {
  const cortes = []
  for (let i = 1; i < palabras.length; i++) {
    const hueco = palabras[i].inicio - palabras[i - 1].fin
    if (hueco <= PAUSA_MINIMA) continue
    const inicio = palabras[i - 1].fin + RESPIRO
    const fin = palabras[i].inicio - RESPIRO
    if (fin - inicio < 0.3) continue
    cortes.push({
      inicio, fin,
      tipo: 'silencio',
      motivo: `Pausa de ${hueco.toFixed(1)}s`,
      desdePalabra: i - 1,
      hastaPalabra: i,
    })
  }
  return cortes
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

  const db = initDb()
  const piezaRef = db.collection('organizations').doc(orgId)
    .collection('brands').doc(brandId)
    .collection('piezas').doc(piezaId)

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

    // Los segundos salen de nuestros datos, no de lo que diga el modelo.
    const delModelo = (uso.input.cortes || [])
      .filter(c => Number.isInteger(c.desdePalabra) && Number.isInteger(c.hastaPalabra))
      .filter(c => c.desdePalabra >= 0 && c.hastaPalabra < palabras.length && c.hastaPalabra >= c.desdePalabra)
      .map(c => ({
        // El punto medio del silencio anterior y del posterior, no el borde
        // de la palabra.
        inicio: entre(palabras[c.desdePalabra - 1]?.fin, palabras[c.desdePalabra].inicio),
        fin: entre(palabras[c.hastaPalabra].fin, palabras[c.hastaPalabra + 1]?.inicio),
        tipo: c.tipo,
        motivo: c.motivo,
        desdePalabra: c.desdePalabra,
        hastaPalabra: c.hastaPalabra,
      }))

    const todos = [...silencios(palabras), ...delModelo]
      .sort((a, b) => a.inicio - b.inicio)
      .map((c, i) => ({ ...c, id: `c${i}`, activo: true }))

    const quitado = todos.reduce((a, c) => a + (c.fin - c.inicio), 0)
    const duracion = pieza.video?.duracion || palabras[palabras.length - 1]?.fin || 0

    await piezaRef.set({
      estado: 'fileteada',
      fileteado: {
        cortes: todos,
        resumen: uso.input.resumen || '',
        duracionOriginal: duracion,
        duracionFinal: Math.max(0, duracion - quitado),
        hechoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    return responder(200, {
      ok: true,
      cortes: todos.length,
      quitado,
      duracionFinal: Math.max(0, duracion - quitado),
    })
  } catch (e) {
    console.error('filetear error:', e)
    await piezaRef.set({ error: String(e.message || e).slice(0, 200) }, { merge: true }).catch(() => {})
    return responder(400, { error: 'NO_SE_PUDO_FILETEAR', detalle: e.message })
  }
}
