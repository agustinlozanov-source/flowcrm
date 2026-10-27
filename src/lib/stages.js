import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/* Los rangos de score reparten el 0-100 entre las cinco: sin ellos, el
 * scoring no sabe a que etapa mover un lead. */
export const DEFAULT_STAGES = [
  { name: 'Nuevo',      color: '#0066ff', order: 0, scoreMin: 0,  scoreMax: 20  },
  { name: 'Contactado', color: '#f59e0b', order: 1, scoreMin: 21, scoreMax: 40  },
  { name: 'Calificado', color: '#7c3aed', order: 2, scoreMin: 41, scoreMax: 60  },
  { name: 'Propuesta',  color: '#00b8d9', order: 3, scoreMin: 61, scoreMax: 80  },
  { name: 'Cierre',     color: '#00c853', order: 4, scoreMin: 81, scoreMax: 100 },
]

/**
 * Deja una organizacion nueva lista para trabajar: un pipeline con sus etapas.
 *
 * Antes sembraba las cinco etapas SUELTAS, sin pipelineId, y la organizacion
 * nacia con cero pipelines. Eso dejaba la cuenta inservible desde el primer
 * minuto — no se podia entrenar al agente ni recibir un lead — y ademas
 * activaba el caso de "etapas huerfanas", que le impide a la pantalla
 * seleccionar un pipeline sola.
 *
 * Con un pipeline de verdad desde el arranque, la cuenta sirve sin que nadie
 * tenga que adivinar que lo primero es crear uno.
 */
export async function seedDefaultStages(orgId) {
  const pipelineRef = await addDoc(collection(db, 'organizations', orgId, 'pipelines'), {
    name: 'Pipeline principal',
    purpose: null,
    handoffBoundDays: 3,
    handoffBoundActive: false,
    autoAssign: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const stagesRef = collection(db, 'organizations', orgId, 'pipeline_stages')
  await Promise.all(DEFAULT_STAGES.map((stage) =>
    addDoc(stagesRef, { ...stage, pipelineId: pipelineRef.id, createdAt: serverTimestamp() })
  ))

  return pipelineRef.id
}
