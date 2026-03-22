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

// ── POST /leads — Crear lead ──
router.post('/', async (req, res) => {
  try {
    const {
      orgId, name, lastName, email, phone, company,
      stageId, pipelineId, productId, productValue, source,
    } = req.body

    if (!orgId || !name) {
      return res.status(400).json({ error: 'orgId y name son requeridos' })
    }

    const leadRef = await db.collection('organizations').doc(orgId).collection('leads').add({
      name: name || '',
      lastName: lastName || '',
      email: email || '',
      phone: phone || '',
      company: company || '',
      stageId: stageId || null,
      pipelineId: pipelineId || null,
      productId: productId || null,
      productValue: productValue ?? null,
      source: source || 'manual',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    res.status(201).json({ success: true, leadId: leadRef.id })
  } catch (err) {
    console.error('POST /leads error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /leads?orgId=&pipelineId= — Listar leads por pipeline ──
router.get('/', async (req, res) => {
  try {
    const { orgId, pipelineId } = req.query

    if (!orgId) {
      return res.status(400).json({ error: 'orgId es requerido' })
    }

    let query = db.collection('organizations').doc(orgId).collection('leads')
      .orderBy('createdAt', 'desc')

    if (pipelineId) {
      query = query.where('pipelineId', '==', pipelineId)
    }

    const snap = await query.get()
    const leads = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    res.json({ leads })
  } catch (err) {
    console.error('GET /leads error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /leads/:id/stage?orgId= — Actualizar stageId de un lead ──
router.put('/:id/stage', async (req, res) => {
  try {
    const { orgId } = req.query
    const { stageId } = req.body
    const { id } = req.params

    if (!orgId || !stageId) {
      return res.status(400).json({ error: 'orgId y stageId son requeridos' })
    }

    await db.collection('organizations').doc(orgId).collection('leads').doc(id).update({
      stageId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    res.json({ success: true })
  } catch (err) {
    console.error('PUT /leads/:id/stage error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /leads/:id?orgId= — Eliminar lead ──
router.delete('/:id', async (req, res) => {
  try {
    const { orgId } = req.query
    const { id } = req.params

    if (!orgId) {
      return res.status(400).json({ error: 'orgId es requerido' })
    }

    await db.collection('organizations').doc(orgId).collection('leads').doc(id).delete()

    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /leads/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
