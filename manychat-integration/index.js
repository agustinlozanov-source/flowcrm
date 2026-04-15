const express = require('express')
const axios = require('axios')
const Anthropic = require('@anthropic-ai/sdk')
const admin = require('firebase-admin')
const { FieldValue } = require('firebase-admin/firestore')

const app = express()

// CORS — permite flowhubcrm.app y localhost en dev
app.use((req, res, next) => {
  const allowed = [
    'https://flowhubcrm.app',
    'https://www.flowhubcrm.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ]
  const origin = req.headers.origin
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(express.json())

// Parseo robusto de la private key para Railway
// Railway a veces la envuelve en comillas o escapa los \n de forma distinta
function parsePrivateKey(raw = '') {
  let key = raw.trim()
  // Quitar comillas envolventes si existen
  if ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }
  // Reemplazar \n literales por saltos de línea reales
  key = key.replace(/\\n/g, '\n')
  return key
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
      privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
    })
  })
}

const db = admin.firestore()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function callClaudeWithRetry(params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create(params)
      return response
    } catch (err) {
      const is529 = err?.status === 529 || err?.message?.includes('overloaded')
      if (is529 && attempt < maxRetries) {
        console.log(`[Claude] Overloaded — reintento ${attempt}/${maxRetries} en 10s...`)
        await new Promise(resolve => setTimeout(resolve, 10000))
        continue
      }
      throw err
    }
  }
}

console.log('=== Firebase Admin init ===')
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID)
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL)
console.log('FIREBASE_PRIVATE_KEY present:', !!process.env.FIREBASE_PRIVATE_KEY)
console.log('=========================')

// ── GLOBAL ATOMIC DEDUP LOCK ──
// Uses root-level collection so two orgs receiving the same platformMessageId
// don't both respond to the same WhatsApp message.
async function checkAndLockMessage(platformMsgId) {
  if (!platformMsgId) return false
  const lockRef = db.collection('_global_msg_locks').doc(String(platformMsgId))
  try {
    const already = await db.runTransaction(async t => {
      const snap = await t.get(lockRef)
      if (snap.exists) return true
      t.set(lockRef, { ts: admin.firestore.FieldValue.serverTimestamp() })
      return false
    })
    return already
  } catch { return false }
}

