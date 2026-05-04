// netlify/functions/get-org-analytics.js
// Calcula metricas de leads/conversaciones/appointments por organizacion.
//
// ESTRUCTURA REAL DE FIRESTORE (verificada 2026-05-04):
//   organizations/{orgId}/leads/{leadId}
//     campos: score (int), stageId (string), pipelineId, createdAt, channel, name, phone
//     NO existe: existingMeeting, suggestedHandoff, pipelineStage
//
//   organizations/{orgId}/leads/{leadId}/conversations/{msgId}  <- SUBCOLLECCION del lead
//     campos: role ('user'|'assistant'), content, createdAt, channel
//     NO tiene leadId (subcollection, no necesita)
//
//   organizations/{orgId}/appointments/{apptId}
//     campos: leadId, scheduledAt, status, outcome, paymentDate, type
//
//   organizations/{orgId}/pipeline_stages/{stageId}  <- coleccion FLAT
//     campos: name, order
//
// CAMBIOS vs spec original:
//   handoffSuggested / handoffRate -> REMOVIDOS (campo no existe en leads)
//      Reemplazado por: leadsWithAppointment + leadsWithAppointmentRate
//   meetingsScheduled -> desde /appointments filtrando scheduledAt //   meetingsScheduled -> desde /appointments filtrando scheduledAt //  erted
//   conversations -> subcollection de cada lead, consultadas en Promise.all
//   byStage -> resuelve nombres desde /pipeline_stages (coleccion flat)
//   score / avgScore / topScore -> sin cambios

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

function currentMonthRange() {
  const now   = new Date()
  const mxNow = new Date(now.getTime() - 6 * 60 * 60 * 1000)
  const y = mxNow.getUTCFullYear()
  const m = mxNow.getUTCMonth()
  return [
    admin.firestore.Timestamp.fromDate(new Date(Date.UTC(y, m, 1))),
    admin.firestore.Timestamp.fromDate(new Date(Date.UTC(y, m + 1, 1))),
  ]
}

function previousMonthRange(startTs) {
  const d = startTs.toDate()
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  return [
    admin.firestore.Timestamp.fromDate(new Date(Date.UTC(y, m - 1, 1))),
    admin.firestore.Timestamp.fromDate(new Date(Date.UTC(y, m, 1))),
  ]
}

function tempBucket(msgCount) {
  if (msgCount >= 16) return 'hot'
  if (msgCount >= 8)  return 'qualified'
  if (msgCount >= 4)  return 'warm'
  return 'cold'
}

