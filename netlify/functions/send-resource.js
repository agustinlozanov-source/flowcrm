// Envía un recurso del agente (archivo, imagen o video) a una conversación,
// a mano desde el Inbox. Para los casos en que el agente ya respondió pero
// no llegó a adjuntarlo.
const { initDb, saveAttachments } = require('./lib/firebase')
const { sendReply } = require('./lib/zernio')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { orgId, leadId, resourceId, text } = JSON.parse(event.body || '{}')
    if (!orgId || !leadId || !resourceId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'orgId, leadId y resourceId son requeridos' }) }
    }

    const db = initDb()
    const orgRef = db.collection('organizations').doc(orgId)

    const resSnap = await orgRef.collection('agent_resources').doc(resourceId).get()
    if (!resSnap.exists) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Recurso no encontrado' }) }
    const resource = { id: resSnap.id, ...resSnap.data() }

    if (resource.type === 'enlace') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Los enlaces se mandan como texto, no como adjunto' }) }
    }

    const leadSnap = await orgRef.collection('leads').doc(leadId).get()
    if (!leadSnap.exists) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Lead no encontrado' }) }
    const lead = leadSnap.data()

    const channel = lead.lastMessageChannel || 'whatsapp'
    const org = (await orgRef.get()).data() || {}
    const conversationId = lead.channelIds?.[channel]
    if (!org.zernioAccountId || !conversationId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Esta conversación no tiene canal de Zernio' }) }
    }

    // El texto es opcional: sin él va solo el adjunto.
    const sent = await sendReply(conversationId, org.zernioAccountId, text || null, [resource])
    if (!sent.length) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Zernio no aceptó el archivo' }) }
    }
    await saveAttachments(db, orgId, leadId, sent, channel)

    console.log(`[send-resource] "${resource.name}" enviado a lead ${leadId}`)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, sent }) }
  } catch (e) {
    console.error('send-resource error:', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
