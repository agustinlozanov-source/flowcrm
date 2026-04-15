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

// ── BUILD SYSTEM PROMPT ───────────────────────────────────────────
function buildSystemPrompt(config, ragContent, products, scoringConfig, leadContext, resources, allPipelines = [], resolvedPipelineId = null) {
  const {
    agentName = 'Asistente',
    customInstructions = '',
  } = config

  // Products section
  const productsSection = products.length > 0
    ? `\nPRODUCTOS QUE MANEJO:\n${products.map(p =>
        `- ${p.name} · $${Number(p.price).toLocaleString()} ${p.currency || 'USD'}${p.durationDays ? ` · Dura ${p.durationDays} días` : ''}${p.problemTags?.length ? ` · Resuelve: ${p.problemTags.join(', ')}` : ''}`
      ).join('\n')}`
    : ''

  // Scoring instructions — supports array format (categories/subcategories/signals) and legacy object format
  const isArrayScoring = Array.isArray(scoringConfig)
  const hasScoring = isArrayScoring ? scoringConfig.length > 0 : (scoringConfig && Object.keys(scoringConfig).length > 0)
  const scoringSection = hasScoring
    ? `\nSISTEMA DE SCORING ACTIVO:
Mientras conversas, evalúa silenciosamente al lead.
Después de CADA respuesta, indica en el JSON interno qué señales se activaron.

${isArrayScoring
  ? scoringConfig.map(cat => {
      const signals = (cat.subcategories || []).flatMap(sub => sub.signals || [])
      return `${cat.label.toUpperCase()} (tope: ${cat.tope} pts)${cat.desc ? ` — ${cat.desc}` : ''}\n` +
        signals.slice(0, 8).map(s => `  · ${s.text} → ${s.weight >= 0 ? '+' : ''}${s.weight} pts`).join('\n')
    }).join('\n\n')
  : Object.entries(scoringConfig).map(([catId, cat]) => {
      const catLabel = { necesidad: 'NECESIDAD', capacidad: 'CAPACIDAD', intencion: 'INTENCIÓN', confianza: 'CONFIANZA' }[catId] || catId
      const allSignals = []
      if (cat.subcategories) {
        Object.values(cat.subcategories).forEach(sub => {
          if (sub.signals) {
            Object.entries(sub.signals).forEach(([sigId, sigConfig]) => {
              if (sigConfig.enabled) allSignals.push({ sigId, pts: sigConfig.pts })
            })
          }
          if (sub.customSignals) {
            sub.customSignals.forEach(cs => allSignals.push({ text: cs.text, pts: cs.pts }))
          }
        })
      }
      return `${catLabel} (tope: ${cat.cap} pts)\n${allSignals.slice(0, 5).map(s => `  · ${s.text || s.sigId} → ${s.pts} pts`).join('\n')}`
    }).join('\n\n')
}`
    : ''

  // Lead context
  const leadSection = leadContext
    ? `\nCONTEXTO DEL LEAD ACTUAL:
- Score actual: ${leadContext.score || 0}/100
- Etapa actual: ${leadContext.stageName || 'Sin etapa'}
- Pipeline: ${leadContext.pipelineName || 'Sin pipeline'}
- Umbral para avanzar: score ${leadContext.stageScoreMax || 100}
- Perfil B detectado: ${leadContext.profileB ? 'SÍ' : 'No'}
${leadContext.productId ? `- Producto de interés: ${leadContext.productName || leadContext.productId}` : ''}`
    : ''

  // Resources available for sharing
  const resourcesSection = resources?.length > 0
    ? `\nRECURSOS DISPONIBLES PARA COMPARTIR:\nPuedes compartir estos recursos con el lead cuando sea relevante. Incluye la URL directamente en tu respuesta.\n${resources.map(r =>
        `- [${r.type.toUpperCase()}] "${r.name}": ${r.url}`
      ).join('\n')}`
    : ''

  // Routing section — when no pipeline identified yet
  const routingSection = (!resolvedPipelineId && allPipelines.length > 0)
    ? `\nROUTING — IDENTIFICACIÓN DEL FLUJO:\nEste lead aún no tiene un flujo de ventas asignado. Tu primera tarea es identificarlo con 1-2 preguntas naturales sobre su situación o interés. NO menciones los nombres técnicos de los flujos al lead.\n\nFlujos disponibles (solo para tu referencia interna):\n${allPipelines.map(p => `  • ${p.name}${p.purpose ? ` — ${p.purpose}` : ''} [ID: ${p.id}]`).join('\n')}\n\nCuando identifiques el flujo, incluye en el JSON: "detectedPipelineId": "id_aqui". Si no tienes información suficiente aún, deja "detectedPipelineId": null.`
    : ''

  return `Eres ${agentName}, un agente de ventas especializado.

INSTRUCCIONES PRINCIPALES:
- Responde siempre en español, de forma breve (máximo 3-4 oraciones)
- Nunca menciones que eres una IA a menos que te lo pregunten directamente
- Termina siempre con una pregunta o llamada a acción concreta
- Adapta tu tono al del lead (formal/informal)
- Tu objetivo es calificar al lead y prepararlo para una llamada con el vendedor humano

${productsSection}
${scoringSection}
${leadSection}
${routingSection}
${resourcesSection}

BASE DE CONOCIMIENTO:
${ragContent || 'No hay documentos cargados aún.'}

${customInstructions ? `INSTRUCCIONES ADICIONALES:\n${customInstructions}` : ''}

FORMATO DE RESPUESTA IMPORTANTE:
Siempre responde con JSON en este formato exacto:
{
  "response": "El mensaje que verá el lead",
  "scoring": {
${isArrayScoring && scoringConfig.length > 0
  ? scoringConfig.map(cat => `    "${cat.id}": { "delta": 0, "reason": "" }`).join(',\n')
  : !isArrayScoring && scoringConfig && Object.keys(scoringConfig).length > 0
    ? Object.keys(scoringConfig).map(k => `    "${k}": { "delta": 0, "reason": "" }`).join(',\n')
    : '    "general": { "delta": 0, "reason": "" }'}
  },
  "profileB": false,
  "profileBReason": "",
  "suggestHandoff": false,
  "suggestHandoffReason": "",
  "detectedProductId": null,
  "detectedPipelineId": null
}

Reglas del JSON:
- "response": el mensaje visible para el lead
- "scoring.X.delta": puntos a sumar (positivo) o restar (negativo), 0 si no hay señal
- "profileB": true si el lead muestra señales de potencial distribuidor
- "suggestHandoff": true si el lead está listo para una llamada con el vendedor
- "detectedProductId": ID del producto si el lead mostró interés en uno específico
- "detectedPipelineId": ID del flujo de ventas si lograste identificar a cuál pertenece el lead (solo en modo routing)`
}

