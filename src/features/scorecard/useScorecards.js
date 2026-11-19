/* Las corridas del Scorecard de una organización, en vivo.
 *
 * Solo se leen. Las escribe el servidor y nadie más: ni siquiera el dueño de
 * la cuenta puede cambiar un número desde aquí, y las reglas de Firestore lo
 * hacen cumplir.
 */
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

export const FASES = {
  en_cola: { nombre: 'En cola', paso: 0 },
  datos: { nombre: 'Calculando los números', paso: 1 },
  conversaciones: { nombre: 'Leyendo las conversaciones', paso: 2 },
  agregando: { nombre: 'Contando lo que dijeron', paso: 3 },
  escribiendo: { nombre: 'Escribiendo el reporte', paso: 4 },
  listo: { nombre: 'Listo', paso: 5 },
  error: { nombre: 'Falló', paso: -1 },
}
export const enCurso = (e) => ['en_cola', 'datos', 'conversaciones', 'agregando', 'escribiendo'].includes(e)

export function useCorridas(orgId) {
  const [corridas, setCorridas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orgId) { setCargando(false); return }
    /* Sin orderBy a propósito: igualdad más orden exigiría un índice compuesto,
       y el orden se hace en memoria sin costo a este volumen. */
    return onSnapshot(
      query(collection(db, 'scorecards'), where('orgId', '==', orgId)),
      snap => {
        setCorridas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.creadoEnMs || 0) - (a.creadoEnMs || 0)))
        setCargando(false)
        setError(null)
      },
      e => { setError(e.message); setCargando(false) },
    )
  }, [orgId])

  return { corridas, cargando, error }
}

/** Pide una corrida. Devuelve el id; el avance llega por el listener. */
export async function correrAnalisis(orgId, desde, hasta) {
  const u = auth.currentUser
  if (!u) throw new Error('No hay sesión iniciada')
  const token = await u.getIdToken()
  const res = await fetch('/.netlify/functions/scorecard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orgId, desde, hasta }),
  })
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(datos.error || `Falló con HTTP ${res.status}`)
  return datos.runId
}

/* ── Formato ────────────────────────────────────────────────────────── */

export const fechaCorta = (ms) => (ms ? new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const periodoTexto = (c) => `${fechaCorta(c.desde)} – ${fechaCorta(c.hasta)}`
export const porcentaje = (v) => (v == null ? '—' : `${Number(v).toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`)
export const numero = (v) => (v == null ? '—' : Number(v).toLocaleString('es-MX'))

export const RESPONSABLES = {
  atraccion: 'Atracción',
  atencion: 'Atención',
  agenda_y_asistencia: 'Agenda y asistencia',
  cierre: 'Cierre',
  oferta: 'Oferta',
}
export const QUIEN_RESPONDE = {
  atraccion: 'Marketing o la agencia',
  atencion: 'El agente y quien lo entrena',
  agenda_y_asistencia: 'Recepción o quien agenda',
  cierre: 'Ventas',
  oferta: 'Dirección',
}
