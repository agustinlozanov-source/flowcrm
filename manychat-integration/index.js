const express = require('express')
const axios = require('axios')
const Anthropic = require('@anthropic-ai/sdk')
const admin = require('firebase-admin')
const { FieldValue } = require('firebase-admin/firestore')
const { google } = require('googleapis')

const app = express()

// CORS — permite flowhubcrm.app y localhost en dev
app.use((req, res, next) => {
  const allowed = [
    'https://flowhubcrm.app',
    'https://www.flowhubcrm.app',
    'https://flowcrm.netlify.app',
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

  // Load available pipelines for detectedPipelineId hint
  let availablePipelines = []
  try {
    const pipSnap = await orgRef.collection('pipelines').get()
    availablePipelines = pipSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch {}

  // RAG content
  let ragContent = ''
  try {
    const filesSnap = await orgRef.collection('agent_files').where('status', '==', 'ready').get()
    ragContent = filesSnap.docs
      .filter(d => !d.data().pipelineId || d.data().pipelineId === pipelineId)
      .map(d => d.data().content || '').filter(Boolean).join('\n\n---\n\n')
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

  const now = new Date()
  const fechaActual = now.toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Monterrey',
  })
  const horaActual = now.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Monterrey',
  })

  const systemPrompt = `Eres ${agentName}, un agente de ventas especializado.

FECHA Y HORA ACTUAL: ${fechaActual}, ${horaActual} (hora de México)
Usa esta fecha como referencia para calcular "mañana", "esta semana", etc.
Cuando generes scheduledAt en MEETING_SCHEDULED usa el año y fecha correctos.

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
  "detectedProductId": null,
  "detectedPipelineId": null
}

REGLAS PARA suggestHandoff:
- Ponlo en true cuando el lead haya confirmado una cita/reunión (junto con MEETING_SCHEDULED)
- Ponlo en true cuando el lead pida hablar con un humano o vendedor
- Ponlo en true cuando ya tienes suficiente información para que un vendedor cierre
- En todos los demás casos déjalo en false

REGLAS PARA detectedPipelineId:
- Si el lead menciona un producto o servicio específico que reconoces → pon el pipelineId correspondiente
- Si el lead dice que ya es cliente o quiere renovar → pon el pipelineId de retención
- Si el lead quiere vender, ser distribuidor o ganar dinero → pon el pipelineId de distribución
- Si no hay suficiente contexto todavía → deja null
- Los pipelines disponibles son:
${availablePipelines.map(p => `  · "${p.id}" → ${p.name} (${p.purpose || 'adquisicion'})`).join('\n')}

INSTRUCCIONES PARA AGENDAR REUNIONES:
Cuando el lead confirme explícitamente una fecha Y hora para una reunión o videollamada:
1. En tu respuesta dile que le estás enviando el link ahora mismo
2. Al FINAL de tu JSON, después del campo "detectedPipelineId", agrega EXACTAMENTE esto en una línea separada:
MEETING_SCHEDULED: {"scheduledAt": "2026-04-16T18:00:00", "duration": 30, "notes": "Demo Flow Hub"}

IMPORTANTE:
- Usa la fecha y hora que el lead confirmó
- El formato de scheduledAt es ISO 8601 en hora local México (UTC-6)
- NO prometas que "alguien más" enviará el link — TÚ lo envías automáticamente
- Solo emite MEETING_SCHEDULED cuando el lead haya confirmado fecha Y hora específicas
- Si solo dice "mañana" sin hora → pregunta la hora antes de agendar
`

  return { systemPrompt, scoringConfig, pipelineId }
}

// ── CLEAN RAW REPLY — quita el bloque JSON y MEETING_SCHEDULED del texto visible ──
function cleanRawReply(text) {
  // Quitar bloque MEETING_SCHEDULED
  let clean = text.replace(/MEETING_SCHEDULED:\s*\{[\s\S]*?\}/m, '').trim()
  // Quitar el primer objeto JSON completo (brace-counting)
  const start = clean.indexOf('{')
  if (start !== -1) {
    let depth = 0, inStr = false, esc = false
    for (let i = start; i < clean.length; i++) {
      const ch = clean[i]
      if (esc) { esc = false; continue }
      if (ch === '\\' && inStr) { esc = true; continue }
      if (ch === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) { clean = (clean.slice(0, start) + clean.slice(i + 1)).trim(); break } }
    }
  }
  return clean || text
}

