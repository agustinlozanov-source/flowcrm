/* Actividad: qué le toca hacer hoy a cada quien.
 *
 * Junta las dos formas que tiene el trabajo de quedar pendiente, que hasta
 * ahora vivían en pantallas distintas y por eso nadie veía las dos:
 *
 *   · Las actividades agendadas — la llamada del jueves, el correo que quedé
 *     de mandar. Vienen de los compromisos que deja cada conversación.
 *   · Las conversaciones esperando respuesta humana — la IA pausada y la
 *     última palabra del lado del lead. Nadie va a contestar hasta que entre
 *     una persona.
 *
 * Esas conversaciones van primero y no last: una llamada agendada para el
 * jueves puede esperar; alguien escribió hace tres horas y nadie le contestó,
 * no.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { MessageCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import { usePendientes, useEsperandoRespuesta, etiquetaTipo } from '@/hooks/useActividades'
import { useTeam } from '@/hooks/useTeam'
import { useAuthStore } from '@/store/authStore'

const CUBETAS = [
  { id: 'vencida', label: 'Vencidas', tono: 'vencida' },
  { id: 'hoy', label: 'Hoy', tono: 'hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'despues', label: 'Más adelante' },
  { id: 'sinFecha', label: 'Sin fecha' },
]

const hora = d => d?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || ''
const dia = d => d?.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) || ''

const haceCuanto = (d) => {
  if (!d) return ''
  const ms = Date.now() - d.getTime()
  if (ms < 36e5) return `hace ${Math.max(1, Math.round(ms / 6e4))} min`
  if (ms < 864e5) return `hace ${Math.round(ms / 36e5)} h`
  return `hace ${Math.round(ms / 864e5)} días`
}

export default function ActividadV2() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { members = [] } = useTeam()
  const [quien, setQuien] = useState(user?.uid || null)

  const { porCubeta, cargando, error } = usePendientes(quien)
  const { items: esperando, error: errorEsperando } = useEsperandoRespuesta()

  /* Las conversaciones se filtran por el mismo selector de persona, contra
     quien tiene asignado el lead. Sin asignar las ve todo el mundo, porque
     sin dueño nadie las va a tomar por su cuenta. */
  const esperandoMias = useMemo(
    () => (quien ? esperando.filter(l => !l.assignedTo || l.assignedTo === quien) : esperando),
    [esperando, quien],
  )

  const total = CUBETAS.reduce((n, c) => n + (porCubeta[c.id]?.length || 0), 0)

  return (
    <div className="pv2-actividad">
      <header className="pv2-act-head">
        <div>
          <h1 className="pv2-act-head__title">Actividad</h1>
          <p className="pv2-act-head__sub">
            {esperandoMias.length > 0 && (
              <strong>{esperandoMias.length} conversación{esperandoMias.length === 1 ? '' : 'es'} esperando · </strong>
            )}
            {total} pendiente{total === 1 ? '' : 's'}
          </p>
        </div>
        <select
          className="pv2-input"
          style={{ width: 'auto' }}
          value={quien || ''}
          onChange={e => setQuien(e.target.value || null)}
        >
          <option value="">Todo el equipo</option>
          {members.map(m => (
            <option key={m.id} value={m.uid || m.id}>{m.name || m.email}</option>
          ))}
        </select>
      </header>

      {(error || errorEsperando) && (
        <div className="pv2-act-aviso">
          <AlertTriangle size={14} />
          <div>
            <strong>Falta permiso o índice en Firestore.</strong>{' '}
            {error?.code === 'permission-denied'
              ? 'Juntar las actividades de todos los leads lee el grupo de colecciones activities, y una consulta de grupo no hereda el permiso de la ruta anidada: necesita su propia regla.'
              : (error?.message || errorEsperando?.message)}
          </div>
        </div>
      )}

      {esperandoMias.length > 0 && (
        <section className="pv2-act-bloque">
          <h2 className="pv2-act-bloque__titulo pv2-act-bloque__titulo--vencida">
            Esperando tu respuesta
          </h2>
          {esperandoMias.map(l => (
            <button
              key={l.id}
              className="pv2-act-fila pv2-act-fila--vencida"
              onClick={() => navigate(`/inbox?lead=${l.id}`)}
            >
              <span className="pv2-act-fila__icono"><MessageCircle size={13} /></span>
              <span className="pv2-act-fila__main">
                <span className="pv2-act-fila__titulo">
                  {[l.name, l.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                </span>
                <span className="pv2-act-fila__texto">{l.lastMessage || 'Escribió y nadie contestó'}</span>
              </span>
              <span className="pv2-act-fila__cuando pv2-act-fila__cuando--vencida">
                {haceCuanto(l.lastMessageAt?.toDate?.())}
              </span>
            </button>
          ))}
        </section>
      )}

      {cargando && <p className="pv2-empty-tab">Cargando…</p>}

      {!cargando && total === 0 && esperandoMias.length === 0 && !error && (
        <p className="pv2-empty-tab">
          Nada pendiente. Si el embudo tiene leads vivos y acá no hay nada que hacer,
          lo que falta es registrar el siguiente paso de cada uno.
        </p>
      )}

      {CUBETAS.map(c => {
        const items = porCubeta[c.id] || []
        if (!items.length) return null
        return (
          <section key={c.id} className="pv2-act-bloque">
            <h2 className={clsx('pv2-act-bloque__titulo', c.tono && `pv2-act-bloque__titulo--${c.tono}`)}>
              {c.label} <span>{items.length}</span>
            </h2>
            {items.map(a => {
              const d = a.dueAt?.toDate?.() || null
              return (
                <button
                  key={a.id}
                  className={clsx('pv2-act-fila', c.tono && `pv2-act-fila--${c.tono}`)}
                  onClick={() => navigate(`/pipeline?lead=${a.leadId}`)}
                >
                  <span className="pv2-act-fila__icono"><CheckCircle2 size={13} /></span>
                  <span className="pv2-act-fila__main">
                    <span className="pv2-act-fila__titulo">
                      {etiquetaTipo(a.tipo)}
                      {a.leadNombre && <em> · {a.leadNombre}</em>}
                    </span>
                    <span className="pv2-act-fila__texto">{a.resumen || 'Sin detalle'}</span>
                    {!quien && a.ownerNombre && (
                      <span className="pv2-act-fila__quien">{a.ownerNombre}</span>
                    )}
                  </span>
                  <span className={clsx('pv2-act-fila__cuando', c.tono === 'vencida' && 'pv2-act-fila__cuando--vencida')}>
                    {c.id === 'hoy' ? hora(d) : dia(d)}
                  </span>
                </button>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
