import { useState, useRef, useEffect, useCallback } from 'react'
import { useBrandKits, loadGoogleFont } from '@/hooks/useBrandKits'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  X, Download, Loader2, RefreshCw, ChevronDown,
  Type, AlignLeft, AlignCenter, AlignRight,
  Bold, Minus, Plus, Eye, Send
} from 'lucide-react'

// ─── CONSTANTS ────────────────────────────────────────────────────
const RAILWAY_URL = import.meta.env.VITE_RAILWAY_URL || 'https://flowcrm-production-6d63.up.railway.app'

const FORMATS = {
  '1:1':  { label: '1:1 Feed',    width: 540, height: 540,  falSize: 'square_hd'      },
  '9:16': { label: '9:16 Story',  width: 304, height: 540,  falSize: 'portrait_16_9'  },
}

// ─── TEXT BLOCK ───────────────────────────────────────────────────
// A positioned, editable text element on the canvas
function TextBlock({ block, selected, onSelect, onChange, onDragEnd, canvasRef }) {
  const ref = useRef()
  const dragStart = useRef(null)
  const [dragging, setDragging] = useState(false)

  // Load font
  useEffect(() => { if (block.fontFamily) loadGoogleFont(block.fontFamily) }, [block.fontFamily])

  const handleMouseDown = (e) => {
    if (e.target.getAttribute('contenteditable') === 'true') return
    e.preventDefault()
    onSelect()
    const rect = canvasRef.current.getBoundingClientRect()
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      blockX: block.x,
      blockY: block.y,
    }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e) => {
      if (!dragStart.current || !canvasRef.current) return
      const scale = canvasRef.current.offsetWidth / canvasRef.current.getBoundingClientRect().width
      const dx = (e.clientX - dragStart.current.mouseX)
      const dy = (e.clientY - dragStart.current.mouseY)
      onChange({
        x: Math.max(0, Math.min(95, dragStart.current.blockX + (dx / canvasRef.current.offsetWidth) * 100)),
        y: Math.max(0, Math.min(95, dragStart.current.blockY + (dy / canvasRef.current.offsetHeight) * 100)),
      })
    }
    const handleUp = () => {
      setDragging(false)
      dragStart.current = null
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, onChange])

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: `${block.x}%`,
        top: `${block.y}%`,
        width: `${block.width}%`,
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: selected ? 10 : 5,
      }}>
      {/* Selection border */}
      {selected && (
        <div className="absolute inset-0 border-2 border-white/60 rounded pointer-events-none"
          style={{ margin: -2 }} />
      )}

      {/* Editable text */}
      <div
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange({ text: e.currentTarget.textContent })}
        onClick={e => { e.stopPropagation(); onSelect() }}
        style={{
          fontFamily: block.fontFamily,
          fontSize: block.fontSize,
          fontWeight: block.fontWeight,
          color: block.color,
          textAlign: block.textAlign,
          lineHeight: block.lineHeight || 1.2,
          textShadow: block.shadow ? '0 2px 8px rgba(0,0,0,0.6)' : 'none',
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '2px 4px',
          borderRadius: 4,
          background: selected ? 'rgba(255,255,255,0.08)' : 'transparent',
          cursor: 'text',
          minHeight: '1em',
        }}>
        {block.text}
      </div>
    </div>
  )
}

