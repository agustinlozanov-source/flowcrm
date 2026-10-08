// Receptor de eventos de Zernio. Es la ÚNICA fuente de verdad del estado de
// conexión, y la puerta de entrada de los mensajes al CRM.
const admin = require('firebase-admin')
const { initDb, appUrl, sendMessage, verifyWebhookSignature } = require('./lib/zernio')

// Zernio manda el mismo dato con nombres distintos según el evento.
const profileIdOf = (p) => p.profileId || p.account?.profileId || p.profile?._id || null
const accountIdOf = (p) => p.account?.id || p.account?.accountId || p.accountId || null
const platformOf = (p) => p.account?.platform || p.platform || 'whatsapp'
// En WhatsApp el "username" de la cuenta es el número de teléfono.
const phoneOf = (p) => p.account?.phoneNumber || p.phoneNumber || p.account?.username || null

// Reclama un id una sola vez. create() falla si ya existe: eso significa que
// Zernio reintentó y ya lo procesamos.
async function claim(db, id, data) {
  try {
    await db.collection('zernio_events').doc(id).create({
      ...data, receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return true
  } catch {
    return false
  }
}

async function resolveOrg(db, payload) {
  const profileId = profileIdOf(payload)
  if (profileId) {
    const snap = await db.collection('organizations')
      .where('zernioProfileId', '==', profileId).limit(1).get()
    if (!snap.empty) return snap.docs[0].id
  }
  // Los eventos de mensajería no traen profileId; el accountId se guarda en la
  // org al conectarse el canal.
  const accountId = accountIdOf(payload)
  if (!accountId) return null

  const byAccount = await db.collection('organizations')
    .where('zernioAccountId', '==', accountId).limit(1).get()
  if (!byAccount.empty) return byAccount.docs[0].id

  // Rescate para las orgs conectadas antes de que empezáramos a guardar el
  // accountId en el documento: el dato ya está en su doc de integraciones.
  // Recorrer orgs es caro, así que al encontrarla se backfillea y las
  // siguientes entran por el camino rápido de arriba.
  const orgs = await db.collection('organizations').where('zernioProfileId', '!=', null).get()
  for (const org of orgs.docs) {
    const integ = await org.ref.collection('settings').doc('integrations').get()
    const data = integ.data() || {}
    const match = Object.values(data).some(v => v && v.accountId === accountId)
    if (match) {
      await org.ref.update({ zernioAccountId: accountId })
      console.log(`[zernio-webhook] backfill de zernioAccountId en org ${org.id}`)
      return org.id
    }
  }
  return null
}

// Mismo criterio que el inbound de Meta: primero por id de canal, después por
// teléfono, y si no existe se crea en la primera etapa del pipeline.
async function findOrCreateLead(db, orgId, { phone, name, channel, channelUserId }) {
  const leads = db.collection('organizations').doc(orgId).collection('leads')

  if (channelUserId) {
    const byChannel = await leads.where(`channelIds.${channel}`, '==', channelUserId).limit(1).get()
    if (!byChannel.empty) return { id: byChannel.docs[0].id, ...byChannel.docs[0].data() }
  }
  if (phone) {
    const byPhone = await leads.where('phone', '==', phone).limit(1).get()
    if (!byPhone.empty) {
      const d = byPhone.docs[0]
      if (channelUserId) await d.ref.update({ [`channelIds.${channel}`]: channelUserId })
      return { id: d.id, ...d.data() }
    }
  }

  const orgRef = db.collection('organizations').doc(orgId)
  const [stages, pipelines] = await Promise.all([
    orgRef.collection('pipeline_stages').orderBy('order').limit(1).get(),
    orgRef.collection('pipelines').limit(1).get(),
  ])

  const ref = await leads.add({
    name: name || 'Sin nombre',
    phone: phone || '',
    email: '',
    company: '',
    source: channel,
    stageId: stages.empty ? null : stages.docs[0].id,
    pipelineId: pipelines.empty ? null : pipelines.docs[0].id,
    score: 0,
    assignedTo: null,
    channelIds: channelUserId ? { [channel]: channelUserId } : {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return { id: ref.id, ...(await ref.get()).data() }
}

async function touchLead(db, orgId, leadId, { text, channel, fromLead }) {
  await db.collection('organizations').doc(orgId).collection('leads').doc(leadId).update({
    lastMessage: text,
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageChannel: channel,
    hasUnread: fromLead,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

async function handleMessageReceived(db, payload) {
  const msg = payload.message
  const conv = payload.conversation
  const accountId = accountIdOf(payload)
  if (!msg?.id || !conv?.id || !accountId) {
    console.warn('[zernio-webhook] message.received incompleto — skip')
    return
  }
  // Idempotencia a nivel mensaje: el mismo mensaje puede llegar en más de un
  // evento, con ids de evento distintos.
  if (!await claim(db, `msg_${msg.id}`, { event: 'message.received' })) {
    console.log('[zernio-webhook] mensaje ya procesado:', msg.id)
    return
  }

  const orgId = await resolveOrg(db, payload)
  if (!orgId) {
    console.warn('[zernio-webhook] sin org para este mensaje — skip')
    return
  }

  const text = msg.text || ''
  if (!text.trim()) {
    console.log('[zernio-webhook] mensaje sin texto (adjunto) — no se contesta')
    return
  }

  const channel = platformOf(payload)
  const phone = msg.sender?.phoneNumber || conv.participantPhone || null
  const lead = await findOrCreateLead(db, orgId, {
    phone,
    name: msg.sender?.name || conv.participantName || null,
    channel,
    channelUserId: conv.id,
  })
  await touchLead(db, orgId, lead.id, { text, channel, fromLead: true })

  // Si ya hay una persona a cargo, el agente no interviene.
  if (lead.systemStage === 'handoff') {
    console.log(`[zernio-webhook] lead ${lead.id} en handoff — sin respuesta automática`)
    return
  }

  // El agente ya vive en agent-manager: ahí está el prompt, el historial, el
  // scoring y el avance de etapa. Acá solo lo invocamos y entregamos.
  const res = await fetch(`${appUrl()}/.netlify/functions/agent-manager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'chat', orgId, leadId: lead.id, message: text }),
  })
  const data = await res.json()
  if (!res.ok || !data.response) {
    console.error('[zernio-webhook] el agente no respondió:', data.error || res.status)
    return
  }

  await sendMessage(conv.id, accountId, data.response)
  await touchLead(db, orgId, lead.id, { text: data.response, channel, fromLead: false })
  console.log(`[zernio-webhook] respondido a ${phone || lead.id} (org ${orgId})`)
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const rawBody = event.body || ''
  const h = event.headers || {}
  const signature = h['x-zernio-signature'] || h['X-Zernio-Signature'] || ''
  const eventId = h['x-zernio-event-id'] || h['X-Zernio-Event-Id'] || null

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('[zernio-webhook] firma inválida — evento descartado')
    return { statusCode: 401, body: 'Unauthorized' }
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const db = initDb()
  if (eventId && !await claim(db, eventId, { event: payload.event || null })) {
    return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicado' }) }
  }

  try {
    if (payload.event === 'message.received') {
      await handleMessageReceived(db, payload)
      return { statusCode: 200, body: JSON.stringify({ ok: true }) }
    }

    const orgId = await resolveOrg(db, payload)
    if (!orgId) {
      console.warn('[zernio-webhook] evento sin org:', payload.event)
      return { statusCode: 200, body: JSON.stringify({ skipped: 'org no encontrada' }) }
    }

    const platform = platformOf(payload)
    const ref = db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations')
    const now = admin.firestore.FieldValue.serverTimestamp()

    switch (payload.event) {
      case 'account.connected': {
        const accountId = accountIdOf(payload)
        const data = { connected: true, accountId, connectedAt: now }
        const phone = phoneOf(payload)
        if (phone) data.assignedNumber = phone
        await ref.set({ [platform]: data }, { merge: true })
        // En la org también, para poder resolverla desde los mensajes.
        if (accountId) await db.collection('organizations').doc(orgId).update({ zernioAccountId: accountId })
        console.log(`[zernio-webhook] ${platform} conectado para org ${orgId}`)
        break
      }
      case 'account.disconnected': {
        await ref.set({ [platform]: { connected: false, disconnectedAt: now } }, { merge: true })
        console.log(`[zernio-webhook] ${platform} desconectado para org ${orgId}`)
        break
      }
      case 'whatsapp.number.activated': {
        const phone = phoneOf(payload)
        await ref.set({ whatsapp: { connected: true, assignedNumber: phone, activatedAt: now } }, { merge: true })
        console.log(`[zernio-webhook] número ${phone} activado para org ${orgId}`)
        break
      }
      default:
        console.log('[zernio-webhook] evento ignorado:', payload.event)
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (e) {
    // 200 a propósito: el evento ya quedó reclamado, así que el reintento de
    // Zernio se descartaría igual y solo sumaría ruido.
    console.error('[zernio-webhook] error procesando evento:', e)
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) }
  }
}
