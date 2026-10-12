/* El historial del lead: lo que pasó y lo que se dijo.
 *
 * Cruza dos fuentes que ya existen: `interactions`, donde quedan los hechos
 * (se cerró, se descartó, se movió), y `conversations`, que son los mensajes.
 * Hasta ahora ninguna de las dos se veía desde el pipeline.
 */
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

const cuando = (ts) => {
  const d = ts?.toDate?.() || null
  if (!d) return ''
  const ms = Date.now() - d.getTime()
  if (ms < 36e5) return `hace ${Math.max(1, Math.round(ms / 6e4))} min`
  if (ms < 864e5) return `hace ${Math.round(ms / 36e5)} h`
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function useLeadHistory(leadId, cantidad = 12) {
  const { org } = useAuthStore()
  const orgId = org?.id
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!orgId || !leadId) { setItems([]); return }
    const base = ['organizations', orgId, 'leads', leadId]
    const unsubs = [
      onSnapshot(
        query(collection(db, ...base, 'conversations'), orderBy('createdAt', 'desc'), limit(cantidad)),
        snap => aplicar('mensaje', snap),
        () => {},
      ),
      onSnapshot(
        query(collection(db, ...base, 'interactions'), orderBy('createdAt', 'desc'), limit(cantidad)),
        snap => aplicar('hecho', snap),
        () => {},
      ),
    ]

    const porFuente = { mensaje: [], hecho: [] }
    function aplicar(fuente, snap) {
      porFuente[fuente] = snap.docs.map(d => ({ id: `${fuente}:${d.id}`, fuente, ...d.data() }))
      const todo = [...porFuente.mensaje, ...porFuente.hecho]
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, cantidad)
      setItems(todo)
    }

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
        const deLead = it.role === 'user' || it.from === 'lead'
        return (
          <article key={it.id} className="pv2-timeline__item">
            <div className="pv2-timeline__header">
              <span className="pv2-timeline__channel">
                {esMensaje ? (deLead ? 'El lead' : 'El agente') : (it.type || 'Sistema')}
              </span>
              <span className="pv2-timeline__time">{cuando(it.createdAt)}</span>
            </div>
            <div className="pv2-timeline__body">
              {esMensaje ? (it.content || it.text || '') : (it.content || '')}
            </div>
          </article>
        )
      })}
    </div>
  )
}
