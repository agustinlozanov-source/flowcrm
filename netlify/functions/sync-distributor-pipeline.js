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
    console.log('[sync-pipeline] orgs distribuidoras:', orgsSnap.size, orgsSnap.docs.map(d => d.id))

    let updated = 0
    const log = []
    const errors = []

    for (const orgDoc of orgsSnap.docs) {
      const oId = orgDoc.id
      const entry = { orgId: oId, pipeline: null, stagesDeleted: 0, stagesCreated: 0, ok: false, error: null }
      try {
        // Buscar TODOS los pipelines FlowHub del org
        const pipesSnap = await db.collection('organizations').doc(oId)
          .collection('pipelines').where('isFlowHubPipeline', '==', true).get()

        entry.pipelinesFound = pipesSnap.size
        if (pipesSnap.empty) {
          entry.error = 'sin pipeline isFlowHubPipeline'
          log.push(entry)
          console.warn(`[sync-pipeline] org ${oId} sin pipeline FlowHub`)
          continue
        }

        // Actualizar cada pipeline FlowHub encontrado
        for (const pipeDoc of pipesSnap.docs) {
          const pipelineId = pipeDoc.id
          entry.pipeline = pipelineId

          // Borrar etapas actuales del pipeline
          const stagesSnap = await db.collection('organizations').doc(oId)
            .collection('pipeline_stages').where('pipelineId', '==', pipelineId).get()

          entry.stagesDeleted = (entry.stagesDeleted || 0) + stagesSnap.size
          console.log(`[sync-pipeline] org ${oId} pipeline=${pipelineId} etapas a borrar=${stagesSnap.size}`)

          const batch = db.batch()
          for (const s of stagesSnap.docs) batch.delete(s.ref)

          // Recrear etapas desde config
          for (const [idx, stage] of allStages.entries()) {
            const ref = db.collection('organizations').doc(oId).collection('pipeline_stages').doc()
            batch.set(ref, {
              name: stage.name,
              color: stage.color,
              scoreMin: Number(stage.scoreMin),
              scoreMax: Number(stage.scoreMax),
              order: idx + 1,
              locked: stage.locked ?? false,
              pipelineId,
              isFlowHubStage: true,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            })
          }
          entry.stagesCreated = (entry.stagesCreated || 0) + allStages.length

          await batch.commit()
          console.log(`[sync-pipeline] org ${oId} pipeline=${pipelineId} ✓ batch committed — ${allStages.length} etapas`)
        }

        entry.ok = true
        updated++
      } catch (err) {
        entry.error = err.message
        console.error(`[sync-pipeline] ERROR org ${oId}:`, err.message)
        errors.push({ orgId: oId, error: err.message })
      }
      log.push(entry)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, total: orgsSnap.size, updated, errors, log }),
    }
  } catch (err) {
    console.error('[sync-pipeline] fatal:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
