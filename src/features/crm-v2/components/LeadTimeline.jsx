/* El historial del lead: lo que pasó y lo que se dijo.
 *
 * Cruza tres fuentes: `conversations`, que son los mensajes; `interactions`,
 * donde quedan los hechos del sistema (se cerró, se descartó, se movió); y
 * `activities`, que es lo que una persona registró a mano.
 *
 * Las tres se ordenan por **cuándo pasó**, que para los mensajes y los hechos
 * del sistema coincide con cuándo se escribieron, y para una actividad manual
 * no: el lunes se capturan las llamadas del viernes. Ordenar por la fecha de
 * captura pondría esas llamadas después de todo lo del fin de semana y el
 * relato quedaría al revés.
 *
 * Las entradas manuales se marcan aparte a propósito. Un mensaje de WhatsApp
 * es lo que el lead dijo; una actividad es lo que alguien dice que el lead
 * dijo. Si se ven iguales, en dos meses nadie distingue el hecho del recuerdo.
 */
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { etiquetaTipo, diasDeRetraso } from '@/hooks/useActividades'

const cuando = (d) => {
  if (!d) return ''
  const ms = Date.now() - d.getTime()
  if (ms < 36e5) return `hace ${Math.max(1, Math.round(ms / 6e4))} min`
  if (ms < 864e5) return `hace ${Math.round(ms / 36e5)} h`
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const aDate = ts => ts?.toDate?.() || null

export function useLeadHistory(leadId, cantidad = 12) {
  const { org } = useAuthStore()
  const orgId = org?.id
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!orgId || !leadId) { setItems([]); return }
    const base = ['organizations', orgId, 'leads', leadId]
    const porFuente = { mensaje: [], hecho: [], actividad: [] }

    /* `_ts` unifica el orden: cada fuente dice cuál de sus fechas es la que
       cuenta, y la mezcla ya no tiene que saber de dónde vino cada cosa. */
    function aplicar(fuente, snap, claveFecha, filtro) {
      porFuente[fuente] = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(data => !filtro || filtro(data))
        .map(data => {
        return {
          id: `${fuente}:${data.id}`,
          fuente,
          ...data,
          _ts: aDate(data[claveFecha])?.getTime() || 0,
          _fecha: aDate(data[claveFecha]),
        }
      })
      const todo = [...porFuente.mensaje, ...porFuente.hecho, ...porFuente.actividad]
        .sort((a, b) => b._ts - a._ts)
        .slice(0, cantidad)
      setItems(todo)
    }

    const unsubs = [
      onSnapshot(
        query(collection(db, ...base, 'conversations'), orderBy('createdAt', 'desc'), limit(cantidad)),
        snap => aplicar('mensaje', snap, 'createdAt'),
        () => {},
      ),
      onSnapshot(
        query(collection(db, ...base, 'interactions'), orderBy('createdAt', 'desc'), limit(cantidad)),
        snap => aplicar('hecho', snap, 'createdAt'),
        () => {},
      ),
      onSnapshot(
        /* Solo el orden, sin `where`: combinar filtro y orden pediría un
           índice compuesto, y ordenar por un campo solo lo indexa Firestore
           por su cuenta. Las pendientes traen `occurredAt` en null, que en
           orden descendente cae al final, y se descartan acá. */
        query(
          collection(db, ...base, 'activities'),
          orderBy('occurredAt', 'desc'),
          limit(cantidad),
        ),
        snap => aplicar('actividad', snap, 'occurredAt', a => a.estado === 'hecha'),
        err => console.error('[timeline/actividades]', err),
      ),
    ]

    return () => unsubs.forEach(u => u())
  }, [orgId, leadId, cantidad])

  return items
}

export default function LeadTimeline({ leadId, cantidad = 12 }) {
  const items = useLeadHistory(leadId, cantidad)

  if (!items.length) {
    return <p className="pv2-empty-tab">Sin actividad registrada todavía.</p>
  }

  return (
    <div className="pv2-timeline">
      {items.map(it => {
        const esMensaje = it.fuente === 'mensaje'
        const esActividad = it.fuente === 'actividad'
        const deLead = it.role === 'user' || it.from === 'lead'
        const retraso = esActividad ? diasDeRetraso(it) : 0

        const canal = esMensaje
          ? (deLead ? 'El lead' : 'El agente')
          : esActividad
            ? etiquetaTipo(it.tipo)
            : (it.type || 'Sistema')

        return (
          <article key={it.id} className="pv2-timeline__item">
            <div className="pv2-timeline__header">
              <span className="pv2-timeline__channel">{canal}</span>
              {esActividad && (
                <span className="pv2-act__retraso" title="Registrado a mano">a mano</span>
              )}
              {retraso > 0 && (
                <span
                  className="pv2-act__retraso"
                  title="Diferencia entre cuándo pasó y cuándo se capturó"
                >
                  capturado {retraso} {retraso === 1 ? 'día' : 'días'} después
                </span>
              )}
              <span className="pv2-timeline__time">{cuando(it._fecha)}</span>
            </div>
            <div className="pv2-timeline__body">
              {esMensaje ? (it.content || it.text || '') : (it.resumen || it.content || '')}
            </div>
            {esActividad && it.ownerNombre && (
              <div className="pv2-act__quien">{it.ownerNombre}</div>
            )}
          </article>
        )
      })}
    </div>
  )
}
