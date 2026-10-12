/* Las secciones con datos reales que vive el panel del lead.
 *
 * Están acá y no dentro de SidePanel porque SidePanel es presentación: recibe
 * lo que le pasan y lo dibuja. Lo que lee y escribe Firestore vive acá.
 */
import { useState } from 'react'
import { Plus, Pencil, Check, X } from 'lucide-react'
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
    setGuardando(true)
    try {
      await onSave(form)
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
            </span>
          </div>
        ))
      )}
    </section>
  )
}
