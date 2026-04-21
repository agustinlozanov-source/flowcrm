import { useState, useEffect, useRef } from 'react'
import { doc, collection, addDoc, onSnapshot, serverTimestamp, orderBy, query, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { normalizePhone } from '@/lib/utils'
import { usePipeline, SYSTEM_STAGES, DISCARD_CATEGORIES } from '@/hooks/usePipeline'
import { useProducts } from '@/hooks/useProducts'
import { useAppointments, APPOINTMENT_TYPES, VIDEO_PLATFORMS } from '@/hooks/useAppointments'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  Edit2, Trash2, X, FileText, Phone, MessageCircle, Mail, Calendar,
  Package, ChevronDown, Search, Plus, Star, AlertTriangle, Clock,
  CheckCircle2, XCircle, ArrowRight, Video, TrendingUp
} from 'lucide-react'

const SOURCE_CONFIG = {
  meta_ads:  { icon: '🔵', label: 'Meta Ads' },
  instagram: { icon: '📸', label: 'Instagram' },
  whatsapp:  { icon: '💬', label: 'WhatsApp' },
  linkedin:  { icon: '💼', label: 'LinkedIn' },
  web:       { icon: '🌐', label: 'Web' },
  referral:  { icon: '⭐', label: 'Referido' },
  manual:    { icon: '✏️', label: 'Manual' },
}

const INTERACTION_TYPES = [
  { value: 'note',     label: 'Nota',     icon: <FileText size={14} /> },
  { value: 'call',     label: 'Llamada',  icon: <Phone size={14} /> },
  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={14} /> },
  { value: 'email',    label: 'Email',    icon: <Mail size={14} /> },
  { value: 'meeting',  label: 'Reunión',  icon: <Calendar size={14} /> },
]

