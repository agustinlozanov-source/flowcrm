import { useState, useRef, useEffect, useCallback } from 'react'
import { loadGoogleFont } from '@/hooks/useBrandKits'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  X, Download, Loader2, RefreshCw, Plus, Trash2,
  Type, Image, AlignLeft, AlignCenter, AlignRight,
  Minus, ChevronUp, ChevronDown, Eye, EyeOff,
  Send, Layers, Lock, Unlock,
} from 'lucide-react'

// ─── CONSTANTS ────────────────────────────────────────────────────
const RAILWAY_URL = import.meta.env.VITE_RAILWAY_URL || 'https://flowcrm-production-6d63.up.railway.app'

const FORMATS = {
  '1:1':  { label: '1:1 Feed',   width: 540, height: 540 },
  '9:16': { label: '9:16 Story', width: 304, height: 540 },
}

let _lid = 0
const uid = () => `layer_${++_lid}_${Date.now()}`

// ─── BUILD INITIAL LAYERS ─────────────────────────────────────────
function buildInitialLayers(content, kit) {
  const script = content?.script
  const title  = script?.hooks?.[0]?.text || content?.title || 'Tu título aquí'
  const body   = script?.script?.development?.text?.slice(0, 120) || 'Tu mensaje principal aquí'
  const cta    = script?.script?.cta?.text?.slice(0, 60) || '→ Llama a la acción'

  const layers = [
    {
      id: uid(), type: 'text', label: 'Título',
      text: title, x: 5, y: 10, width: 88,
      fontSize: 38, fontWeight: '800',
      fontFamily: kit?.fontDisplay || 'Oswald',
      color: kit?.secondaryColor || '#ffffff',
      textAlign: 'left', lineHeight: 1.1,
      shadow: true, visible: true, locked: false,
    },
    {
      id: uid(), type: 'text', label: 'Copy',
      text: body, x: 5, y: 54, width: 88,
      fontSize: 15, fontWeight: '400',
      fontFamily: kit?.fontBody || 'Inter',
      color: kit?.secondaryColor || '#ffffff',
      textAlign: 'left', lineHeight: 1.4,
      shadow: true, visible: true, locked: false,
    },
    {
      id: uid(), type: 'text', label: 'CTA',
      text: cta, x: 5, y: 82, width: 65,
      fontSize: 14, fontWeight: '700',
      fontFamily: kit?.fontDisplay || 'Oswald',
      color: kit?.accentColor || '#f59e0b',
      textAlign: 'left', lineHeight: 1.2,
      shadow: false, visible: true, locked: false,
    },
  ]

  if (kit?.logoUrl) {
    layers.push({
      id: uid(), type: 'image', label: 'Logo',
      src: kit.logoUrl,
      x: 75, y: 85, width: 20, height: 10,
      visible: true, locked: false,
    })
  }

  return layers
}

