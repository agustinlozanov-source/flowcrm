/* Leer una conversación y dejar su ficha.
 *
 * Cada conversación se lee una sola vez y con el mismo criterio. El modelo no
 * decide números: solo anota qué pasó, en categorías fijas, y el conteo lo
 * hace el código. Por eso aquí basta un modelo económico: el volumen es alto
 * y la tarea es acotada.
 *
 * Las categorías vienen de insights.js. Si se cambian, cambian para los dos
 * lados a la vez, o las fichas de este mes no se pueden contar contra las del
 * anterior.
 */
const Anthropic = require('@anthropic-ai/sdk')
const { CATEGORIAS_PREGUNTA, CATEGORIAS_OBJECION, MOMENTOS_PRECIO, CAIDAS } = require('./insights')

const MODELO = process.env.ANTHROPIC_MODEL_LECTURA || 'claude-haiku-5-5'

let cliente = null
const anthropic = () => (cliente ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))

const objeto = (props) => ({
  type: 'object', additionalProperties: false, required: Object.keys(props), properties: props,
})

const ESQUEMA = objeto({
  intencion: { type: 'string', description: 'Qué buscaba el cliente, en una frase corta.' },
  preguntas: {
    type: 'array',
    items: objeto({
      texto: { type: 'string', description: 'La pregunta resumida, en máximo 12 palabras, sin datos personales.' },
      categoria: { type: 'string', enum: CATEGORIAS_PREGUNTA },
      respondida: { type: 'boolean', description: 'true solo si el negocio la contestó con claridad.' },
    }),
  },
  objeciones: {
    type: 'array',
    items: objeto({
      texto: { type: 'string', description: 'La objeción resumida, en máximo 12 palabras, sin datos personales.' },
      categoria: { type: 'string', enum: CATEGORIAS_OBJECION },
    }),
  },
  precio: { type: 'string', enum: MOMENTOS_PRECIO },
  caida: { type: 'string', enum: CAIDAS },
  competencia: { type: 'array', items: { type: 'string' } },
  sentimiento: { type: 'string', enum: ['positivo', 'neutral', 'negativo'] },
  urgencia: { type: 'string', enum: ['alta', 'media', 'baja'] },
  promesas_indebidas: { type: 'array', items: { type: 'string' } },
})

const SISTEMA = `Lees una conversación de ventas por WhatsApp entre un cliente y un negocio. Del lado del negocio contestan un agente de IA y personas del equipo. Devuelves una ficha de lo que pasó.

Reglas:
- Las preguntas y objeciones se escriben resumidas, en máximo 12 palabras, con las palabras del cliente cuando se pueda.
- Nunca escribas nombres, teléfonos, correos, direcciones ni datos de salud que identifiquen a la persona. Si la pregunta los incluye, generalízala: «¿Atienden mi caso de rodilla?» se queda; el nombre del paciente, no.
- "respondida" es true solo si el negocio contestó esa pregunta con claridad dentro de la conversación. Si dio largas, la evadió, la mandó a otro lado sin contestar o nunca contestó, es false.
- Objeciones son las razones reales del cliente para no avanzar. Una pregunta de precio no es una objeción; «está muy caro» sí.
- "precio": si el precio apareció antes o después de que el negocio ofreciera una cita. Si nunca se habló de precio, "no_se_hablo".
- "caida": si el cliente dejó de contestar, después de qué. Si la conversación sigue viva, terminó en cita o en compra, "no_se_cayo". Si el último mensaje es del cliente y nadie le respondió, "esperando_nuestra_respuesta".
- "competencia": nombres de otros negocios, marcas o profesionales que el cliente mencione. Vacío si no hubo.
- "promesas_indebidas": lo que el negocio prometió y suena a descuento no autorizado, diagnóstico, garantía de resultado o plazo comprometido. Vacío si no hubo.
- No inventes. Si algo no aparece en la conversación, la lista va vacía.`

const VOZ = { cliente: 'Cliente', agente: 'Agente IA', persona: 'Equipo', otro: 'Sistema' }
const TOPE_MENSAJES = 80
const TOPE_CARACTERES_MENSAJE = 600

/** La conversación como texto, con quién habló. Se queda con los últimos mensajes si es muy larga. */
function transcribir(mensajes) {
  return mensajes.slice(-TOPE_MENSAJES).map(m => {
    const texto = String(m.texto || '').replace(/\s+/g, ' ').trim().slice(0, TOPE_CARACTERES_MENSAJE)
    return `${VOZ[m.de] || 'Sistema'}: ${texto || '[adjunto]'}`
  }).join('\n')
}

/** Devuelve { extraccion } o { error }. Nunca lanza: una ficha que falla no tumba la corrida. */
async function leerConversacion(mensajes) {
  try {
    const r = await anthropic().messages.create({
      model: MODELO,
      max_tokens: 4000,
      system: SISTEMA,
      messages: [{ role: 'user', content: `Conversación:\n\n${transcribir(mensajes)}` }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
    })
    if (r.stop_reason === 'refusal') return { error: 'El modelo se negó a leer esta conversación' }
    if (r.stop_reason === 'max_tokens') return { error: 'La ficha quedó incompleta' }
    const texto = r.content.find(b => b.type === 'text')?.text
    if (!texto) return { error: 'La respuesta vino sin ficha' }
    return { extraccion: JSON.parse(texto), tokens: r.usage || null }
  } catch (e) {
    return { error: e.message || String(e) }
  }
}

module.exports = { leerConversacion, transcribir, ESQUEMA, MODELO }
