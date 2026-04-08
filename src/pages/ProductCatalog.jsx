import { useState, useRef } from 'react'
import { useProducts } from '@/hooks/useProducts'
import {
  Plus, Package, Pencil, Trash2, X, Search,
  Upload, Tag, Clock, LayoutGrid, List,
  Download, FileSpreadsheet, AlertTriangle, Check
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const EMPTY_FORM = {
  name: '', description: '', price: '', currency: 'USD',
  type: 'service', category: '', sku: '', status: 'active',
  durationDays: '', problemTags: [],
}

const TYPES = [
  { value: 'product',              label: 'Producto físico'   },
  { value: 'service',              label: 'Servicio'          },
  { value: 'subscription_monthly', label: 'Suscripción mensual' },
  { value: 'subscription_annual',  label: 'Suscripción anual'  },
]

const CURRENCIES = ['USD', 'MXN', 'COP', 'ARS', 'EUR']

const TYPE_BADGE = {
  product:              { label: 'Producto',       color: '#0066ff' },
  service:              { label: 'Servicio',        color: '#7c3aed' },
  subscription_monthly: { label: 'Susc. mensual',  color: '#00b8d9' },
  subscription_annual:  { label: 'Susc. anual',    color: '#00c853' },
}

const HAS_DURATION = ['product', 'subscription_monthly', 'subscription_annual']

// ── CSV IMPORT ─────────────────────────────────────────────────────
const CSV_HEADERS = ['name', 'description', 'price', 'currency', 'type', 'category', 'sku', 'durationDays', 'problemTags', 'status']

function downloadTemplate() {
  const rows = [
    CSV_HEADERS.join(','),
    'Producto Ejemplo,Descripción del producto,299,USD,product,Salud,SKU-001,30,"pérdida de peso,energía",active',
    'Servicio Consultoría,Consultoría personalizada,500,USD,service,Negocios,,,"ventas,productividad",active',
    'Plan Mensual,Membresía mensual,99,USD,subscription_monthly,Membresías,MEM-001,30,"bienestar",active',
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'plantilla_productos.csv'; a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const fields = []
    let current = '', inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes }
      else if (char === ',' && !inQuotes) { fields.push(current.trim()); current = '' }
      else { current += char }
    }
    fields.push(current.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = fields[i] || '' })
    return obj
  }).filter(r => r.name)
}

