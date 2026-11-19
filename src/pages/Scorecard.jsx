/* Scorecard — el análisis profundo de un periodo.
 *
 * Una corrida toma un periodo, calcula los números duros, lee cada
 * conversación y escribe la lectura del Gerente de resultados. Lo que sale se
 * congela: se puede volver a correr, pero nadie puede editar una corrida.
 *
 * El periodo es libre —desde y hasta—, porque a veces se quiere mirar un mes,
 * a veces seis semanas, y a veces un cliente nuevo desde el día uno.
 */
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { Gauge, Loader2, Play, Presentation, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  useCorridas, correrAnalisis, reanudarAnalisis, pareceTrabada, quietaDesde, FASES, enCurso, periodoTexto, numero,
} from '@/features/scorecard/useScorecards'
import { Numeros, Rescate, Conversaciones, ParaElAgente, Metodo, Tarjeta, Pildora } from '@/features/scorecard/Vistas'
import PresentacionView from '@/features/scorecard/Presentacion'

const PESTANAS = [
  { id: 'resumen', nombre: 'Resumen' },
  { id: 'numeros', nombre: 'Números' },
  { id: 'rescate', nombre: 'Rescate' },
  { id: 'conversaciones', nombre: 'Conversaciones' },
  { id: 'agente', nombre: 'Para el agente' },
  { id: 'metodo', nombre: 'Método' },
]

const aFecha = (d) => {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

function atajos() {
  const hoy = new Date()
  const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 29)
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const finPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
  return [
    { id: '30', nombre: 'Últimos 30 días', desde: aFecha(hace30), hasta: aFecha(hoy) },
    { id: 'mes', nombre: 'Este mes', desde: aFecha(inicioMes), hasta: aFecha(hoy) },
    { id: 'pasado', nombre: 'Mes pasado', desde: aFecha(inicioPasado), hasta: aFecha(finPasado) },
  ]
}

const COLOR_ESTADO = { listo: '#00a846', error: '#d92d20' }

const claseCampo =
  'rounded-[8px] border border-black/[0.08] bg-surface-2 px-3 py-2 text-[13px] text-primary outline-none focus:border-primary/40'

/* ── Avance de una corrida en curso ─────────────────────────────────── */

