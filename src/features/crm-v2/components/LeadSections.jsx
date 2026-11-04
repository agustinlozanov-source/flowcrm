/* Las secciones con datos reales que vive el panel del lead.
 *
 * Están acá y no dentro de SidePanel porque SidePanel es presentación: recibe
 * lo que le pasan y lo dibuja. Lo que lee y escribe Firestore vive acá.
 */
import { useState } from 'react'
import { Plus, Pencil, Check, X, Calendar, MapPin, Video, Phone, CheckCircle2, XCircle } from 'lucide-react'
import { useAppointments, APPOINTMENT_STATUS, ESTADOS_EN_PIE } from '@/hooks/useAppointments'
import { usePipeline, DISCARD_CATEGORIES } from '@/hooks/usePipeline'
import clsx from 'clsx'
import OpportunityRow from './OpportunityRow'
import { useOpportunities } from '@/hooks/useOpportunities'
import toast from 'react-hot-toast'
import ActividadDialog from './ActividadDialog'
import { useActividadesDeLead, etiquetaTipo, cubeta } from '@/hooks/useActividades'

/* ── Oportunidades ───────────────────────────────────────────────── */
export function OportunidadesSection({ leadId, products = [] }) {
  const { opportunities, crear, cambiarEstado, editar } = useOpportunities(leadId)
  const [agregando, setAgregando] = useState(false)

  const abiertas = opportunities.filter(o => o.status === 'abierta')
  const total = abiertas.reduce((s, o) => s + (Number(o.value) || 0), 0)

  const agregar = async (productId) => {
    const p = products.find(x => x.id === productId)
    if (!p) return
    await crear({ name: p.name, value: p.price, productId: p.id })
    setAgregando(false)
    toast.success(`${p.name} agregada`)
  }

  const editarPrecio = async (opp) => {
    const nuevo = window.prompt(`Precio de ${opp.name}`, opp.value)
    if (nuevo == null) return
    await editar(opp.id, { value: Number(nuevo) || 0 })
  }

  return (
    <section className="pv2-section">
      <h4 className="pv2-section__title">
        Oportunidades
        {abiertas.length > 0 && (
          <span className="pv2-section__hint">
            {abiertas.length} abierta{abiertas.length === 1 ? '' : 's'} · ${total.toLocaleString('es-MX')}
          </span>
        )}
      </h4>

      {opportunities.length === 0 && !agregando && (
        <p className="pv2-empty-tab" style={{ padding: '6px 0' }}>
          Ninguna todavía. El agente abre una sola cuando el lead cuenta un problema que un producto resuelve.
        </p>
      )}

      {opportunities.map(o => (
        <OpportunityRow
          key={o.id}
          opportunity={o}
          onEdit={() => editarPrecio(o)}
          onToggleKind={() => editar(o.id, { kind: (o.kind || 'real') === 'real' ? 'potencial' : 'real' })}
          onClose={() => cambiarEstado(o.id, 'ganada')}
          onDiscard={() => cambiarEstado(o.id, 'descartada')}
        />
      ))}

      {agregando ? (
        <div className="pv2-opp-add">
          <select className="pv2-input" defaultValue="" onChange={e => e.target.value && agregar(e.target.value)}>
            <option value="" disabled>Elegí un producto…</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} — ${Number(p.price).toLocaleString('es-MX')}</option>
            ))}
          </select>
          <button className="pv2-icon-btn" onClick={() => setAgregando(false)} title="Cancelar"><X size={13} /></button>
        </div>
      ) : (
        <button className="pv2-add pv2-add--inline" onClick={() => setAgregando(true)}>
          <Plus size={12} /> Agregar oportunidad
        </button>
      )}
    </section>
  )
}

/* ── Datos del contacto ──────────────────────────────────────────── */
const CAMPOS = [
  { key: 'name', label: 'Nombre', placeholder: 'Como se llama de verdad' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'nombre@correo.com' },
  { key: 'phone', label: 'Teléfono', placeholder: '52 55 1234 5678' },
  { key: 'company', label: 'Empresa', placeholder: '—' },
  { key: 'address', label: 'Dirección', placeholder: 'Calle, número, colonia' },
]

