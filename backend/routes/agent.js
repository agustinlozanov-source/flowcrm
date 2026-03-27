const { Router } = require('express')
const { admin, db } = require('../config/firebase')
const Anthropic = require('@anthropic-ai/sdk')

const router = Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

// ── SYNC AGENT CONFIG ── (guarda config en Firestore, sin OpenAI Assistants)
async function syncAgent(orgId, config) {
  const settingsRef = db.collection('organizations').doc(orgId).collection('settings').doc('agent')
  await settingsRef.set({
    ...config,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
  return { success: true }
}

// ── UPLOAD FILE (Firebase Storage) ──
async function uploadFile(orgId, fileBuffer, fileName, mimeType) {
  const bucket = admin.storage().bucket()
  const filePath = `organizations/${orgId}/agent_files/${Date.now()}_${fileName}`
  const fileRef = bucket.file(filePath)

  await fileRef.save(fileBuffer, { metadata: { contentType: mimeType } })
  const [url] = await fileRef.getSignedUrl({ action: 'read', expires: '01-01-2500' })

  const docRef = await db.collection('organizations').doc(orgId).collection('agent_files').add({
    storagePath: filePath,
    downloadUrl: url,
    name: fileName,
    size: fileBuffer.length,
    mimeType,
    status: 'ready',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { fileId: docRef.id, downloadUrl: url }
}

// ── DELETE FILE (Firebase Storage) ──
async function deleteFile(orgId, fileDocId) {
  const fileSnap = await db.collection('organizations').doc(orgId).collection('agent_files').doc(fileDocId).get()
  if (!fileSnap.exists) return
  const { storagePath } = fileSnap.data()
  try {
    if (storagePath) await admin.storage().bucket().file(storagePath).delete()
  } catch (e) {
    console.error('Storage delete error:', e.message)
  }
  await fileSnap.ref.delete()
}

// ── CHAT WITH CLAUDE ──
async function chatWithAssistant(orgId, leadId, message) {
  // 1. Cargar config del agente desde Firestore
  const settingsSnap = await db.collection('organizations').doc(orgId).collection('settings').doc('agent').get()
  const config = settingsSnap.exists ? settingsSnap.data() : {}
  const systemPrompt = buildSystemPrompt(config)

  // 2. Cargar últimos 20 mensajes del historial
  const convRef = db
    .collection('organizations').doc(orgId)
    .collection('leads').doc(leadId)
    .collection('conversations')

  const histSnap = await convRef.orderBy('createdAt', 'asc').limitToLast(20).get()
  const history = histSnap.docs.map(doc => {
    const { role, content } = doc.data()
    return { role, content }
  })

  // 3. Construir messages array con historial + mensaje nuevo
  const messages = [...history, { role: 'user', content: message }]

  // 4. Llamar a Claude
  const claudeRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages,
  })

  const assistantReply = claudeRes.content[0]?.text || 'Sin respuesta'

  // 5. Guardar mensaje del usuario y respuesta en Firestore
  const batch = db.batch()
  batch.set(convRef.doc(), {
    role: 'user',
    content: message,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  batch.set(convRef.doc(), {
    role: 'assistant',
    content: assistantReply,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  await batch.commit()

  // 6. Actualizar lastAgentReply en el lead
  await db.collection('organizations').doc(orgId).collection('leads').doc(leadId).update({
    lastAgentReply: assistantReply,
    lastAgentReplyAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }).catch(() => {})

  return { response: assistantReply, conversationId: leadId }
}

// ── POST /agent ──
router.post('/', async (req, res) => {
  const { action, orgId } = req.body
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })

  try {
    if (action === 'sync') {
      return res.json(await syncAgent(orgId, req.body.config))
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
