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
 * Esas conversaciones van primero y no al final: una llamada agendada para el
 * jueves puede esperar; alguien escribió hace tres horas y nadie le contestó,
 * no.
 *
 * Cada fila trae el botón del canal que le toca —WhatsApp abre la
 * conversación, Llamada marca el teléfono— porque una lista de pendientes
 * desde la que hay que navegar a otra pantalla para hacer cada cosa se deja de
 * usar en una semana.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  MessageCircle, Phone, Mail, Calendar, CheckSquare,
  Check, AlertTriangle, ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Topbar from '../components/Topbar'
import OwnerAvatar from '../components/OwnerAvatar'
import ActividadDialog from '../components/ActividadDialog'
import {
  usePendientes, useEsperandoRespuesta, crearActividad, completarActividad,
  actualizarActividad, etiquetaTipo,
} from '@/hooks/useActividades'
import { usePipeline } from '@/hooks/usePipeline'
import { useTeam } from '@/hooks/useTeam'
import { useAuthStore } from '@/store/authStore'

const CUBETAS = [
  { id: 'vencida', label: 'Vencidas', tono: 'vencida' },
  { id: 'hoy', label: 'Hoy', tono: 'hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'despues', label: 'Más adelante' },
  { id: 'sinFecha', label: 'Sin fecha' },
]

const ICONOS = {
  llamada: Phone, whatsapp: MessageCircle, correo: Mail,
  reunion: Calendar, tarea: CheckSquare,
}

const hora = d => d?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || ''
const dia = d => d?.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) || ''
const normalizar = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const haceCuanto = (d) => {
  if (!d) return ''
  const ms = Date.now() - d.getTime()
  if (ms < 36e5) return `hace ${Math.max(1, Math.round(ms / 6e4))} min`
  if (ms < 864e5) return `hace ${Math.round(ms / 36e5)} h`
  return `hace ${Math.round(ms / 864e5)} días`
}

const nombreDe = l => [l?.name, l?.lastName].filter(Boolean).join(' ') || 'Sin nombre'

