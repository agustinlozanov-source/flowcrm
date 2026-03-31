const { Router } = require('express')
const { admin, db } = require('../config/firebase')

const router = Router()

// ── Score calculator ──
function calcScore({ empresa, proposito, urgencia, valor_estimado }) {
  let score = 0
  if (empresa) score += 20
  if (proposito === 'Proceso judicial') score += 30
  else if (proposito === 'Siniestro') score += 30
  else if (proposito === 'Liquidación o concurso mercantil') score += 30
  if (urgencia === 'esta_semana') score += 40
  else if (urgencia === 'este_mes') score += 20
  if (valor_estimado === 'Más de $50M MXN') score += 30
  else if (valor_estimado === '$5M a $50M MXN') score += 20
  else if (valor_estimado === '$500K a $5M MXN') score += 10
  return score
}

// ── POST /web-leads ──
router.post('/', async (req, res) => {
  try {
    const {
      nombre, empresa, telefono, correo,
      tipo_activo, proposito, urgencia, valor_estimado,
      estado, descripcion, landingPageId,
      orgId = 'uZMwlNxde6TnqGo0HWiD',
    } = req.body

    if (!nombre) {
      return res.status(400).json({ error: 'El campo nombre es requerido' })
    }

    const score = calcScore({ empresa, proposito, urgencia, valor_estimado })

    // Obtener primer stage del pipeline
    const stagesSnap = await db
      .collection('organizations').doc(orgId)
      .collection('pipeline_stages')
      .orderBy('order', 'asc').limit(1).get()
    const stageId = stagesSnap.empty ? null : stagesSnap.docs[0].id

    const conversationText = descripcion || `Solicitud de avalúo desde ${landingPageId || 'web'}`

    const now = admin.firestore.FieldValue.serverTimestamp()

    // ── Buscar lead existente por correo ──
    let leadId = null
    let action = 'created'

    if (correo) {
      const existing = await db
        .collection('organizations').doc(orgId)
        .collection('leads')
        .where('email', '==', correo)
        .limit(1).get()

      if (!existing.empty) {
        leadId = existing.docs[0].id
        action = 'updated'

        await db.collection('organizations').doc(orgId)
          .collection('leads').doc(leadId)
          .update({
            name: nombre,
            phone: telefono || '',
            company: empresa || '',
            score,
            notes: descripcion || '',
            landingPageId: landingPageId || null,
            lastMessage: conversationText,
            lastMessageAt: now,
            lastMessageChannel: 'web',
            hasUnread: true,
            updatedAt: now,
            metadata: {
              tipo_activo: tipo_activo || '',
              proposito: proposito || '',
              urgencia: urgencia || '',
              valor_estimado: valor_estimado || '',
              estado_activo: estado || '',
            },
          })
      }
    }

    // ── Crear lead si no existe ──
    if (!leadId) {
      const ref = await db
        .collection('organizations').doc(orgId)
        .collection('leads')
        .add({
          name: nombre,
          phone: telefono || '',
          email: correo || '',
          company: empresa || '',
          source: 'web',
          landingPageId: landingPageId || null,
          stageId,
          score,
          assignedTo: null,
          channelIds: {},
          lastMessage: conversationText,
          lastMessageAt: now,
          lastMessageChannel: 'web',
          hasUnread: true,
          notes: descripcion || '',
          metadata: {
            tipo_activo: tipo_activo || '',
            proposito: proposito || '',
            urgencia: urgencia || '',
            valor_estimado: valor_estimado || '',
            estado_activo: estado || '',
          },
          createdAt: now,
          updatedAt: now,
        })
      leadId = ref.id
    }

    // ── Guardar mensaje inicial en conversations ──
    await db
      .collection('organizations').doc(orgId)
      .collection('leads').doc(leadId)
      .collection('conversations')
      .add({
        text: conversationText,
        channel: 'web',
        role: 'user',
        channelMsgId: null,
        read: false,
        createdAt: now,
      })

    console.log(`[web-leads] ${action} lead ${leadId} | score=${score} | org=${orgId}`)
    return res.json({ success: true, leadId, action, score })
  } catch (err) {
    console.error('[web-leads] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
