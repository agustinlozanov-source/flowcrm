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

const ALTO = 96         // la pista de voz
const REGLA = 18        // la franja de arriba con los tiempos
const PISTA = 34        // cada capa de debajo
const ETIQUETAS = 74    // la columna de nombres, fuera del desplazamiento

/* Las capas se dibujan siempre, aunque estén vacías. Enseñar solo las que
 * tienen algo deja la impresión de que falta la mitad del editor: no se ve
 * dónde va a ir cada cosa. Las que todavía no existen se marcan como tales en
 * vez de esconderse. */
const CAPAS = [
  { id: 'sonidos',    nombre: 'Sonidos' },
  { id: 'musica',     nombre: 'Música',     pendiente: true },
  { id: 'subtitulos', nombre: 'Subtítulos' },
]
const BORDE = 7           // píxeles de agarre en el borde de un tramo
const IMAN = 0.12         // a cuánto se pega el borde al silencio más cercano

/* Cada clase de corte con su color y su nombre. El de a mano tenía el mismo
 * rojo que las divagaciones y no había forma de distinguirlos: ahora va en
 * magenta, que no se parece a nada de lo que propone la máquina. */
export const TIPOS = {
  silencio:   { color: '#6e6e73', nombre: 'Pausa',      explica: 'Silencio largo entre frases' },
  muletilla:  { color: '#f59e0b', nombre: 'Muletilla',  explica: '"este", "o sea", relleno' },
  arrastre:   { color: '#00c853', nombre: 'Arrastre',   explica: 'Sonido sin palabras: "eeeh", respiración' },
  repeticion: { color: '#7c3aed', nombre: 'Repetida',   explica: 'Dijo lo mismo más de una vez' },
  arranque:   { color: '#00b8d9', nombre: 'Arranque',   explica: 'Empezó, se trabó y volvió a empezar' },
  divagacion: { color: '#ff3b30', nombre: 'Divagación', explica: 'Se fue del tema y volvió' },
  manual:     { color: '#ff2d92', nombre: 'A mano',     explica: 'Lo cortaste tú' },
}

