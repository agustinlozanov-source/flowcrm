const express = require('express')
const axios = require('axios')
const Anthropic = require('@anthropic-ai/sdk')

const app = express()
app.use(express.json())

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MANYCHAT_API_KEY = process.env.MANYCHAT_API_KEY

// Recibe mensajes de ManyChat
app.post('/webhook/manychat', async (req, res) => {
  res.sendStatus(200) // responde rápido a ManyChat

  const { subscriber_id, text } = req.body
  if (!text || !subscriber_id) return

  try {
    // Agente responde
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: text }]
    })

    const reply = response.content[0].text

    // Envía respuesta via ManyChat API
    await axios.post(
      'https://api.manychat.com/fb/sending/sendContent',
      {
        subscriber_id,
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text: reply }]
          }
        }
      },
      { headers: { Authorization: `Bearer ${MANYCHAT_API_KEY}` } }
    )
  } catch (err) {
    console.error('Error:', err.message)
  }
})

app.listen(process.env.PORT || 3000, () => console.log('ManyChat integration running'))
