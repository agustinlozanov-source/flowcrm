const { Router } = require('express')
const { admin, db } = require('../config/firebase')

const router = Router()

// GET /meetings?orgId=xxx — Lista de reuniones
router.get('/', async (req, res) => {
  const { orgId } = req.query
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })
  try {
    const snap = await db.collection('organizations').doc(orgId)
      .collection('meetings')
      .orderBy('scheduledAt', 'asc').get()
    res.json({ meetings: snap.docs.map(d => ({ id: d.id, ...d.data() })) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /meetings — Crear reunión
router.post('/', async (req, res) => {
  const { orgId, leadId, title, scheduledAt, notes, assignedTo } = req.body
  if (!orgId || !title || !scheduledAt) return res.status(400).json({ error: 'Missing required fields' })
  try {
    const ref = await db.collection('organizations').doc(orgId).collection('meetings').add({
      leadId: leadId || null,
      title,
      scheduledAt: new Date(scheduledAt),
      notes: notes || '',
      assignedTo: assignedTo || null,
      status: 'scheduled',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    res.json({ success: true, meetingId: ref.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /meetings/:id — Actualizar reunión
router.put('/:id', async (req, res) => {
  const { orgId } = req.query
  const { id } = req.params
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })
  try {
    const allowed = ['title', 'scheduledAt', 'notes', 'status', 'assignedTo']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp()
    await db.collection('organizations').doc(orgId).collection('meetings').doc(id).update(updates)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /meetings/:id — Eliminar reunión
router.delete('/:id', async (req, res) => {
  const { orgId } = req.query
  const { id } = req.params
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' })
  try {
    await db.collection('organizations').doc(orgId).collection('meetings').doc(id).delete()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