export default function ActividadV2() {
  const navigate = useNavigate()
  const { org, user } = useAuthStore()
  const { members = [] } = useTeam()
  const { todosLosLeads = [] } = usePipeline()

  /* Por omisión se ve el equipo entero. Arrancar filtrado por uno mismo
     esconde el trabajo de los demás justo en la pantalla que existe para
     verlo. */
  const [quien, setQuien] = useState(null)
  const [busca, setBusca] = useState('')
  const [nueva, setNueva] = useState(false)
  const [completando, setCompletando] = useState(null)
  /* La selección guarda la actividad entera y no su id: reasignar necesita
     también el leadId, porque las actividades viven colgadas de cada lead. */
  const [elegidas, setElegidas] = useState({})

  const { porCubeta, cargando, error } = usePendientes(quien)
  const { items: esperando, error: errorEsperando } = useEsperandoRespuesta()

  /* El lead completo, para que la fila sepa a qué teléfono llamar y a qué
     correo escribir. La actividad solo guarda el nombre. */
  const porId = useMemo(() => {
    const m = {}
    todosLosLeads.forEach(l => { m[l.id] = l })
    return m
  }, [todosLosLeads])

  const paraElegir = useMemo(
    () => todosLosLeads
      .filter(l => !l.discarded)
      .map(l => ({
        id: l.id,
        nombre: nombreDe(l),
        detalle: [l.company, l.phone].filter(Boolean).join(' · '),
        _lead: l,
      })),
    [todosLosLeads],
  )

  const coincide = (texto) => !busca.trim() || normalizar(texto).includes(normalizar(busca))

  const esperandoVisibles = useMemo(
    () => esperando
      .filter(l => !quien || !l.assignedTo || l.assignedTo === quien)
      .filter(l => coincide(`${nombreDe(l)} ${l.lastMessage || ''}`)),
    [esperando, quien, busca],
  )

  const filtradas = useMemo(() => {
    const out = {}
    CUBETAS.forEach(c => {
      out[c.id] = (porCubeta[c.id] || []).filter(
        a => coincide(`${a.leadNombre || ''} ${a.resumen || ''} ${etiquetaTipo(a.tipo)}`),
      )
    })
    return out
  }, [porCubeta, busca])

  const total = CUBETAS.reduce((n, c) => n + (filtradas[c.id]?.length || 0), 0)

  const quienSoy = { uid: user?.uid || null, nombre: user?.displayName || user?.email || '' }

  const guardarNueva = async ({ hecho, pendiente, lead }) => {
    if (!lead) return
    const base = { leadNombre: lead.nombre, pipelineId: lead._lead?.pipelineId || null }
    if (hecho) await crearActividad(org.id, lead.id, { ...base, ...hecho }, quienSoy)
    if (pendiente) await crearActividad(org.id, lead.id, { ...base, ...pendiente }, quienSoy)
    setNueva(false)
    toast.success('Guardado')
  }

  /* Completar es registrar qué pasó. Por eso usa el mismo diálogo: cerrar una
     actividad y dejar la siguiente es un solo momento, no dos. */
  const guardarCompletada = async ({ hecho, pendiente }) => {
    const a = completando
    if (!a) return
    if (hecho) await completarActividad(org.id, a.leadId, a.id, hecho)
    if (pendiente) {
      await crearActividad(
        org.id, a.leadId,
        { leadNombre: a.leadNombre, pipelineId: a.pipelineId, ...pendiente },
        quienSoy,
      )
    }
    setCompletando(null)
    toast.success(pendiente ? 'Hecha, y queda la siguiente' : 'Hecha')
  }

  const nSel = Object.keys(elegidas).length

  const alternar = (a) => setElegidas(prev => {
    const out = { ...prev }
    if (out[a.id]) delete out[a.id]
    else out[a.id] = a
    return out
  })

  /** Reasignar lo seleccionado. Pasa cada vez que alguien sale de vacaciones
   *  o entra gente nueva, y sin esto hay que abrir lead por lead. */
  const reasignar = async (uid) => {
    const m = members.find(x => (x.uid || x.id) === uid)
    const lista = Object.values(elegidas)
    await Promise.all(lista.map(a => actualizarActividad(org.id, a.leadId, a.id, {
      ownerUid: uid || null,
      ownerNombre: m?.name || m?.email || '',
    })))
    setElegidas({})
    toast.success(`${lista.length} ${lista.length === 1 ? 'actividad reasignada' : 'actividades reasignadas'}`)
  }

  /** Los botones de la fila: el canal de la actividad primero, y siempre la
   *  salida al lead, que es donde está todo lo demás. */
  const acciones = (a) => {
    const lead = porId[a.leadId]
    const out = []
    if (a.tipo === 'whatsapp' || a.tipo === 'reunion') {
      out.push({ id: 'wa', Icon: MessageCircle, titulo: 'Abrir la conversación', hacer: () => navigate(`/inbox?lead=${a.leadId}`) })
    }
    if (a.tipo === 'llamada' && lead?.phone) {
      out.push({ id: 'tel', Icon: Phone, titulo: `Llamar a ${lead.phone}`, hacer: () => { window.location.href = `tel:${lead.phone}` } })
    }
    if (a.tipo === 'correo' && lead?.email) {
      out.push({ id: 'mail', Icon: Mail, titulo: `Escribir a ${lead.email}`, hacer: () => { window.location.href = `mailto:${lead.email}` } })
    }
    out.push({ id: 'lead', Icon: ExternalLink, titulo: 'Abrir el contacto', hacer: () => navigate(`/pipeline?lead=${a.leadId}`) })
    return out
  }

  return (
    <div className="pv2-root">
      <Topbar
        title="Actividad"
        stats={[
          { label: 'Esperando', value: esperandoVisibles.length, tone: esperandoVisibles.length ? 'danger' : undefined },
          { label: 'Vencidas', value: filtradas.vencida?.length || 0, tone: filtradas.vencida?.length ? 'danger' : undefined },
          { label: 'Hoy', value: filtradas.hoy?.length || 0 },
          { label: 'Abiertas', value: total },
        ]}
        views={[]}
        searchValue={busca}
        onSearch={setBusca}
        searchPlaceholder="Buscar por contacto o por lo que quedó"
        extra={
          <select
            className="pv2-select-topbar"
            value={quien || ''}
            onChange={e => setQuien(e.target.value || null)}
            title="De quién son las actividades"
          >
            <option value="">Todo el equipo</option>
            {members.map(m => (
              <option key={m.id} value={m.uid || m.id}>{m.name || m.email}</option>
            ))}
          </select>
        }
        primaryLabel="Nueva actividad"
        onPrimary={() => setNueva(true)}
      />

      <div className="pv2-actividad">
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

        {esperandoVisibles.length > 0 && (
          <section className="pv2-act-bloque">
            <h2 className="pv2-act-bloque__titulo pv2-act-bloque__titulo--vencida">
              Esperando respuesta <span>{esperandoVisibles.length}</span>
            </h2>
            {esperandoVisibles.map(l => (
              <div key={l.id} className="pv2-act-fila pv2-act-fila--vencida">
                <span className="pv2-act-fila__icono"><MessageCircle size={14} /></span>
                <div className="pv2-act-fila__main">
                  <div className="pv2-act-fila__titulo">
                    {nombreDe(l)}
                    {l.company && <em> · {l.company}</em>}
                  </div>
                  <div className="pv2-act-fila__texto">{l.lastMessage || 'Escribió y nadie contestó'}</div>
                  <div className="pv2-act-fila__quien">IA pausada · nadie va a responder por ti</div>
                </div>
                <span className="pv2-act-fila__cuando pv2-act-fila__cuando--vencida">
                  {haceCuanto(l.lastMessageAt?.toDate?.())}
                </span>
                <div className="pv2-act-acciones">
                  <button title="Abrir la conversación" onClick={() => navigate(`/inbox?lead=${l.id}`)}>
                    <MessageCircle size={13} />
                  </button>
                  <button title="Abrir el contacto" onClick={() => navigate(`/pipeline?lead=${l.id}`)}>
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {nSel > 0 && (
          <div className="pv2-act-sel">
            <span className="pv2-act-sel__n">
              {nSel} seleccionada{nSel === 1 ? '' : 's'}
            </span>
            <select
              className="pv2-select-topbar"
              value=""
              onChange={e => e.target.value && reasignar(e.target.value)}
            >
              <option value="">Asignar a…</option>
              {members.map(m => (
                <option key={m.id} value={m.uid || m.id}>{m.name || m.email}</option>
              ))}
            </select>
            <button className="pv2-btn" onClick={() => setElegidas({})}>Cancelar</button>
          </div>
        )}

        {cargando && <p className="pv2-empty-tab">Cargando…</p>}

        {!cargando && total === 0 && esperandoVisibles.length === 0 && !error && (
          <p className="pv2-empty-tab">
            {busca.trim()
              ? 'Nada coincide con esa búsqueda.'
              : 'Nada pendiente. Si el embudo tiene leads vivos y acá no hay nada que hacer, lo que falta es registrar el siguiente paso de cada uno.'}
          </p>
        )}

        {CUBETAS.map(c => {
          const items = filtradas[c.id] || []
          if (!items.length) return null
          return (
            <section key={c.id} className="pv2-act-bloque">
              <h2 className={clsx('pv2-act-bloque__titulo', c.tono && `pv2-act-bloque__titulo--${c.tono}`)}>
                {c.label} <span>{items.length}</span>
              </h2>
              {items.map(a => {
                const d = a.dueAt?.toDate?.() || null
                const Icono = ICONOS[a.tipo] || CheckSquare
                const lead = porId[a.leadId]
                return (
                  <div
                    key={a.id}
                    className={clsx(
                      'pv2-act-fila',
                      c.tono && `pv2-act-fila--${c.tono}`,
                      elegidas[a.id] && 'pv2-act-fila--elegida',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="pv2-act-fila__sel"
                      checked={!!elegidas[a.id]}
                      onChange={() => alternar(a)}
                      title="Seleccionar"
                    />
                    <span className="pv2-act-fila__tipo">
                      <Icono size={13} /> {etiquetaTipo(a.tipo)}
                    </span>
                    <div className="pv2-act-fila__contacto">
                      <div className="pv2-act-fila__nombre">{a.leadNombre || nombreDe(lead)}</div>
                      {lead?.company && <div className="pv2-act-fila__empresa">{lead.company}</div>}
                    </div>
                    <div className="pv2-act-fila__texto">{a.resumen || 'Sin detalle'}</div>
                    <div className="pv2-act-fila__dueno" title={a.ownerNombre || 'Sin asignar'}>
                      {a.ownerNombre
                        ? <><OwnerAvatar name={a.ownerNombre} size={20} /><span>{a.ownerNombre}</span></>
                        : <span className="pv2-act-fila__sindueno">Sin asignar</span>}
                    </div>
                    <span className={clsx('pv2-act-fila__cuando', c.tono === 'vencida' && 'pv2-act-fila__cuando--vencida')}>
                      {c.id === 'hoy' ? hora(d) : dia(d)}
                    </span>
                    <div className="pv2-act-acciones">
                      {acciones(a).map(({ id, Icon, titulo, hacer }) => (
                        <button key={id} title={titulo} onClick={hacer}><Icon size={13} /></button>
                      ))}
                      <button
                        className="pv2-act-acciones__check"
                        title="Marcar como hecha"
                        onClick={() => setCompletando(a)}
                      >
                        <Check size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>

      {nueva && (
        <ActividadDialog
          leads={paraElegir}
          onGuardar={guardarNueva}
          onCerrar={() => setNueva(false)}
        />
      )}

      {completando && (
        <ActividadDialog
          titulo="¿Qué pasó?"
          subtitulo={`${etiquetaTipo(completando.tipo)} · ${completando.leadNombre || 'Sin nombre'}`}
          inicial={{ tipo: completando.tipo }}
          onGuardar={guardarCompletada}
          onCerrar={() => setCompletando(null)}
        />
      )}
    </div>
  )
}
