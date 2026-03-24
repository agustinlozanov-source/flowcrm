const { admin, db } = require('../config/firebase')
const OpenAI = require('openai')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── FIND OR CREATE LEAD ──
async function findOrCreateLead(orgId, contact) {
  const { name, phone, email, channelUserId, channel } = contact

  const byChannel = await db
    .collection('organizations').doc(orgId)
    .collection('leads')
    .where(`channelIds.${channel}`, '==', channelUserId)
    .limit(1).get()

  if (!byChannel.empty) return { id: byChannel.docs[0].id, ...byChannel.docs[0].data() }

  if (phone) {
    const byPhone = await db
      .collection('organizations').doc(orgId)
      .collection('leads')
      .where('phone', '==', phone)
      .limit(1).get()
    if (!byPhone.empty) {
      const lead = byPhone.docs[0]
      await lead.ref.update({ [`channelIds.${channel}`]: channelUserId })
      return { id: lead.id, ...lead.data() }
    }
  }

  const stagesSnap = await db
    .collection('organizations').doc(orgId)
    .collection('pipeline_stages')
    .orderBy('order').limit(1).get()
  const stageId = stagesSnap.empty ? null : stagesSnap.docs[0].id

  const ref = await db.collection('organizations').doc(orgId).collection('leads').add({
    name: name || 'Sin nombre',
    phone: phone || '',
    email: email || '',
    company: '',
    source: channel,
    stageId,
    score: 0,
    assignedTo: null,
    channelIds: { [channel]: channelUserId },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  const snap = await ref.get()
  return { id: ref.id, ...snap.data() }
}

// ── SAVE MESSAGE ──
async function saveMessage(orgId, leadId, { text, channel, role, channelMsgId }) {
  await db.collection('organizations').doc(orgId)
    .collection('leads').doc(leadId)
    .collection('conversations').add({
      text, channel, role,
      channelMsgId: channelMsgId || null,
      read: role === 'bot',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

  await db.collection('organizations').doc(orgId)
    .collection('leads').doc(leadId)
    .update({
      lastMessage: text,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageChannel: channel,
      hasUnread: role === 'user',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
}

// ── GET AGENT CONFIG ──
async function getAgentConfig(orgId) {
  const snap = await db.collection('organizations').doc(orgId)
    .collection('settings').doc('agent').get()
  return snap.exists ? snap.data() : { autoRespond: false, personality: 'amigable' }
}

// ── GET CONVERSATION HISTORY ──
async function getConversationHistory(orgId, leadId) {
  const snap = await db.collection('organizations').doc(orgId)
    .collection('leads').doc(leadId)
    .collection('conversations')
    .orderBy('createdAt', 'desc').limit(10).get()
  return snap.docs.reverse().map(d => ({
    role: d.data().role === 'user' ? 'user' : 'assistant',
    content: d.data().text,
  }))
}

// ── AGENT AUTO-REPLY ──
async function agentAutoReply(orgId, lead, incomingText, channel) {
  const agentConfig = await getAgentConfig(orgId)
  if (!agentConfig.autoRespond) return null

  const history = await getConversationHistory(orgId, lead.id)
  const personality = {
    profesional: 'formal, directo y enfocado en resultados',
    amigable: 'cálido, cercano y conversacional',
    consultivo: 'analítico, hace reflexionar y da perspectivas únicas',
  }[agentConfig.personality || 'amigable']

  const systemPrompt = `Eres ${agentConfig.name || 'un asistente de ventas'}, con personalidad ${personality}.
Tu objetivo es calificar leads y agendar una llamada o reunión.
Responde de forma breve (máximo 3 oraciones). Siempre en español.
No menciones que eres una IA a menos que te lo pregunten directamente.
Contexto del lead: nombre=${lead.name}, canal=${channel}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: incomingText },
    ],
    max_tokens: 300,
    temperature: 0.7,
  })
  return completion.choices[0].message.content
}

// ── SEND META MESSAGE ──
async function sendMetaMessage(channel, recipientId, text, pageAccessToken) {
  if (!pageAccessToken) return
  let url, body
  if (channel === 'whatsapp') {
    url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`
    body = { messaging_product: 'whatsapp', to: recipientId, type: 'text', text: { body: text } }
  } else {
    url = `https://graph.facebook.com/v19.0/me/messages`
    body = { recipient: { id: recipientId }, message: { text } }
  }
  await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${pageAccessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── PROCESS WHATSAPP ──
async function processWhatsApp(entry, orgId) {
  for (const change of (entry.changes || [])) {
    const value = change.value
    if (!value?.messages) continue
    for (const msg of value.messages) {
      if (msg.type !== 'text') continue
      const phone = msg.from
      const text = msg.text?.body || ''
      const profileName = value.contacts?.[0]?.profile?.name || 'WhatsApp User'
      const lead = await findOrCreateLead(orgId, { name: profileName, phone, channelUserId: phone, channel: 'whatsapp' })
      await saveMessage(orgId, lead.id, { text, channel: 'whatsapp', role: 'user', channelMsgId: msg.id })
      const reply = await agentAutoReply(orgId, lead, text, 'whatsapp')
      if (reply) {
        await sendMetaMessage('whatsapp', phone, reply, process.env.WHATSAPP_TOKEN)
        await saveMessage(orgId, lead.id, { text: reply, channel: 'whatsapp', role: 'bot' })
      }
    }
  }
}

// ── PROCESS MESSENGER / INSTAGRAM ──
async function processMessaging(entry, channel, orgId) {
  for (const event of (entry.messaging || [])) {
    if (!event.message?.text || event.message.is_echo) continue
    const senderId = event.sender.id
    const text = event.message.text
    const pageToken = channel === 'instagram'
      ? process.env.INSTAGRAM_ACCESS_TOKEN
      : process.env.META_PAGE_ACCESS_TOKEN
    let name = 'Usuario'
    try {
      const profileRes = await fetch(`https://graph.facebook.com/v19.0/${senderId}?fields=name&access_token=${pageToken}`)
      const profile = await profileRes.json()
      name = profile.name || name
    } catch { }
    const lead = await findOrCreateLead(orgId, { name, channelUserId: senderId, channel })
    await saveMessage(orgId, lead.id, { text, channel, role: 'user', channelMsgId: event.message.mid })
    const reply = await agentAutoReply(orgId, lead, text, channel)
    if (reply) {
      await sendMetaMessage(channel, senderId, reply, pageToken)
      await saveMessage(orgId, lead.id, { text: reply, channel, role: 'bot' })
    }
  }
}

// ── PROCESS FACEBOOK LEAD ADS ──
async function processFacebookLead(entry, orgId) {
  for (const change of (entry.changes || [])) {
    if (change.field !== 'leadgen') continue
    const leadgenId = change.value.leadgen_id
    const pageToken = process.env.META_PAGE_ACCESS_TOKEN
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${leadgenId}?access_token=${pageToken}`)
      const data = await res.json()
      const fields = {}
      for (const f of (data.field_data || [])) fields[f.name] = f.values?.[0] || ''
      await findOrCreateLead(orgId, {
        name: fields['full_name'] || fields['name'] || 'Lead de Facebook',
        email: fields['email'] || '',
        phone: fields['phone_number'] || fields['phone'] || '',
        channelUserId: leadgenId,
        channel: 'facebook_leads',
      })
    } catch (err) { console.error('Lead Ads error:', err) }
  }
}

module.exports = { findOrCreateLead, saveMessage, sendMetaMessage, agentAutoReply, processWhatsApp, processMessaging, processFacebookLead }
