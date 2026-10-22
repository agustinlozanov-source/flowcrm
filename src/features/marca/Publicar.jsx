import { useState, useRef, useEffect } from 'react'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { Upload, Send, Image as ImageIcon, Film, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

/* Publicar en Instagram desde FlowHub.
 *
 * El archivo se sube primero a Storage porque Instagram no lo recibe: le
 * damos una URL pública y la descarga él. Después hay que esperar a que lo
 * procese —un reel tarda minutos— y recién entonces se publica.
 *
 * Esa espera se hace aquí y no en el servidor: una función de Netlify muere a
 * los 26 segundos, así que aguardar allá era garantizar que los videos largos
 * fallaran. Aquí preguntamos cada cinco segundos y no hay reloj encima.
 */

const ESPERA = 5000        // entre preguntas de estado
const MAX_ESPERA = 300000  // Instagram deja de procesar bastante antes

export default function Publicar({ orgId, marca }) {
  const [archivo, setArchivo] = useState(null)
  const [tipo, setTipo] = useState('reel')
  const [caption, setCaption] = useState('')
  const [subiendo, setSubiendo] = useState(0)
  const [fase, setFase] = useState(null)   // subiendo | procesando | publicando
  const [cupo, setCupo] = useState(null)
  const input = useRef(null)
  const vivo = useRef(true)
  useEffect(() => () => { vivo.current = false }, [])

  const conectada = Boolean(marca?.ig?.userId)

  // Cuánto le queda hoy. Si falla, no se muestra y ya: es información, no
  // una condición para publicar.
  useEffect(() => {
    if (!conectada) return
    llamar('cupo').then(r => setCupo(r)).catch(() => {})
  }, [conectada, marca?.id])

  async function llamar(accion, extra = {}) {
    const res = await fetch('/.netlify/functions/instagram-publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, orgId, brandId: marca.id, ...extra }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || 'Falló la llamada')
    return data
  }

  const elegir = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setArchivo(f)
    setTipo(f.type.startsWith('image/') ? 'imagen' : 'reel')
  }

  const publicar = async () => {
    if (!archivo) return toast.error('Elige el archivo')
    try {
      // 1 · A Storage, que es de donde Instagram lo va a bajar.
      setFase('subiendo')
      const ruta = `organizations/${orgId}/brands/${marca.id}/publicaciones/${Date.now()}-${archivo.name}`
      const tarea = uploadBytesResumable(storageRef(storage, ruta), archivo)
      const url = await new Promise((ok, falla) => {
        tarea.on('state_changed',
          s => setSubiendo(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
          falla,
          async () => ok(await getDownloadURL(tarea.snapshot.ref)))
      })

      // 2 · El contenedor. Instagram empieza a procesarlo.
      setFase('procesando')
      const { contenedorId } = await llamar('crear', { tipo, url, caption })

      // 3 · Esperar a que termine. Una imagen suele estar lista enseguida;
      //     un reel puede tardar minutos.
      const arranque = Date.now()
      for (;;) {
        if (!vivo.current) return
        const { estado, detalle } = await llamar('estado', { contenedorId })
        if (estado === 'FINISHED') break
        if (estado === 'ERROR' || estado === 'EXPIRED') {
          throw new Error(detalle || `Instagram rechazó el archivo (${estado}). Suele ser el formato: usa MP4 H.264, vertical, de menos de 90 segundos.`)
        }
        if (Date.now() - arranque > MAX_ESPERA) {
          throw new Error('Instagram lleva demasiado procesándolo. Vuelve a intentarlo con un archivo más ligero.')
        }
        await new Promise(r => setTimeout(r, ESPERA))
      }

      // 4 · Publicar.
      setFase('publicando')
      await llamar('publicar', { contenedorId, tipo, caption, url })

      toast.success('Publicado en Instagram')
      setArchivo(null); setCaption(''); setSubiendo(0)
      if (input.current) input.current.value = ''
      llamar('cupo').then(setCupo).catch(() => {})
    } catch (e) {
      toast.error(e.message)
    } finally {
      if (vivo.current) setFase(null)
    }
  }

  if (!conectada) {
    return (
      <div className="bg-surface border border-border rounded-card shadow-card p-6 text-center">
        <p className="text-[13px] text-secondary">
          Conecta Instagram en esta marca para poder publicar.
        </p>
      </div>
    )
  }

  const trabajando = Boolean(fase)
  const rotulo = {
    subiendo: `Subiendo… ${subiendo}%`,
    procesando: 'Instagram lo está procesando…',
    publicando: 'Publicando…',
  }[fase]

  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-[14px] text-primary">
          Publicar en @{marca.ig?.username || marca.handle}
        </h2>
        {cupo?.usadas != null && (
          <span className="text-[11px] text-tertiary">
            {cupo.usadas} de {cupo.tope} publicaciones hoy
          </span>
        )}
      </div>

      {/* El archivo ya viene editado: esto no edita nada, solo publica. */}
      <input ref={input} type="file" accept="video/mp4,video/quicktime,image/jpeg,image/png"
        onChange={elegir} disabled={trabajando} className="hidden" id="archivo-publicar" />

      <label htmlFor="archivo-publicar"
        className={clsx('flex items-center gap-3 p-4 rounded-card border border-dashed border-border cursor-pointer hover:border-accent-blue transition-colors',
          trabajando && 'opacity-50 pointer-events-none')}>
        {archivo
          ? (tipo === 'imagen' ? <ImageIcon size={18} className="text-accent-blue" /> : <Film size={18} className="text-accent-blue" />)
          : <Upload size={18} className="text-tertiary" />}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-primary truncate">
            {archivo ? archivo.name : 'Elegir video o imagen'}
          </div>
          <div className="text-[11px] text-tertiary">
            {archivo
              ? `${(archivo.size / 1024 / 1024).toFixed(1)} MB · se publica como ${tipo === 'imagen' ? 'foto' : 'reel'}`
              : 'MP4 vertical de menos de 90 segundos, o JPG/PNG'}
          </div>
        </div>
        {archivo && !trabajando && (
          <button onClick={e => { e.preventDefault(); setArchivo(null); if (input.current) input.current.value = '' }}
            className="text-tertiary hover:text-primary"><X size={15} /></button>
        )}
      </label>

      <textarea value={caption} onChange={e => setCaption(e.target.value)} disabled={trabajando}
        rows={4} placeholder="El copy del post. Si pides un comentario con tu palabra gatillo, la automatización se encarga del resto."
        className="w-full mt-3 px-3 py-2.5 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue resize-none disabled:opacity-50" />

      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-tertiary">{caption.length} caracteres</span>
        <button onClick={publicar} disabled={trabajando || !archivo}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
          {trabajando ? <>{rotulo}</> : <><Send size={14} /> Publicar</>}
        </button>
      </div>

      {fase === 'procesando' && (
        <p className="text-[11px] text-tertiary mt-3">
          Instagram descarga y procesa el archivo por su cuenta. Un reel puede tardar varios
          minutos — no cierres esta pestaña.
        </p>
      )}
    </div>
  )
}
