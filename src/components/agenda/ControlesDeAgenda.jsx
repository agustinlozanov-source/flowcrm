import { useState } from 'react'
import { Plus, X } from 'lucide-react'

/* Los controles de agenda, fuera de la pantalla del agente.
 *
 * Vivían dentro de Agent.jsx, que era el único lugar donde se configuraba la
 * agenda. Ahora también se configura desde la ficha de cada marca personal
 * —su horario es suyo, no de la organización— y dos copias del mismo editor
 * se habrían separado al primer arreglo.
 */
function Section({ title, desc, children }) {
  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-4">
      <div className="mb-3">
        <div className="font-display font-bold text-[13.5px] text-primary">{title}</div>
        {desc && <div className="text-[11.5px] text-tertiary mt-0.5">{desc}</div>}
      </div>
      {children}
    </div>
  )
}

function Minutos({ valor, onChange, presets, min = 0, max = 240, sufijo = 'min' }) {
  const esPreset = presets.includes(valor)
  const [libre, setLibre] = useState(esPreset ? '' : String(valor ?? ''))

  const acotar = (txt) => Math.max(min, Math.min(max, parseInt(txt, 10) || min))

  const escribir = (txt) => {
    setLibre(txt)
    if (txt === '') return
    onChange(acotar(txt))
  }

  const alSalir = () => {
    if (libre === '') return
    const n = acotar(libre)
    setLibre(presets.includes(n) ? '' : String(n))
    onChange(n)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <button key={p}
          onClick={() => { onChange(p); setLibre('') }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            valor === p
              ? 'bg-accent-blue text-white border-accent-blue'
              : 'bg-surface-2 text-secondary border-transparent hover:border-accent-blue/40'
          }`}>
          {p === 0 ? 'Sin respiro' : `${p} ${sufijo}`}
        </button>
      ))}
      <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-all ${
        !esPreset ? 'border-accent-blue bg-accent-blue/[0.06]' : 'border-black/[0.1]'
      }`}>
        <input
          type="number" min={min} max={max}
          value={esPreset ? libre : (libre || valor || '')}
          onChange={e => escribir(e.target.value)}
          onBlur={alSalir}
          placeholder="Otro"
          className="w-[58px] bg-transparent outline-none text-xs font-semibold text-primary placeholder-tertiary text-center"
        />
        <span className="text-[11px] text-tertiary">{sufijo}</span>
      </div>
    </div>
  )
}

/* ── HORARIOS DE ATENCIÓN ──────────────────────────────────────────
 *
 * Cada día con sus propios tramos. Varios por día, porque una clínica que
 * cierra al mediodía tiene dos y antes había que elegir uno solo.
 *
 * Un día sin tramos es un día cerrado: no hace falta un interruptor aparte
 * para apagarlo, y así no se puede quedar "abierto sin horario".
 */
const DIAS = [
  { n: 1, corto: 'Lun', largo: 'Lunes' },
  { n: 2, corto: 'Mar', largo: 'Martes' },
  { n: 3, corto: 'Mié', largo: 'Miércoles' },
  { n: 4, corto: 'Jue', largo: 'Jueves' },
  { n: 5, corto: 'Vie', largo: 'Viernes' },
  { n: 6, corto: 'Sáb', largo: 'Sábado' },
  { n: 0, corto: 'Dom', largo: 'Domingo' },
]

const TRAMO_NUEVO = { desde: '09:00', hasta: '19:00' }

/** Un tramo que arranca donde terminó el anterior y dura dos horas. Sin esto
 *  el tramo nuevo nacía al revés —de 19:00 a 14:00— y había que arreglarlo a
 *  mano antes de poder usarlo. */
function siguienteTramo(finAnterior) {
  const [h, m] = (finAnterior || '14:00').split(':').map(Number)
  const minutos = Math.min(h * 60 + m + 120, 23 * 60 + 59)
  const dos = n => String(n).padStart(2, '0')
  return {
    desde: finAnterior || '14:00',
    hasta: `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`,
  }
}

/** Acepta la forma vieja —un rango para varios días— para no perder lo que ya
 *  estaba configurado. */
