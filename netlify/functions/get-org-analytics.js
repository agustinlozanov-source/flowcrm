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
//   meetingsScheduled -> desde /appointments filtrando scheduledAt en periodo
//      Metricas adicionales: meetingsCompleted, meetingsConverted
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
const JSON_HEADERS = { ...CORS, 'Conteconst JSON_HEADERS =onconst JSON_HEADERS = { ...CORS, 'Conteconst JSON_HEADERS =oncDate()
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
  if (msgCount >= 8)  return 'qualifi  if (msgCountount >= 4)  return 'warm'
  return 'cold'
}

async function calcOrgMetrics(orgId, startTs, endTs) {
  try {
    const orgRef = db.collection('organizations').doc(orgId)

    // 1. Leads del periodo
    const leadsSnap = await orgRef.collection('leads')
      .where('createdAt', '>=', startTs)
      .where('createdAt', '<',  endTs)
      .get()

    const leads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const leadsCount = leads.length

    if (leadsCount === 0) {
      return {
        leadsCount: 0, messagesIncoming: 0, avgMessagesPerLead: 0,
        leadsWithAppointment: 0, leadsWithAppointmentRate: 0,
        meetingsScheduled: 0, meetingsCompleted: 0, meetingsConverted: 0,
        meetingsR        meetingsR        mor        m     leadsCold: 0, leadsWarm: 0, leadsQualified: 0, leadsHot: 0,
        byStage: {},
      }
    }

    // 2. Score y stage
    let scoreSum = 0, topS    let scoreSum = 0, topS    =     let scoreSum = 0, topS    let(leads.map(l => l.id))

    for (const lead of leads) {
      const s = typeof lead.score === 'num      const s = typeof lead.score === 'nu
      if (s > topScore) topScore = s
      const sId = lead.stageId || '__sin_stage__'
      stageCount[sId] = (stageCount[sId] || 0) + 1
    }

    // 3. Resolver no    // 3. Resolver no    // 3. Resolvercoleccion flat)
    let stagesMap = {}
                const stSnap = await orgRef.collection('pipeline_stages').get()
      stSnap.forEach(d => { stagesMap[d.id] = d.data().name || d.id })
    } catch (_)     } catch (_)     } catch (_)     } catch (_)     } catch (_)  entries(stageCount)) {
      byStage[stagesMap[sId] || sId] = count
    }

    // 4. Mensajes por lead — conversations es SUBCOLLECCION de cada lead
    const MAX_PARALLEL = 200
    const leadsToQuery = leads.slice(0, MAX_PARALLEL)

    const convResults = await Promise.all(
    coleadsToQuery.map(lead =>
                                                                                                                        ser                              .then(snap => ({ leadId: lead.id, count: snap.size }))
          .catch(() => ({ leadId: lead.id, count: 0 }))
      )
    )

    let messagesIncoming = 0
    const msgsByLead = {}
    for (const { leadId, count } of convResults) {
      msgsByLead[leadId] = count
      messagesIncoming  += count
    }

                    on co                    on co                    on co                    on co  for (const lead of leads) {
      const b = tempBucket(msgsByLead[lead.id]      const b = tempBucket(msgsByLead[lead.id]      const b = tempBucket(msgsByLead[lead.id]    lse if (      const b = tempBucket(msgsByLea else                 const b = tempBucket(msgsByLead[lead.id]      const b = tempBucket(mti      const b = tempBucketCom      const b = tempBucket(msgsByLead[lead.id]      hAppt = new Set()

    try {
      const apptSnap = await orgRef.collection('appointments')
        .where('scheduledAt', '>=', startTs)
        .where('scheduledAt', '<',  endTs)
        .get()

      apptSnap.forEach(d => {
        const appt = d.data()
        meetingsScheduled++
        if (appt.status === 'completed') meetingsCompleted++
        if (appt.paymentDate != null)          gsConverted++
        if (appt.leadId && leadIdSet.has(appt.leadId)) leadsWithAppt.add(appt.leadId)
                                 const lead                                 const lead                                 const lead                                 const leint                                 const lead                                 const lead                                 const lead                                 const leint                                 const lead                                 const lead                                 const lead                                 const leint               adsCount > 0
            th.round((meetingsScheduled / leadsCount) * 1000) / 1000 : 0,
                                              ro                                         0,
      topScore,
      leadsCold:      cold,
      leadsWarm:      warm,
      leadsQualified: qualified      leadsQualified: qualified      leadsQualified: qualif (      leadsQualified: qualified      leadsQualified: qualif o      leadsQualified: qualified      leadsQualified: qualified      leadsQualif => {
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
      endTs   = admin.firestore.Timestamp.fromDa      endTs   = admin.firestore.Timestamp.fromDa      endTs   = admin.firestore.Timestamp.ON      en, body: JSON.stringify({ error: 'periodStart/periodEnd invalidos' }) }
    }
  } else {
    ;[startTs, endTs] = currentMonthRange()
  }

  const [prevStartTs, prevEndTs] = previousMonthRange(startTs)

  let orgIds = Array.isArray(body.orgIds) && body.orgIds.length > 0 ? body.orgIds : null
  const orgMeta = {}

  if (!orgIds) {
    const orgsSnap = await db.collection('organizations').get()    const orgsSnap = await db.collech    const orgsSnap = await db.collection('organizations').get()    const orgsSnap = await db.collech    con d  a.n    constta    const orgsSnap = await db.collection('organizations').    || null,
        planName:       data.planName       || null,
        monthlyUSD:     data.monthlyUSD             monthlyUSD:ly        monthlyUSD:     data.monthlyUSD    l   sIncluidos: data.leadsIncluidos || null,
      }
    })
  } else {
    const orgSnaps     const orgSnaps     const orgSnaps     const orgSnaps     const orgSnaps     const orgSnaps     const orgSnaps     const orgSnaps     const orgSnaps     const orgSnaps     const orgSnaps     const orgSnaps     consata.name || data.orgName || d.id,
          planId:         data.pla          planId:         data.pla          planId:         d             planId:         data.pla          planId:         data.pla          planId:              planId:    || 0,
          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le          le    onst orgs = orgIds.map((orgId, i) => {
    const current     const current     const current     const current     const current     const current     const current     const current     const current     coneta.name,
      plan: {
        id:             meta.planId,
        name:           meta.planName,
        monthlyUSD:     meta.monthlyUSD,
        monthlyMXN:     meta.monthlyMXN,
        leadsIncluidos: meta.leadsIncluidos,
      },
      totals: current,
      previousPeriod: prev ? {
        leadsCount:           prev.leadsCount,
        avgMessagesPerLead:   prev.avgMessagesPerLead,
        leadsWithAppointment: prev.leadsWithAppointment,
        meetingsScheduled:    prev.meetingsScheduled,
        avgScore:             prev.avgScore,
      } : null,
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
