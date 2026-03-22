const { Router } = require('express')
const { admin, db } = require('../config/firebase')
const OpenAI = require('openai')

const router = Router()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── BUILD SYSTEM PROMPT ──
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

${customInstructions ? `INSTRUCCIONES ADICIONALES:\n${customInstructions}` : ''}`
}

// ── SYNC ASSISTANT ──
async function syncAssistant(orgId, config) {
  const settingsRef = db.collection('organizations').doc(orgId).collection('settings').doc('agent')
  const settingsSnap = await settingsRef.get()
  const current = settingsSnap.exists ? settingsSnap.data() : {}
  const systemPrompt = buildSystemPrompt(config)

  const assistantParams = {
    name: config.agentName || 'Agente FlowCRM',
    instructions: systemPrompt,
    model: 'gpt-4o-mini',
  }

  let assistantId = current.assistantId
  if (assistantId) {
    await openai.beta.assistants.update(assistantId, assistantParams)
  } else {
    const assistant = await openai.beta.assistants.create(assistantParams)
    assistantId = assistant.id
  }

  await settingsRef.set({ ...config, assistantId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
  return { assistantId }
}

// ── UPLOAD FILE ──
async function uploadFile(orgId, fileBuffer, fileName, mimeType) {
  const settingsSnap = await db.collection('organizations').doc(orgId).collection('settings').doc('agent').get()
  const { assistantId } = settingsSnap.data() || {}
  if (!assistantId) throw new Error('Guarda el agente primero antes de subir archivos.')

  const file = await openai.files.create({
    file: new File([fileBuffer], fileName, { type: mimeType }),
    purpose: 'assistants',
  })

  const fileRef = await db.collection('organizations').doc(orgId).collection('agent_files').add({
    openaiFileId: file.id,
    name: fileName,
    size: fileBuffer.length,
    mimeType,
    status: 'ready',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { fileId: fileRef.id, openaiFileId: file.id }
}

// ── DELETE FILE ──
async function deleteFile(orgId, fileDocId) {
  const fileSnap = await db.collection('organizations').doc(orgId).collection('agent_files').doc(fileDocId).get()
  if (!fileSnap.exists) return
  const { openaiFileId } = fileSnap.data()
  try { await openai.files.del(openaiFileId) } catch (e) { console.error('OpenAI delete:', e.message) }
  await fileSnap.ref.delete()
}

// ── CHAT WITH ASSISTANT ──
async function chatWithAssistant(orgId, leadId, message) {
  const settingsSnap = await db.collection('organizations').doc(orgId).collection('settings').doc('agent').get()
  if (!settingsSnap.exists) throw new Error('Assistant not configured')
  const { assistantId } = settingsSnap.data() || {}
  if (!assistantId) throw new Error('Assistant not configured')

  const threadKey = `thread_${leadId}`
  const leadRef = db.collection('organizations').doc(orgId).collection('leads').doc(leadId)
  const leadSnap = await leadRef.get()
  let threadId = null

  if (leadSnap.exists && leadSnap.data()?.[threadKey]) {
    threadId = leadSnap.data()[threadKey]
  }

  if (!threadId) {
    const thread = await openai.beta.threads.create()
    threadId = thread.id
    if (leadSnap.exists) {
      await leadRef.update({ [threadKey]: threadId })
    } else {
      await db.collection('organizations').doc(orgId)
        .collection('agent_threads').doc(leadId)
        .set({ threadId }, { merge: true })
    }
  }

  await openai.beta.threads.messages.create(threadId, { role: 'user', content: message })
  const run = await openai.beta.threads.runs.createAndPoll(threadId, { assistant_id: assistantId })
  if (run.status !== 'completed') throw new Error(`Run status: ${run.status}`)

  const messages = await openai.beta.threads.messages.list(threadId, { limit: 1, order: 'desc' })
  const response = messages.data[0]?.content[0]?.text?.value || 'Sin respuesta'
  return { response, threadId }
}

// ── POST /agent ──
router.post('/', async (req, res) => {
  const { action, orgId } = req.body
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })

  try {
    if (action === 'sync') {
      return res.json(await syncAssistant(orgId, req.body.config))
    }
    if (action === 'upload') {
      const buffer = Buffer.from(req.body.fileData, 'base64')
      return res.json(await uploadFile(orgId, buffer, req.body.fileName, req.body.mimeType))
    }
    if (action === 'delete_file') {
      await deleteFile(orgId, req.body.fileDocId)
      return res.json({ success: true })
    }
    if (action === 'chat') {
      return res.json(await chatWithAssistant(orgId, req.body.leadId || 'test', req.body.message))
    }
    res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('agent error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
