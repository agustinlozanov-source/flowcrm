const OpenAI = require('openai')
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = admin.firestore()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── BUILD SYSTEM PROMPT FROM CONFIG ──
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
    profesional: 'formal, directo, enfocado en resultados y datos concretos. Usas lenguaje corporativo pero accesible.',
    amigable: 'cálido, cercano, conversacional. Usas el nombre del lead frecuentemente. Generas confianza rápidamente.',
    consultivo: 'analítico, haces preguntas poderosas, das perspectivas únicas. Posicionas como experto, no como vendedor.',
    energico: 'entusiasta, motivador, creas urgencia de forma natural. Celebras cada avance del lead.',
  }

  const objectives = {
    agendar_llamada: 'Tu objetivo principal es AGENDAR UNA LLAMADA O REUNIÓN. Cada respuesta debe empujar hacia ese objetivo. Cuando el lead muestre interés, propón horarios concretos.',
    calificar: 'Tu objetivo es CALIFICAR AL LEAD. Determina si tiene presupuesto, autoridad, necesidad y tiempo (BANT). Solo cuando esté calificado, ofrece la siguiente etapa.',
    cerrar_chat: 'Tu objetivo es CERRAR LA VENTA DIRECTAMENTE POR CHAT. Presenta el valor, maneja objeciones y pide el compromiso.',
    nutrir: 'Tu objetivo es NUTRIR AL LEAD. Educa, comparte valor, construye confianza. No presiones. El cierre viene después.',
  }

  const techniques = {
    spin: `Usa la técnica SPIN Selling:
- Situación: Entiende la situación actual del lead
- Problema: Identifica sus problemas y frustraciones
- Implicación: Explora las consecuencias de no resolver el problema
- Necesidad-Beneficio: Presenta cómo tu solución resuelve exactamente eso`,
    aida: `Usa la técnica AIDA:
- Atención: Capta su atención con algo relevante para ellos
- Interés: Genera interés mostrando que entiendes su situación
- Deseo: Crea deseo mostrando beneficios concretos
- Acción: Pide una acción específica y concreta`,
    challenger: `Usa la técnica Challenger Sale:
- Enseña algo que el lead no sabe sobre su problema
- Adapta el mensaje a su situación específica
- Toma control de la conversación con confianza
- Desafía suavemente sus creencias si es necesario`,
    rapport: `Prioriza construir RAPPORT primero:
- Usa el nombre del lead frecuentemente
- Refleja su tono y ritmo de comunicación
- Encuentra puntos en común
- Escucha activamente antes de vender`,
  }

  const closings = {
    valor_primero: 'Siempre presenta el VALOR antes de mencionar el precio. Cuando llegue el momento de cerrar, resume los beneficios específicos que le has identificado al lead.',
    urgencia: 'Crea urgencia GENUINA basada en hechos reales (lugares limitados, precio especial por tiempo limitado, etc). Nunca inventes urgencia falsa.',
    alternativas: 'Usa el cierre de alternativas: en lugar de preguntar "¿quieres comprar?", pregunta "¿prefieres el plan A o el plan B?"',
    directo: 'Cuando el lead muestre señales de compra, ve directo al cierre. "¿Empezamos esta semana o la siguiente?"',
  }

  const objectionsText = objections.length > 0
    ? `\nMANEJO DE OBJECIONES ESPECÍFICAS:\n${objections.map(o => `- Cuando digan "${o.objection}": ${o.response}`).join('\n')}`
    : ''

  const questionsText = qualifyingQuestions.length > 0
    ? `\nPREGUNTAS DE CALIFICACIÓN (hazlas de forma natural, no como interrogatorio):\n${qualifyingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : ''

  const limitsText = limits.length > 0
    ? `\nREGLAS ABSOLUTAS (nunca las violes):\n${limits.map(l => `- ${l}`).join('\n')}`
    : ''

  return `Eres ${agentName}, un agente de ventas especializado con personalidad ${personalities[personality] || personalities.amigable}

${objectives[mainObjective] || objectives.agendar_llamada}

SOBRE EL PRODUCTO/SERVICIO QUE VENDES:
${productDescription || 'Usa los documentos de la base de conocimiento para responder preguntas sobre el producto.'}

${prices ? `PRECIOS Y PLANES:\n${prices}` : ''}

TÉCNICA DE PROSPECCIÓN:
${techniques[salesTechnique] || techniques.aida}

TÉCNICA DE CIERRE:
${closings[closingTechnique] || closings.valor_primero}
${objectionsText}
${questionsText}
${limitsText}

INSTRUCCIONES GENERALES:
- Responde siempre en español, de forma breve (máximo 3-4 oraciones por mensaje)
- Nunca menciones que eres una IA a menos que te lo pregunten directamente
- Si no sabes algo, busca en la base de conocimiento antes de inventar
- Siempre termina con una pregunta o llamada a acción concreta
- Usa emojis con moderación si el tono es amigable
- Adapta tu lenguaje al nivel del lead (formal/informal según cómo escriben)