// ─── TEXT TOOLBAR ─────────────────────────────────────────────────
function TextToolbar({ block, onChange, kit }) {
  if (!block) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Font size */}
      <div className="flex items-center gap-1 bg-surface border border-black/[0.1] rounded-[8px] px-2 py-1">
        <button onClick={() => onChange({ fontSize: Math.max(10, block.fontSize - 2) })}
          className="text-tertiary hover:text-primary transition-colors">
          <Minus size={11} />
        </button>
        <span className="text-[12px] font-bold text-primary w-6 text-center">{block.fontSize}</span>
        <button onClick={() => onChange({ fontSize: Math.min(120, block.fontSize + 2) })}
          className="text-tertiary hover:text-primary transition-colors">
          <Plus size={11} />
        </button>
      </div>

      {/* Bold */}
      <button onClick={() => onChange({ fontWeight: block.fontWeight === '800' ? '400' : '800' })}
        className={clsx('w-7 h-7 rounded-[6px] flex items-center justify-center transition-all',
          block.fontWeight === '800' ? 'bg-primary text-white' : 'bg-surface border border-black/[0.1] text-secondary hover:text-primary')}>
        <Bold size={12} />
      </button>

      {/* Align */}
      {[
        { value: 'left',   icon: AlignLeft   },
        { value: 'center', icon: AlignCenter  },
        { value: 'right',  icon: AlignRight   },
      ].map(({ value, icon: Icon }) => (
        <button key={value} onClick={() => onChange({ textAlign: value })}
          className={clsx('w-7 h-7 rounded-[6px] flex items-center justify-center transition-all',
            block.textAlign === value ? 'bg-primary text-white' : 'bg-surface border border-black/[0.1] text-secondary hover:text-primary')}>
          <Icon size={12} />
        </button>
      ))}

      {/* Color */}
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] text-tertiary font-semibold">Color</label>
        <input type="color" value={block.color} onChange={e => onChange({ color: e.target.value })}
          className="w-7 h-7 rounded-[6px] border border-black/[0.1] p-0.5 cursor-pointer bg-transparent" />
      </div>

      {/* Shadow toggle */}
      <button onClick={() => onChange({ shadow: !block.shadow })}
        className={clsx('px-2.5 py-1 rounded-[6px] text-[11px] font-semibold transition-all',
          block.shadow ? 'bg-primary/[0.1] text-primary' : 'bg-surface border border-black/[0.1] text-secondary')}>
        Sombra
      </button>
    </div>
  )
}

