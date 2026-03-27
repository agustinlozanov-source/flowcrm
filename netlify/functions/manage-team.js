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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { action, orgId, name, email, password, uid } = JSON.parse(event.body)
    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing orgId' }) }

    // ── CREATE MEMBER ──
    if (action === 'create') {
      if (!email || !password || !name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'name, email y password son requeridos' }) }
      }

      // Firebase Admin crea el usuario sin afectar la sesión actual
      const userRecord = await admin.auth().createUser({ email, password, displayName: name })

      await db.collection('users').doc(userRecord.uid).set({
        name,
        email,
        orgId,
        role: 'member',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, uid: userRecord.uid }) }
    }

    // ── LIST MEMBERS ──
    if (action === 'list') {
      const snap = await db.collection('users').where('orgId', '==', orgId).get()
      const members = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      return { statusCode: 200, headers, body: JSON.stringify({ members }) }
    }

    // ── DELETE MEMBER ──
    if (action === 'delete') {
      if (!uid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing uid' }) }

      // No borrar al owner
      const orgSnap = await db.collection('organizations').doc(orgId).get()
      if (orgSnap.data()?.ownerId === uid) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'No puedes eliminar al owner' }) }
      }

      await admin.auth().deleteUser(uid)
      await db.collection('users').doc(uid).delete()
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
  } catch (err) {
    console.error('manage-team error:', err)
    const msg = err.code === 'auth/email-already-exists'
      ? 'Ya existe un usuario con ese email'
      : err.message
    return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) }
  }
}
