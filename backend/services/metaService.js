const { admin, db } = require('../config/firebase')
const Anthropic = require('@anthropic-ai/sdk')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── GLOBAL ATOMIC MESSAGE DEDUP LOCK ──
// Root-level collection so two handlers receiving the same platformMessageId
// (e.g. Railway + Netlify both subscribed) don’t both reply.
async function checkAndLockMessage(msgId) {
  if (!msgId) return false
  const lockRef = db.collection('_global_msg_locks').doc(String(msgId))
  try {
    const alreadyProcessed = await db.runTransaction(async t => {
      const snap = await t.get(lockRef)
      if (snap.exists) return true
      t.set(lockRef, { ts: admin.firestore.FieldValue.serverTimestamp() })
      return false
    })
    return alreadyProcessed
  } catch {
    return false // on error, proceed
  }
}

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

  try {
    const history = await getConversationHistory(orgId, lead.id)

    // RAG content
    const filesSnap = await db.collection('organizations').doc(orgId)
      .collection('agent_files').where('status', '==', 'ready').get()
    const ragContent = filesSnap.docs
      .filter(d => !d.data().pipelineId || d.data().pipelineId === pipelineId)
      .map(d => d.data().content || '').filter(Boolean).join('\n\n---\n\n')

    // Scoring config for this lead's pipeline
    const pipelineId = lead.pipelineId || null
    let scoringConfig = null
    if (pipelineId && agentConfig.scoring?.[pipelineId]) {
      scoringConfig = agentConfig.scoring[pipelineId]
    } else if (agentConfig.scoring) {
      const firstKey = Object.keys(agentConfig.scoring)[0]
      if (firstKey) scoringConfig = agentConfig.scoring[firstKey]
    }

    // Resolve per-pipeline customInstructions
    let customInstructions = agentConfig.customInstructions || ''
    if (typeof customInstructions === 'object' && !Array.isArray(customInstructions)) {
      customInstructions = (pipelineId && customInstructions[pipelineId])
        || customInstructions['__default__']
        || Object.values(customInstructions).find(Boolean)
        || ''
    }

    // Lead context: stage + pipeline names
    let stageName = 'Sin etapa'
    if (lead.stageId) {
      try {
        const stageSnap = await db.collection('organizations').doc(orgId).collection('pipeline_stages').doc(lead.stageId).get()
        if (stageSnap.exists) stageName = stageSnap.data().name
      } catch {}
    }
    let pipelineName = ''
    if (pipelineId) {
      try {
        const pipelineSnap = await db.collection('organizations').doc(orgId).collection('pipelines').doc(pipelineId).get()
        if (pipelineSnap.exists) pipelineName = pipelineSnap.data().name || ''
      } catch {}
    }

    // Products section
    let productsSection = ''
    if (agentConfig.enabledProductIds?.length) {
      try {
        const productSnaps = await Promise.all(agentConfig.enabledProductIds.map(id =>
          db.collection('organizations').doc(orgId).collection('products').doc(id).get()
        ))
        const products = productSnaps.filter(s => s.exists).map(s => ({ id: s.id, ...s.data() }))
        if (products.length) productsSection = `\nPRODUCTOS:\n${products.map(p =>
          `- ${p.name} · $${Number(p.price).toLocaleString()} ${p.currency || 'USD'}`
        ).join('\n')}`
      } catch {}
    }

    // Resources section
    let resourcesSection = ''
    try {
      const resourcesSnap = await db.collection('organizations').doc(orgId).collection('agent_resources').get()
      const resources = resourcesSnap.docs.map(d => d.data()).filter(r => r.url)
      if (resources.length) resourcesSection = `\nRECURSOS DISPONIBLES:\n${resources.map(r =>
        `- [${(r.type || '').toUpperCase()}] "${r.name}": ${r.url}`
      ).join('\n')}`
    } catch {}

    // Scoring section
    const isArrayScoring = Array.isArray(scoringConfig)
    let scoringSection = ''
    if (isArrayScoring && scoringConfig.length > 0) {
      scoringSection = `\nSISTEMA DE SCORING ACTIVO:\nEvalúa silenciosamente al lead mientras conversas.\n${scoringConfig.map(cat => {
        const signals = (cat.subcategories || []).flatMap(sub => sub.signals || [])
        return `${cat.label} (tope: ${cat.tope} pts):\n` +
          signals.slice(0, 6).map(s => `  · ${s.text}: ${s.weight >= 0 ? '+' : ''}${s.weight} pts`).join('\n')
      }).join('\n')}`
    }

    const agentName = agentConfig.agentName || 'Asistente'
    const scoringKeys = isArrayScoring && scoringConfig.length > 0
      ? scoringConfig.map(cat => `    "${cat.id}": { "delta": 0, "reason": "" }`).join(',\n')
      : '    "general": { "delta": 0, "reason": "" }'

    const systemPrompt = `Eres ${agentName}, un agente de ventas especializado.

INSTRUCCIONES PRINCIPALES:
- Responde siempre en español, de forma breve (máximo 3-4 oraciones)
- Nunca menciones que eres una IA a menos que te lo pregunten directamente
- Termina siempre con una pregunta o llamada a acción concreta
- Adapta tu tono al del lead (formal/informal)
- Tu objetivo es calificar al lead y prepararlo para una llamada con el vendedor humano
${productsSection}
${scoringSection}

CONTEXTO DEL LEAD:
- Nombre: ${lead.name} | Score: ${lead.score || 0}/100 | Etapa: ${stageName}${pipelineName ? ` | Pipeline: ${pipelineName}` : ''} | Canal: ${channel}
${resourcesSection}

BASE DE CONOCIMIENTO:
${ragContent || 'No hay documentos cargados aún.'}

${customInstructions ? `INSTRUCCIONES ADICIONALES:\n${customInstructions}` : ''}

FORMATO DE RESPUESTA IMPORTANTE:
Responde SIEMPRE con este JSON exacto:
{
  "response": "El mensaje que verá el lead",
  "scoring": {
${scoringKeys}
  },
  "suggestHandoff": false,
  "detectedProductId": null
}`

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [...history, { role: 'user', content: incomingText }],
    })

    const rawReply = claudeResponse.content[0]?.text || ''

    // Parse JSON and extract visible text + update score
    let visibleReply = rawReply
    try {
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.response) visibleReply = parsed.response
        // Update lead score from scoring deltas
        if (parsed.scoring && lead.id) {
          const delta = Object.values(parsed.scoring).reduce((sum, s) => sum + (s.delta || 0), 0)
          if (delta !== 0) {
            const newScore = Math.max(0, Math.min(100, (lead.score || 0) + delta))
            await db.collection('organizations').doc(orgId).collection('leads').doc(lead.id).update({
              score: newScore,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            })
          }
        }
      }
    } catch (parseErr) {
      console.error('agentAutoReply JSON parse error:', parseErr.message)
    }

    return visibleReply || null
  } catch (err) {
    console.error('agentAutoReply error:', err.message)
    return null
  }
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
  console.log('processWhatsApp entry:', JSON.stringify(entry, null, 2))
  for (const change of (entry.changes || [])) {
    const value = change.value
    if (!value?.messages) continue
    for (const msg of value.messages) {
      if (msg.type !== 'text') continue
      const phone = msg.from
      const text = msg.text?.body || ''
      const profileName = value.contacts?.[0]?.profile?.name || 'WhatsApp User'
      if (await checkAndLockMessage(msg.id)) { console.log(`⚠️ Dup WA ${msg.id} skipped`); continue }
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
    if (await checkAndLockMessage(event.message.mid)) { console.log(`⚠️ Dup msg ${event.message.mid} skipped`); continue }
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

// ── PROCESS INSTAGRAM DMs ──
async function processInstagram(entry, orgId) {
  for (const change of (entry.changes || [])) {
    const val = change.value
    if (!val?.message?.text) continue
    const senderId = val.sender?.id
    const text = val.message.text
    if (!senderId) continue
    const pageToken = process.env.INSTAGRAM_ACCESS_TOKEN
    let name = 'Usuario Instagram'
    try {
      const profileRes = await fetch(`https://graph.facebook.com/v19.0/${senderId}?fields=name&access_token=${pageToken}`)
      const profile = await profileRes.json()
      name = profile.name || name
    } catch { }
    if (await checkAndLockMessage(val.message.mid)) { console.log(`⚠️ Dup IG ${val.message.mid} skipped`); continue }
    const lead = await findOrCreateLead(orgId, { name, channelUserId: senderId, channel: 'instagram' })
    await saveMessage(orgId, lead.id, { text, channel: 'instagram', role: 'user', channelMsgId: val.message.mid })
    const reply = await agentAutoReply(orgId, lead, text, 'instagram')
    if (reply) {
      await sendMetaMessage('instagram', senderId, reply, pageToken)
      await saveMessage(orgId, lead.id, { text: reply, channel: 'instagram', role: 'bot' })
    }
  }
}

module.exports = { findOrCreateLead, saveMessage, sendMetaMessage, agentAutoReply, processWhatsApp, processMessaging, processInstagram, processFacebookLead }
