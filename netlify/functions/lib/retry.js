// Reintento de la respuesta del agente sobre una conversación colgada.
// Compartido por el botón individual del Inbox y por el reintento masivo.
const admin = require('firebase-admin')
const { appUrl, sendReply } = require('./zernio')
const { saveAttachments } = require('./firebase')

// Devuelve el texto del último mensaje si quedó sin responder, o null.
async function pendingMessage(leadRef) {
  const snap = await leadRef.collection('conversations')
    .orderBy('createdAt', 'desc').limit(1).get()
  if (snap.empty) return null
  const last = snap.docs[0].data()
  if (last.role !== 'user' || !last.text?.trim()) return null
  return last.text
}

// Lanza con un mensaje legible si no se puede; devuelve la respuesta si sale.
async function retryLead(db, orgId, leadId) {
  const leadRef = db.collection('organizations').doc(orgId).collection('leads').doc(leadId)
  const leadSnap = await leadRef.get()
  if (!leadSnap.exists) throw new Error('Lead no encontrado')
  const lead = leadSnap.data()

  const message = await pendingMessage(leadRef)
  if (!message) throw new Error('Esta conversación ya tiene respuesta')

  const channel = lead.lastMessageChannel || 'whatsapp'
  const org = (await db.collection('organizations').doc(orgId).get()).data() || {}
  const conversationId = lead.channelIds?.[channel]
  // Se verifica ANTES de gastar una llamada al modelo.
  if (!org.zernioAccountId || !conversationId) {
    throw new Error('Esta conversación no tiene canal de Zernio para responder')
  }

  // skipSaveUser: el mensaje del lead ya está en el hilo.
  const res = await fetch(`${appUrl()}/.netlify/functions/agent-manager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'chat', orgId, leadId, message, skipSaveUser: true }),
  })
  const data = await res.json()
  if (!res.ok || !data.response) throw new Error(data.error || 'El agente no pudo responder')

  const sent = await sendReply(conversationId, org.zernioAccountId, data.response, data.shareResources)
  await saveAttachments(db, orgId, leadId, sent, channel)
  await leadRef.update({
    lastMessage: data.response,
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageChannel: channel,
    hasUnread: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return data.response
}

// Conversaciones sin responder. Se limita a las últimas 24 h porque fuera de
// esa ventana WhatsApp exige plantillas y el envío fallaría igual.
async function findPending(db, orgId, { scan = 200 } = {}) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const snap = await db.collection('organizations').doc(orgId).collection('leads')
    .where('lastMessageAt', '>=', since)
    .orderBy('lastMessageAt', 'desc')
    .limit(scan)
    .get()

  const pending = []
  for (const doc of snap.docs) {
    const lead = doc.data()
    if (lead.systemStage === 'handoff') continue // ya lo atiende una persona
    if (await pendingMessage(doc.ref)) {
      pending.push({ id: doc.id, name: lead.name || 'Sin nombre', phone: lead.phone || '' })
    }
  }
  return pending
}

module.exports = { retryLead, findPending }