${customInstructions ? `INSTRUCCIONES ADICIONALES DEL NEGOCIO:\n${customInstructions}` : ''}`
}

// ── CREATE OR UPDATE ASSISTANT ──
async function syncAssistant(orgId, config) {
  const settingsRef = db.collection('organizations').doc(orgId).collection('settings').doc('agent')
  const settingsSnap = await settingsRef.get()
  const current = settingsSnap.exists ? settingsSnap.data() : {}

  const systemPrompt = buildSystemPrompt(config)

  // Get vector store if exists
  let vectorStoreId = current.vectorStoreId

  if (!vectorStoreId) {
    // Create vector store
    const vs = await openai.beta.vectorStores.create({ name: `flowcrm-${orgId}` })
    vectorStoreId = vs.id
  }

  const assistantParams = {
    name: config.agentName || 'Agente FlowCRM',
    instructions: systemPrompt,
    model: 'gpt-4o-mini',
    tools: [{ type: 'file_search' }],
    tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
  }

  let assistantId = current.assistantId

  if (assistantId) {
    // Update existing
    await openai.beta.assistants.update(assistantId, assistantParams)
  } else {
    // Create new
    const assistant = await openai.beta.assistants.create(assistantParams)
    assistantId = assistant.id
  }

  // Save to Firestore
  await settingsRef.set({
    ...config,
    assistantId,
    vectorStoreId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  return { assistantId, vectorStoreId }
}

// ── UPLOAD FILE TO VECTOR STORE ──
async function uploadFile(orgId, fileBuffer, fileName, mimeType) {
  const settingsSnap = await db.collection('organizations').doc(orgId).collection('settings').doc('agent').get()
  const { vectorStoreId, assistantId } = settingsSnap.data() || {}

  if (!vectorStoreId) throw new Error('Vector store not initialized. Save agent config first.')

  // Upload to OpenAI
  const file = await openai.files.create({
    file: new File([fileBuffer], fileName, { type: mimeType }),
    purpose: 'assistants',
  })

  // Add to vector store
  await openai.beta.vectorStores.files.create(vectorStoreId, { file_id: file.id })

  // Save file record to Firestore
  const fileRef = await db.collection('organizations').doc(orgId).collection('agent_files').add({
    openaiFileId: file.id,
    name: fileName,
    size: fileBuffer.length,
    mimeType,
    status: 'processing',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { fileId: fileRef.id, openaiFileId: file.id }
}

// ── DELETE FILE ──
async function deleteFile(orgId, fileDocId) {
  const fileSnap = await db.collection('organizations').doc(orgId).collection('agent_files').doc(fileDocId).get()
  if (!fileSnap.exists) return

  const { openaiFileId } = fileSnap.data()

  try {
    await openai.files.del(openaiFileId)
  } catch (err) {
    console.error('OpenAI file delete error:', err)
  }

  await fileSnap.ref.delete()
}

// ── CHAT WITH ASSISTANT (for testing) ──
async function chatWithAssistant(orgId, leadId, message) {
  const settingsSnap = await db.collection('organizations').doc(orgId).collection('settings').doc('agent').get()
  const { assistantId } = settingsSnap.data() || {}

  if (!assistantId) throw new Error('Assistant not configured')

  // Get or create thread for this lead
  const leadRef = db.collection('organizations').doc(orgId).collection('leads').doc(leadId || 'test')
  const leadSnap = await leadRef.get()
  let threadId = leadSnap.exists ? leadSnap.data()?.threadId : null

  if (!threadId) {
    const thread = await openai.beta.threads.create()
    threadId = thread.id
    if (leadSnap.exists) await leadRef.update({ threadId })
  }

  // Add message to thread
  await openai.beta.threads.messages.create(threadId, { role: 'user', content: message })

  // Run assistant
  const run = await openai.beta.threads.runs.createAndPoll(threadId, { assistant_id: assistantId })

  if (run.status !== 'completed') throw new Error(`Run failed: ${run.status}`)

  // Get response
  const messages = await openai.beta.threads.messages.list(threadId, { limit: 1 })
  const response = messages.data[0]?.content[0]?.text?.value || 'Sin respuesta'

  return { response, threadId }
}

// ── MAIN HANDLER ──
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const headers = { 'Content-Type': 'application/json' }

  try {
    const { action, orgId } = JSON.parse(event.body)

    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing orgId' }) }

    if (action === 'sync') {
      const { config } = JSON.parse(event.body)
      const result = await syncAssistant(orgId, config)
      return { statusCode: 200, headers, body: JSON.stringify(result) }
    }

    if (action === 'upload') {
      const { fileData, fileName, mimeType } = JSON.parse(event.body)
      const buffer = Buffer.from(fileData, 'base64')
      const result = await uploadFile(orgId, buffer, fileName, mimeType)
      return { statusCode: 200, headers, body: JSON.stringify(result) }
    }

    if (action === 'delete_file') {
      const { fileDocId } = JSON.parse(event.body)
      await deleteFile(orgId, fileDocId)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (action === 'chat') {
      const { leadId, message } = JSON.parse(event.body)
      const result = await chatWithAssistant(orgId, leadId, message)
      return { statusCode: 200, headers, body: JSON.stringify(result) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }

  } catch (err) {
    console.error('agent-manager error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
