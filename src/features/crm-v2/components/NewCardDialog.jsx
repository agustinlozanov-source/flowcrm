import { useState } from 'react'

/**
 * Alta rápida de una tarjeta. A propósito pide lo mínimo —nombre, teléfono y
 * monto— porque el resto lo completa la conversación: el lead entra para que
 * alguien lo trabaje, no para llenar un formulario.
 *
 * Solo crea en Calentamiento. Las otras dos columnas son estados a los que se
 * llega trabajando el lead, no lugares donde se da de alta uno nuevo.
 */
export default function NewCardDialog({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', phone: '', value: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      await onCreate({ name: form.name.trim(), phone: form.phone.trim(), value: Number(form.value) || 0 })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pv2-dialog">
      <div className="pv2-dialog__backdrop" onClick={onClose} />
      <form className="pv2-dialog__box" onSubmit={submit}>
        <h2 className="pv2-dialog__title">Nueva tarjeta</h2>
        <p className="pv2-dialog__hint">Entra en calentamiento, con score 0.</p>

        <div>
          <label className="pv2-input-label">Nombre *</label>
          <input className="pv2-input" value={form.name} onChange={set('name')} autoFocus placeholder="Nombre y apellido" />
        </div>
        <div>
          <label className="pv2-input-label">Teléfono</label>
          <input className="pv2-input" value={form.phone} onChange={set('phone')} placeholder="52 55 1234 5678" />
        </div>
        <div>
          <label className="pv2-input-label">Monto estimado</label>
          <input className="pv2-input" value={form.value} onChange={set('value')} inputMode="numeric" placeholder="0" />
        </div>

        <div className="pv2-dialog__actions">
          <button type="button" className="pv2-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="pv2-btn pv2-btn--primary" disabled={!form.name.trim() || saving}>
            {saving ? 'Creando…' : 'Crear tarjeta'}
          </button>
        </div>
      </form>
    </div>
  )
}
