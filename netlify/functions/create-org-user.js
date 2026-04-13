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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { email, password, nombre, apellido, orgData } = JSON.parse(event.body)

    if (!email || !password || !orgData) {
      return { statusCode: 400, body: JSON.stringify({ error: 'email, password y orgData son requeridos' }) }
    }

    // 1. Create user in Firebase Auth using Admin SDK (does NOT sign in)
    let uid
    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: [nombre, apellido].filter(Boolean).join(' ') || email.split('@')[0],
      })
      uid = userRecord.uid
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        // User already exists — fetch their UID
        const existing = await admin.auth().getUserByEmail(email)
        uid = existing.uid
      } else {
        throw e
      }
    }

    // 2. Create the org document
    const orgRef = db.collection('organizations').doc()
    await orgRef.set({
      ...orgData,
      ownerId: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    const orgId = orgRef.id

    // 3. Create the global user document
    await db.collection('users').doc(uid).set({
      email,
      nombre: nombre || '',
      apellido: apellido || '',
      orgId,
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // 4. Create the member document inside the org
    await db.collection('organizations').doc(orgId).collection('members').doc(uid).set({
      name: [nombre, apellido].filter(Boolean).join(' ') || email.split('@')[0],
      email,
      role: 'admin',
      type: 'ambos',
      parentId: null,
      level: 0,
      active: true,
      inRoundRobin: false,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      permissions: Object.fromEntries([
        'can_see_all_leads', 'can_reassign_leads', 'can_edit_pipeline', 'can_discard_any_lead',
        'can_manage_products', 'can_see_team_reports', 'can_invite_members', 'can_configure_agent',
        'can_see_full_genealogy', 'can_manage_team', 'can_see_team_agenda', 'can_edit_any_lead',
      ].map(k => [k, true])),
      stats: {
        activeLeads: 0,
        closedThisMonth: 0,
        closedTotal: 0,
        conversionRate: 0,
        lastUpdated: null,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ uid, orgId }),
    }
  } catch (e) {
    console.error('create-org-user error:', e)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    }
  }
}
