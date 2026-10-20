// Escribe el guión de "tu versión" de un video de referencia.
//
// Importante y hay que decirlo sin adornos: el modelo NO ve el video. Solo
// tiene el caption, la duración, el autor y los números. Así que lo que
// escribe es la versión de la IDEA, adaptada a la marca — el encuadre, el
// decorado y el ritmo de los cortes los copia la persona mirando el video,
// que es justo lo que queríamos que hiciera.
const Anthropic = require('@anthropic-ai/sdk')
const admin = require('firebase-admin')
const { initDb } = require('./lib/firebase')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const HERRAMIENTA = {
  name: 'guion',
  description: 'Entrega el guión completo del video',
  input_schema: {
    type: 'object',
    properties: {
      hooks: {
        type: 'array',
        description: 'Tres primeras frases alternativas, de 3 segundos cada una',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string', description: 'pregunta, dato, contradicción, historia…' },
            texto: { type: 'string' },
          },
          required: ['tipo', 'texto'],
        },
      },
      guion: {
        type: 'object',
        properties: {
          apertura: { type: 'object', properties: { texto: { type: 'string' }, segundos: { type: 'number' } }, required: ['texto', 'segundos'] },
          desarrollo: { type: 'object', properties: { texto: { type: 'string' }, segundos: { type: 'number' } }, required: ['texto', 'segundos'] },
          cierre: { type: 'object', properties: { texto: { type: 'string' }, segundos: { type: 'number' } }, required: ['texto', 'segundos'] },
        },
        required: ['apertura', 'desarrollo', 'cierre'],
      },
      copy: {
        type: 'object',
        properties: {
          texto: { type: 'string', description: 'El pie de publicación' },
          hashtags: { type: 'array', items: { type: 'string' } },
        },
        required: ['texto', 'hashtags'],
      },
      duracionEstimada: { type: 'number', description: 'Segundos totales' },
      queObservar: {
        type: 'array',
        description: 'Tres cosas concretas que mirar en el video de referencia antes de grabar',
        items: { type: 'string' },
      },
    },
    required: ['hooks', 'guion', 'copy', 'duracionEstimada', 'queObservar'],
  },
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const responder = (statusCode, datos) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })

  try {
    const { orgId, brandId, referenciaId, angulo } = JSON.parse(event.body || '{}')
    if (!orgId || !referenciaId) return responder(400, { error: 'FALTAN_DATOS' })

    const db = initDb()
    const org = db.collection('organizations').doc(orgId)
    const [refSnap, marcaSnap] = await Promise.all([
      org.collection('references').doc(referenciaId).get(),
      brandId ? org.collection('brands').doc(brandId).get() : Promise.resolve(null),
    ])
    if (!refSnap.exists) return responder(404, { error: 'REFERENCIA_NO_EXISTE' })

    const ref = refSnap.data()
    const marca = marcaSnap?.exists ? marcaSnap.data() : {}

    const segundos = ref.duracion ? Math.round(ref.duracion) : 45

    const prompt = `Vas a escribir el guión de un reel de Instagram.

## La marca que va a grabarlo
- Nombre: ${marca.nombre || 'sin especificar'}
- Cuenta: @${marca.handle || 'sin especificar'}
- Nicho: ${marca.nicho || 'sin especificar'}
${marca.ig?.seguidores ? `- Seguidores: ${marca.ig.seguidores}` : ''}

## El video de referencia que se quiere emular
- Autor: @${ref.autor?.usuario || '?'}${ref.autor?.seguidores ? ` (${ref.autor.seguidores} seguidores)` : ''}
- Duración: ${segundos} segundos
- Vistas: ${ref.vistas ?? '?'}${ref.indice ? ` — ${ref.indice.toFixed(1)} veces la media de esa cuenta` : ''}
- Texto de la publicación: "${(ref.texto || '').slice(0, 600)}"
${angulo ? `\n## El ángulo que pidió la persona\n${String(angulo).slice(0, 400)}` : ''}

## Lo que tienes que hacer
Escribe la versión de esa idea para esta marca y su nicho. No la traduzcas palabra por
palabra: toma la estructura y el mecanismo que la hizo funcionar y llévalos al terreno
de esta marca.

Importante: NO has visto el video, solo su texto. No inventes lo que aparece en pantalla
ni describas planos como si los hubieras visto. En "queObservar" di qué tres cosas
concretas debe mirar la persona en el video original antes de grabar — eso sí lo puede
ver ella.

## Cómo escribir
- Español de México, de "tú". Nunca voseo rioplatense.
- Frases cortas, para decirlas en voz alta sin trabarse. Nada de párrafos de ensayo.
- La duración total, cerca de los ${segundos} segundos del original.
- El hook son los primeros 3 segundos: si ahí no engancha, lo demás da igual.
- Nada de "en este video te voy a contar". Empieza por el contenido.`

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      tools: [HERRAMIENTA],
      tool_choice: { type: 'tool', name: 'guion' },
      messages: [{ role: 'user', content: prompt }],
    })

    const uso = res.content.find(c => c.type === 'tool_use')
    if (!uso) return responder(502, { error: 'SIN_GUION' })
    const guion = uso.input

    // Se guarda atado a la referencia que emula: ese vínculo es el que algún
    // día permite decir si tu versión rindió más o menos que el original.
    let guionId = null
    if (brandId) {
      const doc = await org.collection('brands').doc(brandId).collection('scripts').add({
        ...guion,
        referenciaId,
        referencia: {
          autor: ref.autor?.usuario || null,
          url: ref.url || null,
          vistas: ref.vistas ?? null,
          indice: ref.indice ?? null,
        },
        angulo: angulo || null,
        estado: 'borrador',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      guionId = doc.id
    }

    return responder(200, { ok: true, guion, guionId })
  } catch (e) {
    console.error('gen-script-emulado error:', e)
    return responder(400, { error: 'NO_SE_PUDO_GENERAR', detalle: e.message })
  }
}
