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
async function checkAndLockMessage(platformMsgId, orgId) {
  if (!platformMsgId) return false
  const lockKey = orgId ? `${orgId}_${platformMsgId}` : String(platformMsgId)
  const lockRef = db.collection('_global_msg_locks').doc(lockKey)
  try {
    const already = await db.runTransaction(async t => {
      const snap = await t.get(lockRef)
      if (snap.exists) {
        const ts = snap.data()?.ts?.toDate?.()
        if (ts && (Date.now() - ts.getTime()) > 5 * 60 * 1000) {
          t.set(lockRef, { ts: admin.firestore.FieldValue.serverTimestamp() })
          return false
        }
        return true
      }
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

  // Read org timezone
  let orgTimezone = 'America/Mexico_City'
  try {
    const orgSnap = await orgRef.get()
    orgTimezone = orgSnap.data()?.timezone || 'America/Mexico_City'
  } catch {}

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

  // Resources available for sharing
  let resourcesSection = ''
  let agentResources = []
  try {
    const resourcesSnap = await orgRef.collection('agent_resources').orderBy('createdAt', 'desc').get()
    agentResources = resourcesSnap.docs.map(d => d.data()).filter(r => r.url)
    const resources = agentResources
    if (resources.length) {
      resourcesSection = `\nRECURSOS DISPONIBLES PARA COMPARTIR:\nTienes estos recursos para compartir con el lead. Sigue ESTRICTAMENTE la instrucción de cuándo hacerlo. Nunca inventes URLs — usa EXACTAMENTE las que están aquí.\n${resources.map(r =>
        r.whenToShare
          ? `- [${(r.type || '').toUpperCase()}] "${r.name}" → Compartir cuando: ${r.whenToShare}. URL: ${r.url}`
          : `- [${(r.type || '').toUpperCase()}] "${r.name}": ${r.url}`
      ).join('\n')}`
    }
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
    timeZone: orgTimezone,
  })
  const horaActual = now.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
    timeZone: orgTimezone,
  })

  // Get UTC offset string for the org timezone (e.g. "-06:00")
  const tzOffset = (() => {
    try {
      const parts = new Intl.DateTimeFormat('en', { timeZone: orgTimezone, timeZoneName: 'shortOffset' })
        .formatToParts(now)
      const off = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-6'
      // Convert "GMT-6" or "GMT+5:30" to "-06:00" or "+05:30"
      const m = off.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
      if (!m) return '-06:00'
      const sign = m[1], h = m[2].padStart(2, '0'), min = (m[3] || '00')
      return `${sign}${h}:${min}`
    } catch { return '-06:00' }
  })()

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
${resourcesSection}

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
1. En tu respuesta confírmale la reunión y dile que recibirá el enlace en un momento
2. Al FINAL de tu JSON, después del campo "detectedPipelineId", agrega EXACTAMENTE esto en una línea separada:
MEETING_SCHEDULED: {"scheduledAt": "2026-04-16T18:00:00${tzOffset}", "duration": 30, "notes": "Demo Flow Hub"}

IMPORTANTE:
- Usa la fecha y hora que el lead confirmó
- El formato de scheduledAt es ISO 8601 con offset ${tzOffset} (zona horaria de la org) — SIEMPRE incluye el offset
- NO incluyas el enlace de Meet en tu respuesta — se enviará automáticamente como mensaje separado
- Solo emite MEETING_SCHEDULED cuando el lead haya confirmado fecha Y hora específicas
- Si solo dice "mañana" sin hora → pregunta la hora antes de agendar
`

  return { systemPrompt, scoringConfig, pipelineId, orgTimezone, agentResources }
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

          // Save score event
          await orgRef.collection('leads').doc(lead.id).collection('score_events').add({
            prevScore: lead.score || 0,
            newScore,
            delta,
            categories: parsed.scoring,
            source: 'whatsapp',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
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

// GET /meetings/auth/google?orgId=xxx&redirect=settings|meetings — Inicia flujo OAuth
app.get('/meetings/auth/google', (req, res) => {
  const { orgId, redirect = 'meetings' } = req.query
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: JSON.stringify({ orgId, redirect }),
  })
  res.redirect(url)
})

// GET /meetings/auth/google/callback — Recibe tokens y guarda en Firestore
app.get('/meetings/auth/google/callback', async (req, res) => {
  const { code, state: rawState } = req.query
  let orgId = rawState
  let redirect = 'meetings'
  try { const s = JSON.parse(rawState); orgId = s.orgId; redirect = s.redirect || 'meetings' } catch {}
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
    res.redirect(`https://flowhubcrm.app/${redirect}?google=connected`)
  } catch (err) {
    console.error('[Google OAuth] callback error:', err.message, err.response?.data)
    res.redirect(`https://flowhubcrm.app/${redirect}?google=error&msg=${encodeURIComponent(err.message)}`)
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
      const { systemPrompt, scoringConfig, orgTimezone: tz } = await buildModernSystemPrompt(orgRef, agentConfig, leadData, channel)
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

// ── ZERNIO WEBHOOK GLOBAL (1 request por mensaje, sin importar cuántas orgs) ──
app.post('/webhook/zernio', (req, res) => {
  res.sendStatus(200)
  const { event, message, account } = req.body
  const msgText = message?.text || message?.message || ''
  const incomingAccountId = account?.id || account?._id || ''

  console.log(`[Zernio/global] HIT — event: ${event} | account.id: ${incomingAccountId} | account keys: ${Object.keys(account || {}).join(',')} | body keys: ${Object.keys(req.body || {}).join(',')}`)

  if (event !== 'message.received' || !msgText) return
  if (!incomingAccountId) {
    console.log(`[Zernio/global] Sin account.id — account completo:`, JSON.stringify(account))
    return
  }

  setImmediate(async () => {
    const mapSnap = await db.collection('_zernio_account_map').doc(incomingAccountId).get().catch(() => null)
    if (!mapSnap || !mapSnap.exists) {
      console.log(`[Zernio/global] account ${incomingAccountId} sin org mapeada — buscando en integrations...`)
      // Fallback: buscar org que tenga la plataforma conectada
      // El accountId guardado puede ser distinto al que llega en el webhook (profileId vs accountId real)
      const rawP = message?.platform || account?.platform || ''
      function normP(p) {
        const v = String(p || '').toLowerCase()
        if (v.includes('facebook') || v.includes('messenger')) return 'facebook'
        if (v.includes('instagram')) return 'instagram'
        return 'whatsapp'
      }
      const incomingPlatform = normP(rawP)
      const orgsSnap = await db.collection('organizations').get().catch(() => null)
      if (orgsSnap) {
        for (const orgDoc of orgsSnap.docs) {
          const integSnap = await orgDoc.ref.collection('settings').doc('integrations').get().catch(() => null)
          const data = integSnap?.data()
          const ch = data?.[incomingPlatform]
          if (!ch?.connected) continue
          // Match por accountId exacto o por username
          const storedId = ch.accountId || ch.realAccountId || ''
          const storedUsername = ch.username || ''
          const storedZernioUsername = ch.zernioUsername || ''
          const incomingUsername = account?.username || ''
          const incomingDisplayName = account?.displayName || ''
          const isMatch = storedId === incomingAccountId ||
            (storedUsername && (incomingUsername === storedUsername || incomingDisplayName === storedUsername)) ||
            (storedZernioUsername && incomingUsername === storedZernioUsername)
          if (isMatch || (!storedId && ch.connected)) {
            console.log(`[Zernio/global] Fallback match: org ${orgDoc.id} (${incomingPlatform}) storedId=${storedId} username=${storedUsername} — escribiendo mapa con ID real`)
            // Actualizar Firestore con el accountId real que llega en el webhook
            await orgDoc.ref.collection('settings').doc('integrations').set({
              [incomingPlatform]: { accountId: incomingAccountId }
            }, { merge: true }).catch(() => {})
            await db.collection('_zernio_account_map').doc(incomingAccountId).set({
              orgId: orgDoc.id, platform: incomingPlatform,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true }).catch(() => {})
            processZernioMessage(req.body, orgDoc.id)
            return
          }
        }
      }
      console.log(`[Zernio/global] account ${incomingAccountId} sin org mapeada en ningún lado`)
      return
    }
    const orgId = mapSnap.data().orgId
    console.log(`[Zernio/global] → org ${orgId}`)
    processZernioMessage(req.body, orgId)
  })
})

// ── PROCESAR MENSAJE ZERNIO (función compartida entre endpoint global y per-org) ──
async function processZernioMessage(body, orgId) {
  const { event, message, conversation, account } = body

  const msgText = message?.text || message?.message || ''
  const senderId = message?.sender?.id || message?.senderId || ''
  const senderName = message?.sender?.name || message?.senderName || 'Sin nombre'
  const phoneNumber = message?.sender?.phoneNumber || message?.senderPhone || ''
  const rawPlatform = message?.platform || account?.platform || ''
  const conversationId = conversation?.id || conversation?._id || message?.conversationId || ''
  const text = msgText

  function normalizePlatform(p) {
    if (!p) return 'whatsapp'
    const v = String(p).toLowerCase()
    if (v.includes('facebook') || v.includes('messenger') || v === 'fb') return 'messenger'
    if (v.includes('instagram') || v === 'ig') return 'instagram'
    if (v.includes('whatsapp') || v === 'wa') return 'whatsapp'
    return v
  }
  const platform = normalizePlatform(rawPlatform)
  const leadDocId = (phoneNumber || '').replace(/\D/g, '') || senderId

  const orgRef = db.collection('organizations').doc(orgId)

    // Guard: leadDocId no puede ser vacío
    if (!leadDocId) {
      console.error(`[Zernio][${orgId}] leadDocId vacío — abortando.`)
      return
    }

    const leadRef = orgRef.collection('leads').doc(leadDocId)

    console.log(`[Zernio] sender.id: ${senderId} | phoneNumber: ${phoneNumber} | leadDocId: ${leadDocId} | platform: ${platform}`)
    console.log(`[Zernio] message keys: ${Object.keys(message || {}).join(',')}`)
    console.log(`[Zernio] message.sender:`, JSON.stringify(message?.sender || message?.senderName || 'n/a'))
    console.log(`[Zernio] Escribiendo en Firestore: organizations/${orgId}/leads/${leadDocId}`)
    console.log(`[Zernio] Firebase project: ${process.env.FIREBASE_PROJECT_ID}`)

    // 1. Guardar / actualizar lead
    try {
      const existingSnap = await leadRef.get()
      if (!existingSnap.exists) {
        // Obtener pipeline y etapa por defecto
        let defaultPipelineId = null
        let stageId = null
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
          console.error(`[Zernio][${orgId}] Error al obtener pipeline por defecto:`, pipeErr.message)
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
          ...(conversationId && { zernioConversationId: conversationId }),
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
          followUpCount: 0,
          ...(conversationId && { zernioConversationId: conversationId }),
          // Si estaba cold y volvió a escribir, reactivar
          ...(existingSnap.data().systemStage === 'cold' ? {
            systemStage: admin.firestore.FieldValue.delete(),
            coldAt: admin.firestore.FieldValue.delete(),
            reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
          } : {}),
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
    let agentResources = []
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
    if (platformMsgId && await checkAndLockMessage(platformMsgId, orgId)) {
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
      agentResources = built.agentResources || []
      console.log(`[Zernio][${orgId}] System prompt construido — ${systemPrompt.length} chars`)
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 6 (buildPrompt):`, err.message)
      return
    }

    // 7. Claude responde
    let reply = null
    let videoUrlsToSend = []
    let meetLinkToSend = null
    try {
      console.log(`[Zernio][${orgId}] Llamando a Claude...`)
      const response = await callClaudeWithRetry({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      })
      const rawReply = response.content[0].text
      const { visibleReply, detectedPipelineId } = await parseAndUpdateScore(orgRef, leadData, rawReply, scoringConfig)
      reply = visibleReply
      console.log(`[Zernio][${orgId}] Respuesta: "${reply}"`)

      // Detectar URLs de videos en la respuesta y separarlas para enviarlas como media
      if (agentResources.length && reply) {
        for (const resource of agentResources) {
          if ((resource.type === 'video') && resource.url && reply.includes(resource.url)) {
            videoUrlsToSend.push(resource.url)
            reply = reply.replace(resource.url, '').replace(/\s{2,}/g, ' ').trim()
          }
        }
      }

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
              // Forzar refresh del token si está por vencer
              apptOAuth.on('tokens', async (newTokens) => {
                if (newTokens.access_token) {
                  await orgRef.collection('settings').doc('integrations').set({
                    googleCalendar: { accessToken: newTokens.access_token, expiryDate: newTokens.expiry_date }
                  }, { merge: true }).catch(() => {})
                }
              })
              const calendar = google.calendar({ version: 'v3', auth: apptOAuth })
              const start = new Date(meetingData.scheduledAt)
              const end = new Date(start.getTime() + (meetingData.duration || 30) * 60000)

              const event = await calendar.events.insert({
                calendarId: 'primary',
                conferenceDataVersion: 1,
                requestBody: {
                  summary: `Reunión con ${senderName}`,
                  start: { dateTime: start.toISOString(), timeZone: tz || 'America/Mexico_City' },
                  end: { dateTime: end.toISOString(), timeZone: tz || 'America/Mexico_City' },
                  conferenceData: { createRequest: { requestId: `flowcrm-${apptRef.id}` } },
                }
              })

              // A veces Google tarda en generar el conferenceData — reintentar hasta 3 veces
              let meetLink = event.data.conferenceData?.entryPoints?.[0]?.uri || ''
              if (!meetLink) {
                for (let attempt = 0; attempt < 3; attempt++) {
                  await new Promise(r => setTimeout(r, 2000))
                  const ev2 = await calendar.events.get({ calendarId: 'primary', eventId: event.data.id })
                  meetLink = ev2.data.conferenceData?.entryPoints?.[0]?.uri || ''
                  if (meetLink) break
                }
              }

              if (meetLink) {
                await apptRef.update({ link: meetLink, googleEventId: event.data.id })
                // Se enviará como mensaje separado después del reply principal
                meetLinkToSend = meetLink
                console.log(`[Zernio][${orgId}] Meet link generado: ${meetLink}`)
              } else {
                console.warn(`[Zernio][${orgId}] Meet link no disponible después de reintentos`)
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
      // Leer accountId del canal del cliente desde Firestore
      const integSnap = await orgRef.collection('settings').doc('integrations').get()
      const integData = integSnap.data()
      // Prioritize account.id from webhook payload (real inbox account ID)
      // Firestore stores the OAuth profileId which is different and invalid for API calls
      const clientAccountId =
        account?.id || account?._id ||
        (platform === 'whatsapp' && integData?.whatsapp?.accountId) ||
        (platform === 'messenger' && integData?.facebook?.accountId) ||
        (platform === 'facebook' && integData?.facebook?.accountId) ||
        (platform === 'instagram' && integData?.instagram?.accountId)

      console.log(`[Zernio][${orgId}] Enviando respuesta a Zernio API — conversationId: ${conversationId}, accountId: ${clientAccountId}`)
      const zernioResponse = await axios.post(
        `https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`,
        {
          accountId: clientAccountId,
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

      // Enviar videos como mensajes de media separados
      for (const videoUrl of videoUrlsToSend) {
        await new Promise(r => setTimeout(r, 600))
        await axios.post(
          `https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`,
          { accountId: clientAccountId, mediaUrl: videoUrl, mediaType: 'video' },
          { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`, 'Content-Type': 'application/json' } }
        ).catch(e => console.error(`[Zernio][${orgId}] Error enviando video:`, e.message))
        console.log(`[Zernio][${orgId}] Video enviado como media: ${videoUrl}`)
      }

      // Enviar meet link como mensaje separado si fue agendado
      if (meetLinkToSend) {
        await new Promise(r => setTimeout(r, 800)) // pequeña pausa para que llegue en orden
        await axios.post(
          `https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`,
          { accountId: clientAccountId, message: `🔗 Enlace para tu videollamada:\n${meetLinkToSend}` },
          { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`, 'Content-Type': 'application/json' } }
        ).catch(e => console.error(`[Zernio][${orgId}] Error enviando meet link separado:`, e.message))
        console.log(`[Zernio][${orgId}] Meet link enviado como mensaje separado`)
      }
    } catch (err) {
      console.error(`[Zernio][${orgId}] ERROR paso 8 (Zernio API):`, err.response?.data || err.message)
    }

    console.log(`[Zernio][${orgId}] ✓ Flujo completo para ${senderName} (${leadDocId})`)
}

// ── ZERNIO WEBHOOK PER-ORG (legacy — mantiene compatibilidad con webhooks ya registrados) ──
app.post('/webhook/zernio/:orgId', (req, res) => {
  res.sendStatus(200)
  const { event, message, account } = req.body
  const { orgId } = req.params
  const msgText = message?.text || message?.message || ''
  if (event !== 'message.received' || !msgText) return
  const incomingAccountId = account?.id || account?._id || ''
  const rawPlatform = message?.platform || account?.platform || ''
  const platformKey = rawPlatform === 'instagram' ? 'instagram' : rawPlatform === 'whatsapp' ? 'whatsapp' : 'facebook'

  setImmediate(async () => {
    console.log(`[Zernio/legacy][${orgId}] HIT — platform: ${rawPlatform} | account.id: ${incomingAccountId} | account:`, JSON.stringify(account))
    // Si el mapa ya tiene este account.id asignado a otra org, ignorar
    if (incomingAccountId) {
      const mapSnap = await db.collection('_zernio_account_map').doc(incomingAccountId).get().catch(() => null)
      if (mapSnap && mapSnap.exists && mapSnap.data().orgId !== orgId) {
        console.log(`[Zernio/legacy][${orgId}] Ignorado — account ${incomingAccountId} pertenece a org ${mapSnap.data().orgId}`)
        return
      }
    }
    // Solo procesar si esta org tiene esa plataforma conectada
    const integSnap = await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').get().catch(() => null)
    if (!integSnap || integSnap.data()?.[platformKey]?.connected !== true) {
      console.log(`[Zernio/legacy][${orgId}] Ignorado — ${platformKey} no conectado — integrations:`, JSON.stringify(integSnap?.data()))
      return
    }
    // Actualizar mapa con el account.id real
    if (incomingAccountId) {
      db.collection('_zernio_account_map').doc(incomingAccountId).set({
        orgId, platform: rawPlatform,
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {})
    }
    console.log(`[Zernio/legacy][${orgId}] Procesando mensaje`)
    processZernioMessage(req.body, orgId)
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

// ── OAuth de canales (WhatsApp / Facebook / Instagram) via Zernio ─────────────
const APP_URL = 'https://flowhubcrm.app'
const RAILWAY_URL = 'https://flowcrm-production-6d63.up.railway.app'

// POST /admin/backfill-account-map?secret=xxx
// Lee todas las orgs con canales conectados y escribe _zernio_account_map sin que el cliente reconecte
app.post('/admin/backfill-account-map', async (req, res) => {
  const { secret } = req.query
  if (secret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const orgsSnap = await db.collection('organizations').get()
    const results = []
    for (const orgDoc of orgsSnap.docs) {
      const integSnap = await orgDoc.ref.collection('settings').doc('integrations').get().catch(() => null)
      if (!integSnap || !integSnap.exists) continue
      const data = integSnap.data()
      for (const platform of ['facebook', 'instagram', 'whatsapp']) {
        const ch = data?.[platform]
        if (ch?.connected && ch?.accountId) {
          await db.collection('_zernio_account_map').doc(ch.accountId).set({
            orgId: orgDoc.id,
            platform,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true })
          results.push({ orgId: orgDoc.id, platform, accountId: ch.accountId })
          console.log(`[backfill] ${platform} → org ${orgDoc.id} accountId ${ch.accountId}`)
        }
      }
    }
    res.json({ ok: true, mapped: results })
  } catch (err) {
    console.error('[backfill]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /admin/zernio-accounts?secret=xxx&platform=whatsapp|facebook|instagram
// Devuelve los canales conectados en Zernio para seleccionar el account.id correcto
app.get('/admin/zernio-accounts', async (req, res) => {
  const { secret, platform = 'whatsapp' } = req.query
  if (secret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  try {
    let accounts = []
    if (platform === 'whatsapp') {
      const r = await axios.get('https://zernio.com/api/v1/whatsapp/phone-numbers', {
        headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` }
      })
      accounts = (r.data.numbers || r.data.phoneNumbers || []).map(n => ({
        id: n._id || n.id,
        label: n.phoneNumber || n.name || n._id,
        status: n.metaVerificationStatus || n.status || '',
        extra: n.profileName || '',
      }))
    } else {
      // Facebook / Instagram — listar accounts del perfil
      const r = await axios.get('https://zernio.com/api/v1/accounts', {
        headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` }
      })
      const all = r.data.accounts || r.data || []
      accounts = all
        .filter(a => !platform || (a.platform || '').toLowerCase().includes(platform === 'facebook' ? 'messenger' : platform))
        .map(a => ({
          id: a._id || a.id,
          label: a.name || a.username || a._id,
          status: a.status || '',
          extra: a.platform || '',
        }))
    }
    res.json({ accounts })
  } catch (err) {
    console.error('[Admin zernio-accounts]', err.response?.data || err.message)
    res.status(500).json({ error: err.message, detail: err.response?.data })
  }
})

// POST /admin/map-account — mapeo manual de account.id → orgId (para WhatsApp conectado desde Zernio dashboard)
// Body: { secret, orgId, accountId, platform, phoneNumber }
app.post('/admin/map-account', async (req, res) => {
  const { secret, orgId, accountId, platform = 'whatsapp', phoneNumber } = req.body
  if (secret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  if (!orgId || !accountId) return res.status(400).json({ error: 'Missing orgId or accountId' })
  try {
    // 1. Mapear en _zernio_account_map
    await db.collection('_zernio_account_map').doc(accountId).set({
      orgId,
      platform,
      ...(phoneNumber && { phoneNumber }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    // 2. Activar integración en Firestore de la org
    await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').set({
        [platform]: {
          accountId,
          ...(phoneNumber && { phoneNumber }),
          connected: true,
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      }, { merge: true })

    console.log(`[Admin] Mapeado account ${accountId} → org ${orgId} (${platform})`)
    res.json({ success: true, accountId, orgId, platform })
  } catch (err) {
    console.error('[Admin map-account] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /admin/assign-number — admin pre-asigna un número a una org para el embedded signup
// Body: { secret, orgId, phoneNumber, metaPreverifiedId }
app.post('/admin/assign-number', async (req, res) => {
  const { secret, orgId, phoneNumber, metaPreverifiedId } = req.body
  if (secret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  if (!orgId || !phoneNumber || !metaPreverifiedId) return res.status(400).json({ error: 'Missing orgId, phoneNumber or metaPreverifiedId' })
  try {
    await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').set({
        whatsapp: {
          assignedNumber: phoneNumber,
          metaPreverifiedId,
          status: 'assigned',
          connected: false,
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      }, { merge: true })
    console.log(`[Admin] Número ${phoneNumber} asignado a org ${orgId}`)
    res.json({ success: true, orgId, phoneNumber, metaPreverifiedId })
  } catch (err) {
    console.error('[Admin assign-number] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /whatsapp/sdk-config?orgId=xxx — devuelve appId, configId y metaPreverifiedId al frontend
app.get('/whatsapp/sdk-config', async (req, res) => {
  const { orgId } = req.query
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })
  try {
    // Obtener metaPreverifiedId desde Firestore
    const integSnap = await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').get()
    const whatsappData = integSnap.exists ? integSnap.data()?.whatsapp : null
    const metaPreverifiedId = whatsappData?.metaPreverifiedId
    const phoneNumber = whatsappData?.assignedNumber
    if (!metaPreverifiedId) return res.status(400).json({ error: 'No hay número asignado para esta org. Contacta al administrador.' })

    // Obtener appId y configId desde Zernio
    const r = await axios.get('https://zernio.com/api/v1/connect/whatsapp/sdk-config', {
      headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` }
    })
    const { appId, configId } = r.data
    res.json({ appId, configId, metaPreverifiedId, phoneNumber })
  } catch (err) {
    console.error('[WhatsApp sdk-config] Error:', err.response?.data || err.message)
    res.status(500).json({ error: err.message, detail: err.response?.data })
  }
})

