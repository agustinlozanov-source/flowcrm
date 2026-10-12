/* Las secciones con datos reales que vive el panel del lead.
 *
 * Están acá y no dentro de SidePanel porque SidePanel es presentación: recibe
 * lo que le pasan y lo dibuja. Lo que lee y escribe Firestore vive acá.
 */
import { useState } from 'react'
import { Plus, Pencil, Check, X, Calendar, MapPin, Video, Phone, CheckCircle2, XCircle } from 'lucide-react'
import { useAppointments, APPOINTMENT_STATUS, ESTADOS_EN_PIE } from '@/hooks/useAppointments'
import OpportunityRow from './OpportunityRow'
import { useOpportunities } from '@/hooks/useOpportunities'
import toast from 'react-hot-toast'

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
export function CitasSection({ leadId }) {
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
