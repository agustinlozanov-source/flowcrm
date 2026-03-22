const { Router } = require('express')
const { admin, db } = require('../config/firebase')

const router = Router()

/**
 * POST /imports — Importación masiva de contactos (CSV procesado)
 * Body: { orgId, contacts: [{name, email, phone, company, ...}], source }
 */
router.post('/', async (req, res) => {
  const { orgId, contacts, source = 'import' } = req.body
  if (!orgId || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Missing orgId or contacts array' })
  }

  try {
    // Get first pipeline stage
    const stagesSnap = await db.collection('organizations').doc(orgId)
      .collection('pipeline_stages').orderBy('order', 'asc').limit(1).get()
    const defaultStageId = stagesSnap.empty ? null : stagesSnap.docs[0].id

    const results = { created: 0, skipped: 0, errors: 0 }
    const BATCH_SIZE = 400

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = db.batch()
      const chunk = contacts.slice(i, i + BATCH_SIZE)

      for (const contact of chunk) {
        if (!contact.name && !contact.email && !contact.phone) {
          results.skipped++
          continue
        }

        // Check for duplicate by email
        if (contact.email) {
          const existing = await db.collection('organizations').doc(orgId)
            .collection('leads').where('email', '==', contact.email).limit(1).get()
          if (!existing.empty) {
            results.skipped++
            continue
          }
        }

        const ref = db.collection('organizations').doc(orgId).collection('leads').doc()
        batch.set(ref, {
          name: contact.name || '',
          email: contact.email || '',
          phone: contact.phone || '',
          company: contact.company || '',
          notes: contact.notes || '',
          source,
          stageId: contact.stageId || defaultStageId,
          score: 0,
          assignedTo: null,
          tags: contact.tags || [],
          channelIds: {},
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        results.created++
      }

      await batch.commit()
    }

    res.json({ success: true, results })
  } catch (err) {
    console.error('Import error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
