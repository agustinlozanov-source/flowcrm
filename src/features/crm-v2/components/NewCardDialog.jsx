import { useState } from 'react'
import SelectorConCrear from './SelectorConCrear'
import { coincide } from '../buscar'

/**
 * Alta rápida de una tarjeta.
 *
 * El contacto no se teclea: se elige de la lista, y si no está se crea desde
 * la misma lista. Escribir un nombre nunca da de alta a nadie por accidente.
 *
 * Con volumen de pauta eso importa: alguien escribe por Instagram y queda como
 * lead; tres días después un vendedor lo agrega a mano porque llamó. Quedan
 * dos registros de la misma persona, cada uno con media historia.
 *
 * La lista es de toda la organización, no solo del embudo activo: la misma
 * persona pudo entrar por la marca de al lado, y ese es el caso que hay que
 * atrapar.
 *
 * Solo crea en Calentamiento. Las otras dos columnas son estados a los que se
 * llega trabajando el lead, no lugares donde se da de alta uno nuevo.
 */
export default function NewCardDialog({ onClose, onCreate, contactos = [], onAbrir }) {
  const [nuevo, setNuevo] = useState('')
  const [form, setForm] = useState({ phone: '', value: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (!nuevo.trim() || saving) return
    setSaving(true)
    try {
      await onCreate({ name: nuevo.trim(), phone: form.phone.trim(), value: Number(form.value) || 0 })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const donde = c =>
    [c.phone || c.email, c.discarded ? 'descartado' : c.systemStage ? 'en cierre' : 'en calentamiento']
      .filter(Boolean).join(' · ')

  return (
    <div className="pv2-dialog">
      <div className="pv2-dialog__backdrop" onClick={onClose} />
      <form className="pv2-dialog__box" onSubmit={submit}>
        <h2 className="pv2-dialog__title">Nueva tarjeta</h2>
        <p className="pv2-dialog__hint">Entra en calentamiento, con score 0.</p>

        <div>
          <label className="pv2-input-label">Contacto *</label>
          <SelectorConCrear
            autoFocus
            items={contactos}
            valor={nuevo ? { id: '__nuevo', name: nuevo } : null}
            etiqueta={c => [c.name, c.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
            detalle={donde}
            filtrar={(c, t) => coincide(c, t)}
            placeholder="Busca un contacto o crea uno"
            textoCrear="Crear contacto"
            onElegir={c => { onAbrir?.(c); onClose() }}
            onCrear={t => setNuevo(t)}
          />
        </div>

        {nuevo && (
          <>
            <div>
              <label className="pv2-input-label">Teléfono</label>
              <input className="pv2-input" value={form.phone} onChange={set('phone')}
                placeholder="52 55 1234 5678" autoComplete="off" />
            </div>
            <div>
              <label className="pv2-input-label">Monto estimado</label>
              <input className="pv2-input" value={form.value} onChange={set('value')}
                inputMode="numeric" placeholder="0" />
            </div>
          </>
        )}

        <div className="pv2-dialog__actions">
          <button type="button" className="pv2-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="pv2-btn pv2-btn--primary" disabled={!nuevo.trim() || saving}>
            {saving ? 'Creando…' : 'Crear tarjeta'}
          </button>
        </div>
      </form>
    </div>
  )
}
