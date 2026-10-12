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
  getDocs, query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

export const ESTADOS_ABIERTOS = ['abierta']

const ref = (orgId, leadId) =>
  collection(db, 'organizations', orgId, 'leads', leadId, 'opportunities')

/** Suma el estado de las oportunidades y lo deja escrito en el lead. */
async function recalcular(orgId, leadId) {
  const snap = await getDocs(ref(orgId, leadId))
  const todas = snap.docs.map(d => d.data())
  const abiertas = todas.filter(o => o.status === 'abierta')
  const ganadas = todas.filter(o => o.status === 'ganada')

  await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
    opportunityStats: {
      total: todas.length,
      open: abiertas.length,
      won: ganadas.length,
      valueOpen: abiertas.reduce((s, o) => s + (Number(o.value) || 0), 0),
      valueWon: ganadas.reduce((s, o) => s + (Number(o.value) || 0), 0),
    },
    updatedAt: serverTimestamp(),
  })
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

  const crear = async ({ name, value, productId = null, probability = 'media', auto = false, reason = '' }) => {
    if (!orgId || !leadId) return
    const docRef = await addDoc(ref(orgId, leadId), {
      name,
      value: Number(value) || 0,
      productId,
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
