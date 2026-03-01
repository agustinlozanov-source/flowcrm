import { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, onSnapshot, query,
  orderBy, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { usePipeline } from '@/hooks/usePipeline'
import { TEMPLATES, FORM_FIELDS, renderLandingHTML } from '@/lib/landingTemplates'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Monitor, Link2, PenTool, Star, MessageSquare, Palette, Settings } from 'lucide-react'

const TYPE_LABELS = { service: 'Servicio', product: 'Producto', event: 'Evento' }
const TYPE_COLORS = { service: '#0066ff', product: '#ea580c', event: '#7c3aed' }

// ── LIVE IFRAME PREVIEW ──
function IframePreview({ config, orgId = '', pageId = '' }) {
  const iframeRef = useRef()
  const html = renderLandingHTML({ ...config, orgId, pageId })

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(html)
    doc.close()
  }, [html])

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 rounded-[10px]"
      title="Preview"
      sandbox="allow-scripts allow-same-origin"
    />
  )
}

// ── TEMPLATE PICKER ──
function TemplatePicker({ onSelect, onClose }) {
  const [filter, setFilter] = useState('all')
  const types = ['all', 'service', 'product', 'event']
  const filtered = filter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.type === filter)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface rounded-[20px] shadow-[0_32px_80px_rgba(0,0,0,0.25)] w-full max-w-4xl border border-black/[0.08] overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>

        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.08] flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg tracking-tight">Elige una template</h2>
            <p className="text-xs text-secondary mt-0.5">10 diseños de alta conversión — puedes personalizar todo después</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-black/[0.06] flex-shrink-0">
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                filter === t ? 'bg-primary text-white' : 'text-secondary hover:bg-surface-2'
              )}>
              {t === 'all' ? `Todos (${TEMPLATES.length})` : `${TYPE_LABELS[t]} (${TEMPLATES.filter(x => x.type === t).length})`}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(t => (
              <div key={t.id} onClick={() => onSelect(t)}
                className="group card overflow-hidden cursor-pointer hover:border-accent-blue hover:shadow-card-md transition-all">

                {/* Thumbnail */}
                <div
                  className="h-32 flex flex-col items-center justify-center relative overflow-hidden"
                  style={{ background: t.defaults.bgColor }}
                >
                  <div className="text-3xl mb-1">{t.thumbnail}</div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="bg-white text-primary font-bold text-xs px-3 py-1.5 rounded-lg shadow">
                      Usar esta →
                    </span>
                  </div>
                  {/* Type badge */}
                  <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: TYPE_COLORS[t.type] }}>
                    {TYPE_LABELS[t.type]}
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="font-display font-bold text-[13px] text-primary mb-0.5">{t.name}</div>
                  <div className="text-[11px] text-secondary mb-1">{t.description}</div>
                  <div className="text-[10px] text-tertiary">{t.category}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── EDITOR ──
