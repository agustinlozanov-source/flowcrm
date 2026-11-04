/* La actividad de venta: lo que se hizo y lo que falta hacer.
 *
 * Una sola entidad con dos estados, que es el estándar de la industria
 * (Pipedrive y HubSpot lo resuelven igual) y que acá resuelve un problema
 * concreto: el compromiso y la actividad son la misma cosa en dos momentos.
 *
 *   pendiente  →  lleva `dueAt`, aparece en el panel del día
 *   hecha      →  lleva `occurredAt` y el resumen, aparece en la línea de tiempo
 *
 * «Quedé de regresarle el jueves a las 11» es una actividad pendiente. El
 * jueves se marca hecha, se escribe qué se dijo, y de ahí sale la siguiente.
 * Cada actividad cerrada propone la que sigue, y por eso el embudo avanza en
 * vez de quedarse quieto con todo el mundo creyendo que alguien le dio
 * seguimiento.
 *
 * ── Las dos fechas ─────────────────────────────────────────────────
 * `occurredAt` es cuándo pasó y lo pone la persona. `createdAt` es cuándo se
 * capturó y lo pone el servidor. Separarlas es lo que vuelve auditable el
 * registro: si el lunes alguien captura ocho actividades de la semana pasada,
 * todas con el mismo `createdAt`, eso fue una carga masiva y el CRM no se está
 * usando en tiempo real. Con una sola fecha, eso es invisible.
 *
 * ── Sobre la forma de la consulta ──────────────────────────────────
 * Las actividades viven colgadas de cada lead, así que «mis pendientes de hoy»
 * pide una consulta de grupo, y eso pide su propia regla en Firestore: una
 * consulta de grupo no hereda el permiso de la ruta anidada. Es la misma
 * piedra que ya nos encontramos con `opportunities`.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  collection, collectionGroup, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

export const TIPOS = [
  { id: 'llamada',  label: 'Llamada'  },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'correo',   label: 'Correo'   },
  { id: 'reunion',  label: 'Reunión'  },
  { id: 'tarea',    label: 'Tarea'    },
]

export const etiquetaTipo = id => TIPOS.find(t => t.id === id)?.label || 'Actividad'

const fecha = v => (v instanceof Date ? Timestamp.fromDate(v) : v || null)
const aDate = ts => ts?.toDate?.() || (ts instanceof Date ? ts : null)

/** Cuántos días de calendario pasaron entre el hecho y su captura.
 *
 *  Se cuentan días de calendario y no horas transcurridas porque es como lo
 *  cuenta la gente: algo del martes capturado el jueves son dos días, aunque
 *  de reloj hayan pasado cuarenta y tres horas.
 *
 *  Dentro del mismo día no se muestra nada: capturar la llamada veinte minutos
 *  después es normal y marcarlo sería ruido. */
export function diasDeRetraso(act) {
  const paso = aDate(act?.occurredAt)
  const capturado = aDate(act?.createdAt)
  if (!paso || !capturado) return 0
  const soloDia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dias = Math.round((soloDia(capturado) - soloDia(paso)) / 864e5)
  return dias > 0 ? dias : 0
}

/** Dónde cae una actividad pendiente respecto de hoy. */
export function cubeta(act, ahora = new Date()) {
  const d = aDate(act?.dueAt)
  if (!d) return 'sinFecha'
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const suyo = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dias = Math.round((suyo - hoy) / 864e5)
  if (dias < 0) return 'vencida'
  if (dias === 0) return 'hoy'
  if (dias <= 7) return 'semana'
  return 'despues'
}

const ref = (orgId, leadId) =>
  collection(db, 'organizations', orgId, 'leads', leadId, 'activities')

/* ── Escrituras sueltas ──────────────────────────────────────────────
 *
 * Fuera del hook a propósito: el panel del lead escribe sobre el lead que
 * tiene abierto, pero el módulo de Actividad escribe sobre cualquiera de la
 * lista. Un hook atado a un `leadId` no le sirve a la segunda. */

/** @param quien  { uid, nombre } de quien está registrando */
export async function crearActividad(orgId, leadId, datos = {}, quien = {}) {
  if (!orgId || !leadId) return null
  const {
    tipo = 'llamada', estado = 'hecha',
    occurredAt = new Date(), dueAt = null, resumen = '',
    opportunityId = null, pipelineId = null, leadNombre = '',
    ownerUid = null, ownerNombre = '',
  } = datos
  const d = await addDoc(ref(orgId, leadId), {
    orgId,
    leadId,
    leadNombre: leadNombre || '',
    pipelineId: pipelineId || null,
    opportunityId: opportunityId || null,
    tipo,
    estado,
    /* Cada estado lleva su fecha y solo la suya: una pendiente con
       `occurredAt` ya puesto se colaría en la línea de tiempo como si
       hubiera ocurrido. */
    occurredAt: estado === 'hecha' ? fecha(occurredAt) : null,
    dueAt: estado === 'pendiente' ? fecha(dueAt) : null,
    resumen: String(resumen || '').trim(),
    ownerUid: ownerUid || quien.uid || null,
    ownerNombre: ownerNombre || quien.nombre || '',
    createdAt: serverTimestamp(),
    createdByUid: quien.uid || null,
    createdByNombre: quien.nombre || '',
  })
  return d.id
}

/** Cambiar campos sueltos. Hoy sirve para reasignar, que es lo que pasa
 *  cuando alguien se va de vacaciones o entra gente nueva al equipo. */
export async function actualizarActividad(orgId, leadId, actId, cambios = {}) {
  if (!orgId || !leadId || !actId) return
  await updateDoc(doc(ref(orgId, leadId), actId), { ...cambios, editedAt: serverTimestamp() })
}

