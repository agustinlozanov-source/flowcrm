// netlify/functions/telegram-support.js
// Webhook: Telegram → AI Agent → Ticket (if unresolved)

const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const OpenAI = require('openai')

// ─── INIT ───
function initFirebase() {
  if (getApps().length) return getFirestore()
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
  return getFirestore()
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── KNOWLEDGE BASE ───
const KNOWLEDGE_BASE = `
Eres el agente de soporte técnico de FlowCRM, desarrollado por Qubit Corp.
Respondes exclusivamente dudas técnicas sobre FlowCRM. Eres conciso, amable y profesional.
Si no puedes resolver el problema con certeza, responde exactamente: "ESCALAR_TICKET"

## FlowCRM — Módulos disponibles

### Pipeline de Ventas
- Tablero Kanban con etapas personalizables: Nuevo, Contactado, Calificado, Propuesta, Cierre
- Crear leads con nombre, empresa, email, teléfono, valor estimado
- Arrastrar leads entre etapas
- Ver historial de interacciones por lead

### Inbox Unificado (Meta)
- Centraliza mensajes de Facebook Messenger, Instagram DM y WhatsApp
- Responde desde una sola bandeja
- El Agente IA puede responder automáticamente
- Requiere Page Access Token de Meta configurado por Qubit Corp.

### Agente IA de Ventas
- Responde automáticamente en el Inbox
- Califica leads según criterios configurados
- Tiene personalidad y técnica de venta definida por Qubit Corp. al inicio
- Para cambiar su comportamiento, contactar soporte (ticket)

### Content Studio
- Radar de noticias de tu industria
- Generador de guiones para video
- Teleprompter integrado
- Los temas del radar se configuran desde el panel

### Landing Pages
- 10 plantillas de alta conversión disponibles
- Editor en vivo con vista previa
- Formularios conectados al Pipeline

### Analytics & Reportes
- Dashboard con métricas clave: leads por etapa, tasa de conversión, ROI
- Histórico de actividad

### Programa de Referidos
- Gestión de referidos con códigos de descuento
- Seguimiento de comisiones

## Preguntas frecuentes

**¿Por qué no llegan mensajes al Inbox?**
Puede ser por: (1) Token de Meta vencido — contactar a Qubit Corp. para renovarlo, (2) Webhook no configurado correctamente — verificar en Meta Developers, (3) Página de Facebook no conectada.

**¿Cómo cambio las etapas del pipeline?**
En la vista Pipeline, hacer clic en el ícono de configuración (engranaje) en la esquina superior derecha.

**¿El Agente IA no responde bien, qué hago?**
El comportamiento del agente se ajusta desde el panel de configuración del Agente IA. Si necesitas cambios profundos en su personalidad o base de conocimiento, abre un ticket.

**¿Cómo agrego un nuevo usuario a mi organización?**
Contactar a Qubit Corp. vía soporte para agregar usuarios adicionales. La cantidad de usuarios está definida en tu plan.

**¿Puedo conectar WhatsApp?**
WhatsApp Business API requiere aprobación de Meta y un número dedicado. Qubit Corp. gestiona este proceso. Si tu plan lo incluye, abrir ticket para coordinar.

**¿Cómo exporto mis leads?**
Desde el módulo de Contactos, botón "Exportar" en la esquina superior derecha. Descarga en CSV.

**¿La plataforma tiene app móvil?**
Actualmente solo versión web responsive. App móvil en roadmap.

## Política de soporte

- Horario de atención para tickets: Lunes a Viernes, 9:00 - 18:00 CST
- Tiempo de respuesta: máx. 24 horas hábiles
- Para urgencias críticas (plataforma caída): se atiende mismo día
- Las videollamadas de soporte no están incluidas — son parte del proceso de implementación únicamente
- Cambios de configuración técnica (tokens, webhooks, agente) son gestionados exclusivamente por Qubit Corp.
`

// ─── TELEGRAM API ───
async function sendTelegram(chatId, text, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  }
  if (replyMarkup) body.reply_markup = replyMarkup

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── AI AGENT ───
async function tryResolveWithAI(db, chatId, userMessage, history) {
  // Build conversation history for context
  const messages = [
    { role: 'system', content: KNOWLEDGE_BASE },
    ...history.slice(-6).map(m => ({ role: m.role, content: m.text })),
    { role: 'user', content: userMessage },
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 400,
    temperature: 0.3,
  })

  const reply = response.choices[0].message.content.trim()
  return reply
}

// ─── FIND OR CREATE CLIENT ───
async function findClient(db, chatId, username, firstName) {
  const clientsRef = db.collection('supportClients')
  const snap = await clientsRef.where('telegramChatId', '==', String(chatId)).limit(1).get()

  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() }

  // Try to match with an organization by Telegram username
  const orgSnap = await db.collection('organizations')
    .where('telegramUsername', '==', username || '')
    .limit(1).get()

  const orgId = orgSnap.empty ? null : orgSnap.docs[0].id
  const orgName = orgSnap.empty ? null : orgSnap.docs[0].data().name

  const newClient = {
    telegramChatId: String(chatId),
    telegramUsername: username || '',
    firstName: firstName || '',
    orgId,
    orgName,
    createdAt: FieldValue.serverTimestamp(),
  }

  const ref = await clientsRef.add(newClient)
  return { id: ref.id, ...newClient }
}

