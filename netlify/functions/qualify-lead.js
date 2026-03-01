const OpenAI = require('openai')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { lead, agentConfig, orgName } = JSON.parse(event.body)

    const personality = {
      profesional: 'formal, directo y enfocado en resultados de negocio',
      amigable: 'cálido, cercano y conversacional',
      consultivo: 'hace preguntas, escucha activamente y da consejos estratégicos',
    }[agentConfig?.personality || 'profesional']

    const questions = (agentConfig?.qualifyingQuestions || []).join('\n- ')

    const prompt = `Eres el agente de ventas IA de ${orgName}. Tu personalidad es ${personality}.

Acabas de recibir un lead nuevo:
- Nombre: ${lead.name}
- Fuente: ${lead.source || 'manual'}
- Empresa: ${lead.company || 'No especificada'}
- Email: ${lead.email || 'No proporcionado'}

Las preguntas de calificación que usas son:
- ${questions}

Basándote en la información disponible, genera:
1. Un score de calificación del 0 al 100 (0 = sin información, 100 = lead muy calificado)
2. Un análisis breve de 1-2 oraciones explicando el score
3. El primer mensaje que le enviarías a este lead

Responde ÚNICAMENTE en este formato JSON exacto:
{
  "score": <número entre 0 y 100>,
  "analysis": "<análisis breve>",
  "suggestedMessage": "<primer mensaje al lead>"
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0].message.content)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: Math.min(100, Math.max(0, Number(result.score) || 0)),
        analysis: result.analysis || '',
        suggestedMessage: result.suggestedMessage || '',
      }),
    }
  } catch (err) {
    console.error('qualify-lead error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