function aPorDia(valor) {
  if (valor?.porDia) return valor.porDia
  if (valor?.dias) {
    const tramo = [{ desde: valor.desde || '09:00', hasta: valor.hasta || '19:00' }]
    return Object.fromEntries(valor.dias.map(d => [d, tramo]))
  }
  return { 1: [{ desde: '09:00', hasta: '19:00' }], 2: [{ desde: '09:00', hasta: '19:00' }],
           3: [{ desde: '09:00', hasta: '19:00' }], 4: [{ desde: '09:00', hasta: '19:00' }],
           5: [{ desde: '09:00', hasta: '19:00' }] }
}

function HorariosDeAtencion({ valor, onChange }) {
  const porDia = aPorDia(valor)
  const escribir = (nuevo) => onChange({ porDia: nuevo })

  const tramosDe = (d) => porDia[d] || []
  const setTramos = (d, tramos) => {
    const copia = { ...porDia }
    if (tramos.length) copia[d] = tramos
    else delete copia[d]
    escribir(copia)
  }

  const abrirDia = (d) => setTramos(d, [{ ...TRAMO_NUEVO }])
  const cerrarDia = (d) => setTramos(d, [])

  const copiarATodos = (d) => {
    const tramos = tramosDe(d)
    if (!tramos.length) return
    const copia = {}
    // Solo a los días que ya están abiertos: copiar un horario a un domingo
    // que estaba cerrado sería abrir el negocio sin que nadie lo pidiera.
    for (const dia of Object.keys(porDia)) copia[dia] = tramos.map(t => ({ ...t }))
    escribir(copia)
    toast.success('Horario copiado a los días abiertos')
  }

  const abiertos = DIAS.filter(d => tramosDe(d.n).length)

  return (
    <Section title="Horarios de atención" desc="Los únicos días y horas en que el agente puede agendar">
      <div className="flex flex-col gap-2">
        {DIAS.map(({ n, corto, largo }) => {
          const tramos = tramosDe(n)
          const abierto = tramos.length > 0
          return (
            <div key={n} className={`rounded-[10px] border px-3 py-2.5 transition-all ${
              abierto ? 'border-black/[0.08] bg-surface' : 'border-transparent bg-surface-2'
            }`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => (abierto ? cerrarDia(n) : abrirDia(n))}
                  className={`w-[52px] py-1.5 rounded-lg text-[11.5px] font-bold transition-all flex-shrink-0 ${
                    abierto ? 'bg-accent-blue text-white' : 'bg-surface text-tertiary border border-black/[0.08]'
                  }`}
                  title={abierto ? `Cerrar ${largo.toLowerCase()}` : `Abrir ${largo.toLowerCase()}`}
                >
                  {corto}
                </button>

                {!abierto ? (
                  <span className="text-[12px] text-tertiary">Cerrado</span>
                ) : (
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    {tramos.map((t, i) => (
                      <div key={i} className="flex items-center gap-1.5 flex-wrap">
                        <input type="time" className="input text-[13px] py-1 w-[104px]" value={t.desde}
                          onChange={e => setTramos(n, tramos.map((x, j) => (j === i ? { ...x, desde: e.target.value } : x)))} />
                        <span className="text-[11px] text-tertiary">a</span>
                        <input type="time" className="input text-[13px] py-1 w-[104px]" value={t.hasta}
                          onChange={e => setTramos(n, tramos.map((x, j) => (j === i ? { ...x, hasta: e.target.value } : x)))} />
                        {t.hasta <= t.desde && (
                          <span className="text-[10.5px] text-red-500">el cierre va después de la apertura</span>
                        )}
                        {tramos.length > 1 && (
                          <button onClick={() => setTramos(n, tramos.filter((_, j) => j !== i))}
                            title="Quitar este tramo"
                            className="text-tertiary hover:text-red-500 p-0.5"><X size={13} /></button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-3">
                      <button onClick={() => setTramos(n, [...tramos, siguienteTramo(tramos[tramos.length - 1].hasta)])}
                        className="text-[11px] text-accent-blue hover:underline flex items-center gap-1">
                        <Plus size={11} /> Otro tramo
                      </button>
                      {abiertos.length > 1 && (
                        <button onClick={() => copiarATodos(n)}
                          className="text-[11px] text-tertiary hover:text-primary">
                          Copiar a los demás días
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-tertiary mt-3">
        Un día sin horario queda cerrado. Si cierran al mediodía, agregá un segundo tramo en vez de estirar el primero:
        el agente no ofrece nada en el hueco del medio.
      </p>
    </Section>
  )
}

export { Minutos, HorariosDeAtencion }
