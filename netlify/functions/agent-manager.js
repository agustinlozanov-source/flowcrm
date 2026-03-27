const Anthropic = require('@anthropic-ai/sdk')
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
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
    urgencia: 'Crea urgencia GENUINA basada en hechos reales (lugares limitados, precio especial por tiempo limitado). Nunca inventes urgencia falsa.',
    alternativas: 'Usa el cierre de alternativas: en lugar de preguntar "¿quieres comprar?", pregunta "¿prefieres el plan A o el plan B?"',
    directo: 'Cuando el lead muestre señales de compra, ve directo al cierre. "¿Empezamos esta semana o la siguiente?"',
  }

  const objectionsText = objections.length > 0
    ? `\nMANEJO DE OBJECIONES ESPECÍFICAS:\n${objections.filter(o => o.objection && o.response).map(o => `- Cuando digan "${o.objection}": ${o.response}`).join('\n')}`
    : ''

  const questionsText = qualifyingQuestions.filter(Boolean).length > 0
    ? `\nPREGUNTAS DE CALIFICACIÓN (hazlas de forma natural, no como interrogatorio):\n${qualifyingQuestions.filter(Boolean).map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : ''

  const limitsText = limits.filter(Boolean).length > 0
    ? `\nREGLAS ABSOLUTAS (nunca las violes):\n${limits.filter(Boolean).map(l => `- ${l}`).join('\n')}`
    : ''

  return `Eres ${agentName}, un agente de ventas especializado con personalidad ${personalities[personality] || personalities.amigable}

${objectives[mainObjective] || objectives.agendar_llamada}

SOBRE EL PRODUCTO/SERVICIO QUE VENDES:
${productDescription || 'Responde preguntas sobre el producto de forma general hasta recibir más información.'}

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
- Siempre termina con una pregunta o llamada a acción concreta
- Adapta tu lenguaje al nivel del lead (formal/informal según cómo escriben)

${customInstructions ? `INSTRUCCIONES ADICIONALES:\n${customInstructions}` : ''}`
}

// ── SYNC AGENT CONFIG — solo guarda en Firestore ──
async function syncAssistant(orgId, config) {
  const settingsRef = db.collection('organizations').doc(orgId).collection('settings').doc('agent')
  await settingsRef.set({
    ...config,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
  return { success: true }
}

// ── UPLOAD FILE (guarda metadata en Firestore) ──
async function uploadFile(orgId, fileBuffer, fileName, mimeType) {
  const fileRef = await db.collection('organizations').doc(orgId).collection('agent_files').add({
    name: fileName,
    size: fileBuffer.length,
    mimeType,
    status: 'ready',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return { fileId: fileRef.id }
}

// ── DELETE FILE ──
async function deleteFile(orgId, fileDocId) {
  const fileSnap = await db.collection('organizations').doc(orgId).collection('agent_files').doc(fileDocId).get()
  if (!fileSnap.exists) return
  await fileSnap.ref.delete()
}

// ── GET CONVERSATION HISTORY ──
async function getConversationHistory(orgId, leadId) {
  // test mode — usar colección temporal
  const collPath = leadId === 'test'
    ? db.collection('organizations').doc(orgId).collection('agent_test_threads').doc(leadId).collection('messages')
    : db.collection('organizations').doc(orgId).collection('leads').doc(leadId).collection('conversations')

  const snap = await collPath.orderBy('createdAt', 'desc').limit(10).get()
  return snap.docs.reverse().map(d => ({
    role: d.data().role === 'user' ? 'user' : 'assistant',
    content: d.data().text || d.data().content || '',
  }))
}

// ── SAVE MESSAGE (solo en test mode) ──
async function saveTestMessage(orgId, leadId, role, text) {
  if (leadId !== 'test') return
  await db.collection('organizations').doc(orgId)
    .collection('agent_test_threads').doc(leadId)
    .collection('messages').add({
      role,
      text,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
}

// ── CHAT WITH CLAUDE ──
async function chatWithAssistant(orgId, leadId, message) {
  const settingsSnap = await db.collection('organizations').doc(orgId).collection('settings').doc('agent').get()
  if (!settingsSnap.exists) throw new Error('Agente no configurado. Guarda primero la configuración.')

  const agentConfig = settingsSnap.data() || {}

  // Mismo orden de prioridad que metaService.agentAutoReply
  const systemPrompt = (
    agentConfig.customInstructions ||
    agentConfig.systemPrompt ||
    agentConfig.instructions ||
    buildSystemPrompt(agentConfig)
  ) + `\n\nModo: simulador de pruebas interno.`

  const history = await getConversationHistory(orgId, leadId)

  // Guardar el mensaje del usuario
  await saveTestMessage(orgId, leadId, 'user', message)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      ...history,
      { role: 'user', content: message },
    ],
  })

  const reply = response.content[0]?.text || 'Sin respuesta'

  // Guardar la respuesta del agente
  await saveTestMessage(orgId, leadId, 'assistant', reply)

  return { response: reply }
}

// ── MAIN HANDLER ──
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const headers = { 'Content-Type': 'application/json' }

  try {
    const body = JSON.parse(event.body)
    const { action, orgId } = body

    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing orgId' }) }

    if (action === 'sync') {
      const result = await syncAssistant(orgId, body.config)
      return { statusCode: 200, headers, body: JSON.stringify(result) }
    }

    if (action === 'upload') {
      const buffer = Buffer.from(body.fileData, 'base64')
      const result = await uploadFile(orgId, buffer, body.fileName, body.mimeType)
      return { statusCode: 200, headers, body: JSON.stringify(result) }
    }

    if (action === 'delete_file') {
      await deleteFile(orgId, body.fileDocId)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (action === 'chat') {
      const result = await chatWithAssistant(orgId, body.leadId || 'test', body.message)
      return { statusCode: 200, headers, body: JSON.stringify(result) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }

  } catch (err) {
    console.error('agent-manager error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