function ImportModal({ onClose, onImport }) {
  const [step, setStep] = useState('upload') // 'upload' | 'preview' | 'importing'
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result)
      const errs = []
      parsed.forEach((row, i) => {
        if (!row.name) errs.push(`Fila ${i + 2}: falta el nombre`)
        if (!row.price || isNaN(Number(row.price))) errs.push(`Fila ${i + 2}: precio inválido`)
      })
      setRows(parsed)
      setErrors(errs)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    setStep('importing')
    try {
      await onImport(rows)
      toast.success(`${rows.length} productos importados`)
      onClose()
    } catch { toast.error('Error al importar') }
    finally { setImporting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-lg border border-black/[0.08]">

        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06]">
          <div>
            <h2 className="font-display font-bold text-lg tracking-tight">Importar productos</h2>
            <p className="text-xs text-secondary mt-0.5">Sube un CSV con tus productos</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {step === 'upload' && (
            <>
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-[12px]">
                <FileSpreadsheet size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12.5px] text-blue-800 font-semibold mb-1">Formato requerido</p>
                  <p className="text-[11.5px] text-blue-700 leading-relaxed">
                    El CSV debe tener las columnas: name, description, price, currency, type, category, sku, durationDays, problemTags, status. Descarga la plantilla para empezar.
                  </p>
                </div>
              </div>

              <button onClick={downloadTemplate}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border border-black/[0.1] text-[13px] font-semibold text-secondary hover:border-primary/40 hover:text-primary transition-all">
                <Download size={14} /> Descargar plantilla CSV
              </button>

              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-black/[0.14] rounded-[14px] p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-blue-50/30 transition-all">
                <Upload size={28} className="text-tertiary mx-auto mb-2" />
                <p className="font-semibold text-sm text-primary mb-1">Selecciona tu archivo CSV</p>
                <p className="text-xs text-secondary">O arrastra y suelta aquí</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              {errors.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-[10px]">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-semibold text-red-700 mb-1">{errors.length} error{errors.length !== 1 ? 'es' : ''} encontrado{errors.length !== 1 ? 's' : ''}</p>
                    {errors.slice(0, 3).map((e, i) => <p key={i} className="text-[11px] text-red-600">{e}</p>)}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-primary">{rows.length} productos encontrados</span>
                <button onClick={() => { setStep('upload'); setRows([]); setErrors([]) }}
                  className="text-[11.5px] text-secondary hover:text-primary">Cambiar archivo</button>
              </div>

              <div className="max-h-[200px] overflow-y-auto flex flex-col gap-1.5">
                {rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-[8px]">
                    <Check size={12} className="text-green-500 flex-shrink-0" />
                    <span className="text-[12.5px] text-primary font-medium flex-1 truncate">{row.name}</span>
                    <span className="text-[11px] text-secondary">${row.price} {row.currency}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleImport} disabled={rows.length === 0}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40">
                  <Upload size={14} /> Importar {rows.length} productos
                </button>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-8 h-8 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-secondary">Importando {rows.length} productos...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── PRODUCT FORM MODAL ─────────────────────────────────────────────
function ProductModal({ product, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(product ? {
      name: product.name || '',
      description: product.description || '',
      price: String(product.price || ''),
      currency: product.currency || 'USD',
      type: product.type || 'service',
      category: product.category || '',
      sku: product.sku || '',
      status: product.status || 'active',
      durationDays: product.durationDays ? String(product.durationDays) : '',
      problemTags: product.problemTags || [],
    } : {})
  })
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const showDuration = HAS_DURATION.includes(form.type)

  const addTag = (val) => {
    const tag = (val || tagInput).trim().toLowerCase()
    if (!tag || form.problemTags.includes(tag)) return
    setForm(f => ({ ...f, problemTags: [...f.problemTags, tag] }))
    setTagInput('')
  }

  const removeTag = (tag) => setForm(f => ({ ...f, problemTags: f.problemTags.filter(t => t !== tag) }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    if (!form.price || isNaN(Number(form.price))) { toast.error('Precio inválido'); return }
    setSaving(true)
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        currency: form.currency,
        type: form.type,
        category: form.category.trim(),
        sku: form.sku.trim(),
        status: form.status,
        durationDays: showDuration && form.durationDays ? Number(form.durationDays) : null,
        problemTags: form.problemTags,
      })
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-lg border border-black/[0.08]">

        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06]">
          <div>
            <h2 className="font-display font-bold text-lg tracking-tight">
              {product ? 'Editar producto' : 'Nuevo producto'}
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              {product ? 'Actualiza la información' : 'Agrega un producto al catálogo'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">

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
              placeholder="Describe el producto o servicio..." className="input resize-none" rows={2} />
          </div>

          {/* Precio + Moneda */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">Precio *</label>
              <input type="number" value={form.price} onChange={set('price')} placeholder="0" className="input" min="0" step="0.01" required />
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
              <input value={form.category} onChange={set('category')} placeholder="Ej: Salud, Marketing..."
                list="categories-list" className="input" />
              <datalist id="categories-list">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {/* Duración */}
          {showDuration && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
                Duración del producto <span className="font-normal text-tertiary lowercase tracking-normal">días</span>
              </label>
              <div className="flex items-center gap-2">
                <input type="number" value={form.durationDays} onChange={set('durationDays')}
                  placeholder="30" className="input w-28" min="1" />
                <p className="text-[11px] text-secondary flex items-center gap-1">
                  <Clock size={11} /> Activa recompra automática al día {form.durationDays ? Math.floor(Number(form.durationDays) * 0.83) : '25'}
                </p>
              </div>
            </div>
          )}

          {/* Problemas que resuelve */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-1.5">
              Problemas que resuelve
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.problemTags.map(tag => (
                <span key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2 border border-black/[0.08] text-[11px] text-secondary">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-tertiary hover:text-red-500 ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } if (e.key === ',') { e.preventDefault(); addTag() } }}
                placeholder="pérdida de peso, energía... (Enter para agregar)"
                className="input text-sm flex-1" />
              <button type="button" onClick={() => addTag()}
                className="btn-secondary text-xs px-3">Agregar</button>
            </div>
            <p className="text-[10px] text-tertiary mt-1">El agente usa esto para asociar leads al producto correcto durante la conversación</p>
          </div>

          {/* Estado */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary block mb-2">Estado</label>
            <div className="flex gap-2">
              {[{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }].map(s => (
                <button key={s.value} type="button"
                  onClick={() => setForm(f => ({ ...f, status: s.value }))}
                  className={clsx('flex-1 py-2 rounded-[10px] text-[12.5px] font-semibold border transition-all',
                    form.status === s.value
                      ? s.value === 'active'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-red-50 border-red-300 text-red-600'
                      : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                  )}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : product ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── PRODUCT CARD (grid view) ──────────────────────────────────────
function ProductCard({ product, onEdit, onDelete }) {
  const badge = TYPE_BADGE[product.type] || { label: product.type, color: '#8e8e93' }
  return (
    <div className="card p-4 flex flex-col gap-3 hover:shadow-card-md transition-all">
      {/* Image */}
      {product.imageUrl ? (
        <div className="w-full h-32 rounded-[10px] overflow-hidden bg-surface-2">
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-32 rounded-[10px] bg-surface-2 flex items-center justify-center">
          <Package size={28} className="text-tertiary" strokeWidth={1.5} />
        </div>
      )}
      {/* Info */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-display font-bold text-[13.5px] text-primary leading-tight">{product.name}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: badge.color + '18', color: badge.color }}>{badge.label}</span>
        </div>
        {product.description && (
          <p className="text-[11.5px] text-secondary line-clamp-2 leading-relaxed">{product.description}</p>
        )}
      </div>
      {/* Price + duration */}
      <div className="flex items-center gap-2">
        <span className="font-display font-bold text-[15px] text-primary">
          {product.currency} {Number(product.price).toLocaleString()}
        </span>
        {product.durationDays > 0 && (
          <span className="text-[10px] text-secondary flex items-center gap-1">
            <Clock size={10} /> {product.durationDays}d
          </span>
        )}
      </div>
      {/* Problem tags */}
      {product.problemTags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {product.problemTags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 border border-black/[0.06] text-secondary">
              {tag}
            </span>
          ))}
          {product.problemTags.length > 3 && (
            <span className="text-[10px] text-tertiary px-1">+{product.problemTags.length - 3}</span>
          )}
        </div>
      )}
      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <button onClick={() => onEdit(product)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-black/[0.1] text-[11.5px] font-semibold text-secondary hover:border-black/[0.2] hover:text-primary transition-all flex-1 justify-center">
          <Pencil size={12} /> Editar
        </button>
        <button onClick={() => onDelete(product)}
          className="w-8 h-8 rounded-[8px] flex items-center justify-center text-tertiary hover:bg-red-50 hover:text-red-500 transition-colors border border-black/[0.1]">
          <Trash2 size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

// ── MAIN CATALOG ──────────────────────────────────────────────────
export default function ProductCatalog() {
  const { products, loading, categories, createProduct, updateProduct, deleteProduct } = useProducts()
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const openNew = () => { setEditProduct(null); setShowModal(true) }
  const openEdit = (product) => { setEditProduct(product); setShowModal(true) }

  const handleSave = async (data) => {
    try {
      if (editProduct) {
        await updateProduct(editProduct.id, data)
        toast.success('Producto actualizado')
      } else {
        await createProduct(data)
        toast.success('Producto creado')
      }
      setShowModal(false)
      setEditProduct(null)
    } catch {
      toast.error('Error al guardar')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteProduct(confirmDelete.id, confirmDelete.imageUrl)
      toast.success('Producto eliminado')
      setConfirmDelete(null)
    } catch { toast.error('Error al eliminar') }
  }

  const handleImport = async (rows) => {
    for (const row of rows) {
      await createProduct({
        name: row.name,
        description: row.description || '',
        price: Number(row.price) || 0,
        currency: row.currency || 'USD',
        type: row.type || 'service',
        category: row.category || '',
        sku: row.sku || '',
        status: row.status || 'active',
        durationDays: row.durationDays ? Number(row.durationDays) : null,
        problemTags: row.problemTags ? row.problemTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      })
    }
  }

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
        p.category?.toLowerCase().includes(q) ||
        p.problemTags?.some(t => t.includes(q))
      )
    }
    return true
  })

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="bg-transparent text-[12.5px] text-primary placeholder-tertiary flex-1 outline-none" />
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

        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-surface-2 border border-black/[0.08] rounded-[8px] p-0.5">
            <button onClick={() => setViewMode('grid')}
              className={clsx('px-2.5 py-1.5 rounded-[6px] transition-all',
                viewMode === 'grid' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary')}>
              <LayoutGrid size={13} />
            </button>
            <button onClick={() => setViewMode('list')}
              className={clsx('px-2.5 py-1.5 rounded-[6px] transition-all',
                viewMode === 'list' ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary')}>
              <List size={13} />
            </button>
          </div>

          <button onClick={() => setShowImport(true)}
            className="btn-secondary text-[12.5px] py-1.5 px-3 flex items-center gap-1.5">
            <Upload size={13} /> Importar
          </button>
          <button onClick={openNew}
            className="btn-primary text-[12.5px] py-1.5 px-3.5 flex items-center gap-1.5">
            <Plus size={14} strokeWidth={3} color="white" /> Nuevo producto
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-16 h-16 rounded-2xl bg-black/[0.02] border border-black/[0.05] flex items-center justify-center text-tertiary mb-2">
              <Package size={32} strokeWidth={1.5} />
            </div>
            <p className="font-display font-bold text-lg text-primary">Sin productos</p>
            <p className="text-sm text-secondary">
              {search ? 'Sin resultados para tu búsqueda' : 'Crea tu primer producto o importa desde CSV'}
            </p>
            <div className="flex gap-2 mt-1">
              <button onClick={() => setShowImport(true)} className="btn-secondary text-sm py-2 px-4 flex items-center gap-1.5">
                <Upload size={13} /> Importar CSV
              </button>
              <button onClick={openNew} className="btn-primary text-sm py-2 px-4">Nuevo producto</button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product}
                onEdit={openEdit} onDelete={setConfirmDelete} />
            ))}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="max-w-4xl flex flex-col gap-0 card overflow-hidden">
            {filtered.map((product, i) => {
              const badge = TYPE_BADGE[product.type] || { label: product.type, color: '#8e8e93' }
              return (
                <div key={product.id}
                  className={clsx('flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2',
                    i < filtered.length - 1 && 'border-b border-black/[0.05]')}>
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-[10px] bg-surface-2 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      : <Package size={18} className="text-tertiary" />}
                  </div>
                  {/* Name + desc */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display font-bold text-[13.5px] text-primary truncate">{product.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: badge.color + '18', color: badge.color }}>{badge.label}</span>
                      {(product.status || 'active') === 'inactive' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface-2 text-secondary flex-shrink-0">Inactivo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {product.durationDays > 0 && (
                        <span className="text-[10.5px] text-secondary flex items-center gap-0.5">
                          <Clock size={10} /> {product.durationDays} días
                        </span>
                      )}
                      {product.problemTags?.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 border border-black/[0.06] text-secondary">
                          {tag}
                        </span>
                      ))}
                      {product.problemTags?.length > 3 && (
                        <span className="text-[10px] text-tertiary">+{product.problemTags.length - 3} más</span>
                      )}
                    </div>
                  </div>
                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <div className="font-display font-bold text-[14px] text-primary">
                      {product.currency} {Number(product.price).toLocaleString()}
                    </div>
                    {product.sku && <div className="text-[10px] text-tertiary">{product.sku}</div>}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => openEdit(product)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors">
                      <Pencil size={13} strokeWidth={2.5} />
                    </button>
                    <button onClick={() => setConfirmDelete(product)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODALS */}
      {showModal && (
        <ProductModal
          product={editProduct}
          categories={categories}
          onClose={() => { setShowModal(false); setEditProduct(null) }}
          onSave={handleSave}
        />
      )}

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-sm border border-black/[0.08] p-6">
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
