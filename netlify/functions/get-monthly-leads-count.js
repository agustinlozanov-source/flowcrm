// netlify/functions/get-monthly-leads-count.js
// Cuenta leads NUEVOS en el mes (createdAt dentro del rango).
// Una sola query a Firestore — sin iterar subdocumentos.
// Si la org tiene leadsIncluidos en su plan, envía email de alerta al 80% y al 100%.
//
// Body  : { orgId: string, year?: number, month?: number }
// Return: { orgId, year, month, leadsCount, leadsIncluidos, pct, lastUpdated }

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
const APP_URL = process.env.URL || 'https://app.flowhubcrm.app'

const CORS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }

// ── Enviar email de alerta vía send-email ────────────────────────────────────
async function sendLimitAlert({ to, orgName, leadsCount, leadsIncluidos, pct }) {
  try {
    await fetch(`${APP_URL}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'lead_limit_warning',
        to,
        data: { orgName, leadsCount, leadsIncluidos, pct },
      }),
    })
  } catch (err) {
    console.error('[leads-count] Error enviando alerta email:', err.message)
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body || '{}') } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { orgId } = body
  if (!orgId || typeof orgId !== 'string' || !orgId.trim()) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'orgId is required' }) }
  }

  // Default: mes actual (hora de México, UTC-6)
  const now   = new Date()
  const mxNow = new Date(now.getTime() - 6 * 60 * 60 * 1000)
  const year  = Number.isInteger(body.year)  ? body.year  : mxNow.getUTCFullYear()
  const month = Number.isInteger(body.month) ? body.month : mxNow.getUTCMonth() + 1  // 1–12

  if (month < 1 || month > 12) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'month must be 1–12' }) }
  }

  // Rango [start, end) del mes — Timestamps de Firestore
  const start = admin.firestore.Timestamp.fromDate(new Date(Date.UTC(year, month - 1, 1)))
  const end   = admin.firestore.Timestamp.fromDate(new Date(Date.UTC(year, month, 1)))

  try {
    // ── 1. Una sola query: leads creados en el mes ────────────────────────────
    const leadsSnap = await db
      .collection('organizations').doc(orgId.trim())
      .collection('leads')
      .where('createdAt', '>=', start)
      .where('createdAt', '<',  end)
      .get()

    const leadsCount = leadsSnap.size

    // ── 2. Leer plan de la org para saber si hay límite ───────────────────────
    const orgSnap = await db.collection('organizations').doc(orgId.trim()).get()
    const orgData = orgSnap.data() || {}
    const ownerEmail = orgData.ownerEmail || null
    const orgName    = orgData.name || orgId

    let leadsIncluidos = null
    if (orgData.planId) {
      const planSnap = await db.collection('plans').doc(orgData.planId).get()
      leadsIncluidos = planSnap.data()?.leadsIncluidos ?? null
    }

    // ── 3. Calcular porcentaje y disparar alerta si corresponde ───────────────
    const pct = leadsIncluidos ? Math.round((leadsCount / leadsIncluidos) * 100) : null

    if (leadsIncluidos && ownerEmail) {
      // Leer alertas ya enviadas este mes para no repetir
      const alertKey = `leads_${year}_${String(month).padStart(2, '0')}`
      const sentAlerts = orgData.sentLeadAlerts || {}

      const shouldAlert80  = pct >= 80  && pct < 100 && !sentAlerts[`${alertKey}_80`]
      const shouldAlert100 = pct >= 100 && !sentAlerts[`${alertKey}_100`]

      if (shouldAlert80 || shouldAlert100) {
        const alertLevel = shouldAlert100 ? '100' : '80'
        await sendLimitAlert({ to: ownerEmail, orgName, leadsCount, leadsIncluidos, pct })
        // Marcar alerta como enviada para no repetir
        await db.collection('organizations').doc(orgId.trim()).update({
          [`sentLeadAlerts.${alertKey}_${alertLevel}`]: new Date().toISOString(),
        })
        console.log(`[leads-count] Alerta ${alertLevel}% enviada a ${ownerEmail} (org: ${orgName}, ${leadsCount}/${leadsIncluidos})`)
      }
    }

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        orgId: orgId.trim(),
        year,
        month,
        leadsCount,
        leadsIncluidos,
        pct,
        lastUpdated: new Date().toISOString(),
      }),
    }
  } catch (err) {
    console.error('[get-monthly-leads-count] Error:', err.message)
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'Internal error', detail: err.message }),
    }
  }
}
