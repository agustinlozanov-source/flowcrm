require('dotenv').config({ override: false }) // No sobreescribir variables ya definidas en Railway
const express = require('express')
const cors = require('cors')
const { admin, db } = require('./config/firebase')

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

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

// ── Web Leads — landing pages externas ──
app.post('/web-leads', async (req, res) => {
  try {
    const {
      nombre, empresa, telefono, correo,
      tipo_activo, proposito, urgencia,
      valor_estimado, estado, descripcion,
      landingPageId = 'landing',
      orgId = 'uZMwlNxde6TnqGo0HWiD',
      tracking = {}
    } = req.body;

    if (!nombre || !telefono || !correo) {
      return res.status(400).json({ error: 'nombre, telefono y correo son requeridos' });
    }

    let score = 0;
    if (empresa) score += 20;
    if (proposito === 'Proceso judicial') score += 30;
    if (proposito === 'Siniestro') score += 30;
    if (proposito === 'Liquidación o concurso mercantil') score += 30;
    if (urgencia === 'esta_semana') score += 40;
    if (urgencia === 'este_mes') score += 20;
    if (valor_estimado === 'Más de $50M MXN') score += 30;
    if (valor_estimado === '$5M a $50M MXN') score += 20;
    if (valor_estimado === '$500K a $5M MXN') score += 10;

    const orgRef = db.collection('organizations').doc(orgId);

    const existing = await orgRef.collection('leads')
      .where('email', '==', correo).limit(1).get();

    if (!existing.empty) {
      await existing.docs[0].ref.update({
        updatedAt: admin.firestore.Timestamp.now(),
        score: Math.max(existing.docs[0].data().score || 0, score),
        lastMessage: descripcion || `Nuevo contacto desde ${landingPageId}`,
        lastMessageAt: admin.firestore.Timestamp.now(),
        hasUnread: true,
        tracking: {
          utm_source: tracking.utm_source || '',
          utm_medium: tracking.utm_medium || '',
          utm_campaign: tracking.utm_campaign || '',
          utm_content: tracking.utm_content || '',
          utm_term: tracking.utm_term || '',
          fbclid: tracking.fbclid || '',
          fbc: tracking.fbc || '',
          fbp: tracking.fbp || '',
          event_id: tracking.event_id || '',
          landing_name: tracking.landing_name || '',
        },
      });
      return res.json({ success: true, leadId: existing.docs[0].id, action: 'updated' });
    }

    const stages = await orgRef.collection('pipeline_stages')
      .orderBy('order', 'asc').limit(1).get();
    const stageId = stages.empty ? null : stages.docs[0].id;

    const leadRef = await orgRef.collection('leads').add({
      name: nombre,
      phone: telefono,
      email: correo,
      company: empresa || '',
      source: 'web',
      landingPageId,
      stageId,
      score,
      assignedTo: null,
      channelIds: {},
      lastMessage: descripcion || `Solicitud desde ${landingPageId}`,
      lastMessageAt: admin.firestore.Timestamp.now(),
      lastMessageChannel: 'web',
      hasUnread: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      notes: descripcion || '',
      metadata: {
        tipo_activo: tipo_activo || '',
        proposito: proposito || '',
        urgencia: urgencia || '',
        valor_estimado: valor_estimado || '',
        estado_activo: estado || '',
      },
      tracking: {
        utm_source: tracking.utm_source || '',
        utm_medium: tracking.utm_medium || '',
        utm_campaign: tracking.utm_campaign || '',
        utm_content: tracking.utm_content || '',
        utm_term: tracking.utm_term || '',
        fbclid: tracking.fbclid || '',
        fbc: tracking.fbc || '',
        fbp: tracking.fbp || '',
        event_id: tracking.event_id || '',
        landing_name: tracking.landing_name || '',
      }
    });

    await leadRef.collection('conversations').add({
      text: descripcion || `Solicitud desde ${landingPageId}`,
      channel: 'web',
      role: 'user',
      channelMsgId: null,
      read: false,
      createdAt: admin.firestore.Timestamp.now(),
    });

    return res.json({ success: true, leadId: leadRef.id, action: 'created', score });

  } catch (error) {
    console.error('Error web-leads:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🚀 FlowCRM Backend corriendo en puerto ${PORT}`)
})
