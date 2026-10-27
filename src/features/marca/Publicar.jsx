import { useState, useRef, useEffect } from 'react'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { Upload, Send, Image as ImageIcon, Film, Images, X, ChevronUp, ChevronDown } from 'lucide-react'
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
 *
 * El carrusel agrega un tiempo más: se crea un contenedor por imagen, se
 * espera a que TODOS terminen, y recién entonces se arma el padre. Publicarlo
 * antes devuelve `invalid_children`, que no dice cuál faltaba.
 */

const ESPERA = 5000        // entre preguntas de estado
const MAX_ESPERA = 300000  // Instagram deja de procesar bastante antes
const MAX_PIEZAS = 10      // el tope del carrusel, puesto por Instagram

export default function Publicar({ orgId, marca }) {
  const [archivos, setArchivos] = useState([])
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

  const limpiar = () => {
    setArchivos([])
    if (input.current) input.current.value = ''
  }

  const elegir = (e) => {
    const elegidos = Array.from(e.target.files || [])
    if (!elegidos.length) return

    if (elegidos.length > MAX_PIEZAS) {
      toast.error(`Un carrusel lleva ${MAX_PIEZAS} imágenes como máximo.`)
      return limpiar()
    }
    /* El carrusel mezclado —fotos y videos juntos— existe en Instagram pero
     * pide otro tipo de contenedor por cada video. Mientras no esté hecho,
     * vale más decirlo que fallar a mitad de la subida. */
    if (elegidos.length > 1 && !elegidos.every(f => f.type.startsWith('image/'))) {
      toast.error('El carrusel solo acepta imágenes. Un video se publica solo, como reel.')
      return limpiar()
    }

    setArchivos(elegidos)
    setTipo(elegidos.length > 1
      ? 'carrusel'
      : (elegidos[0].type.startsWith('image/') ? 'imagen' : 'reel'))
  }

  /* El explorador de archivos entrega los nombres como se le ocurre —casi
   * siempre alfabéticos—, y "portada.png" termina al final. El orden importa:
   * es la primera imagen la que la gente ve en el feed. */
  const mover = (i, hacia) => {
    const j = i + hacia
    if (j < 0 || j >= archivos.length) return
    const copia = [...archivos]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    setArchivos(copia)
  }

  const quitar = (i) => {
    const quedan = archivos.filter((_, n) => n !== i)
    setArchivos(quedan)
    if (!quedan.length) return limpiar()
    if (quedan.length === 1) setTipo(quedan[0].type.startsWith('image/') ? 'imagen' : 'reel')
  }

  /** A Storage, que es de donde Instagram lo va a bajar. */
  const subir = (f, i, total) => {
    const ruta = `organizations/${orgId}/brands/${marca.id}/publicaciones/${Date.now()}-${i}-${f.name}`
    const tarea = uploadBytesResumable(storageRef(storage, ruta), f)
    return new Promise((ok, falla) => {
      tarea.on('state_changed',
        s => {
          const deEste = s.totalBytes ? s.bytesTransferred / s.totalBytes : 0
          setSubiendo(Math.round(((i + deEste) / total) * 100))
        },
        falla,
        async () => ok(await getDownloadURL(tarea.snapshot.ref)))
    })
  }

  /** Espera a que Instagram termine de procesar un contenedor. */
  const esperar = async (contenedorId) => {
    const arranque = Date.now()
    for (;;) {
      if (!vivo.current) throw new Error('Se cerró la pantalla')
      const { estado, detalle } = await llamar('estado', { contenedorId })
      if (estado === 'FINISHED') return
      if (estado === 'ERROR' || estado === 'EXPIRED') {
        throw new Error(detalle || `Instagram rechazó el archivo (${estado}). Suele ser el formato: usa MP4 H.264, vertical, de menos de 90 segundos, o JPG/PNG.`)
      }
      if (Date.now() - arranque > MAX_ESPERA) {
        throw new Error('Instagram lleva demasiado procesándolo. Vuelve a intentarlo con un archivo más ligero.')
      }
      await new Promise(r => setTimeout(r, ESPERA))
    }
  }

  const publicar = async () => {
    if (!archivos.length) return toast.error('Elige el archivo')
    try {
      setFase('subiendo')
      const urls = []
      for (let i = 0; i < archivos.length; i++) urls.push(await subir(archivos[i], i, archivos.length))

      setFase('procesando')
      let contenedorId
      if (tipo === 'carrusel') {
        const { hijos } = await llamar('crear-hijos', { urls })
        // Los N, no el primero: el padre con un hijo a medias no se publica.
        for (const h of hijos) await esperar(h)
        ;({ contenedorId } = await llamar('crear-padre', { hijos, caption }))
      } else {
        ;({ contenedorId } = await llamar('crear', { tipo, url: urls[0], caption }))
      }
      await esperar(contenedorId)

      setFase('publicando')
      await llamar('publicar', { contenedorId, tipo, caption, url: urls[0] })

      toast.success(tipo === 'carrusel' ? 'Carrusel publicado en Instagram' : 'Publicado en Instagram')
      limpiar(); setCaption(''); setSubiendo(0)
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
    procesando: tipo === 'carrusel' ? 'Instagram procesa las imágenes…' : 'Instagram lo está procesando…',
    publicando: 'Publicando…',
  }[fase]

  const Icono = tipo === 'carrusel' ? Images : tipo === 'imagen' ? ImageIcon : Film
  const comoSePublica = { carrusel: `carrusel de ${archivos.length}`, imagen: 'foto', reel: 'reel' }[tipo]
  const pesoTotal = archivos.reduce((s, f) => s + f.size, 0)

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
      <input ref={input} type="file" multiple accept="video/mp4,video/quicktime,image/jpeg,image/png"
        onChange={elegir} disabled={trabajando} className="hidden" id="archivo-publicar" />

      <label htmlFor="archivo-publicar"
        className={clsx('flex items-center gap-3 p-4 rounded-card border border-dashed border-border cursor-pointer hover:border-accent-blue transition-colors',
          trabajando && 'opacity-50 pointer-events-none')}>
        {archivos.length ? <Icono size={18} className="text-accent-blue" /> : <Upload size={18} className="text-tertiary" />}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-primary truncate">
            {archivos.length
              ? (archivos.length > 1 ? `${archivos.length} imágenes` : archivos[0].name)
              : 'Elegir video o imágenes'}
          </div>
          <div className="text-[11px] text-tertiary">
            {archivos.length
              ? `${(pesoTotal / 1024 / 1024).toFixed(1)} MB · se publica como ${comoSePublica}`
              : `Un MP4 vertical de menos de 90 segundos, o hasta ${MAX_PIEZAS} JPG/PNG para un carrusel`}
          </div>
        </div>
        {archivos.length === 1 && !trabajando && (
          <button onClick={e => { e.preventDefault(); limpiar() }}
            className="text-tertiary hover:text-primary"><X size={15} /></button>
        )}
      </label>

      {/* El orden de la lista es el orden del carrusel: el 1 es la portada. */}
      {archivos.length > 1 && (
        <>
          <p className="text-[11px] text-tertiary mt-3 mb-1.5">
            La <b className="text-secondary">1</b> es la que se ve en el feed. Acomoda con las flechas.
          </p>
          <div className="flex flex-col gap-1">
            {archivos.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 px-3 py-1.5 rounded-btn bg-surface-2 border border-border">
                <span className="font-display font-bold text-[11px] text-tertiary w-4 shrink-0">{i + 1}</span>
                <span className="text-[12px] text-secondary truncate flex-1 min-w-0">{f.name}</span>
                {!trabajando && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => mover(i, -1)} disabled={i === 0} title="Subir"
                      className="p-1 rounded text-tertiary hover:text-primary hover:bg-surface disabled:opacity-25 disabled:hover:bg-transparent">
                      <ChevronUp size={14} />
                    </button>
                    <button onClick={() => mover(i, 1)} disabled={i === archivos.length - 1} title="Bajar"
                      className="p-1 rounded text-tertiary hover:text-primary hover:bg-surface disabled:opacity-25 disabled:hover:bg-transparent">
                      <ChevronDown size={14} />
                    </button>
                    <button onClick={() => quitar(i)} title="Quitar"
                      className="p-1 rounded text-tertiary hover:text-primary hover:bg-surface ml-1">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <textarea value={caption} onChange={e => setCaption(e.target.value)} disabled={trabajando}
        rows={4} placeholder="El copy del post. Si pides un comentario con tu palabra gatillo, la automatización se encarga del resto."
        className="w-full mt-3 px-3 py-2.5 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue resize-none disabled:opacity-50" />

      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-tertiary">{caption.length} caracteres</span>
        <button onClick={publicar} disabled={trabajando || !archivos.length}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
          {trabajando ? <>{rotulo}</> : <><Send size={14} /> Publicar</>}
        </button>
      </div>

      {fase === 'procesando' && (
        <p className="text-[11px] text-tertiary mt-3">
          Instagram descarga y procesa cada archivo por su cuenta. Un reel puede tardar varios
          minutos — no cierres esta pestaña.
        </p>
      )}
    </div>
  )
}
