const Anthropic = require('@anthropic-ai/sdk')

const anthropic = new Anthropic({ apiKey: process.env.VITE_ANTHROPIC_KEY })

/**
 * Genera una respuesta usando Claude.
 * @param {string} system - Prompt del sistema
 * @param {Array} messages - Historial de mensajes [{role, content}]
 * @param {number} maxTokens - Máximo de tokens en la respuesta
 */
async function chat({ system, messages, maxTokens = 500 }) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: maxTokens,
    system,
    messages,
  })
  return response.content[0]?.text || ''
}

/**
 * Clasifica intención del lead.
 */
async function classifyIntent(message) {
  const response = await chat({
    system: 'Clasifica la intención del mensaje en una sola palabra: INTERESADO, DUDAS, PRECIO, RECHAZO, AGENDAR, OTRO.',
    messages: [{ role: 'user', content: message }],
    maxTokens: 20,
  })
  return response.trim().toUpperCase()
}

/**
 * Genera resumen de conversación.
 */
async function summarizeConversation(messages) {
  const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n')
  return await chat({
    system: 'Resume esta conversación de ventas en máximo 3 oraciones. Incluye: estado del lead, objeciones principales y próximo paso sugerido.',
    messages: [{ role: 'user', content: conversation }],
    maxTokens: 200,
  })
}

module.exports = { chat, classifyIntent, summarizeConversation }
