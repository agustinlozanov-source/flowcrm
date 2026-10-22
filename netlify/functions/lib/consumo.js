/* Cuánto ha consumido una organización este mes.
 *
 * Vivía dentro de get-monthly-leads-count, que es un manejador HTTP: solo
 * corría cuando alguien abría la organización en el panel. Eso significaba
 * que las alertas de 80% y 100% solo salían si Agustín entraba a mirar — y si
 * no entraba, el cliente se pasaba del cupo sin que nadie se enterara.
 *
 * Al vivir aquí lo pueden usar los dos: la pantalla cuando se abre, y la
 * tarea diaria que recorre todas las organizaciones.
 */
const admin = require('firebase-admin')

const APP_URL = process.env.URL || 'https://flowhubcrm.app'

/** El mes en curso según la hora de México, no la del servidor. */
function mesActual() {
  const mx = new Date(Date.now() - 6 * 60 * 60 * 1000)
  return { year: mx.getUTCFullYear(), month: mx.getUTCMonth() + 1 }
}

async function avisar({ to, orgName, leadsCount, leadsIncluidos, pct }) {
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
    return true
  } catch (err) {
    console.error('[consumo] no se pudo mandar la alerta:', err.message)
    return false
  }
}

/**
 * Cuenta, compara con el cupo y avisa si hace falta.
 *
 * @param {boolean} opciones.avisos  false para solo medir, sin mandar correos.
 */
async function medirOrg(db, orgId, { year, month, avisos = true } = {}) {
  const hoy = mesActual()
  year = Number.isInteger(year) ? year : hoy.year
  month = Number.isInteger(month) ? month : hoy.month

  const start = admin.firestore.Timestamp.fromDate(new Date(Date.UTC(year, month - 1, 1)))
  const end = admin.firestore.Timestamp.fromDate(new Date(Date.UTC(year, month, 1)))
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevStart = admin.firestore.Timestamp.fromDate(new Date(Date.UTC(prevYear, prevMonth - 1, 1)))

  const orgRef = db.collection('organizations').doc(orgId)
  const leadsCol = orgRef.collection('leads')

  const [leadsSnap, prevSnap, orgSnap] = await Promise.all([
    leadsCol.where('createdAt', '>=', start).where('createdAt', '<', end).get(),
    leadsCol.where('createdAt', '>=', prevStart).where('createdAt', '<', start).get(),
    orgRef.get(),
  ])

  const leadsCount = leadsSnap.size
  const prevLeadsCount = prevSnap.size
  const orgData = orgSnap.data() || {}

  /* El cupo vive bajo dos nombres: el panel guarda `maxLeads` y el resto del
   * sistema lee `leadsIncluidos`. Se aceptan los dos. 0 y 999999 son "sin
   * límite" en el panel, y tratarlos como cupo real mandaría una alerta de
   * 100% a toda organización ilimitada. */
  let leadsIncluidos = null
  if (orgData.planId) {
    const plan = (await db.collection('plans').doc(orgData.planId).get()).data() || {}
    const cupo = plan.leadsIncluidos ?? plan.maxLeads ?? null
    leadsIncluidos = (cupo === null || cupo === 0 || cupo >= 999999) ? null : cupo
  }

  const pct = leadsIncluidos ? Math.round((leadsCount / leadsIncluidos) * 100) : null
  const excedente = leadsIncluidos ? Math.max(0, leadsCount - leadsIncluidos) : 0

  // Una sola alerta por umbral y por mes. Sin esto, la tarea diaria mandaría
  // el mismo correo todos los días a quien se pasó del cupo.
  let alertaEnviada = null
  if (avisos && leadsIncluidos && orgData.ownerEmail) {
    const clave = `leads_${year}_${String(month).padStart(2, '0')}`
    const yaMandadas = orgData.sentLeadAlerts || {}
    const nivel = pct >= 100 ? '100' : (pct >= 80 ? '80' : null)

    if (nivel && !yaMandadas[`${clave}_${nivel}`]) {
      const ok = await avisar({
        to: orgData.ownerEmail,
        orgName: orgData.name || orgId,
        leadsCount, leadsIncluidos, pct,
      })
      if (ok) {
        await orgRef.update({ [`sentLeadAlerts.${clave}_${nivel}`]: new Date().toISOString() })
        alertaEnviada = nivel
      }
    }
  }

  return {
    orgId, year, month,
    leadsCount, prevYear, prevMonth, prevLeadsCount,
    leadsIncluidos, pct, excedente, alertaEnviada,
    orgName: orgData.name || orgId,
    lastUpdated: new Date().toISOString(),
  }
}

module.exports = { medirOrg, mesActual }