// ── ScoreRing ────────────────────────────────────────────────────
function ScoreRing({ score, onClick, hasHistory }) {
  const r = 28, circ = 2 * Math.PI * r, pct = (score || 0) / 100
  const color = score >= 80 ? '#00c853' : score >= 50 ? '#f59e0b' : '#6e6e73'
  return (
    <div
      className={clsx(
        'relative flex items-center justify-center w-20 h-20 flex-shrink-0',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
      title={onClick ? 'Ver historial de score' : undefined}
    >
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display font-bold text-xl leading-none" style={{ color }}>{score || 0}</span>
        <span className="text-[9px] text-tertiary font-semibold uppercase tracking-wide">score</span>
      </div>
      {hasHistory && (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent-blue flex items-center justify-center">
          <TrendingUp size={9} className="text-white" />
        </div>
      )}
    </div>
  )
}

// ── ScoreHistoryPopover ──────────────────────────────────────────
function ScoreHistoryPopover({ events, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const initialScore = events.length > 0 ? events[events.length - 1].prevScore : 0

  return (
    <div
      ref={ref}
      className="absolute left-0 top-24 z-50 w-72 bg-white rounded-2xl border border-black/[0.08] overflow-hidden"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}
    >
      <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-accent-blue" />
          <span className="text-[12px] font-semibold text-primary">Historial de Score</span>
        </div>
        <button onClick={onClose} className="text-tertiary hover:text-primary transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[12px] text-tertiary">Sin cambios de score registrados</p>
            <p className="text-[11px] text-tertiary mt-1">Los cambios futuros aparecerán aquí</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.05]">
            {events.map((ev, i) => {
              const date = ev.createdAt?.toDate
                ? format(ev.createdAt.toDate(), "d MMM · HH:mm", { locale: es })
                : ''
              const isUp = ev.delta > 0
              const isDown = ev.delta < 0
              const cats = Object.entries(ev.categories || {})
                .filter(([, v]) => v.delta !== 0 && v.reason)
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={clsx(
                        'text-[13px] font-bold',
                        isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-tertiary'
                      )}>
                        {isUp ? '+' : ''}{ev.delta}
                      </span>
                      <span className="text-[11px] text-tertiary">
                        {ev.prevScore} → {ev.newScore}
                      </span>
                    </div>
                    <span className="text-[10px] text-tertiary">{date}</span>
                  </div>
                  {cats.length > 0 && (
                    <div className="space-y-0.5 mt-1">
                      {cats.map(([catId, v]) => (
                        <div key={catId} className="flex items-start gap-1">
                          <span className={clsx(
                            'text-[10px] font-semibold mt-0.5 flex-shrink-0',
                            v.delta > 0 ? 'text-green-500' : 'text-red-400'
                          )}>
                            {v.delta > 0 ? '▲' : '▼'}
                          </span>
                          <span className="text-[11px] text-secondary leading-snug">{v.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {events.length > 0 && (
        <div className="px-4 py-2 bg-surface-2 border-t border-black/[0.05]">
          <p className="text-[11px] text-tertiary">
            Score inicial: <span className="font-semibold text-secondary">{initialScore}</span>
          </p>
        </div>
      )}
    </div>
  )
}

// ── InteractionItem ──────────────────────────────────────────────
function InteractionItem({ item }) {
  const type = INTERACTION_TYPES.find(t => t.value === item.type) || INTERACTION_TYPES[0]
  const date = item.createdAt?.toDate ? format(item.createdAt.toDate(), "d MMM · HH:mm", { locale: es }) : ''
  const isSystem = ['close', 'discard'].includes(item.type)
  return (
    <div className="flex gap-3 py-3 border-b border-black/[0.05] last:border-0">
      <div className={clsx(
        'w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5',
        isSystem ? 'bg-blue-50 border border-blue-100' : 'bg-surface-2 border border-black/[0.06]'
      )}>
        {item.type === 'close' ? <CheckCircle2 size={14} className="text-green-500" />
          : item.type === 'discard' ? <XCircle size={14} className="text-red-400" />
          : type.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-semibold text-secondary">{type.label}</span>
          <span className="text-[11px] text-tertiary">{date}</span>
        </div>
        <p className="text-[13px] text-primary leading-relaxed">{item.content}</p>
      </div>
    </div>
  )
}

// ── ProductPicker ────────────────────────────────────────────────
function ProductPicker({ value, onChange, onCreate }) {
  const { products, createProduct } = useProducts()
  const [query2, setQuery2] = useState('')
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', price: '', currency: 'USD' })
  const [saving, setSaving] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = products.find(p => p.id === value?.id)
  const filtered = query2.trim()
    ? products.filter(p => p.name.toLowerCase().includes(query2.toLowerCase()))
    : products

  const handleSelect = (p) => {
    onChange({ id: p.id, name: p.name, price: p.price, currency: p.currency || 'USD' })
    setQuery2(''); setOpen(false); setShowCreate(false)
  }

  const handleCreate = async () => {
    if (!newForm.name.trim() || !newForm.price) return
    setSaving(true)
    try {
      const created = await createProduct({
        name: newForm.name.trim(),
        price: Number(newForm.price),
        currency: newForm.currency,
        description: '',
      })
      if (created?.id) {
        onChange({ id: created.id, name: newForm.name.trim(), price: Number(newForm.price), currency: newForm.currency })
      }
      setShowCreate(false); setOpen(false)
      setNewForm({ name: '', price: '', currency: 'USD' })
      toast.success('Producto creado')
    } catch { toast.error('Error al crear producto') }
    finally { setSaving(false) }
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => { setOpen(o => !o); setShowCreate(false) }}
        className="input flex items-center gap-2 cursor-pointer select-none pr-3"
      >
        <Package size={13} className="text-tertiary flex-shrink-0" />
        {value?.name ? (
          <span className="flex-1 text-[13px] text-primary truncate">
            {value.name} — ${Number(value.price).toLocaleString()} {value.currency}
          </span>
        ) : (
          <span className="flex-1 text-[13px] text-tertiary">Selecciona un producto...</span>
        )}
        {value?.name ? (
          <button type="button" onClick={e => { e.stopPropagation(); onChange(null) }} className="text-tertiary hover:text-primary">
            <X size={13} />
          </button>
        ) : <ChevronDown size={13} className="text-tertiary" />}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-black/[0.1] rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/[0.07]">
            <Search size={13} className="text-tertiary flex-shrink-0" />
            <input autoFocus value={query2} onChange={e => setQuery2(e.target.value)}
              placeholder="Buscar producto..." className="flex-1 text-[12.5px] bg-transparent outline-none text-primary placeholder-tertiary" />
          </div>
          <div className="max-h-[160px] overflow-y-auto">
            {filtered.length > 0 ? filtered.map(p => (
              <button key={p.id} type="button" onClick={() => handleSelect(p)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-2 text-left transition-colors">
                <span className="text-[13px] text-primary font-medium truncate">{p.name}</span>
                <span className="text-[12px] text-secondary font-semibold ml-3 flex-shrink-0">
                  ${Number(p.price).toLocaleString()} {p.currency || 'USD'}
                </span>
              </button>
            )) : <p className="text-[12.5px] text-tertiary text-center py-3">Sin resultados</p>}
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
                <input autoFocus value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre del producto" className="input text-[12.5px] py-1.5" />
                <div className="flex gap-2">
                  <input type="number" value={newForm.price} onChange={e => setNewForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="Precio" className="input text-[12.5px] py-1.5 flex-1" min="0" />
                  <select value={newForm.currency} onChange={e => setNewForm(f => ({ ...f, currency: e.target.value }))}
                    className="input text-[12.5px] py-1.5 w-20">
                    {['USD', 'MXN', 'COP', 'ARS', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-xs py-1.5 flex-1">Cancelar</button>
                  <button type="button" onClick={handleCreate} disabled={saving}
                    className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1">
                    {saving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus size={12} strokeWidth={3} color="white" /> Guardar</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ClosePanel ───────────────────────────────────────────────────
function ClosePanel({ lead, onClose: onCloseDrawer }) {
  const { closeLead } = usePipeline()
  const [product, setProduct] = useState(
    lead.closedProduct || (lead.productId ? { id: lead.productId } : null)
  )
  const [price, setPrice] = useState(lead.closedProduct?.price || lead.value || '')
  const [currency, setCurrency] = useState(lead.closedProduct?.currency || 'USD')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleProductChange = (p) => {
    setProduct(p)
    if (p?.price) setPrice(p.price)
    if (p?.currency) setCurrency(p.currency)
  }

  const handleClose = async () => {
    if (!product?.name && !product?.id) { toast.error('Selecciona un producto'); return }
    if (!price) { toast.error('Ingresa el precio de venta'); return }
    setSaving(true)
    try {
      await closeLead(lead.id, {
        productId: product?.id || null,
        productName: product?.name,
        price: Number(price),
        currency,
        notes,
      })
      toast.success('¡Venta cerrada! 🎉')
    } catch { toast.error('Error al cerrar la venta') }
    finally { setSaving(false) }
  }

  if (lead.systemStage === 'closed') {
    return (
      <div className="px-6 py-4 border-b border-black/[0.06] bg-green-50">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={16} className="text-green-600" />
          <p className="text-[12px] font-bold text-green-700 uppercase tracking-wide">Venta cerrada</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-tertiary w-20">Producto</span>
            <span className="text-[13px] font-semibold text-primary">{lead.closedProduct?.name || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-tertiary w-20">Precio</span>
            <span className="text-[13px] font-bold text-green-700">
              ${Number(lead.closedProduct?.price || 0).toLocaleString()} {lead.closedProduct?.currency}
            </span>
          </div>
          {lead.closedNotes && (
            <div className="flex items-start gap-2">
              <span className="text-[11px] font-semibold text-tertiary w-20 mt-0.5">Notas</span>
              <span className="text-[12px] text-secondary flex-1">{lead.closedNotes}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-4 border-b border-black/[0.06]">
      <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <CheckCircle2 size={13} className="text-green-600" /> Cerrar venta
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1.5">
            Producto vendido *
          </label>
          <ProductPicker value={product} onChange={handleProductChange} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1.5">
              Precio de venta *
            </label>
            <input
              type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0" className="input text-sm" min="0"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1.5">
              Moneda
            </label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="input text-sm">
              {['USD', 'MXN', 'COP', 'ARS', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1.5">
            Notas del cierre <span className="text-tertiary lowercase font-normal tracking-normal">opcional</span>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} className="input resize-none text-sm" placeholder="¿Cómo se cerró? ¿Qué fue clave..." />
        </div>
        <button onClick={handleClose} disabled={saving}
          className="btn-primary flex items-center justify-center gap-2 py-2.5">
          {saving
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><CheckCircle2 size={14} /> Confirmar cierre</>}
        </button>
      </div>
    </div>
  )
}

// ── DiscardPanel ─────────────────────────────────────────────────
function DiscardPanel({ lead, onClose: onCloseDrawer }) {
  const { discardLead } = usePipeline()
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [retakeDate, setRetakeDate] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedCat = DISCARD_CATEGORIES.find(c => c.value === category)

  const handleDiscard = async () => {
    if (!category) { toast.error('Selecciona una razón de descarte'); return }
    setSaving(true)
    try {
      await discardLead(lead.id, { category, notes, retakeDate: retakeDate || null })
      toast.success('Lead descartado')
      onCloseDrawer()
    } catch { toast.error('Error al descartar') }
    finally { setSaving(false) }
  }

  return (
    <div className="px-6 py-4 border-b border-black/[0.06]">
      <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <XCircle size={13} className="text-red-400" /> Descartar lead
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1.5">
            Razón de descarte *
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {DISCARD_CATEGORIES.map(cat => (
              <button key={cat.value} type="button"
                onClick={() => setCategory(cat.value)}
                className={clsx(
                  'flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] border text-left transition-all',
                  category === cat.value
                    ? 'border-red-300 bg-red-50'
                    : 'border-black/[0.08] hover:border-black/[0.16]'
                )}>
                <div className={clsx(
                  'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all',
                  category === cat.value ? 'border-red-500 bg-red-500' : 'border-black/20'
                )} />
                <div>
                  <div className="text-[12px] font-semibold text-primary">{cat.label}</div>
                  <div className="text-[10.5px] text-tertiary">{cat.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Retake date — only for categories that can be retaken */}
        {selectedCat?.canRetake && category !== 'blacklist' && (
          <div>
            <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1.5">
              Fecha de retoma <span className="font-normal lowercase tracking-normal text-tertiary">opcional</span>
            </label>
            <input type="date" value={retakeDate} onChange={e => setRetakeDate(e.target.value)}
              className="input text-sm" min={new Date().toISOString().split('T')[0]} />
            {retakeDate && (
              <p className="text-[10px] text-blue-600 mt-1">
                ℹ Este lead aparecerá en alertas el {format(new Date(retakeDate), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            )}
          </div>
        )}

        {category === 'blacklist' && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-[10px]">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-red-700">
              <strong>Solicitud expresa.</strong> Este lead no volverá a aparecer en el pipeline y nunca será reasignado.
            </p>
          </div>
        )}

        <div>
          <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1.5">
            Notas <span className="font-normal lowercase tracking-normal">opcional</span>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} className="input resize-none text-sm" placeholder="¿Por qué exactamente? Contexto para futuras retomas..." />
        </div>

        <button onClick={handleDiscard} disabled={saving || !category}
          className="flex items-center justify-center gap-2 py-2 px-4 rounded-[10px] bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors">
          {saving
            ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            : <><XCircle size={14} /> Confirmar descarte</>}
        </button>
      </div>
    </div>
  )
}

// ── HandoffPanel ─────────────────────────────────────────────────
function HandoffPanel({ lead }) {
  const { resolveHandoff } = usePipeline()
  const [outcome, setOutcome] = useState(null)
  const [paymentDate, setPaymentDate] = useState('')
  const [discardCategory, setDiscardCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleResolve = async () => {
    if (!outcome) { toast.error('Selecciona el resultado de la llamada'); return }
    setSaving(true)
    try {
      if (outcome === 'secure_opportunity') {
        if (!paymentDate) { toast.error('Ingresa la fecha de pago'); setSaving(false); return }
        await resolveHandoff(lead.id, 'secure_opportunity', { paymentDate, handoffNotes: notes })
        toast.success('Movido a Oportunidad Segura')
      } else if (outcome === 'open_opportunity') {
        await resolveHandoff(lead.id, 'open_opportunity', { handoffNotes: notes })
        toast.success('Movido a Oportunidad Abierta')
      } else if (outcome === 'discard') {
        if (!discardCategory) { toast.error('Selecciona la razón de descarte'); setSaving(false); return }
        await resolveHandoff(lead.id, 'discard', { category: discardCategory, notes })
        toast.success('Lead descartado')
      }
    } catch { toast.error('Error al registrar resultado') }
    finally { setSaving(false) }
  }

  return (
    <div className="px-6 py-4 border-b border-black/[0.06] bg-amber-50">
      <div className="flex items-center gap-2 mb-4">
        <Phone size={14} className="text-amber-600" />
        <p className="text-[12px] font-bold text-amber-700 uppercase tracking-wide">Resultado de la llamada</p>
      </div>

      <p className="text-[12.5px] text-amber-800 mb-4 leading-relaxed">
        ¿Cómo terminó la conversación telefónica con <strong>{lead.name}</strong>?
      </p>

      <div className="flex flex-col gap-2 mb-4">
        {[
          {
            value: 'secure_opportunity',
            label: 'Tiene fecha de pago',
            desc: 'Se comprometió a pagar en una fecha específica',
            color: '#0066ff',
            bg: 'rgba(0,102,255,0.06)',
            border: 'rgba(0,102,255,0.2)',
            icon: <CheckCircle2 size={14} className="text-blue-600" />,
          },
          {
            value: 'open_opportunity',
            label: 'Interesado pero sin fecha',
            desc: 'Hubo interés pero no se confirmó fecha de pago',
            color: '#6366f1',
            bg: 'rgba(99,102,241,0.06)',
            border: 'rgba(99,102,241,0.2)',
            icon: <Clock size={14} className="text-indigo-500" />,
          },
          {
            value: 'discard',
            label: 'No se va a cerrar',
            desc: 'La llamada no resultó en oportunidad viable',
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.06)',
            border: 'rgba(239,68,68,0.2)',
            icon: <XCircle size={14} className="text-red-500" />,
          },
        ].map(opt => (
          <button key={opt.value} type="button"
            onClick={() => setOutcome(opt.value)}
            className="flex items-start gap-3 px-3.5 py-3 rounded-[10px] border text-left transition-all"
            style={{
              borderColor: outcome === opt.value ? opt.color : 'rgba(0,0,0,0.1)',
              background: outcome === opt.value ? opt.bg : 'white',
            }}>
            <div className="mt-0.5 flex-shrink-0">{opt.icon}</div>
            <div>
              <div className="text-[12.5px] font-semibold text-primary">{opt.label}</div>
              <div className="text-[11px] text-tertiary">{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Secure: payment date */}
      {outcome === 'secure_opportunity' && (
        <div className="mb-3">
          <label className="text-[10px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
            Fecha de pago *
          </label>
          <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
            className="input text-sm" min={new Date().toISOString().split('T')[0]} />
        </div>
      )}

      {/* Discard: category */}
      {outcome === 'discard' && (
        <div className="mb-3">
          <label className="text-[10px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
            Razón del descarte *
          </label>
          <select value={discardCategory} onChange={e => setDiscardCategory(e.target.value)} className="input text-sm">
            <option value="">Selecciona una razón...</option>
            {DISCARD_CATEGORIES.filter(c => c.value !== 'handoff_bound').map(c => (
              <option key={c.value} value={c.value}>{c.label} — {c.desc}</option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      {outcome && (
        <div className="mb-4">
          <label className="text-[10px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
            Notas de la llamada <span className="font-normal lowercase tracking-normal">opcional</span>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} className="input resize-none text-sm" placeholder="¿Qué dijo? ¿Qué pasó en la llamada?" />
        </div>
      )}

      <button onClick={handleResolve} disabled={saving || !outcome}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
        {saving
          ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          : <><ArrowRight size={14} /> Registrar resultado</>}
      </button>
    </div>
  )
}

// ── ScheduleModal ────────────────────────────────────────────────
function ScheduleModal({ lead, onClose }) {
  const { org } = useAuthStore()
  const { createAppointment, updateAppointment } = useAppointments()
  const [form, setForm] = useState({
    type: 'call',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '10:00',
    duration: 15,
    platform: 'meet',
    link: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.date || !form.time) { toast.error('Selecciona fecha y hora'); return }
    setLoading(true)
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00`)
      const appointmentId = await createAppointment({ ...form, leadId: lead.id, leadName: lead.name, scheduledAt })

      // Si es videollamada de Meet, crear evento en Google Calendar
      if (form.type === 'video' && form.platform === 'meet' && appointmentId) {
        try {
          const res = await fetch('https://flowcrm-production-6d63.up.railway.app/meetings/google/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orgId: org?.id,
              title: `Reunión con ${lead.name}`,
              scheduledAt: scheduledAt.toISOString(),
              duration: form.duration || 30,
              leadName: lead.name,
              notes: form.notes || '',
            }),
          })
          const data = await res.json()
          if (data.meetLink) {
            await updateAppointment(appointmentId, { link: data.meetLink, googleEventId: data.eventId })
            toast.success('Videollamada de Meet creada ✓')
          } else {
            toast.success(`${APPOINTMENT_TYPES[form.type].label} agendada ✓`)
          }
        } catch {
          toast.success(`${APPOINTMENT_TYPES[form.type].label} agendada ✓`)
        }
      } else {
        toast.success(`${APPOINTMENT_TYPES[form.type].label} agendada ✓`)
      }
      onClose()
    } catch { toast.error('Error al agendar') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-sm border border-black/[0.08] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
          <div>
            <h2 className="font-display font-bold text-base tracking-tight">Nueva cita</h2>
            <p className="text-[11px] text-secondary mt-0.5">con {lead.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          {/* Type */}
          <div>
            <label className="text-[10px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Tipo *</label>
            <div className="flex gap-2">
              {Object.entries(APPOINTMENT_TYPES).map(([key, val]) => (
                <button key={key} type="button"
                  onClick={() => setForm(f => ({ ...f, type: key }))}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] border text-[12px] font-semibold transition-all',
                    form.type === key ? 'border-primary bg-primary text-white' : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                  )}>
                  {key === 'call' ? <Phone size={13} /> : <Video size={13} />}
                  {val.label}
                </button>
              ))}
            </div>
          </div>
          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Fecha *</label>
              <input type="date" value={form.date} onChange={set('date')} className="input text-sm" required />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Hora *</label>
              <input type="time" value={form.time} onChange={set('time')} className="input text-sm" required />
            </div>
          </div>
          {/* Duration */}
          <div>
            <label className="text-[10px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Duración</label>
            <div className="flex gap-1.5">
              {[10, 15, 20, 30, 45, 60].map(d => (
                <button key={d} type="button"
                  onClick={() => setForm(f => ({ ...f, duration: d }))}
                  className={clsx('flex-1 py-1.5 rounded-lg border text-[11px] font-semibold transition-all',
                    form.duration === d ? 'bg-primary text-white border-primary' : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                  )}>{d}m</button>
              ))}
            </div>
          </div>
          {/* Platform (video only) */}
          {form.type === 'video' && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Plataforma</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {VIDEO_PLATFORMS.map(p => (
                    <button key={p.value} type="button"
                      onClick={() => setForm(f => ({ ...f, platform: p.value }))}
                      className={clsx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all',
                        form.platform === p.value ? 'bg-primary text-white border-primary' : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                      )}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Enlace</label>
                <input value={form.link} onChange={set('link')} placeholder="https://…" className="input text-sm" />
              </div>
            </>
          )}
          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              className="input resize-none text-sm" placeholder="¿Qué preparar para esta llamada?" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancelar</button>
            <button type="submit" disabled={loading}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
              {loading
                ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <>{form.type === 'call' ? <Phone size={13} /> : <Video size={13} />} Agendar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── MAIN DRAWER ──────────────────────────────────────────────────
export default function LeadDrawer({ lead, onClose }) {
  const { org } = useAuthStore()
  const { stages, updateLead, deleteLead, markProfileB, moveToHandoff, members } = usePipeline()

  const phoneStr = normalizePhone(lead.phone)
  const [interactions, setInteractions] = useState([])
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState('note')
  const [addingNote, setAddingNote] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scoreEvents, setScoreEvents] = useState([])
  const [showScoreHistory, setShowScoreHistory] = useState(false)
  const [editForm, setEditForm] = useState({
    name: lead.name || '',
    company: lead.company || '',
    email: lead.email || '',
    phone: phoneStr,
    value: lead.value || '',
  })

  const currentStage = stages.find(s => s.id === lead.stageId)
  const source = SOURCE_CONFIG[lead.source] || SOURCE_CONFIG.manual
  const assignedMember = members.find(m => m.id === lead.assignedTo)
  const isClosed = lead.systemStage === 'closed'
  const isDiscarded = lead.discarded
  const isHandoff = lead.systemStage === 'handoff'
  const isSystemStage = !!lead.systemStage

  useEffect(() => {
    if (!org?.id || !lead.id) return
    const q = query(
      collection(db, 'organizations', org.id, 'leads', lead.id, 'interactions'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setInteractions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [org?.id, lead.id])

  useEffect(() => {
    if (!org?.id || !lead.id) return
    const q = query(
      collection(db, 'organizations', org.id, 'leads', lead.id, 'score_events'),
      orderBy('createdAt', 'desc'),
      limit(30)
    )
    const unsub = onSnapshot(q, snap => {
      setScoreEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [org?.id, lead.id])

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    try {
      await addDoc(collection(db, 'organizations', org.id, 'leads', lead.id, 'interactions'), {
        type: noteType, content: noteText.trim(), createdAt: serverTimestamp()
      })
      setNoteText('')
      toast.success('Guardado')
    } catch { toast.error('Error al guardar') }
    finally { setAddingNote(false) }
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      await updateLead(lead.id, { ...editForm, value: Number(editForm.value) || 0 })
      setEditing(false)
      toast.success('Actualizado')
    } catch { toast.error('Error al actualizar') }
    finally { setSaving(false) }
  }

  const handleStageChange = async (stageId) => {
    try {
      await updateLead(lead.id, { stageId, systemStage: null })
      toast.success('Etapa actualizada')
    } catch { toast.error('Error') }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar a ${lead.name}? Esta acción no se puede deshacer.`)) return
    try {
      await deleteLead(lead.id)
      toast.success('Lead eliminado')
      onClose()
    } catch { toast.error('Error al eliminar') }
  }

  const handleMarkProfileB = async () => {
    try {
      await markProfileB(lead.id)
      toast.success('Perfil B marcado — alerta creada para el equipo')
    } catch { toast.error('Error') }
  }

  const handleMoveToHandoff = async () => {
    try {
      await moveToHandoff(lead.id)
      toast.success('Lead movido a Handoff')
    } catch { toast.error('Error') }
  }

  const formatValue = (v) => v ? `$${Number(v).toLocaleString()} USD` : '—'
  const stageColor = currentStage?.color ||
    (lead.systemStage ? SYSTEM_STAGES[lead.systemStage]?.color : '#0a0a0a')

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-surface z-50 flex flex-col shadow-[−8px_0_40px_rgba(0,0,0,0.12)] border-l border-black/[0.08]">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-black/[0.08] flex-shrink-0">
          <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: stageColor }}>
            {lead.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-lg tracking-tight leading-tight">{lead.name}</h2>
              {lead.profileB && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-bold">
                  <Star size={9} fill="currentColor" /> Perfil distribuidor
                </span>
              )}
              {isClosed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-600 text-[10px] font-bold">
                  <CheckCircle2 size={9} /> Cerrado
                </span>
              )}
              {lead.handoffBoundFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-600 text-[10px] font-bold">
                  <AlertTriangle size={9} /> Handoff Bound
                </span>
              )}
            </div>
            {lead.company && <p className="text-sm text-secondary mt-0.5">{lead.company}</p>}
            {assignedMember && (
              <p className="text-[11px] text-tertiary mt-0.5">Asignado a {assignedMember.name}</p>
            )}
            {lead.handoffBoundFrom && (
              <p className="text-[10px] text-purple-500 mt-0.5">
                Reasignado por Handoff Bound · anterior: {members.find(m => m.id === lead.handoffBoundFrom)?.name || lead.handoffBoundFrom}
              </p>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => setEditing(e => !e)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors">
              <Edit2 size={14} />
            </button>
            <button onClick={handleDelete}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-red-50 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* SCORE + META */}
          <div className="relative flex items-center gap-4 px-6 py-4 border-b border-black/[0.06]">
            <ScoreRing
              score={lead.score}
              hasHistory={scoreEvents.length > 0}
              onClick={() => setShowScoreHistory(v => !v)}
            />
            {showScoreHistory && (
              <ScoreHistoryPopover
                events={scoreEvents}
                onClose={() => setShowScoreHistory(false)}
              />
            )}
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wide w-16">Fuente</span>
                <span className="text-[12.5px] font-medium text-primary flex items-center gap-1">
                  {source.icon} {source.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wide w-16">Valor</span>
                <span className="text-[12.5px] font-bold text-primary">
                  {isClosed
                    ? `$${Number(lead.closedProduct?.price || 0).toLocaleString()} ${lead.closedProduct?.currency || 'USD'}`
                    : formatValue(lead.value)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wide w-16">Etapa</span>
                <span className="text-[12.5px] text-primary">
                  {lead.systemStage
                    ? SYSTEM_STAGES[lead.systemStage]?.name
                    : currentStage?.name || '—'}
                </span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wide w-16">Email</span>
                  <span className="text-[12.5px] text-primary truncate">{lead.email}</span>
                </div>
              )}
              {phoneStr && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wide w-16">Teléfono</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {(lead.channel === 'whatsapp' || lead.source === 'whatsapp') && (
                      <MessageCircle size={11} className="text-green-500 flex-shrink-0" />
                    )}
                    <a href={`tel:${phoneStr}`}
                      className="text-[12.5px] font-semibold text-primary hover:text-accent-blue transition-colors truncate">
                      {phoneStr}
                    </a>
                    <a href={`https://wa.me/${phoneStr.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                      className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full hover:bg-green-100 transition-colors flex-shrink-0">
                      WA
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* EDIT FORM */}
          {editing && (
            <div className="px-6 py-4 border-b border-black/[0.06] bg-surface-2">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Editar información</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'name', label: 'Nombre', placeholder: 'Carlos Ramírez' },
                  { key: 'company', label: 'Empresa', placeholder: 'TechSoluciones' },
                  { key: 'email', label: 'Email', placeholder: 'carlos@empresa.com' },
                  { key: 'phone', label: 'Teléfono', placeholder: '+52 81 0000 0000' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1">{f.label}</label>
                    <input value={editForm[f.key]} onChange={e => setEditForm(ef => ({ ...ef, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} className="input text-[12.5px] py-1.5" />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1">Valor (USD)</label>
                  <input type="number" value={editForm.value}
                    onChange={e => setEditForm(ef => ({ ...ef, value: e.target.value }))}
                    placeholder="0" className="input text-[12.5px] py-1.5" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditing(false)} className="btn-secondary text-xs py-1.5 flex-1">Cancelar</button>
                <button onClick={handleSaveEdit} disabled={saving}
                  className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1.5">
                  {saving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* HANDOFF PANEL — shown when in handoff system stage */}
          {isHandoff && <HandoffPanel lead={lead} />}

          {/* STAGE SELECTOR — only for configurable stages */}
          {!isSystemStage && !isDiscarded && (
            <div className="px-6 py-4 border-b border-black/[0.06]">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Etapa</p>
              <div className="flex flex-wrap gap-2">
                {stages.map(stage => (
                  <button key={stage.id} onClick={() => handleStageChange(stage.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                    style={{
                      borderColor: lead.stageId === stage.id ? stage.color : 'rgba(0,0,0,0.1)',
                      background: lead.stageId === stage.id ? `${stage.color}15` : 'transparent',
                      color: lead.stageId === stage.id ? stage.color : '#6e6e73',
                    }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    {stage.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PROFILE B SECTION */}
          {!lead.profileB && !isClosed && !isDiscarded && (
            <div className="px-6 py-4 border-b border-black/[0.06]">
              <button onClick={handleMarkProfileB}
                className="flex items-center gap-2 px-3 py-2 rounded-[8px] border border-dashed border-blue-200 text-blue-600 text-[12px] font-semibold hover:bg-blue-50 transition-colors w-full justify-center">
                <Star size={13} /> Marcar como perfil distribuidor
              </button>
              <p className="text-[10px] text-tertiary text-center mt-1.5">
                Genera una alerta para que el vendedor evalúe la oportunidad en el momento correcto
              </p>
            </div>
          )}

          {/* MOVE TO HANDOFF — from configurable stages */}
          {!isSystemStage && !isDiscarded && !isClosed && (
            <div className="px-6 py-4 border-b border-black/[0.06]">
              <button onClick={handleMoveToHandoff}
                className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-amber-50 border border-amber-200 text-amber-700 text-[12px] font-semibold hover:bg-amber-100 transition-colors w-full justify-center">
                <Phone size={13} /> Mover a Handoff — listo para llamada
              </button>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Acciones rápidas</p>
            <div className="flex gap-2 flex-wrap">
              {phoneStr && (
                <a href={`tel:${phoneStr}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/[0.1] text-xs font-semibold text-secondary hover:border-black/[0.2] hover:text-primary transition-all">
                  <Phone size={13} className="opacity-70" /> Llamar
                </a>
              )}
              {phoneStr && (
                <a href={`https://wa.me/${phoneStr.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/[0.1] text-xs font-semibold text-secondary hover:border-green-300 hover:text-green-600 transition-all">
                  <MessageCircle size={13} className="opacity-70" /> WhatsApp
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/[0.1] text-xs font-semibold text-secondary hover:border-blue-300 hover:text-blue-600 transition-all">
                  <Mail size={13} className="opacity-70" /> Email
                </a>
              )}
              <button
                onClick={() => setShowSchedule(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/[0.1] text-xs font-semibold text-secondary hover:border-purple-300 hover:text-purple-600 transition-all">
                <Calendar size={13} className="opacity-70" /> Agendar
              </button>
            </div>
          </div>

          {/* CLOSE SALE */}
          {!isDiscarded && (
            <>
              {isClosed ? (
                <ClosePanel lead={lead} onClose={onClose} />
              ) : (
                <div className="px-6 py-3 border-b border-black/[0.06]">
                  <button onClick={() => { setShowClose(s => !s); setShowDiscard(false) }}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-[8px] border text-[12px] font-semibold transition-all w-full justify-center',
                      showClose
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'border-black/[0.1] text-secondary hover:border-green-300 hover:text-green-600'
                    )}>
                    <CheckCircle2 size={13} /> Cerrar venta
                  </button>
                  {showClose && <div className="mt-3"><ClosePanel lead={lead} onClose={onClose} /></div>}
                </div>
              )}
            </>
          )}

          {/* DISCARD */}
          {!isDiscarded && !isClosed && (
            <div className="px-6 py-3 border-b border-black/[0.06]">
              <button onClick={() => { setShowDiscard(s => !s); setShowClose(false) }}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-[8px] border text-[12px] font-semibold transition-all w-full justify-center',
                  showDiscard
                    ? 'bg-red-50 border-red-300 text-red-600'
                    : 'border-black/[0.1] text-secondary hover:border-red-200 hover:text-red-500'
                )}>
                <XCircle size={13} /> Descartar lead
              </button>
              {showDiscard && <div className="mt-3"><DiscardPanel lead={lead} onClose={onClose} /></div>}
            </div>
          )}

          {/* ADD INTERACTION */}
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Agregar interacción</p>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {INTERACTION_TYPES.map(t => (
                <button key={t.value} onClick={() => setNoteType(t.value)}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all',
                    noteType === t.value ? 'bg-primary text-white border-primary' : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                  )}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Escribe aquí..." rows={3} className="input resize-none text-[13px] leading-relaxed"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote() }} />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-tertiary">⌘+Enter para guardar</span>
              <button onClick={handleAddNote} disabled={addingNote || !noteText.trim()}
                className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 disabled:opacity-40">
                {addingNote ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : 'Guardar'}
              </button>
            </div>
          </div>

          {/* INTERACTIONS HISTORY */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-1">
              Historial ({interactions.length})
            </p>
            {interactions.length === 0
              ? <p className="text-sm text-tertiary py-4 text-center">Sin interacciones aún</p>
              : interactions.map(item => <InteractionItem key={item.id} item={item} />)
            }
          </div>

        </div>
      </div>
      {showSchedule && <ScheduleModal lead={lead} onClose={() => setShowSchedule(false)} />}
    </>
  )
}
