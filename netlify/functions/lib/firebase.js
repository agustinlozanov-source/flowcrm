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
    admin.initializeApp({ credential: admin.credential.cert(credencial()) })
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

module.exports = { initDb, saveAttachments }