// ── EXTRACT FIRST JSON OBJECT (brace-counting, handles nested objects) ──
// Regex non-greedy fails with nested braces; this walks char-by-char instead.
function extractFirstJson(text) {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

// ── PARSE CLAUDE REPLY + UPDATE SCORE ──
async function parseAndUpdateScore(orgRef, lead, rawReply, scoringConfig) {
  // Fallback robusto: si JSON falla, al menos quitamos el bloque JSON del reply
  let visibleReply = cleanRawReply(rawReply)
  let detectedPipelineId = null
  try {
    const jsonStr = extractFirstJson(rawReply)
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr)

      // Solo el campo response va al lead — nunca el JSON completo
      if (parsed.response) visibleReply = parsed.response

      // ── Scoring + mover etapa ──
      if (parsed.scoring && lead.id) {
        const delta = Object.values(parsed.scoring).reduce((sum, s) => sum + (s.delta || 0), 0)
        if (delta !== 0) {
          const newScore = Math.max(0, Math.min(100, (lead.score || 0) + delta))
          await orgRef.collection('leads').doc(lead.id).update({
            score: newScore,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }).catch(() => {})

          // Mover lead a la etapa correcta según score
          if (lead.pipelineId) {
            try {
              const stagesSnap = await orgRef.collection('pipeline_stages')
                .where('pipelineId', '==', lead.pipelineId)
                .orderBy('order', 'asc').get()
              const stages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
              const correctStage = stages.find(s =>
                newScore >= (s.scoreMin || 0) && newScore <= (s.scoreMax || 100)
              )
              if (correctStage && correctStage.id !== lead.stageId) {
                await orgRef.collection('leads').doc(lead.id).update({
                  stageId: correctStage.id,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                })
                console.log(`[Score] Lead ${lead.id} movido a etapa: ${correctStage.name} (score: ${newScore})`)
              }
            } catch (stageErr) {
              console.error('[Score] Error al mover etapa:', stageErr.message)
            }
          }
        }
      }

      // ── Handoff ──
      if (parsed.suggestHandoff === true && lead.id) {
        await orgRef.collection('leads').doc(lead.id).update({
          systemStage: 'handoff',
          systemStageAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {})
        await orgRef.collection('alerts').add({
          type: 'handoff_ready',
          leadId: lead.id,
          leadName: lead.name || '',
          message: `${lead.name} está listo para hablar con un vendedor`,
          seen: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {})
        console.log(`[Score] Handoff activado para ${lead.name}`)
      }

      // ── Asignar pipeline si el lead no tiene uno ──
      detectedPipelineId = parsed.detectedPipelineId || null
      if (detectedPipelineId && !lead.pipelineId) {
        try {
          const stagesSnap = await orgRef.collection('pipeline_stages')
            .where('pipelineId', '==', detectedPipelineId)
            .orderBy('order', 'asc').limit(1).get()
          const firstStageId = stagesSnap.empty ? null : stagesSnap.docs[0].id
          await orgRef.collection('leads').doc(lead.id).update({
            pipelineId: detectedPipelineId,
            stageId: firstStageId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          lead.pipelineId = detectedPipelineId
          lead.stageId = firstStageId
          console.log(`[Score] Lead ${lead.id} asignado al pipeline: ${detectedPipelineId}`)
        } catch (pipeErr) {
          console.error('[Score] Error al asignar pipeline:', pipeErr.message)
        }
      }
    }
  } catch (err) {
    console.error('JSON parse error:', err.message)
  }
  return { visibleReply, detectedPipelineId }
}

// ── ADMIN: CLEAR LEADS (temporal para pruebas) ────────────────────────────
app.delete('/admin/clear-leads/:orgId', async (req, res) => {
  const { orgId } = req.params
  const { secret } = req.query
  if (secret !== 'flowhub-clear-2026') return res.status(401).json({ error: 'Unauthorized' })
  try {
    const orgRef = db.collection('organizations').doc(orgId)
    const leadsSnap = await orgRef.collection('leads').get()
    let deleted = 0
    for (const leadDoc of leadsSnap.docs) {
      const convsSnap = await leadDoc.ref.collection('conversations').get()
      for (const conv of convsSnap.docs) await conv.ref.delete()
      await leadDoc.ref.delete()
      deleted++
    }
    const locksSnap = await db.collection('_global_msg_locks').get()
    for (const lock of locksSnap.docs) await lock.ref.delete()
    res.json({ success: true, deleted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

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

// ── GOOGLE CALENDAR OAUTH ─────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

// GET /meetings/auth/google?orgId=xxx — Inicia flujo OAuth
app.get('/meetings/auth/google', (req, res) => {
  const { orgId } = req.query
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: orgId,
  })
  res.redirect(url)
})

// GET /meetings/auth/google/callback — Recibe tokens y guarda en Firestore
app.get('/meetings/auth/google/callback', async (req, res) => {
  const { code, state: orgId } = req.query
  try {
    const { tokens } = await oauth2Client.getToken(code)
    await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').set({
        googleCalendar: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date,
          connected: true,
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      }, { merge: true })
    res.redirect(`https://flowcrm.netlify.app/meetings?google=connected`)
  } catch (err) {
    console.error('[Google OAuth] callback error:', err.message)
    res.redirect(`https://flowcrm.netlify.app/meetings?google=error`)
  }
})

// POST /meetings/google/create — Crea evento con Meet link
app.post('/meetings/google/create', async (req, res) => {
  const { orgId, title, scheduledAt, duration, leadEmail, leadName, notes } = req.body
  if (!orgId || !title || !scheduledAt) return res.status(400).json({ error: 'Missing required fields' })
  try {
    const integSnap = await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').get()
    const tokens = integSnap.data()?.googleCalendar
    if (!tokens?.connected) return res.status(400).json({ error: 'Google Calendar no conectado' })

    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const start = new Date(scheduledAt)
    const end = new Date(start.getTime() + (duration || 30) * 60000)

    const event = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: title,
        description: notes || '',
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        conferenceData: { createRequest: { requestId: `flowcrm-${Date.now()}` } },
        attendees: leadEmail ? [{ email: leadEmail, displayName: leadName }] : [],
      }
    })

    const meetLink = event.data.conferenceData?.entryPoints?.[0]?.uri || ''
    res.json({ success: true, meetLink, eventId: event.data.id })
  } catch (err) {
    console.error('[Google Calendar] create error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /meetings/google/delete — Elimina evento de Google Calendar
app.delete('/meetings/google/delete', async (req, res) => {
  const { orgId, googleEventId } = req.body
  if (!orgId || !googleEventId) return res.status(400).json({ error: 'Missing orgId or googleEventId' })
  try {
    const integSnap = await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').get()
    const tokens = integSnap.data()?.googleCalendar
    if (!tokens?.connected) return res.json({ success: true, skipped: true })

    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    })
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId })
    res.json({ success: true })
  } catch (err) {
    // Si el evento ya no existe en Calendar (410 Gone) lo ignoramos
    if (err.code === 410 || err.status === 410) return res.json({ success: true, skipped: true })
    console.error('[Google Calendar] delete error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
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
        max_tokens: 1024,
        system: systemPrompt,
        messages
      })

      const { visibleReply: reply } = await parseAndUpdateScore(orgRef, leadData, response.content[0].text, scoringConfig)

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
  const { text, platform: rawPlatform } = message

  // Normalizar el canal a nuestros valores canónicos
  function normalizePlatform(p) {
    if (!p) return 'whatsapp'
    const v = String(p).toLowerCase()
    if (v.includes('facebook') || v.includes('messenger') || v === 'fb') return 'messenger'
    if (v.includes('instagram') || v === 'ig') return 'instagram'
    if (v.includes('whatsapp') || v === 'wa') return 'whatsapp'
    return v // pasar tal cual si es otro valor conocido
  }
  const platform = normalizePlatform(rawPlatform)
  // Usar phoneNumber como ID estable del lead (identificador real del contacto en WhatsApp)
  // Fallback a sender.id si no hay teléfono (ej: Messenger)
  const leadDocId = (phoneNumber || '').replace(/\D/g, '') || senderId

  setImmediate(async () => {
    const orgRef = db.collection('organizations').doc(orgId)

    // Guard: leadDocId no puede ser vacío
    if (!leadDocId) {
      console.error(`[Zernio][${orgId}] leadDocId vacío — senderId: ${senderId}, phoneNumber: ${phoneNumber}. Abortando.`)
      return
    }

    const leadRef = orgRef.collection('leads').doc(leadDocId)

    console.log(`[Zernio] sender.id: ${senderId} | phoneNumber: ${phoneNumber} | leadDocId: ${leadDocId}`)
    console.log(`[Zernio] Escribiendo en Firestore: organizations/${orgId}/leads/${leadDocId}`)
    console.log(`[Zernio] Firebase project: ${process.env.FIREBASE_PROJECT_ID}`)

    // 1. Guardar / actualizar lead
    try {
      const existingSnap = await leadRef.get()
      if (!existingSnap.exists) {
        // FIX 5 — mensajes muy cortos/genéricos van a Contactos (sin pipeline)
        const isGenericMessage = text.trim().split(/\s+/).length < 4

        // Obtener pipeline y etapa por defecto — en try/catch propio para no bloquear la creación del lead
        let defaultPipelineId = null
        let stageId = null
        if (!isGenericMessage) {
          try {
            const pipelinesSnap = await orgRef.collection('pipelines')
              .orderBy('createdAt', 'asc').limit(1).get()
            defaultPipelineId = pipelinesSnap.empty ? null : pipelinesSnap.docs[0].id
            if (defaultPipelineId) {
              const stagesSnap = await orgRef.collection('pipeline_stages')
                .where('pipelineId', '==', defaultPipelineId)
                .orderBy('order', 'asc').limit(1).get()
              stageId = stagesSnap.empty ? null : stagesSnap.docs[0].id
            }
          } catch (pipeErr) {
            console.error(`[Zernio][${orgId}] Error al obtener pipeline por defecto (se crea lead sin pipeline):`, pipeErr.message)
          }
        }

        await leadRef.set({
          subscriber_id: senderId,
          orgId,
          name: senderName || 'Sin nombre',
          phone: phoneNumber || '',
          company: '',
          source: platform,
          channel: platform,
          pipelineId: defaultPipelineId,
          stageId,
          score: 0,
          assignedTo: null,
          channelIds: { [platform]: senderId },
          lastMessage: text,
          hasUnread: true,
          lastMessageChannel: platform,
          lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        console.log(`[Zernio][${orgId}] Lead creado: ${leadDocId} (${senderName}) — pipeline: ${defaultPipelineId || 'Contactos'}`)
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
        max_tokens: 1024,
      const { visibleReply, detectedPipelineId } = await parseAndUpdateScore(orgRef, leadData, rawReply, scoringConfig)
      reply = visibleReply
      console.log(`[Zernio][${orgId}] Respuesta: "${reply}"`)

      // Detectar MEETING_SCHEDULED + crear Google Calendar event + enviar link al lead
      const meetingMatch = rawReply.match(/MEETING_SCHEDULED:\s*({[\s\S]*?})/m)
      if (meetingMatch) {
        try {
          const meetingData = JSON.parse(meetingMatch[1])

          // Crear appointment en Firestore
          const apptRef = await orgRef.collection('appointments').add({
            leadId: leadDocId,
            leadName: senderName || '',
            type: 'video',
            scheduledAt: new Date(meetingData.scheduledAt),
            duration: meetingData.duration || 30,
            platform: 'meet',
            link: '',
            notes: meetingData.notes || '',
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'agent',
          })

          // Crear evento en Google Calendar y obtener link de Meet
          try {
            const integSnap = await orgRef.collection('settings').doc('integrations').get()
            const tokens = integSnap.data()?.googleCalendar
            if (tokens?.connected) {
              const apptOAuth = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                process.env.GOOGLE_REDIRECT_URI
              )
              apptOAuth.setCredentials({
                access_token: tokens.accessToken,
                refresh_token: tokens.refreshToken,
              })
              const calendar = google.calendar({ version: 'v3', auth: apptOAuth })
              const start = new Date(meetingData.scheduledAt)
              const end = new Date(start.getTime() + (meetingData.duration || 30) * 60000)

              const event = await calendar.events.insert({
                calendarId: 'primary',
                conferenceDataVersion: 1,
                requestBody: {
                  summary: `Reunión con ${senderName}`,
                  start: { dateTime: start.toISOString() },
                  end: { dateTime: end.toISOString() },
                  conferenceData: { createRequest: { requestId: `flowcrm-${apptRef.id}` } },
                }
              })

              const meetLink = event.data.conferenceData?.entryPoints?.[0]?.uri || ''
              if (meetLink) {
                await apptRef.update({ link: meetLink, googleEventId: event.data.id })
                reply = reply + `\n\nEnlace para tu videollamada: ${meetLink}`
                console.log(`[Zernio][${orgId}] Meet link generado: ${meetLink}`)
              }
            }
          } catch (calErr) {
            console.error(`[Zernio][${orgId}] Error Google Calendar:`, calErr.message)
          }

          console.log(`[Zernio][${orgId}] Meeting agendado para ${senderName}`)

          // Activar handoff automáticamente al agendar reunión
          await orgRef.collection('leads').doc(leadDocId).update({
            systemStage: 'handoff',
            systemStageAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }).catch(() => {})
          await orgRef.collection('alerts').add({
            type: 'handoff_ready',
            leadId: leadDocId,
            leadName: senderName || '',
            message: `${senderName} agendó una reunión — listo para vendedor`,
            seen: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }).catch(() => {})
          console.log(`[Zernio][${orgId}] Handoff activado por meeting agendado`)
        } catch (e) {
          console.error(`[Zernio][${orgId}] Error al crear meeting:`, e.message)
        }
      }
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
