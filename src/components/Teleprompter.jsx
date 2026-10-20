/* Teleprompter.
 *
 * Vivía enterrado dentro de Contenido, a tres clics del guión. Lo usan dos
 * pantallas distintas, así que ya no sabe de dónde salen los párrafos: se los
 * dan hechos y él solo los hace rodar.
 */
import { useState, useEffect, useRef } from 'react'
import { Tv, RotateCcw, Play } from 'lucide-react'

/* El fondo va fijo en negro, no en el color del tema. Esto se lee a un metro
 * y medio con la cámara enfrente: lo que hace falta es contraste, no que
 * combine con la aplicación. Antes usaba el token "primary", que con el
 * rediseño pasó a significar otra cosa y dejaba el teleprompter azul sobre
 * azul. */

export default function Teleprompter({ parrafos = [], titulo = 'Teleprompter', onClose }) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fontSize, setFontSize] = useState(26)
  const [elapsed, setElapsed] = useState(0)
  const scrollRef = useRef(null)
  const animRef = useRef(null)
  const startRef = useRef(null)

  const bloques = parrafos.filter(Boolean)

  useEffect(() => {
    if (playing) {
      startRef.current = Date.now() - elapsed * 1000
      const animate = () => {
        const el = scrollRef.current
        if (!el) return
        const secs = (Date.now() - startRef.current) / 1000
        setElapsed(secs)
        const totalScroll = el.scrollHeight - el.clientHeight
        const duration = 60 / speed
        el.scrollTop = (secs / duration) * totalScroll
        if (el.scrollTop < totalScroll) {
          animRef.current = requestAnimationFrame(animate)
        } else {
          setPlaying(false)
        }
      }
      animRef.current = requestAnimationFrame(animate)
    } else {
      cancelAnimationFrame(animRef.current)
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [playing, speed])

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.08]">
        <span className="text-white font-display font-bold text-sm flex items-center gap-1.5"><Tv size={14} /> {titulo}</span>
        <div className="flex items-center gap-4 ml-4">
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-[10px] uppercase tracking-wide font-semibold">Velocidad</span>
            <button onClick={() => setSpeed(s => Math.max(0.3, +(s - 0.1).toFixed(1)))}
              className="w-6 h-6 rounded bg-white/10 text-white/60 flex items-center justify-center text-sm hover:bg-white/20">−</button>
            <span className="text-accent-amber font-bold text-sm w-8 text-center">{speed}x</span>
            <button onClick={() => setSpeed(s => Math.min(3, +(s + 0.1).toFixed(1)))}
              className="w-6 h-6 rounded bg-white/10 text-white/60 flex items-center justify-center text-sm hover:bg-white/20">+</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-[10px] uppercase tracking-wide font-semibold">Fuente</span>
            <button onClick={() => setFontSize(s => Math.max(16, s - 2))}
              className="w-6 h-6 rounded bg-white/10 text-white/60 flex items-center justify-center text-xs font-bold hover:bg-white/20">A-</button>
            <button onClick={() => setFontSize(s => Math.min(48, s + 2))}
              className="w-6 h-6 rounded bg-white/10 text-white/60 flex items-center justify-center text-xs font-bold hover:bg-white/20">A+</button>
          </div>
        </div>
        <button onClick={onClose} className="ml-auto text-white/40 hover:text-white text-sm">✕ Cerrar</button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px bg-amber-400/30 z-20 pointer-events-none" />
        <div ref={scrollRef} className="h-full overflow-hidden px-16 py-32">
          {bloques.map((para, i) => (
            <p key={i} className="mb-8 text-white/90 leading-relaxed font-display font-bold"
              style={{ fontSize }}>
              {para}
            </p>
          ))}
          <div style={{ height: '60vh' }} />
        </div>
      </div>

      <div className="flex items-center gap-3 px-5 py-4 border-t border-white/[0.08]">
        <button
          onClick={() => { setElapsed(0); if (scrollRef.current) scrollRef.current.scrollTop = 0 }}
          className="w-9 h-9 rounded-lg bg-white/10 text-white/60 flex items-center justify-center hover:bg-white/20 text-base"
        ><RotateCcw size={16} /></button>
        <button
          onClick={() => setPlaying(p => !p)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all"
          style={{ background: playing ? 'rgba(255,59,48,0.9)' : '#f59e0b', color: playing ? 'white' : '#0a0a0a' }}
        >
          {playing ? (
            <><div className="w-2 h-2 rounded-full bg-white animate-pulse" /> Pausar</>
          ) : (
            <><Play size={14} fill="currentColor" /> Iniciar</>
          )}
        </button>
        <span className="text-white/40 font-display font-bold text-sm w-12 text-center">{formatTime(elapsed)}</span>
      </div>
    </div>
  )
}

