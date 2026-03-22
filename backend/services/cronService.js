const { db, admin } = require('../config/firebase')

/**
 * Busca leads que necesitan seguimiento y genera tareas proactivas.
 * Se puede disparar con setInterval o con un cron job externo vía POST /cron/run
 */
async function runFollowUpJob() {
  console.log('🔄 Cron: iniciando job de seguimiento proactivo...')
  const orgsSnap = await db.collection('organizations').get()

  for (const orgDoc of orgsSnap.docs) {
    const orgId = orgDoc.id
    try {
      await checkStaleLeads(orgId)
    } catch (err) {
      console.error(`Cron error para org ${orgId}:`, err.message)
    }
  }
  console.log('✅ Cron: job de seguimiento completado')
}

/**
 * Detecta leads sin actividad en más de N días y crea una tarea de seguimiento.
 */
async function checkStaleLeads(orgId, staleDays = 3) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - staleDays)

  const leadsSnap = await db
    .collection('organizations').doc(orgId)
    .collection('leads')
    .where('updatedAt', '<', cutoff)
    .where('stageId', '!=', null)
    .limit(50)
    .get()

  for (const leadDoc of leadsSnap.docs) {
    const lead = leadDoc.data()

    // Verificar si ya tiene una tarea pendiente de seguimiento
    const existingTask = await db
      .collection('organizations').doc(orgId)
      .collection('tasks')
      .where('leadId', '==', leadDoc.id)
      .where('status', '==', 'pending')
      .where('type', '==', 'followup')
      .limit(1).get()

    if (!existingTask.empty) continue

    await db.collection('organizations').doc(orgId).collection('tasks').add({
      leadId: leadDoc.id,
      leadName: lead.name,
      type: 'followup',
      title: `Seguimiento a ${lead.name}`,
      description: `Sin actividad por más de ${staleDays} días.`,
      status: 'pending',
      dueAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`📋 Tarea creada para lead: ${lead.name} (org: ${orgId})`)
  }
}

module.exports = { runFollowUpJob, checkStaleLeads }
