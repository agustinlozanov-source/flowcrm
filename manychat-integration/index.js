const express = require('express')
const axios = require('axios')
const Anthropic = require('@anthropic-ai/sdk')
const admin = require('firebase-admin')

const app = express()
app.use(express.json())

admin.initializeApp({
  credential: admin.credential.cert({
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
})

const db = admin.firestore()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

app.get('/health', (req, res) => res.sendStatus(200))

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

app.listen(process.env.PORT || 3000, () => console.log('ManyChat integration running'))
