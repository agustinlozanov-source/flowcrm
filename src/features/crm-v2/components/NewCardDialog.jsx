import { useState, useMemo } from 'react'
import { UserPlus, ArrowUpRight } from 'lucide-react'
import { coincide } from '../buscar'

/**
 * Alta rápida de una tarjeta.
 *
 * Primero busca, después crea. Escribir un nombre no da de alta a nadie: si
 * esa persona ya existe, el diálogo la ofrece y lleva a su tarjeta en vez de
 * hacer una segunda.
 *
 * Esto no es comodidad. Con volumen de pauta, alguien escribe por Instagram y
 * queda como lead; tres días después un vendedor lo agrega a mano porque
 * llamó por teléfono. Quedan dos registros de la misma persona, cada uno con
 * media historia, y ninguno de los dos dice la verdad.
 *
 * Busca en toda la organización, no solo en el embudo activo: la misma persona
 * pudo entrar por la marca de al lado, y ese es justo el caso que hay que
 * atrapar.
 *
 * Solo crea en Calentamiento. Las otras dos columnas son estados a los que se
 * llega trabajando el lead, no lugares donde se da de alta uno nuevo.
 */
export default function NewCardDialog({ onClose, onCreate, contactos = [], onAbrir }) {
  const [form, setForm] = useState({ name: '', phone: '', value: '' })
  const [saving, setSaving] = useState(false)
  const [insiste, setInsiste] = useState(false)
  const set = k => e => { setInsiste(false); setForm(f => ({ ...f, [k]: e.target.value })) }

  const buscado = form.name.trim() || form.phone.trim()
  const parecidos = useMemo(() => {
    if (buscado.length < 2) return []
    return contactos.filter(c => coincide(c, buscado)).slice(0, 4)
  }, [contactos, buscado])

  const hayDudas = parecidos.length > 0 && !insiste

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim() || saving || hayDudas) return
    setSaving(true)
    try {
      await onCreate({ name: form.name.trim(), phone: form.phone.trim(), value: Number(form.value) || 0 })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const donde = (c) =>
    c.discarded ? 'descartado' : c.systemStage ? 'en cierre' : 'en calentamiento'

  return (
    <div className="pv2-dialog">
      <div className="pv2-dialog__backdrop" onClick={onClose} />
      <form className="pv2-dialog__box" onSubmit={submit}>
        <h2 className="pv2-dialog__title">Nueva tarjeta</h2>
        <p className="pv2-dialog__hint">Entra en calentamiento, con score 0.</p>

        <div>
          <label className="pv2-input-label">Nombre *</label>
          <input className="pv2-input" value={form.name} onChange={set('name')} autoFocus
            placeholder="Nombre y apellido" autoComplete="off" />
        </div>
        <div>
          <label className="pv2-input-label">Teléfono</label>
          <input className="pv2-input" value={form.phone} onChange={set('phone')}
            placeholder="52 55 1234 5678" autoComplete="off" />
        </div>
        <div>
          <label className="pv2-input-label">Monto estimado</label>
          <input className="pv2-input" value={form.value} onChange={set('value')} inputMode="numeric" placeholder="0" />
        </div>

        {parecidos.length > 0 && (
          <div className="pv2-yaexiste">
            <p className="pv2-yaexiste__titulo">
              {parecidos.length === 1 ? 'Ya existe alguien así' : 'Ya existen contactos parecidos'}
            </p>
            {parecidos.map(c => (
              <button key={c.id} type="button" className="pv2-yaexiste__fila"
                onClick={() => { onAbrir?.(c); onClose() }}>
                <span className="pv2-yaexiste__nombre">
                  {[c.name, c.lastName].filter(Boolean).join(' ') || 'Sin nombre'}
                </span>
                <span className="pv2-yaexiste__dato">
                  {c.phone || c.email || '—'} · {donde(c)}
                </span>
                <ArrowUpRight size={13} />
              </button>
            ))}
            {!insiste && (
              <button type="button" className="pv2-yaexiste__crear" onClick={() => setInsiste(true)}>
                <UserPlus size={12} /> No es ninguno — crear «{form.name.trim() || form.phone.trim()}»
              </button>
            )}
          </div>
        )}

        <div className="pv2-dialog__actions">
          <button type="button" className="pv2-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="pv2-btn pv2-btn--primary"
            disabled={!form.name.trim() || saving || hayDudas}>
            {saving ? 'Creando…' : 'Crear tarjeta'}
          </button>
        </div>
      </form>
    </div>
  )
}
