/* La línea de tiempo: aquí decide la persona, no la máquina.
 *
 * El fileteado automático se queda, pero cambia de papel: ya no corta, sugiere.
 * Lo que propone aparece dibujado y tú lo mueves, lo estiras o lo borras.
 *
 * Todo lo que hacía falta ya estaba: la onda sale del envolvente que medimos
 * al subir el video, los bordes limpios salen de los silencios reales, y las
 * palabras de la transcripción. Faltaba ponerlo junto y dejarte las manos.
 */
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import clsx from 'clsx'
import { ZoomIn, ZoomOut, Scissors, Trash2, Magnet, Play, Pause, SkipBack } from 'lucide-react'

const ALTO = 96
const REGLA = 18        // la franja de arriba con los tiempos
const BORDE = 7           // píxeles de agarre en el borde de un tramo
const IMAN = 0.12         // a cuánto se pega el borde al silencio más cercano

const COLORES = {
  silencio:   '#6e6e73',
  muletilla:  '#f59e0b',
  repeticion: '#7c3aed',
  arranque:   '#00b8d9',
  divagacion: '#ff3b30',
  arrastre:   '#00c853',
  manual:     '#ff3b30',
}

const reloj = (s) => {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/* Cada cuánto poner una marca, según cuánto se vea. Sin esto la regla queda
 * ilegible: o tres números en cuatro minutos, o doscientos pegados. */
function pasoDeRegla(pxs) {
  for (const p of [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]) {
    if (p * pxs >= 70) return p
  }
  return 600
}

/* Pega un instante al borde de silencio más cercano. Es lo que hace que un
 * corte hecho a mano suene tan limpio como uno calculado: no hace falta
 * tener puntería, basta con acercarse. */
function imantar(t, silencios, activo) {
  if (!activo || !silencios?.length) return t
  let mejor = t
  let dist = IMAN
  for (const s of silencios) {
    for (const borde of [s.inicio, s.fin, (s.inicio + s.fin) / 2]) {
      const d = Math.abs(borde - t)
      if (d < dist) { dist = d; mejor = borde }
    }
  }
  return mejor
}

export default function Linea({
  duracion, audio, palabras = [], cortes = [], segundo = 0,
  onCambiar, onIr, onPlay, sonando = false,
  saltando = true, onSaltar,
}) {
  const lienzo = useRef(null)
  const carril = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [ancho, setAncho] = useState(800)
  const [seleccion, setSeleccion] = useState(null)
  const [iman, setIman] = useState(true)
  const arrastre = useRef(null)
  /* El arrastre ocurre entre dibujados, así que la lista que ve el manejador
   * puede ser la anterior. Con una referencia siempre se trabaja sobre la
   * última, y un tramo recién creado no se queda clavado en su tamaño de
   * nacimiento. */
  const ahora = useRef(cortes)
  useEffect(() => { ahora.current = cortes }, [cortes])

  const pxs = (ancho * zoom) / (duracion || 1)   // píxeles por segundo
  const anchoTotal = Math.max(ancho, duracion * pxs)
  const aX = useCallback(t => t * pxs, [pxs])
  const aT = useCallback(x => x / pxs, [pxs])

  useEffect(() => {
    const medir = () => setAncho(carril.current?.clientWidth || 800)
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  const silencios = audio?.silencios || []

  // ── dibujo ──
  useEffect(() => {
    const c = lienzo.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = anchoTotal * dpr
    c.height = (ALTO + REGLA) * dpr
    c.style.width = `${anchoTotal}px`
    c.style.height = `${ALTO + REGLA}px`
    const g = c.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, anchoTotal, ALTO + REGLA)

    const env = audio?.envolvente || []
    const hz = audio?.hz || 25
    const medio = REGLA + ALTO / 2

    // La onda
    g.fillStyle = 'rgba(125,125,135,0.45)'
    if (env.length) {
      const paso = Math.max(1, Math.floor(env.length / anchoTotal))
      for (let x = 0; x < anchoTotal; x++) {
        const i = Math.floor(aT(x) * hz)
        if (i < 0 || i >= env.length) continue
        let pico = 0
        for (let k = 0; k < paso; k++) pico = Math.max(pico, env[i + k] || 0)
        const h = (pico / 100) * (ALTO / 2 - 4)
        g.fillRect(x, medio - h, 1, h * 2)
      }
    } else {
      g.fillRect(0, medio - 1, anchoTotal, 2)
    }

    // Los silencios reales, de fondo
    g.fillStyle = 'rgba(0,200,83,0.07)'
    for (const s of silencios) g.fillRect(aX(s.inicio), REGLA, Math.max(1, aX(s.fin - s.inicio)), ALTO)

    // La regla
    const paso = pasoDeRegla(pxs)
    g.fillStyle = 'rgba(125,125,135,0.14)'
    g.fillRect(0, 0, anchoTotal, REGLA)
    g.fillStyle = 'rgba(160,160,170,0.9)'
    g.font = '10px Inter, system-ui, sans-serif'
    g.textBaseline = 'middle'
    for (let t = 0; t <= duracion; t += paso) {
      const x = aX(t)
      g.fillRect(x, REGLA - 5, 1, 5)
      g.fillText(reloj(t), x + 3, REGLA / 2)
    }

    // Marcas de palabra, para ver dónde se puede cortar sin partir nada
    if (pxs > 30) {
      g.fillStyle = 'rgba(125,125,135,0.25)'
      for (const p of palabras) g.fillRect(aX(p.inicio), REGLA + ALTO - 8, 1, 8)
    }
  }, [anchoTotal, audio, palabras, silencios, pxs, aX, aT, duracion])

  // ── ratón ──
  const tiempoEn = (e) => {
    const r = lienzo.current.getBoundingClientRect()
    return Math.max(0, Math.min(duracion, aT(e.clientX - r.left)))
  }

  const queHayEn = (t, x) => {
    for (const c of ahora.current) {
      const x1 = aX(c.inicio)
      const x2 = aX(c.fin)
      if (x >= x1 - BORDE && x <= x1 + BORDE) return { corte: c, parte: 'inicio' }
      if (x >= x2 - BORDE && x <= x2 + BORDE) return { corte: c, parte: 'fin' }
      if (t > c.inicio && t < c.fin) return { corte: c, parte: 'cuerpo' }
    }
    return null
  }

  const alBajar = (e) => {
    const t = tiempoEn(e)
    const r0 = lienzo.current.getBoundingClientRect()
    // En la regla solo se mueve la aguja: ahí no se crean ni se agarran tramos.
    if (e.clientY - r0.top < REGLA) { onIr?.(t); setSeleccion(null); return }
    const r = lienzo.current.getBoundingClientRect()
    const golpe = queHayEn(t, e.clientX - r.left)

    if (golpe) {
      setSeleccion(golpe.corte.id)
      if (golpe.parte === 'cuerpo') { onIr?.(golpe.corte.fin); return }
      arrastre.current = { tipo: golpe.parte, id: golpe.corte.id }
    } else if (e.shiftKey) {
      // Shift y arrastrar: un corte nuevo, hecho a mano.
      const nuevo = {
        id: `m${Date.now()}`,
        inicio: t, fin: t + 0.05,
        tipo: 'manual', motivo: 'Corte a mano', activo: true,
      }
      ahora.current = [...ahora.current, nuevo]
      onCambiar?.(ahora.current)
      setSeleccion(nuevo.id)
      arrastre.current = { tipo: 'fin', id: nuevo.id }
    } else {
      onIr?.(t)
      setSeleccion(null)
    }
  }

  const alMover = (e) => {
    if (!arrastre.current) return
    const t = imantar(tiempoEn(e), silencios, iman)
    const { id, tipo } = arrastre.current
    ahora.current = ahora.current.map(c => {
      if (c.id !== id) return c
      if (tipo === 'inicio') return { ...c, inicio: Math.min(t, c.fin - 0.03) }
      return { ...c, fin: Math.max(t, c.inicio + 0.03) }
    })
    onCambiar?.(ahora.current)
  }

  const alSoltar = () => { arrastre.current = null }

  /* El teclado es la mitad del oficio: con el ratón se encuadra y con las
   * teclas se afina. Nada de esto se activa si estás escribiendo en un campo. */
  useEffect(() => {
    const tecla = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      if (document.activeElement?.isContentEditable) return

      if (e.code === 'Space') { e.preventDefault(); onPlay?.(); return }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const salto = e.shiftKey ? 1 : 0.1
        const d = e.key === 'ArrowLeft' ? -salto : salto
        onIr?.(Math.max(0, Math.min(duracion, segundo + d)))
        return
      }
      if (e.key === 'Home') { e.preventDefault(); onIr?.(0); return }
      if (e.key === 'End') { e.preventDefault(); onIr?.(duracion); return }

      // Cortar en la aguja: un tramo nuevo de medio segundo, listo para
      // estirarlo. Es más rápido que buscar el sitio con el ratón.
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        const inicio = imantar(segundo, silencios, iman)
        const nuevo = {
          id: `m${Date.now()}`,
          inicio, fin: Math.min(duracion, inicio + 0.5),
          tipo: 'manual', motivo: 'Corte a mano', activo: true,
        }
        ahora.current = [...ahora.current, nuevo]
        onCambiar?.(ahora.current)
        setSeleccion(nuevo.id)
        return
      }

      if ((e.key === 'Backspace' || e.key === 'Delete') && seleccion) {
        e.preventDefault()
        ahora.current = ahora.current.filter(c => c.id !== seleccion)
        onCambiar?.(ahora.current)
        setSeleccion(null)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [seleccion, onCambiar, onPlay, onIr, segundo, duracion, silencios, iman])

  /* Con zoom, la aguja se va de la pantalla enseguida. El carril la sigue,
   * pero solo cuando se sale: moverlo en cada cuadro marea. */
  useEffect(() => {
    const car = carril.current
    if (!car) return
    const x = aX(segundo)
    const izq = car.scrollLeft
    const der = izq + car.clientWidth
    if (x < izq + 40 || x > der - 40) car.scrollLeft = Math.max(0, x - car.clientWidth / 2)
  }, [segundo, aX])

  const quitado = useMemo(
    () => cortes.filter(c => c.activo !== false).reduce((a, c) => a + (c.fin - c.inicio), 0),
    [cortes]
  )

  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => onPlay?.()} title="Espacio"
          className="w-8 h-8 rounded-btn bg-accent-blue text-white flex items-center justify-center shrink-0">
          {sonando ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
        </button>
        <button onClick={() => onIr?.(0)} title="Volver al principio (Inicio)"
          className="w-8 h-8 rounded-btn bg-surface-2 border border-border flex items-center justify-center text-tertiary hover:text-primary shrink-0">
          <SkipBack size={14} />
        </button>

        <span className="font-display font-bold text-[15px] text-primary tabular-nums">
          {reloj(segundo)}
        </span>
        <span className="text-[12px] text-tertiary">
          / {reloj(duracion)} → <span className="text-accent-green font-semibold">{reloj(duracion - quitado)}</span>
        </span>

        {onSaltar && (
          <button onClick={() => onSaltar(!saltando)}
            title="Al reproducir, brincar los tramos cortados"
            className={clsx('flex items-center gap-1 px-2 py-1 rounded-btn text-[11px] font-bold border',
              saltando ? 'bg-accent-green/15 text-accent-green border-accent-green/40' : 'bg-surface-2 border-border text-tertiary')}>
            <Scissors size={12} /> Saltar cortes
          </button>
        )}

        <button onClick={() => setIman(v => !v)} title="Pegar los bordes al silencio más cercano"
          className={clsx('ml-auto flex items-center gap-1 px-2 py-1 rounded-btn text-[11px] font-bold border',
            iman ? 'bg-accent-blue text-white border-accent-blue' : 'bg-surface-2 border-border text-tertiary')}>
          <Magnet size={12} /> Imán
        </button>
        <button onClick={() => setZoom(z => Math.max(1, z / 2))} disabled={zoom <= 1}
          className="w-7 h-7 rounded-btn bg-surface-2 border border-border flex items-center justify-center text-tertiary hover:text-primary disabled:opacity-40">
          <ZoomOut size={13} />
        </button>
        <span className="text-[11px] text-tertiary w-8 text-center">{zoom}x</span>
        <button onClick={() => setZoom(z => Math.min(32, z * 2))} disabled={zoom >= 32}
          className="w-7 h-7 rounded-btn bg-surface-2 border border-border flex items-center justify-center text-tertiary hover:text-primary disabled:opacity-40">
          <ZoomIn size={13} />
        </button>
        {seleccion && (
          <button onClick={() => { onCambiar?.(cortes.filter(c => c.id !== seleccion)); setSeleccion(null) }}
            className="flex items-center gap-1 px-2 py-1 rounded-btn bg-surface-2 border border-border text-[11px] font-bold text-tertiary hover:text-accent-red">
            <Trash2 size={12} /> Quitar
          </button>
        )}
      </div>

      <div ref={carril} className="relative overflow-x-auto overflow-y-hidden rounded-btn bg-surface-2 border border-border">
        <div className="relative" style={{ width: anchoTotal, height: ALTO + REGLA }}>
          <canvas
            ref={lienzo}
            onMouseDown={alBajar}
            onMouseMove={alMover}
            onMouseUp={alSoltar}
            onMouseLeave={alSoltar}
            className="absolute inset-0 cursor-crosshair"
          />

          {cortes.map(c => {
            const color = COLORES[c.tipo] || COLORES.manual
            const fuera = c.activo === false
            return (
              <div
                key={c.id}
                title={`${c.motivo || ''} · ${(c.fin - c.inicio).toFixed(2)}s`}
                className={clsx('absolute bottom-0 pointer-events-none border-x-2',
                  seleccion === c.id && 'ring-2 ring-white/60')}
                style={{
                  top: REGLA,
                  left: aX(c.inicio),
                  width: Math.max(2, aX(c.fin - c.inicio)),
                  background: fuera ? 'transparent' : `${color}33`,
                  borderColor: color,
                  opacity: fuera ? 0.35 : 1,
                }}
              />
            )
          })}

          <div className="absolute top-0 bottom-0 w-px bg-accent-blue pointer-events-none"
            style={{ left: aX(segundo) }} />
        </div>
      </div>

      <p className="text-[11px] text-tertiary mt-2 leading-snug">
        <strong>Espacio</strong> reproduce · <strong>←→</strong> mueve la aguja (con shift, un segundo) ·
        <strong>S</strong> corta donde esté la aguja · <strong>Supr</strong> quita el tramo seleccionado ·
        <strong>shift + arrastrar</strong> crea uno nuevo. Con el imán puesto los bordes se pegan
        solos al silencio más cercano.
      </p>
    </div>
  )
}
