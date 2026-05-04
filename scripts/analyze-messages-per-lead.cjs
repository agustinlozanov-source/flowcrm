#!/usr/bin/env node
/**
 * scripts/analyze-messages-per-lead.js
 *
 * Lee Firestore y genera estadísticas de mensajes entrantes por lead,
 * para estimar el costo promedio por lead en llamadas a Claude.
 *
 * Solo lectura — no modifica nada en Firestore.
 *
 * Uso:
 *   cd manychat-integration   # donde está el .env con las vars de Firebase
 *   node ../scripts/analyze-messages-per-lead.js
 *
 * Variables de entorno requeridas (las mismas que usa el servidor):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

require('dotenv').config()                     // carga .env de la carpeta actual
const admin = require('firebase-admin')

// ── Init Firebase Admin ──────────────────────────────────────────────────────

function parsePrivateKey(raw) {
  if (!raw) return undefined
  return raw.replace(/\\n/g, '\n')
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
      privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
    }),
  })
}

const db = admin.firestore()

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Obtiene todos los docs de una collection con paginación automática. */
async function getAllDocs(collectionRef) {
  const docs = []
  let lastDoc = null
  const PAGE = 500

  while (true) {
    let q = collectionRef.limit(PAGE)
    if (lastDoc) q = q.startAfter(lastDoc)

    const snap = await q.get()
    if (snap.empty) break

    snap.docs.forEach(d => docs.push(d))
    lastDoc = snap.docs[snap.docs.length - 1]

    if (snap.docs.length < PAGE) break   // última página
  }

  return docs
}

function median(sorted) {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function pct(n, total) {
  return total === 0 ? '0.0' : ((n / total) * 100).toFixed(1)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== ANÁLISIS DE MENSAJES POR LEAD ===\n')

  // 1. Organizaciones activas
  const orgsSnap = await db.collection('organizations').where('status', '==', 'active').get()
  const orgs = orgsSnap.docs
  console.log(`Organizaciones activas encontradas: ${orgs.length}`)

  // Acumuladores globales
  const allCounts = []        // [{ orgId, orgName, leadId, incomingCount }]
  const orgStats = {}         // orgId → { name, totalLeads, totalMsgs }

  // 2. Recorrer orgs → leads → conversations
  for (const orgDoc of orgs) {
    const orgId = orgDoc.id
    const orgName = orgDoc.data().name || orgId

    try {
      const leadsRef = db.collection('organizations').doc(orgId).collection('leads')
      const leadDocs = await getAllDocs(leadsRef)

      if (leadDocs.length === 0) continue

      let orgLeadsWithMsgs = 0
      let orgTotalMsgs = 0

      for (const leadDoc of leadDocs) {
        try {
          const convsRef = leadDoc.ref.collection('conversations')
          // Solo mensajes entrantes (role: 'user') — los que disparan Claude
          const incomingSnap = await convsRef.where('role', '==', 'user').get()
          const count = incomingSnap.size

          if (count === 0) continue   // lead sin conversación, excluir

          allCounts.push({ orgId, orgName, leadId: leadDoc.id, incomingCount: count })
          orgLeadsWithMsgs++
          orgTotalMsgs += count
        } catch (leadErr) {
          // Error en un lead individual — continuar
          console.error(`  [WARN] Error leyendo conversations del lead ${leadDoc.id} (org ${orgId}):`, leadErr.message)
        }
      }

      if (orgLeadsWithMsgs > 0) {
        orgStats[orgId] = {
          name: orgName,
          leadsWithMsgs: orgLeadsWithMsgs,
          totalMsgs: orgTotalMsgs,
          avgPerLead: orgTotalMsgs / orgLeadsWithMsgs,
        }
      }

    } catch (orgErr) {
      console.error(`  [ERROR] No se pudo leer la org ${orgId} (${orgName}):`, orgErr.message)
    }
  }

  // 3. Estadísticas globales
  const counts = allCounts.map(x => x.incomingCount).sort((a, b) => a - b)
  const totalLeads = counts.length

  if (totalLeads === 0) {
    console.log('\nNo se encontraron leads con mensajes entrantes.')
    process.exit(0)
  }

  const total = counts.reduce((s, n) => s + n, 0)
  const avg = total / totalLeads
  const med = median(counts)
  const min = counts[0]
  const max = counts[counts.length - 1]

  // Distribución
  const b1 = counts.filter(n => n >= 1 && n <= 3).length
  const b2 = counts.filter(n => n >= 4 && n <= 7).length
  const b3 = counts.filter(n => n >= 8 && n <= 15).length
  const b4 = counts.filter(n => n >= 16 && n <= 30).length
  const b5 = counts.filter(n => n >= 31).length

  // Top 5 orgs por volumen total de mensajes
  const topOrgs = Object.values(orgStats)
    .sort((a, b) => b.totalMsgs - a.totalMsgs)
    .slice(0, 5)

  // Número de orgs que tienen al menos 1 lead con mensajes
  const orgsWithData = Object.keys(orgStats).length

  // ── Output ────────────────────────────────────────────────────────────────

  console.log(`\nPeriodo analizado:             todos los leads`)
  console.log(`Total de organizaciones:        ${orgsWithData} (de ${orgs.length} activas)`)
  console.log(`Total de leads con ≥1 mensaje:  ${totalLeads}`)
  console.log(`Total mensajes entrantes:        ${total}`)

  console.log('\nMensajes entrantes por lead:')
  console.log(`  Promedio:           ${avg.toFixed(1)}`)
  console.log(`  Mediana:            ${med}`)
  console.log(`  Mínimo:             ${min}`)
  console.log(`  Máximo:             ${max}`)

  console.log('\nDistribución:')
  console.log(`  1-3 mensajes:       ${b1} leads (${pct(b1, totalLeads)}%)`)
  console.log(`  4-7 mensajes:       ${b2} leads (${pct(b2, totalLeads)}%)`)
  console.log(`  8-15 mensajes:      ${b3} leads (${pct(b3, totalLeads)}%)`)
  console.log(`  16-30 mensajes:     ${b4} leads (${pct(b4, totalLeads)}%)`)
  console.log(`  31+ mensajes:       ${b5} leads (${pct(b5, totalLeads)}%)`)

  console.log('\nTop 5 organizaciones por volumen:')
  for (const org of topOrgs) {
    console.log(`  ${org.name}: ${org.leadsWithMsgs} leads, ${org.avgPerLead.toFixed(1)} msgs promedio/lead (${org.totalMsgs} total)`)
  }

  // Estimación de costo (referencial)
  const INPUT_TOKENS_PER_MSG = 5700   // estimado sin caché (ver CLAUDE_API_INVENTORY.md)
  const OUTPUT_TOKENS_PER_MSG = 200
  const COST_PER_MSG = (INPUT_TOKENS_PER_MSG * 3 + OUTPUT_TOKENS_PER_MSG * 15) / 1_000_000
  const avgCostPerLead = avg * COST_PER_MSG

  console.log('\nEstimación de costo referencial (sin prompt caching):')
  console.log(`  Costo por mensaje entrante:   $${COST_PER_MSG.toFixed(4)} USD`)
  console.log(`  Costo promedio por lead:      $${avgCostPerLead.toFixed(4)} USD`)
  console.log(`  Costo total histórico est.:   $${(total * COST_PER_MSG).toFixed(2)} USD`)
  console.log('\n(Con prompt caching activo el costo por mensaje baja ~58%)')
  console.log('================================================\n')
}

main().catch(err => {
  console.error('\n[FATAL]', err.message)
  process.exit(1)
})