// ── BUILD MODERN SYSTEM PROMPT ──
async function buildModernSystemPrompt(orgRef, agentConfig, lead, channel) {
  const agentName = agentConfig.agentName || 'Asistente'
  const pipelineId = lead.pipelineId || null

  // RAG content
  let ragContent = ''
  try {
    const filesSnap = await orgRef.collection('agent_files').where('status', '==', 'ready').get()
    ragContent = filesSnap.docs.map(d => d.data().content || '').filter(Boolean).join('\n\n---\n\n')
  } catch {}

  // Scoring config for this lead's pipeline
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

  // Scoring section
  const isArrayScoring = Array.isArray(scoringConfig)
  let scoringSection = ''
  if (isArrayScoring && scoringConfig.length > 0) {
    scoringSection = `\nSISTEMA DE SCORING ACTIVO:\nEvalúa silenciosamente al lead.\n${scoringConfig.map(cat => {
      const signals = (cat.subcategories || []).flatMap(sub => sub.signals || [])
      return `${cat.label} (tope: ${cat.tope} pts):\n` +
        signals.slice(0, 6).map(s => `  · ${s.text}: ${s.weight >= 0 ? '+' : ''}${s.weight} pts`).join('\n')
    }).join('\n')}`
  }

  const scoringKeys = isArrayScoring && scoringConfig?.length > 0
    ? scoringConfig.map(cat => `    "${cat.id}": { "delta": 0, "reason": "" }`).join(',\n')
    : '    "general": { "delta": 0, "reason": "" }'

  const systemPrompt = `Eres ${agentName}, un agente de ventas especializado.

INSTRUCCIONES PRINCIPALES:
- Responde siempre en español, de forma breve (máximo 3-4 oraciones)
- Nunca menciones que eres una IA a menos que te lo pregunten directamente
- Termina siempre con una pregunta o llamada a acción concreta
- Tu objetivo es calificar al lead y prepararlo para una llamada con el vendedor humano
${scoringSection}

CONTEXTO DEL LEAD:
- Nombre: ${lead.name || 'Sin nombre'} | Score: ${lead.score || 0}/100 | Canal: ${channel}

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

  return { systemPrompt, scoringConfig, pipelineId }
}

// ── PARSE CLAUDE REPLY + UPDATE SCORE ──
async function parseAndUpdateScore(orgRef, lead, rawReply, scoringConfig) {
  let visibleReply = rawReply
  try {
    const jsonMatch = rawReply.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.response) visibleReply = parsed.response
      if (parsed.scoring && lead.id) {
        const delta = Object.values(parsed.scoring).reduce((sum, s) => sum + (s.delta || 0), 0)
        if (delta !== 0) {
          const newScore = Math.max(0, Math.min(100, (lead.score || 0) + delta))
          await orgRef.collection('leads').doc(lead.id).update({
            score: newScore,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.error('JSON parse error:', err.message)
  }
  return visibleReply
}

app.get('/health', async (req, res) => {
  try {
    const testRef = db.collection('_healthcheck').doc('ping')
    await testRef.set({ ts: admin.firestore.FieldValue.serverTimestamp() })
    const snap = await testRef.get()
    console.log('[Health] Firestore write/read OK — project:', process.env.FIREBASE_PROJECT_ID)
    res.json({ ok: true, project: process.env.FIREBASE_PROJECT_ID, ts: snap.data()?.ts?.toDate?.() || null })
  } catch (err) {
    console.error('[Health] Firestore FAILED:', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Webhook por tenant
app.post('/webhook/manychat/:orgId', (req, res) => {
  res.sendStatus(200)

  const { orgId } = req.params
  const body = req.body
  const subscriber_id = body.id
  const text = body.last_input_text
  const name = body.name || 'Sin nombre'
  const page_id = body.page_id

  if (!text || !subscriber_id) return

  setImmediate(async () => {
    try {
      // Detectar canal
      let channel = 'messenger'
      if (body.ig_id) channel = 'instagram'
      if (body.whatsapp_phone) channel = 'whatsapp'

      const orgRef = db.collection('organizations').doc(orgId)
      const leadRef = orgRef.collection('leads').doc(subscriber_id)

      // Leer org doc (API key + datos del tenant)
      const orgDoc = await orgRef.get()
      const manychatApiKey = orgDoc.data()?.manychatApiKey || process.env.MANYCHAT_API_KEY

      // 1. Guardar / actualizar lead con estructura completa del pipeline
      const existingSnap = await leadRef.get()
      if (!existingSnap.exists) {
        // Buscar primer stage del pipeline
        const stagesSnap = await orgRef.collection('pipeline_stages')
          .orderBy('order', 'asc').limit(1).get()
        const stageId = stagesSnap.empty ? null : stagesSnap.docs[0].id

        await leadRef.set({
          subscriber_id,
          orgId,
          name,
          page_id,
          channel,
          source: channel,
          email: '',
          phone: body.whatsapp_phone || '',
          company: '',
          stageId,
          score: 0,
          assignedTo: null,
          channelIds: { [channel]: subscriber_id },
          lastMessage: text,
          hasUnread: true,
          lastMessageChannel: channel,
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        })
      } else {
        await leadRef.update({
          name,
          ...(body.whatsapp_phone ? { phone: body.whatsapp_phone } : {}),
          lastMessage: text,
          hasUnread: true,
          lastMessageChannel: channel,
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        })
      }

      // 2. Guardar mensaje entrante
      await leadRef.collection('conversations').add({
        role: 'user',
        content: text,
        channel,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })

      // 3. Leer historial
      const historySnap = await leadRef.collection('conversations')
        .orderBy('createdAt', 'asc')
        .limitToLast(10)
        .get()

      const messages = historySnap.docs.map(d => ({
        role: d.data().role === 'bot' ? 'assistant' : d.data().role,
        content: d.data().content || d.data().text || ''
      }))

      // 4. Leer config del agente y construir system prompt
      const agentSnap = await orgRef.collection('settings').doc('agent').get()
      const agentConfig = agentSnap.exists ? agentSnap.data() : {}

      if (agentConfig.autoRespond === false) {
        console.log(`[${orgId}] autoRespond desactivado, no se responde`)
        return
      }

      // 5b. Build modern system prompt
      const existingSnap2 = await leadRef.get()
      const leadData = { id: subscriber_id, ...(existingSnap2.exists ? existingSnap2.data() : {}), name }
      const { systemPrompt, scoringConfig } = await buildModernSystemPrompt(orgRef, agentConfig, leadData, channel)
      console.log(`[${orgId}] System prompt construido — ${systemPrompt.length} chars`)

      // 5. Claude responde
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages
      })

      const reply = await parseAndUpdateScore(orgRef, leadData, response.content[0].text, scoringConfig)

      // 6. Guardar respuesta
      await leadRef.collection('conversations').add({
        role: 'assistant',
        content: reply,
        channel,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })

      // 7. Enviar via ManyChat
      const contentData = channel === 'whatsapp'
        ? {
            version: 'v2',
            content: {
              type: 'whatsapp',
              messages: [{ type: 'text', text: reply }]
            }
          }
        : {
            version: 'v2',
            content: {
              messages: [{ type: 'text', text: reply }]
            }
          }

      const mcResponse = await axios.post(
        'https://api.manychat.com/fb/sending/sendContent',
        { subscriber_id, data: contentData },
        { headers: { Authorization: `Bearer ${manychatApiKey}` } }
      )
      console.log(`[${orgId}] ManyChat API response:`, JSON.stringify(mcResponse.data))

      console.log(`[${orgId}] Mensaje procesado para ${name}`)
    } catch (err) {
      console.error(`[${orgId}] Error:`, err.response?.data || err.message)
    }
  })
})

// ── ZERNIO WEBHOOK ───────────────────────────────────────────────
app.post('/webhook/zernio/:orgId', (req, res) => {
  // Responder 200 inmediatamente para que Zernio no reintente
  res.sendStatus(200)

  const { event, message, conversation, account } = req.body
  const { orgId } = req.params

  console.log(`[Zernio] Webhook recibido — orgId: ${orgId}`)
  console.log(`[Zernio] Payload completo:`, JSON.stringify(req.body, null, 2))

  if (event !== 'message.received' || !message?.text) {
    console.log(`[Zernio] Ignorado — event: ${event}, text: ${message?.text}`)
    return
  }

  const { id: senderId, phoneNumber, name: senderName } = message.sender
  const { text, platform } = message
  const incomingAccountId = account?.id

  // Usar phoneNumber como ID estable del lead (identificador real del contacto en WhatsApp)
  // Fallback a sender.id si no hay teléfono
  const leadDocId = (phoneNumber || '').replace(/\D/g, '') || senderId

  setImmediate(async () => {
    const orgRef = db.collection('organizations').doc(orgId)
    const leadRef = orgRef.collection('leads').doc(leadDocId)

    // ── ACCOUNT BINDING ──────────────────────────────────────────────────────
    // Zernio fires ALL webhooks in the account for every message, regardless of
    // which WhatsApp number received it. We bind each orgId to its Zernio
    // account.id on first use and reject messages from other accounts after that.
    if (incomingAccountId) {
      try {
        const orgSnap = await orgRef.get()
        const storedAccountId = orgSnap.data()?.zernioAccountId
        if (storedAccountId && storedAccountId !== incomingAccountId) {
          console.log(`[Zernio][${orgId}] ⛔ Account mismatch — expected ${storedAccountId}, got ${incomingAccountId}. Skipping.`)
          return
        }
        if (!storedAccountId) {
          await orgRef.set({ zernioAccountId: incomingAccountId }, { merge: true })
          console.log(`[Zernio][${orgId}] ✅ Bound to Zernio account ${incomingAccountId} (${account?.displayName || account?.username || ''})`)
        }
      } catch (err) {
        console.error(`[Zernio][${orgId}] ERROR account binding:`, err.message)
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    console.log(`[Zernio] sender.id: ${senderId} | phoneNumber: ${phoneNumber} | leadDocId: ${leadDocId}`)
    console.log(`[Zernio] Escribiendo en Firestore: organizations/${orgId}/leads/${leadDocId}`)
    console.log(`[Zernio] Firebase project: ${process.env.FIREBASE_PROJECT_ID}`)

    // 1. Guardar / actualizar lead
    try {
      const existingSnap = await leadRef.get()
      if (!existingSnap.exists) {
        const stagesSnap = await orgRef.collection('pipeline_stages')
          .orderBy('order', 'asc').limit(1).get()
        const stageId = stagesSnap.empty ? null : stagesSnap.docs[0].id

        await leadRef.set({
          subscriber_id: senderId,
          orgId,
          name: senderName || 'Sin nombre',
          phone: phoneNumber || '',
          company: '',
          source: platform || 'whatsapp',
          channel: platform || 'whatsapp',
          stageId,
          score: 0,
          assignedTo: null,
          lastMessage: text,
          hasUnread: true,
          lastMessageChannel: platform || 'whatsapp',
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        console.log(`[Zernio][${orgId}] Lead creado: ${leadDocId} (${senderName})`)
      } else {
        await leadRef.update({
          name: senderName || existingSnap.data().name,
          lastMessage: text,
          hasUnread: true,
          lastMessageChannel: platform || 'whatsapp',
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        console.log(`[Zernio][${orgId}] Lead actualizado: ${leadDocId} (${senderName})`)
      }
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 1 (upsert lead):`, err.message)
      console.error(`[Zernio][${orgId}] Stack:`, err.stack)
    }

    // 2. Guardar mensaje entrante
    try {
      await leadRef.collection('conversations').add({
        role: 'user',
        text: text,
        content: text,
        channel: platform || 'whatsapp',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log(`[Zernio][${orgId}] Mensaje entrante guardado en conversations`)
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 2 (guardar mensaje):`, err.message)
    }

    // 3. Leer historial (últimos 10)
    let messages = []
    try {
      const historySnap = await leadRef.collection('conversations')
        .orderBy('createdAt', 'asc')
        .limitToLast(10)
        .get()
      console.log(`[Zernio][${orgId}] Historial leído: ${historySnap.docs.length} mensajes`)
      messages = historySnap.docs.map(d => ({
        role: (d.data().role === 'bot' || d.data().role === 'assistant') ? 'assistant' : 'user',
        content: d.data().text || d.data().content || '',
      }))
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 3 (leer historial):`, err.message)
      messages = [{ role: 'user', content: text }]
    }

    // 4. Config del agente
    let agentConfig = {}
    try {
      const agentSnap = await orgRef.collection('settings').doc('agent').get()
      agentConfig = agentSnap.exists ? agentSnap.data() : {}
      console.log(`[Zernio][${orgId}] Config agente leída — autoRespond: ${agentConfig.autoRespond}`)
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 4 (config agente):`, err.message)
    }

    if (agentConfig.autoRespond === false) {
      console.log(`[Zernio][${orgId}] autoRespond desactivado — sin respuesta`)
      return
    }

    // 5. GLOBAL dedup — use platformMessageId so two orgs don't both reply to the same WA message
    const platformMsgId = message?.platformMessageId || message?.id || null
    if (platformMsgId && await checkAndLockMessage(platformMsgId)) {
      console.log(`[Zernio][${orgId}] Dup platformMessageId ${platformMsgId} — skipped`)
      return
    }

    // 6. Build modern system prompt
    let systemPrompt = ''
    let scoringConfig = null
    const leadSnap2 = await leadRef.get()
    const leadData = { id: leadDocId, ...(leadSnap2.exists ? leadSnap2.data() : {}), name: senderName || 'Sin nombre' }
    try {
      const built = await buildModernSystemPrompt(orgRef, agentConfig, leadData, platform || 'whatsapp')
      systemPrompt = built.systemPrompt
      scoringConfig = built.scoringConfig
      console.log(`[Zernio][${orgId}] System prompt construido — ${systemPrompt.length} chars`)
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 6 (buildPrompt):`, err.message)
      return
    }

    // 7. Claude responde
    let reply = null
    try {
      console.log(`[Zernio][${orgId}] Llamando a Claude...`)
      const response = await callClaudeWithRetry({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages,
      })
      const rawReply = response.content[0].text
      reply = await parseAndUpdateScore(orgRef, leadData, rawReply, scoringConfig)
      console.log(`[Zernio][${orgId}] Respuesta: "${reply}"`)
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 7 (Claude):`, err.message)
      return
    }

    // 7. Guardar respuesta
    try {
      await leadRef.collection('conversations').add({
        role: 'bot',
        text: reply,
        content: reply,
        channel: platform || 'whatsapp',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log(`[Zernio][${orgId}] Respuesta guardada en conversations`)
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 7 (guardar respuesta):`, err.message)
    }

    // 8. Enviar respuesta vía API de Zernio
    try {
      console.log(`[Zernio][${orgId}] Enviando respuesta a Zernio API — conversationId: ${conversation?.id}, accountId: ${account?.id}`)
      const zernioResponse = await axios.post(
        `https://zernio.com/api/v1/inbox/conversations/${conversation?.id}/messages`,
        {
          accountId: account?.id,
          message: reply,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )
      console.log(`[Zernio][${orgId}] Zernio API response:`, JSON.stringify(zernioResponse.data))
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 8 (Zernio API):`, err.response?.data || err.message)
    }

    console.log(`[Zernio][${orgId}] ✓ Flujo completo para ${senderName} (${leadDocId})`)
  })
})

// ── CONTENT: GENERATE IMAGE ──────────────────────────────────────
app.post('/content/generate-image', async (req, res) => {
  const { script, brandKit, format } = req.body
  // format: '1:1' o '9:16'

  try {
    // 1. Claude genera el prompt para FLUX
    const promptResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Genera un prompt en inglés para FLUX (generador de imágenes IA) 
      basado en este contenido de redes sociales.
      
      Tema del guión: ${script?.title || ''}
      Estilo visual del brand kit: ${brandKit?.visualStyle || ''}
      Color primario: ${brandKit?.primaryColor || ''}
      
      El prompt debe describir SOLO el fondo visual — sin texto, sin logos, sin personas leyendo.
      Debe ser fotorrealista, profesional, apropiado para post de redes sociales de negocios.
      Máximo 100 palabras. Solo el prompt, sin explicaciones.`
      }]
    })

    const imagePrompt = promptResponse.content[0].text.trim()
    console.log('[generate-image] Prompt generado:', imagePrompt)

    // 2. FAL.AI genera la imagen (flux/schnell: ~5s, evita timeout de 30s)
    const falResponse = await axios.post(
      'https://fal.run/fal-ai/flux/schnell',
      {
        prompt: imagePrompt,
        image_size: format === '9:16' ? 'portrait_16_9' : 'square_hd',
        num_images: 1,
        output_format: 'jpeg',
        num_inference_steps: 4,
      },
      {
        headers: {
          'Authorization': `Key ${process.env.FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 25000, // 25s max para no superar Railway
      }
    )

    const imageUrl = falResponse.data.images[0].url
    console.log('[generate-image] Imagen generada:', imageUrl)

    res.json({ imageUrl, prompt: imagePrompt })
  } catch (err) {
    console.error('[generate-image] ERROR:', err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data || err.message })
  }
})

// ── CALLS: OUTBOUND VIA VAPI ─────────────────────────────────────
app.post('/calls/outbound', async (req, res) => {
  const { leadId, orgId, phoneNumber, leadName, leadInterest } = req.body

  try {
    // 1. Leer config del agente desde Firestore
    const agentSnap = await db
      .collection('organizations').doc(orgId)
      .collection('settings').doc('agent').get()
    const agentConfig = agentSnap.exists ? agentSnap.data() : {}

    const systemPrompt = agentConfig.systemPrompt ||
      `Eres un agente de ventas profesional. 
     Estás llamando a ${leadName}. 
     Su interés principal es: ${leadInterest || 'conocer el sistema'}.
     Tu objetivo es presentarte, entender su negocio y agendar una demo.
     Sé conversacional y amigable.`

    // 2. Lanzar llamada via VAPI
    const response = await axios.post(
      'https://api.vapi.ai/call/phone',
      {
        assistantId: process.env.VAPI_ASSISTANT_ID,
        assistantOverrides: {
          model: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'system', content: systemPrompt }],
          },
          firstMessage: `Hola ${leadName}, ¿cómo estás? Te llamo de Flow Hub.`,
        },
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: { number: phoneNumber, name: leadName },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log(`[VAPI] Llamada iniciada — callId: ${response.data.id}, lead: ${leadName} (${phoneNumber})`)

    // 3. Guardar registro de llamada en Firestore
    await db.collection('organizations').doc(orgId)
      .collection('leads').doc(leadId)
      .collection('calls').add({
        callId: response.data.id,
        status: 'initiated',
        phoneNumber,
        leadName,
        createdAt: FieldValue.serverTimestamp(),
      })

    res.json({ success: true, callId: response.data.id })
  } catch (err) {
    console.error('[VAPI] ERROR /calls/outbound:', err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data || err.message })
  }
})

// ── WEBHOOK: VAPI END-OF-CALL ─────────────────────────────────────
app.post('/webhook/vapi', async (req, res) => {
  const { message } = req.body

  if (message?.type !== 'end-of-call-report') {
    return res.json({ ok: true })
  }

  const { call, transcript, summary, analysis } = message

  console.log('[VAPI] Llamada terminada — callId:', call?.id)
  console.log('[VAPI] Transcripción:', transcript?.slice(0, 200))
  console.log('[VAPI] Resumen:', summary?.slice(0, 200))

  try {
    // Buscar el registro de llamada en Firestore por callId
    // El documento está en leads/{leadId}/calls/{callDocId} con callId == call.id
    // Se hace group query sobre la subcolección 'calls'
    const callsSnap = await db.collectionGroup('calls')
      .where('callId', '==', call?.id)
      .limit(1)
      .get()

    if (!callsSnap.empty) {
      const callDoc = callsSnap.docs[0]
      await callDoc.ref.update({
        status: 'completed',
        transcript: transcript || '',
        summary: summary || '',
        analysis: analysis || null,
        endedAt: FieldValue.serverTimestamp(),
      })
      console.log(`[VAPI] Registro actualizado para callId: ${call?.id}`)
    } else {
      console.warn(`[VAPI] No se encontró registro para callId: ${call?.id}`)
    }
  } catch (err) {
    console.error('[VAPI] ERROR /webhook/vapi:', err.message)
  }

  res.json({ ok: true })
})

app.listen(process.env.PORT || 3000, () => console.log('ManyChat integration running'))
