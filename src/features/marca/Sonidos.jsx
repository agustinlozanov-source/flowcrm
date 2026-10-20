/* Buscador de efectos de sonido, conectado a Freesound.
 *
 * Solo trae dominio público (CC0). No es por purismo: las demás licencias
 * obligan a poner créditos o prohíben el uso comercial, y una pieza de marca
 * personal es comercial. Mejor un catálogo más chico que una infracción
 * esperando a pasar.
 */
import { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { Search, Play, Pause, Plus, RefreshCw, Volume2 } from 'lucide-react'

/* Freesound está etiquetado en inglés, así que las categorías traducen por
 * dentro. Quien edita piensa en "transición", no en "whoosh". */
const CATEGORIAS = [
  { label: 'Transición', q: 'whoosh transition swoosh' },
  { label: 'Impacto',    q: 'impact hit boom' },
  { label: 'Subida',     q: 'riser build up tension' },
  { label: 'Clic',       q: 'click ui button' },
  { label: 'Aviso',      q: 'notification ding bell' },
  { label: 'Pop',        q: 'pop bubble blip' },
  { label: 'Aplausos',   q: 'applause clapping crowd' },
  { label: 'Dinero',     q: 'cash register coins money' },
  { label: 'Error',      q: 'error wrong buzz' },
  { label: 'Ambiente',   q: 'room tone ambience' },
]

const seg = (s) => (typeof s === 'number' ? `${s.toFixed(1)}s` : '—')

export default function Sonidos({ onAgregar, enSegundo }) {
  const [texto, setTexto] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [sonidos, setSonidos] = useState([])
  const [sonando, setSonando] = useState(null)
  const [fallo, setFallo] = useState(null)
  const audio = useRef(null)

  useEffect(() => () => { audio.current?.pause() }, [])

  const buscar = async (q) => {
    const consulta = (q || texto).trim()
    if (!consulta) return
    setBuscando(true)
    setFallo(null)
    try {
      const res = await fetch(`/.netlify/functions/buscar-sonidos?q=${encodeURIComponent(consulta)}`)
      // Si la función no está desplegada, el servidor devuelve la página en
      // vez de datos. Sin esto el error que sale habla de un "<" y no se
      // entiende nada.
      let r
      try { r = await res.json() }
      catch { throw new Error('El buscador de sonidos no está respondiendo. Puede que falte desplegar.') }
      if (!res.ok || !r.ok) throw new Error(r.detalle || r.error || 'No se pudo buscar')
      setSonidos(r.sonidos)
      if (!r.sonidos.length) toast('Nada con ese nombre')
    } catch (e) {
      setFallo(e.message)
    } finally {
      setBuscando(false)
    }
  }

  // Uno a la vez: dos sonidos sonando encima es ruido, no una previa.
  const oir = (s) => {
    if (sonando === s.id) { audio.current?.pause(); setSonando(null); return }
    audio.current?.pause()
    const a = new Audio(s.audio)
    a.play().catch(() => toast.error('No se pudo reproducir'))
    a.onended = () => setSonando(null)
    audio.current = a
    setSonando(s.id)
  }

  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Volume2 size={15} className="text-tertiary" />
        <h2 className="font-display font-bold text-[14px] text-primary">Sonidos</h2>
        <span className="ml-auto text-[11px] text-tertiary">Dominio público · uso libre</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {CATEGORIAS.map(c => (
          <button key={c.label} onClick={() => { setTexto(c.label); buscar(c.q) }} disabled={buscando}
            className="px-2.5 py-1 rounded-btn bg-surface-2 border border-border text-[12px] font-semibold text-secondary hover:text-primary disabled:opacity-50">
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <input
          value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="O busca lo que quieras: lluvia, puerta, teclado…"
          className="flex-1 px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
        />
        <button onClick={() => buscar()} disabled={buscando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
          {buscando ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar
        </button>
      </div>

      {fallo && (
        <p className="text-[12px] text-accent-amber mb-3">{fallo}</p>
      )}

      {sonidos.length > 0 && (
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-h-[320px] overflow-y-auto pr-1">
          {sonidos.map(s => (
            <div key={s.id} className="flex items-center gap-2 bg-surface-2 border border-border rounded-btn p-2">
              <button onClick={() => oir(s)}
                className={clsx('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  sonando === s.id ? 'bg-accent-blue text-white' : 'bg-surface border border-border text-secondary')}>
                {sonando === s.id ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-primary truncate" title={s.nombre}>{s.nombre}</div>
                <div className="text-[11px] text-tertiary truncate">{seg(s.duracion)} · {s.autor}</div>
              </div>
              <button onClick={() => onAgregar?.(s)} title={`Poner en ${Math.round(enSegundo || 0)}s`}
                className="w-7 h-7 rounded-btn bg-surface border border-border flex items-center justify-center text-tertiary hover:text-accent-green shrink-0">
                <Plus size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {sonidos.length > 0 && (
        <p className="text-[11px] text-tertiary mt-2">
          El botón <strong>+</strong> lo coloca donde esté la aguja de la línea de tiempo.
        </p>
      )}
    </div>
  )
}
