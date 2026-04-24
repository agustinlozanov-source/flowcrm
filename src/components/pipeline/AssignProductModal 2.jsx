import { useState, useRef, useEffect } from 'react'
import { useProducts } from '@/hooks/useProducts'
import { X, Package, Search, Plus, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AssignProductModal({ lead, onClose, onSave }) {
  const { products, createProduct } = useProducts()
  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', price: '', currency: 'USD' })
  const [savingProduct, setSavingProduct] = useState(false)
  const [saving, setSaving] = useState(false)
  const dropRef = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.trim()
    ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : products

  const handleSelect = (p) => {
    setSelectedProduct(p)
    setPrice(String(p.price))
    setCurrency(p.currency || 'USD')
    setQuery('')
    setOpen(false)
    setShowCreate(false)
  }

  const handleCreate = async () => {
    if (!newForm.name.trim() || !newForm.price) {
      toast.error('Nombre y precio requeridos')
      return
    }
    setSavingProduct(true)
    try {
      const created = await createProduct({
        name: newForm.name.trim(),
        price: Number(newForm.price),
        currency: newForm.currency,
        description: '',
      })
      if (created?.id) {
        const p = { id: created.id, name: newForm.name.trim(), price: Number(newForm.price), currency: newForm.currency }
        setSelectedProduct(p)
        setPrice(String(newForm.price))
        setCurrency(newForm.currency)
      }
      setShowCreate(false)
      setOpen(false)
      setNewForm({ name: '', price: '', currency: 'USD' })
      toast.success('Producto creado')
    } catch {
      toast.error('Error al crear producto')
    } finally {
      setSavingProduct(false)
    }
  }

  const handleSave = async () => {
    if (!selectedProduct) { toast.error('Selecciona un producto'); return }
    if (!price) { toast.error('Ingresa el precio'); return }
    setSaving(true)
    try {
      await onSave({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        price: Number(price),
        currency,
      })
    } catch {
      toast.error('Error al asignar producto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-sm border border-black/[0.08] animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06]">
          <div>
            <h2 className="font-display font-bold text-[15px] tracking-tight flex items-center gap-2">
              <Package size={15} className="text-accent-blue" />
              Asignar producto
            </h2>
            <p className="text-xs text-secondary mt-0.5">{lead.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors">
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">

          {/* Product selector */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
              Producto *
            </label>
            <div ref={dropRef} className="relative">
              <div
                onClick={() => { setOpen(o => !o); setShowCreate(false) }}
                className="input flex items-center gap-2 cursor-pointer select-none pr-3"
              >
                <Package size={13} className="text-tertiary flex-shrink-0" />
                {selectedProduct ? (
                  <span className="flex-1 text-[13px] text-primary truncate">
                    {selectedProduct.name} — ${Number(selectedProduct.price).toLocaleString()} {selectedProduct.currency || 'USD'}
                  </span>
                ) : (
                  <span className="flex-1 text-[13px] text-tertiary">Buscar producto...</span>
                )}
                {selectedProduct ? (
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setSelectedProduct(null); setPrice('') }}
                    className="text-tertiary hover:text-primary">
                    <X size={13} />
                  </button>
                ) : (
                  <ChevronDown size={13} className="text-tertiary" />
                )}
              </div>

              {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-black/[0.1] rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/[0.07]">
                    <Search size={13} className="text-tertiary flex-shrink-0" />
                    <input
                      autoFocus
                      value={query}
                      onChange={e => { setQuery(e.target.value); setShowCreate(false) }}
                      placeholder="Buscar por nombre..."
                      className="flex-1 text-[12.5px] bg-transparent outline-none text-primary placeholder-tertiary"
                    />
                  </div>
                  <div className="max-h-[160px] overflow-y-auto">
                    {filtered.length > 0 ? (
                      filtered.map(p => (
                        <button key={p.id} type="button" onClick={() => handleSelect(p)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-2 text-left transition-colors">
                          <span className="text-[13px] text-primary font-medium truncate">{p.name}</span>
                          <span className="text-[12px] text-secondary font-semibold ml-3 flex-shrink-0">
                            ${Number(p.price).toLocaleString()} {p.currency || 'USD'}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-[12.5px] text-tertiary text-center py-3">Sin resultados</p>
                    )}
                  </div>
                  <div className="border-t border-black/[0.07]">
                    {!showCreate ? (
                      <button type="button" onClick={() => setShowCreate(true)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-[12.5px] font-semibold text-accent-blue hover:bg-blue-50 transition-colors">
                        <Plus size={13} strokeWidth={2.5} /> Crear nuevo producto
                      </button>
                    ) : (
                      <div className="p-3 flex flex-col gap-2">
                        <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Nuevo producto</p>
                        <input
                          autoFocus
                          value={newForm.name}
                          onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Nombre del producto"
                          className="input text-[12.5px] py-1.5"
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={newForm.price}
                            onChange={e => setNewForm(f => ({ ...f, price: e.target.value }))}
                            placeholder="Precio"
                            className="input text-[12.5px] py-1.5 flex-1"
                            min="0"
                          />
                          <select
                            value={newForm.currency}
                            onChange={e => setNewForm(f => ({ ...f, currency: e.target.value }))}
                            className="input text-[12.5px] py-1.5 w-20"
                          >
                            {['USD', 'MXN', 'COP', 'ARS', 'EUR'].map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setShowCreate(false)}
                            className="btn-secondary text-xs py-1.5 flex-1">Cancelar</button>
                          <button type="button" onClick={handleCreate} disabled={savingProduct}
                            className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1">
                            {savingProduct
                              ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                              : <><Plus size={12} strokeWidth={3} color="white" /> Guardar</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Price override */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                Precio *
              </label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0"
                className="input"
                min="0"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                Moneda
              </label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="input">
                {['USD', 'MXN', 'COP', 'ARS', 'EUR'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !selectedProduct}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Package size={13} /> Asignar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
