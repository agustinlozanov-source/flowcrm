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
const ENV = process.env.FIREBASE_ENV || 'dev'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MANYCHAT_API_KEY = process.env.MANYCHAT_API_KEY

app.get('/health', (req, res) => res.sendStatus(200))

// Webhook por tenant
app.post('/webhook/manychat/:orgId', (req, res) => {
  console.log('Webhook recibido:', req.params.orgId, req.body.last_input_text)
  res.sendStatus(200)

  const { orgId } = req.params
  const body = req.body
  const subscriber_id = body.id
  const text = body.last_input_text
  const name = body.name || 'Sin nombre'
  const page_id = body.page_id

  if (!text || !subscriber_id) return

  const LEADS_COL = `manychat_${ENV}_leads`
  const CONVERSATIONS_COL = `manychat_${ENV}_conversations`

  setImmediate(async () => {
    try {
      // 1. Guardar lead bajo el tenant
      const leadRef = db.collection(LEADS_COL).doc(`${orgId}_${subscriber_id}`)
      await leadRef.set({
        subscriber_id,
        orgId,
        name,
        page_id,
        channel: 'manychat',
        lastMessage: text,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true })

      // 2. Guardar mensaje entrante
      await db.collection(CONVERSATIONS_COL).add({
        subscriber_id,
        orgId,
        role: 'user',
        text,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })

      // 3. Leer historial del tenant
      const historySnap = await db.collection(CONVERSATIONS_COL)
        .where('subscriber_id', '==', subscriber_id)
        .where('orgId', '==', orgId)
        .orderBy('createdAt', 'asc')
        .limitToLast(10)
        .get()

      const messages = historySnap.docs.map(d => ({
        role: d.data().role,
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
      await db.collection(CONVERSATIONS_COL).add({
        subscriber_id,
        orgId,
        role: 'assistant',
        text: reply,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })

      // 6. Enviar via ManyChat
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

      console.log(`[${orgId}] Mensaje procesado para ${name}`)
    } catch (err) {
      console.error(`[${orgId}] Error:`, err.message)
    }
  })
})

app.listen(process.env.PORT || 3000, () => console.log('ManyChat integration running'))
