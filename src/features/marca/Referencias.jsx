/* Biblioteca de referencias: videos ajenos que valen la pena emular.
 *
 * La técnica es emular lo que ya funcionó, así que primero hay que encontrar
 * qué funcionó. Instagram no deja buscar publicaciones de otros por su API, ni
 * por la oficial ni por la del proveedor: lo que sí deja es buscar CUENTAS por
 * tema y después mirar sus reels. Por eso el flujo es de dos pasos, y acaba
 * pareciéndose a como trabaja quien de verdad sabe: no persigue videos
 * sueltos, sigue a gente.
 */
import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy, limit, deleteDoc, doc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  Search, RefreshCw, Eye, Heart, MessageCircle, Clock, ExternalLink,
  Hash, AtSign, Link2, Trash2, BadgeCheck, Music, Eraser,
} from 'lucide-react'

const MODOS = [
  { id: 'tema',    label: 'Por tema',    Icon: Hash,  marcador: 'dentistas, finanzas personales…' },
  { id: 'creador', label: 'Por cuenta',  Icon: AtSign, marcador: '@cuenta que quieres emular' },
  { id: 'url',     label: 'Por enlace',  Icon: Link2, marcador: 'pega la URL de un reel' },
]

const ORDENES = [
  { id: 'indice',      label: 'Destacados' },
  { id: 'vistas',      label: 'Más vistas' },
  { id: 'interaccion', label: 'Más reacción' },
  { id: 'fecha',       label: 'Más reciente' },
]

/* Un video de hace seis meses puede tener un índice altísimo y ser inútil: el
 * número es real —los reels se llevan casi todas sus vistas en los primeros
 * días, no van sumando— pero el formato envejeció y ya no sirve de molde.
 * Además, una cuenta que publica poco tiene sus últimos doce reels repartidos
 * en año y medio, así que su media mezcla épocas que no se parecen. */
const PERIODOS = [
  { valor: 0,  label: 'Cualquier fecha' },
  { valor: 7,  label: 'Última semana' },
  { valor: 30, label: 'Último mes' },
  { valor: 90, label: 'Últimos 3 meses' },
  { valor: -1, label: 'Otro…' },
]

/* Filtrar por vistas a secas solo deja pasar cuentas grandes. El índice mide
 * cada video contra la mediana de su propia cuenta, así que un 3x es un 3x
 * venga de quien venga. */
const UMBRALES = [
  { valor: 0,   label: 'Todas' },
  { valor: 1.5, label: 'Superaron su media' },
  { valor: 2,   label: 'Doblaron su media' },
  { valor: 3,   label: 'Triplicaron su media' },
]

