import { useState, useRef } from 'react'
import { useProducts } from '@/hooks/useProducts'
import { Plus, Package, Pencil, Trash2, X, ImageOff, Search, Upload, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const EMPTY_FORM = {
  name: '', description: '', price: '', currency: 'USD',
  type: 'service', category: '', sku: '', status: 'active',
}

const TYPES = [
  { value: 'product', label: 'Producto físico' },
  { value: 'service', label: 'Servicio' },
  { value: 'subscription_monthly', label: 'Suscripción mensual' },
  { value: 'subscription_annual', label: 'Suscripción anual' },
]

const CURRENCIES = ['USD', 'MXN', 'COP', 'ARS', 'EUR']

const TYPE_BADGE = {
  product: { label: 'Producto', color: '#0066ff' },
  service: { label: 'Servicio', color: '#7c3aed' },
  subscription_monthly: { label: 'Susc. mensual', color: '#00b8d9' },
  subscription_annual: { label: 'Susc. anual', color: '#00c853' },
}

export default function ProductCatalog() {
  const { products, loading, categories, createProduct, updateProduct, deleteProduct } = useProducts()
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const fileInputRef = useRef(null)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const openNew = () => {
    setEditProduct(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview('')
    setShowModal(true)
  }

  const openEdit = (product) => {
    setEditProduct(product)
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: String(product.price || ''),
      currency: product.currency || 'USD',
      type: product.type || 'service',
      category: product.category || '',
      sku: product.sku || '',
      status: product.status || 'active',
    })
    setImageFile(null)
    setImagePreview(product.imageUrl || '')
    setShowModal(true)
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    if (!form.price || isNaN(Number(form.price))) { toast.error('El precio debe ser un número válido'); return }
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        currency: form.currency,
        type: form.type,
        category: form.category.trim(),
        sku: form.sku.trim(),
        status: form.status,
      }
      if (editProduct) {
        await updateProduct(editProduct.id, data, imageFile || undefined)
        toast.success('Producto actualizado')
      } else {
        await createProduct(data, imageFile || undefined)
        toast.success('Producto creado')
      }
      setShowModal(false)
    } catch (err) {
      toast.error('Error al guardar el producto')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteProduct(confirmDelete.id, confirmDelete.imageUrl)
      toast.success('Producto eliminado')
      setConfirmDelete(null)
    } catch {
      toast.error('Error al eliminar')
    }
  }

  // Filtros
  const filtered = products.filter(p => {
    if (statusFilter !== 'all' && (p.status || 'active') !== statusFilter) return false
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      )
    }
    return true
  })

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-secondary">Cargando catálogo...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-[15px] tracking-tight">Catálogo</h1>
        <span className="text-[11px] font-semibold bg-surface-2 border border-black/[0.08] px-2.5 py-1 rounded-full text-secondary ml-1">
          {products.length} productos
        </span>

        {/* Search */}
        <div className="flex items-center gap-2 bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 ml-2 w-52">
          <Search size={13} strokeWidth={2.5} className="text-tertiary flex-shrink-0" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="bg-transparent text-[12.5px] text-primary placeholder-tertiary flex-1 outline-none"
          />
        </div>

        {/* Filters */}
        {categories.length > 0 && (
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer">
            <option value="all">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer">
          <option value="all">Todos los tipos</option>
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer">
          <option value="all">Activos e inactivos</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
        </select>

        <div className="ml-auto">
          <button onClick={openNew} className="btn-primary text-[12.5px] py-1.5 px-3.5 flex items-center gap-1.5">
            <Plus size={14} strokeWidth={3} color="white" />
            Nuevo producto
          </button>
        </div>
      </div>

      {/* GRID */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-black/[0.08] flex items-center justify-center">
              <Package size={28} strokeWidth={1.5} className="text-tertiary" />
            </div>
            <div>
              <div className="font-semibold text-primary text-[15px]">
                {products.length === 0 ? 'Sin productos todavía' : 'Sin resultados'}
              </div>
              <div className="text-secondary text-[13px] mt-1">
                {products.length === 0
                  ? 'Crea tu primer producto o servicio para vincularlo a tus leads'
                  : 'Prueba con otros filtros'}
              </div>
            </div>
            {products.length === 0 && (
              <button onClick={openNew} className="btn-primary text-[13px] py-2 px-4 flex items-center gap-2">
                <Plus size={14} strokeWidth={3} color="white" />
                Crear producto
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(product => {
              const typeBadge = TYPE_BADGE[product.type] || TYPE_BADGE.service
              const isInactive = (product.status || 'active') === 'inactive'
              return (
                <div
                  key={product.id}
                  className={clsx(
                    'bg-surface rounded-[14px] border overflow-hidden hover:shadow-md transition-shadow duration-150 group',
                    isInactive ? 'border-black/[0.05] opacity-60' : 'border-black/[0.08]'
                  )}
                >
                  {/* Image */}
                  <div className="h-36 bg-surface-2 flex items-center justify-center overflow-hidden relative">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name}
                        className="w-full h-full object-cover"
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    ) : (
                      <ImageOff size={28} strokeWidth={1.5} className="text-tertiary" />
                    )}
                    {isInactive && (
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        Inactivo
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-semibold text-[13.5px] text-primary truncate flex-1">{product.name}</div>
                      <div
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${typeBadge.color}15`, color: typeBadge.color }}
                      >
                        {typeBadge.label}
                      </div>
                    </div>
                    {product.category && (
                      <div className="flex items-center gap-1 mb-1">
                        <Tag size={11} className="text-tertiary" />
                        <span className="text-[11px] text-tertiary">{product.category}</span>
                      </div>
                    )}
                    {product.description && (
                      <p className="text-[12px] text-secondary mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[15px] font-bold text-primary">
                          ${Number(product.price).toLocaleString()}
                        </span>
                        <span className="text-[11px] text-tertiary ml-1">{product.currency || 'USD'}</span>
                        {product.sku && (
                          <div className="text-[10.5px] text-tertiary mt-0.5">SKU: {product.sku}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(product)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors">
                          <Pencil size={13} strokeWidth={2.5} />
                        </button>
                        <button onClick={() => setConfirmDelete(product)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Trash2 size={13} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL — Crear / Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-lg border border-black/[0.08] animate-in fade-in zoom-in-95 duration-150">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06]">
              <div>
                <h2 className="font-display font-bold text-lg tracking-tight">
                  {editProduct ? 'Editar producto' : 'Nuevo producto'}
                </h2>
                <p className="text-xs text-secondary mt-0.5">
                  {editProduct ? 'Actualiza la información del producto' : 'Agrega un producto o servicio al catálogo'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors">
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">

              {/* Imagen */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                  Imagen del producto
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-32 rounded-[12px] border-2 border-dashed border-black/[0.12] hover:border-primary/40 bg-surface-2 flex items-center justify-center cursor-pointer overflow-hidden transition-colors group"
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload size={20} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-tertiary">
                      <Upload size={20} strokeWidth={1.5} />
                      <span className="text-[12px]">Subir imagen (máx. 5MB)</span>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>

              {/* Nombre + SKU */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">Nombre *</label>
                  <input value={form.name} onChange={set('name')} placeholder="Plan Pro..." className="input" required autoFocus />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">SKU</label>
                  <input value={form.sku} onChange={set('sku')} placeholder="PRO-001" className="input" />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">Descripción</label>
                <textarea value={form.description} onChange={set('description')}
                  placeholder="Describe brevemente el producto o servicio..."
                  className="input resize-none" rows={2} />
              </div>

              {/* Precio + Moneda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">Precio *</label>
                  <input type="number" value={form.price} onChange={set('price')}
                    placeholder="0" className="input" min="0" step="0.01" required />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">Moneda</label>
                  <select value={form.currency} onChange={set('currency')} className="input">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Tipo + Categoría */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">Tipo</label>
                  <select value={form.type} onChange={set('type')} className="input">
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">Categoría</label>
                  <input value={form.category} onChange={set('category')}
                    placeholder="Ej: Marketing, Consultoría..."
                    list="categories-list" className="input" />
                  <datalist id="categories-list">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              {/* Estado */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-2">Estado</label>
                <div className="flex gap-2">
                  {[{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }].map(s => (
                    <button key={s.value} type="button"
                      onClick={() => setForm(f => ({ ...f, status: s.value }))}
                      className={clsx(
                        'flex-1 py-2 rounded-[10px] text-[12.5px] font-semibold border transition-all',
                        form.status === s.value
                          ? s.value === 'active'
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-red-50 border-red-300 text-red-600'
                          : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                      )}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : editProduct ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-sm border border-black/[0.08] animate-in fade-in zoom-in-95 duration-150 p-6">
            <div className="font-display font-bold text-[16px] mb-2">¿Eliminar producto?</div>
            <div className="text-secondary text-[13px] mb-6">
              <span className="font-semibold text-primary">"{confirmDelete.name}"</span> será eliminado permanentemente del catálogo.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleDelete}
                className="flex-1 py-2 px-4 rounded-[10px] bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const openNew = () => {
    setEditProduct(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (product) => {
    setEditProduct(product)
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: String(product.price || ''),
      imageUrl: product.imageUrl || '',
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    if (!form.price || isNaN(Number(form.price))) { toast.error('El precio debe ser un número válido'); return }

    setSaving(true)
    try {
      if (editProduct) {
        await updateProduct(editProduct.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          imageUrl: form.imageUrl.trim(),
        })
        toast.success('Producto actualizado')
      } else {
        await createProduct({
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          imageUrl: form.imageUrl.trim(),
        })
        toast.success('Producto creado')
      }
      setShowModal(false)
    } catch (err) {
      toast.error('Error al guardar el producto')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (productId) => {
    try {
      await deleteProduct(productId)
      toast.success('Producto eliminado')
      setConfirmDelete(null)
    } catch (err) {
      toast.error('Error al eliminar')
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-secondary">Cargando catálogo...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-[15px] tracking-tight">Catálogo de Productos</h1>
        <span className="text-[11px] font-semibold bg-surface-2 border border-black/[0.08] px-2.5 py-1 rounded-full text-secondary ml-1">
          {products.length} productos
        </span>
        <div className="ml-auto">
          <button
            onClick={openNew}
            className="btn-primary text-[12.5px] py-1.5 px-3.5 flex items-center gap-1.5"
          >
            <Plus size={14} strokeWidth={3} color="white" />
            Nuevo producto
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-black/[0.08] flex items-center justify-center">
              <Package size={28} strokeWidth={1.5} className="text-tertiary" />
            </div>
            <div>
              <div className="font-semibold text-primary text-[15px]">Sin productos todavía</div>
              <div className="text-secondary text-[13px] mt-1">Crea tu primer producto o servicio para vincularlo a tus leads</div>
            </div>
            <button onClick={openNew} className="btn-primary text-[13px] py-2 px-4 flex items-center gap-2">
              <Plus size={14} strokeWidth={3} color="white" />
              Crear producto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(product => (
              <div
                key={product.id}
                className="bg-surface rounded-[14px] border border-black/[0.08] overflow-hidden hover:shadow-md transition-shadow duration-150 group"
              >
                {/* Image */}
                <div className="h-36 bg-surface-2 flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <ImageOff size={28} strokeWidth={1.5} className="text-tertiary" />
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="font-semibold text-[14px] text-primary truncate">{product.name}</div>
                  {product.description && (
                    <div className="text-[12.5px] text-secondary mt-1 line-clamp-2">{product.description}</div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[15px] font-bold text-primary">
                      ${Number(product.price).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(product)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors"
                      >
                        <Pencil size={13} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(product)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL — Crear / Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-md border border-black/[0.08] animate-in fade-in zoom-in-95 duration-150">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06]">
              <div>
                <h2 className="font-display font-bold text-lg tracking-tight">
                  {editProduct ? 'Editar producto' : 'Nuevo producto'}
                </h2>
                <p className="text-xs text-secondary mt-0.5">
                  {editProduct ? 'Actualiza la información del producto' : 'Agrega un producto o servicio al catálogo'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">

              {/* Nombre */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                  Nombre del producto *
                </label>
                <input
                  value={form.name} onChange={set('name')}
                  placeholder="Plan Pro, Paquete Inicial..."
                  className="input" required autoFocus
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                  Descripción
                </label>
                <textarea
                  value={form.description} onChange={set('description')}
                  placeholder="Describe brevemente el producto o servicio..."
                  className="input resize-none"
                  rows={3}
                />
              </div>

              {/* Precio */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                  Precio (USD) *
                </label>
                <input
                  type="number" value={form.price} onChange={set('price')}
                  placeholder="0"
                  className="input"
                  min="0" step="0.01" required
                />
              </div>

              {/* URL de imagen */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                  URL de imagen (opcional)
                </label>
                <input
                  value={form.imageUrl} onChange={set('imageUrl')}
                  placeholder="https://..."
                  className="input"
                  type="url"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    editProduct ? 'Guardar cambios' : 'Crear producto'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-sm border border-black/[0.08] animate-in fade-in zoom-in-95 duration-150 p-6">
            <div className="font-display font-bold text-[16px] mb-2">¿Eliminar producto?</div>
            <div className="text-secondary text-[13px] mb-6">
              <span className="font-semibold text-primary">"{confirmDelete.name}"</span> será eliminado permanentemente del catálogo.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                className="flex-1 py-2 px-4 rounded-[10px] bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
