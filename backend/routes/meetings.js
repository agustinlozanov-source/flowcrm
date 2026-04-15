const { Router } = require('express')
const { admin, db } = require('../config/firebase')
const { google } = require('googleapis')

const router = Router()

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

// GET /meetings/auth/google?orgId=xxx — Inicia OAuth
router.get('/auth/google', (req, res) => {
  const { orgId } = req.query
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: orgId,
  })
  res.redirect(url)
})

// GET /meetings/auth/google/callback — Recibe token y guarda en Firestore
router.get('/auth/google/callback', async (req, res) => {
  const { code, state: orgId } = req.query
  try {
    const { tokens } = await oauth2Client.getToken(code)
    await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').set({
        googleCalendar: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date,
          connected: true,
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      }, { merge: true })
    res.redirect(`https://flowcrm.netlify.app/meetings?google=connected`)
  } catch (err) {
    console.error('Google OAuth callback error:', err.message)
    res.redirect(`https://flowcrm.netlify.app/meetings?google=error`)
  }
})

// POST /meetings/google/create — Crea evento en Google Calendar
router.post('/google/create', async (req, res) => {
  const { orgId, title, scheduledAt, duration, leadEmail, leadName, notes } = req.body
  if (!orgId || !title || !scheduledAt) return res.status(400).json({ error: 'Missing required fields' })
  try {
    const integSnap = await db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations').get()
    const tokens = integSnap.data()?.googleCalendar
    if (!tokens?.connected) return res.status(400).json({ error: 'Google Calendar no conectado' })

    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const start = new Date(scheduledAt)
    const end = new Date(start.getTime() + (duration || 30) * 60000)

    const event = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: title,
        description: notes || '',
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        conferenceData: { createRequest: { requestId: `flowcrm-${Date.now()}` } },
        attendees: leadEmail ? [{ email: leadEmail, displayName: leadName }] : [],
      }
    })

    const meetLink = event.data.conferenceData?.entryPoints?.[0]?.uri || ''
    res.json({ success: true, meetLink, eventId: event.data.id })
  } catch (err) {
    console.error('Google Calendar error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

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