// ─── CREATE TICKET ───
async function createTicket(db, client, userMessage, conversationHistory) {
  const ticketRef = await db.collection('supportTickets').add({
    clientId: client.id,
    clientName: client.firstName || client.telegramUsername || 'Cliente',
    telegramChatId: client.telegramChatId,
    orgId: client.orgId || null,
    orgName: client.orgName || null,
    subject: userMessage.slice(0, 80) + (userMessage.length > 80 ? '...' : ''),
    status: 'open',
    priority: 'normal',
    messages: [
      ...conversationHistory.slice(-4),
      { role: 'user', text: userMessage, ts: new Date().toISOString() }
    ],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return ticketRef.id
}

// ─── SAVE MESSAGE TO HISTORY ───
async function saveMessage(db, chatId, role, text) {
  await db.collection('supportConversations').add({
    chatId: String(chatId),
    role,
    text,
    ts: new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp(),
  })
}

// ─── GET CONVERSATION HISTORY ───
async function getHistory(db, chatId, limit = 8) {
  const snap = await db.collection('supportConversations')
    .where('chatId', '==', String(chatId))
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
  return snap.docs.map(d => d.data()).reverse()
}

// ─── MAIN HANDLER ───
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 200, body: 'OK' }

  let update
  try {
    update = JSON.parse(event.body)
  } catch {
    return { statusCode: 200, body: 'OK' }
  }

  // Only handle text messages
  const message = update.message
  if (!message?.text) return { statusCode: 200, body: 'OK' }

  const chatId = message.chat.id
  const userText = message.text.trim()
  const username = message.from?.username || ''
  const firstName = message.from?.first_name || ''

  const db = initFirebase()

  try {
    // Handle /start command
    if (userText === '/start') {
      await saveMessage(db, chatId, 'system', '/start')
      await sendTelegram(chatId,
        `👋 Hola *${firstName}*\\! Soy el asistente de soporte de *FlowCRM*.\n\n` +
        `Puedo ayudarte con dudas sobre el uso de la plataforma. Cuéntame, ¿en qué te puedo ayudar?\n\n` +
        `_Si no puedo resolver tu consulta, crearé un ticket y el equipo de Qubit Corp. te responderá en máx. 24 hrs hábiles._`
      )
      return { statusCode: 200, body: 'OK' }
    }

    // Handle /ticket command — force ticket creation
    if (userText.startsWith('/ticket')) {
      const subject = userText.replace('/ticket', '').trim() || 'Ticket manual'
      const client = await findClient(db, chatId, username, firstName)
      const history = await getHistory(db, chatId)
      const ticketId = await createTicket(db, client, subject, history)
      await sendTelegram(chatId,
        `✅ Ticket *#${ticketId.slice(-6).toUpperCase()}* creado.\n\n` +
        `El equipo de Qubit Corp. revisará tu caso y te responderá aquí en máx. *24 horas hábiles* (L-V, 9-18h CST).`
      )
      return { statusCode: 200, body: 'OK' }
    }

    // Get client and history
    const client = await findClient(db, chatId, username, firstName)
    const history = await getHistory(db, chatId)

    // Save user message
    await saveMessage(db, chatId, 'user', userText)

    // Try AI resolution
    const aiReply = await tryResolveWithAI(db, chatId, userText, history)

    if (aiReply === 'ESCALAR_TICKET') {
      // Create ticket
      const ticketId = await createTicket(db, client, userText, history)

      const escalationMsg =
        `No encontré una respuesta precisa para tu consulta. He creado el ticket *#${ticketId.slice(-6).toUpperCase()}* automáticamente.\n\n` +
        `El equipo de Qubit Corp. te responderá aquí en *máx. 24 horas hábiles* (L-V, 9:00-18:00 CST).\n\n` +
        `Si es urgente, incluye la palabra "urgente" en tu próximo mensaje.`

      await sendTelegram(chatId, escalationMsg)
      await saveMessage(db, chatId, 'assistant', escalationMsg)
    } else {
      // Check for urgency escalation
      const isUrgent = /urgente|caído|no funciona|error crítico/i.test(userText)

      if (isUrgent) {
        // Create ticket AND respond
        const ticketId = await createTicket(db, client, userText, history)
        await db.collection('supportTickets').doc(ticketId).update({ priority: 'high' })

        const urgentMsg = aiReply + `\n\n⚠️ Detecté que puede ser urgente. He creado el ticket *#${ticketId.slice(-6).toUpperCase()}* con prioridad alta.`
        await sendTelegram(chatId, urgentMsg)
        await saveMessage(db, chatId, 'assistant', urgentMsg)
      } else {
        // Normal AI response
        await sendTelegram(chatId, aiReply)
        await saveMessage(db, chatId, 'assistant', aiReply)
      }
    }
  } catch (err) {
    console.error('Support bot error:', err)
    await sendTelegram(chatId,
      `Ocurrió un error procesando tu mensaje. Por favor intenta de nuevo o escribe /ticket para abrir un caso de soporte.`
    )
  }

  return { statusCode: 200, body: 'OK' }
}
