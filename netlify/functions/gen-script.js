const OpenAI = require('openai')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { news, networks, agentConfig } = JSON.parse(event.body)

    const personality = {
      profesional: 'formal, directo y enfocado en resultados',
      amigable: 'cálido, cercano y conversacional',
      consultivo: 'analítico, hace reflexionar y da perspectivas únicas',
    }[agentConfig?.personality || 'amigable']

    const prompt = `Eres un experto en contenido viral para redes sociales. Tu personalidad es ${personality}.

Noticia a convertir en contenido:
- Título: ${news.title}
- Resumen: ${news.summary}
- Ángulo viral: ${news.viralAngle}

Redes destino: ${networks.join(', ')}

Crea un script completo para un video corto (60-90 segundos) con esta estructura:
1. HOOK (primeros 3 segundos) - 3 variantes diferentes
2. CONTEXTO (qué pasó, 15 segundos)
3. DESARROLLO (por qué importa, puntos clave, 45 segundos)
4. CTA (llamada a acción, 10 segundos)

También genera el copy específico para cada red: ${networks.join(', ')}

Para el copy incluye hashtags relevantes y el CTA específico de cada red.

Responde ÚNICAMENTE con este JSON exacto:
{
  "hooks": [
    { "type": "pregunta", "text": "texto del hook" },
    { "type": "dato", "text": "texto del hook" },
    { "type": "controversia", "text": "texto del hook" }
  ],
  "script": {
    "context": { "text": "texto del contexto", "duration": "0:04-0:20", "tip": "consejo de dirección" },
    "development": { "text": "texto del desarrollo", "duration": "0:20-0:55", "tip": "consejo de dirección" },
    "cta": { "text": "texto del CTA", "duration": "0:55-1:05", "tip": "consejo de dirección" }
  },
  "copies": {
    "tiktok": { "caption": "caption", "hashtags": ["tag1", "tag2"], "cta": "cta específico" },
    "instagram": { "caption": "caption", "hashtags": ["tag1", "tag2"], "cta": "cta específico" },
    "youtube": { "caption": "caption", "hashtags": ["tag1", "tag2"], "cta": "cta específico" },
    "facebook": { "caption": "caption", "hashtags": ["tag1", "tag2"], "cta": "cta específico" }
  },
  "estimatedDuration": 75
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0].message.content)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (err) {
    console.error('gen-script error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
