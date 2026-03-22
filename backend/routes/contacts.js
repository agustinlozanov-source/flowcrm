const { Router } = require('express')
const { admin, db } = require('../config/firebase')

const router = Router()

// GET /contacts?orgId=xxx — Lista de contactos
router.get('/', async (req, res) => {
  const { orgId, limit = 50, stage } = req.query
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })
  try {
    let query = db.collection('organizations').doc(orgId).collection('leads').orderBy('createdAt', 'desc').limit(Number(limit))
    if (stage) query = query.where('stageId', '==', stage)
    const snap = await query.get()
    const contacts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json({ contacts })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /contacts/:id — Detalle de contacto + historial
router.get('/:id', async (req, res) => {
  const { orgId } = req.query
  const { id } = req.params
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })
  try {
    const leadSnap = await db.collection('organizations').doc(orgId).collection('leads').doc(id).get()
    if (!leadSnap.exists) return res.status(404).json({ error: 'Contact not found' })

    const conversationsSnap = await db.collection('organizations').doc(orgId)
      .collection('leads').doc(id)
      .collection('conversations')
      .orderBy('createdAt', 'asc').limit(100).get()

    const conversations = conversationsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json({ contact: { id: leadSnap.id, ...leadSnap.data() }, conversations })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /contacts/:id — Actualizar contacto
router.put('/:id', async (req, res) => {
  const { orgId } = req.query
  const { id } = req.params
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })
  try {
    const allowed = ['name', 'email', 'phone', 'company', 'notes', 'stageId', 'score', 'assignedTo', 'tags']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp()
    await db.collection('organizations').doc(orgId).collection('leads').doc(id).update(updates)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /contacts/:id — Eliminar contacto
router.delete('/:id', async (req, res) => {
  const { orgId } = req.query
  const { id } = req.params
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })
  try {
    await db.collection('organizations').doc(orgId).collection('leads').doc(id).delete()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