// ─── MAIN EDITOR ──────────────────────────────────────────────────
export default function ImageEditor({ content, brandKit, onClose, onPublish }) {
  const [format, setFormat] = useState('1:1')
  const [imageUrl, setImageUrl] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState(null)
  const canvasRef = useRef()
  const exportRef = useRef()

  const fmt = FORMATS[format]

  // ── Initialize text blocks from script ──
  const initBlocks = useCallback((kit) => {
    const script = content?.script
    const title = script?.hooks?.[0]?.text || content?.title || 'Tu título aquí'
    const body = script?.script?.development?.text?.slice(0, 120) || 'Tu mensaje principal aquí'
    const cta = script?.script?.cta?.text?.slice(0, 60) || 'Llama a la acción aquí'

    return [
      {
        id: 'title',
        label: 'Título',
        text: title,
        x: 5,
        y: 10,
        width: 90,
        fontSize: 36,
        fontWeight: '800',
        fontFamily: kit?.fontDisplay || 'Oswald',
        color: kit?.secondaryColor || '#ffffff',
        textAlign: 'left',
        lineHeight: 1.1,
        shadow: true,
      },
      {
        id: 'body',
        label: 'Copy',
        text: body,
        x: 5,
        y: 52,
        width: 90,
        fontSize: 16,
        fontWeight: '400',
        fontFamily: kit?.fontBody || 'Inter',
        color: kit?.secondaryColor || '#ffffff',
        textAlign: 'left',
        lineHeight: 1.4,
        shadow: true,
      },
      {
        id: 'cta',
        label: 'CTA',
        text: cta,
        x: 5,
        y: 80,
        width: 60,
        fontSize: 14,
        fontWeight: '700',
        fontFamily: kit?.fontDisplay || 'Oswald',
        color: kit?.accentColor || '#f59e0b',
        textAlign: 'left',
        lineHeight: 1.2,
        shadow: false,
      },
    ]
  }, [content])

  const [blocks, setBlocks] = useState(() => initBlocks(brandKit))

  // Load fonts
  useEffect(() => {
    if (brandKit?.fontDisplay) loadGoogleFont(brandKit.fontDisplay)
    if (brandKit?.fontBody) loadGoogleFont(brandKit.fontBody)
  }, [brandKit])

  // ── Generate image ──
  const generateImage = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`${RAILWAY_URL}/content/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: {
            title: content?.title,
            hook: content?.script?.hooks?.[0]?.text,
            context: content?.script?.script?.context?.text,
          },
          brandKit: {
            visualStyle: brandKit?.visualStyle || 'bold',
            primaryColor: brandKit?.primaryColor || '#0a0a0a',
          },
          format,
        }),
      })
      const data = await res.json()
      if (data.imageUrl) {
        setImageUrl(data.imageUrl)
        toast.success('Imagen generada')
      } else {
        throw new Error('Sin URL de imagen')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al generar la imagen')
    } finally {
      setGenerating(false)
    }
  }

  // Auto-generate on mount
  useEffect(() => { generateImage() }, [format])

  // ── Update block ──
  const updateBlock = (id, updates) => {
    setBlocks(bs => bs.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  const selectedBlock = blocks.find(b => b.id === selectedBlockId)

  // ── Export to PNG ──
  const exportImage = async () => {
    if (!canvasRef.current || !imageUrl) return
    setExporting(true)

    try {
      // Dynamic import to avoid bundling issues
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: null,
        width: fmt.width,
        height: fmt.height,
        logging: false,
      })

      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${content?.title?.slice(0, 30) || 'post'}-${format.replace(':', 'x')}.png`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Imagen exportada')
      }, 'image/png')
    } catch (err) {
      console.error(err)
      toast.error('Error al exportar. Instala html2canvas.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111] overflow-hidden">

      {/* ── TOPBAR ── */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-white/[0.08] flex-shrink-0">
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <X size={18} />
        </button>
        <div className="w-px h-4 bg-white/[0.1]" />
        <span className="text-white font-display font-bold text-sm truncate flex-1">
          {content?.title?.slice(0, 50) || 'Editor de imagen'}
        </span>

        {/* Format selector */}
        <div className="flex items-center bg-white/[0.08] rounded-[8px] p-1 gap-0.5">
          {Object.entries(FORMATS).map(([key, f]) => (
            <button key={key} onClick={() => setFormat(key)}
              className={clsx('px-3 py-1 rounded-[6px] text-[11.5px] font-bold transition-all',
                format === key ? 'bg-white text-primary' : 'text-white/50 hover:text-white')}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Regenerate */}
        <button onClick={generateImage} disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/[0.08] text-white/70 hover:text-white text-[12px] font-semibold transition-all disabled:opacity-40">
          {generating
            ? <Loader2 size={13} className="animate-spin" />
            : <RefreshCw size={13} />}
          Regenerar
        </button>

        {/* Export */}
        <button onClick={exportImage} disabled={exporting || !imageUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white text-primary text-[12px] font-bold transition-all disabled:opacity-40 hover:bg-white/90">
          {exporting
            ? <Loader2 size={13} className="animate-spin" />
            : <Download size={13} />}
          Exportar PNG
        </button>

        {onPublish && (
          <button onClick={() => onPublish(imageUrl)}
            disabled={!imageUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-green-500 text-white text-[12px] font-bold hover:bg-green-600 transition-all disabled:opacity-40">
            <Send size={13} /> Publicar
          </button>
        )}
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left panel — block list */}
        <div className="w-52 border-r border-white/[0.08] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.08]">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wide">Bloques de texto</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
            {blocks.map(block => (
              <button key={block.id} onClick={() => setSelectedBlockId(block.id)}
                className={clsx('w-full text-left px-3 py-2.5 rounded-[8px] transition-all',
                  selectedBlockId === block.id
                    ? 'bg-white/[0.12] text-white'
                    : 'text-white/50 hover:bg-white/[0.06] hover:text-white')}>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-0.5">{block.label}</p>
                <p className="text-[11.5px] truncate" style={{ fontFamily: block.fontFamily }}>
                  {block.text?.slice(0, 30) || '...'}
                </p>
              </button>
            ))}
          </div>

          {/* Brand Kit info */}
          {brandKit && (
            <div className="p-3 border-t border-white/[0.08]">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wide mb-2">Brand Kit activo</p>
              <div className="flex items-center gap-2">
                {brandKit.logoUrl && (
                  <img src={brandKit.logoUrl} alt="" className="w-6 h-6 object-contain" />
                )}
                <span className="text-[11px] text-white/50 font-semibold">{brandKit.name}</span>
              </div>
              <div className="flex gap-1 mt-2">
                {[brandKit.primaryColor, brandKit.secondaryColor, brandKit.accentColor].map((c, i) => (
                  <div key={i} className="w-4 h-4 rounded border border-white/20"
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center — canvas */}
        <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] overflow-hidden p-8">
          <div
            ref={canvasRef}
            onClick={() => setSelectedBlockId(null)}
            style={{
              width: fmt.width,
              height: fmt.height,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 12,
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              background: brandKit?.primaryColor || '#0a0a0a',
              flexShrink: 0,
            }}>

            {/* Background image */}
            {generating ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={28} className="text-white/40 animate-spin" />
                  <p className="text-white/40 text-[12px] font-semibold">Generando imagen con FLUX...</p>
                </div>
              </div>
            ) : imageUrl ? (
              <img src={imageUrl} alt="Background"
                className="absolute inset-0 w-full h-full object-cover"
                crossOrigin="anonymous" />
            ) : null}

            {/* Dark overlay for text readability */}
            {imageUrl && (
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)' }} />
            )}

            {/* Logo overlay */}
            {brandKit?.logoUrl && (
              <img src={brandKit.logoUrl} alt="Logo"
                className="absolute bottom-4 right-4 object-contain"
                style={{ width: fmt.width * 0.15, height: fmt.width * 0.08, objectFit: 'contain' }}
                crossOrigin="anonymous" />
            )}

            {/* Text blocks */}
            {blocks.map(block => (
              <TextBlock
                key={block.id}
                block={block}
                selected={selectedBlockId === block.id}
                onSelect={() => setSelectedBlockId(block.id)}
                onChange={(updates) => updateBlock(block.id, updates)}
                canvasRef={canvasRef}
              />
            ))}
          </div>
        </div>

        {/* Right panel — text toolbar */}
        <div className="w-64 border-l border-white/[0.08] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.08]">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wide">
              {selectedBlock ? `Editando: ${selectedBlock.label}` : 'Selecciona un bloque'}
            </p>
          </div>

          {selectedBlock ? (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <TextToolbar
                block={selectedBlock}
                onChange={(updates) => updateBlock(selectedBlock.id, updates)}
                kit={brandKit}
              />

              {/* Font family quick change */}
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-2">
                  Tipografía
                </label>
                <div className="flex flex-col gap-1">
                  {[brandKit?.fontDisplay, brandKit?.fontBody].filter(Boolean).map(font => (
                    <button key={font} onClick={() => { updateBlock(selectedBlock.id, { fontFamily: font }); loadGoogleFont(font) }}
                      className={clsx('px-3 py-2 rounded-[7px] text-left text-[12px] transition-all',
                        selectedBlock.fontFamily === font
                          ? 'bg-white/[0.12] text-white'
                          : 'text-white/40 hover:bg-white/[0.06] hover:text-white')}
                      style={{ fontFamily: font }}>
                      {font}
                    </button>
                  ))}
                </div>
              </div>

              {/* Width control */}
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-2">
                  Ancho del bloque: {selectedBlock.width}%
                </label>
                <input type="range" min={20} max={100} value={selectedBlock.width}
                  onChange={e => updateBlock(selectedBlock.id, { width: Number(e.target.value) })}
                  className="w-full accent-white" />
              </div>

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-1">X %</label>
                  <input type="number" min={0} max={95} value={Math.round(selectedBlock.x)}
                    onChange={e => updateBlock(selectedBlock.id, { x: Number(e.target.value) })}
                    className="w-full bg-white/[0.08] border border-white/[0.1] rounded-[6px] px-2 py-1.5 text-white text-[12px] outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wide block mb-1">Y %</label>
                  <input type="number" min={0} max={95} value={Math.round(selectedBlock.y)}
                    onChange={e => updateBlock(selectedBlock.id, { y: Number(e.target.value) })}
                    className="w-full bg-white/[0.08] border border-white/[0.1] rounded-[6px] px-2 py-1.5 text-white text-[12px] outline-none" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <Type size={24} className="text-white/20 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-[12px] text-white/30">
                  Haz clic en un bloque de texto para editarlo
                </p>
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="p-4 border-t border-white/[0.08]">
            <p className="text-[10px] text-white/25 leading-relaxed">
              💡 Arrastra los bloques para reposicionarlos. Haz doble clic para editar el texto directamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
