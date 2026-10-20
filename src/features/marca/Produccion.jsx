/* Producción: del crudo al fileteado.
 *
 * Primer paso, el único que hay hoy: subir la grabación y transcribirla con
 * tiempos palabra por palabra. Todo lo que venga después —qué se queda, qué se
 * va— se decide sobre ese texto, nunca sobre el video. Por eso esto es barato
 * y rápido: no procesamos un solo fotograma.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  collection, onSnapshot, query, orderBy, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { segmentosConservados, aXML, aSRT, descargar } from './exportar'
import { analizar } from './audio'
import { decodificar, mezclar, aWav, aTiempoOriginal, aTiempoDeMontaje } from './mezcla'
import Linea, { TIPOS } from './Linea'
import Sonidos from './Sonidos'
import { construir as construirSubtitulos, aSRT as subtitulosASRT } from './subtitulos'
import {
  Upload, Film, RefreshCw, ChevronLeft, FileText,
  AlertTriangle, Trash2, Clock, Scissors, Download, AudioLines, Play, X,
} from 'lucide-react'

const ESTADOS = {
  crudo:         { label: 'Sin transcribir', color: 'text-tertiary',    punto: 'bg-tertiary' },
  transcribiendo:{ label: 'Transcribiendo…', color: 'text-accent-blue', punto: 'bg-accent-blue' },
  transcrita:    { label: 'Transcrita',      color: 'text-accent-green',punto: 'bg-accent-green' },
  fileteada:     { label: 'Fileteada',       color: 'text-accent-green',punto: 'bg-accent-green' },
}

const reloj = (s) => {
  if (typeof s !== 'number') return '—'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function usePiezas(orgId, brandId) {
  const [piezas, setPiezas] = useState([])
  const [cargando, setCargando] = useState(true)
  useEffect(() => {
    if (!orgId || !brandId) { setPiezas([]); setCargando(false); return }
    const q = query(
      collection(db, 'organizations', orgId, 'brands', brandId, 'piezas'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setPiezas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCargando(false)
    }, err => { console.error('[piezas]', err); setCargando(false) })
    return unsub
  }, [orgId, brandId])
  return { piezas, cargando }
}

// ─── FICHA ────────────────────────────────────────────────────────

function FichaDePieza({ pieza, orgId, brandId, onVolver, onBorrar }) {
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const [escuchando, setEscuchando] = useState(false)
  const [panel, setPanel] = useState('transcripcion')
  const videoFileRef = useRef(null)
  const [montando, setMontando] = useState(false)
  const [montaje, setMontaje] = useState(null)   // AudioBuffer del audio ya cortado
  const [sonando, setSonando] = useState(false)
  const [reproduciendo, setReproduciendo] = useState(false)
  const [falloRender, setFalloRender] = useState(null)
  const audioCtxRef = useRef(null)
  const fuenteRef = useRef(null)
  const [segundo, setSegundo] = useState(0)
  const [trabajando, setTrabajando] = useState(null)
  const [saltar, setSaltar] = useState(true)
  const [fps, setFps] = useState(30)
  const [medidas, setMedidas] = useState({ ancho: 1080, alto: 1920 })
  const palabras = pieza.transcripcion?.palabras || []
  const guardados = pieza.fileteado?.cortes || []

  /* Arrastrar un borde dispara decenas de cambios por segundo. Se trabaja
   * sobre una copia local y se guarda cuando la mano se detiene. */
  const [cortes, setCortes] = useState(guardados)
  const porGuardar = useRef(null)
  useEffect(() => { setCortes(guardados) }, [pieza.fileteado?.hechoEn, guardados.length])

  const cambiarCortes = (nuevos) => {
    setCortes(nuevos)
    clearTimeout(porGuardar.current)
    porGuardar.current = setTimeout(() => {
      updateDoc(doc(db, 'organizations', orgId, 'brands', brandId, 'piezas', pieza.id), {
        'fileteado.cortes': nuevos,
        updatedAt: serverTimestamp(),
      }).catch(e => console.error('no se pudieron guardar los cortes', e))
    }, 500)
  }
  useEffect(() => () => clearTimeout(porGuardar.current), [])

  const activos = useMemo(() => cortes.filter(c => c.activo !== false), [cortes])

  // La palabra que suena ahora. Se busca en cada latido: con setecientas
  // palabras es instantáneo y evita guardar estado duplicado.
  const actual = useMemo(() => {
    if (!palabras.length) return -1
    return palabras.findIndex(p => segundo >= p.inicio && segundo < p.fin)
  }, [palabras, segundo])

  // Qué palabras caen dentro de un corte, y qué pausas van entre cuáles.
  const { cortadas, pausas } = useMemo(() => {
    const cortadas = new Map()
    const pausas = new Map()
    for (const c of cortes) {
      if (c.tipo === 'silencio') { pausas.set(c.hastaPalabra, c); continue }
      for (let i = c.desdePalabra; i <= c.hastaPalabra; i++) cortadas.set(i, c)
    }
    return { cortadas, pausas }
  }, [cortes])

  const llamar = async (ruta, etiqueta) => {
    setTrabajando(etiqueta)
    try {
      const res = await fetch(`/.netlify/functions/${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, brandId, piezaId: pieza.id }),
      })
      const r = await res.json()
      if (!res.ok || !r.ok) throw new Error(r.detalle || r.error || 'No se pudo')
      return r
    } catch (e) {
      toast.error(e.message)
      return null
    } finally {
      setTrabajando(null)
    }
  }

  const transcribir = async () => {
    const r = await llamar('transcribe', 'transcribir')
    if (r) toast.success(`${r.palabras} palabras`)
  }

  const filetear = async () => {
    const r = await llamar('filetear', 'filetear')
    if (!r) return
    toast.success(`${r.cortes} cortes · quedan ${reloj(r.duracionFinal)}`)
    // Si no hubo dónde cortar limpio, mejor decirlo que dejar al usuario
    // preguntándose por qué sigue ahí una muletilla obvia.
    if (r.sinSitio) {
      toast(`${r.sinSitio} ${r.sinSitio === 1 ? 'muletilla iba' : 'muletillas iban'} pegadas al habla: se dejaron para no partir palabras`)
    }
  }

  // Rescatar o volver a quitar un tramo. Se guarda al momento: es la decisión
  // de la persona sobre la propuesta de la máquina, y eso no se pierde.
  const alternar = (corte) => {
    cambiarCortes(cortes.map(c => (c.id === corte.id ? { ...c, activo: c.activo === false } : c)))
  }

  const duracionReal = pieza.video?.duracion || palabras[palabras.length - 1]?.fin || 0
  const base = (pieza.titulo || 'pieza').replace(/[^\w\-]+/g, '-').toLowerCase()

  const bajarXML = () => {
    const segmentos = segmentosConservados(cortes, duracionReal)
    if (!segmentos.length) { toast.error('No queda nada que exportar'); return }
    descargar(aXML({
      segmentos,
      nombre: pieza.titulo || 'Pieza',
      archivo: pieza.video?.nombre || 'video.mp4',
      fps, ancho: medidas.ancho, alto: medidas.alto,
      duracionTotal: duracionReal,
    }), `${base}.xml`, 'application/xml')
  }

  const bajarSRT = () => {
    if (subtitulos.length) { descargar(subtitulosASRT(subtitulos), `${base}.srt`); return }
    if (!palabras.length) { toast.error('Hace falta la transcripción'); return }
    descargar(aSRT({ palabras, cortes, duracion: duracionReal }), `${base}.srt`)
  }

  /* Para las piezas que se subieron antes de que existiera el oído. No hace
   * falta volver a subir el video: basta con señalar el mismo archivo del
   * disco, se escucha aquí y se guarda el resultado. */
  const escuchar = async (file) => {
    if (!file) return
    setEscuchando(true)
    try {
      const audio = await analizar(file)
      await updateDoc(doc(db, 'organizations', orgId, 'brands', brandId, 'piezas', pieza.id), {
        audio,
        'video.duracion': audio.duracion,
        updatedAt: serverTimestamp(),
      })
      toast.success(`${audio.silencios.length} silencios encontrados`)
    } catch (e) {
      console.error(e)
      toast.error('No se pudo leer el audio de ese archivo')
    } finally {
      setEscuchando(false)
    }
  }

  /* Monta el audio del video ya cortado, en un solo trozo y con fundido en
   * cada empalme. Esto es lo que mata el chasquido: la vista previa saltaba
   * sobre el archivo original y cada salto era un corte a cuchillo.
   *
   * Se hace fuera de tiempo real: cuatro minutos tardan un par de segundos. */
  const montar = async (file) => {
    if (!file) return
    const segmentos = segmentosConservados(cortes, duracionReal)
    if (!segmentos.length) { toast.error('No queda nada que montar'); return }
    setMontando(true)
    setFalloRender(null)
    try {
      const crudo = await decodificar(file)
      const mezcla = await mezclar(crudo, segmentos)
      setMontaje(mezcla)
      toast.success(`Audio montado · ${reloj(mezcla.duration)}`)
    } catch (e) {
      console.error(e)
      setFalloRender(e.message || 'No se pudo montar el audio')
    } finally {
      setMontando(false)
    }
  }

  /* Reproduce el montaje: el audio va de corrido desde la mezcla y el video
   * lo sigue, saltando solo en los cortes. El reloj manda es el del audio,
   * que es el único preciso. */
  const oir = () => {
    if (!montaje || !videoRef.current) return
    pararMontaje()
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx
    const fuente = ctx.createBufferSource()
    fuente.buffer = montaje
    fuente.connect(ctx.destination)
    fuenteRef.current = fuente

    const segmentos = segmentosConservados(cortes, duracionReal)
    const v = videoRef.current
    v.muted = true
    const t0 = ctx.currentTime + 0.1
    fuente.start(t0)
    v.play()
    setSonando(true)

    let pedido
    const seguir = () => {
      if (!fuenteRef.current) return
      pedido = requestAnimationFrame(seguir)
      const t = ctx.currentTime - t0
      if (t < 0) return
      const destino = aTiempoOriginal(segmentos, t)
      if (Math.abs(v.currentTime - destino) > 0.08) v.currentTime = destino
      setSegundo(destino)
    }
    pedido = requestAnimationFrame(seguir)
    fuente.onended = () => { cancelAnimationFrame(pedido); pararMontaje() }
  }

  const pararMontaje = () => {
    try { fuenteRef.current?.stop() } catch { /* ya estaba parada */ }
    fuenteRef.current = null
    try { audioCtxRef.current?.close() } catch { /* ok */ }
    audioCtxRef.current = null
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.muted = false }
    setSonando(false)
  }

  useEffect(() => pararMontaje, [])

  /* Los sonidos se guardan con el segundo donde van, no pegados a nada: la
   * línea de tiempo los dibujará como una capa aparte y se podrán mover. */
  const agregarSonido = async (s) => {
    const puesto = {
      id: `s${Date.now()}`,
      fuente: 'freesound',
      idExterno: s.id,
      nombre: s.nombre,
      autor: s.autor,
      url: s.audio,
      duracion: s.duracion ?? null,
      en: Math.max(0, segundo),
    }
    const nuevos = [...(pieza.sonidos || []), puesto]
    await updateDoc(doc(db, 'organizations', orgId, 'brands', brandId, 'piezas', pieza.id), {
      sonidos: nuevos,
      updatedAt: serverTimestamp(),
    })
    toast.success(`"${s.nombre}" en ${reloj(puesto.en)}`)
  }

  const quitarSonido = async (id) => {
    await updateDoc(doc(db, 'organizations', orgId, 'brands', brandId, 'piezas', pieza.id), {
      sonidos: (pieza.sonidos || []).filter(x => x.id !== id),
      updatedAt: serverTimestamp(),
    })
  }

  /* Arrastrar un sonido por la capa dispara muchos cambios seguidos, igual
   * que mover el borde de un corte: copia local y se guarda al soltar. */
  const [sonidosLocales, setSonidosLocales] = useState(pieza.sonidos || [])
  const sonidosPorGuardar = useRef(null)
  useEffect(() => { setSonidosLocales(pieza.sonidos || []) }, [(pieza.sonidos || []).length])

  const cambiarSonidos = (nuevos) => {
    setSonidosLocales(nuevos)
    clearTimeout(sonidosPorGuardar.current)
    sonidosPorGuardar.current = setTimeout(() => {
      updateDoc(doc(db, 'organizations', orgId, 'brands', brandId, 'piezas', pieza.id), {
        sonidos: nuevos,
        updatedAt: serverTimestamp(),
      }).catch(e => console.error('no se pudieron guardar los sonidos', e))
    }, 500)
  }
  useEffect(() => () => clearTimeout(sonidosPorGuardar.current), [])

  /* Los subtítulos se guardan, no se recalculan cada vez: en cuanto corriges
   * una palabra mal oída, esa corrección es tuya y no puede perderse porque
   * alguien mueva un corte. Se regeneran solo cuando tú lo pides. */
  const subtitulos = pieza.subtitulos || []

  const generarSubtitulos = async () => {
    const nuevos = construirSubtitulos(palabras, cortes, duracionReal)
    if (!nuevos.length) { toast.error('No hay texto para subtitular'); return }
    await updateDoc(doc(db, 'organizations', orgId, 'brands', brandId, 'piezas', pieza.id), {
      subtitulos: nuevos,
      updatedAt: serverTimestamp(),
    })
    toast.success(`${nuevos.length} subtítulos`)
  }

  const corregirSubtitulo = async (id, texto) => {
    await updateDoc(doc(db, 'organizations', orgId, 'brands', brandId, 'piezas', pieza.id), {
      subtitulos: subtitulos.map(t => (t.id === id ? { ...t, texto } : t)),
      updatedAt: serverTimestamp(),
    })
  }

  /* La línea de tiempo es la del material crudo: ahí están los cortes y por
   * eso se pueden mover. Los subtítulos viven en los tiempos del montaje, que
   * es otro reloj — hay que traducirlos o se apelotonan al principio y no
   * cuadran con la onda. */
  const subtitulosEnCrudo = useMemo(() => {
    if (!subtitulos.length) return []
    const segmentos = segmentosConservados(cortes, duracionReal)
    return subtitulos.map(t => ({
      ...t,
      desde: aTiempoOriginal(segmentos, t.desde),
      hasta: aTiempoOriginal(segmentos, t.hasta),
    }))
  }, [subtitulos, cortes, duracionReal])

  /* El subtítulo que toca ahora mismo, para enseñarlo encima del video. Sin
   * esto no había forma de verlos: estaban en una lista y en una capa, pero
   * nunca sobre la imagen, que es donde van a salir de verdad. */
  const subtituloAhora = useMemo(() => {
    if (!subtitulos.length) return null
    const segmentos = segmentosConservados(cortes, duracionReal)
    const t = aTiempoDeMontaje(segmentos, segundo)
    return subtitulos.find(x => t >= x.desde && t <= x.hasta) || null
  }, [subtitulos, cortes, duracionReal, segundo])

  const bajarWav = () => {
    if (!montaje) return
    const url = URL.createObjectURL(aWav(montaje))
    const a = document.createElement('a')
    a.href = url; a.download = `${base}.wav`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const irA = (s) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(0, s)
    setSegundo(s)
  }

  const alternarPlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  /* La vista previa no renderiza nada: el reproductor salta los tramos
   * cortados sobre el archivo original.
   *
   * Va por cuadro de pantalla y no por el evento de tiempo del video, que
   * solo llega cuatro veces por segundo: con ese se colaba hasta un cuarto de
   * segundo de lo que debería estar cortado, y la previa sonaba peor de lo
   * que realmente queda. */
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let pedido
    const mirar = () => {
      pedido = requestAnimationFrame(mirar)
      const t = v.currentTime
      if (saltar && !v.paused) {
        const dentro = activos.find(c => t >= c.inicio && t < c.fin - 0.02)
        if (dentro) { v.currentTime = dentro.fin; return }
      }
      setSegundo(t)
    }
    pedido = requestAnimationFrame(mirar)
    return () => cancelAnimationFrame(pedido)
  }, [saltar, activos, pieza.video?.url])

  const estado = ESTADOS[pieza.estado] || ESTADOS.crudo
  const f = pieza.fileteado

  return (
    <div className="flex flex-col gap-3">
      {/* Cabecera: volver, qué es esto, y los dos pasos del proceso */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onVolver} className="flex items-center gap-1 text-[13px] text-tertiary hover:text-primary">
          <ChevronLeft size={15} /> Todas las piezas
        </button>
        <span className="font-display font-bold text-[15px] text-primary truncate max-w-[280px]">
          {pieza.titulo}
        </span>
        <span className={clsx('flex items-center gap-1.5 text-[12px] font-semibold', estado.color)}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', estado.punto)} /> {estado.label}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {!pieza.audio && (
            <>
              <input ref={audioRef} type="file" accept="video/*,audio/*" hidden
                onChange={e => { escuchar(e.target.files?.[0]); e.target.value = '' }} />
              <button onClick={() => audioRef.current?.click()} disabled={escuchando}
                title="Esta pieza se subió sin análisis de sonido: señala el mismo archivo del disco"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-surface-2 border border-border text-[12px] font-bold text-secondary hover:text-primary disabled:opacity-50">
                {escuchando ? <RefreshCw size={13} className="animate-spin" /> : <AudioLines size={13} />}
                {escuchando ? 'Escuchando…' : 'Escuchar el audio'}
              </button>
            </>
          )}

          {!palabras.length ? (
            <button onClick={transcribir} disabled={!!trabajando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-accent-blue text-white text-[12px] font-bold disabled:opacity-50">
              {trabajando === 'transcribir' ? <RefreshCw size={13} className="animate-spin" /> : <FileText size={13} />}
              {trabajando === 'transcribir' ? 'Transcribiendo…' : 'Transcribir'}
            </button>
          ) : (
            <button onClick={filetear} disabled={!!trabajando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-accent-blue text-white text-[12px] font-bold disabled:opacity-50">
              {trabajando === 'filetear' ? <RefreshCw size={13} className="animate-spin" /> : <Scissors size={13} />}
              {trabajando === 'filetear' ? 'Fileteando…' : f ? 'Filetear de nuevo' : 'Filetear'}
            </button>
          )}

          <button onClick={onBorrar} title="Eliminar la pieza"
            className="w-8 h-8 rounded-btn flex items-center justify-center text-tertiary hover:text-accent-red hover:bg-surface-2">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {pieza.error && (
        <div className="flex items-start gap-2 text-[12px] text-accent-amber">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {pieza.error}
        </div>
      )}

      {/* Visor y herramientas, uno al lado del otro: editar es mirar y tocar
          al mismo tiempo, no bajar la página a buscar el botón. */}
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)] items-start">
        <div className="bg-surface border border-border rounded-card shadow-card p-2">
          {pieza.video?.url ? (
            <div className="relative">
              <video
                ref={videoRef}
                src={pieza.video.url}
                controls
                onLoadedMetadata={e => setMedidas({ ancho: e.target.videoWidth, alto: e.target.videoHeight })}
                onPlay={() => setReproduciendo(true)}
                onPause={() => setReproduciendo(false)}
                className="w-full rounded-btn bg-black"
              />
              {subtituloAhora && (
                <div className="absolute inset-x-2 bottom-12 pointer-events-none text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-black/70 text-white
                                   text-[13px] font-bold leading-snug"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                    {subtituloAhora.texto}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full aspect-[9/16] rounded-btn bg-surface-2 border border-border flex items-center justify-center text-[12px] text-tertiary text-center px-3">
              La subida del video no terminó
            </div>
          )}

          <div className="flex items-center gap-2 px-1 pt-2 text-[11px] text-tertiary">
            {pieza.audio && <span className="flex items-center gap-1"><AudioLines size={11} /> {pieza.audio.silencios?.length || 0} silencios</span>}
            {pieza.video?.duracion && <span className="ml-auto flex items-center gap-1"><Clock size={11} /> {reloj(pieza.video.duracion)}</span>}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card shadow-card">
          <div className="flex items-center gap-1 px-3 pt-2 border-b border-border">
            {[
              { id: 'transcripcion', label: 'Transcripción' },
              { id: 'sonidos', label: 'Sonidos' },
              { id: 'subtitulos', label: 'Subtítulos' },
              { id: 'montaje', label: 'Montaje' },
            ].map(t => (
              <button key={t.id} onClick={() => setPanel(t.id)}
                className={clsx('px-3 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors',
                  panel === t.id ? 'border-accent-blue text-primary' : 'border-transparent text-tertiary hover:text-secondary')}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-3 max-h-[420px] overflow-y-auto">
            {panel === 'transcripcion' && (
              !palabras.length ? (
                <p className="text-[13px] text-tertiary">
                  Todavía no hay texto. Dale a Transcribir y aparece aquí, con cada palabra
                  pegada a su segundo del video.
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-tertiary mb-2">
                    {palabras.length} palabras · clic en una palabra para saltar ahí
                    {cortes.length > 0 && ' · clic en lo tachado para rescatarlo'}
                  </p>
                  <div className="leading-[2.1]">
                    {palabras.map((p, i) => {
                      const pausa = pausas.get(i)
                      const corte = cortadas.get(i)
                      const fuera = corte && corte.activo !== false
                      return (
                        <span key={i}>
                          {pausa && (
                            <span
                              onClick={() => alternar(pausa)}
                              title={`${pausa.motivo} — clic para ${pausa.activo === false ? 'quitarla' : 'conservarla'}`}
                              className={clsx('inline-block mx-0.5 px-1 rounded text-[10px] font-bold cursor-pointer align-middle',
                                pausa.activo === false
                                  ? 'bg-surface-2 text-tertiary line-through'
                                  : 'bg-accent-amber/20 text-accent-amber')}
                            >
                              {(pausa.fin - pausa.inicio).toFixed(1)}s
                            </span>
                          )}
                          <span
                            onClick={() => (corte ? alternar(corte) : irA(p.inicio))}
                            title={corte ? `${TIPOS[corte.tipo]?.nombre}: ${corte.motivo}` : undefined}
                            className={clsx('cursor-pointer rounded px-0.5 text-[14px] transition-colors',
                              i === actual && !fuera
                                ? 'bg-accent-blue text-white'
                                : fuera
                                  ? 'text-tertiary line-through decoration-accent-red/60'
                                  : corte
                                    ? 'text-secondary bg-surface-2'
                                    : 'text-primary hover:bg-surface-2')}
                          >
                            {p.texto}{' '}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </>
              )
            )}

            {panel === 'sonidos' && (
              <>
                {!!sonidosLocales.length && (
                  <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-border">
                    {sonidosLocales.map(s => (
                      <span key={s.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-btn bg-surface-2 border border-border text-[11px]">
                        <button onClick={() => irA(s.en)} className="font-semibold text-primary hover:text-accent-blue">
                          {s.nombre}
                        </button>
                        <span className="text-tertiary">{reloj(s.en)}</span>
                        <button onClick={() => quitarSonido(s.id)} className="text-tertiary hover:text-accent-red">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Sonidos onAgregar={agregarSonido} enSegundo={segundo} />
              </>
            )}

            {panel === 'subtitulos' && (
              !palabras.length ? (
                <p className="text-[13px] text-tertiary">Primero hay que transcribir.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-[11px] text-tertiary">
                      {subtitulos.length
                        ? `${subtitulos.length} líneas · corrige el texto si oyó mal`
                        : 'Se arman solos desde la transcripción, ya con los cortes aplicados.'}
                    </p>
                    <button onClick={generarSubtitulos}
                      className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn bg-surface-2 border border-border text-[12px] font-bold text-secondary hover:text-primary">
                      <RefreshCw size={12} /> {subtitulos.length ? 'Rehacer' : 'Generar'}
                    </button>
                  </div>

                  {subtitulos.length > 0 && (
                    <div className="space-y-1">
                      {subtitulos.map(t => (
                        <div key={t.id} className="flex items-start gap-2">
                          <button onClick={() => irA(t.desde)}
                            className="shrink-0 w-11 pt-1 text-[11px] text-tertiary hover:text-accent-blue tabular-nums text-right">
                            {reloj(t.desde)}
                          </button>
                          <input
                            defaultValue={t.texto}
                            onBlur={e => { if (e.target.value !== t.texto) corregirSubtitulo(t.id, e.target.value) }}
                            className="flex-1 px-2 py-1 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            )}

            {panel === 'montaje' && (
              !f ? (
                <p className="text-[13px] text-tertiary">
                  Primero hay que filetear. El montaje es el video ya cortado.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display font-bold text-[20px] text-primary">{reloj(f.duracionOriginal)}</span>
                      <span className="text-tertiary">→</span>
                      <span className="font-display font-bold text-[20px] text-accent-green">
                        {reloj(f.duracionOriginal - activos.reduce((a, c) => a + (c.fin - c.inicio), 0))}
                      </span>
                    </div>
                    <p className="text-[11px] text-tertiary mt-0.5">
                      {activos.length} de {cortes.length} cortes activos
                    </p>
                    {f.resumen && <p className="text-[12px] text-secondary mt-1.5 leading-snug">{f.resumen}</p>}
                  </div>

                  <input ref={videoFileRef} type="file" accept="video/*" hidden
                    onChange={e => { montar(e.target.files?.[0]); e.target.value = '' }} />

                  {!montaje ? (
                    <button onClick={() => videoFileRef.current?.click()} disabled={montando}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
                      {montando ? <RefreshCw size={14} className="animate-spin" /> : <AudioLines size={14} />}
                      {montando ? 'Montando el audio…' : 'Montar el audio'}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={sonando ? pararMontaje : oir}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-btn bg-accent-blue text-white text-[13px] font-bold">
                        <Play size={14} /> {sonando ? 'Parar' : 'Oír el montaje'}
                      </button>
                      <button onClick={bajarWav} title="Descargar el audio del montaje"
                        className="px-3 rounded-btn bg-surface-2 border border-border text-[12px] font-bold text-secondary hover:text-primary">
                        <Download size={13} />
                      </button>
                    </div>
                  )}

                  {falloRender && (
                    <div className="p-2.5 rounded-btn bg-accent-red/10 border border-accent-red/30">
                      <div className="flex items-start gap-1.5 text-[11px] text-accent-red leading-snug">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span className="break-words">{falloRender}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary">Llevar a Premiere</span>
                      <select value={fps} onChange={e => setFps(Number(e.target.value))}
                        title="Los cuadros por segundo de tu material. Si los cortes salen corridos, es esto."
                        className="ml-auto px-2 py-1 rounded-btn bg-surface-2 border border-border text-[11px] text-secondary outline-none">
                        {[24, 25, 30, 50, 60].map(v => <option key={v} value={v}>{v} fps</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={bajarXML}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-btn bg-surface-2 border border-border text-[12px] font-bold text-secondary hover:text-primary">
                        <Download size={13} /> Secuencia
                      </button>
                      <button onClick={bajarSRT}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-btn bg-surface-2 border border-border text-[12px] font-bold text-secondary hover:text-primary">
                        <Download size={13} /> Subtítulos
                      </button>
                    </div>
                    <p className="text-[11px] text-tertiary mt-2 leading-snug">
                      El audio del montaje lleva un fundido en cada empalme. Bájalo y ponlo sobre
                      la secuencia, silenciando la pista original.
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* La línea de tiempo, abajo y a todo lo ancho */}
      {palabras.length > 0 && (
        <Linea
          duracion={duracionReal}
          audio={pieza.audio}
          palabras={palabras}
          cortes={cortes}
          sonidos={sonidosLocales}
          subtitulos={subtitulosEnCrudo}
          segundo={segundo}
          onCambiarSonidos={cambiarSonidos}
          onCambiar={cambiarCortes}
          onIr={irA}
          onPlay={alternarPlay}
          sonando={reproduciendo}
          saltando={saltar}
          onSaltar={setSaltar}
        />
      )}
    </div>
  )
}

// ─── PANTALLA ─────────────────────────────────────────────────────
export default function Produccion({ marcas }) {
  const { org } = useAuthStore()
  const orgId = org?.id
  const [marcaId, setMarcaId] = useState(marcas?.[0]?.id || '')
  const { piezas, cargando } = usePiezas(orgId, marcaId)
  const [abierta, setAbierta] = useState(null)
  const [subiendo, setSubiendo] = useState(0)
  const [analizando, setAnalizando] = useState(false)
  const archivoRef = useRef(null)

  useEffect(() => {
    if (!marcaId && marcas?.length) setMarcaId(marcas[0].id)
  }, [marcas, marcaId])

  const subir = async (file) => {
    if (!file || !orgId || !marcaId) return
    if (!file.type.startsWith('video/')) { toast.error('Tiene que ser un video'); return }

    // El documento nace antes que el archivo para tener un sitio donde
    // guardarlo y para que la pieza aparezca en la lista mientras sube.
    const docRef = await addDoc(collection(db, 'organizations', orgId, 'brands', marcaId, 'piezas'), {
      titulo: file.name.replace(/\.[^.]+$/, ''),
      estado: 'crudo',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Se escucha el audio aquí, con el archivo todavía en la mano. Después
    // habría que volver a bajarlo y pelearse con los permisos de origen
    // cruzado; ahora es gratis.
    let audio = null
    try {
      setAnalizando(true)
      audio = await analizar(file)
    } catch (err) {
      console.warn('no se pudo analizar el audio:', err)
      toast('No se pudo escuchar el audio; el fileteado irá solo con el texto')
    } finally {
      setAnalizando(false)
    }

    const ruta = `organizations/${orgId}/brands/${marcaId}/piezas/${docRef.id}/${file.name}`
    const tarea = uploadBytesResumable(storageRef(storage, ruta), file)
    setSubiendo(1)

    tarea.on('state_changed',
      s => setSubiendo(Math.max(1, Math.round((s.bytesTransferred / s.totalBytes) * 100))),
      async (err) => {
        console.error(err)
        setSubiendo(0)
        await deleteDoc(docRef).catch(() => {})
        toast.error('No se pudo subir el video')
      },
      async () => {
        const url = await getDownloadURL(tarea.snapshot.ref)
        await updateDoc(docRef, {
          video: { url, ruta, nombre: file.name, peso: file.size, duracion: audio?.duracion ?? null },
          ...(audio ? { audio } : {}),
          updatedAt: serverTimestamp(),
        })
        setSubiendo(0)
        toast.success('Video subido')
        setAbierta(docRef.id)
      }
    )
  }

  const borrar = async (pieza) => {
    if (!window.confirm(`¿Eliminar "${pieza.titulo}"? Se borra también el video.`)) return
    if (pieza.video?.ruta) {
      await deleteObject(storageRef(storage, pieza.video.ruta)).catch(() => {})
    }
    await deleteDoc(doc(db, 'organizations', orgId, 'brands', marcaId, 'piezas', pieza.id))
    setAbierta(null)
    toast.success('Pieza eliminada')
  }

  const piezaAbierta = piezas.find(p => p.id === abierta) || null

  if (!marcas?.length) {
    return (
      <div className="bg-surface border border-border rounded-card shadow-card p-10 text-center">
        <Film size={26} className="text-tertiary mx-auto mb-3" />
        <p className="text-[13px] text-tertiary">Crea una marca antes de subir grabaciones.</p>
      </div>
    )
  }

  if (piezaAbierta) {
    return (
      <FichaDePieza
        pieza={piezaAbierta} orgId={orgId} brandId={marcaId}
        onVolver={() => setAbierta(null)}
        onBorrar={() => borrar(piezaAbierta)}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {marcas.length > 1 && (
          <select value={marcaId} onChange={e => { setMarcaId(e.target.value); setAbierta(null) }}
            className="px-2.5 py-1.5 rounded-btn bg-surface-2 border border-border text-[12px] text-secondary outline-none">
            {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        )}
        <input ref={archivoRef} type="file" accept="video/*" hidden
          onChange={e => { subir(e.target.files?.[0]); e.target.value = '' }} />
        <button onClick={() => archivoRef.current?.click()} disabled={subiendo > 0 || analizando}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
          <Upload size={15} /> {analizando ? 'Escuchando…' : subiendo > 0 ? `Subiendo ${subiendo}%` : 'Subir grabación'}
        </button>
      </div>

      {cargando ? (
        <p className="text-[13px] text-tertiary">Cargando piezas…</p>
      ) : piezas.length === 0 ? (
        <div className="bg-surface border border-border rounded-card shadow-card p-10 text-center">
          <Film size={26} className="text-tertiary mx-auto mb-3" />
          <h2 className="font-display font-bold text-[15px] text-primary mb-1">Sin grabaciones</h2>
          <p className="text-[13px] text-tertiary max-w-[440px] mx-auto">
            Sube el video en crudo tal como salió de la cámara. Lo transcribimos con
            cada palabra pegada a su segundo, y sobre ese texto se harán los cortes.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {piezas.map(p => {
            const estado = ESTADOS[p.estado] || ESTADOS.crudo
            return (
              <button key={p.id} onClick={() => setAbierta(p.id)}
                className="text-left bg-surface border border-border rounded-card p-4 shadow-card hover:shadow-card-md transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <Film size={15} className="text-tertiary shrink-0" />
                  <span className="font-display font-bold text-[14px] text-primary truncate">{p.titulo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', estado.punto)} />
                  <span className={clsx('text-[11px] font-semibold', estado.color)}>{estado.label}</span>
                  {p.video?.duracion && (
                    <span className="ml-auto text-[11px] text-tertiary">{reloj(p.video.duracion)}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
