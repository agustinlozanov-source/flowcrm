// Reintento de la respuesta del agente sobre una conversación colgada.
// Compartido por el botón individual del Inbox y por el reintento masivo.
const admin = require('firebase-admin')
const { appUrl, sendReply } = require('./zernio')
const { saveAttachments } = require('./firebase')

/* Qué quedó colgando en esta conversación.
 *
 * Son dos casos y hay que mirar dos mensajes, no uno. El evidente: el último
 * lo escribió el lead y nadie contestó. El traicionero: el agente SÍ redactó
 * una respuesta, se guardó, y el envío se cayó después —un 504 de Netlify,
 * un rechazo de Zernio—. Esa queda marcada `entregado: false`, y mirando solo
 * el último mensaje la conversación se ve atendida cuando el cliente nunca
 * recibió nada.
 *
 * Devuelve `{ texto, fallidaRef }` o null. `fallidaRef` es la respuesta que no
 * salió, para borrarla antes de generar otra y que no queden dos en el hilo.
 */
async function pendingMessage(leadRef) {
  const snap = await leadRef.collection('conversations')
    .orderBy('createdAt', 'desc').limit(2).get()
  if (snap.empty) return null

  const ultimo = snap.docs[0]
  const d = ultimo.data()

  if (d.role === 'user') {
    return d.text?.trim() ? { texto: d.text, fallidaRef: null } : null
  }

  // Una respuesta del agente que nunca se entregó no cuenta como respuesta.
  if (d.role === 'assistant' && d.entregado === false && snap.docs[1]) {
    const previo = snap.docs[1].data()
    if (previo.role === 'user' && previo.text?.trim()) {
      return { texto: previo.text, fallidaRef: ultimo.ref }
    }
  }

  return null
}

// Lanza con un mensaje legible si no se puede; devuelve la respuesta si sale.
async function retryLead(db, orgId, leadId) {
  const leadRef = db.collection('organizations').doc(orgId).collection('leads').doc(leadId)
  const leadSnap = await leadRef.get()
  if (!leadSnap.exists) throw new Error('Lead no encontrado')
  const lead = leadSnap.data()

  const pendiente = await pendingMessage(leadRef)
  if (!pendiente) throw new Error('Esta conversación ya tiene respuesta')
  const message = pendiente.texto

  const channel = lead.lastMessageChannel || 'whatsapp'
  const org = (await db.collection('organizations').doc(orgId).get()).data() || {}
  const conversationId = lead.channelIds?.[channel]
  // Se verifica ANTES de gastar una llamada al modelo.
  if (!org.zernioAccountId || !conversationId) {
    throw new Error('Esta conversación no tiene canal de Zernio para responder')
  }

  /* La respuesta que no salió se borra antes de pedir otra: el cliente nunca
     la vio, así que conservarla solo dejaría dos mensajes del agente en el
     hilo y le daría al modelo un turno suyo que en realidad nunca ocurrió. */
  if (pendiente.fallidaRef) await pendiente.fallidaRef.delete()

  // skipSaveUser: el mensaje del lead ya está en el hilo.
  const res = await fetch(`${appUrl()}/.netlify/functions/agent-manager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'chat', orgId, leadId, message, skipSaveUser: true, entregaExterna: true }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.response) throw new Error(data.error || 'El agente no pudo responder')

  const sent = await sendReply(conversationId, org.zernioAccountId, data.response, data.shareResources)

  if (data.mensajeId) {
    await leadRef.collection('conversations').doc(data.mensajeId)
      .update({ entregado: true, entregadoEn: admin.firestore.FieldValue.serverTimestamp() })
  }

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