// ─── DRAGGABLE LAYER WRAPPER ──────────────────────────────────────
function DraggableLayer({ layer, selected, canvasRef, onSelect, onChange, render }) {
  const dragging   = useRef(false)
  const dragOrigin = useRef(null)
  const resizing   = useRef(false)
  const resizeOrig = useRef(null)
  const [editMode, setEditMode] = useState(false)

  const onMouseDown = (e) => {
    if (layer.locked) return
    if (editMode) return  // en modo edición no iniciar drag
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    dragging.current = true
    dragOrigin.current = {
      mx: e.clientX, my: e.clientY,
      lx: layer.x,   ly: layer.y,
    }
  }

  const onDoubleClick = (e) => {
    if (layer.locked || layer.type !== 'text') return
    e.stopPropagation()
    onSelect()
    setEditMode(true)
  }

  const onResizeDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    resizing.current = true
    resizeOrig.current = { mx: e.clientX, w: layer.width }
  }

  useEffect(() => {
    const move = (e) => {
      if (!canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      if (dragging.current && dragOrigin.current) {
        const dx = ((e.clientX - dragOrigin.current.mx) / rect.width)  * 100
        const dy = ((e.clientY - dragOrigin.current.my) / rect.height) * 100
        onChange({
          x: Math.max(0, Math.min(97, dragOrigin.current.lx + dx)),
          y: Math.max(0, Math.min(97, dragOrigin.current.ly + dy)),
        })
      }
      if (resizing.current && resizeOrig.current) {
        const dw = ((e.clientX - resizeOrig.current.mx) / rect.width) * 100
        onChange({ width: Math.max(8, Math.min(100, resizeOrig.current.w + dw)) })
      }
    }
    const up = () => {
      dragging.current   = false
      dragOrigin.current = null
      resizing.current   = false
      resizeOrig.current = null
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup',   up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup',   up)
    }
  }, [layer, onChange, canvasRef])

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'absolute',
        left:    `${layer.x}%`,
        top:     `${layer.y}%`,
        width:   `${layer.width}%`,
        height:  layer.height ? `${layer.height}%` : undefined,
        cursor:  layer.locked ? 'default' : editMode ? 'text' : 'grab',
        zIndex:  selected ? 20 : 10,
        display: layer.visible ? 'block' : 'none',
        userSelect: editMode ? 'text' : 'none',
      }}>

      {selected && (
        <>
          <div style={{
            position: 'absolute', inset: -2,
            outline: '2px solid rgba(255,255,255,0.75)',
            borderRadius: 3, pointerEvents: 'none',
          }} />
          <div
            onMouseDown={onResizeDown}
            style={{
              position: 'absolute', right: -6, top: '50%',
              transform: 'translateY(-50%)',
              width: 12, height: 28,
              background: 'white', borderRadius: 4,
              cursor: 'ew-resize', zIndex: 30,
            }} />
        </>
      )}

      {render(editMode, () => setEditMode(false))}
    </div>
  )
}

