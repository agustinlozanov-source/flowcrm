const admin = require('firebase-admin')

// Initialize Firebase Admin if not already initialized
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
  // Allow CORS for landing page domains
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { orgId, pageId, formData, source } = JSON.parse(event.body)

    if (!orgId || !formData?.name) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    // Get the landing page config to find target stage
    const pageSnap = await db
      .collection('organizations').doc(orgId)
      .collection('landing_pages').doc(pageId)
      .get()

    const pageData = pageSnap.exists ? pageSnap.data() : {}
    const targetStageId = pageData.targetStageId || null

    // Get first stage if no target specified
    let stageId = targetStageId
    if (!stageId) {
      const stagesSnap = await db
        .collection('organizations').doc(orgId)
        .collection('pipeline_stages')
        .orderBy('order', 'asc')
        .limit(1)
        .get()
      if (!stagesSnap.empty) stageId = stagesSnap.docs[0].id
    }

    // Create lead
    const leadRef = await db
      .collection('organizations').doc(orgId)
      .collection('leads')
      .add({
        name: formData.name || '',
        email: formData.email || '',
        phone: formData.phone || '',
        company: formData.company || '',
        notes: formData.message || '',
        source: source || 'web',
        stageId,
        score: 0,
        assignedTo: null,
        landingPageId: pageId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

    // Increment page conversion count
    if (pageId) {
      await db
        .collection('organizations').doc(orgId)
        .collection('landing_pages').doc(pageId)
        .update({
          conversions: admin.firestore.FieldValue.increment(1),
          lastConversionAt: admin.firestore.FieldValue.serverTimestamp(),
        })
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, leadId: leadRef.id }),
    }
  } catch (err) {
    console.error('submit-lead error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
