// netlify/functions/get-org-analytics.js
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

// Corre una promise con timeout; resuelve con fallback si se pasa el tiempo
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

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

const EMPTY_METRICS = {
  leadsCount: 0,
  messagesIncoming: 0,
  avgMessagesPerLead: 0,
  leadsWithAppointment: 0,
  leadsWithAppointmentRate: 0,
  meetingsScheduled: 0,
  meetingsCompleted: 0,
  meetingsConverted: 0,
  meetingsRate: 0,
  avgScore: 0,
  topScore: 0,
  leadsCold: 0,
  leadsWarm: 0,
  leadsQualified: 0,
  leadsHot: 0,
  byStage: {},
}

// Retorna null en error — el handler lo muestra como tarjeta con error
// sin romper las demas orgs.
async function calcOrgMetrics(orgId, startTs, endTs) {
  try {
    const orgRef = db.collection('organizations').doc(orgId)

    // 1. Leads del periodo
    const leadsSnap = await withTimeout(
      orgRef.collection('leads')
        .where('createdAt', '>=', startTs)
        .where('createdAt', '<',  endTs)
        .get(),
      8000,
      null,
    )
    if (!leadsSnap) {
      console.warn('[analytics] leads timeout org', orgId)
      return null
    }

    const leads      = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const leadsCount = leads.length

    if (leadsCount === 0) {
      return Object.assign({}, EMPTY_METRICS)
    }

    // 2. Score + conteo por stage
    let scoreSum = 0
    let topScore = 0
    const stageCount = {}
    const leadIdSet  = new Set(leads.map(l => l.id))

    for (const lead of leads) {
      const s = typeof lead.score === 'number' ? lead.score : 0
      scoreSum += s
      if (s > topScore) topScore = s
      const sId = lead.stageId || '__sin_stage__'
      stageCount[sId] = (stageCount[sId] || 0) + 1
    }

    // 3. Resolver nombres de stages
    let stagesMap = {}
    try {
      const stSnap = await withTimeout(
        orgRef.collection('pipeline_stages').get(),
        4000,
        null,
      )
      if (stSnap) {
        stSnap.forEach(d => { stagesMap[d.id] = d.data().name || d.id })
      }
    } catch (_) {}

    const byStage = {}
    for (const [sId, count] of Object.entries(stageCount)) {
      byStage[stagesMap[sId] || sId] = count
    }

    // 4. Conversations (subcolleccion de cada lead)
    //    Solo si hay <= 80 leads para evitar timeout
    let messagesIncoming = 0
    const msgsByLead = {}

    if (leadsCount <= 80) {
      const CONV_BATCH = 20
      const sample = leads.slice(0, 80)
      for (let i = 0; i < sample.length; i += CONV_BATCH) {
        const chunk = sample.slice(i, i + CONV_BATCH)
        const results = await withTimeout(
          Promise.all(
            chunk.map(lead =>
              orgRef.collection('leads').doc(lead.id)
                .collection('conversations')
                .where('role', '==', 'user')
                .get()
                .then(snap => ({ id: lead.id, count: snap.size }))
                .catch(() => ({ id: lead.id, count: 0 }))
            ),
          ),
          6000,
          chunk.map(lead => ({ id: lead.id, count: 0 })),
        )
        for (const r of results) {
          msgsByLead[r.id]  = r.count
          messagesIncoming += r.count
        }
      }
    }

    // 5. Distribucion cold/warm/qualified/hot
    let cold = 0
    let warm = 0
    let qualified = 0
    let hot = 0
    for (const lead of leads) {
      const msgs = (msgsByLead[lead.id] !== undefined) ? msgsByLead[lead.id] : -1
      let bucket
      if (msgs >= 0) {
        if (msgs >= 16)     bucket = 'hot'
        else if (msgs >= 8) bucket = 'qualified'
        else if (msgs >= 4) bucket = 'warm'
        else                bucket = 'cold'
      } else {
        const sc = typeof lead.score === 'number' ? lead.score : 0
        if (sc >= 80)      bucket = 'hot'
        else if (sc >= 50) bucket = 'qualified'
        else if (sc >= 25) bucket = 'warm'
        else               bucket = 'cold'
      }
      if (bucket === 'cold')           cold++
      else if (bucket === 'warm')      warm++
      else if (bucket === 'qualified') qualified++
      else                             hot++
    }

    // 6. Appointments
    let meetingsScheduled  = 0
    let meetingsCompleted  = 0
    let meetingsConverted  = 0
    const leadsWithAppt = new Set()

    try {
      const apptSnap = await withTimeout(
        orgRef.collection('appointments')
          .where('scheduledAt', '>=', startTs)
          .where('scheduledAt', '<',  endTs)
          .get(),
        5000,
        null,
      )
      if (apptSnap) {
        apptSnap.forEach(d => {
          const a = d.data()
          meetingsScheduled++
          if (a.status === 'completed') meetingsCompleted++
          if (a.paymentDate != null)    meetingsConverted++
          if (a.leadId && leadIdSet.has(a.leadId)) leadsWithAppt.add(a.leadId)
        })
      }
    } catch (_) {}

    const leadsWithAppointment     = leadsWithAppt.size
    const leadsWithAppointmentRate = leadsCount > 0
      ? Math.round((leadsWithAppointment / leadsCount) * 1000) / 1000
      : 0

    return {
      leadsCount,
      messagesIncoming,
      avgMessagesPerLead: leadsCount > 0
        ? Math.round((messagesIncoming / leadsCount) * 10) / 10
        : 0,
      leadsWithAppointment,
      leadsWithAppointmentRate,
      meetingsScheduled,
      meetingsCompleted,
      meetingsConverted,
      meetingsRate: leadsCount > 0
        ? Math.round((meetingsScheduled / leadsCount) * 1000) / 1000
        : 0,
      avgScore: leadsCount > 0
        ? Math.round((scoreSum / leadsCount) * 10) / 10
        : 0,
      topScore,
      leadsCold:      cold,
      leadsWarm:      warm,
      leadsQualified: qualified,
      leadsHot:       hot,
      byStage,
    }
  } catch (err) {
    console.error('[get-org-analytics] Error org', orgId, err.message)
    return null
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch (_) {
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
  const orgMeta = {}

  if (!orgIds) {
    const orgsSnap = await withTimeout(db.collection('organizations').get(), 8000, null)
    if (!orgsSnap) {
      return { statusCode: 504, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Timeout leyendo organizaciones' }) }
    }
    orgIds = []
    orgsSnap.forEach(d => {
      orgIds.push(d.id)
      const data = d.data()
      orgMeta[d.id] = {
        name:           data.name || data.orgName || d.id,
        planId:         data.planId         || null,
        planName:       data.planName       || null,
        monthlyUSD:     data.monthlyUSD     || 0,
        monthlyMXN:     data.monthlyMXN     || 0,
        leadsIncluidos: data.leadsIncluidos || null,
      }
    })
  } else {
    const orgSnaps = await withTimeout(
      Promise.all(orgIds.map(id => db.collection('organizations').doc(id).get())),
      8000,
      [],
    )
    for (const d of (orgSnaps || [])) {
      if (d && d.exists) {
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
    }
  }

  const t0 = Date.now()

  // Procesar orgs de 5 en 5 para no saturar Firestore
  const ORG_BATCH      = 5
  const currentResults = []
  const prevResults    = []

  for (let i = 0; i < orgIds.length; i += ORG_BATCH) {
    const chunk = orgIds.slice(i, i + ORG_BATCH)
    const [cur, prev] = await Promise.all([
      Promise.all(chunk.map(id => calcOrgMetrics(id, startTs, endTs))),
      Promise.all(chunk.map(id => calcOrgMetrics(id, prevStartTs, prevEndTs))),
    ])
    currentResults.push(...cur)
    prevResults.push(...prev)
  }

  console.log('[Analytics] completado en', (Date.now() - t0) + 'ms para', orgIds.length, 'orgs')

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
      totals:         current,
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
    headers:    JSON_HEADERS,
    body: JSON.stringify({
      period:         { start: startTs.toDate().toISOString(),     end: endTs.toDate().toISOString() },
      previousPeriod: { start: prevStartTs.toDate().toISOString(), end: prevEndTs.toDate().toISOString() },
      orgs,
    }),
  }
}
