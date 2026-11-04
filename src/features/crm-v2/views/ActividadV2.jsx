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
  Check, AlertTriangle, ExternalLink, Archive, Download, Upload, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Topbar from '../components/Topbar'
import OwnerAvatar from '../components/OwnerAvatar'
import ActividadDialog from '../components/ActividadDialog'
import ImportarActividades from '../components/ImportarActividades'
import {
  usePendientes, useEsperandoRespuesta, crearActividad, completarActividad,
  actualizarActividad, etiquetaTipo,
} from '@/hooks/useActividades'
import { usePipeline } from '@/hooks/usePipeline'
import { useTeam } from '@/hooks/useTeam'
import { usePermissions } from '@/hooks/usePermissions'
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
  const { canExportData, canEditAnyLead } = usePermissions()

  /* El nombre del responsable se resuelve contra el equipo, no se lee del
     campo que guardó la actividad. Ese campo es una copia del momento en que
     se creó: si la persona cambió de nombre, o se guardó con el pedazo del
     correo en vez del nombre, la lista queda mostrando algo que no existe. */
  const nombreDeMiembro = useMemo(() => {
    const m = {}
    members.forEach(x => {
      const nombre = x.name || x.displayName || x.email || ''
      if (x.uid) m[x.uid] = nombre
      if (x.id) m[x.id] = nombre
    })
    return m
  }, [members])

  const responsable = a => nombreDeMiembro[a.ownerUid] || a.ownerNombre || ''

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
  const [importando, setImportando] = useState(false)
  const [porArchivar, setPorArchivar] = useState(null)
  const [vista, setVista] = useState('pendientes')
  const [verFiltros, setVerFiltros] = useState(false)

  const { porCubeta, archivadas, cargando, error } = usePendientes(quien)
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

  /** Archivar en vez de borrar: una actividad que alguien quita por error se
   *  recupera, y el registro de qué se planeó hacer tiene valor aunque ya no
   *  se vaya a hacer. Borrar de verdad no deja vuelta atrás. */
  const archivar = async (a) => {
    await actualizarActividad(org.id, a.leadId, a.id, { estado: 'cancelada' })
    setPorArchivar(null)
    toast.success('Archivada. Está en la pestaña Archivadas.')
  }

  const restaurar = async (a) => {
    await actualizarActividad(org.id, a.leadId, a.id, { estado: 'pendiente' })
    toast.success('De vuelta en pendientes')
  }

  const puedeArchivar = a => canEditAnyLead || !a.ownerUid || a.ownerUid === user?.uid

  /** Lo que se exporta es lo que se ve: con el filtro y la búsqueda puestos.
   *  Bajar siempre todo obliga a volver a filtrar afuera. */
  const exportar = () => {
    const filas = CUBETAS.flatMap(c => (filtradas[c.id] || []).map(a => ({ cubeta: c.label, a })))
    if (!filas.length) return toast.error('No hay nada que exportar con esos filtros')
    const col = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [
      ['Cuándo', 'Vence', 'Canal', 'Contacto', 'Empresa', 'Qué quedó', 'Responsable'].map(col).join(','),
      ...filas.map(({ cubeta, a }) => [
        cubeta,
        a.dueAt?.toDate?.()?.toLocaleString('es-MX') || '',
        etiquetaTipo(a.tipo),
        a.leadNombre || nombreDe(porId[a.leadId]),
        porId[a.leadId]?.company || '',
        a.resumen || '',
        responsable(a),
      ].map(col).join(',')),
    ].join('\n')
    /* BOM al principio: sin él, Excel en Windows abre los acentos rotos y la
       primera reacción de cualquiera es que el sistema exportó mal. */
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `actividades-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${filas.length} ${filas.length === 1 ? 'actividad exportada' : 'actividades exportadas'}`)
  }

  /** Los botones de la fila: el canal de la actividad primero, y siempre la
   *  salida al lead, que es donde está todo lo demás. */
  const acciones = (a) => {
    const lead = porId[a.leadId]
    const out = []
    if (a.tipo === 'whatsapp') {
      out.push({ id: 'wa', Icon: MessageCircle, titulo: 'Abrir la conversación', hacer: () => navigate(`/inbox?lead=${a.leadId}`) })
    }
    if (a.tipo === 'reunion') {
      out.push({ id: 'cita', Icon: Calendar, titulo: 'Ver la agenda de este contacto', hacer: () => navigate(`/meetings?lead=${a.leadId}`) })
    }
    if (a.tipo === 'llamada' && lead?.phone) {
      out.push({ id: 'tel', Icon: Phone, titulo: `Llamar a ${lead.phone}`, hacer: () => { window.location.href = `tel:${lead.phone}` } })
    }
    if (a.tipo === 'correo' && lead?.email) {
      out.push({ id: 'mail', Icon: Mail, titulo: `Escribir a ${lead.email}`, hacer: () => { window.location.href = `mailto:${lead.email}` } })
    }
    out.push({ id: 'lead', Icon: ExternalLink, titulo: 'Abrir la tarjeta', hacer: () => navigate(`/pipeline?lead=${a.leadId}`) })
    return out
  }

  return (
    <div className="pv2-root">
      <Topbar
        breadcrumb="CRM"
        title="Actividad"
        stats={[
          { label: 'Esperando', value: esperandoVisibles.length, tone: esperandoVisibles.length ? 'danger' : undefined },
          { label: 'Vencidas', value: filtradas.vencida?.length || 0, tone: filtradas.vencida?.length ? 'danger' : undefined },
          { label: 'Hoy', value: filtradas.hoy?.length || 0 },
          { label: 'Abiertas', value: total },
        ]}
        views={[]}
        filterCount={quien ? 1 : 0}
        onFilters={() => setVerFiltros(v => !v)}
        searchValue={busca}
        onSearch={setBusca}
        searchPlaceholder="Buscar por contacto o por lo que quedó"
        primaryLabel="Nueva actividad"
        onPrimary={() => setNueva(true)}
      />

      {verFiltros && (
        <div className="pv2-filtros">
          <label className="pv2-filtro">
            De quién
            <select
              className="pv2-input"
              value={quien || ''}
              onChange={e => setQuien(e.target.value || null)}
            >
              <option value="">Todo el equipo</option>
              {members.map(m => (
                <option key={m.id} value={m.uid || m.id}>{m.name || m.email}</option>
              ))}
            </select>
          </label>
          {quien && <button className="pv2-btn" onClick={() => setQuien(null)}>Limpiar</button>}
        </div>
      )}

      {/* Segunda capa: a la izquierda en qué lista estás, a la derecha lo que
          se hace con ella entera. En una sola fila con el título, las stats y
          el buscador no cabían, y amontonadas no se lee ninguna. */}
      <div className="pv2-barra-2">
        <div className="pv2-barra-2__lado">
          <button
            className={clsx('pv2-chip-btn', vista === 'pendientes' && 'pv2-chip-btn--active')}
            onClick={() => setVista('pendientes')}
          >
            <CheckSquare size={12} /> Pendientes
          </button>
          <button
            className={clsx('pv2-chip-btn', vista === 'archivadas' && 'pv2-chip-btn--active')}
            onClick={() => setVista('archivadas')}
          >
            <Archive size={12} /> Archivadas{archivadas.length ? ` (${archivadas.length})` : ''}
          </button>
          {quien && (
            <span className="pv2-barra-2__nota">Solo {nombreDeMiembro[quien] || 'una persona'}</span>
          )}
        </div>
        {canExportData && (
          <div className="pv2-barra-2__lado">
            <button className="pv2-btn" onClick={() => setImportando(true)} title="Cargar actividades desde un CSV">
              <Upload size={14} /> Importar
            </button>
            <button className="pv2-btn" onClick={exportar} title="Bajar lo que estás viendo, con los filtros puestos">
              <Download size={14} /> Exportar
            </button>
          </div>
        )}
      </div>

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

        {vista === 'pendientes' && esperandoVisibles.length > 0 && (
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
                  <button title="Abrir la tarjeta" onClick={() => navigate(`/pipeline?lead=${l.id}`)}>
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

        {vista === 'pendientes' && !cargando && total === 0 && esperandoVisibles.length === 0 && !error && (
          <p className="pv2-empty-tab">
            {busca.trim()
              ? 'Nada coincide con esa búsqueda.'
              : 'Nada pendiente. Si el embudo tiene leads vivos y acá no hay nada que hacer, lo que falta es registrar el siguiente paso de cada uno.'}
          </p>
        )}

        {vista === 'archivadas' && (
          archivadas.length === 0 ? (
            <p className="pv2-empty-tab">Nada archivado.</p>
          ) : (
            <section className="pv2-act-bloque">
              <h2 className="pv2-act-bloque__titulo">
                Archivadas <span>{archivadas.length}</span>
              </h2>
              <div className="pv2-act-fila pv2-act-cab">
                <span /><span>Canal</span><span>Contacto</span><span>Qué quedó</span>
                <span>Responsable</span><span>Vencía</span><span>Acciones</span>
              </div>
              {archivadas.map(a => {
                const Icono = ICONOS[a.tipo] || CheckSquare
                const lead = porId[a.leadId]
                return (
                  <div key={a.id} className="pv2-act-fila pv2-act-fila--archivada">
                    <span />
                    <span className="pv2-act-fila__tipo"><Icono size={13} /> {etiquetaTipo(a.tipo)}</span>
                    <div className="pv2-act-fila__contacto">
                      <div className="pv2-act-fila__nombre">{a.leadNombre || nombreDe(lead)}</div>
                      {lead?.company && <div className="pv2-act-fila__empresa">{lead.company}</div>}
                    </div>
                    <div className="pv2-act-fila__texto">{a.resumen || 'Sin detalle'}</div>
                    <div className="pv2-act-fila__dueno" title={responsable(a) || 'Sin asignar'}>
                      {responsable(a)
                        ? <><OwnerAvatar name={responsable(a)} size={20} /><span>{responsable(a)}</span></>
                        : <span className="pv2-act-fila__sindueno">Sin asignar</span>}
                    </div>
                    <span className="pv2-act-fila__cuando">{dia(a.dueAt?.toDate?.())}</span>
                    <div className="pv2-act-acciones">
                      <button title="Abrir la tarjeta" onClick={() => navigate(`/pipeline?lead=${a.leadId}`)}>
                        <ExternalLink size={13} />
                      </button>
                      <button title="Devolver a pendientes" onClick={() => restaurar(a)}>
                        <RotateCcw size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </section>
          )
        )}

        {vista === 'pendientes' && CUBETAS.map(c => {
          const items = filtradas[c.id] || []
          if (!items.length) return null
          return (
            <section key={c.id} className="pv2-act-bloque">
              <h2 className={clsx('pv2-act-bloque__titulo', c.tono && `pv2-act-bloque__titulo--${c.tono}`)}>
                {c.label} <span>{items.length}</span>
              </h2>
              <div className="pv2-act-fila pv2-act-cab">
                <span />
                <span>Canal</span>
                <span>Contacto</span>
                <span>Qué quedó</span>
                <span>Responsable</span>
                <span>Vence</span>
                <span>Acciones</span>
              </div>
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
                    <div className="pv2-act-fila__dueno" title={responsable(a) || 'Sin asignar'}>
                      {responsable(a)
                        ? <><OwnerAvatar name={responsable(a)} size={20} /><span>{responsable(a)}</span></>
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
                      {puedeArchivar(a) && (
                        <button
                          className="pv2-act-acciones__archivar"
                          title="Archivar: sale de la lista y se puede recuperar"
                          onClick={() => setPorArchivar(a)}
                        >
                          <Archive size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>

      {porArchivar && (
        <div className="pv2-dialog">
          <div className="pv2-dialog__backdrop" onClick={() => setPorArchivar(null)} />
          <div className="pv2-dialog__box" style={{ maxWidth: 400 }}>
            <h2 className="pv2-dialog__title">¿Archivar esta actividad?</h2>
            <p className="pv2-dialog__hint">
              {etiquetaTipo(porArchivar.tipo)} · {porArchivar.leadNombre || 'Sin nombre'}
              {porArchivar.resumen ? ` — ${porArchivar.resumen}` : ''}
            </p>
            <p className="pv2-hint" style={{ marginTop: 0 }}>
              Sale de los pendientes y queda en la pestaña Archivadas, de donde se puede
              devolver cuando quieras. No se borra.
            </p>
            <div className="pv2-dialog__actions">
              <button type="button" className="pv2-btn" onClick={() => setPorArchivar(null)}>Cancelar</button>
              <button type="button" className="pv2-btn pv2-btn--primary" onClick={() => archivar(porArchivar)}>
                <Archive size={13} /> Archivar
              </button>
            </div>
          </div>
        </div>
      )}

      {importando && (
        <ImportarActividades
          leads={paraElegir}
          members={members}
          onImportar={async (filas) => {
            /* De una en una y no en paralelo: cien escrituras simultáneas se
               topan con el límite de Firestore y la mitad falla en silencio. */
            for (const f of filas) {
              await crearActividad(org.id, f.lead.id, {
                leadNombre: f.lead.nombre,
                pipelineId: f.lead._lead?.pipelineId || null,
                tipo: f.tipo,
                estado: 'pendiente',
                dueAt: f.dueAt,
                resumen: f.resumen,
                ownerUid: f.ownerUid,
                ownerNombre: f.ownerNombre,
              }, quienSoy)
            }
            setImportando(false)
            toast.success(`${filas.length} ${filas.length === 1 ? 'actividad creada' : 'actividades creadas'}`)
          }}
          onCerrar={() => setImportando(false)}
        />
      )}

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
