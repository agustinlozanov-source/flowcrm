const OpenAI = require('openai')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { headers, sampleRows } = JSON.parse(event.body)

    const prompt = `Eres un experto en CRM. Analiza estos encabezados de un archivo CSV/Excel y mapéalos a los campos estándar de un CRM.

Encabezados del archivo: ${JSON.stringify(headers)}

Muestra de datos (primeras 3 filas):
${JSON.stringify(sampleRows, null, 2)}

Campos disponibles en el CRM:
- name: nombre completo del contacto
- company: empresa u organización
- email: correo electrónico
- phone: teléfono o celular
- value: valor monetario del deal (solo número)
- source: origen del lead (manual, meta_ads, instagram, whatsapp, linkedin, web, referral)
- notes: notas o comentarios adicionales
- ignore: columna que no corresponde a ningún campo

Responde ÚNICAMENTE con un JSON con este formato exacto:
{
  "mapping": {
    "<header_original>": "<campo_crm>"
  },
  "confidence": <número del 0 al 100>,
  "notes": "<observación breve si hay algo importante>"
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0].message.content)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (err) {
    console.error('map-columns error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
