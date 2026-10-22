/* Mide el consumo de todas las organizaciones, una vez al día.
 *
 * Antes esto solo ocurría cuando alguien abría una organización en el panel,
 * así que una cuenta podía pasarse del cupo durante semanas sin que saliera
 * ninguna alerta: el aviso dependía de que Agustín entrara a mirar.
 *
 * Deja el resultado escrito en la organización (`consumo`) para que la
 * pantalla lo muestre sin tener que contar de nuevo, y es la base de lo que
 * después se le reporta a Stripe para cobrar los leads extra.
 */
const admin = require('firebase-admin')
const { credencial } = require('./lib/credencial')
const { medirOrg, mesActual } = require('./lib/consumo')

let base = null
function laBase() {
  if (!base) {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(credencial()) })
    }
    base = admin.firestore()
  }
  return base
}

exports.handler = async () => {
  const db = laBase()
  const { year, month } = mesActual()

  const orgs = await db.collection('organizations').get()
  const resumen = { medidas: 0, conCupo: 0, pasadas: 0, alertas: 0, fallos: 0 }

  /* De una en una a propósito. Son decenas de organizaciones, cada medición
   * son tres consultas, y hacerlas todas a la vez es cómo se tumba la cuota
   * de Firestore. La tarea corre de noche: no hay prisa. */
  for (const org of orgs.docs) {
    try {
      const r = await medirOrg(db, org.id, { year, month })
      await org.ref.update({
        consumo: {
          year: r.year, month: r.month,
          leads: r.leadsCount,
          incluidos: r.leadsIncluidos,
          pct: r.pct,
          excedente: r.excedente,
          medidoEn: admin.firestore.FieldValue.serverTimestamp(),
        },
      })
      resumen.medidas++
      if (r.leadsIncluidos) resumen.conCupo++
      if (r.excedente > 0) resumen.pasadas++
      if (r.alertaEnviada) {
        resumen.alertas++
        console.log(`[medir-consumo] alerta ${r.alertaEnviada}% → ${r.orgName} (${r.leadsCount}/${r.leadsIncluidos})`)
      }
    } catch (e) {
      resumen.fallos++
      console.error(`[medir-consumo] ${org.id}:`, e.message)
    }
  }

  console.log('[medir-consumo]', JSON.stringify(resumen))
  return { statusCode: 200, body: JSON.stringify(resumen) }
}
