import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { X, Plus, Package, Search, ChevronDown } from 'lucide-react'
import { useProducts } from '@/hooks/useProducts'

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

export default function NewLeadModal({ stages, onClose, onCreate }) {
  const { products, createProduct } = useProducts()
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

  // ── Product fuzzy search ──
  const [productQuery, setProductQuery] = useState('')
  const [productOpen, setProductOpen] = useState(false)
  const [showCreateProduct, setShowCreateProduct] = useState(false)
  const [newProductForm, setNewProductForm] = useState({ name: '', price: '', description: '' })
  const [savingProduct, setSavingProduct] = useState(false)
  const productRef = useRef(null)

  const selectedProduct = products.find(p => p.id === form.productId)

  const filteredProducts = productQuery.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(productQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(productQuery.toLowerCase())
      )
    : products

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e) => {
      if (productRef.current && !productRef.current.contains(e.target)) {
        setProductOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelectProduct = (p) => {
    setForm(f => ({ ...f, productId: p.id, value: String(p.price) }))
    setProductQuery('')
    setProductOpen(false)
    setShowCreateProduct(false)
  }

  const handleClearProduct = () => {
    setForm(f => ({ ...f, productId: '', value: '' }))
    setProductQuery('')
  }

  const handleCreateProduct = async () => {
    if (!newProductForm.name.trim()) { toast.error('Nombre requerido'); return }
    if (!newProductForm.price || isNaN(Number(newProductForm.price))) { toast.error('Precio inválido'); return }
    setSavingProduct(true)
    try {
      const created = await createProduct({
        name: newProductForm.name.trim(),
        description: newProductForm.description.trim(),
        price: Number(newProductForm.price),
        imageUrl: '',
      })
      // createProduct retorna el doc — seleccionarlo automáticamente
      if (created?.id) {
        setForm(f => ({ ...f, productId: created.id, value: String(newProductForm.price) }))
      }
      setShowCreateProduct(false)
      setProductOpen(false)
      setNewProductForm({ name: '', price: '', description: '' })
      toast.success('Producto creado')
    } catch {
      toast.error('Error al crear producto')
    } finally {
      setSavingProduct(false)
    }
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

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
        phone: form.phoneNumber ? `${form.phoneLada}${form.phoneNumber}` : '',
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

          {/* Producto — fuzzy search */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
              Producto / Servicio
            </label>
            <div ref={productRef} className="relative">
              {/* Trigger */}
              <div
                onClick={() => { setProductOpen(o => !o); setShowCreateProduct(false) }}
                className="input flex items-center gap-2 cursor-pointer select-none pr-3"
              >
                <Package size={13} className="text-tertiary flex-shrink-0" />
                {selectedProduct ? (
                  <span className="flex-1 text-[13px] text-primary truncate">{selectedProduct.name} — ${Number(selectedProduct.price).toLocaleString()}</span>
                ) : (
                  <span className="flex-1 text-[13px] text-tertiary">Buscar producto...</span>
                )}
                {selectedProduct ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleClearProduct() }} className="text-tertiary hover:text-primary">
                    <X size={13} />
                  </button>
                ) : (
                  <ChevronDown size={13} className="text-tertiary" />
                )}
              </div>

              {/* Dropdown */}
              {productOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-black/[0.1] rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden">
                  {/* Search input */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/[0.07]">
                    <Search size={13} className="text-tertiary flex-shrink-0" />
                    <input
                      autoFocus
                      value={productQuery}
                      onChange={e => { setProductQuery(e.target.value); setShowCreateProduct(false) }}
                      placeholder="Buscar por nombre..."
                      className="flex-1 text-[12.5px] bg-transparent outline-none text-primary placeholder-tertiary"
                    />
                  </div>

                  {/* Results */}
                  <div className="max-h-[180px] overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProduct(p)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-2 text-left transition-colors"
                        >
                          <span className="text-[13px] text-primary font-medium truncate">{p.name}</span>
                          <span className="text-[12px] text-secondary font-semibold ml-3 flex-shrink-0">${Number(p.price).toLocaleString()}</span>
                        </button>
                      ))
                    ) : (
                      <p className="text-[12.5px] text-tertiary text-center py-3">Sin resultados</p>
                    )}
                  </div>

                  {/* Create product */}
                  <div className="border-t border-black/[0.07]">
                    {!showCreateProduct ? (
                      <button
                        type="button"
                        onClick={() => setShowCreateProduct(true)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-[12.5px] font-semibold text-accent-blue hover:bg-blue-50 transition-colors"
                      >
                        <Plus size={13} strokeWidth={2.5} />
                        Crear nuevo producto
                      </button>
                    ) : (
                      <div className="p-3 flex flex-col gap-2">
                        <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Nuevo producto</p>
                        <input
                          autoFocus
                          value={newProductForm.name}
                          onChange={e => setNewProductForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Nombre del producto"
                          className="input text-[12.5px] py-1.5"
                        />
                        <input
                          type="number"
                          value={newProductForm.price}
                          onChange={e => setNewProductForm(f => ({ ...f, price: e.target.value }))}
                          placeholder="Precio (USD)"
                          className="input text-[12.5px] py-1.5"
                          min="0"
                        />
                        <input
                          value={newProductForm.description}
                          onChange={e => setNewProductForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Descripción (opcional)"
                          className="input text-[12.5px] py-1.5"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCreateProduct(false)}
                            className="btn-secondary text-xs py-1.5 flex-1"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateProduct}
                            disabled={savingProduct}
                            className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1"
                          >
                            {savingProduct
                              ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                              : <><Plus size={12} strokeWidth={3} color="white" /> Guardar</>
                            }
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
