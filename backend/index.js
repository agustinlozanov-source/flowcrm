require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

// ── Health check ──
app.get('/', (req, res) => res.json({ status: 'ok', service: 'FlowCRM Backend', version: '1.0.0' }))

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
