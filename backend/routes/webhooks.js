const { Router } = require('express')
const { processWhatsApp, processMessaging, processFacebookLead } = require('../services/metaService')
const { db } = require('../config/firebase')
const { FieldValue } = require('firebase-admin/firestore')
const OpenAI = require('openai')

const router = Router()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─────────────────────────────────────────────
// META / WHATSAPP / INSTAGRAM
// ─────────────────────────────────────────────

// GET /webhooks/meta — Verificación de Meta
router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge)
  }
  res.sendStatus(403)
})

// POST /webhooks/meta — Eventos de Meta
router.post('/meta', async (req, res) => {
  console.log('📨 META WEBHOOK POST recibido:', JSON.stringify(req.body))
  res.sendStatus(200) // Meta requiere respuesta inmediata
  try {
    const body = req.body
    const orgId = process.env.DEFAULT_ORG_ID
    if (!orgId) return console.error('DEFAULT_ORG_ID not set')

    for (const entry of (body.entry || [])) {
      if (body.object === 'whatsapp_business_account') {
        await processWhatsApp(entry, orgId)
      } else if (body.object === 'page') {
        if (entry.messaging) await processMessaging(entry, 'messenger', orgId)
        if (entry.changes?.some(c => c.field === 'leadgen')) await processFacebookLead(entry, orgId)
      } else if (body.object === 'instagram') {
        await processMessaging(entry, 'instagram', orgId)
      }
    }
    console.log('✅ META WEBHOOK procesado correctamente')
  } catch (err) {
    console.error('❌ meta-webhook error:', err.message, err.stack)
  }
})

// ─────────────────────────────────────────────
// TELEGRAM — Soporte bot
// ─────────────────────────────────────────────

const SUPPORT_KB = `
Eres el agente de soporte técnico de FlowCRM (Qubit Corp.).
Responde solo dudas técnicas de FlowCRM. Sé conciso, amable y profesional.
Si no puedes resolver con certeza, responde exactamente: "ESCALAR_TICKET"
`

async function sendTelegram(chatId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

// POST /webhooks/telegram — Telegram webhook
router.post('/telegram', async (req, res) => {
  res.sendStatus(200)
  const message = req.body?.message
  if (!message?.text) return

  const chatId = message.chat.id
  const userText = message.text.trim()
  const username = message.from?.username || ''
  const firstName = message.from?.first_name || ''

  try {
    if (userText === '/start') {
      await sendTelegram(chatId,
        `👋 Hola *${firstName}*\\! Soy el asistente de soporte de *FlowCRM*.\n\n¿En qué te puedo ayudar?\n\n_Si no puedo resolver tu consulta, crearé un ticket automáticamente._`
      )
      return
    }

    // Get history
    const histSnap = await db.collection('supportConversations')
      .where('chatId', '==', String(chatId))
      .orderBy('createdAt', 'desc').limit(8).get()
    const history = histSnap.docs.map(d => d.data()).reverse()

    // Save user message
    await db.collection('supportConversations').add({ chatId: String(chatId), role: 'user', text: userText, createdAt: FieldValue.serverTimestamp() })

    if (userText.startsWith('/ticket')) {
      const subject = userText.replace('/ticket', '').trim() || 'Ticket manual'
      const ticketRef = await db.collection('supportTickets').add({
        telegramChatId: String(chatId), subject, status: 'open', priority: 'normal',
        messages: [{ role: 'user', text: subject, ts: new Date().toISOString() }],
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      })
      await sendTelegram(chatId, `✅ Ticket *#${ticketRef.id.slice(-6).toUpperCase()}* creado.\n\nEl equipo te responderá en máx. *24 horas hábiles* (L-V, 9-18h CST).`)
      return
    }

    // AI resolution
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SUPPORT_KB },
        ...history.slice(-6).map(m => ({ role: m.role, content: m.text })),
        { role: 'user', content: userText },
      ],
      max_tokens: 400, temperature: 0.3,
    })
    const aiReply = aiResponse.choices[0].message.content.trim()

    if (aiReply === 'ESCALAR_TICKET') {
      const ticketRef = await db.collection('supportTickets').add({
        telegramChatId: String(chatId), subject: userText.slice(0, 80), status: 'open', priority: 'normal',
        messages: [...history.slice(-4), { role: 'user', text: userText, ts: new Date().toISOString() }],
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      })
      const msg = `No encontré respuesta precisa. Ticket *#${ticketRef.id.slice(-6).toUpperCase()}* creado.\n\nTe responderán en *máx. 24 hrs hábiles* (L-V, 9-18h CST).`
      await sendTelegram(chatId, msg)
      await db.collection('supportConversations').add({ chatId: String(chatId), role: 'assistant', text: msg, createdAt: FieldValue.serverTimestamp() })
    } else {
      const isUrgent = /urgente|caído|no funciona|error crítico/i.test(userText)
      const finalMsg = isUrgent
        ? aiReply + `\n\n⚠️ Detecté urgencia. Creando ticket con prioridad alta...`
        : aiReply
      await sendTelegram(chatId, finalMsg)
      await db.collection('supportConversations').add({ chatId: String(chatId), role: 'assistant', text: finalMsg, createdAt: FieldValue.serverTimestamp() })
    }
  } catch (err) {
    console.error('Telegram support error:', err)
    await sendTelegram(chatId, `Ocurrió un error. Intenta de nuevo o escribe /ticket para abrir un caso.`)
  }
})

// POST /webhooks/telegram/reply — Superadmin responde ticket
router.post('/telegram/reply', async (req, res) => {
  const { chatId, ticketId, message } = req.body
  if (!chatId || !message) return res.status(400).json({ error: 'Missing chatId or message' })
  try {
    const text = `📩 *Respuesta de Qubit Corp.* — Ticket #${ticketId}\n\n${message}`
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
    const data = await response.json()
    if (!data.ok) return res.status(500).json({ error: data.description })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
