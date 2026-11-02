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

/** El mes en que cae una fecha, visto desde México (UTC−6). */
export function mesMexico(d = new Date()) {
  const mx = new Date(d.getTime() - 6 * 60 * 60 * 1000)
  return mx.getUTCFullYear() + '-' + String(mx.getUTCMonth() + 1).padStart(2, '0')
}

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
async function recalcular(orgId, leadId) {
  const snap = await getDocs(ref(orgId, leadId))
  const todas = snap.docs.map(d => d.data())
  const abiertas = todas.filter(o => o.status === 'abierta')
  const ganadas = todas.filter(o => o.status === 'ganada')

  const leadRef = doc(db, 'organizations', orgId, 'leads', leadId)
  const cambios = {
    opportunityStats: totalesDe(todas),
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
      /* La etapa NO se borra.
       *
       * Antes se ponía en null, así que ganar una venta destruía la etapa que
       * el usuario había configurado y el lead quedaba sin lugar propio en su
       * embudo. Ahora se conserva: la etapa es del negocio, el systemStage es
       * del sistema, y uno no tiene por qué pisar al otro.
       *
       * Esto además deja el camino listo para cuando las etapas de
       * oportunidad desaparezcan y el cierre sea una etapa configurada como
       * cualquier otra. */
    }
    // Sin closedAt el lead no entra en ninguna consulta por rango de fechas, y
    // los objetivos del trimestre buscan justamente por ahí. Se escribe una
    // sola vez, en el primer cierre.
    if (!leadSnap.data()?.closedAt) cambios.closedAt = serverTimestamp()
  }

  await updateDoc(leadRef, cambios)
}

/** Calcula los totales desde las oportunidades. Es la única fórmula; tanto
 *  `recalcular` como la reparación la usan, para que no puedan divergir. */
function totalesDe(todas) {
  const abiertas = todas.filter(o => o.status === 'abierta')
  const ganadas = todas.filter(o => o.status === 'ganada')
  /* Una oportunidad abierta vale su precio de lista, porque todavía no se
     negoció. Una ganada vale lo que de verdad se cobró: si se cerró con
     descuento, reportar el de lista infla la venta y vuelve la bolsa
     imposible de medir. Las viejas, sin registro de cierre, caen a `value`. */
  const monto = o => Number(o.status === 'ganada' && o.closePrice != null ? o.closePrice : o.value) || 0
  const suma = arr => arr.reduce((s, o) => s + monto(o), 0)
  return {
    total: todas.length,
    open: abiertas.length,
    won: ganadas.length,
    valueOpen: suma(abiertas),
    valueWon: suma(ganadas),
    valueReal: suma(abiertas.filter(o => (o.kind || 'real') === 'real')),
    valuePotencial: suma(abiertas.filter(o => o.kind === 'potencial')),
  }
}

/** Corrige los totales guardados si no coinciden con las oportunidades.
 *
 * Hace falta porque los totales están copiados en el lead: cuando cambia la
 * forma de calcularlos, lo ya escrito queda viejo y el board lo muestra tal
 * cual. Esto lo repara la primera vez que alguien abre la ficha. */
export async function repararSiHaceFalta(orgId, leadId) {
  const leadRef = doc(db, 'organizations', orgId, 'leads', leadId)
  const [snapOps, snapLead] = await Promise.all([getDocs(ref(orgId, leadId)), getDoc(leadRef)])
  const esperado = totalesDe(snapOps.docs.map(d => d.data()))
  const guardado = snapLead.data()?.opportunityStats

  const cambios = {}
  const igual = guardado && Object.keys(esperado).every(k => (guardado[k] || 0) === esperado[k])
  if (!igual) cambios.opportunityStats = esperado

  // Sin fecha de cierre el lead no entra en ninguna consulta por rango, y los
  // objetivos del trimestre buscan justamente así.
  if (esperado.won > 0 && !snapLead.data()?.closedAt) {
    cambios.closedAt = serverTimestamp()
  }

  if (!Object.keys(cambios).length) return
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
    let yaRevisado = false
    const unsub = onSnapshot(
      query(ref(orgId, leadId), orderBy('createdAt', 'asc')),
      snap => {
        setOpportunities(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
        if (!yaRevisado) {
          yaRevisado = true
          repararSiHaceFalta(orgId, leadId).catch(() => {})
        }
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

  /** Marcar ganada con el registro de cómo se cerró.
   *
   *  Va por acá y no por `cambiarEstado` para que el registro y el estado se
   *  escriban juntos: una ganada sin registro es justo lo que estábamos
   *  tratando de evitar. */
  const cerrarGanada = async (oppId, registro) => {
    if (!orgId || !leadId) return
    /* De qué embudo salió la venta. Se copia acá y no se deduce después,
       porque el lead se puede mover de embudo y entonces una venta vieja
       cambiaría de dueño retroactivamente. Lo que vale es dónde estaba
       cuando se cerró. */
    const leadSnap = await getDoc(doc(db, 'organizations', orgId, 'leads', leadId))
    const pipelineId = leadSnap.exists() ? (leadSnap.data()?.pipelineId || null) : null

    await updateDoc(doc(ref(orgId, leadId), oppId), {
      status: 'ganada',
      closedAt: serverTimestamp(),
      closedBy: user?.uid || null,
      /* Las oportunidades viven anidadas en cada lead, así que sin estos dos
         campos no hay forma de juntarlas por organización y por mes — y eso
         es justo lo que el portal necesita para el número del periodo. El mes
         se calcula en hora de México, no en UTC: a las 7 de la tarde del día
         30 el UTC ya es del mes siguiente y la venta caería en el periodo
         equivocado. */
      orgId,
      pipelineId,
      closedMonth: mesMexico(new Date()),
      ...registro,
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

  return { opportunities, loading, crear, cambiarEstado, cerrarGanada, editar, borrar }
}

/** Oportunidades de un lead, leídas una vez. Para mostrarlas donde no hace
 *  falta tiempo real — la tarjeta de una cita, por ejemplo — sin dejar una
 *  suscripción abierta por cada tarjeta de la lista. */
export function useOpportunitiesOnce(leadId) {
  const { org } = useAuthStore()
  const orgId = org?.id
  const [opportunities, setOpportunities] = useState([])

  useEffect(() => {
    if (!orgId || !leadId) { setOpportunities([]); return }
    let vivo = true
    getDocs(ref(orgId, leadId))
      .then(snap => { if (vivo) setOpportunities(snap.docs.map(d => ({ id: d.id, ...d.data() }))) })
      .catch(() => {})
    return () => { vivo = false }
  }, [orgId, leadId])

  return opportunities
}

/** Detecta totales escritos con la fórmula vieja, sin leer la subcolección.
 *
 * La señal es exacta: con la fórmula nueva, real + potencial es exactamente lo
 * abierto. Con la vieja incluían también lo ganado, así que suman de más. */
export function totalesViejos(lead) {
  const s = lead?.opportunityStats
  if (!s?.total) return false
  // Totales calculados con la fórmula vieja: real + potencial no puede
  // superar lo abierto.
  if ((s.valueReal || 0) + (s.valuePotencial || 0) > (s.valueOpen || 0)) return true
  // O ganó algo y nunca se le puso fecha de cierre: invisible para la meta.
  return s.won > 0 && !lead.closedAt
}
