const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = admin.firestore()

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { stages } = JSON.parse(event.body)
    if (!stages || !Array.isArray(stages)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'stages array requerido' }) }
    }

    const FIXED_STAGE = { name: 'Verificado — Activo', color: '#00c853', scoreMin: 98, scoreMax: 100, locked: true }
    const allStages = [...stages, FIXED_STAGE]

    // Buscar todos los orgs distribuidores (Admin SDK bypasea security rules)
    const orgsSnap = await db.collection('organizations').where('isDistribuidor', '==', true).get()
    console.log('[sync-pipeline] orgs distribuidoras:', orgsSnap.size)

    let updated = 0
    const errors = []

    for (const orgDoc of orgsSnap.docs) {
      const oId = orgDoc.id
      try {
        // Buscar pipeline FlowHub
        const pipesSnap = await db.collection('organizations').doc(oId)
          .collection('pipelines').where('isFlowHubPipeline', '==', true).get()

        if (pipesSnap.empty) {
          console.warn(`[sync-pipeline] org ${oId} sin pipeline FlowHub`)
          continue
        }
        const pipelineId = pipesSnap.docs[0].id

        // Borrar etapas actuales del pipeline
        const stagesSnap = await db.collection('organizations').doc(oId)
          .collection('pipeline_stages').where('pipelineId', '==', pipelineId).get()

        const batch = db.batch()
        for (const s of stagesSnap.docs) batch.delete(s.ref)

        // Recrear etapas desde config
        for (const [idx, stage] of allStages.entries()) {
          const ref = db.collection('organizations').doc(oId).collection('pipeline_stages').doc()
          batch.set(ref, {
            name: stage.name,
            color: stage.color,
            scoreMin: stage.scoreMin,
            scoreMax: stage.scoreMax,
            order: idx + 1,
            locked: stage.locked ?? false,
            pipelineId,
            isFlowHubStage: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }

        await batch.commit()
        console.log(`[sync-pipeline] org ${oId} ✓ ${allStages.length} etapas`)
        updated++
      } catch (err) {
        console.error(`[sync-pipeline] ERROR org ${oId}:`, err.message)
        errors.push({ orgId: oId, error: err.message })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, total: orgsSnap.size, updated, errors }),
    }
  } catch (err) {
    console.error('[sync-pipeline] fatal:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