// POST /whatsapp/embedded-signup — completa la conexión de WhatsApp via FB SDK
// Body: { orgId, code, wabaId, phoneNumberId }
app.post('/whatsapp/embedded-signup', async (req, res) => {
  const { orgId, code, wabaId, phoneNumberId } = req.body
  if (!orgId || !code) return res.status(400).json({ error: 'Missing orgId or code' })
  try {
    const integSnap = await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').get()
    const profileId = integSnap.data()?.zernio?.profileId || process.env.ZERNIO_PROFILE_ID
    const assignedNumber = integSnap.data()?.whatsapp?.assignedNumber

    // Llamar a Zernio embedded-signup
    const r = await axios.post('https://zernio.com/api/v1/connect/whatsapp/embedded-signup', {
      code,
      profileId,
      wabaId,
      phoneNumberId,
      isCoexistence: false,
    }, { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`, 'Content-Type': 'application/json' } })

    const accountId = r.data?.account?._id || r.data?.accountId || r.data?.account?.id

    // Mapear en _zernio_account_map
    if (accountId) {
      await db.collection('_zernio_account_map').doc(accountId).set({
        orgId,
        platform: 'whatsapp',
        phoneNumber: assignedNumber,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }

    // Marcar org como conectada
    await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').set({
        whatsapp: {
          accountId,
          connected: true,
          status: 'connected',
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      }, { merge: true })

    console.log(`[WhatsApp embedded-signup] Org ${orgId} conectada. Account: ${accountId}`)
    res.json({ success: true, accountId, orgId })
  } catch (err) {
    console.error('[WhatsApp embedded-signup] Error:', err.response?.data || err.message)
    res.status(500).json({ error: err.message, detail: err.response?.data })
  }
})

// POST /zernio/create-profile
app.post('/zernio/create-profile', async (req, res) => {
  const { orgId, orgName } = req.body
  if (!orgId || !orgName) return res.status(400).json({ error: 'Missing orgId or orgName' })
  try {
    const response = await axios.post('https://zernio.com/api/v1/profiles', {
      name: orgName,
      description: 'Flow Hub CRM',
    }, {
      headers: {
        Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
        'Content-Type': 'application/json',
      }
    })
    const profileId = response.data.profile._id
    await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').set({
        zernio: {
          profileId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      }, { merge: true })
    console.log(`[Zernio] Perfil creado para org ${orgId}: ${profileId}`)
    res.json({ success: true, profileId })
  } catch (err) {
    console.error('[Zernio] Error creando perfil:', err.response?.data || err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /whatsapp/purchase-number
app.post('/whatsapp/purchase-number', async (req, res) => {
  const { orgId } = req.body
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })

  let profileId = process.env.ZERNIO_PROFILE_ID // fallback

  try {
    const integSnap = await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').get()
    if (integSnap.exists && integSnap.data()?.zernio?.profileId) {
      profileId = integSnap.data().zernio.profileId
    }
    console.log(`[WhatsApp] Comprando número para org ${orgId} con profileId ${profileId}`)
  } catch (err) {
    console.error('[WhatsApp] Error leyendo Firestore:', err.message)
    // Continúa con el fallback
  }

  try {
    const response = await axios.post(
      'https://zernio.com/api/v1/whatsapp/phone-numbers/purchase',
      { profileId, country: 'US' },
      { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`, 'Content-Type': 'application/json' } }
    )
    const number = response.data.phoneNumber

    await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').set({
        whatsapp: {
          pendingNumberId: number.id,
          pendingPhoneNumber: number.phoneNumber,
          connected: false,
          purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      }, { merge: true })

    console.log(`[WhatsApp] Número guardado en Firestore: ${number.phoneNumber} para org ${orgId}`)
    res.json({ success: true, number })
  } catch (err) {
    console.error('[WhatsApp] Error comprando número:', err.response?.data)
    res.status(500).json({ error: err.message, detail: err.response?.data })
  }
})