// Retorna null si hay error — el handler lo marca como error en la tarjeta
// sin romper el resto del panel.
async function calcOrgMetrics(orgId, startTs, endTs) {
  try {
    const orgRef = db.collection('organizations').doc(orgId)

    // 1. Leads del periodo
    const leadsSnap = await orgRef.collection('leads')
      .where('createdAt', '>=', startTs)
      .where('createdAt', '<',  endTs)
      .get()

    const l    const l    const l    const l    const, ...d.data() }))
    const leadsCount = leads.length

    if (leadsCount === 0) {
      return {
        leadsCount: 0, messagesIncoming: 0, avgMessagesPerLead: 0,
        leadsWithAppointment: 0, leadsWithAppointmentRate: 0,
        meetingsScheduled: 0, meetingsCompleted: 0, meetingsConverted: 0,
        meetingsRate: 0, avgScore: 0, topScore: 0,
        leadsCold: 0, leadsWarm: 0, leadsQualified: 0, leadsHot: 0,
        byStage: {},
      }
    }

    // 2. Score y stage
    let scoreSum = 0, topScore = 0
    const stageCount = {}
    const leadIdSet  = new Set(leads.map(l => l.id))

    for (const lead of leads) {
      const s = typeof lead.score === 'number' ? lead.score : 0
      scoreSum += s
      if (s > topScore) topScore = s
      const sId = lead.stageId || '__sin_stage__'
      stageCount[sId] = (stageCount[sId] || 0) + 1
    }

    // 3. Resolver nombres de stages desde pipeline_stages (coleccion flat)
    let stagesMap = {}
    try {
      const stSnap = await orgRef.collection('pipeline_stages').get()
      stSnap.forEach(d => { stagesMap[d.id] = d.data().name || d.id })
    } catch (_) {}

    const byStage = {}
    for (const [sId, count] of Object.entries(stageCount)) {
      byStage[stagesMap[sId] || sId] = count
    }

    // 4. Mensajes por lead — conversations es SUBCOLLECCION de cada lead
    const MAX_PARALLEL = 200
    const leadsToQuery = leads.slice(0, MAX_PARALLEL)

    const convResults = await Promise.all(
      leadsToQuery.map(lead =>
        orgRef.collection('leads').doc(lead.id)
          .collection('conversations')
          .where('role', '==', 'user')
          .get()
          .then(snap => ({ leadId: lead.id, count: snap.size }))
          .catch(() => ({ leadId: lead.id, count: 0 }))
      )
    )

    let messagesIncoming = 0
    const msgsByLead = {}
    for (const { leadId, count } of convResults) {
      msgsByLead[leadId] = count
      messagesIncoming  += count
    }

    // 5. Distribucion cold/warm/qualified/hot
    let cold = 0, warm = 0, qualified = 0, hot = 0
    for (const lead of leads) {
      const b = tempBucket(msgsByLead[lead.id] || 0)
      if (b === 'cold')           cold++
      else if (b === 'warm')      warm++
      else if (b === 'qualified') qualified++
      else                        hot++
    }

    // 6. Appointments en el periodo
    let meetingsScheduled = 0, meetingsCompleted = 0, meetingsConverted = 0
    const leadsWithAppt = new Set()

    try {
      const apptSnap = await orgRef.collection('appointments')
        .where('scheduledAt', '>=', startTs)
        .where('scheduledAt', '<',  endTs)
        .get()

      apptSnap.forEach(d => {
        const appt = d.data()
        meetingsScheduled++
        if (appt.status === 'completed') meetingsCompleted++
        if (appt.paymentDate != null)    meetingsConverted++
        if (appt.leadId && leadIdSet.has(appt.leadId)) leadsWithAppt.add(appt.leadId)
      })
    } catch (_) {}

    const leadsWithAppointment     = leadsWithAppt.size
    const leadsWithAppointmentRate = leadsCount > 0
      ? Math.round((leadsWithAppointment / leadsCount) * 1000) / 1000 : 0

    return {
      leadsCount,
      messagesIncoming,
      avgMessagesPerLead: leadsCount > 0
        ? Math.round((messagesIncoming / leadsCount) * 10) / 10 : 0,
      leadsWithAppointment,
      leadsWithAppointmentRate,
      meetingsScheduled,
      meetingsCompleted,
      meetingsConverted,
      meetingsRate: leadsCount > 0
        ? Math.round((meetingsScheduled / leadsCount) * 1000) / 1000 : 0,
      avgScore: leadsCount > 0
        ? Math.round((scoreSum / leadsCount) * 10) / 10 : 0,
      topScore,
      leadsCold:      cold,
      leadsWarm:      warm,
      leadsQualified: qualified,
      leadsHot:       hot,
      byStage,
    }
  } catch (err) {
    console.error('[get-org-analytics] Error org ' + orgId + ':', err.message)
    return null  // null = error aislado, no rompe las demas orgs
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body || '{}') } catch (_) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  let startTs, endTs
  if (body.periodStart && body.periodEnd) {
    try {
      startTs = admin.firestore.Timestamp.fromDate(new Date(body.periodStart))
      endTs   = admin.firestore.Timestamp.fromDate(new Date(body.periodEnd))
    } catch (_) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'periodStart/periodEnd invalidos' }) }
    }
  } else {
    ;[startTs, endTs] = currentMonthRange()
  }

  const [prevStartTs, prevEndTs] = previousMonthRange(startTs)

  let orgIds = Array.isArray(body.orgIds) && body.orgIds.length > 0 ? body.orgIds : null
  const orgM  const orgM  const orgM  const orgM  const orgM  consdb.collection('organizations').get()
    orgIds = []
    orgsSnap.forEach(d => {
      orgIds.push(d.id)
      const data = d.data()
      orgMeta[d.id] = {
        name:           data.n        nta.orgName || d.id,
        planId:         data.planId         || null,
        planName:       data.planName       || null,
        monthlyUSD:     data.monthlyUSD     || 0,
        monthlyMXN:     data.monthlyMXN     || 0,
        leadsIncluidos: data.leadsIncluidos || null,
      }
    })
  } else {
    const orgSnaps = await Promise.all(orgIds.map(id => db.collection('organizations').doc(id).get()))
    orgSnaps.forEach(d => {
      if (d.exists) {
        const data = d.data()
        orgMeta[d.id] = {
          name:           data.name || data.orgName || d.id,
          planId:         data.planId         || null,
          planName:       data.planName       || null,
          monthlyUSD:     data.monthlyUSD     || 0,
          monthlyMXN:     data.monthlyMXN     || 0,
          leadsIncluidos: data.leadsIncluidos || null,
        }
      }
    })
  }

  // Medir tiempo total de calculo
  const t0 = Date.now()

  const [currentResults, prevResults] = await Promise.all([
    Promise.all(orgIds.map(id => calcOrgMetrics(id, startTs, endTs))),
    Promise.all(orgIds.map(id => calcOrgMetrics(id, prevStartTs, prevEndTs))),
  ])

  const elapsed = Date.now() - t0
  console.log('[Analytics] calculo completado en ' + elapsed + 'ms para ' + orgIds.length + ' orgs')

  const orgs = orgIds.map((orgId, i) => {
    const current = currentResults[i]
    const prev    = prevResults[i]
    const meta    = orgMeta[orgId] || { name: orgId }
    return {
      orgId,
      orgName: meta.name,
      plan: {
        id:              id:              id:              id:                        id:              id:              id:        yM        id:              id:              id:        .l        id:              id:              id:     /         id:              id:              id:     :         id:              id:              id:       nt,         a     sag     Lead:          id:              id:      leadsWithAppointment: prev.leadsWithAppointment,
        meetingsScheduled:    prev.me        meetingsScheduled:    prev.me        meetingsScheduled:    pr : null,
    }
  })

  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      period: { start: startTs.toDate().toISOString(), end: endTs.toDate().toISOString() },
      previousPeriod: { start: prevStartTs.toDate().toISOString(), end: prevEndTs.toDate().toISOString() },
      orgs,
    }),
  }
}