// ── PARSE AGENT RESPONSE ──────────────────────────────────────────
function parseAgentResponse(text) {
  try {
    // Try direct JSON parse
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {}
  // Fallback — treat entire text as response
  return {
    response: text,
    scoring: { necesidad: { delta: 0 }, capacidad: { delta: 0 }, intencion: { delta: 0 }, confianza: { delta: 0 } },
    profileB: false,
    suggestHandoff: false,
    detectedProductId: null,
  }
}

// ── CALCULATE NEW SCORE ───────────────────────────────────────────
function calculateNewScore(currentScore, scoringDeltas) {
  if (!scoringDeltas || Object.keys(scoringDeltas).length === 0) return currentScore
  // Sum all category deltas, clamp result to 0–100
  return Math.max(0, Math.min(100,
    currentScore + Object.values(scoringDeltas).reduce((sum, s) => sum + (s.delta || 0), 0)
  ))
}

// ── FIND TARGET STAGE BY SCORE ────────────────────────────────────
async function findTargetStage(orgId, pipelineId, score) {
  const stagesSnap = await db.collection('organizations').doc(orgId)
    .collection('pipeline_stages')
    .where('pipelineId', '==', pipelineId)
    .orderBy('order', 'asc')
    .get()

  const stages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  // Find stage where score fits
  for (const stage of stages) {
    const min = stage.scoreMin ?? 0
    const max = stage.scoreMax ?? 100
    if (score >= min && score <= max) return stage
  }

  // If score exceeds all stages → suggest handoff
  const maxStage = stages[stages.length - 1]
  if (maxStage && score > (maxStage.scoreMax ?? 100)) return { id: '__handoff__', name: 'Handoff' }

  return null
}

// ── UPDATE LEAD SCORE AND STAGE ───────────────────────────────────
async function updateLeadScoreAndStage(orgId, leadId, parsedResponse, currentScore, scoringConfig) {
  const leadRef = db.collection('organizations').doc(orgId).collection('leads').doc(leadId)
  const leadSnap = await leadRef.get()
  if (!leadSnap.exists) return

  const lead = leadSnap.data()
  const newScore = calculateNewScore(currentScore, parsedResponse.scoring)

  const updateData = {
    score: newScore,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  // ProfileB detection
  if (parsedResponse.profileB && !lead.profileB) {
    updateData.profileB = true
    updateData.profileBDetectedAt = admin.firestore.FieldValue.serverTimestamp()
    // Create alert
    await db.collection('organizations').doc(orgId).collection('alerts').add({
      type: 'profile_b',
      leadId,
      leadName: lead.name,
      message: `${lead.name} tiene perfil de distribuidor — ${parsedResponse.profileBReason || ''}`,
      assignedTo: lead.assignedTo || null,
      seen: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }

  // Detected product interest
  if (parsedResponse.detectedProductId && !lead.productId) {
    updateData.productId = parsedResponse.detectedProductId
  }

  // Stage advancement based on score
  if (lead.pipelineId && !lead.systemStage) {
    const targetStage = await findTargetStage(orgId, lead.pipelineId, newScore)
    if (targetStage && targetStage.id !== lead.stageId) {
      if (targetStage.id === '__handoff__' || parsedResponse.suggestHandoff) {
        // Move to handoff
        updateData.systemStage = 'handoff'
        updateData.systemStageAt = admin.firestore.FieldValue.serverTimestamp()
        updateData.stageId = null
        updateData.handoffAt = admin.firestore.FieldValue.serverTimestamp()
        // Alert the assigned user
        if (lead.assignedTo) {
          await db.collection('organizations').doc(orgId).collection('alerts').add({
            type: 'handoff_assigned',
            leadId,
            leadName: lead.name,
            assignedTo: lead.assignedTo,
            message: `${lead.name} está listo para llamada — score ${newScore}`,
            seen: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }
      } else {
        updateData.stageId = targetStage.id
      }
    }
  }

  await leadRef.update(updateData)
  return newScore
}

// ── SYNC AGENT CONFIG ─────────────────────────────────────────────
async function syncAssistant(orgId, config) {
  const settingsRef = db.collection('organizations').doc(orgId).collection('settings').doc('agent')
  // Firestore rechaza undefined — filtrar antes de guardar
  const cleanConfig = Object.fromEntries(
    Object.entries({ ...config, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      .filter(([, v]) => v !== undefined)
  )
  await settingsRef.set(cleanConfig, { merge: true })
  return { success: true }
}

// ── UPLOAD FILE ───────────────────────────────────────────────────
async function uploadFile(orgId, fileBuffer, fileName, mimeType) {
  let content = ''
  try {
    content = fileBuffer.toString('utf-8')
  } catch {}
  const fileRef = await db.collection('organizations').doc(orgId).collection('agent_files').add({
    name: fileName,
    size: fileBuffer.length,
    mimeType,
    content,
    status: 'ready',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return { fileId: fileRef.id }
}

// ── DELETE FILE ───────────────────────────────────────────────────
async function deleteFile(orgId, fileDocId) {
  const fileSnap = await db.collection('organizations').doc(orgId).collection('agent_files').doc(fileDocId).get()
  if (fileSnap.exists) await fileSnap.ref.delete()
}

// ── CLEAR TEST THREAD ─────────────────────────────────────────────
async function clearTestThread(orgId) {
  const ref = db.collection('organizations').doc(orgId)
    .collection('agent_test_threads').doc('test').collection('messages')
  const snap = await ref.get()
  const batch = db.batch()
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
}

// ── GET CONVERSATION HISTORY ──────────────────────────────────────
async function getConversationHistory(orgId, leadId) {
  const collPath = leadId === 'test'
    ? db.collection('organizations').doc(orgId).collection('agent_test_threads').doc(leadId).collection('messages')
    : db.collection('organizations').doc(orgId).collection('leads').doc(leadId).collection('conversations')
  const snap = await collPath.orderBy('createdAt', 'desc').limit(10).get()
  return snap.docs.reverse().map(d => ({
    role: d.data().role === 'user' ? 'user' : 'assistant',
    content: d.data().text || d.data().content || '',
  }))
}

// ── SAVE MESSAGE ──────────────────────────────────────────────────
async function saveTestMessage(orgId, leadId, role, text) {
  if (leadId !== 'test') return
  await db.collection('organizations').doc(orgId)
    .collection('agent_test_threads').doc(leadId)
    .collection('messages').add({
      role, text, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
}

async function saveLeadMessage(orgId, leadId, role, text) {
  if (leadId === 'test') return
  await db.collection('organizations').doc(orgId)
    .collection('leads').doc(leadId)
    .collection('conversations').add({
      role, text, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
}

// ── LOAD DISTRIBUIDOR GLOBAL CONFIG ──────────────────────────────
async function loadDistribuidorConfig(orgId) {
  try {
    const orgSnap = await db.collection('organizations').doc(orgId).get()
    if (!orgSnap.exists || !orgSnap.data()?.isDistribuidor) return null
    const configSnap = await db.collection('flowhub_config').doc('distribuidor_niveles').get()
    return configSnap.exists ? configSnap.data() : null
  } catch {
    return null
  }
}

// ── BUILD DISTRIBUIDOR SCORING TEXT ──────────────────────────────
function buildDistribuidorScoringText(scoringSignals) {
  if (!scoringSignals?.length) return ''
  return '\n\nSEÑALES DE CALIFICACIÓN PARA DISTRIBUIDORES:\n' +
    scoringSignals.map(cat =>
      `${cat.label || cat.name} (máx ${cat.tope} pts):\n` +
      (cat.subcategories || []).map(sub =>
        `  ${sub.label || sub.name}:\n` +
        (sub.signals || []).map(sig => `    - ${sig.text || sig.name}: ${sig.weight >= 0 ? '+' : ''}${sig.weight} pts`).join('\n')
      ).join('\n')
    ).join('\n\n')
}

// ── CHAT WITH AGENT ───────────────────────────────────────────────
async function chatWithAssistant(orgId, leadId, message, testPipelineId = null) {
  // Load agent config
  const settingsSnap = await db.collection('organizations').doc(orgId).collection('settings').doc('agent').get()
  if (!settingsSnap.exists) throw new Error('Agente no configurado.')
  let agentConfig = settingsSnap.data() || {}

  // ── Distribuidor override: merge global agentPrompt + scoringSignals ──
  const distribConfig = await loadDistribuidorConfig(orgId)
  if (distribConfig) {
    const extraScoringText = buildDistribuidorScoringText(distribConfig.scoringSignals)
    if (distribConfig.agentPrompt) {
      agentConfig = {
        ...agentConfig,
        customInstructions: distribConfig.agentPrompt + extraScoringText,
      }
    } else if (extraScoringText) {
      // customInstructions may be an object (per-pipeline) — we'll handle resolution later; just append to base string
      const base = typeof agentConfig.customInstructions === 'string' ? agentConfig.customInstructions : ''
      agentConfig = {
        ...agentConfig,
        customInstructions: base + extraScoringText,
      }
    }
  }

  // Load RAG files
  const filesSnap = await db.collection('organizations').doc(orgId).collection('agent_files')
    .where('status', '==', 'ready').get()
  const ragContent = filesSnap.docs.map(d => d.data().content || '').filter(Boolean).join('\n\n---\n\n')

  // Load enabled products
  let products = []
  if (agentConfig.enabledProductIds?.length) {
    const productSnaps = await Promise.all(
      agentConfig.enabledProductIds.map(id =>
        db.collection('organizations').doc(orgId).collection('products').doc(id).get()
      )
    )
    products = productSnaps.filter(s => s.exists).map(s => ({ id: s.id, ...s.data() }))
  }

  // Load resources available for sharing
  const resourcesSnap = await db.collection('organizations').doc(orgId).collection('agent_resources')
    .orderBy('createdAt', 'desc').get()
  const resources = resourcesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  // Load lead context (if real lead, not test)
  let leadContext = null
  let currentScore = 0
  let scoringConfig = null
  let pipelineId = null

  if (leadId !== 'test') {
    const leadSnap = await db.collection('organizations').doc(orgId).collection('leads').doc(leadId).get()
    if (leadSnap.exists) {
      const lead = leadSnap.data()
      currentScore = lead.score || 0
      pipelineId = lead.pipelineId

      // Load stage info
      let stageName = 'Sin etapa'
      let stageScoreMax = 100
      if (lead.stageId) {
        const stageSnap = await db.collection('organizations').doc(orgId).collection('pipeline_stages').doc(lead.stageId).get()
        if (stageSnap.exists) {
          stageName = stageSnap.data().name
          stageScoreMax = stageSnap.data().scoreMax ?? 100
        }
      }

      // Load pipeline info
      let pipelineName = ''
      if (pipelineId) {
        const pipelineSnap = await db.collection('organizations').doc(orgId).collection('pipelines').doc(pipelineId).get()
        if (pipelineSnap.exists) pipelineName = pipelineSnap.data().name || ''
      }

      // Load scoring config for this pipeline
      if (pipelineId && agentConfig.scoring?.[pipelineId]) {
        scoringConfig = agentConfig.scoring[pipelineId]
      } else if (agentConfig.scoring) {
        // Fallback to first scoring config
        const keys = Object.keys(agentConfig.scoring)
        if (keys.length) scoringConfig = agentConfig.scoring[keys[0]]
      }

      // Load product name if associated
      let productName = ''
      if (lead.productId) {
        const productSnap = await db.collection('organizations').doc(orgId).collection('products').doc(lead.productId).get()
        if (productSnap.exists) productName = productSnap.data().name || ''
      }

      leadContext = {
        score: currentScore,
        stageName,
        stageScoreMax,
        pipelineName,
        profileB: lead.profileB || false,
        productId: lead.productId,
        productName,
      }
    }
  }

  // Test mode with a specific pipeline selected — load scoring config for that pipeline
  if (leadId === 'test' && testPipelineId) {
    pipelineId = testPipelineId
    if (agentConfig.scoring?.[pipelineId]) {
      scoringConfig = agentConfig.scoring[pipelineId]
    } else if (agentConfig.scoring) {
      const keys = Object.keys(agentConfig.scoring)
      if (keys.length) scoringConfig = agentConfig.scoring[keys[0]]
    }
  }

  // Load all pipelines (used for routing section in system prompt)
  let allPipelines = []
  try {
    const pipelinesSnap = await db.collection('organizations').doc(orgId).collection('pipelines').orderBy('createdAt', 'asc').get()
    allPipelines = pipelinesSnap.docs.map(d => ({ id: d.id, name: d.data().name || '', purpose: d.data().purpose || '' }))
  } catch {
    // orderBy may fail without index — fall back to unordered
    try {
      const pipelinesSnap = await db.collection('organizations').doc(orgId).collection('pipelines').get()
      allPipelines = pipelinesSnap.docs.map(d => ({ id: d.id, name: d.data().name || '', purpose: d.data().purpose || '' }))
    } catch {}
  }

  // Resolve per-pipeline customInstructions (new {pipelineId: string} object or legacy string)
  const rawInstructions = agentConfig.customInstructions
  if (typeof rawInstructions === 'object' && rawInstructions !== null && !Array.isArray(rawInstructions)) {
    const resolved = (pipelineId && rawInstructions[pipelineId])
      || rawInstructions['__default__']
      || Object.values(rawInstructions).find(Boolean)
      || ''
    agentConfig = { ...agentConfig, customInstructions: resolved }
  }
  // (if already a string — legacy or distribuidor override — leave as-is)

  const systemPrompt = buildSystemPrompt(agentConfig, ragContent, products, scoringConfig, leadContext, resources, allPipelines, pipelineId)

  // Load conversation history
  const history = await getConversationHistory(orgId, leadId)

  // Save user message
  await saveTestMessage(orgId, leadId, 'user', message)
  await saveLeadMessage(orgId, leadId, 'user', message)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user', content: message },
      ],
    })

    const rawReply = response.content[0]?.text || '{}'
    const parsed = parseAgentResponse(rawReply)
    const visibleReply = parsed.response || rawReply

    // Save agent response
    await saveTestMessage(orgId, leadId, 'assistant', visibleReply)
    await saveLeadMessage(orgId, leadId, 'assistant', visibleReply)

    // Update lead score and stage (only for real leads)
    let newScore = currentScore
    if (leadId !== 'test' && scoringConfig) {
      newScore = await updateLeadScoreAndStage(orgId, leadId, parsed, currentScore, scoringConfig)
    }

    return {
      response: visibleReply,
      score: newScore,
      profileB: parsed.profileB,
      suggestHandoff: parsed.suggestHandoff,
    }
  } catch (err) {
    console.error('❌ Anthropic error:', err.status, err.message)
    throw err
  }
}

// ── MAIN HANDLER ──────────────────────────────────────────────────
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
    if (action === 'clear_thread') {
      await clearTestThread(orgId)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }
    if (action === 'chat') {
      const result = await chatWithAssistant(orgId, body.leadId || 'test', body.message, body.pipelineId || null)
      return { statusCode: 200, headers, body: JSON.stringify(result) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
  } catch (err) {
    console.error('agent-manager error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