/**
 * Los datos que el embudo digital no trae y hay que ir pidiendo. Sin esto, si
 * el lead te daba el correo no había dónde anotarlo sin salir del panel.
 */
export function ContactoSection({ lead, onSave, autoEdit = false }) {
  const [editando, setEditando] = useState(autoEdit)
  const [form, setForm] = useState(
    () => CAMPOS.reduce((a, c) => ({ ...a, [c.key]: lead?.[c.key] || '' }), {}),
  )
  const [guardando, setGuardando] = useState(false)

  const abrir = () => {
    setForm(CAMPOS.reduce((a, c) => ({ ...a, [c.key]: lead?.[c.key] || '' }), {}))
    setEditando(true)
  }

  const guardar = async () => {
    // Un nombre vacío dejaría la tarjeta sin título: si lo borró, se ignora.
    const limpio = { ...form }
    if (!limpio.name?.trim()) delete limpio.name
    setGuardando(true)
    try {
      await onSave(limpio)
      setEditando(false)
      toast.success('Datos guardados')
    } catch {
      toast.error('No se pudieron guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="pv2-section">
      <h4 className="pv2-section__title">
        Datos del contacto
        {!editando && (
          <button className="pv2-section__action" onClick={abrir}>
            <Pencil size={11} /> Editar
          </button>
        )}
      </h4>

      {editando ? (
        <>
          {CAMPOS.map(c => (
            <div key={c.key} style={{ marginBottom: 8 }}>
              <label className="pv2-input-label">{c.label}</label>
              <input
                className="pv2-input"
                type={c.type || 'text'}
                value={form[c.key] ?? ''}
                placeholder={c.placeholder}
                onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="pv2-dialog__actions">
            <button className="pv2-btn" onClick={() => setEditando(false)}>Cancelar</button>
            <button className="pv2-btn pv2-btn--primary" onClick={guardar} disabled={guardando}>
              <Check size={13} /> {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      ) : (
        CAMPOS.map(c => (
          <div key={c.key} className="pv2-field">
            <span className="pv2-field__label">{c.label}</span>
            <span className="pv2-field__value">
              {lead?.[c.key] || <span style={{ color: 'var(--text-muted)' }}>Sin dato</span>}
              {c.key === 'name' && lead?.name && (
                <span className="pv2-field__hint" title="Así llegó desde el canal">
                  como lo trae {lead.lastMessageChannel === 'whatsapp' ? 'WhatsApp' : 'el canal'}
                </span>
              )}
            </span>
          </div>
        ))
      )}
    </section>
  )
}

/* ── Citas del lead ──────────────────────────────────────────────── */

const ICONO_CITA = { presencial: MapPin, video: Video, call: Phone }

const cuandoCita = (ts) => {
  const d = ts?.toDate?.() || null
  if (!d) return ''
  return d.toLocaleString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/**
 * Lo primero que hay que saber de un lead es si tiene cita y cuándo. Antes
 * había que irse a Reuniones y buscarlo, y marcar que asistió solo se podía
 * desde el cockpit de llamada.
 */
export function CitasSection({ leadId, onEditar }) {
  const { appointments, marcarAsistencia } = useAppointments()
  const mias = appointments
    .filter(a => a.leadId === leadId)
    .sort((a, b) => (a.scheduledAt?.toMillis?.() || 0) - (b.scheduledAt?.toMillis?.() || 0))

  if (!mias.length) return null

  const enPie = mias.filter(a => ESTADOS_EN_PIE.includes(a.status))
  const pasadas = mias.filter(a => !ESTADOS_EN_PIE.includes(a.status))

  const marcar = async (id, asistio) => {
    try {
      await marcarAsistencia(id, asistio)
      toast.success(asistio ? 'Marcada como asistida' : 'Marcada como no asistida')
    } catch {
      toast.error('No se pudo registrar')
    }
  }

  return (
    <section className="pv2-section">
      <h4 className="pv2-section__title">
        Citas
        {enPie.length > 0 && <span className="pv2-section__hint">{enPie.length} por delante</span>}
      </h4>

      {[...enPie, ...pasadas].map(a => {
        const Icono = ICONO_CITA[a.type] || Calendar
        const estado = APPOINTMENT_STATUS[a.status]
        const porDelante = ESTADOS_EN_PIE.includes(a.status)
        return (
          <div key={a.id} className="pv2-cita">
            <Icono size={13} className="pv2-cita__icono" />
            <div className="pv2-cita__main">
              <div className="pv2-cita__cuando">{cuandoCita(a.scheduledAt)}</div>
              {a.location && <div className="pv2-cita__sub">{a.location}</div>}
              {!porDelante && estado && (
                <span className="pv2-cita__estado" style={{ color: estado.color }}>{estado.label}</span>
              )}
            </div>
            {porDelante && (
              <div style={{ display: 'flex', gap: 4 }}>
                {/* Una cita se cambia por teléfono todo el tiempo: tiene que
                    poder editarse desde acá y no solo desde Reuniones. */}
                <button className="pv2-icon-btn" title="Editar fecha, hora o sede" onClick={() => onEditar?.(a.id)}>
                  <Pencil size={12} />
                </button>
                <button className="pv2-icon-btn" title="No asistió" onClick={() => marcar(a.id, false)}>
                  <XCircle size={13} />
                </button>
                <button className="pv2-icon-btn" title="Asistió" style={{ color: 'var(--green)' }}
                  onClick={() => marcar(a.id, true)}>
                  <CheckCircle2 size={14} />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/* ── Descartar ───────────────────────────────────────────────────
 *
 * Descartar no es dar algo por perdido: es definir. Mientras un lead muerto
 * siga en el tablero, el denominador nunca cierra y ninguna conversión que
 * calculemos significa nada.
 *
 * El modelo ya tenía las nueve razones y la bandera de retoma desde el diseño
 * viejo. Lo que faltaba era por dónde hacerlo en el tablero nuevo.
 */
export function DescartarSection({ leadId, onDescartado }) {
  const { discardLead } = usePipeline()
  const [abierto, setAbierto] = useState(false)
  const [categoria, setCategoria] = useState('')
  const [notas, setNotas] = useState('')
  const [retoma, setRetoma] = useState('')
  const [guardando, setGuardando] = useState(false)

  const elegida = DISCARD_CATEGORIES.find(c => c.value === categoria)

  const cerrar = () => {
    setAbierto(false); setCategoria(''); setNotas(''); setRetoma('')
  }

  const descartar = async () => {
    if (!categoria) return
    setGuardando(true)
    try {
      await discardLead(leadId, { category: categoria, notes: notas, retakeDate: retoma || null })
      toast.success('Descartado')
      cerrar()
      onDescartado?.()
    } catch {
      toast.error('No se pudo descartar')
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) {
    return (
      <section className="pv2-section">
        <button className="pv2-descartar-abrir" onClick={() => setAbierto(true)}>
          <XCircle size={13} /> Descartar
        </button>
      </section>
    )
  }

  return (
    <section className="pv2-section">
      <h4 className="pv2-section__title">
        Descartar
        <button className="pv2-icon-btn" onClick={cerrar} title="Cancelar"><X size={13} /></button>
      </h4>

      <div className="pv2-descartar">
        {DISCARD_CATEGORIES.filter(c => c.value !== 'handoff_bound').map(c => (
          <button
            key={c.value}
            className={clsx('pv2-descartar__razon', categoria === c.value && 'is-sel')}
            onClick={() => setCategoria(c.value)}
          >
            <span className="pv2-descartar__label">{c.label}</span>
            <span className="pv2-descartar__desc">{c.desc}</span>
          </button>
        ))}
      </div>

      {elegida?.canRetake && (
        <div className="pv2-field" style={{ marginTop: 10 }}>
          <span className="pv2-field__label">Retomar el</span>
          <input
            type="date"
            className="pv2-input"
            value={retoma}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => setRetoma(e.target.value)}
          />
        </div>
      )}

      {categoria === 'blacklist' && (
        <p className="pv2-descartar__aviso">
          Pidió no ser contactado. No vuelve al tablero ni se reasigna, nunca.
        </p>
      )}

      <textarea
        className="pv2-input"
        style={{ marginTop: 10, resize: 'none' }}
        rows={2}
        value={notas}
        onChange={e => setNotas(e.target.value)}
        placeholder="Por qué, para quien lo retome después"
      />

      <div className="pv2-dialog__actions" style={{ marginTop: 10 }}>
        <button className="pv2-btn" onClick={cerrar}>Cancelar</button>
        <button
          className="pv2-btn pv2-btn--danger"
          onClick={descartar}
          disabled={!categoria || guardando}
        >
          {guardando ? 'Descartando…' : 'Descartar'}
        </button>
      </div>
    </section>
  )
}

/* ── Actividades de venta ────────────────────────────────────────── */

const DIAS_MS = 864e5

/** Cómo se dice una fecha cuando lo que importa es qué tan lejos está. */
function cuandoToca(d, ahora = new Date()) {
  if (!d) return 'Sin fecha'
  const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const suyo = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dias = Math.round((suyo - hoy) / DIAS_MS)
  if (dias === 0) return `Hoy ${hora}`
  if (dias === 1) return `Mañana ${hora}`
  if (dias === -1) return `Ayer ${hora}`
  if (dias < 0) return `Hace ${Math.abs(dias)} días`
  return `${d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} ${hora}`
}

export function ActividadesSection({ leadId, leadNombre = '', pipelineId = null }) {
  const { pendientes, registrar, completar } = useActividadesDeLead(leadId)
  const [dialogo, setDialogo] = useState(null)

  const guardar = async ({ hecho, pendiente }) => {
    const base = { leadNombre, pipelineId }
    /* En serie y no en paralelo: el hecho se guarda primero para que, si el
       compromiso falla, no quede un pendiente colgando de algo que nadie
       registró. */
    if (hecho) await registrar({ ...base, ...hecho })
    if (pendiente) await registrar({ ...base, ...pendiente })
    setDialogo(null)
    toast.success(hecho && pendiente ? 'Actividad y compromiso guardados' : 'Guardado')
  }

  const marcarHecha = async (act) => {
    const resumen = window.prompt('¿Qué pasó?', act.resumen || '')
    if (resumen == null) return
    await completar(act.id, { resumen })
    toast.success('Hecha')
  }

  return (
    <section className="pv2-section">
      <h4 className="pv2-section__title">
        Actividades
        {pendientes.length > 0 && (
          <span className="pv2-section__hint">
            {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}
          </span>
        )}
      </h4>

      {pendientes.length === 0 && (
        <p className="pv2-empty-tab" style={{ padding: '6px 0' }}>
          Nada pendiente con este lead. Un lead sin siguiente paso es un lead que se enfría.
        </p>
      )}

      {pendientes.map(a => {
        const d = a.dueAt?.toDate?.() || null
        const estado = cubeta(a)
        return (
          <div key={a.id} className={clsx('pv2-act', `pv2-act--${estado}`)}>
            <span className="pv2-act__dot" />
            <div className="pv2-act__main">
              <div className="pv2-act__top">
                <span className="pv2-act__tipo">{etiquetaTipo(a.tipo)}</span>
                <span className={clsx('pv2-act__cuando', estado === 'vencida' && 'pv2-act__cuando--vencida')}>
                  {cuandoToca(d)}
                </span>
              </div>
              {a.resumen && <div className="pv2-act__resumen">{a.resumen}</div>}
              {a.ownerNombre && <div className="pv2-act__quien">{a.ownerNombre}</div>}
            </div>
            <button className="pv2-act__hecho" onClick={() => marcarHecha(a)}>
              <CheckCircle2 size={11} /> Hecha
            </button>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="pv2-btn" onClick={() => setDialogo('registrar')}>
          <Plus size={12} /> Registrar
        </button>
        <button className="pv2-btn" onClick={() => setDialogo('agendar')}>
          <Calendar size={12} /> Agendar
        </button>
      </div>

      {dialogo && (
        <ActividadDialog
          modo={dialogo}
          onGuardar={guardar}
          onCerrar={() => setDialogo(null)}
        />
      )}
    </section>
  )
}
