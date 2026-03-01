import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export const DEFAULT_STAGES = [
  { name: 'Nuevo',      color: '#0066ff', order: 0 },
  { name: 'Contactado', color: '#f59e0b', order: 1 },
  { name: 'Calificado', color: '#7c3aed', order: 2 },
  { name: 'Propuesta',  color: '#00b8d9', order: 3 },
  { name: 'Cierre',     color: '#00c853', order: 4 },
]

export async function seedDefaultStages(orgId) {
  const stagesRef = collection(db, 'organizations', orgId, 'pipeline_stages')
  const promises = DEFAULT_STAGES.map((stage) =>
    addDoc(stagesRef, { ...stage, createdAt: serverTimestamp() })
  )
  await Promise.all(promises)
}
