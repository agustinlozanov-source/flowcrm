/* Leer de Firestore todo lo que el Scorecard necesita, ya convertido a lo que
 * espera el cálculo: fechas en milisegundos y solo los campos que se usan.
 *
 * Vive aparte del cálculo para que el cálculo no sepa nada de Firestore y se
 * pueda probar con datos inventados, y para que mudar a Supabase sea
 * reescribir este archivo y nada más.
 */
const admin = require('firebase-admin')
const { voz } = require('./calculo')

/* Más allá de esto la lectura no cabe cómoda en memoria. Si una organización
 * lo supera, el reporte lo dice en sus advertencias en vez de callarlo. */
const TOPE_LEADS = 25000

function ms(v) {
  if (!v) return 0
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v === 'number') return v
  if (v._seconds) return v._seconds * 1000
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : 0
}

const ts = (msValor) => admin.firestore.Timestamp.fromMillis(msValor)

async function cargar(db, orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const advertencias = []

  const [orgSnap, pipesSnap, etapasSnap, leadsSnap, citasSnap, miembrosSnap] = await Promise.all([
    orgRef.get(),
    orgRef.collection('pipelines').get(),
    orgRef.collection('pipeline_stages').get(),
    orgRef.collection('leads')
      .select('name', 'lastName', 'pipelineId', 'stageId', 'systemStage', 'discarded', 'discardCategory',
        'score', 'assignedTo', 'createdAt', 'lastMessageAt', 'lastInboundAt', 'hasUnread', 'handoffAt',
        'updatedAt', 'opportunityStats', 'source')
      .limit(TOPE_LEADS).get(),
    orgRef.collection('appointments')
      .select('leadId', 'status', 'scheduledAt', 'createdAt', 'createdByAgent', 'assignedTo', 'type').get(),
    orgRef.collection('members').get(),
  ])

  if (leadsSnap.size >= TOPE_LEADS) {
    advertencias.push(`La organización tiene más de ${TOPE_LEADS} leads y solo se leyeron los primeros ${TOPE_LEADS}.`)
  }

  const org = orgSnap.data() || {}
  const leads = leadsSnap.docs.map(d => {
    const x = d.data()
    return {
      id: d.id, name: x.name || '', lastName: x.lastName || '', pipelineId: x.pipelineId || null,
      stageId: x.stageId || null, systemStage: x.systemStage || null, discarded: x.discarded === true,
      discardCategory: x.discardCategory || null, score: Number(x.score) || 0, assignedTo: x.assignedTo || null,
      createdAt: ms(x.createdAt), lastMessageAt: ms(x.lastMessageAt), lastInboundAt: ms(x.lastInboundAt),
      hasUnread: x.hasUnread === true, handoffAt: ms(x.handoffAt), updatedAt: ms(x.updatedAt),
      tieneOportunidades: (x.opportunityStats?.total || 0) > 0, source: x.source || null,
    }
  })

  const citas = citasSnap.docs.map(d => {
    const x = d.data()
    return {
      id: d.id, leadId: x.leadId || null, status: x.status || 'pending', scheduledAt: ms(x.scheduledAt),
      createdAt: ms(x.createdAt), createdByAgent: x.createdByAgent === true, assignedTo: x.assignedTo || null,
      type: x.type || 'otro',
    }
  })

  /* Esta consulta ya la hace la pantalla de Actividad, así que su índice
     existe en producción. */
  const actsSnap = await db.collectionGroup('activities').where('orgId', '==', orgId).get()
  const actividades = actsSnap.docs.map(d => {
    const x = d.data()
    return {
      id: d.id, leadId: x.leadId || d.ref.parent.parent?.id || null, tipo: x.tipo || null, estado: x.estado || null,
      occurredAt: ms(x.occurredAt), createdAt: ms(x.createdAt), automatica: x.automatica === true,
    }
  })

  /* La de oportunidades solo se usa en la app combinada con el mes de cierre,
     y no hay garantía de que exista el índice para la igualdad sola. Si
     falla, se leen lead por lead, solo de los que dicen tener oportunidades. */
  let oportunidades = []
  const mapear = (d) => {
    const x = d.data()
    return {
      id: d.id, leadId: x.leadId || d.ref.parent.parent?.id || null, status: x.status || 'abierta',
      value: Number(x.value) || 0, createdAt: ms(x.createdAt), closedAt: ms(x.closedAt),
    }
  }
  try {
    const s = await db.collectionGroup('opportunities').where('orgId', '==', orgId).get()
    oportunidades = s.docs.map(mapear)
  } catch {
    const conOpps = leads.filter(l => l.tieneOportunidades)
    for (const l of conOpps) {
      const s = await orgRef.collection('leads').doc(l.id).collection('opportunities').get()
      oportunidades.push(...s.docs.map(mapear))
    }
  }

  return {
    organizacion: {
      id: orgId, nombre: org.name || '', zona: org.timezone || 'America/Mexico_City',
      addons: org.addons || [],
    },
    pipelines: pipesSnap.docs.map(d => ({ id: d.id, name: d.data().name || 'Embudo' })),
    stages: etapasSnap.docs.map(d => {
      const x = d.data()
      return { id: d.id, pipelineId: x.pipelineId || null, name: x.name || '', fase: x.fase || 'calentamiento',
        order: x.order ?? 0, scoreMin: x.scoreMin ?? 0, scoreMax: x.scoreMax ?? 100 }
    }),
    miembros: miembrosSnap.docs.map(d => ({ uid: d.id, nombre: d.data().name || d.data().email || '' })),
    leads, citas, actividades, oportunidades, advertencias,
  }
}

/** Los leads con mensajes en el periodo: los que hay que leer. */
async function candidatos(db, orgId, desde, hasta) {
  const s = await db.collection('organizations').doc(orgId).collection('leads')
    .where('lastMessageAt', '>=', ts(desde)).select('createdAt').get()
  return s.docs.filter(d => ms(d.data().createdAt) <= hasta).map(d => d.id)
}

/** La conversación de un lead dentro del periodo, en orden. */
async function mensajesDe(db, orgId, leadId, desde, hasta) {
  const s = await db.collection('organizations').doc(orgId).collection('leads').doc(leadId)
    .collection('conversations')
    .where('createdAt', '>=', ts(desde)).where('createdAt', '<=', ts(hasta))
    .orderBy('createdAt').get()
  return s.docs.map(d => {
    const x = d.data()
    return { de: voz(x.role), texto: x.text || x.content || '', t: ms(x.createdAt) }
  })
}

module.exports = { cargar, candidatos, mensajesDe, ms, ts, TOPE_LEADS }
