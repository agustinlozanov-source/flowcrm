// Vuelve a correr el agente sobre una conversación que quedó sin respuesta.
// Nació de una caída por falta de saldo en la API: los mensajes entraron, el
// agente no pudo contestar y las charlas quedaron colgadas.
const admin = require('firebase-admin')
const { initDb, appUrl, sendReply } = require('./lib/zernio')


exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { orgId, leadId } = JSON.parse(event.body || '{}')
    const db = initDb()
    if (!orgId || !leadId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'orgId y leadId son requeridos' }) }
    }

    const leadRef = db.collection('organizations').doc(orgId).collection('leads').doc(leadId)
    const leadSnap = await leadRef.get()
    if (!leadSnap.exists) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Lead no encontrado' }) }
    const lead = leadSnap.data()

    // El último mensaje del hilo tiene que ser del lead; si ya hay respuesta,
    // reintentar mandaría un mensaje de más.
    const lastSnap = await leadRef.collection('conversations')
      .orderBy('createdAt', 'desc').limit(1).get()
    if (lastSnap.empty) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'La conversación está vacía' }) }
    }
    const last = lastSnap.docs[0].data()
    if (last.role !== 'user') {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'Esta conversación ya tiene respuesta' }) }
    }
    if (!last.text?.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'El último mensaje no tiene texto' }) }
    }

    const channel = lead.lastMessageChannel || 'whatsapp'
    const org = (await db.collection('organizations').doc(orgId).get()).data() || {}
    const conversationId = lead.channelIds?.[channel]

    // Se verifica ANTES de gastar una llamada al modelo.
    if (!org.zernioAccountId || !conversationId) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: 'Esta conversación no tiene canal de Zernio para responder' }),
      }
    }

    // skipSaveUser: el mensaje del lead ya está en el hilo.
    const res = await fetch(`${appUrl()}/.netlify/functions/agent-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chat', orgId, leadId, message: last.text, skipSaveUser: true,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.response) {
      return {
        statusCode: 502, headers,
        body: JSON.stringify({ error: data.error || 'El agente no pudo responder' }),
      }
    }

    await sendReply(conversationId, org.zernioAccountId, data.response, data.shareResources)
    await leadRef.update({
      lastMessage: data.response,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageChannel: channel,
      hasUnread: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`[agent-retry] respondido lead ${leadId} (org ${orgId})`)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, response: data.response }) }
  } catch (e) {
    console.error('agent-retry error:', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
