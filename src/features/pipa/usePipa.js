/* Los datos de PIPA.
 *
 * Todo cuelga de la organización —`organizations/{orgId}/pipa_ideas` y
 * `organizations/{orgId}/settings/pipa`— y eso no es decoración: las reglas
 * de Firestore ya cierran todo lo que vive bajo `organizations` contra el
 * claim `orgId` del token. Colgarlo de ahí hereda ese candado sin escribir
 * una regla nueva, y es la razón de peso para que esto viva en el CRM y no
 * en la landing, donde las colecciones sueltas quedan abiertas.
 */
import { useEffect, useState, useCallback } from 'react'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, orderBy, query, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PUESTOS_POR_OMISION } from '@/lib/pipa'

const AJUSTES_ID = 'pipa'

/** Las ideas de la organización, en vivo. */
export function useIdeas(orgId) {
  const [ideas, setIdeas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orgId) { setCargando(false); return }
    const q = query(
      collection(db, 'organizations', orgId, 'pipa_ideas'),
      orderBy('actualizadaEn', 'desc'),
    )
    return onSnapshot(
      q,
      snap => {
        setIdeas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setCargando(false)
        setError(null)
      },
      err => { setError(err.message); setCargando(false) },
    )
  }, [orgId])

  const crear = useCallback(async (datos) => {
    const ref = await addDoc(collection(db, 'organizations', orgId, 'pipa_ideas'), {
      ...datos,
      creadaEn: serverTimestamp(),
      actualizadaEn: serverTimestamp(),
    })
    return ref.id
  }, [orgId])

  /* Se guarda por rutas sueltas —`p2.propuesta.precio`— y no reemplazando la
   * idea entera. Dos personas en la misma mesa editando fases distintas no
   * se pisan, que es el caso normal en P2 y no el raro. */
  const guardar = useCallback(async (ideaId, parches) => {
    await updateDoc(doc(db, 'organizations', orgId, 'pipa_ideas', ideaId), {
      ...parches,
      actualizadaEn: serverTimestamp(),
    })
  }, [orgId])

  const borrar = useCallback(async (ideaId) => {
    await deleteDoc(doc(db, 'organizations', orgId, 'pipa_ideas', ideaId))
  }, [orgId])

  return { ideas, cargando, error, crear, guardar, borrar }
}

/** El ADN y el catálogo de puestos. Permanentes, fuera de la fila de fases. */
export function useAdn(orgId) {
  const [adn, setAdn] = useState({ texto: '', puestos: PUESTOS_POR_OMISION })
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!orgId) { setCargando(false); return }
    return onSnapshot(
      doc(db, 'organizations', orgId, 'settings', AJUSTES_ID),
      snap => {
        const d = snap.exists() ? snap.data() : {}
        setAdn({
          texto: d.texto || '',
          // Si la organización nunca tocó los puestos, se usan los de la casa.
          puestos: Array.isArray(d.puestos) && d.puestos.length ? d.puestos : PUESTOS_POR_OMISION,
          actualizadoEn: d.actualizadoEn || null,
          actualizadoPor: d.actualizadoPor || '',
        })
        setCargando(false)
      },
      () => setCargando(false),
    )
  }, [orgId])

  const guardarAdn = useCallback(async (parches, quien = '') => {
    await setDoc(
      doc(db, 'organizations', orgId, 'settings', AJUSTES_ID),
      { ...parches, actualizadoEn: serverTimestamp(), actualizadoPor: quien },
      { merge: true },
    )
  }, [orgId])

  return { adn, cargando, guardarAdn }
}
