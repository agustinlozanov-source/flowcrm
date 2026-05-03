// netlify/functions/portal-chat.js
// Proxy seguro para llamadas a Claude desde el portal de implementación del cliente.
// Mantiene ANTHROPIC_API_KEY en el servidor — nunca expuesta al browser.

// Restricción de origen — configura ALLOWED_ORIGIN en Netlify → Environment variables
// Valor recomendado: https://tu-sitio.netlify.app (o dominio custom)
// Si no está definida, cae a '*' solo en development (no debería ocurrir en producción)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    }
  }

  const { model, max_tokens, messages, system, implId } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'messages array is required and must not be empty' }),
    }
  }

  const invalidMsg = messages.find(m => !m.role || !m.content || (typeof m.content === 'string' && m.content.trim() === ''))
  if (invalidMsg) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Each message must have a non-empty role and content' }),
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[portal-chat] ANTHROPIC_API_KEY not set')
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error' }),
    }
  }

  // Construir payload — sólo los campos que Anthropic acepta
  const anthropicPayload = {
    model: model || 'claude-sonnet-4-6',
    max_tokens: max_tokens || 800,
    messages,
    ...(system ? { system } : {}),
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 9000)

  let anthropicRes
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicPayload),
      signal: controller.signal,
    })
  } catch (err) {
    const isTimeout = err.name === 'AbortError'
    console.error(`[portal-chat] ${isTimeout ? 'Timeout' : 'Network error'} calling Anthropic:`, err.message)
    return {
      statusCode: isTimeout ? 504 : 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: isTimeout ? 'Anthropic API timeout' : 'Failed to reach Anthropic API' }),
    }
  } finally {
    clearTimeout(timeoutId)
  }

  const data = await anthropicRes.json()

  // Log mínimo para tracking de costos
  const usage = data.usage || {}
  console.log(
    `[portal-chat] implId=${implId || 'unknown'} ` +
    `status=${anthropicRes.status} ` +
    `input_tokens=${usage.input_tokens ?? '?'} ` +
    `output_tokens=${usage.output_tokens ?? '?'}`
  )

  return {
    statusCode: anthropicRes.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
}