// ─── TEXT LAYER ───────────────────────────────────────────────────
function TextLayer({ layer, onChange, editMode = false, onExitEdit }) {
  const divRef = useRef(null)
  useEffect(() => { if (layer.fontFamily) loadGoogleFont(layer.fontFamily) }, [layer.fontFamily])

  // Auto-focus cuando entra en modo edición
  useEffect(() => {
    if (editMode && divRef.current) {
      divRef.current.focus()
      // Colocar el cursor al final
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(divRef.current)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [editMode])

  return (
    <div
      ref={divRef}
      contentEditable={!layer.locked && editMode}
      suppressContentEditableWarning
      onBlur={() => onExitEdit?.()}
      onInput={e => onChange({ text: e.currentTarget.textContent })}
      style={{
        fontFamily:  layer.fontFamily,
        fontSize:    layer.fontSize,
        fontWeight:  layer.fontWeight,
        color:       layer.color,
        textAlign:   layer.textAlign,
        lineHeight:  layer.lineHeight || 1.2,
        textShadow:  layer.shadow ? '0 2px 12px rgba(0,0,0,0.8)' : 'none',
        outline: 'none',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        pointerEvents: editMode ? 'auto' : 'none',
        cursor: editMode ? 'text' : 'inherit',
        padding: '2px 4px', minHeight: '1em',
      }}>
      {layer.text}
    </div>
  )
}

// ─── IMAGE LAYER ──────────────────────────────────────────────────
function ImageLayer({ layer }) {
  return (
    <img src={layer.src} alt={layer.label} draggable={false}
      style={{
        width: '100%',
        height: layer.height ? '100%' : 'auto',
        objectFit: 'contain', display: 'block',
      }} />
  )
}

// ─── LAYER PANEL ──────────────────────────────────────────────────
function LayerPanel({ layers, selectedId, onSelect, onToggleVisible, onToggleLock, onDelete, onMoveUp, onMoveDown, onAddText, onAddImage }) {
  const fileRef = useRef()

  return (
    <div className="w-52 border-r border-white/[0.08] flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers size={12} className="text-white/40" />
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wide">Capas</span>
        </div>
        <div className="flex gap-1">
          <button onClick={onAddText} title="Nueva capa de texto"
            className="w-6 h-6 rounded flex items-center justify-center bg-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.15] transition-all">
            <Type size={11} />
          </button>
          <button onClick={() => fileRef.current?.click()} title="Subir imagen"
            className="w-6 h-6 rounded flex items-center justify-center bg-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.15] transition-all">
            <Image size={11} />
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files[0]) onAddImage(e.target.files[0]); e.target.value = '' }} />

      <div className="flex-1 overflow-y-auto py-1">
        {[...layers].reverse().map((layer, ri) => {
          const i = layers.length - 1 - ri
          return (
            <div key={layer.id} onClick={() => onSelect(layer.id)}
              className={clsx('flex items-center gap-2 px-3 py-2 cursor-pointer transition-all group',
                selectedId === layer.id
                  ? 'bg-white/[0.1] text-white'
                  : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80')}>

              <span className="flex-shrink-0 opacity-50">
                {layer.type === 'text' ? <Type size={11} /> : <Image size={11} />}
              </span>

              <span className="text-[11.5px] font-semibold flex-1 truncate">{layer.label}</span>

              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); onToggleVisible(layer.id) }}
                  className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-white">
                  {layer.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                </button>
                <button onClick={e => { e.stopPropagation(); onToggleLock(layer.id) }}
                  className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-white">
                  {layer.locked ? <Lock size={10} /> : <Unlock size={10} />}
                </button>
                <button onClick={e => { e.stopPropagation(); onMoveUp(i) }}
                  className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-white">
                  <ChevronUp size={10} />
                </button>
                <button onClick={e => { e.stopPropagation(); onMoveDown(i) }}
                  className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-white">
                  <ChevronDown size={10} />
                </button>
                <button onClick={e => { e.stopPropagation(); onDelete(layer.id) }}
                  className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-red-400">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── PROPERTIES PANEL ─────────────────────────────────────────────
function PropertiesPanel({ layer, onChange, kit }) {
  if (!layer) return (
    <div className="w-60 border-l border-white/[0.08] flex items-center justify-center p-4 flex-shrink-0">
      <p className="text-[12px] text-white/25 text-center leading-relaxed">
        Selecciona una capa para editar sus propiedades
      </p>
    </div>
  )

  return (
    <div className="w-60 border-l border-white/[0.08] flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b border-white/[0.08]">
        <p className="text-[11px] font-bold text-white/40 uppercase tracking-wide truncate">{layer.label}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* TEXT ONLY PROPERTIES */}
        {layer.type === 'text' && (
          <>
            {/* Font size */}
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-2">Tamaño</label>
              <div className="flex items-center gap-2 bg-white/[0.06] rounded-[8px] px-3 py-1.5">
                <button onClick={() => onChange({ fontSize: Math.max(8, layer.fontSize - 1) })}
                  className="text-white/40 hover:text-white">
                  <Minus size={12} />
                </button>
                <span className="text-white font-bold text-[13px] flex-1 text-center">{layer.fontSize}px</span>
                <button onClick={() => onChange({ fontSize: Math.min(120, layer.fontSize + 1) })}
                  className="text-white/40 hover:text-white">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Weight */}
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-2">Peso</label>
              <div className="flex gap-1">
                {[['400','Normal'],['600','Semi'],['800','Bold']].map(([w, l]) => (
                  <button key={w} onClick={() => onChange({ fontWeight: w })}
                    className={clsx('flex-1 py-1.5 rounded-[6px] text-[10.5px] font-semibold transition-all',
                      layer.fontWeight === w ? 'bg-white text-[#111]' : 'bg-white/[0.08] text-white/50 hover:text-white')}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Alignment */}
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-2">Alineación</label>
              <div className="flex gap-1">
                {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([v, Icon]) => (
                  <button key={v} onClick={() => onChange({ textAlign: v })}
                    className={clsx('flex-1 h-8 flex items-center justify-center rounded-[6px] transition-all',
                      layer.textAlign === v ? 'bg-white text-[#111]' : 'bg-white/[0.08] text-white/50 hover:text-white')}>
                    <Icon size={13} />
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-2">Color del texto</label>
              <div className="flex items-center gap-2 mb-2">
                <input type="color" value={layer.color} onChange={e => onChange({ color: e.target.value })}
                  className="w-9 h-9 rounded-[8px] border border-white/20 p-0.5 cursor-pointer bg-transparent" />
                <input type="text" value={layer.color} onChange={e => onChange({ color: e.target.value })}
                  className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-[6px] px-2 py-1.5 text-white text-[12px] font-mono outline-none"
                  maxLength={7} />
              </div>
              {/* Brand color shortcuts */}
              <div className="flex gap-1.5">
                {[kit?.primaryColor, kit?.secondaryColor, kit?.accentColor, '#ffffff', '#000000']
                  .filter(Boolean).map(c => (
                  <button key={c} onClick={() => onChange({ color: c })}
                    className={clsx('w-6 h-6 rounded-full border-2 transition-all flex-shrink-0',
                      layer.color === c ? 'border-white scale-110' : 'border-white/20 hover:border-white/60')}
                    style={{ background: c }} />
                ))}
              </div>
            </div>

            {/* Font family */}
            {(kit?.fontDisplay || kit?.fontBody) && (
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-2">Tipografía</label>
                <div className="flex flex-col gap-1">
                  {[kit?.fontDisplay, kit?.fontBody].filter(Boolean).map(font => (
                    <button key={font}
                      onClick={() => { onChange({ fontFamily: font }); loadGoogleFont(font) }}
                      className={clsx('px-3 py-2 rounded-[7px] text-left text-[12.5px] transition-all',
                        layer.fontFamily === font
                          ? 'bg-white/[0.15] text-white'
                          : 'text-white/40 hover:bg-white/[0.06] hover:text-white')}
                      style={{ fontFamily: font }}>
                      {font}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Shadow */}
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide">Sombra</label>
              <button onClick={() => onChange({ shadow: !layer.shadow })}
                className={clsx('w-10 h-5 rounded-full transition-all relative',
                  layer.shadow ? 'bg-white' : 'bg-white/20')}>
                <div className={clsx('absolute top-0.5 w-4 h-4 rounded-full shadow transition-all',
                  layer.shadow ? 'left-5 bg-[#111]' : 'left-0.5 bg-white/60')} />
              </button>
            </div>
          </>
        )}

        {/* IMAGE ONLY */}
        {layer.type === 'image' && (
          <div>
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-2">Vista previa</label>
            <img src={layer.src} alt="" className="w-full rounded-[8px] border border-white/[0.1]"
              style={{ maxHeight: 100, objectFit: 'contain' }} />
          </div>
        )}

        {/* COMMON — Width */}
        <div>
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-2">
            Ancho: {Math.round(layer.width)}%
          </label>
          <input type="range" min={5} max={100} value={layer.width}
            onChange={e => onChange({ width: Number(e.target.value) })}
            className="w-full accent-white" />
        </div>

        {/* Height for image layers */}
        {layer.height !== undefined && (
          <div>
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-2">
              Alto: {Math.round(layer.height)}%
            </label>
            <input type="range" min={2} max={80} value={layer.height}
              onChange={e => onChange({ height: Number(e.target.value) })}
              className="w-full accent-white" />
          </div>
        )}

      </div>
    </div>
  )
}

// ─── MAIN EDITOR ──────────────────────────────────────────────────
export default function ImageEditor({ content, brandKit, onClose, onPublish }) {
  const [format,     setFormat]     = useState('1:1')
  const [bgImageUrl, setBgImageUrl] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [exporting,  setExporting]  = useState(false)
  const [layers,     setLayers]     = useState(() => buildInitialLayers(content, brandKit))
  const [selectedId, setSelectedId] = useState(null)
  const canvasRef = useRef()

  const fmt           = FORMATS[format]
  const selectedLayer = layers.find(l => l.id === selectedId) || null

  // Load brand fonts
  useEffect(() => {
    if (brandKit?.fontDisplay) loadGoogleFont(brandKit.fontDisplay)
    if (brandKit?.fontBody)    loadGoogleFont(brandKit.fontBody)
  }, [brandKit])

  // Generate background once on mount — NOT on format change
  useEffect(() => { generateBackground() }, [])

  const generateBackground = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`${RAILWAY_URL}/content/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: {
            title:   content?.title,
            hook:    content?.script?.hooks?.[0]?.text,
            context: content?.script?.script?.context?.text,
          },
          brandKit: {
            visualStyle:  brandKit?.visualStyle  || 'bold',
            primaryColor: brandKit?.primaryColor || '#0a0a0a',
          },
          format,
        }),
      })
      const data = await res.json()
      if (data.imageUrl) { setBgImageUrl(data.imageUrl); toast.success('Imagen generada') }
      else throw new Error('Sin URL')
    } catch {
      toast.error('Error al generar imagen')
    } finally {
      setGenerating(false)
    }
  }

  // ── LAYER OPERATIONS ──────────────────────────────────────────

  const updateLayer = (id, updates) =>
    setLayers(ls => ls.map(l => l.id === id ? { ...l, ...updates } : l))

  const deleteLayer = (id) => {
    setLayers(ls => ls.filter(l => l.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const toggleVisible = (id) => updateLayer(id, { visible: !layers.find(l => l.id === id)?.visible })
  const toggleLock    = (id) => updateLayer(id, { locked:  !layers.find(l => l.id === id)?.locked  })

  const moveUp = (i) => {
    if (i >= layers.length - 1) return
    const a = [...layers]; [a[i], a[i+1]] = [a[i+1], a[i]]; setLayers(a)
  }
  const moveDown = (i) => {
    if (i <= 0) return
    const a = [...layers]; [a[i], a[i-1]] = [a[i-1], a[i]]; setLayers(a)
  }

  const addTextLayer = () => {
    const l = {
      id: uid(), type: 'text', label: 'Texto nuevo',
      text: 'Escribe aquí',
      x: 10, y: 45, width: 80,
      fontSize: 24, fontWeight: '700',
      fontFamily: brandKit?.fontDisplay || 'Oswald',
      color: '#ffffff', textAlign: 'left', lineHeight: 1.2,
      shadow: true, visible: true, locked: false,
    }
    setLayers(ls => [...ls, l])
    setSelectedId(l.id)
  }

  const addImageLayer = (file) => {
    const src = URL.createObjectURL(file)
    const l = {
      id: uid(), type: 'image', label: file.name.split('.')[0] || 'Imagen',
      src, x: 20, y: 20, width: 40, height: 20,
      visible: true, locked: false,
    }
    setLayers(ls => [...ls, l])
    setSelectedId(l.id)
  }

  // ── EXPORT ────────────────────────────────────────────────────

  const exportImage = async () => {
    if (!canvasRef.current || !bgImageUrl) { toast.error('Genera una imagen primero'); return }
    setExporting(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true, allowTaint: true, scale: 2,
        backgroundColor: null,
        width: fmt.width, height: fmt.height, logging: false,
      })
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${(content?.title || 'post').slice(0, 30)}-${format.replace(':', 'x')}.png`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('PNG exportado')
      }, 'image/png')
    } catch {
      toast.error('Error al exportar. Asegúrate de tener html2canvas instalado.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111] overflow-hidden">

      {/* ── TOPBAR ── */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-white/[0.08] flex-shrink-0 bg-[#0d0d0d]">
        <button onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all">
          <X size={16} />
        </button>

        <div className="w-px h-4 bg-white/[0.1]" />
        <span className="text-white font-bold text-[13px] truncate max-w-xs flex-1">
          {(content?.title || 'Editor de imagen').slice(0, 50)}
        </span>

        {/* Format toggle — does NOT trigger regeneration */}
        <div className="flex items-center bg-white/[0.08] rounded-[8px] p-1 gap-0.5">
          {Object.entries(FORMATS).map(([key, f]) => (
            <button key={key} onClick={() => setFormat(key)}
              className={clsx('px-3 py-1 rounded-[6px] text-[11.5px] font-bold transition-all',
                format === key ? 'bg-white text-[#111]' : 'text-white/50 hover:text-white')}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Explicit regenerate */}
        <button onClick={generateBackground} disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/[0.08] text-white/60 hover:text-white text-[12px] font-semibold transition-all disabled:opacity-40">
          {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {generating ? 'Generando...' : 'Regenerar fondo'}
        </button>

        <div className="w-px h-4 bg-white/[0.1]" />

        <button onClick={exportImage} disabled={exporting || !bgImageUrl}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-[8px] bg-white text-[#111] text-[12px] font-bold hover:bg-white/90 transition-all disabled:opacity-40">
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Exportar PNG
        </button>

        {onPublish && (
          <button onClick={() => onPublish(bgImageUrl)} disabled={!bgImageUrl}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[8px] bg-green-500 text-white text-[12px] font-bold hover:bg-green-600 transition-all disabled:opacity-40">
            <Send size={13} /> Publicar
          </button>
        )}
      </div>

      {/* ── WORKSPACE ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left — Layer panel */}
        <LayerPanel
          layers={layers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onToggleVisible={toggleVisible}
          onToggleLock={toggleLock}
          onDelete={deleteLayer}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
          onAddText={addTextLayer}
          onAddImage={addImageLayer}
        />

        {/* Center — Canvas */}
        <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] overflow-hidden p-6">
          <div
            ref={canvasRef}
            onClick={() => setSelectedId(null)}
            style={{
              width:    fmt.width,
              height:   fmt.height,
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
              borderRadius: 10,
              boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
              background: brandKit?.primaryColor || '#0a0a0a',
            }}>

            {/* Background */}
            {generating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 size={28} className="text-white/30 animate-spin" />
                <p className="text-white/30 text-[12px] font-semibold">Generando con FLUX AI...</p>
              </div>
            ) : bgImageUrl ? (
              <img src={bgImageUrl} alt="bg"
                className="absolute inset-0 w-full h-full object-cover"
                crossOrigin="anonymous" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <button onClick={generateBackground}
                  className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white/[0.1] text-white/60 hover:text-white text-[12px] font-semibold transition-all">
                  <RefreshCw size={13} /> Generar imagen de fondo
                </button>
              </div>
            )}

            {/* Overlay */}
            {bgImageUrl && (
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.55) 100%)' }} />
            )}

            {/* All layers */}
            {layers.map(layer => (
              <DraggableLayer
                key={layer.id}
                layer={layer}
                selected={selectedId === layer.id}
                canvasRef={canvasRef}
                onSelect={() => setSelectedId(layer.id)}
                onChange={updates => updateLayer(layer.id, updates)}
                render={(editMode, onExitEdit) =>
                  layer.type === 'text'
                    ? <TextLayer  layer={layer} onChange={u => updateLayer(layer.id, u)} editMode={editMode} onExitEdit={onExitEdit} />
                    : <ImageLayer layer={layer} />
                }
              />
            ))}
          </div>
        </div>

        {/* Right — Properties */}
        <PropertiesPanel
          layer={selectedLayer}
          onChange={updates => selectedId && updateLayer(selectedId, updates)}
          kit={brandKit}
        />
      </div>
    </div>
  )
}
