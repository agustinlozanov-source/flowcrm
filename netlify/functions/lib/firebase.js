// Init de firebase-admin compartido por las funciones. Perezoso a propósito:
// si se inicializa al cargar el módulo, una credencial mal configurada tumba
// la función entera antes de poder devolver un error legible.
const admin = require('firebase-admin')

function initDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
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
