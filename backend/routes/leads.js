const { Router } = require('express')
const { admin, db } = require('../config/firebase')

const router = Router()

// ── POST /leads/submit — Landing page form submission ──
router.post('/submit', async (req, res) => {
  const headers = { 'Access-Control-Allow-Origin': '*' }

  try {
    const { orgId, pageId, formData, source } = req.body

    if (!orgId || !formData?.name) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const pageSnap = await db.collection('organizations').doc(orgId).collection('landing_pages').doc(pageId).get()
    const pageData = pageSnap.exists ? pageSnap.data() : {}
    let stageId = pageData.targetStageId || null

    if (!stageId) {
      const stagesSnap = await db.collection('organizations').doc(orgId)
        .collection('pipeline_stages').orderBy('order', 'asc').limit(1).get()
      if (!stagesSnap.empty) stageId = stagesSnap.docs[0].id
    }

    const leadRef = await db.collection('organizations').doc(orgId).collection('leads').add({
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

    if (pageId) {
      await db.collection('organizations').doc(orgId).collection('landing_pages').doc(pageId).update({
        conversions: admin.firestore.FieldValue.increment(1),
        lastConversionAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    res.json({ success: true, leadId: leadRef.id })
  } catch (err) {
    console.error('submit-lead error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
