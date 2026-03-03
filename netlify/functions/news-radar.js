const OpenAI = require('openai')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { topics } = JSON.parse(event.body || '{}')

    if (!topics || topics.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'NO_TOPICS' }),
      }
    }

    const prompt = `Eres un experto en contenido viral para redes sociales. Busca las 6 noticias más importantes y con mayor potencial viral de HOY sobre estos temas: ${topics.join(', ')}.

Para cada noticia proporciona:
1. Un titular impactante en español
2. Un resumen de 2 oraciones
3. Por qué es viral (ángulo de contenido)
4. Un score de potencial viral del 0 al 100
5. La fuente o medio
6. La categoría del tema

Responde ÚNICAMENTE con este JSON exacto:
{
  "news": [
    {
      "title": "titular impactante",
      "summary": "resumen de 2 oraciones",
      "viralAngle": "por qué es viral",
      "score": 95,
      "source": "nombre del medio",
      "category": "IA & Tech",
      "publishedAt": "hace X horas"
    }
  ]
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0].message.content)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (err) {
    console.error('news-radar error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
