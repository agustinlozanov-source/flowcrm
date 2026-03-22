import { useState } from 'react'
import toast from 'react-hot-toast'
import { X, Plus, Package } from 'lucide-react'

const SOURCES = [
  { value: 'manual', label: 'Manual' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'instagram', label: 'Instagram DM' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'web', label: 'Web Form' },
  { value: 'referral', label: 'Referido' },
]

const SOURCE_ICONS = {
  manual: '✏️', meta_ads: '🔵', instagram: '📸',
  whatsapp: '💬', linkedin: '💼', web: '🌐', referral: '⭐',
}

const LADAS = [
  { code: '+52', flag: '🇲🇽', label: 'México' },
  { code: '+1',  flag: '🇺🇸', label: 'USA / Canadá' },
  { code: '+54', flag: '🇦🇷', label: 'Argentina' },
  { code: '+57', flag: '🇨🇴', label: 'Colombia' },
  { code: '+34', flag: '🇪🇸', label: 'España' },
]

export default function NewLeadModal({ stages, products = [], onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '',
    lastName: '',
    company: '',
    email: '',
    phoneLada: '+52',
    phoneNumber: '',
    productId: '',
    value: '',
    source: 'manual',
    stageId: stages[0]?.id || '',
  })
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleProductChange = (e) => {
    const productId = e.target.value
    const selected = products.find(p => p.id === productId)
    setForm(f => ({
      ...f,
      productId,
      value: selected ? String(selected.price) : f.value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    if (!form.stageId) { toast.error('Selecciona una etapa'); return }

    setLoading(true)
    try {
      await onCreate({
        name: form.name.trim(),
        lastName: form.lastName.trim(),
        company: form.company,
        email: form.email,
        phone: {
          lada: form.phoneLada,
          number: form.phoneNumber,
        },
        productId: form.productId || null,
        value: Number(form.value) || 0,
        source: form.source,
        stageId: form.stageId,
      })
      toast.success('Lead creado')
      onClose()
    } catch (err) {
      toast.error('Error al crear el lead')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-md border border-black/[0.08] animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06]">
          <div>
            <h2 className="font-display font-bold text-lg tracking-tight">Nuevo lead</h2>
            <p className="text-xs text-secondary mt-0.5">Añadir contacto al pipeline</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">

          {/* Nombre + Apellido */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                Nombre *
              </label>
              <input
                value={form.name} onChange={set('name')}
                placeholder="Carlos"
                className="input" required autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                Apellido
              </label>
              <input
                value={form.lastName} onChange={set('lastName')}
                placeholder="Ramírez"
                className="input"
              />
            </div>
          </div>

          {/* Email + Empresa */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                Email
              </label>
              <input
                type="email" value={form.email} onChange={set('email')}
                placeholder="carlos@empresa.com"
                className="input"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                Empresa
              </label>
              <input
                value={form.company} onChange={set('company')}
                placeholder="TechSoluciones"
                className="input"
              />
            </div>
          </div>

          {/* Teléfono con lada */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
              Teléfono
            </label>
            <div className="flex gap-2">
              <select
                value={form.phoneLada}
                onChange={set('phoneLada')}
                className="input w-[140px] flex-shrink-0"
              >
                {LADAS.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.code}
                  </option>
                ))}
              </select>
              <input
                value={form.phoneNumber} onChange={set('phoneNumber')}
                placeholder="81 1234 5678"
                className="input flex-1"
                type="tel"
              />
            </div>
          </div>

          {/* Producto */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
              Producto / Servicio
            </label>
            {products.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] border border-dashed border-black/[0.14] text-[12.5px] text-tertiary">
                <Package size={14} strokeWidth={2} />
                Sin productos — crea uno primero en el catálogo
              </div>
            ) : (
              <select
                value={form.productId}
                onChange={handleProductChange}
                className="input"
              >
                <option value="">— Seleccionar producto —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${p.price.toLocaleString()}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Valor del deal + Fuente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                Valor del deal (USD)
              </label>
              <input
                type="number" value={form.value} onChange={set('value')}
                placeholder="0"
                className="input"
                min="0"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                Fuente
              </label>
              <select value={form.source} onChange={set('source')} className="input">
                {SOURCES.map(s => (
                  <option key={s.value} value={s.value}>
                    {SOURCE_ICONS[s.value]} {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Etapa */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
              Etapa inicial *
            </label>
            <div className="flex flex-wrap gap-2">
              {stages.map(stage => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, stageId: stage.id }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150"
                  style={{
                    borderColor: form.stageId === stage.id ? stage.color : 'rgba(0,0,0,0.1)',
                    background: form.stageId === stage.id ? `${stage.color}15` : 'transparent',
                    color: form.stageId === stage.id ? stage.color : '#6e6e73',
                  }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  {stage.name}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus size={14} strokeWidth={3} color="white" />
                  Crear lead
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