const miles = (n) => (typeof n === 'number' ? n.toLocaleString('es-MX') : '—')
const corto = (n) => {
  if (typeof n !== 'number') return '—'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`
  return String(n)
}
const duracion = (s) => (typeof s === 'number' ? `${Math.round(s)}s` : null)
const indiceTexto = (n) => (typeof n === 'number' ? `${n.toFixed(1)}×` : null)
const colorIndice = (n) =>
  n >= 3 ? 'bg-accent-green text-white'
  : n >= 2 ? 'bg-accent-amber text-black'
  : 'bg-black/60 text-white'

function useReferencias(orgId) {
  const [referencias, setReferencias] = useState([])
  const [cargando, setCargando] = useState(true)
  useEffect(() => {
    if (!orgId) { setCargando(false); return }
    const q = query(
      collection(db, 'organizations', orgId, 'references'),
      orderBy('vistaEn', 'desc'),
      limit(300)
    )
    const unsub = onSnapshot(q, snap => {
      setReferencias(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setCargando(false)
    }, err => { console.error('[referencias]', err); setCargando(false) })
    return unsub
  }, [orgId])
  return { referencias, cargando }
}

// ─── TARJETA ──────────────────────────────────────────────────────
function Tarjeta({ ref_, onBorrar }) {
  const fecha = ref_.publicadoEn?.toDate?.()
  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden flex flex-col">
      <a href={ref_.url} target="_blank" rel="noreferrer"
        className="relative block aspect-[9/16] bg-surface-2 overflow-hidden group">
        {ref_.miniatura
          ? <img src={ref_.miniatura} alt="" className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-tertiary text-[11px]">Sin miniatura</div>}
        {indiceTexto(ref_.indice) && (
          <span className={clsx('absolute top-2 right-2 px-1.5 py-0.5 rounded-[6px] text-[11px] font-bold',
            colorIndice(ref_.indice))}>
            {indiceTexto(ref_.indice)}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-2.5 text-white text-[11px] font-bold">
            <span className="flex items-center gap-1"><Eye size={11} /> {corto(ref_.vistas)}</span>
            <span className="flex items-center gap-1"><Heart size={11} /> {corto(ref_.likes)}</span>
            {duracion(ref_.duracion) && (
              <span className="ml-auto flex items-center gap-1 opacity-80">
                <Clock size={11} /> {duracion(ref_.duracion)}
              </span>
            )}
          </div>
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ExternalLink size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </a>

      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {ref_.autor?.fotoURL && (
            <img src={ref_.autor.fotoURL} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" loading="lazy" />
          )}
          <span className="text-[12px] font-semibold text-primary truncate">@{ref_.autor?.usuario}</span>
          {ref_.autor?.verificado && <BadgeCheck size={12} className="text-accent-blue shrink-0" />}
          {typeof ref_.autor?.seguidores === 'number' && (
            <span className="text-[11px] text-tertiary shrink-0">{corto(ref_.autor.seguidores)}</span>
          )}
          <button onClick={() => onBorrar(ref_)} title="Quitar de la biblioteca"
            className="ml-auto text-tertiary hover:text-accent-red shrink-0">
            <Trash2 size={12} />
          </button>
        </div>

        {ref_.texto && (
          <p className="text-[11px] text-tertiary leading-snug line-clamp-2">{ref_.texto}</p>
        )}

        <div className="mt-auto pt-1.5 flex items-center gap-2 text-[11px] text-tertiary">
          {typeof ref_.interaccion === 'number' && (
            <span className="flex items-center gap-1 font-semibold text-secondary">
              <MessageCircle size={11} /> {(ref_.interaccion * 100).toFixed(1)}%
            </span>
          )}
          {fecha && <span className="ml-auto">{fecha.toLocaleDateString('es-MX', fecha.getFullYear() === new Date().getFullYear()
              ? { day: 'numeric', month: 'short' }
              : { day: 'numeric', month: 'short', year: '2-digit' })}</span>}
        </div>

        {ref_.audio?.titulo && (
          <div className="flex items-center gap-1 text-[10px] text-tertiary truncate">
            <Music size={10} className="shrink-0" /> <span className="truncate">{ref_.audio.titulo}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PANTALLA ─────────────────────────────────────────────────────
export default function Referencias({ marcas }) {
  const { org } = useAuthStore()
  const orgId = org?.id
  const { referencias, cargando } = useReferencias(orgId)

  const [modo, setModo] = useState('tema')
  const [texto, setTexto] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [cuentas, setCuentas] = useState(null)
  const [orden, setOrden] = useState('indice')
  const [umbral, setUmbral] = useState(0)
  const [marcaId, setMarcaId] = useState('')
  const [vaciando, setVaciando] = useState(false)
  const [dias, setDias] = useState(0)
  const [diasLibres, setDiasLibres] = useState('')

  const marcaDelEscaneo = marcaId || marcas?.[0]?.id || null

  const escanear = async (tipo, consulta) => {
    if (!consulta?.trim()) { toast.error('Escribe algo que buscar'); return }
    setBuscando(true)
    if (tipo === 'tema') setCuentas(null)
    try {
      const res = await fetch('/.netlify/functions/scan-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, brandId: marcaDelEscaneo, tipo, consulta }),
      })
      const r = await res.json()
      if (!res.ok || !r.ok) throw new Error(r.detalle || r.error || 'No se pudo escanear')

      if (tipo === 'tema') {
        setCuentas(r.cuentas || [])
        if (!r.cuentas?.length) toast('Sin cuentas para ese tema')
      } else {
        toast.success(r.encontrados ? `${r.encontrados} referencias` : 'No se encontró nada')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBuscando(false)
    }
  }

  const borrar = async (ref_) => {
    await deleteDoc(doc(db, 'organizations', orgId, 'references', ref_.id))
  }

  const visibles = useMemo(() => {
    let xs = umbral ? referencias.filter(r => (r.indice || 0) >= umbral) : referencias
    if (dias > 0) {
      const desde = Date.now() - dias * 86400000
      // Sin fecha no hay forma de saber si entra en la ventana; queda fuera.
      xs = xs.filter(r => (r.publicadoEn?.toMillis?.() || 0) >= desde)
    }
    const por = {
      indice: (a, b) => (b.indice || 0) - (a.indice || 0),
      vistas: (a, b) => (b.vistas || 0) - (a.vistas || 0),
      interaccion: (a, b) => (b.interaccion || 0) - (a.interaccion || 0),
      fecha: (a, b) => (b.publicadoEn?.toMillis?.() || 0) - (a.publicadoEn?.toMillis?.() || 0),
    }
    return [...xs].sort(por[orden])
  }, [referencias, orden, umbral, dias])

  /* Borra lo que está a la vista, no toda la biblioteca a ciegas: si tienes
   * filtrado "Triplicaron su media", vacías justo eso. Así se puede limpiar
   * una cuenta que no sirvió sin perder el resto del trabajo. */
  const vaciar = async () => {
    const cuantas = visibles.length
    if (!cuantas) return
    const texto = cuantas === referencias.length
      ? `¿Vaciar la biblioteca entera? Son ${cuantas} referencias y no se puede deshacer.`
      : `¿Quitar las ${cuantas} referencias que estás viendo? El resto se queda.`
    if (!window.confirm(texto)) return
    setVaciando(true)
    try {
      // Firestore admite 500 operaciones por lote.
      for (let i = 0; i < visibles.length; i += 450) {
        const lote = writeBatch(db)
        for (const r of visibles.slice(i, i + 450)) {
          lote.delete(doc(db, 'organizations', orgId, 'references', r.id))
        }
        await lote.commit()
      }
      toast.success(`${cuantas} referencias quitadas`)
    } catch (e) {
      toast.error('No se pudieron borrar')
      console.error(e)
    } finally {
      setVaciando(false)
    }
  }

  const modoActual = MODOS.find(m => m.id === modo)

  return (
    <div>
      {/* Buscador */}
      <div className="bg-surface border border-border rounded-card shadow-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {MODOS.map(m => (
            <button key={m.id} onClick={() => { setModo(m.id); setCuentas(null) }}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-[12px] font-semibold transition-colors',
                modo === m.id
                  ? 'bg-accent-blue text-white'
                  : 'bg-surface-2 border border-border text-secondary hover:text-primary')}>
              <m.Icon size={13} /> {m.label}
            </button>
          ))}
          {marcas?.length > 1 && (
            <select value={marcaId} onChange={e => setMarcaId(e.target.value)}
              title="A qué marca se le carga el consumo del escáner"
              className="ml-auto px-2.5 py-1.5 rounded-btn bg-surface-2 border border-border text-[12px] text-secondary outline-none">
              {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && escanear(modo, texto)}
            placeholder={modoActual?.marcador}
            className="flex-1 px-3 py-2 rounded-btn bg-surface-2 border border-border text-[13px] text-primary outline-none focus:border-accent-blue"
          />
          <button onClick={() => escanear(modo, texto)} disabled={buscando}
            className="flex items-center gap-1.5 px-4 py-2 rounded-btn bg-accent-blue text-white text-[13px] font-bold disabled:opacity-50">
            {buscando ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {modo === 'tema' && (
          <p className="text-[11px] text-tertiary mt-2">
            Buscar un tema devuelve cuentas, no videos — Instagram no deja buscar publicaciones ajenas.
            Elige a quién quieres emular y traemos sus reels.
          </p>
        )}

        {cuentas && (
          <div className="mt-3 pt-3 border-t border-border">
            {cuentas.length === 0 ? (
              <p className="text-[12px] text-tertiary">Sin cuentas para ese tema.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {cuentas.map(c => (
                  <button key={c.usuario} onClick={() => escanear('creador', c.usuario)} disabled={buscando}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn bg-surface-2 border border-border text-[12px] text-secondary hover:text-primary disabled:opacity-50">
                    {c.fotoURL && <img src={c.fotoURL} alt="" className="w-4 h-4 rounded-full object-cover" loading="lazy" />}
                    @{c.usuario}
                    {c.verificado && <BadgeCheck size={11} className="text-accent-blue" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      {referencias.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-1 bg-surface-2 border border-border rounded-btn p-0.5">
            {ORDENES.map(o => (
              <button key={o.id} onClick={() => setOrden(o.id)}
                className={clsx('px-2.5 py-1 rounded-[6px] text-[12px] font-semibold transition-colors',
                  orden === o.id ? 'bg-accent-blue text-white' : 'text-secondary hover:text-primary')}>
                {o.label}
              </button>
            ))}
          </div>
          <select
            value={PERIODOS.some(p => p.valor === dias) ? dias : -1}
            onChange={e => {
              const v = Number(e.target.value)
              if (v === -1) { setDias(Number(diasLibres) || 14); setDiasLibres(String(Number(diasLibres) || 14)) }
              else { setDias(v); setDiasLibres('') }
            }}
            className="px-2.5 py-1.5 rounded-btn bg-surface-2 border border-border text-[12px] text-secondary outline-none">
            {PERIODOS.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
          </select>

          {!PERIODOS.some(p => p.valor === dias) || diasLibres !== '' ? (
            <div className="flex items-center gap-1">
              <input
                type="number" min="1" max="730" value={diasLibres}
                onChange={e => { setDiasLibres(e.target.value); const n = Number(e.target.value); if (n > 0) setDias(Math.min(730, n)) }}
                onBlur={() => { const n = Math.max(1, Math.min(730, Number(diasLibres) || 1)); setDiasLibres(String(n)); setDias(n) }}
                className="w-16 px-2 py-1.5 rounded-btn bg-surface-2 border border-border text-[12px] text-primary outline-none focus:border-accent-blue"
              />
              <span className="text-[12px] text-tertiary">días</span>
            </div>
          ) : null}

          <select value={umbral} onChange={e => setUmbral(Number(e.target.value))}
            title="El índice compara cada video contra la mediana de su propia cuenta"
            className="px-2.5 py-1.5 rounded-btn bg-surface-2 border border-border text-[12px] text-secondary outline-none">
            {UMBRALES.map(u => <option key={u.valor} value={u.valor}>{u.label}</option>)}
          </select>
          <span className="text-[12px] text-tertiary ml-auto">
            {visibles.length} de {referencias.length}
          </span>
          <button onClick={vaciar} disabled={vaciando || !visibles.length}
            title={visibles.length === referencias.length ? 'Vaciar la biblioteca' : 'Quitar las que estás viendo'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-btn bg-surface-2 border border-border text-[12px] font-semibold text-tertiary hover:text-accent-red disabled:opacity-50">
            <Eraser size={13} /> {vaciando ? 'Borrando…' : 'Vaciar'}
          </button>
        </div>
      )}

      {/* Board */}
      {cargando ? (
        <p className="text-[13px] text-tertiary">Cargando referencias…</p>
      ) : referencias.length === 0 ? (
        <div className="bg-surface border border-border rounded-card shadow-card p-10 text-center">
          <Search size={26} className="text-tertiary mx-auto mb-3" />
          <h2 className="font-display font-bold text-[15px] text-primary mb-1">La biblioteca está vacía</h2>
          <p className="text-[13px] text-tertiary max-w-[460px] mx-auto">
            Busca un tema para encontrar cuentas de ese nicho, escanea a alguien que ya te guste,
            o pega el enlace de un reel que quieras emular.
          </p>
        </div>
      ) : visibles.length === 0 ? (
        <p className="text-[13px] text-tertiary">Ninguna referencia pasa ese filtro.</p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {visibles.map(r => <Tarjeta key={r.id} ref_={r} onBorrar={borrar} />)}
        </div>
      )}
    </div>
  )
}
