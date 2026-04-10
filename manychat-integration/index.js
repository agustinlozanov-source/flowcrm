const express = require('express')
const axios = require('axios')
const Anthropic = require('@anthropic-ai/sdk')
const admin = require('firebase-admin')
const { FieldValue } = require('firebase-admin/firestore')

const app = express()
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

console.log('=== Firebase Admin init ===')
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID)
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL)
console.log('FIREBASE_PRIVATE_KEY present:', !!process.env.FIREBASE_PRIVATE_KEY)
console.log('=========================')

// ── BUILD SYSTEM PROMPT (igual que agent.js) ──
function buildSystemPrompt(config) {
  const {
    agentName = 'Asistente',
    personality = 'amigable',
    productDescription = '',
    prices = '',
    mainObjective = 'agendar_llamada',
    salesTechnique = 'aida',
    closingTechnique = 'valor_primero',
    objections = [],
    qualifyingQuestions = [],
    limits = [],
    customInstructions = '',
  } = config

  const personalities = {
    profesional: 'formal, directo, enfocado en resultados y datos concretos.',
    amigable: 'cálido, cercano, conversacional. Usas el nombre del lead frecuentemente.',
    consultivo: 'analítico, haces preguntas poderosas, das perspectivas únicas.',
    energico: 'entusiasta, motivador, creas urgencia de forma natural.',
  }
  const objectives = {
    agendar_llamada: 'Tu objetivo principal es AGENDAR UNA LLAMADA O REUNIÓN.',
    calificar: 'Tu objetivo es CALIFICAR AL LEAD usando el método BANT.',
    cerrar_chat: 'Tu objetivo es CERRAR LA VENTA DIRECTAMENTE POR CHAT.',
    nutrir: 'Tu objetivo es NUTRIR AL LEAD. Educa, comparte valor, construye confianza.',
  }
  const techniques = {
    spin: 'Usa SPIN Selling: Situación, Problema, Implicación, Necesidad-Beneficio.',
    aida: 'Usa AIDA: Atención, Interés, Deseo, Acción.',
    challenger: 'Usa Challenger Sale: Enseña, Adapta, Toma control.',
    rapport: 'Prioriza construir RAPPORT primero antes de vender.',
  }
  const closings = {
    valor_primero: 'Siempre presenta el VALOR antes de mencionar el precio.',
    urgencia: 'Crea urgencia GENUINA basada en hechos reales.',
    alternativas: 'Usa el cierre de alternativas: "¿prefieres el plan A o el plan B?"',
    directo: 'Cuando el lead muestre señales de compra, ve directo al cierre.',
  }
  const objectionsText = objections.filter(o => o.objection && o.response).length > 0
    ? `\nMANEJO DE OBJECIONES:\n${objections.filter(o => o.objection && o.response).map(o => `- "${o.objection}": ${o.response}`).join('\n')}`
    : ''
  const questionsText = qualifyingQuestions.filter(Boolean).length > 0
    ? `\nPREGUNTAS DE CALIFICACIÓN:\n${qualifyingQuestions.filter(Boolean).map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : ''
  const limitsText = limits.filter(Boolean).length > 0
    ? `\nREGLAS ABSOLUTAS:\n${limits.filter(Boolean).map(l => `- ${l}`).join('\n')}`
    : ''

  return `Eres ${agentName}, un agente de ventas con personalidad ${personalities[personality] || personalities.amigable}

${objectives[mainObjective] || objectives.agendar_llamada}

PRODUCTO/SERVICIO:
${productDescription || 'Responde preguntas de forma general.'}

${prices ? `PRECIOS:\n${prices}` : ''}

TÉCNICA DE PROSPECCIÓN: ${techniques[salesTechnique] || techniques.aida}
TÉCNICA DE CIERRE: ${closings[closingTechnique] || closings.valor_primero}
${objectionsText}${questionsText}${limitsText}

INSTRUCCIONES GENERALES:
- Responde siempre en español, máximo 3-4 oraciones por mensaje
- Nunca menciones que eres una IA a menos que te lo pregunten directamente
- Siempre termina con una pregunta o llamada a acción concreta
${customInstructions ? `\nINSTRUCCIONES ADICIONALES:\n${customInstructions}` : ''}`
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

      // Leer archivos RAG (igual que el tab de Prueba)
      const filesSnap = await orgRef.collection('agent_files')
        .where('status', '==', 'ready').get()
      const filesContent = filesSnap.docs
        .map(d => d.data().content || '')
        .filter(Boolean)
        .join('\n\n---\n\n')

      console.log(`[${orgId}] RAG archivos: ${filesSnap.docs.length} | chars: ${filesContent.length}`)

      // Si hay archivos RAG, usarlos como prompt (igual que Prueba)
      // Si no, caer a buildSystemPrompt con la config del agente
      const systemPrompt = (filesContent || buildSystemPrompt(agentConfig))
        + `\n\nContexto: nombre del lead=${name}, canal=${channel}`

      // 5. Claude responde
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages
      })

      const reply = response.content[0].text

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

  // Usar phoneNumber como ID estable del lead (identificador real del contacto en WhatsApp)
  // Fallback a sender.id si no hay teléfono
  const leadDocId = (phoneNumber || '').replace(/\D/g, '') || senderId

  setImmediate(async () => {
    const orgRef = db.collection('organizations').doc(orgId)
    const leadRef = orgRef.collection('leads').doc(leadDocId)

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

    // 5. RAG files
    let filesContent = ''
    try {
      const filesSnap = await orgRef.collection('agent_files')
        .where('status', '==', 'ready').get()
      filesContent = filesSnap.docs
        .map(d => d.data().content || '')
        .filter(Boolean)
        .join('\n\n---\n\n')
      console.log(`[Zernio][${orgId}] RAG archivos: ${filesSnap.docs.length} | chars: ${filesContent.length}`)
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 5 (RAG files):`, err.message)
    }

    const systemPrompt = (filesContent || buildSystemPrompt(agentConfig))
      + `\n\nContexto: nombre del lead=${senderName || 'Sin nombre'}, canal=${platform || 'whatsapp'}`

    // 6. Claude responde
    let reply = null
    try {
      console.log(`[Zernio][${orgId}] Llamando a Claude...`)
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages,
      })
      reply = response.content[0].text
      console.log(`[Zernio][${orgId}] Respuesta de Claude: "${reply}"`)
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 6 (Claude):`, err.message)
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

    // 2. FAL.AI genera la imagen
    const falResponse = await axios.post(
      'https://fal.run/fal-ai/flux-pro/v1.1',
      {
        prompt: imagePrompt,
        image_size: format === '9:16' ? 'portrait_16_9' : 'square_hd',
        num_images: 1,
        output_format: 'jpeg',
        num_inference_steps: 28,
      },
      {
        headers: {
          'Authorization': `Key ${process.env.FAL_API_KEY}`,
          'Content-Type': 'application/json',
        }
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

app.listen(process.env.PORT || 3000, () => console.log('ManyChat integration running'))