function haceCuanto(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `hace ${s} s`
  const m = Math.round(s / 60)
  return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`
}

function Avance({ corrida, orgId }) {
  /* Se redibuja cada 15 segundos para que «hace cuánto» avance solo: sin
     eso, un análisis que trabaja en silencio se ve igual que uno detenido. */
  const [, setTic] = useState(0)
  useEffect(() => { const t = setInterval(() => setTic(x => x + 1), 15000); return () => clearInterval(t) }, [])
  const [reanudando, setReanudando] = useState(false)
  const trabada = pareceTrabada(corrida)
  const reanudar = async () => {
    setReanudando(true)
    try { await reanudarAnalisis(orgId, corrida.id); toast.success('Reanudado: sigue desde donde iba') }
    catch (e) { toast.error(e.message) }
    finally { setReanudando(false) }
  }
  const fase = FASES[corrida.estado] || FASES.en_cola
  const p = corrida.progreso || {}
  const total = p.conversaciones || 0
  const pctLeidas = total ? Math.round((p.leidas / total) * 100) : 0
  return (
    <Tarjeta titulo="Analizando" nota="Puedes cerrar esta pantalla: el análisis sigue en el servidor y aparece aquí cuando termina.">
      <div className="flex flex-col gap-2">
        {['datos', 'conversaciones', 'agregando', 'escribiendo'].map(id => {
          const f = FASES[id]
          const hecha = fase.paso > f.paso
          const actual = corrida.estado === id
          return (
            <div key={id} className="flex items-center gap-2.5 text-[13px]">
              <span className={clsx('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                hecha ? 'bg-[#00a846] text-white' : actual ? 'bg-[#0066ff] text-white' : 'bg-black/[0.06] text-tertiary')}>
                {actual ? <Loader2 size={11} className="animate-spin" /> : hecha ? '✓' : f.paso}
              </span>
              <span className={clsx(actual ? 'font-semibold text-primary' : hecha ? 'text-secondary' : 'text-tertiary')}>{f.nombre}</span>
              {id === 'conversaciones' && total > 0 && (actual || hecha) && (
                <span className="num text-tertiary">{numero(p.leidas)} de {numero(total)}</span>
              )}
            </div>
          )
        })}
      </div>
      {corrida.estado === 'conversaciones' && total > 0 && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.05]">
          <div className="h-full rounded-full bg-[#0066ff] transition-all" style={{ width: `${pctLeidas}%` }} />
        </div>
      )}
      <p className="text-[12px] text-tertiary">Último movimiento: {haceCuanto(quietaDesde(corrida))}</p>
      {corrida.estado === 'escribiendo' && !trabada && (
        <p className="text-[12px] leading-relaxed text-tertiary">Escribir el reporte toma varios minutos y no avisa mientras tanto. Es normal que esto se vea quieto.</p>
      )}
      {trabada && (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border px-3 py-2.5 text-[12.5px]"
          style={{ background: 'rgba(245,158,11,0.09)', borderColor: 'rgba(245,158,11,0.35)', color: '#8a5a00' }}>
          <span className="flex-1">{corrida.estado === 'en_cola' ? 'El análisis no arrancó.' : 'Parece detenido.'} Se puede reanudar desde donde iba, sin repetir lo que ya hizo.</span>
          <button onClick={reanudar} disabled={reanudando} className="rounded-[8px] bg-[#0066ff] px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40">
            {reanudando ? 'Reanudando…' : 'Reanudar'}
          </button>
        </div>
      )}
    </Tarjeta>
  )
}

/* ── Resumen ────────────────────────────────────────────────────────── */

function Resumen({ corrida, onPresentar }) {
  const r = corrida.reporte
  if (!r) {
    return <Tarjeta><p className="text-[12.5px] text-tertiary">El resumen aparece cuando termina el reporte. Los números ya están en la pestaña Números.</p></Tarjeta>
  }
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta>
        <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary">{periodoTexto(corrida)}</span>
        <h2 className="font-display text-[22px] font-extrabold leading-tight text-primary">{r.titular}</h2>
        <p className="text-[14px] leading-relaxed text-secondary">{r.resumen}</p>
        <button onClick={onPresentar} className="flex w-fit items-center gap-1.5 rounded-[10px] bg-[#0066ff] px-4 py-2 text-[13px] font-bold text-white">
          <Presentation size={15} /> Presentar
        </button>
      </Tarjeta>

      {r.advertencias?.length > 0 && (
        <div className="flex gap-2 rounded-[12px] border px-4 py-3 text-[12.5px] leading-relaxed"
          style={{ background: 'rgba(245,158,11,0.09)', borderColor: 'rgba(245,158,11,0.35)', color: '#8a5a00' }}>
          <AlertTriangle size={15} className="mt-[2px] shrink-0" />
          <ul className="flex flex-col gap-1">{r.advertencias.map(a => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      {r.cuello_de_botella && (
        <Tarjeta titulo="Donde mejorar vale más">
          <span className="font-display text-[16px] font-bold text-primary">{r.cuello_de_botella.paso}</span>
          <p className="text-[13.5px] leading-relaxed text-secondary">{r.cuello_de_botella.por_que}</p>
          <p className="text-[13.5px] leading-relaxed text-primary"><strong>Lo que se gana: </strong>{r.cuello_de_botella.impacto}</p>
        </Tarjeta>
      )}

      <Tarjeta titulo="El plan">
        <div className="grid gap-2 sm:grid-cols-2">
          {(r.plan?.metas || []).map(m => (
            <div key={m.indicador} className="rounded-[10px] border border-black/[0.06] bg-surface-2 px-3 py-2 text-[13px]">
              <div className="font-semibold text-primary">{m.indicador}</div>
              <div className="text-tertiary">{m.hoy} → <strong className="text-primary">{m.meta}</strong></div>
            </div>
          ))}
        </div>
      </Tarjeta>
    </div>
  )
}

/* ── Pantalla ───────────────────────────────────────────────────────── */

export default function Scorecard() {
  const { org } = useAuthStore()
  const orgId = org?.id
  const { corridas, cargando, error } = useCorridas(orgId)
  const [elegida, setElegida] = useState(null)
  const [pestana, setPestana] = useState('resumen')
  const [presentando, setPresentando] = useState(false)
  const [lanzando, setLanzando] = useState(false)

  const opciones = atajos()
  const [desde, setDesde] = useState(opciones[0].desde)
  const [hasta, setHasta] = useState(opciones[0].hasta)

  /* Sin elección, se muestra la más reciente. */
  useEffect(() => {
    if (!elegida && corridas.length) setElegida(corridas[0].id)
  }, [corridas, elegida])

  const corrida = corridas.find(c => c.id === elegida) || null
  /* Una trabada no bloquea: el servidor tampoco la cuenta como viva. */
  const hayUnaCorriendo = corridas.some(c => enCurso(c.estado) && !pareceTrabada(c))

  const lanzar = async () => {
    const d = new Date(`${desde}T00:00:00`).getTime()
    const h = new Date(`${hasta}T23:59:59`).getTime()
    if (!(d < h)) return toast.error('«Desde» tiene que ser antes que «hasta».')
    setLanzando(true)
    try {
      const id = await correrAnalisis(orgId, d, h)
      setElegida(id)
      setPestana('resumen')
      toast.success('Análisis en marcha')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLanzando(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Gauge size={20} className="text-tertiary" />
          <h1 className="text-[22px] font-bold text-primary">Scorecard</h1>
        </div>
      </div>

      {/* El periodo */}
      <Tarjeta titulo="Analizar un periodo" nota="Lee los números y cada conversación del periodo. Tarda unos minutos, según cuántas conversaciones haya.">
        <div className="flex flex-wrap items-center gap-2">
          {opciones.map(o => (
            <button
              key={o.id}
              onClick={() => { setDesde(o.desde); setHasta(o.hasta) }}
              className={clsx('rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors',
                desde === o.desde && hasta === o.hasta ? 'border-transparent bg-primary text-white' : 'border-black/[0.1] text-secondary hover:text-primary')}
            >
              {o.nombre}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-tertiary">
            Desde
            <input id="sc-desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} className={claseCampo} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-tertiary">
            Hasta
            <input id="sc-hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={claseCampo} />
          </label>
          <button
            onClick={lanzar}
            disabled={lanzando || hayUnaCorriendo || !orgId}
            className="flex items-center gap-1.5 rounded-[10px] bg-[#0066ff] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40"
          >
            {lanzando ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Correr análisis
          </button>
          {hayUnaCorriendo && <span className="text-[12px] text-tertiary">Hay un análisis corriendo. Espera a que termine.</span>}
        </div>
      </Tarjeta>

      {error && <p className="text-[12.5px] text-[#d92d20]">{error}</p>}
      {cargando && <div className="flex justify-center py-8 text-tertiary"><Loader2 className="animate-spin" /></div>}

      {/* Las corridas anteriores */}
      {corridas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {corridas.map(c => (
            <button
              key={c.id}
              onClick={() => { setElegida(c.id); setPestana('resumen') }}
              className={clsx('flex shrink-0 flex-col items-start gap-1 rounded-[12px] border px-3 py-2 text-left transition-colors',
                c.id === elegida ? 'border-[#0066ff] bg-surface' : 'border-black/[0.08] bg-surface hover:border-black/20')}
            >
              <span className="text-[12.5px] font-semibold text-primary">{periodoTexto(c)}</span>
              <Pildora color={COLOR_ESTADO[c.estado] || '#0066ff'}>{FASES[c.estado]?.nombre || c.estado}</Pildora>
            </button>
          ))}
        </div>
      )}

      {!cargando && corridas.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-black/[0.12] py-12 text-center">
          <Gauge size={26} className="text-tertiary" />
          <div className="text-[14px] font-semibold text-primary">Todavía no hay análisis</div>
          <p className="max-w-[440px] text-[12.5px] leading-relaxed text-tertiary">
            Elige un periodo y córrelo. Vas a ver la cadena de conversión, quién está atorado, a quién rescatar y qué dijeron los clientes en sus conversaciones.
          </p>
        </div>
      )}

      {corrida && (
        <div className="flex flex-col gap-4">
          {enCurso(corrida.estado) && <Avance corrida={corrida} orgId={orgId} />}

          {corrida.estado === 'error' && (
            <div className="flex gap-2 rounded-[12px] border px-4 py-3 text-[13px] leading-relaxed"
              style={{ background: 'rgba(217,45,32,0.06)', borderColor: 'rgba(217,45,32,0.3)', color: '#9b1c14' }}>
              <AlertTriangle size={15} className="mt-[2px] shrink-0" />
              <div><strong>El análisis falló.</strong> {corrida.motivo}</div>
            </div>
          )}

          {(corrida.metricas || corrida.reporte) && (
            <>
              <div className="flex gap-1 overflow-x-auto border-b border-black/[0.08]">
                {PESTANAS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPestana(p.id)}
                    className={clsx('-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors',
                      pestana === p.id ? 'border-[#0066ff] text-primary' : 'border-transparent text-tertiary hover:text-primary')}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
              {pestana === 'resumen' && <Resumen corrida={corrida} onPresentar={() => setPresentando(true)} />}
              {pestana === 'numeros' && <Numeros corrida={corrida} />}
              {pestana === 'rescate' && <Rescate corrida={corrida} />}
              {pestana === 'conversaciones' && <Conversaciones corrida={corrida} />}
              {pestana === 'agente' && <ParaElAgente corrida={corrida} />}
              {pestana === 'metodo' && <Metodo corrida={corrida} />}
            </>
          )}
        </div>
      )}

      {presentando && corrida?.reporte && (
        <PresentacionView corrida={corrida} onCerrar={() => setPresentando(false)} />
      )}
    </div>
  )
}
