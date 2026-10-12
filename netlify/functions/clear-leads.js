/* Borra todos los leads de una organización. Es para la fase de pruebas: sin
 * esto no se puede volver a escribir desde el mismo WhatsApp, porque el
 * sistema reconoce el número y retoma la conversación anterior.
 *
 * Reemplaza al endpoint que vivía en Railway y que mandaba una contraseña
 * escrita en el código del navegador: cualquiera que abriera las herramientas
 * de desarrollo podía leerla y borrarle los leads a cualquier organización.
 *
 * Acá la organización NO la elige quien llama: sale del token de quien pide.
 * Así nadie puede borrar la base de otro aunque adivine el id.
 */
const admin = require('firebase-admin')
const { initDb } = require('./lib/firebase')

const LOTE = 400

async function borrarEnLotes(db, docs) {
  let borrados = 0
  for (let i = 0; i < docs.length; i += LOTE) {
    const batch = db.batch()
    docs.slice(i, i + LOTE).forEach(d => batch.delete(d.ref))
    await batch.commit()
    borrados += Math.min(LOTE, docs.length - i)
  }
  return borrados
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' }

  try {
    const token = (event.headers.authorization || '').replace(/^Bearer /, '')
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Falta el token' }) }

    const body = JSON.parse(event.body || '{}')
    // Confirmación explícita: borrar todo no puede pasar por un clic accidental.
    if (body.confirm !== 'BORRAR') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta la confirmación' }) }
    }

    const db = initDb()
    const { uid } = await admin.auth().verifyIdToken(token)

    const userSnap = await db.collection('users').doc(uid).get()
    const orgId = userSnap.data()?.orgId
    if (!orgId) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sin organización' }) }

    const memberSnap = await db.collection('organizations').doc(orgId).collection('members').doc(uid).get()
    const rol = memberSnap.data()?.role || userSnap.data()?.role
    if (!['admin', 'superadmin'].includes(rol)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Solo un administrador puede limpiar la base' }) }
    }

    const orgRef = db.collection('organizations').doc(orgId)
    const leadsSnap = await orgRef.collection('leads').get()

    // Las subcolecciones no se van solas al borrar el documento padre: si no
    // se borran a mano quedan huérfanas y ocupando espacio para siempre.
    let subdocs = 0
    for (const lead of leadsSnap.docs) {
      for (const sub of ['conversations', 'interactions', 'opportunities']) {
        const s = await lead.ref.collection(sub).get()
        if (!s.empty) subdocs += await borrarEnLotes(db, s.docs)
      }
    }

    const citasSnap = await orgRef.collection('appointments').get()
    const citas = await borrarEnLotes(db, citasSnap.docs)
    const leads = await borrarEnLotes(db, leadsSnap.docs)

    console.log(`[clear-leads] org ${orgId} por ${uid}: ${leads} leads, ${subdocs} subdocumentos, ${citas} citas`)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, orgId, leads, subdocs, citas }),
    }
  } catch (e) {
    console.error('clear-leads error:', e)
    const esToken = /token|auth/i.test(e.message || '')
    return {
      statusCode: esToken ? 401 : 500,
      headers,
      body: JSON.stringify({ error: esToken ? 'Sesión inválida, volvé a entrar' : e.message }),
    }
  }
}