const COLORES = Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, v.color]))

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
  sonidos = [], onCambiarSonidos, subtitulos = [],
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

    /* Lo cortado se oscurece. El borde de color ya decía dónde está el tramo,
     * pero no que ESO se va: apagando la onda debajo, el ojo entiende de un
     * vistazo qué parte del material sigue viva. */
    g.fillStyle = 'rgba(0,0,0,0.55)'
    for (const c of cortes) {
      if (c.activo === false) continue
      g.fillRect(aX(c.inicio), REGLA, Math.max(1, aX(c.fin - c.inicio)), ALTO)
    }

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
  }, [anchoTotal, audio, palabras, silencios, cortes, pxs, aX, aT, duracion])

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

  /* Los sonidos se mueven agarrándolos y llevándolos. Se pegan al silencio
   * igual que los cortes: un golpe suena mejor justo donde la voz calla. */
  const sonidoArrastrado = useRef(null)
  const agarrarSonido = (e, s) => {
    e.stopPropagation()
    const r = lienzo.current.getBoundingClientRect()
    sonidoArrastrado.current = { id: s.id, desfase: (e.clientX - r.left) - aX(s.en) }
  }
  const moverSonido = (e) => {
    if (!sonidoArrastrado.current || !onCambiarSonidos) return
    const r = lienzo.current.getBoundingClientRect()
    const { id, desfase } = sonidoArrastrado.current
    const crudo = aT(Math.max(0, e.clientX - r.left - desfase))
    const en = imantar(Math.min(duracion, crudo), silencios, iman)
    onCambiarSonidos(sonidos.map(s => (s.id === id ? { ...s, en } : s)))
  }
  const soltarSonido = () => { sonidoArrastrado.current = null }

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

      {!!cortes.length && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
          {Object.entries(TIPOS).map(([clave, t]) => {
            const n = cortes.filter(c => (c.tipo || 'manual') === clave).length
            if (!n) return null
            return (
              <span key={clave} title={t.explica}
                className="flex items-center gap-1.5 text-[11px] text-tertiary cursor-default">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: `${t.color}55`, border: `1.5px solid ${t.color}` }} />
                <span className="text-secondary font-semibold">{t.nombre}</span>
                <span>{n}</span>
              </span>
            )
          })}
          <span className="text-[11px] text-tertiary ml-auto">
            Todo lo de color se quita del video. Pasa el ratón por encima para ver por qué.
          </span>
        </div>
      )}

      <div className="flex rounded-btn bg-surface-2 border border-border overflow-hidden">
        {/* Los nombres de las capas viven fuera del desplazamiento: si se
            fueran con el carril, al moverse no sabrías qué estás mirando. */}
        <div className="shrink-0 border-r border-border" style={{ width: ETIQUETAS }}>
          <div style={{ height: REGLA }} />
          <div className="flex items-center px-2 text-[10px] font-bold uppercase tracking-wide text-tertiary"
            style={{ height: ALTO }}>Voz</div>
          {CAPAS.map(c => (
            <div key={c.id}
              className={clsx('flex items-center gap-1 px-2 border-t border-border text-[10px] font-bold uppercase tracking-wide',
                c.pendiente ? 'text-tertiary/40' : 'text-tertiary')}
              style={{ height: PISTA }}>
              {c.nombre}
            </div>
          ))}
        </div>

        <div ref={carril} className="relative overflow-x-auto overflow-y-hidden flex-1">
          <div
            className="relative"
            style={{ width: anchoTotal, height: REGLA + ALTO + CAPAS.length * PISTA }}
            onMouseMove={e => { alMover(e); moverSonido(e) }}
            onMouseUp={() => { alSoltar(); soltarSonido() }}
            onMouseLeave={() => { alSoltar(); soltarSonido() }}
          >
            <canvas
              ref={lienzo}
              onMouseDown={alBajar}
              className="absolute top-0 left-0 cursor-crosshair"
            />

            {cortes.map(c => {
              const color = COLORES[c.tipo] || COLORES.manual
              const fuera = c.activo === false
              return (
                <div
                  key={c.id}
                  title={`${TIPOS[c.tipo]?.nombre || 'Corte'} · ${c.motivo || ''} · ${(c.fin - c.inicio).toFixed(2)}s`}
                  className={clsx('absolute pointer-events-none border-x-2',
                    seleccion === c.id && 'ring-2 ring-white/60')}
                  style={{
                    top: REGLA,
                    height: ALTO,
                    left: aX(c.inicio),
                    width: Math.max(2, aX(c.fin - c.inicio)),
                    background: fuera ? 'transparent' : `${color}33`,
                    borderColor: color,
                    opacity: fuera ? 0.35 : 1,
                  }}
                />
              )
            })}

            {CAPAS.map((c, i) => (
              <div key={c.id} className="absolute left-0 border-t border-border"
                style={{ top: REGLA + ALTO + i * PISTA, height: PISTA, width: anchoTotal }}>
                {c.id === 'subtitulos' && subtitulos.map(t => (
                  <div key={t.id}
                    onClick={() => onIr?.(t.desde)}
                    title={t.texto}
                    className="absolute top-1 bottom-1 rounded-[3px] bg-accent-blue/20 border border-accent-blue/60
                               flex items-center px-1 overflow-hidden cursor-pointer hover:bg-accent-blue/30"
                    style={{ left: aX(t.desde), width: Math.max(8, aX(t.hasta - t.desde)) }}
                  >
                    <span className="text-[9px] text-accent-blue truncate">{t.texto}</span>
                  </div>
                ))}
                {c.pendiente && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-tertiary/40">
                    pendiente
                  </span>
                )}
              </div>
            ))}

            <div className="absolute left-0"
              style={{ top: REGLA + ALTO, height: PISTA, width: anchoTotal }}>
              {sonidos.map(s => (
                  <div
                    key={s.id}
                    onMouseDown={e => agarrarSonido(e, s)}
                    title={`${s.nombre} · ${reloj(s.en)} — arrástralo para moverlo`}
                    className="absolute top-1 bottom-1 rounded-[4px] bg-accent-green/25 border border-accent-green
                               flex items-center px-1.5 cursor-grab active:cursor-grabbing overflow-hidden"
                    style={{
                      left: aX(s.en),
                      width: Math.max(26, aX(s.duracion || 0.6)),
                    }}
                  >
                    <span className="text-[10px] font-bold text-accent-green truncate">{s.nombre}</span>
                  </div>
              ))}
            </div>

            <div className="absolute top-0 bottom-0 w-px bg-accent-blue pointer-events-none z-10"
              style={{ left: aX(segundo) }} />
          </div>
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
