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
import {
  Upload, Film, RefreshCw, ChevronLeft, FileText,
  AlertTriangle, Trash2, Clock, Scissors, Download,
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
const TIPOS = {
  silencio:   { label: 'Pausa',       color: '#6e6e73' },
  muletilla:  { label: 'Muletilla',   color: '#f59e0b' },
  repeticion: { label: 'Repetida',    color: '#7c3aed' },
  arranque:   { label: 'Arranque',    color: '#00b8d9' },
  divagacion: { label: 'Divagación',  color: '#ff3b30' },
}

function FichaDePieza({ pieza, orgId, brandId, onVolver, onBorrar }) {
  const videoRef = useRef(null)
  const [segundo, setSegundo] = useState(0)
  const [trabajando, setTrabajando] = useState(null)
  const [saltar, setSaltar] = useState(true)
  const [fps, setFps] = useState(30)
  const [medidas, setMedidas] = useState({ ancho: 1080, alto: 1920 })
  const palabras = pieza.transcripcion?.palabras || []
  const cortes = pieza.fileteado?.cortes || []

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
    if (r) toast.success(`${r.cortes} cortes · quedan ${reloj(r.duracionFinal)}`)
  }

  // Rescatar o volver a quitar un tramo. Se guarda al momento: es la decisión
  // de la persona sobre la propuesta de la máquina, y eso no se pierde.
  const alternar = async (corte) => {
    const nuevos = cortes.map(c => (c.id === corte.id ? { ...c, activo: c.activo === false } : c))
    await updateDoc(doc(db, 'organizations', orgId, 'brands', brandId, 'piezas', pieza.id), {
      'fileteado.cortes': nuevos,
      updatedAt: serverTimestamp(),
    })
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
    if (!palabras.length) { toast.error('Hace falta la transcripción'); return }
    descargar(aSRT({ palabras, cortes, duracion: duracionReal }), `${base}.srt`)
  }

  const irA = (s) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(0, s - 0.05)
    videoRef.current.play()
  }

  // La vista previa no renderiza nada: el reproductor salta los tramos
  // cortados sobre el archivo original.
  const latido = (e) => {
    const t = e.target.currentTime
    if (saltar) {
      const dentro = activos.find(c => t >= c.inicio && t < c.fin - 0.05)
      if (dentro) { e.target.currentTime = dentro.fin; return }
    }
    setSegundo(t)
  }

  const estado = ESTADOS[pieza.estado] || ESTADOS.crudo
  const f = pieza.fileteado

  return (
    <div>
      <button onClick={onVolver} className="flex items-center gap-1 text-[13px] text-tertiary hover:text-primary mb-4">
        <ChevronLeft size={15} /> Todas las piezas
      </button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
        {/* Video */}
        <div className="bg-surface border border-border rounded-card shadow-card p-4">
          {pieza.video?.url ? (
            <video
              ref={videoRef}
              src={pieza.video.url}
              controls
              onTimeUpdate={latido}
              onLoadedMetadata={e => setMedidas({ ancho: e.target.videoWidth, alto: e.target.videoHeight })}
              className="w-full rounded-btn bg-black"
            />
          ) : (
            <div className="w-full aspect-video rounded-btn bg-surface-2 border border-border flex items-center justify-center text-[12px] text-tertiary">
              La subida del video no terminó
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <span className={clsx('w-1.5 h-1.5 rounded-full', estado.punto)} />
            <span className={clsx('text-[12px] font-semibold', estado.color)}>{estado.label}</span>
            {pieza.video?.duracion && (
              <span className="ml-auto flex items-center gap-1 text-[12px] text-tertiary">
                <Clock size={12} /> {reloj(pieza.video.duracion)}
              </span>
            )}
          </div>

          {f && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-baseline gap-2">
                <span className="font-display font-bold text-[18px] text-primary">{reloj(f.duracionOriginal)}</span>
                <span className="text-tertiary">→</span>
                <span className="font-display font-bold text-[18px] text-accent-green">
                  {reloj(f.duracionOriginal - activos.reduce((a, c) => a + (c.fin - c.inicio), 0))}
                </span>
              </div>
              <p className="text-[11px] text-tertiary mt-0.5">
                {activos.length} de {cortes.length} cortes activos
              </p>
              {f.resumen && <p className="text-[12px] text-secondary mt-2 leading-snug">{f.resumen}</p>}

              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input type="checkbox" checked={saltar} onChange={e => setSaltar(e.target.checked)} />
                <span className="text-[12px] text-secondary">Saltar los cortes al reproducir</span>
              </label>

              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary">Exportar</span>
                  <select value={fps} onChange={e => setFps(Number(e.target.value))}
                    title="Los cuadros por segundo de tu material. Si los cortes salen corridos, es esto."
                    className="ml-auto px-2 py-1 rounded-btn bg-surface-2 border border-border text-[11px] text-secondary outline-none">
                    {[24, 25, 30, 50, 60].map(v => <option key={v} value={v}>{v} fps</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={bajarXML}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-btn bg-surface-2 border border-border text-[12px] font-bold text-secondary hover:text-primary">
                    <Download size={13} /> Premiere
                  </button>
                  <button onClick={bajarSRT}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-btn bg-surface-2 border border-border text-[12px] font-bold text-secondary hover:text-primary">
                    <Download size={13} /> Subtítulos
                  </button>
                </div>
                <p className="text-[11px] text-tertiary mt-2 leading-snug">
                  Premiere va a pedirte dónde está el video: señálale el archivo original
                  de tu disco una vez y la secuencia queda armada.
                </p>
              </div>
            </div>
          )}

          {pieza.error && (
            <div className="flex items-start gap-2 mt-3 text-[12px] text-accent-amber">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {pieza.error}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            {!palabras.length ? (
              <button onClick={transcribir} disabled={!!trabajando}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
                {trabajando === 'transcribir' ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                {trabajando === 'transcribir' ? 'Transcribiendo…' : 'Transcribir'}
              </button>
            ) : (
              <button onClick={filetear} disabled={!!trabajando}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
                {trabajando === 'filetear' ? <RefreshCw size={14} className="animate-spin" /> : <Scissors size={14} />}
                {trabajando === 'filetear' ? 'Fileteando…' : f ? 'Filetear de nuevo' : 'Filetear'}
              </button>
            )}
            <button onClick={onBorrar} title="Eliminar la pieza"
              className="w-9 h-9 rounded-btn flex items-center justify-center text-tertiary hover:text-accent-red hover:bg-surface-2">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Transcripción */}
        <div className="bg-surface border border-border rounded-card shadow-card p-4">
          <h2 className="font-display font-bold text-[14px] text-primary mb-1">Transcripción</h2>
          {!palabras.length ? (
            <p className="text-[13px] text-tertiary mt-2">
              Todavía no hay texto. Dale a Transcribir y aparece aquí, con cada palabra
              pegada a su segundo del video.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-tertiary mb-2">
                {palabras.length} palabras · clic en una palabra para saltar ahí
                {cortes.length > 0 && ' · clic en lo tachado para rescatarlo'}
              </p>
              <div className="max-h-[520px] overflow-y-auto pr-1 leading-[2.1]">
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
                        title={corte ? `${TIPOS[corte.tipo]?.label}: ${corte.motivo}` : undefined}
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
          )}
        </div>
      </div>
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
          video: { url, ruta, nombre: file.name, peso: file.size },
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
        <button onClick={() => archivoRef.current?.click()} disabled={subiendo > 0}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
          <Upload size={15} /> {subiendo > 0 ? `Subiendo ${subiendo}%` : 'Subir grabación'}
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