/** Marcar hecha una pendiente. El resumen es el que la vuelve historia. */
export async function completarActividad(orgId, leadId, actId, { resumen = '', occurredAt = new Date() } = {}) {
  if (!orgId || !leadId || !actId) return
  await updateDoc(doc(ref(orgId, leadId), actId), {
    estado: 'hecha',
    occurredAt: fecha(occurredAt),
    dueAt: null,
    resumen: String(resumen || '').trim(),
    completedAt: serverTimestamp(),
  })
}

/* ── Las actividades de un lead ──────────────────────────────────── */

export function useActividadesDeLead(leadId) {
  const { org, user } = useAuthStore()
  const orgId = org?.id
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!orgId || !leadId) { setItems([]); setCargando(false); return }
    setCargando(true)
    return onSnapshot(
      query(ref(orgId, leadId), orderBy('createdAt', 'desc')),
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setCargando(false)
      },
      err => { console.error('[actividades]', err); setCargando(false) },
    )
  }, [orgId, leadId])

  /** Registrar algo que ya pasó, o agendar algo que falta.
   *
   *  `occurredAt` viene de quien registra para que el lunes se puedan capturar
   *  las llamadas del viernes sin que la línea de tiempo mienta sobre el orden. */
  const quien = { uid: user?.uid || null, nombre: user?.displayName || user?.email || '' }

  const registrar = datos => crearActividad(orgId, leadId, datos, quien)
  const completar = (actId, datos) => completarActividad(orgId, leadId, actId, datos)

  /* Editar y borrar quedan para quien la escribió. Un historial que cualquiera
     puede reescribir deja de servir como evidencia el día que importa, y el
     día que importa siempre llega. */
  const puedeEditar = act => !!user?.uid && act?.createdByUid === user.uid

  const editar = async (actId, cambios) => {
    if (!orgId || !leadId) return
    const limpio = { ...cambios, editedAt: serverTimestamp() }
    if ('occurredAt' in limpio) limpio.occurredAt = fecha(limpio.occurredAt)
    if ('dueAt' in limpio) limpio.dueAt = fecha(limpio.dueAt)
    await updateDoc(doc(ref(orgId, leadId), actId), limpio)
  }

  const borrar = async (actId) => {
    if (!orgId || !leadId) return
    await deleteDoc(doc(ref(orgId, leadId), actId))
  }

  const { pendientes, hechas } = useMemo(() => ({
    pendientes: items.filter(a => a.estado === 'pendiente'),
    hechas: items.filter(a => a.estado === 'hecha'),
  }), [items])

  return { items, pendientes, hechas, cargando, registrar, completar, editar, borrar, puedeEditar }
}

/* ── Conversaciones esperando respuesta humana ───────────────────── */

/** Leads con la IA pausada y la última palabra del lado del lead.
 *
 *  Son trabajo pendiente igual que una llamada agendada, y hasta ahora solo
 *  se veían si alguien pasaba por el tablero. Dos igualdades sin orden:
 *  Firestore las resuelve cruzando los índices que ya mantiene solo. */
export function useEsperandoRespuesta() {
  const { org } = useAuthStore()
  const orgId = org?.id
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orgId) { setItems([]); return }
    return onSnapshot(
      query(
        collection(db, 'organizations', orgId, 'leads'),
        where('hasUnread', '==', true),
        where('agentPaused', '==', true),
      ),
      snap => {
        setItems(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(l => !l.discarded)
            .sort((a, b) => (a.lastMessageAt?.toMillis?.() || 0) - (b.lastMessageAt?.toMillis?.() || 0)),
        )
        setError(null)
      },
      err => { console.error('[esperando]', err); setError(err) },
    )
  }, [orgId])

  return { items, error }
}

/* ── El panel del día: pendientes de toda la organización ────────── */

/**
 * @param uid  solo las de esta persona; null = las de todos
 */
export function usePendientes(uid = null) {
  const { org } = useAuthStore()
  const orgId = org?.id
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orgId) { setItems([]); setCargando(false); return }
    setCargando(true)
    /* Una sola igualdad y ningún orden: así Firestore la resuelve con el
       índice de campo que crea solo, y no hay que acordarse de declarar uno
       compuesto el día que esto corra en otra organización. El estado, el
       dueño y el orden se resuelven en memoria, que a este volumen no se
       nota. */
    return onSnapshot(
      query(
        collectionGroup(db, 'activities'),
        where('orgId', '==', orgId),
      ),
      snap => {
        setItems(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.dueAt?.toMillis?.() || 0) - (b.dueAt?.toMillis?.() || 0)),
        )
        setCargando(false)
        setError(null)
      },
      err => {
        /* La primera vez falla por el índice o por la regla de la consulta de
           grupo. Se pasa entero para poder distinguir cuál de los dos. */
        console.error('[pendientes]', err)
        setError(err)
        setCargando(false)
      },
    )
  }, [orgId])

  const mias = useMemo(
    () => (uid ? items.filter(a => a.ownerUid === uid) : items),
    [items, uid],
  )

  const porCubeta = useMemo(() => {
    const out = { vencida: [], hoy: [], semana: [], despues: [], sinFecha: [] }
    mias.filter(a => a.estado === 'pendiente').forEach(a => out[cubeta(a)].push(a))
    return out
  }, [mias])

  /* Lo archivado sale de la lista pero no de la base: hay que poder verlo y
     devolverlo, o archivar se vuelve un borrado con otro nombre. */
  const archivadas = useMemo(
    () => mias.filter(a => a.estado === 'cancelada'),
    [mias],
  )

  return { items: mias, porCubeta, archivadas, cargando, error }
}
