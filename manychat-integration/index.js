const express = require('express')
const axios = require('axios')
const Anthropic = require('@anthropic-ai/sdk')
const admin = require('firebase-admin')

const app = express()
app.use(express.json())

admin.initializeApp({
  credential: admin.credential.cert({
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
})

const db = admin.firestore()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

app.get('/health', (req, res) => res.sendStatus(200))

// Webhook por tenant
app.post('/webhook/manychat/:orgId', (req, res) => {
  res.sendStatus(200)

  const { orgId } = req.params
  const body = req.body
  const subscriber_id = body.id
  const text = body.last_input_text
  const name = body.name || 'Sin nombre'
  const page_id = body.page_id

  if (!text || !subscriber_id) return

  setImmediate(async () => {
    try {
      // Detectar canal
      let channel = 'messenger'
      if (body.ig_id) channel = 'instagram'
      if (body.whatsapp_phone) channel = 'whatsapp'

      const leadRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('leads')
        .doc(subscriber_id)

      // 1. Guardar / actualizar lead
      await leadRef.set({
        subscriber_id,
        orgId,
        name,
        page_id,
        channel,
        lastMessage: text,
        hasUnread: true,
        lastMessageChannel: channel,
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true })

      // 2. Guardar mensaje entrante
      await leadRef.collection('conversations').add({
        role: 'user',
        text,
        channel,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })

      // Leer API Key del tenant
      const orgDoc = await db.collection('organizations').doc(orgId).get()
      const manychatApiKey = orgDoc.data()?.manychatApiKey || process.env.MANYCHAT_API_KEY

      // 3. Leer historial
      const historySnap = await leadRef.collection('conversations')
        .orderBy('createdAt', 'asc')
        .limitToLast(10)
        .get()

      const messages = historySnap.docs.map(d => ({
        role: d.data().role === 'bot' ? 'assistant' : d.data().role,
        content: d.data().text
      }))

      // 4. Claude responde
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages
      })

      const reply = response.content[0].text

      // 5. Guardar respuesta
      await leadRef.collection('conversations').add({
        role: 'bot',
        text: reply,
        channel,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })

      // 6. Enviar via ManyChat
      const contentData = channel === 'whatsapp'
        ? {
            version: 'v2',
            content: {
              type: 'whatsapp',
              messages: [{ type: 'text', text: reply }]
            }
          }
        : {
            version: 'v2',
            content: {
              messages: [{ type: 'text', text: reply }]
            }
          }

      await axios.post(
        'https://api.manychat.com/fb/sending/sendContent',
        { subscriber_id, data: contentData },
        { headers: { Authorization: `Bearer ${manychatApiKey}` } }
      )

      console.log(`[${orgId}] Mensaje procesado para ${name}`)
    } catch (err) {
      console.error(`[${orgId}] Error:`, err.response?.data || err.message)
    }
  })
})

app.listen(process.env.PORT || 3000, () => console.log('ManyChat integration running'))