// GET /whatsapp/number-status/:numberId
app.get('/whatsapp/number-status/:numberId', async (req, res) => {
  const { numberId } = req.params
  try {
    const response = await axios.get(
      'https://zernio.com/api/v1/whatsapp/phone-numbers',
      { headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` } }
    )
    const number = response.data.numbers.find(n => n._id === numberId || n.id === numberId)
    if (!number) return res.status(404).json({ error: 'Number not found' })
    res.json({
      verified: number.metaVerificationStatus === 'verified',
      status: number.metaVerificationStatus,
      phoneNumber: number.phoneNumber,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /whatsapp/activate-number
// Llámalo desde el frontend cuando el número esté listo (verified).
// Busca el account.id real en Zernio, lo mapea en _zernio_account_map y activa la integración.
app.post('/whatsapp/activate-number', async (req, res) => {
  const { orgId, numberId } = req.body
  if (!orgId || !numberId) return res.status(400).json({ error: 'Missing orgId or numberId' })

  try {
    // 1. Buscar el número en Zernio para obtener account.id real
    const numbersRes = await axios.get('https://zernio.com/api/v1/whatsapp/phone-numbers', {
      headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` }
    })
    const number = (numbersRes.data.numbers || []).find(n => n._id === numberId || n.id === numberId)
    if (!number) return res.status(404).json({ error: 'Number not found in Zernio' })

    if (number.metaVerificationStatus !== 'verified') {
      return res.status(400).json({ error: 'Number not verified yet', status: number.metaVerificationStatus })
    }

    // El account.id real puede venir en distintos campos según Zernio
    const realAccountId = number.accountId || number.account?.id || number._id || numberId

    // 2. Mapear en _zernio_account_map
    await db.collection('_zernio_account_map').doc(realAccountId).set({
      orgId,
      platform: 'whatsapp',
      phoneNumber: number.phoneNumber,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    // 3. Activar integración en Firestore
    await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').set({
        whatsapp: {
          accountId: realAccountId,
          phoneNumber: number.phoneNumber,
          pendingNumberId: numberId,
          connected: true,
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      }, { merge: true })

    // 4. Registrar webhook global si aún no existe
    try {
      const existingRes = await axios.get('https://zernio.com/api/v1/webhooks/settings', {
        headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` }
      })
      const globalUrl = `${RAILWAY_URL}/webhook/zernio`
      const alreadyExists = (existingRes.data?.webhooks || []).some(w => w.url === globalUrl)
      if (!alreadyExists) {
        await axios.post('https://zernio.com/api/v1/webhooks/settings', {
          name: 'FlowCRM Global Webhook',
          url: globalUrl,
          events: ['message.received'],
          isActive: true,
        }, {
          headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`, 'Content-Type': 'application/json' }
        })
        console.log(`[WhatsApp Activate] Webhook global registrado`)
      }
    } catch (webhookErr) {
      console.error('[WhatsApp Activate] Error registrando webhook:', webhookErr.response?.data || webhookErr.message)
    }

    console.log(`[WhatsApp Activate] Número activado para org ${orgId} — accountId: ${realAccountId}`)
    res.json({ success: true, accountId: realAccountId, phoneNumber: number.phoneNumber })
  } catch (err) {
    console.error('[WhatsApp Activate] Error:', err.response?.data || err.message)
    res.status(500).json({ error: err.message, detail: err.response?.data })
  }
})

