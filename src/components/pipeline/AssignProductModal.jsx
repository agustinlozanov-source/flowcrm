import { useState, useRef, useEffect } from 'react'
import { useProducts } from '@/hooks/useProducts'
import { usePipeline } from '@/hooks/usePipeline'
import { X, Package, Search, Plus, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function AssignProductModal({ lead, onClose }) {
  const { products, createProduct } = useProducts()
  const { updateLead } = usePipeline()
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', price: '', currency: 'USD' })
  const [manualValue, setManualValue] = useState(lead.value ? String(lead.value) : '')
  const [manualCurrency, setManualCurrency] = useState('USD')
  const [saving, setSaving] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [activeTab, setActiveTab] = useState('product')
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = query.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.problemTags?.some(t => t.includes(query.toLowerCase()))
      )
    : products.filter(p => (p.status || 'active') === 'active')

  const handleSelectProduct = async (product) => {
    setSaving(true)
    try {
      await updateLead(lead.id, { productId: product.id, value: product.price })
      toast.success(`"${product.name}" asignado`)
      onClose()
    } catch { toast.error('Error al asignar') }
    finally { setSaving(false) }
  }

  const handleCreateAndAssign = async () => {
    if (!newForm.name.trim() || !newForm.price) return
    setSavingProduct(true)
    try {
      const created = await createProduct({
        name: newForm.name.trim(), price: Number(newForm.price),
        currency: newForm.currency, description: '', type: 'service', status: 'active',
      })
      if (created?.id) {
        await updateLead(lead.id, { productId: created.id, value: Number(newForm.price) })
        toast.success('Producto creado y asignado')
        onClose()
      }
    } catch { toast.error('Error') }
    finally { setSavingProduct(false) }
  }

  const handleManualValue = async () => {
    if (!manualValue || isNaN(Number(manualValue))) { toast.error('Valor inválido'); return }
    setSaving(true)
    try {
      await updateLead(lead.id, { value: Number(manualValue) })
      toast.success('Valor actualizado')
      onClose()
    } catch { toast.error('Error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-md border border-black/[0.08]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
          <div>
            <h2 className="font-display font-bold text-[15px]">Valor de la oportunidad</h2>
            <p className="text-xs text-secondary mt-0.5">{lead.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} />
          </button>
        </div>

        <div className="flex border-b border-black/[0.06] px-6">
          {[
            { id: 'product', label: 'Producto del catálogo', Icon: Package },
            { id: 'manual',  label: 'Valor manual',          Icon: DollarSign },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={clsx('flex items-center gap-1.5 px-1 py-3 mr-5 text-[12.5px] font-semibold border-b-2 transition-all',
                activeTab === id ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary')}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'product' && (
            <>
              <div className="flex items-center gap-2 bg-surface-2 border border-black/[0.08] rounded-[10px] px-3 py-2 mb-3">
                <Search size={13} className="text-tertiary flex-shrink-0" />
                <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar producto..." className="flex-1 bg-transparent text-[13px] text-primary placeholder-tertiary outline-none" />
              </div>

              <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto mb-3">
                {filtered.length === 0
                  ? <p className="text-[12.5px] text-tertiary text-center py-4">Sin productos activos</p>
                  : filtered.map(product => (
                    <button key={product.id} onClick={() => handleSelectProduct(product)} disabled={saving}
                      className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-[10px] border text-left transition-all hover:border-primary/40 hover:bg-blue-50/30',
                        lead.productId === product.id ? 'border-primary bg-blue-50/50' : 'border-black/[0.08]')}>
                      <Package size={14} className="text-tertiary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13px] text-primary truncate">{product.name}</div>
                        {product.problemTags?.length > 0 && (
                          <div className="text-[10px] text-tertiary truncate">{product.problemTags.slice(0, 3).join(', ')}</div>
                        )}
                      </div>
                      <div className="font-bold text-[13px] text-primary flex-shrink-0">
                        {product.currency} {Number(product.price).toLocaleString()}
                      </div>
                    </button>
                  ))
                }
              </div>

              {!showCreate ? (
                <button onClick={() => setShowCreate(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border border-dashed border-black/[0.14] text-[12.5px] font-semibold text-secondary hover:border-primary/40 hover:text-primary transition-all">
                  <Plus size={13} /> Crear y asignar nuevo producto
                </button>
              ) : (
                <div className="flex flex-col gap-2 p-3 bg-surface-2 rounded-[10px]">
                  <p className="text-[11px] font-bold text-secondary uppercase tracking-wide">Nuevo producto</p>
                  <input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nombre" className="input text-sm" autoFocus />
                  <div className="flex gap-2">
                    <input type="number" value={newForm.price} onChange={e => setNewForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="Precio" className="input text-sm flex-1" min="0" />
                    <select value={newForm.currency} onChange={e => setNewForm(f => ({ ...f, currency: e.target.value }))}
                      className="input text-sm w-20">
                      {['USD','MXN','COP','ARS','EUR'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs py-1.5 flex-1">Cancelar</button>
                    <button onClick={handleCreateAndAssign} disabled={savingProduct || !newForm.name.trim() || !newForm.price}
                      className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1 disabled:opacity-40">
                      {savingProduct ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus size={12} /> Crear</>}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'manual' && (
            <div className="flex flex-col gap-4">
              <p className="text-[12.5px] text-secondary leading-relaxed">
                Asigna un valor estimado a esta oportunidad sin ligarlo a un producto del catálogo.
              </p>
              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Valor</label>
                <div className="flex gap-2">
                  <input type="number" value={manualValue} onChange={e => setManualValue(e.target.value)}
                    placeholder="0" className="input flex-1" min="0" autoFocus />
                  <select value={manualCurrency} onChange={e => setManualCurrency(e.target.value)} className="input w-20">
                    {['USD','MXN','COP','ARS','EUR'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleManualValue} disabled={saving || !manualValue}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><DollarSign size={14} /> Guardar</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
