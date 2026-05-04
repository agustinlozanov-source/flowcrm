// netlify/functions/get-org-analytics.js
// Calcula métricas de leads/conversaciones por organización para un periodo dado.
// Si no se mandan fechas, default = mes actual (UTC-6 México).
//
// Body: { orgIds?: string[], periodStart?: ISO string, periodEnd?: ISO string }
//   - Si orgIds está vacío o ausente → calcula TODAS las orgs activas.
//   - periodStart/periodEnd → timestamps ISO del rango [start, end).
//
// Retorna: { period, orgs: [ { orgId, orgName, plan, totals, byStage, previousPeriod } ] }
//
// Estructura Firestore esperada:
//   organizations/{orgId}/leads/{leadId}   — campos: createdAt, score, stageId, suggestHandoff, existingMeeting
//   organizations/{orgId}/conversations/{convId}  — campos: role ('user'|'assistant'), createdAt, leadId
//   organizations/{orgId}/pipeline_stages/{stageId} — campo: name

const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = admin.firestore()

const CORS = {
  'Access-Control-Allow-Origin':  process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna [startTs, endTs) del mes actual en UTC-6 como Timestamps de Firestore */
function currentMonthRange() {
  const now   = new Date()
  const mxNow = new Date(now.getTime() - 6 * 60 * 60 * 1000)
  const y = mxNow.getUTCFullYear()
  const m = mxNow.getUTCMonth() // 0-based
  return [
    admin.firestore.Timestamp.fromDate(new Date(Date.UTC(y, m, 1))),
    admin.firestore.Timestamp.fromDate(new Date(Date.UTC(y, m + 1, 1))),
  ]
}

/** Retorna [startTs, endTs) del mes anterior */
function previousMonthRange(startTs) {
  const d = startTs.toDate()
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() // 0-based, es el mes actual
  return [
    admin.firestore.Timestamp.fromDate(new Date(Date.UTC(y, m - 1, 1))),
    admin.firestore.Timestamp.fromDate(new Date(Date.UTC(y, m, 1))),
  ]
}

/** Clasifica lead por nº de mensajes entrantes */
function tempBucket(msgCount) {
  if (msgCount >= 16) return 'hot'
  if (msgCount >= 8)  return 'qualified'
  if (msgCount >= 4)  return 'warm'
  return 'cold'
}

/**
 * Calcula métricas para una sola org en un rango [startTs, endTs).
 * Retorna null si hay error (para que no rompa la respuesta completa).
 */
async function calcOrgMetrics(orgId, startTs, endTs) {
  try {
    const orgRef = db.collection('organizations').doc(orgId)

    // 1. Leads creados en el periodo
    const leadsSnap = await orgRef.collection('leads')
      .where('createdAt', '>=', startTs)
      .where('createdAt', '<',  endTs)
      .get()

    const leads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const leadsCount = leads.length

    if (leadsCount === 0) {
      return {
        leadsCount: 0,
        messagesIncoming: 0,
        avgMessagesPerLead: 0,
        handoffSuggested: 0,
        handoffRate: 0,
        meetingsScheduled: 0,
        meetingsRate: 0,
        avgScore: 0,
        topScore: 0,
        leadsCold: 0,
        leadsWarm: 0,
        leadsQualified: 0,
        leadsHot: 0,
        byStage: {},
      }
    }

    // 2. Métricas básicas directas del documento de lead
    let scoreSum   = 0
    let topScore   = 0
    let handoffs   = 0
    let meetings   = 0
    const stageCount = {}
    const leadIds  = []

    for (const lead of leads) {
      leadIds.push(lead.id)
      const s = typeof lead.score === 'number' ? lead.score : 0
      scoreSum += s
      if (s > topScore) topScore = s
      if (lead.suggestHandoff === true) handoffs++
      if (lead.existingMeeting) meetings++

      // Agrupar por stage — usamos stageId como key, luego resolvemos nombres
      const sId = lead.stageId || '__sin_stage__'
      stageCount[sId] = (stageCount[sId] || 0) + 1
    }

    // 3. Resolver nombres de stages
    let stagesMap = {}
    try {
      const stagesSnap = await orgRef.collection('pipeline_stages').get()
      stagesSnap.forEach(d => { stagesMap[d.id] = d.data().name || d.id })
    } catch { /* si no hay pipeline_stages, usamos los ids como nombres */ }

    const byStage = {}
    for (const [sId, count] of Object.entries(stageCount)) {
      const name = stagesMap[sId] || sId
      byStage[name] = count
    }

    // 4. Mensajes entrantes (role: 'user') para estos leads
    // Firestore no tiene JOIN — debemos consultar conversations filtrando por leadId
    // Para evitar 1 query por lead, consultamos conversations del periodo y filtramos por leadId en memoria.
    // Si hay >100 leads, esto puede ser costoso → limitamos a 500 docs por lead en el rango.
    let messagesIncoming = 0
    const msgsByLead = {}

    // Firestore 'in' acepta hasta 30 ids por query — particionamos
    const CHUNK = 30
    const leadIdSet = new Set(leadIds)

    for (let i = 0; i < leadIds.length; i += CHUNK) {
      const chunk = leadIds.slice(i, i + CHUNK)
      try {
        const convSnap = await orgRef.collection('conversations')
          .where('leadId', 'in', chunk)
          .where('role', '==', 'user')
          .get()
        convSnap.forEach(d => {
          const lid = d.data().leadId
          if (leadIdSet.has(lid)) {
            msgsByLead[lid] = (msgsByLead[lid] || 0) + 1
            messagesIncoming++
          }
        })
      } catch { /* conversations puede no existir o no tener leadId — skip */ }
    }

    // 5. Distribución cold/warm/qualified/hot
    let cold = 0, warm = 0, qualified = 0, hot = 0
    for (const lead of leads) {
      const msgs = msgsByLead[lead.id] || 0
      const bucket = tempBucket(msgs)
      if (bucket === 'cold')      cold++
      else if (bucket === 'warm') warm++
      else if (bucket === 'qualified') qualified++
      else hot++
    }

    return {
      leadsCount,
      messagesIncoming,
      avgMessagesPerLead: leadsCount > 0 ? Math.round((messagesIncoming / leadsCount) * 10) / 10 : 0,
      handoffSuggested: handoffs,
      handoffRate: leadsCount > 0 ? Math.round((handoffs / leadsCount) * 1000) / 1000 : 0,
      meetingsScheduled: meetings,
      meetingsRate: leadsCount > 0 ? Math.round((meetings / leadsCount) * 1000) / 1000 : 0,
      avgScore: leadsCount > 0 ? Math.round((scoreSum / leadsCount) * 10) / 10 : 0,
      topScore,
      leadsCold: cold,
      leadsWarm: warm,
      leadsQualified: qualified,
      leadsHot: hot,
      byStage,
    }
  } catch (err) {
    console.error(`[get-org-analytics] Error org ${orgId}:`, err.message)
    return null
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body || '{}') } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  // ── Rango del periodo ─────────────────────────────────────────────────────
  let startTs, endTs
  if (body.periodStart && body.periodEnd) {
    try {
      startTs = admin.firestore.Timestamp.fromDate(new Date(body.periodStart))
      endTs   = admin.firestore.Timestamp.fromDate(new Date(body.periodEnd))
    } catch {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'periodStart/periodEnd inválidos' }) }
    }
  } else {
    ;[startTs, endTs] = currentMonthRange()
  }

  const [prevStartTs, prevEndTs] = previousMonthRange(startTs)

  // ── Determinar orgs a calcular ────────────────────────────────────────────
  let orgIds = Array.isArray(body.orgIds) && body.orgIds.length > 0 ? body.orgIds : null
  let orgMeta = {} // orgId → { name, planId, planName, monthlyUSD, monthlyMXN, leadsIncluidos }

  if (!orgIds) {
    // Traer todas las orgs activas
    const orgsSnap = await db.collection('organizations').get()
    orgIds = []
    orgsSnap.forEach(d => {
      orgIds.push(d.id)
      const data = d.data()
      orgMeta[d.id] = {
        name: data.name || data.orgName || d.id,
        planId: data.planId || null,
        planName: data.planName || null,
        monthlyUSD: data.monthlyUSD || 0,
        monthlyMXN: data.monthlyMXN || 0,
        leadsIncluidos: data.leadsIncluidos || null,
      }
    })
  } else {
    // Traer solo las orgs solicitadas
    const orgSnaps = await Promise.all(orgIds.map(id => db.collection('organizations').doc(id).get()))
    orgSnaps.forEach(d => {
      if (d.exists) {
        const data = d.data()
        orgMeta[d.id] = {
          name: data.name || data.orgName || d.id,
          planId: data.planId || null,
          planName: data.planName || null,
          monthlyUSD: data.monthlyUSD || 0,
          monthlyMXN: data.monthlyMXN || 0,
          leadsIncluidos: data.leadsIncluidos || null,
        }
      }
    })
  }

  // ── Calcular métricas actuales y del periodo anterior en paralelo ─────────
  const [currentResults, prevResults] = await Promise.all([
    Promise.all(orgIds.map(id => calcOrgMetrics(id, startTs, endTs))),
    Promise.all(orgIds.map(id => calcOrgMetrics(id, prevStartTs, prevEndTs))),
  ])

  // ── Ensamblar respuesta ───────────────────────────────────────────────────
  const orgs = orgIds.map((orgId, i) => {
    const current = currentResults[i]
    const prev    = prevResults[i]
    const meta    = orgMeta[orgId] || { name: orgId }

    return {
      orgId,
      orgName: meta.name,
      plan: {
        id:             meta.planId,
        name:           meta.planName,
        monthlyUSD:     meta.monthlyUSD,
        monthlyMXN:     meta.monthlyMXN,
        leadsIncluidos: meta.leadsIncluidos,
      },
      totals: current,  // null si hubo error
      previousPeriod: prev ? {
        leadsCount:          prev.leadsCount,
        handoffRate:         prev.handoffRate,
        avgMessagesPerLead:  prev.avgMessagesPerLead,
        meetingsScheduled:   prev.meetingsScheduled,
        avgScore:            prev.avgScore,
      } : null,
    }
  })

  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      period: {
        start: startTs.toDate().toISOString(),
        end:   endTs.toDate().toISOString(),
      },
      previousPeriod: {
        start: prevStartTs.toDate().toISOString(),
        end:   prevEndTs.toDate().toISOString(),
      },
      orgs,
    }),
  }
}
