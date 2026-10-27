// Init de firebase-admin compartido por las funciones. Perezoso a propósito:
// si se inicializa al cargar el módulo, una credencial mal configurada tumba
// la función entera antes de poder devolver un error legible.
const admin = require('firebase-admin')
// Escrito por scripts/credenciales.mjs antes de compilar, y empotrado aquí por
// el empaquetador. Va en un archivo y no en variables de entorno porque Lambda
// solo admite 4 KB de variables para TODAS las funciones, y la clave privada
// se comía casi la mitad.
const delPaquete = require('./credenciales.json')

/* El entorno sigue valiendo: así la cosa funciona tanto si las variables están
 * puestas como si solo está el archivo, y migrar de una a otra no deja un
 * hueco en el que nada arranca. */
function credencial() {
  const privateKey = delPaquete.privateKey || process.env.FIREBASE_PRIVATE_KEY || ''
  return {
    projectId: delPaquete.projectId || process.env.FIREBASE_PROJECT_ID,
    clientEmail: delPaquete.clientEmail || process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  }
}

function initDb() {
  if (!admin.apps.length) {
    const c = credencial()
    // Un fallo de credencial es el más confuso de todos si no se nombra:
    // sale un error genérico de Google y nadie sabe qué pieza falta.
    const faltan = ['projectId', 'clientEmail', 'privateKey'].filter(k => !c[k])
    if (faltan.length) {
      throw new Error(`Credencial de Firebase incompleta: falta ${faltan.join(', ')}`)
    }
    try {
      admin.initializeApp({ credential: admin.credential.cert(c) })
    } catch (e) {
      throw new Error(`Credencial de Firebase inválida: ${e.message}`)
    }
  }
  return admin.firestore()
}

// Deja cada adjunto como un mensaje propio del hilo, para que el Inbox
// muestre lo mismo que recibió el lead.
async function saveAttachments(db, orgId, leadId, sent = [], channel = 'whatsapp') {
  for (const a of sent) {
    await db.collection('organizations').doc(orgId)
      .collection('leads').doc(leadId)
      .collection('conversations').add({
        role: 'assistant',
        text: `📎 ${a.name}`,
        attachment: a,
        channel,
        read: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
  }
}

/* Los últimos diez dígitos: lo que identifica a una persona sin importar
 * cómo escriba su número.
 *
 * El mismo paciente llega escrito de formas distintas según por dónde entre.
 * WhatsApp manda el número completo con lada —5218112345678—; quien lo
 * teclea en un chat pone sus diez dígitos, con guiones o sin ellos. Comparando
 * la cadena entera, esos dos son personas diferentes, y terminas con el mismo
 * contacto duplicado en el tablero. */
function claveTelefono(tel) {
  const d = String(tel ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : ''
}

/* Busca un lead por teléfono tolerando el formato.
 *
 * Primero por `phoneKey`, que es la forma nueva y una sola consulta. Los leads
 * de antes no lo tienen, así que se prueban también las formas en que pudo
 * haber quedado guardado el número; cuando una acierta, se le escribe la
 * clave al lead y la próxima vez entra por el camino corto. Así no hace falta
 * migrar nada: la base se va arreglando sola a medida que la gente escribe. */
async function buscarLeadPorTelefono(db, orgId, tel) {
  const clave = claveTelefono(tel)
  if (!clave) return null
  const leads = db.collection('organizations').doc(orgId).collection('leads')

  const porClave = await leads.where('phoneKey', '==', clave).limit(1).get()
  if (!porClave.empty) return porClave.docs[0]

  for (const viejo of [String(tel ?? ''), clave, `52${clave}`, `521${clave}`]) {
    if (!viejo) continue
    const snap = await leads.where('phone', '==', viejo).limit(1).get()
    if (!snap.empty) {
      await snap.docs[0].ref.update({ phoneKey: clave })
      return snap.docs[0]
    }
  }
  return null
}

/* El mensaje entrante se guarda ACÁ, en la puerta de entrada.
 *
 * Antes lo escribía agent-manager, que es el último eslabón de la cadena. Si
 * el agente no llegaba a correr, el mensaje no quedaba en ningún lado: se
 * actualizaba `lastMessage` del lead y nada más, así que la conversación se
 * veía vacía en el Inbox mientras el cliente seguía escribiendo.
 *
 * Pasaba en los tres casos en que el agente no contesta, y el peor es el más
 * común: alguien pausa al agente desde el Inbox justo PARA atender a mano, y
 * a partir de ese momento deja de ver lo que le mandan. */
async function guardarMensaje(db, orgId, leadId, { role, text, channel = null, attachment = null }) {
  await db.collection('organizations').doc(orgId)
    .collection('leads').doc(leadId)
    .collection('conversations').add({
      role,
      text,
      ...(channel ? { channel } : {}),
      ...(attachment ? { attachment } : {}),
      read: role !== 'user',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
}

/* Dónde nace un lead: su pipeline y la primera etapa DE ESE pipeline.
 *
 * Las tres puertas de entrada —Zernio, Meta y los formularios— elegían la
 * primera etapa de cualquier pipeline, no la del suyo. Con un solo pipeline
 * nunca se notó; en cuanto hay varios, mete leads en etapas ajenas y el
 * tablero deja de significar nada.
 *
 * La etapa se ordena en memoria a propósito: filtrar y ordenar a la vez
 * exigiría un índice compuesto en Firestore, y si falta, esto explota en
 * producción justo cuando entra un lead.
 */
async function destinoInicial(db, orgId, pipelinePreferido = null) {
  const orgRef = db.collection('organizations').doc(orgId)

  let pipelineId = pipelinePreferido
  if (!pipelineId) {
    const pipelines = await orgRef.collection('pipelines').limit(1).get()
    pipelineId = pipelines.empty ? null : pipelines.docs[0].id
  }
  if (!pipelineId) return { pipelineId: null, stageId: null }

  const etapas = await orgRef.collection('pipeline_stages')
    .where('pipelineId', '==', pipelineId).get()
  const ordenadas = etapas.docs
    .map(d => ({ id: d.id, orden: d.data().order ?? 0 }))
    .sort((a, b) => a.orden - b.orden)

  return { pipelineId, stageId: ordenadas[0]?.id || null }
}

/* A qué pipeline pertenece lo que entra por una cuenta.
 *
 * Primero se busca la marca que tiene conectada esa cuenta de Instagram: la
 * marca es el nudo donde se atan el dueño, la cuenta y el pipeline, así que
 * preguntarle a ella evita mantener una copia del mapa en otro sitio y que
 * las dos se desincronicen.
 *
 * Si no hay marca —las cuentas que entran por Zernio no lo son— se mira el
 * mapa `ruteo` de la organización. Y si tampoco, se cae al primer pipeline,
 * que es lo que se hacía siempre.
 */
async function pipelineDeLaCuenta(db, orgId, cuentaId) {
  if (!cuentaId) return null
  const orgRef = db.collection('organizations').doc(orgId)

  const marcas = await orgRef.collection('brands')
    .where('ig.userId', '==', String(cuentaId)).limit(1).get()
  if (!marcas.empty) {
    const pid = marcas.docs[0].data().pipelineId
    if (pid) return pid
  }

  const org = await orgRef.get()
  return org.data()?.ruteo?.[cuentaId]?.pipelineId || null
}

module.exports = {
  initDb, saveAttachments, guardarMensaje, destinoInicial, pipelineDeLaCuenta,
  claveTelefono, buscarLeadPorTelefono,
}
