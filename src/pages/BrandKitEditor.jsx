import { useState, useEffect, useRef } from 'react'
import { useBrandKits, DISPLAY_FONTS, BODY_FONTS, VISUAL_STYLES, loadGoogleFont } from '@/hooks/useBrandKits'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Star, Pencil, X, Upload, Check,
  Type, Palette, Image, Sparkles, ChevronDown
} from 'lucide-react'

// ─── COLOR SWATCH ─────────────────────────────────────────────────
function ColorInput({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            className="w-9 h-9 rounded-[8px] border border-black/[0.12] cursor-pointer p-0.5 bg-transparent" />
        </div>
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="input flex-1 font-mono text-[12px]" placeholder="#000000" maxLength={7} />
      </div>
    </div>
  )
}

// ─── FONT SELECTOR ────────────────────────────────────────────────
function FontSelector({ label, value, onChange, fonts, customFontUrl, onCustomFontChange }) {
  const [open, setOpen] = useState(false)
  const [useCustom, setUseCustom] = useState(!!customFontUrl)
  const fileRef = useRef()

  useEffect(() => { loadGoogleFont(value) }, [value])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(file.name.split('.').pop().toLowerCase())) {
      toast.error('Formato no válido. Usa .ttf, .otf, .woff o .woff2')
      return
    }
    onCustomFontChange(file)
    setUseCustom(true)
  }

  return (
    <div>
      <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
        {label}
      </label>

      {/* Toggle */}
      <div className="flex gap-1 mb-2 bg-surface-2 border border-black/[0.08] rounded-[8px] p-1">
        <button onClick={() => setUseCustom(false)}
          className={clsx('flex-1 py-1 rounded-[6px] text-[11.5px] font-semibold transition-all',
            !useCustom ? 'bg-surface text-primary shadow-sm' : 'text-tertiary')}>
          Google Fonts
        </button>
        <button onClick={() => setUseCustom(true)}
          className={clsx('flex-1 py-1 rounded-[6px] text-[11.5px] font-semibold transition-all',
            useCustom ? 'bg-surface text-primary shadow-sm' : 'text-tertiary')}>
          Subir fuente
        </button>
      </div>

      {!useCustom ? (
        <div className="relative">
          <button onClick={() => setOpen(v => !v)}
            className="input w-full flex items-center justify-between text-left"
            style={{ fontFamily: value }}>
            <span className="text-[13px]">{value || 'Seleccionar fuente'}</span>
            <ChevronDown size={14} className={clsx('text-tertiary transition-transform', open && 'rotate-180')} />
          </button>

          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-black/[0.1] rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-50 overflow-hidden max-h-64 overflow-y-auto">
              {fonts.map(f => (
                <button key={f.name} onClick={() => { onChange(f.name); setOpen(false); loadGoogleFont(f.name) }}
                  className={clsx('w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-2 transition-colors text-left',
                    value === f.name && 'bg-primary/[0.04]')}>
                  <div>
                    <span className="text-[13px] font-semibold text-primary block" style={{ fontFamily: f.name }}>
                      {f.name}
                    </span>
                    <span className="text-[10px] text-tertiary">{f.category}</span>
                  </div>
                  {value === f.name && <Check size={12} className="text-primary flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <input ref={fileRef} type="file" accept=".ttf,.otf,.woff,.woff2"
            onChange={handleFileChange} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            className={clsx('w-full flex items-center gap-2 px-3 py-2.5 rounded-[10px] border border-dashed text-[12.5px] font-semibold transition-all',
              customFontUrl
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-black/[0.15] text-secondary hover:border-black/[0.3]')}>
            <Upload size={13} />
            {customFontUrl ? 'Fuente cargada ✓ — cambiar' : 'Subir archivo .ttf / .otf / .woff'}
          </button>
          {customFontUrl && (
            <button onClick={() => { setUseCustom(false); onCustomFontChange(null) }}
              className="text-[11px] text-tertiary hover:text-red-500 mt-1 transition-colors">
              × Quitar fuente personalizada
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── LOGO UPLOAD ──────────────────────────────────────────────────
function LogoUpload({ logoUrl, onChange }) {
  const fileRef = useRef()

  const handleChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Solo se aceptan imágenes'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Máximo 2MB'); return }
    onChange(file)
  }

  return (
    <div>
      <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
        Logo
      </label>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />

      <button onClick={() => fileRef.current?.click()}
        className={clsx('w-full flex items-center gap-3 px-4 py-3 rounded-[12px] border-2 border-dashed transition-all',
          logoUrl
            ? 'border-primary/30 bg-primary/[0.03]'
            : 'border-black/[0.12] hover:border-black/[0.25]')}>
        {logoUrl ? (
          <>
            <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
            <div className="text-left">
              <p className="text-[12.5px] font-semibold text-primary">Logo cargado ✓</p>
              <p className="text-[11px] text-tertiary">Clic para cambiar</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
              <Image size={18} className="text-tertiary" />
            </div>
            <div className="text-left">
              <p className="text-[12.5px] font-semibold text-secondary">Subir logo</p>
              <p className="text-[11px] text-tertiary">PNG o SVG recomendado · Máx 2MB</p>
            </div>
          </>
        )}
      </button>
    </div>
  )
}

// ─── KIT PREVIEW ──────────────────────────────────────────────────
function KitPreview({ form }) {
  useEffect(() => {
    loadGoogleFont(form.fontDisplay)
    loadGoogleFont(form.fontBody)
  }, [form.fontDisplay, form.fontBody])

  return (
    <div className="rounded-[14px] overflow-hidden border border-black/[0.08] aspect-square relative"
      style={{ background: form.primaryColor }}>
      {/* Simulated content */}
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        {form.logoUrl && (
          <img src={form.logoUrl} alt="Logo"
            className="absolute top-3 right-3 w-8 h-8 object-contain opacity-90" />
        )}
        <div className="mb-1" style={{
          fontFamily: form.fontDisplay,
          color: form.secondaryColor,
          fontSize: 18,
          fontWeight: 800,
          lineHeight: 1.2,
        }}>
          Tu título va aquí
        </div>
        <div style={{
          fontFamily: form.fontBody,
          color: form.secondaryColor,
          fontSize: 11,
          opacity: 0.7,
          lineHeight: 1.4,
        }}>
          El copy de tu post aparece aquí con tu fuente de cuerpo
        </div>
        <div className="mt-2 px-2 py-1 rounded-md w-fit text-[10px] font-bold"
          style={{ background: form.accentColor, color: form.primaryColor, fontFamily: form.fontDisplay }}>
          Tu CTA
        </div>
      </div>
    </div>
  )
}

// ─── KIT CARD ─────────────────────────────────────────────────────
function KitCard({ kit, onEdit, onDelete, onSetDefault }) {
  useEffect(() => {
    loadGoogleFont(kit.fontDisplay)
    loadGoogleFont(kit.fontBody)
  }, [kit.fontDisplay, kit.fontBody])

  return (
    <div className={clsx('card p-4 transition-all', kit.isDefault && 'ring-2 ring-primary/30')}>
      <div className="flex items-start gap-3 mb-3">
        {/* Color preview strip */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <div className="w-6 h-6 rounded-md border border-black/[0.08]"
            style={{ background: kit.primaryColor }} />
          <div className="w-6 h-6 rounded-md border border-black/[0.08]"
            style={{ background: kit.accentColor }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-display font-bold text-[13px] text-primary truncate">{kit.name}</p>
            {kit.isDefault && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/[0.08] text-primary flex-shrink-0">
                DEFAULT
              </span>
            )}
          </div>
          <p className="text-[11px] text-tertiary mt-0.5" style={{ fontFamily: kit.fontDisplay }}>
            {kit.fontDisplay}
          </p>
          <p className="text-[11px] text-secondary" style={{ fontFamily: kit.fontBody }}>
            {kit.fontBody}
          </p>
        </div>

        {kit.logoUrl && (
          <img src={kit.logoUrl} alt="Logo"
            className="w-8 h-8 object-contain rounded-lg border border-black/[0.08] flex-shrink-0" />
        )}
      </div>

      {/* Visual style badge */}
      <div className="flex items-center gap-1 mb-3">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-secondary capitalize">
          {VISUAL_STYLES.find(s => s.value === kit.visualStyle)?.label || kit.visualStyle}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {!kit.isDefault && (
          <button onClick={() => onSetDefault(kit.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11px] font-semibold text-tertiary hover:bg-surface-2 transition-colors">
            <Star size={11} /> Default
          </button>
        )}
        <button onClick={() => onEdit(kit)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11px] font-semibold text-secondary hover:bg-surface-2 transition-colors ml-auto">
          <Pencil size={11} /> Editar
        </button>
        <button onClick={() => onDelete(kit.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11px] font-semibold text-tertiary hover:bg-red-50 hover:text-red-500 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

// ─── KIT MODAL ────────────────────────────────────────────────────
function KitModal({ kit, onClose, onSave }) {
  const isEdit = !!kit
  const [form, setForm] = useState({
    name:          kit?.name          || 'Nuevo Kit',
    primaryColor:  kit?.primaryColor  || '#0a0a0a',
    secondaryColor:kit?.secondaryColor|| '#ffffff',
    accentColor:   kit?.accentColor   || '#f59e0b',
    fontDisplay:   kit?.fontDisplay   || 'Oswald',
    fontBody:      kit?.fontBody      || 'Inter',
    visualStyle:   kit?.visualStyle   || 'bold',
    logoUrl:       kit?.logoUrl       || null,
    customFontDisplayUrl: kit?.customFontDisplayUrl || null,
    customFontBodyUrl:    kit?.customFontBodyUrl    || null,
  })
  const [logoFile, setLogoFile] = useState(null)
  const [fontDisplayFile, setFontDisplayFile] = useState(null)
  const [fontBodyFile, setFontBodyFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('identidad')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Preview logo file before upload
  const logoPreview = logoFile ? URL.createObjectURL(logoFile) : form.logoUrl

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    try {
      await onSave(form, logoFile, fontDisplayFile, fontBodyFile)
      toast.success(isEdit ? 'Kit actualizado' : 'Kit creado')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar el kit')
    } finally {
      setSaving(false)
    }
  }

  const sections = [
    { id: 'identidad', label: 'Identidad',   icon: Image   },
    { id: 'colores',   label: 'Colores',      icon: Palette },
    { id: 'tipografia',label: 'Tipografía',   icon: Type    },
    { id: 'estilo',    label: 'Estilo visual', icon: Sparkles},
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[20px] shadow-[0_24px_80px_rgba(0,0,0,0.2)] w-full max-w-2xl border border-black/[0.08] flex max-h-[92vh] overflow-hidden">

        {/* Left — form */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06] flex-shrink-0">
            <div>
              <h2 className="font-display font-bold text-[16px]">
                {isEdit ? 'Editar Brand Kit' : 'Nuevo Brand Kit'}
              </h2>
              <p className="text-[11.5px] text-secondary mt-0.5">
                Define la identidad visual de este kit
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
              <X size={15} />
            </button>
          </div>

          {/* Section tabs */}
          <div className="flex border-b border-black/[0.06] px-6 flex-shrink-0">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={clsx('flex items-center gap-1.5 px-1 py-3 mr-4 text-[12px] font-semibold border-b-2 transition-all',
                  activeSection === s.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-secondary hover:text-primary')}>
                <s.icon size={12} /> {s.label}
              </button>
            ))}
          </div>

          {/* Form content */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* IDENTIDAD */}
            {activeSection === 'identidad' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
                    Nombre del kit *
                  </label>
                  <input value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="ej: Kit Educativo, Kit Promocional..."
                    className="input" autoFocus />
                </div>
                <LogoUpload
                  logoUrl={logoPreview}
                  onChange={(file) => { setLogoFile(file); set('logoUrl', URL.createObjectURL(file)) }}
                />
              </div>
            )}

            {/* COLORES */}
            {activeSection === 'colores' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3 p-3 bg-surface-2 rounded-[10px]">
                  <Palette size={14} className="text-tertiary mt-0.5 flex-shrink-0" />
                  <p className="text-[11.5px] text-secondary leading-relaxed">
                    El color primario es el fondo principal. El secundario es el texto sobre ese fondo. El de acento es para CTAs y detalles.
                  </p>
                </div>
                <ColorInput label="Color primario (fondo)" value={form.primaryColor}
                  onChange={v => set('primaryColor', v)} />
                <ColorInput label="Color secundario (texto)" value={form.secondaryColor}
                  onChange={v => set('secondaryColor', v)} />
                <ColorInput label="Color de acento (CTA)" value={form.accentColor}
                  onChange={v => set('accentColor', v)} />
              </div>
            )}

            {/* TIPOGRAFÍA */}
            {activeSection === 'tipografia' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-3 p-3 bg-surface-2 rounded-[10px]">
                  <Type size={14} className="text-tertiary mt-0.5 flex-shrink-0" />
                  <p className="text-[11.5px] text-secondary leading-relaxed">
                    La fuente display va en títulos y elementos de impacto. La fuente body va en el copy y CTAs.
                  </p>
                </div>
                <FontSelector
                  label="Fuente display (títulos)"
                  value={form.fontDisplay}
                  onChange={v => set('fontDisplay', v)}
                  fonts={DISPLAY_FONTS}
                  customFontUrl={form.customFontDisplayUrl}
                  onCustomFontChange={(file) => {
                    setFontDisplayFile(file)
                    if (!file) set('customFontDisplayUrl', null)
                  }}
                />
                <FontSelector
                  label="Fuente body (copy)"
                  value={form.fontBody}
                  onChange={v => set('fontBody', v)}
                  fonts={BODY_FONTS}
                  customFontUrl={form.customFontBodyUrl}
                  onCustomFontChange={(file) => {
                    setFontBodyFile(file)
                    if (!file) set('customFontBodyUrl', null)
                  }}
                />
              </div>
            )}

            {/* ESTILO VISUAL */}
            {activeSection === 'estilo' && (
              <div className="flex flex-col gap-3">
                <p className="text-[11.5px] text-secondary">
                  El estilo visual guía a la IA al generar los prompts de imagen y la composición del template.
                </p>
                {VISUAL_STYLES.map(s => (
                  <button key={s.value} onClick={() => set('visualStyle', s.value)}
                    className={clsx('flex items-start gap-3 p-4 rounded-[12px] border text-left transition-all',
                      form.visualStyle === s.value
                        ? 'border-primary bg-primary/[0.04]'
                        : 'border-black/[0.08] hover:border-black/[0.16]')}>
                    <div className={clsx('w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5',
                      form.visualStyle === s.value ? 'border-primary bg-primary' : 'border-black/20')} />
                    <div>
                      <p className="font-semibold text-[13px] text-primary">{s.label}</p>
                      <p className="text-[11.5px] text-secondary mt-0.5">{s.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-6 py-4 border-t border-black/[0.06] flex-shrink-0">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : isEdit ? 'Guardar cambios' : 'Crear kit'}
            </button>
          </div>
        </div>

        {/* Right — preview */}
        <div className="w-[220px] min-w-[220px] border-l border-black/[0.06] p-5 flex flex-col gap-4 bg-surface-2/30">
          <p className="text-[11px] font-bold text-tertiary uppercase tracking-wide">Preview</p>
          <KitPreview form={{ ...form, logoUrl: logoPreview }} />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-black/[0.1]"
                style={{ background: form.primaryColor }} />
              <span className="text-[11px] text-secondary font-mono">{form.primaryColor}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-black/[0.1]"
                style={{ background: form.accentColor }} />
              <span className="text-[11px] text-secondary font-mono">{form.accentColor}</span>
            </div>
            <p className="text-[11px] text-tertiary mt-1" style={{ fontFamily: form.fontDisplay }}>
              Display: {form.fontDisplay}
            </p>
            <p className="text-[11px] text-tertiary" style={{ fontFamily: form.fontBody }}>
              Body: {form.fontBody}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN EXPORT — Brand Kits Tab ─────────────────────────────────
export default function BrandKitsTab() {
  const {
    kits, loading,
    createKit, updateKit, deleteKit, setDefaultKit,
    saveKitWithFiles,
  } = useBrandKits()

  const [showModal, setShowModal] = useState(false)
  const [editingKit, setEditingKit] = useState(null)

  const handleSave = async (formData, logoFile, fontDisplayFile, fontBodyFile) => {
    if (editingKit) {
      await saveKitWithFiles(editingKit.id, formData, logoFile, fontDisplayFile, fontBodyFile)
    } else {
      const kitId = await createKit(formData)
      if (logoFile || fontDisplayFile || fontBodyFile) {
        await saveKitWithFiles(kitId, {}, logoFile, fontDisplayFile, fontBodyFile)
      }
    }
  }

  const handleDelete = async (kitId) => {
    await deleteKit(kitId)
  }

  const openEdit = (kit) => {
    setEditingKit(kit)
    setShowModal(true)
  }

  const openNew = () => {
    setEditingKit(null)
    setShowModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-display font-bold text-[15px] text-primary">Brand Kits</h3>
            <p className="text-[12px] text-secondary mt-0.5">
              Define múltiples identidades visuales para tu contenido
            </p>
          </div>
          <button onClick={openNew}
            className="btn-primary text-[12.5px] py-1.5 px-3.5 flex items-center gap-1.5">
            <Plus size={14} strokeWidth={3} color="white" /> Nuevo kit
          </button>
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-[12px] mb-5">
          <Sparkles size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12.5px] text-amber-800 font-semibold mb-0.5">¿Para qué sirven los Brand Kits?</p>
            <p className="text-[11.5px] text-amber-700 leading-relaxed">
              Al generar imágenes desde el radar de noticias, la IA usará el kit seleccionado para aplicar tus colores, tipografías y estilo visual automáticamente. El resultado siempre es on-brand.
            </p>
          </div>
        </div>

        {/* Kits grid */}
        {kits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-black/[0.08] flex items-center justify-center">
              <Palette size={28} className="text-tertiary" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-[15px] text-primary">Sin Brand Kits</p>
              <p className="text-[12px] text-secondary mt-1 max-w-xs">
                Crea tu primer kit para que la IA genere contenido siempre alineado con tu marca
              </p>
            </div>
            <button onClick={openNew} className="btn-primary text-sm py-2 px-5 flex items-center gap-2">
              <Plus size={14} strokeWidth={3} color="white" /> Crear mi primer kit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {kits.map(kit => (
              <KitCard key={kit.id} kit={kit}
                onEdit={openEdit}
                onDelete={handleDelete}
                onSetDefault={setDefaultKit}
              />
            ))}
            {/* Add new card */}
            <button onClick={openNew}
              className="card p-4 border-dashed flex flex-col items-center justify-center gap-2 text-secondary hover:text-primary hover:border-black/[0.2] transition-all min-h-[140px]">
              <Plus size={20} strokeWidth={1.5} />
              <span className="text-[12.5px] font-semibold">Nuevo kit</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <KitModal
          kit={editingKit}
          onClose={() => { setShowModal(false); setEditingKit(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