function registerChannelOAuth(app, platform) {
  app.get(`/${platform}/connect`, async (req, res) => {
    const { orgId } = req.query
    if (!orgId) return res.status(400).send('Missing orgId')
    try {
      const integSnap = await db.collection('organizations').doc(orgId)
        .collection('settings').doc('integrations').get()
      const integData = integSnap.data() || {}
      const profileId = integData?.zernio?.profileId || process.env.ZERNIO_PROFILE_ID

      // Si es WhatsApp y hay número pre-asignado, pasarlo a Zernio para que Meta lo muestre
      const params = {
        profileId,
        redirect_url: `${RAILWAY_URL}/${platform}/callback?orgId=${orgId}`
      }
      if (platform === 'whatsapp' && integData?.whatsapp?.metaPreverifiedId) {
        params.phone_number_id = integData.whatsapp.metaPreverifiedId
        console.log(`[WhatsApp Connect] Pasando phone_number_id: ${params.phone_number_id} para org ${orgId}`)
      }

      const response = await axios.get(`https://zernio.com/api/v1/connect/${platform}`, {
        params,
        headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` }
      })
      res.redirect(response.data.authUrl)
    } catch (err) {
      console.error(`[${platform} Connect]`, err.response?.data || err.message)
      res.redirect(`${APP_URL}/settings?${platform}=error`)
    }
  })

  app.get(`/${platform}/callback`, async (req, res) => {
    console.log(`[${platform} Callback] Query params:`, JSON.stringify(req.query))
    const { orgId, error } = req.query
    const accountId = req.query.accountId || req.query.account_id || req.query.profileId || req.query.id || req.query.code
    const username = req.query.username || null
    if (error || !accountId || !orgId) {
      console.error(`[${platform} Callback] Faltan parámetros — accountId: ${accountId}, orgId: ${orgId}, error: ${error}`)
      return res.redirect(`${APP_URL}/settings?${platform}=error`)
    }
    try {
      const orgRef = db.collection('organizations').doc(orgId)

      // 1. Leer profileId del cliente
      const integSnap = await orgRef.collection('settings').doc('integrations').get()
      const profileId = integSnap.data()?.zernio?.profileId || process.env.ZERNIO_PROFILE_ID

      // 1b. Consultar Zernio para obtener el account.id REAL (distinto al profileId del OAuth)
      //     El webhook siempre llega con el id real, no con el profileId del callback
      let realAccountId = accountId
      try {
        const r = await axios.get('https://zernio.com/api/v1/accounts', {
          headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` }
        })
        const all = r.data.accounts || r.data || []
        const platformFilter = platform === 'facebook' ? 'messenger' : platform
        const match = all.find(a =>
          (a.platform || '').toLowerCase().includes(platformFilter) &&
          (a._id === accountId || a.id === accountId ||
           (username && (a.username === username || a.name === username || a.displayName === username)))
        )
        if (match) {
          realAccountId = match._id || match.id || accountId
          console.log(`[${platform} Callback] ID real encontrado en Zernio: ${realAccountId} (callback recibió: ${accountId})`)
        } else {
          // Tomar el más reciente del mismo platform como fallback
          const latestForPlatform = all
            .filter(a => (a.platform || '').toLowerCase().includes(platformFilter))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
          if (latestForPlatform) {
            realAccountId = latestForPlatform._id || latestForPlatform.id || accountId
            console.log(`[${platform} Callback] Fallback al más reciente: ${realAccountId}`)
          }
        }
      } catch (apiErr) {
        console.error(`[${platform} Callback] No se pudo consultar Zernio accounts:`, apiErr.message)
        // Continúa con el accountId original del callback
      }

      // 2. Guardar ambos IDs en Firestore (profileId del callback + accountId real de Zernio)
      await orgRef.collection('settings').doc('integrations').set({
        [platform]: {
          accountId: realAccountId,
          profileId: accountId, // guardar el original también por referencia
          ...(username && { username }),
          ...(req.query.username && { zernioUsername: req.query.username }),
          connected: true,
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      }, { merge: true })

      // 2b. Mapear el ID REAL → orgId en _zernio_account_map
      await db.collection('_zernio_account_map').doc(realAccountId).set({
        orgId,
        platform,
        username: req.query.username || username || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      // También mapear el profileId original por si acaso
      if (realAccountId !== accountId) {
        await db.collection('_zernio_account_map').doc(accountId).set({
          orgId, platform,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true })
      }
      console.log(`[${platform}] _zernio_account_map registrado — realAccountId: ${realAccountId} → org: ${orgId}`)

      // 3. Registrar webhook global (una sola vez — idempotente por nombre)
      // El account.id real se mapea automáticamente cuando llega el primer webhook
      try {
        const existingRes = await axios.get('https://zernio.com/api/v1/webhooks/settings', {
          headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` }
        })
        const globalUrl = `${RAILWAY_URL}/webhook/zernio`
        const alreadyExists = (existingRes.data?.webhooks || []).some(w => w.url === globalUrl)
        if (!alreadyExists) {
          await axios.post('https://zernio.com/api/v1/webhooks/settings', {
            name: 'FlowCRM Global Webhook',
            url: globalUrl,
            events: ['message.received'],
            isActive: true,
          }, {
            headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`, 'Content-Type': 'application/json' }
          })
          console.log(`[${platform}] Webhook global registrado: ${globalUrl}`)
        } else {
          console.log(`[${platform}] Webhook global ya existe — skipped`)
        }
      } catch (webhookErr) {
        console.error(`[${platform}] Error registrando webhook global:`, webhookErr.response?.data || webhookErr.message)
      }

      console.log(`[${platform}] Conectado para org ${orgId} — accountId: ${accountId}`)
      res.redirect(`${APP_URL}/settings?${platform}=connected`)
    } catch (err) {
      console.error(`[${platform} Callback]`, err.message)
      res.redirect(`${APP_URL}/settings?${platform}=error`)
    }
  })
}