function PageEditor({ page, stages, orgId, onSave, onClose }) {
  const [config, setConfig] = useState({
    ...TEMPLATES.find(t => t.id === page?.templateId)?.defaults || TEMPLATES[0].defaults,
    ...page,
  })
  const [saving, setSaving] = useState(false)
  const [editorTab, setEditorTab] = useState('content')

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  const handleSave = async () => {
    if (!config.title?.trim()) { toast.error('Agrega un nombre interno'); return }
    if (!config.slug?.trim()) { toast.error('Agrega un slug para la URL'); return }
    setSaving(true)
    try {
      await onSave(config)
      toast.success('Página guardada')
      onClose()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const toggleField = (field) => {
    const fields = config.formFields || []
    const f = FORM_FIELDS.find(x => x.value === field)
    if (f?.required) return
    set('formFields', fields.includes(field) ? fields.filter(x => x !== field) : [...fields, field])
  }

  const slugify = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  const updateBenefit = (i, k, v) => {
    const b = [...(config.benefits || [])]
    b[i] = { ...b[i], [k]: v }
    set('benefits', b)
  }

  const updateTestimonial = (i, k, v) => {
    const t = [...(config.testimonials || [])]
    t[i] = { ...t[i], [k]: v }
    set('testimonials', t)
  }

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden bg-surface">

      {/* Left panel */}
      <div className="w-[360px] min-w-[360px] border-r border-black/[0.08] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.08] flex-shrink-0">
          <h2 className="font-display font-bold text-sm">Editor de página</h2>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-3">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
              {saving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : 'Publicar'}
            </button>
          </div>
        </div>

        <div className="flex border-b border-black/[0.08] flex-shrink-0 overflow-x-auto">
          {[{ id: 'content', icon: <PenTool size={13} />, label: 'Texto' }, { id: 'benefits', icon: <Star size={13} />, label: 'Beneficios' }, { id: 'social', icon: <MessageSquare size={13} />, label: 'Testimonios' }, { id: 'design', icon: <Palette size={13} />, label: 'Diseño' }, { id: 'settings', icon: <Settings size={13} />, label: 'Config' }].map((tab) => (
            <button key={tab.id} onClick={() => setEditorTab(tab.id)}
              className={clsx('px-3 py-2.5 text-[11px] font-semibold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5',
                editorTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'
              )}>{tab.icon} {tab.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

          {/* CONTENT TAB */}
          {editorTab === 'content' && (
            <>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Nombre interno *</label>
                <input value={config.title || ''} onChange={e => { set('title', e.target.value); if (!page?.id) set('slug', slugify(e.target.value)) }}
                  placeholder="Landing — Consulta Gratuita" className="input text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Logo / Nombre de marca</label>
                <input value={config.logoText || ''} onChange={e => set('logoText', e.target.value)} placeholder="Tu Marca" className="input text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Badge superior</label>
                <input value={config.badgeText || ''} onChange={e => set('badgeText', e.target.value)} placeholder="🚀 Oferta especial" className="input text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Headline principal *</label>
                <textarea value={config.headline || ''} onChange={e => set('headline', e.target.value)} rows={3} className="input text-sm resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Subtítulo</label>
                <textarea value={config.subheadline || ''} onChange={e => set('subheadline', e.target.value)} rows={3} className="input text-sm resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Texto del botón CTA</label>
                <input value={config.ctaText || ''} onChange={e => set('ctaText', e.target.value)} className="input text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Garantía</label>
                <textarea value={config.guarantee || ''} onChange={e => set('guarantee', e.target.value)} rows={2} className="input text-sm resize-none" placeholder="Ej: 30 días de garantía total..." />
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-2">Campos del formulario</label>
                <div className="flex flex-col gap-1.5">
                  {FORM_FIELDS.map(f => (
                    <div key={f.value} onClick={() => toggleField(f.value)}
                      className={clsx('flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all',
                        (config.formFields || []).includes(f.value) ? 'border-accent-blue/30 bg-blue-50 text-accent-blue' : 'border-black/[0.08] text-secondary hover:border-black/[0.16]',
                        f.required ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                      )}>
                      <div className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                        (config.formFields || []).includes(f.value) ? 'bg-accent-blue border-accent-blue' : 'border-black/20'
                      )}>
                        {(config.formFields || []).includes(f.value) && <span className="text-white text-[8px]">✓</span>}
                      </div>
                      {f.label} {f.required && <span className="text-[9px] text-tertiary ml-auto">requerido</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* BENEFITS TAB */}
          {editorTab === 'benefits' && (
            <>
              <p className="text-xs text-secondary">Edita los 3 beneficios principales que aparecen en la página.</p>
              {(config.benefits || []).map((b, i) => (
                <div key={i} className="card p-3 flex flex-col gap-2">
                  <div className="text-[10px] font-bold text-tertiary uppercase tracking-wide">Beneficio {i + 1}</div>
                  <input value={b.icon || ''} onChange={e => updateBenefit(i, 'icon', e.target.value)}
                    placeholder="Ícono o emoji" className="input text-sm" />
                  <input value={b.title || ''} onChange={e => updateBenefit(i, 'title', e.target.value)}
                    placeholder="Título del beneficio" className="input text-sm" />
                  <textarea value={b.desc || ''} onChange={e => updateBenefit(i, 'desc', e.target.value)}
                    placeholder="Descripción breve" rows={2} className="input text-sm resize-none" />
                </div>
              ))}
            </>
          )}

          {/* SOCIAL PROOF TAB */}
          {editorTab === 'social' && (
            <>
              <p className="text-xs text-secondary">Edita los testimonios de clientes.</p>
              {(config.testimonials || []).map((t, i) => (
                <div key={i} className="card p-3 flex flex-col gap-2">
                  <div className="text-[10px] font-bold text-tertiary uppercase tracking-wide">Testimonio {i + 1}</div>
                  <input value={t.name || ''} onChange={e => updateTestimonial(i, 'name', e.target.value)}
                    placeholder="Nombre del cliente" className="input text-sm" />
                  <input value={t.role || ''} onChange={e => updateTestimonial(i, 'role', e.target.value)}
                    placeholder="Cargo / Empresa" className="input text-sm" />
                  <textarea value={t.text || ''} onChange={e => updateTestimonial(i, 'text', e.target.value)}
                    placeholder="Testimonio..." rows={3} className="input text-sm resize-none" />
                </div>
              ))}
            </>
          )}

          {/* DESIGN TAB */}
          {editorTab === 'design' && (
            <>
              {[
                { key: 'accentColor', label: 'Color de acento' },
                { key: 'bgColor', label: 'Color de fondo' },
                { key: 'textColor', label: 'Color de texto' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">{label}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config[key] || '#000000'} onChange={e => set(key, e.target.value)}
                      className="w-10 h-10 rounded-lg border border-black/[0.1] cursor-pointer p-0.5 flex-shrink-0" />
                    <input value={config[key] || ''} onChange={e => set(key, e.target.value)}
                      className="input text-sm flex-1 font-mono" />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* SETTINGS TAB */}
          {editorTab === 'settings' && (
            <>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">URL de la página</label>
                <div className="flex items-center border border-black/[0.1] rounded-lg overflow-hidden">
                  <span className="bg-surface-2 px-2 py-2 text-[10px] text-tertiary font-mono border-r border-black/[0.1] whitespace-nowrap">flowcrm.app/p/</span>
                  <input value={config.slug || ''} onChange={e => set('slug', slugify(e.target.value))}
                    placeholder="mi-pagina" className="flex-1 px-3 py-2 text-sm outline-none font-mono" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Etapa destino de leads</label>
                <select value={config.targetStageId || ''} onChange={e => set('targetStageId', e.target.value)} className="input text-sm">
                  <option value="">Primera etapa del pipeline</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wide block mb-1.5">Meta descripción (SEO)</label>
                <textarea value={config.metaDescription || ''} onChange={e => set('metaDescription', e.target.value)}
                  rows={2} className="input text-sm resize-none" placeholder="Descripción para Google..." />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right panel - live preview */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f0f0]">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-black/[0.08] bg-surface flex-shrink-0">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-surface-2 rounded-lg px-3 py-1.5 text-[11px] text-tertiary font-mono border border-black/[0.08] truncate">
            flowcrm.app/p/{config.slug || 'mi-pagina'}
          </div>
          <span className="text-[11px] text-tertiary flex-shrink-0">Preview en vivo</span>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <IframePreview config={config} orgId={orgId} pageId={page?.id || ''} />
        </div>
      </div>
    </div>
  )
}

// ── MAIN ──
export default function LandingPages() {
  const { org } = useAuthStore()
  const { stages } = usePipeline()
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [editingPage, setEditingPage] = useState(null)

  useEffect(() => {
    if (!org?.id) return
    const q = query(collection(db, 'organizations', org.id, 'landing_pages'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setPages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [org?.id])

  const handleSelectTemplate = (template) => {
    setShowPicker(false)
    setEditingPage({ templateId: template.id, ...template.defaults, title: '', slug: '', status: 'draft', views: 0, conversions: 0 })
  }

  const handleSave = async (config) => {
    if (editingPage?.id) {
      await updateDoc(doc(db, 'organizations', org.id, 'landing_pages', editingPage.id), { ...config, updatedAt: serverTimestamp() })
    } else {
      await addDoc(collection(db, 'organizations', org.id, 'landing_pages'), { ...config, status: 'published', views: 0, conversions: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta página?')) return
    await deleteDoc(doc(db, 'organizations', org.id, 'landing_pages', id))
    toast.success('Página eliminada')
  }

  const handleToggleStatus = async (page) => {
    const newStatus = page.status === 'published' ? 'draft' : 'published'
    await updateDoc(doc(db, 'organizations', org.id, 'landing_pages', page.id), { status: newStatus })
    toast.success(newStatus === 'published' ? 'Página publicada' : 'Página pausada')
  }

  const convRate = (p) => !p.views ? '0%' : `${Math.round((p.conversions / p.views) * 100)}%`

  if (editingPage) {
    return (
      <PageEditor
        page={editingPage}
        stages={stages}
        orgId={org?.id || ''}
        onSave={handleSave}
        onClose={() => setEditingPage(null)}
      />
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="bg-surface border-b border-black/[0.08] px-5 h-14 flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-[15px] tracking-tight">Landing Pages</h1>
        {pages.length > 0 && (
          <span className="text-[11px] font-semibold bg-surface-2 border border-black/[0.08] px-2.5 py-1 rounded-full text-secondary">
            {pages.filter(p => p.status === 'published').length} publicadas
          </span>
        )}
        <div className="ml-auto">
          <button onClick={() => setShowPicker(true)} className="btn-primary text-[12.5px] py-1.5 px-3.5 flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg>
            Nueva página
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-black/[0.08] flex items-center justify-center text-secondary">
              <Monitor size={32} />
            </div>
            <div>
              <p className="font-display font-bold text-lg text-primary mb-1">Sin landing pages</p>
              <p className="text-sm text-secondary max-w-xs">Elige una de las 10 templates y captura leads automáticamente en tu pipeline.</p>
            </div>
            <button onClick={() => setShowPicker(true)} className="btn-primary text-sm py-2.5 px-5">+ Crear primera página</button>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-3 gap-4">
              {pages.map(page => {
                const template = TEMPLATES.find(t => t.id === page.templateId)
                return (
                  <div key={page.id} className="card overflow-hidden group">
                    <div className="h-36 relative cursor-pointer overflow-hidden" style={{ background: page.bgColor || '#f5f5f7' }}
                      onClick={() => setEditingPage(page)}>
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <div className="text-secondary mb-1">
                          {template?.thumbnail ? <span className="text-2xl">{template.thumbnail}</span> : <Monitor size={24} />}
                        </div>
                        <div className="font-bold text-[11px] line-clamp-2" style={{ color: page.textColor || '#0a0a0a' }}>{page.headline}</div>
                        <div className="mt-2 px-3 py-1 rounded-full text-[9px] font-bold text-white" style={{ background: page.accentColor || '#0066ff' }}>
                          {page.ctaText}
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="bg-white text-primary font-bold text-xs px-3 py-1.5 rounded-lg shadow">Editar →</span>
                      </div>
                      <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: TYPE_COLORS[template?.type || 'service'] }}>
                        {template?.name || 'Custom'}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-display font-bold text-[13px] text-primary leading-tight flex-1 truncate">{page.title}</h3>
                        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                          page.status === 'published' ? 'bg-green-50 text-green-600' : 'bg-surface-2 text-tertiary'
                        )}>{page.status === 'published' ? '● Activa' : '○ Borrador'}</span>
                      </div>
                      <p className="text-[11px] text-tertiary font-mono mb-3 truncate">flowcrm.app/p/{page.slug}</p>

                      <div className="flex items-center gap-3 mb-3 py-2 border-t border-b border-black/[0.06]">
                        {[['Visitas', page.views || 0, 'text-primary'], ['Leads', page.conversions || 0, 'text-primary'], ['Conv.', convRate(page), 'text-green-600']].map(([label, val, color]) => (
                          <div key={label} className="text-center flex-1">
                            <div className={clsx('font-display font-bold text-base', color)}>{val}</div>
                            <div className="text-[9px] text-tertiary uppercase tracking-wide">{label}</div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-1.5">
                        <button onClick={() => setEditingPage(page)} className="flex-1 btn-secondary text-[11px] py-1.5">Editar</button>
                        <button onClick={() => handleToggleStatus(page)}
                          className={clsx('flex-1 text-[11px] py-1.5 rounded-btn font-semibold border transition-all',
                            page.status === 'published' ? 'border-black/[0.1] text-secondary' : 'border-green-300 text-green-600 hover:bg-green-50'
                          )}>{page.status === 'published' ? 'Pausar' : 'Publicar'}</button>
                        <button onClick={() => { navigator.clipboard.writeText(`https://flowcrm.app/p/${page.slug}`); toast.success('Link copiado') }}
                          className="w-8 h-8 rounded-btn border border-black/[0.1] flex items-center justify-center text-tertiary hover:border-black/[0.2] text-sm flex-shrink-0"><Link2 size={14} /></button>
                        <button onClick={() => handleDelete(page.id)}
                          className="w-8 h-8 rounded-btn border border-black/[0.1] flex items-center justify-center text-tertiary hover:border-red-300 hover:text-red-500 transition-all flex-shrink-0">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4 3l.5 7h3L8 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              <div onClick={() => setShowPicker(true)}
                className="card border-dashed cursor-pointer hover:border-black/[0.25] transition-all flex flex-col items-center justify-center gap-3 h-64 text-center p-6">
                <div className="w-10 h-10 rounded-xl border-2 border-dashed border-black/[0.2] flex items-center justify-center text-xl text-tertiary">+</div>
                <div>
                  <p className="font-display font-semibold text-sm text-secondary">Nueva página</p>
                  <p className="text-xs text-tertiary mt-0.5">10 templates disponibles</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showPicker && <TemplatePicker onSelect={handleSelectTemplate} onClose={() => setShowPicker(false)} />}
    </div>
  )
}
