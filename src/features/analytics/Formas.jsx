/* Las formas de mostrar un resultado.
 *
 * Todas se dimensionan en porcentaje del espacio disponible, nunca en píxeles:
 * una tarjeta puede ocupar un cuarto de fila o la fila entera y tiene que
 * verse bien en las dos. Eso es lo que hacía que los números se salieran.
 */
import { useId } from 'react'

const PALETA = ['#1aab99', '#3533cd', '#f79009', '#9e77ed', '#2e90fa', '#f04438', '#12b76a', '#ec4899']

/** Un número grande y solo. Para medidas sin dimensión. */
export function Numero({ valor, formato, sub }) {
  const texto = formato(valor)
  // El tamaño baja con el largo para que una cifra de millones no desborde.
  const tam = texto.length > 12 ? 24 : texto.length > 8 ? 30 : 38
  return (
    <div className="flex flex-col justify-center h-full min-h-[90px]">
      <span
        className="font-display font-extrabold leading-none tabular-nums break-all"
        style={{ fontSize: tam }}
      >
        {texto}
      </span>
      {sub && <span className="text-[11.5px] text-tertiary mt-1.5">{sub}</span>}
    </div>
  )
}

/** Barras horizontales. Soportan cualquier cantidad de categorías porque
 *  crecen hacia abajo, no hacia los lados. */
export function Barras({ filas, formato }) {
  const max = Math.max(...filas.map(f => f.valor), 1)
  if (!filas.length) return <Vacio />
  return (
    <div className="flex flex-col gap-2">
      {filas.slice(0, 12).map((f, i) => (
        <div key={f.clave}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-[12px] truncate">{f.label}</span>
            <span className="text-[12px] font-bold tabular-nums flex-shrink-0">{formato(f.valor)}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full"
              style={{ width: `${(f.valor / max) * 100}%`, background: PALETA[i % PALETA.length] }} />
          </div>
        </div>
      ))}
      {filas.length > 12 && (
        <span className="text-[11px] text-tertiary">y {filas.length - 12} más</span>
      )}
    </div>
  )
}

/** Línea para series de tiempo. El trazo se dibuja en coordenadas relativas,
 *  así que se estira con la tarjeta sin recalcular nada. */
export function Linea({ filas, formato }) {
  const id = useId()
  if (filas.length < 2) return <Vacio texto="Hacen falta al menos dos puntos para dibujar una línea." />
  const max = Math.max(...filas.map(f => f.valor), 1)
  const puntos = filas.map((f, i) => {
    const x = (i / (filas.length - 1)) * 100
    const y = 100 - (f.valor / max) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-[110px]">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1aab99" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1aab99" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${puntos} 100,100`} fill={`url(#g${id})`} />
        <polyline points={puntos} fill="none" stroke="#1aab99" strokeWidth="2"
          vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-tertiary mt-1">
        <span>{filas[0].label}</span>
        <span className="font-bold text-secondary">máx {formato(max)}</span>
        <span>{filas[filas.length - 1].label}</span>
      </div>
    </div>
  )
}

/** Torta. Solo se ofrece cuando las partes suman el total, nunca con
 *  porcentajes. */
export function Torta({ filas, formato }) {
  const total = filas.reduce((s, f) => s + f.valor, 0)
  if (!total) return <Vacio />
  let acum = 0
  const radio = 15.9155 // circunferencia 100: los largos son porcentajes directos

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox="0 0 42 42" className="w-[110px] h-[110px] flex-shrink-0 -rotate-90">
        {filas.map((f, i) => {
          const pct = (f.valor / total) * 100
          const el = (
            <circle key={f.clave} cx="21" cy="21" r={radio} fill="transparent"
              stroke={PALETA[i % PALETA.length]} strokeWidth="6"
              strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-acum} />
          )
          acum += pct
          return el
        })}
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        {filas.slice(0, 7).map((f, i) => (
          <div key={f.clave} className="flex items-center gap-2 text-[12px] min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: PALETA[i % PALETA.length] }} />
            <span className="truncate flex-1">{f.label}</span>
            <span className="font-bold tabular-nums flex-shrink-0">{formato(f.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Tabla. La forma honesta cuando hay muchas categorías: un gráfico con
 *  veinte barras no se lee. */
export function Tabla({ filas, formato }) {
  if (!filas.length) return <Vacio />
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[12px]">
        <tbody>
          {filas.map(f => (
            <tr key={f.clave} className="border-t border-border first:border-0">
              <td className="py-1.5 px-1 truncate max-w-0">{f.label}</td>
              <td className="py-1.5 px-1 text-right font-bold tabular-nums whitespace-nowrap">{formato(f.valor)}</td>
              <td className="py-1.5 px-1 text-right text-tertiary whitespace-nowrap">{f.casos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Vacio({ texto = 'Sin datos en el período elegido.' }) {
  return <p className="text-[12px] text-tertiary py-6 text-center">{texto}</p>
}

export const RENDERIZADORES = { numero: Numero, barras: Barras, linea: Linea, torta: Torta, tabla: Tabla }
