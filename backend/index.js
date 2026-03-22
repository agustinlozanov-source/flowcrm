require('dotenv').config({ override: false }) // No sobreescribir variables ya definidas en Railway
const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

// ── Health check ──
app.get('/', (req, res) => res.json({ status: 'ok', service: 'FlowCRM Backend', version: '1.0.0' }))

// ── Debug temporal (eliminar luego) ──
app.get('/debug/env', (req, res) => {
  res.json({
    META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN ? `SET (${process.env.META_VERIFY_TOKEN.length} chars)` : 'NOT SET',
    DEFAULT_ORG_ID: process.env.DEFAULT_ORG_ID ? 'SET' : 'NOT SET',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  })
})

// ── Routes ──
app.use('/webhooks', require('./routes/webhooks'))
app.use('/leads', require('./routes/leads'))
app.use('/contacts', require('./routes/contacts'))
app.use('/meetings', require('./routes/meetings'))
app.use('/imports', require('./routes/imports'))
app.use('/agent', require('./routes/agent'))

// ── Cron trigger manual (Railway cron o ping externo) ──
app.post('/cron/run', async (req, res) => {
  const { runFollowUpJob } = require('./services/cronService')
  await runFollowUpJob()
  res.json({ success: true })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🚀 FlowCRM Backend corriendo en puerto ${PORT}`)
})
