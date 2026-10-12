/* Oportunidades de un lead.
 *
 * Un lead ya no vale una sola cosa. En una clínica de visión, la misma persona
 * puede tener la consulta —que se cierra rápido— y una cirugía láser que sigue
 * abierta meses. Antes el lead tenía un producto y un monto, así que la segunda
 * no existía en ningún lado y cerrar la primera daba el lead por cerrado.
 *
 * Los totales se copian al documento del lead a propósito. El board lee cientos
 * de leads de una sola consulta; si el valor viviera solo en la subcolección,
 * habría que abrir una consulta por tarjeta para pintar el board.
 */
import { useEffect, useState } from 'react'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  getDocs, getDoc, query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

export const ESTADOS_ABIERTOS = ['abierta']

const ref = (orgId, leadId) =>
  collection(db, 'organizations', orgId, 'leads', leadId, 'opportunities')

/* Dos ejes que no hay que confundir.
 *
 * kind dice qué clase de oportunidad es: `real` es la de entrada —la cita, la
 * consulta de valoración—, lo concreto que está por pasar. `potencial` es lo
 * que ya se sabe que viene detrás por el problema que contó el lead: la
 * endodoncia, la cirugía láser. Eso alimenta Real y Potencial del board.
 *
 * status dice si se cerró o no, y eso alimenta el color del cierre: mientras
 * quede una abierta es cierre parcial.
 *
 * Medir Real como "lo ya vendido" era un error: en calentamiento todavía no se
 * vendió nada, así que Real daba cero siempre y no decía nada.
 */
const VIVAS = ['abierta', 'ganada']

async function recalcular(orgId, leadId) {
  const snap = await getDocs(ref(orgId, leadId))
  const todas = snap.docs.map(d => d.data())
  const abiertas = todas.filter(o => o.status === 'abierta')
  const ganadas = todas.filter(o => o.status === 'ganada')
  const vivas = todas.filter(o => VIVAS.includes(o.status))
  const suma = arr => arr.reduce((s, o) => s + (Number(o.value) || 0), 0)

  const leadRef = doc(db, 'organizations', orgId, 'leads', leadId)
  const cambios = {
    opportunityStats: {
      total: todas.length,
      open: abiertas.length,
      won: ganadas.length,
      valueOpen: suma(abiertas),
      valueWon: suma(ganadas),
      // Las descartadas y perdidas no suman en ninguno de los dos.
      valueReal: suma(vivas.filter(o => (o.kind || 'real') === 'real')),
      valuePotencial: suma(vivas.filter(o => o.kind === 'potencial')),
    },
    updatedAt: serverTimestamp(),
  }

  /* Cerrar una oportunidad como ganada mueve el lead a Cierre definitivo.
   *
   * Cobrar la consulta y dejar la cirugía abierta ya es un cierre parcial: el
   * lead no tiene nada que hacer en Handoff, que es "falta llamarlo". Antes
   * había que cerrar la oportunidad y además arrastrar la tarjeta a mano.
   *
   * Si queda algo abierto el estado es "oportunidad segura" —hay plata
   * confirmada y algo vivo— y cuando no queda nada abierto, venta cerrada.
   * El color azul o morado sale solo de esos mismos números.
   *
   * Solo avanza: nunca saca un lead de Cierre, para no deshacer a sus espaldas
   * algo que una persona decidió.
   */
  if (ganadas.length > 0) {
    const leadSnap = await getDoc(leadRef)
    const etapaActual = leadSnap.data()?.systemStage
    const yaEstaEnCierre = ['open_opportunity', 'secure_opportunity', 'closed'].includes(etapaActual)
    const destino = abiertas.length > 0 ? 'secure_opportunity' : 'closed'

    if (!yaEstaEnCierre || (etapaActual !== 'closed' && destino === 'closed')) {
      cambios.systemStage = destino
      cambios.systemStageAt = serverTimestamp()
      cambios.stageId = null
    }
  }

  await updateDoc(leadRef, cambios)
}

export function useOpportunities(leadId) {
  const { org, user } = useAuthStore()
  const orgId = org?.id
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId || !leadId) { setOpportunities([]); setLoading(false); return }
    setLoading(true)
    const unsub = onSnapshot(
      query(ref(orgId, leadId), orderBy('createdAt', 'asc')),
      snap => {
        setOpportunities(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [orgId, leadId])

  const crear = async ({ name, value, productId = null, probability = 'media', auto = false, reason = '', kind }) => {
    if (!orgId || !leadId) return
    // La primera que se abre es la de entrada; las siguientes son lo que viene
    // detrás. Se puede cambiar después.
    const tipo = kind || (opportunities.length === 0 ? 'real' : 'potencial')
    const docRef = await addDoc(ref(orgId, leadId), {
      name,
      value: Number(value) || 0,
      productId,
      kind: tipo,
      probability,
      status: 'abierta',
      // Quién la abrió: la IA cuando la detecta sola, la persona si no.
      auto,
      reason: reason || '',
      createdBy: auto ? 'agent' : (user?.uid || null),
      createdAt: serverTimestamp(),
    })
    await recalcular(orgId, leadId)
    return docRef.id
  }

  const cambiarEstado = async (oppId, status, extra = {}) => {
    if (!orgId || !leadId) return
    await updateDoc(doc(ref(orgId, leadId), oppId), {
      status,
      closedAt: status === 'abierta' ? null : serverTimestamp(),
      closedBy: status === 'abierta' ? null : (user?.uid || null),
      ...extra,
    })
    await recalcular(orgId, leadId)
  }

  const editar = async (oppId, data) => {
    if (!orgId || !leadId) return
    await updateDoc(doc(ref(orgId, leadId), oppId), {
      ...data,
      ...(data.value != null ? { value: Number(data.value) || 0 } : {}),
    })
    await recalcular(orgId, leadId)
  }

  const borrar = async (oppId) => {
    if (!orgId || !leadId) return
    await deleteDoc(doc(ref(orgId, leadId), oppId))
    await recalcular(orgId, leadId)
  }

  return { opportunities, loading, crear, cambiarEstado, editar, borrar }
}