registerChannelOAuth(app, 'whatsapp')
registerChannelOAuth(app, 'facebook')
registerChannelOAuth(app, 'instagram')

// ── FOLLOW-UP CRON — corre cada 5 minutos ──────────────────────────────────
async function runFollowUpCron() {
  try {
    const orgsSnap = await db.collection('organizations').get()
    for (const orgDoc of orgsSnap.docs) {
      const orgId = orgDoc.id

      // Leer config del agente
      const agentSnap = await orgDoc.ref.collection('settings').doc('agent').get().catch(() => null)
      if (!agentSnap || !agentSnap.exists) continue
      const agentConfig = agentSnap.data()
      const followUp = agentConfig?.followUp
      if (!followUp?.enabled) continue

      const delayMs = (followUp.delayMinutes || 60) * 60 * 1000
      const maxFollowUps = followUp.maxFollowUps || 1

      // Buscar leads activos (no handoff, no systemStage, no discarded) con lastMessageAt vencido
      const cutoff = new Date(Date.now() - delayMs)
      const leadsSnap = await orgDoc.ref.collection('leads')
        .where('hasUnread', '==', false)
        .where('lastMessageAt', '<=', cutoff)
        .get().catch(() => null)
      if (!leadsSnap) continue

      for (const leadDoc of leadsSnap.docs) {
        const lead = leadDoc.data()

        // Skip: ya en systemStage (handoff, cold, etc) o descartado
        if (lead.systemStage || lead.discarded) continue
        // Skip: último mensaje fue del agente (no del usuario) — verificar rol
        const lastConvSnap = await leadDoc.ref.collection('conversations')
          .orderBy('createdAt', 'desc').limit(1).get().catch(() => null)
        if (!lastConvSnap || lastConvSnap.empty) continue
        const lastMsg = lastConvSnap.docs[0].data()
        if (lastMsg.role !== 'user') continue // ya respondimos, esperar al lead

        const followUpCount = lead.followUpCount || 0

        if (followUpCount >= maxFollowUps) {
          // Máximo alcanzado — mover a cold
          await leadDoc.ref.update({
            systemStage: 'cold',
            coldAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }).catch(() => {})
          console.log(`[FollowUp][${orgId}] Lead ${leadDoc.id} movido a cold — ${followUpCount} follow-ups sin respuesta`)
          continue
        }

        // Generar follow-up con Claude
        try {
          // Leer historial
          const histSnap = await leadDoc.ref.collection('conversations')
            .orderBy('createdAt', 'asc').limitToLast(10).get().catch(() => null)
          const messages = (histSnap?.docs || []).map(d => ({
            role: (d.data().role === 'assistant' || d.data().role === 'bot') ? 'assistant' : 'user',
            content: d.data().text || d.data().content || '',
          })).filter(m => m.content)

          const systemPrompt = await buildModernSystemPrompt(orgDoc.ref, agentConfig, lead, lead.channel || lead.source || 'whatsapp').catch(() => null)
          if (!systemPrompt) continue

          const response = await callClaudeWithRetry({
            model: 'claude-opus-4-5',
            max_tokens: 300,
            system: systemPrompt + '\n\nIMPORTANTE: El lead no ha respondido en un tiempo. Genera un mensaje de seguimiento breve, natural y contextual basado en la conversación anterior. No seas insistente. Máximo 2 oraciones.',
            messages,
          })

          const followUpText = response.content[0].text

          // Guardar en conversations
          await leadDoc.ref.collection('conversations').add({
            role: 'assistant',
            text: followUpText,
            content: followUpText,
            channel: lead.channel || lead.source || 'whatsapp',
            isFollowUp: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })

          // Actualizar contador
          await leadDoc.ref.update({
            followUpCount: (followUpCount + 1),
            lastFollowUpAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })

          // Enviar por Zernio
          const platform = lead.channel || lead.source || 'whatsapp'
          const integSnap = await orgDoc.ref.collection('settings').doc('integrations').get().catch(() => null)
          const integData = integSnap?.data()
          const platformKey = platform === 'messenger' ? 'facebook' : platform
          const clientAccountId = integData?.[platformKey]?.accountId
          const conversationId = lead.zernioConversationId

          if (clientAccountId && conversationId) {
            await axios.post('https://zernio.com/api/v1/messages', {
              conversationId,
              accountId: clientAccountId,
              message: { text: followUpText },
            }, {
              headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`, 'Content-Type': 'application/json' }
            }).catch(e => console.error(`[FollowUp][${orgId}] Error Zernio send:`, e.response?.data || e.message))
          }

          console.log(`[FollowUp][${orgId}] Follow-up #${followUpCount + 1} enviado a lead ${leadDoc.id} (${lead.name})`)
        } catch (err) {
          console.error(`[FollowUp][${orgId}] Error generando follow-up para ${leadDoc.id}:`, err.message)
        }
      }
    }
  } catch (err) {
    console.error('[FollowUp Cron] Error global:', err.message)
  }
}

// Correr cada 5 minutos
setInterval(runFollowUpCron, 5 * 60 * 1000)
// Primera ejecución al arrancar (con delay de 1 min para dar tiempo al init)
setTimeout(runFollowUpCron, 60 * 1000)

app.listen(process.env.PORT || 3000, () => console.log('ManyChat integration running'))
