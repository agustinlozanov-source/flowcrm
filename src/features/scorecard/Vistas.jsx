/* Las vistas de una corrida del Scorecard.
 *
 * Los números de aquí salen tal cual del documento que escribió el servidor.
 * La pantalla no calcula porcentajes propios ni redondea distinto: si dos
 * personas miran la misma corrida, ven exactamente lo mismo.
 */
import { useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { Copy, MessageCircle, AlertTriangle } from 'lucide-react'
import { porcentaje, numero, fechaCorta, RESPONSABLES } from './useScorecards'

/* ── Piezas chicas ──────────────────────────────────────────────────── */

export function Tarjeta({ titulo, nota, children, className }) {
  return (
    <section className={clsx('flex flex-col gap-3 rounded-[14px] border border-black/[0.07] bg-surface p-5', className)}>
      {(titulo || nota) && (
        <div className="flex flex-col gap-0.5">
          {titulo && <h3 className="font-display text-[15px] font-bold text-primary">{titulo}</h3>}
          {nota && <p className="text-[12px] leading-relaxed text-tertiary">{nota}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Pildora({ children, color }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-bold"
      style={{ color: color || 'var(--text-tertiary)', borderColor: color || 'var(--border)' }}
    >
      {children}
    </span>
  )
}

const COLOR_NIVEL = { alta: '#00a846', media: '#c47000', baja: '#d92d20' }

/** Diferencia contra el periodo anterior, en puntos. Verde si mejora. */
function Delta({ actual, previo }) {
  if (actual == null || previo == null) return null
  const d = Math.round((actual - previo) * 10) / 10
  if (d === 0) return <span className="text-[11px] text-tertiary">igual</span>
  return (
    <span className="text-[11px] font-semibold" style={{ color: d > 0 ? '#00a846' : '#d92d20' }}>
      {d > 0 ? '+' : ''}{d.toLocaleString('es-MX')} pts
    </span>
  )
}

function Barra({ valor, max, color = '#0066ff' }) {
  const ancho = max > 0 ? Math.max(2, Math.round((valor / max) * 100)) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.05]">
      <div className="h-full rounded-full" style={{ width: `${ancho}%`, background: color }} />
    </div>
  )
}

function Vacio({ children }) {
  return <p className="text-[12.5px] leading-relaxed text-tertiary">{children}</p>
}

const nombreMiembro = (corrida, uid) => corrida.miembros?.find(m => m.uid === uid)?.nombre || (uid ? 'Sin nombre' : 'Sin responsable')

/* ── Números ────────────────────────────────────────────────────────── */

function Calidad({ calidad }) {
  if (!calidad) return null
  return (
    <Tarjeta
      titulo="Cuánto confiar en estos números"
      nota="Lo primero que hay que leer. La confianza la marca el peor chequeo: un hueco grande en un dato invalida los números que dependen de él."
    >
      <div className="flex items-center gap-2">
        <Pildora color={COLOR_NIVEL[calidad.nivel]}>Confianza {calidad.nivel}</Pildora>
      </div>
      <div className="flex flex-col divide-y divide-black/[0.06]">
        {calidad.chequeos.map(c => (
          <div key={c.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
            <span className="text-secondary">{c.nombre}</span>
            <span className="whitespace-nowrap font-semibold text-primary">
              {numero(c.malos)} de {numero(c.total)} <span className="font-normal text-tertiary">({porcentaje(c.porcentaje)})</span>
            </span>
          </div>
        ))}
      </div>
    </Tarjeta>
  )
}

function Cadena({ conversiones }) {
  const opciones = [{ id: '__total__', nombre: 'Todos los embudos' }, ...(conversiones?.porEmbudo || []).map(e => ({ id: e.pipelineId, nombre: e.nombre }))]
  const [eleccion, setEleccion] = useState('__total__')
  if (!conversiones) return null
  const datos = eleccion === '__total__' ? conversiones.total : conversiones.porEmbudo.find(e => e.pipelineId === eleccion)
  const pasos = datos?.actual?.pasos || []
  const previos = datos?.previo?.pasos || []
  const max = pasos[0]?.valor || 0

  return (
    <Tarjeta
      titulo="La cadena de conversión"
      nota="Los leads que entraron en el periodo, seguidos hasta donde llegaron hoy. Cada tasa es contra el paso anterior; la asistencia, contra quienes ya tuvieron su cita."
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={eleccion}
          onChange={e => setEleccion(e.target.value)}
          className="rounded-[8px] border border-black/[0.08] bg-surface-2 px-3 py-1.5 text-[13px] text-primary outline-none"
        >
          {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <span className="text-[12.5px] text-tertiary">
          De punta a punta: <strong className="text-primary">{porcentaje(datos?.actual?.puntaAPunta)}</strong>{' '}
          <Delta actual={datos?.actual?.puntaAPunta} previo={datos?.previo?.puntaAPunta} />
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {pasos.map((p, i) => (
          <div key={p.id} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_auto] items-center gap-3">
            <span className="truncate text-[13px] text-secondary">{p.nombre}</span>
            <Barra valor={p.valor} max={max} color={i === pasos.length - 1 ? '#00a846' : '#0066ff'} />
            <span className="num whitespace-nowrap text-right text-[13px]">
              <strong className="text-primary">{numero(p.valor)}</strong>
              {p.tasa != null && <span className="ml-2 text-tertiary">{porcentaje(p.tasa)}</span>}
              {p.tasa != null && <span className="ml-2"><Delta actual={p.tasa} previo={previos[i]?.tasa} /></span>}
            </span>
          </div>
        ))}
      </div>
      {datos?.actual?.citasPorOcurrir > 0 && (
        <Vacio>{numero(datos.actual.citasPorOcurrir)} leads tienen una cita que todavía no ocurre; no cuentan para la asistencia.</Vacio>
      )}
      {conversiones.sinEmbudo > 0 && eleccion === '__total__' && (
        <Vacio>{numero(conversiones.sinEmbudo)} leads del periodo no tienen embudo asignado.</Vacio>
      )}
    </Tarjeta>
  )
}

function Etapas({ etapas }) {
  if (!etapas?.length) return null
  return (
    <Tarjeta
      titulo="Quién está atorado, y dónde"
      nota="Una foto de hoy. «Sin movimiento» cuenta desde el último mensaje o cambio del lead; atorado es más de 7 días así."
    >
      {etapas.map(e => (
        <div key={e.pipelineId} className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-wide text-tertiary">{e.nombre}</span>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-tertiary">
                  <th className="py-1.5 pr-3 font-semibold">Etapa</th>
                  <th className="py-1.5 pr-3 font-semibold">Fase</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Personas</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Score promedio</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Días sin movimiento</th>
                  <th className="py-1.5 text-right font-semibold">Atorados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {e.filas.map(f => (
                  <tr key={f.stageId || f.nombre}>
                    <td className="py-1.5 pr-3 text-primary">{f.nombre}</td>
                    <td className="py-1.5 pr-3 capitalize text-tertiary">{f.fase}</td>
                    <td className="num py-1.5 pr-3 text-right font-semibold text-primary">{numero(f.personas)}</td>
                    <td className="num py-1.5 pr-3 text-right text-secondary">
                      {f.personas ? `${numero(f.scorePromedio)} (${f.scoreMin}–${f.scoreMax})` : '—'}
                    </td>
                    <td className="num py-1.5 pr-3 text-right text-secondary">{f.personas ? numero(f.diasSinMovimiento) : '—'}</td>
                    <td className="num py-1.5 text-right font-semibold" style={{ color: f.atorados ? '#d92d20' : 'var(--text-tertiary)' }}>
                      {numero(f.atorados)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </Tarjeta>
  )
}

function Asistencia({ asistencia }) {
  if (!asistencia || !asistencia.citas) return null
  const a = asistencia
  return (
    <Tarjeta
      titulo="Asistencia"
      nota="Las citas cuya fecha cayó en el periodo y ya pasó. La tasa es sobre las que alguien marcó; las que nadie marcó se cuentan aparte."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Asistencia', porcentaje(a.tasa)], ['Asistieron', numero(a.asistieron)],
          ['Faltaron', numero(a.faltaron)], ['Sin marcar', numero(a.sinMarcar)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[10px] border border-black/[0.06] bg-surface-2 px-3 py-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-tertiary">{k}</div>
            <div className="num text-[18px] font-bold text-primary">{v}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary">Según quién agendó</span>
          {[['El agente', a.porQuienAgendo.agente], ['Una persona', a.porQuienAgendo.persona]].map(([k, c]) => (
            <div key={k} className="flex justify-between text-[13px]">
              <span className="text-secondary">{k}</span>
              <span className="num"><strong className="text-primary">{porcentaje(c.asistencia)}</strong> <span className="text-tertiary">de {numero(c.marcadas)}</span></span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary">Según la anticipación</span>
          {a.anticipacion.filter(x => x.citas).map(x => (
            <div key={x.id} className="flex justify-between text-[13px]">
              <span className="text-secondary">{x.nombre}</span>
              <span className="num"><strong className="text-primary">{porcentaje(x.asistencia)}</strong> <span className="text-tertiary">de {numero(x.marcadas)}</span></span>
            </div>
          ))}
        </div>
      </div>
    </Tarjeta>
  )
}

const CAPAS = [
  { id: 'entrantes', nombre: 'Mensajes que llegan', color: '0,102,255' },
  { id: 'tardias', nombre: 'Atendidos tarde', color: '217,45,32' },
  { id: 'citasCreadas', nombre: 'Citas agendadas', color: '0,168,70' },
  { id: 'perdidas', nombre: 'Conversaciones perdidas', color: '196,112,0' },
]

export function MapaDeCalor({ reloj, capa: capaInicial = 'entrantes', compacto = false }) {
  const [capa, setCapa] = useState(capaInicial)
  if (!reloj?.capas) return null
  const m = reloj.capas[capa] || []
  const max = Math.max(1, ...m.flat())
  const c = CAPAS.find(x => x.id === capa)
  return (
    <div className="flex flex-col gap-2">
      {!compacto && (
        <div className="flex flex-wrap gap-1.5">
          {CAPAS.map(x => (
            <button
              key={x.id}
              onClick={() => setCapa(x.id)}
              className={clsx('rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                capa === x.id ? 'border-transparent bg-primary text-white' : 'border-black/[0.1] text-secondary hover:text-primary')}
            >
              {x.nombre}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-[2px]" style={{ gridTemplateColumns: '34px repeat(24, minmax(0, 1fr))' }}>
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-[9px] text-tertiary">{h % 3 === 0 ? h : ''}</span>
          ))}
          {m.map((fila, d) => [
            <span key={'d' + d} className="pr-1 text-right text-[10px] leading-[18px] text-tertiary">{reloj.dias[d]}</span>,
            ...fila.map((v, h) => (
              <span
                key={d + '-' + h}
                title={`${reloj.dias[d]} ${h}:00 — ${v}`}
                className="h-[18px] rounded-[3px]"
                style={{ background: v ? `rgba(${c.color},${0.12 + 0.88 * (v / max)})` : 'rgba(0,0,0,0.035)' }}
              />
            )),
          ])}
        </div>
      </div>
    </div>
  )
}

function Reloj({ reloj }) {
  if (!reloj?.capas) {
    return <Tarjeta titulo="El reloj"><Vacio>El mapa de horarios aparece cuando termina la lectura de las conversaciones.</Vacio></Tarjeta>
  }
  const hora = (h) => (h == null ? '—' : `${h}:00`)
  return (
    <Tarjeta
      titulo="El reloj"
      nota={`En la zona horaria del negocio (${reloj.zona}). «Atendido tarde» es más de ${reloj.respuestaTardeMin} minutos sin respuesta; una ráfaga de mensajes seguidos cuenta como una sola espera.`}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Espera mediana', reloj.esperaMedianaMin == null ? '—' : `${reloj.esperaMedianaMin} min`],
          ['Hora pico de mensajes', hora(reloj.picos.entrantes)],
          ['Hora con más esperas', hora(reloj.picos.tardias)],
          ['Hora con más pérdidas', hora(reloj.picos.perdidas)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[10px] border border-black/[0.06] bg-surface-2 px-3 py-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-tertiary">{k}</div>
            <div className="num text-[17px] font-bold text-primary">{v}</div>
          </div>
        ))}
      </div>
      <MapaDeCalor reloj={reloj} />
    </Tarjeta>
  )
}

export function Numeros({ corrida }) {
  const m = corrida.metricas
  if (!m) return <Vacio>Los números aparecen en cuanto termina la primera fase.</Vacio>
  return (
    <div className="flex flex-col gap-4">
      <Calidad calidad={m.calidad} />
      <Cadena conversiones={m.conversiones} />
      <Etapas etapas={m.etapas} />
      <Asistencia asistencia={m.asistencia} />
      <Reloj reloj={m.reloj} />
    </div>
  )
}

/* ── Rescate ────────────────────────────────────────────────────────── */

export function Rescate({ corrida }) {
  const guion = Object.fromEntries((corrida.reporte?.rescate || []).map(r => [r.bolsa, r]))
  /* Un solo orden: el que propuso el reporte, y detrás las bolsas que no
     mencionó, en su orden de cercanía a la compra. La prioridad que se
     muestra es la posición, para que no haya dos «prioridad 1». */
  const bolsas = (corrida.metricas?.bolsas || [])
    .map((b, i) => ({ ...b, _orden: guion[b.id]?.prioridad ?? 1000 + i }))
    .sort((a, b) => a._orden - b._orden)
  const recuperados = corrida.metricas?.recuperados
  const [abierta, setAbierta] = useState(null)

  return (
    <div className="flex flex-col gap-4">
      {recuperados?.length > 0 && (
        <Tarjeta titulo="Cómo nos fue con el rescate anterior" nota="Cuántas personas de cada bolsa del reporte anterior salieron por la vía buena.">
          {recuperados.filter(r => r.eran).map(r => (
            <div key={r.id} className="flex justify-between gap-3 text-[13px]">
              <span className="text-secondary">{r.nombre}</span>
              <span className="num"><strong className="text-primary">{numero(r.recuperados)}</strong> <span className="text-tertiary">de {numero(r.eran)} ({porcentaje(r.tasa)})</span></span>
            </div>
          ))}
        </Tarjeta>
      )}

      {bolsas.map((b, i) => (
        <Tarjeta key={b.id}>
          <button onClick={() => setAbierta(abierta === b.id ? null : b.id)} className="flex items-start justify-between gap-3 text-left">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-tertiary">Prioridad {i + 1}</span>
              <span className="font-display text-[15px] font-bold text-primary">{b.nombre}</span>
              <span className="text-[12.5px] text-tertiary">{b.accion}</span>
            </div>
            <span className="num text-[26px] font-bold leading-none" style={{ color: b.personas ? '#d92d20' : 'var(--text-tertiary)' }}>
              {numero(b.personas)}
            </span>
          </button>

          {guion[b.id]?.que_decir && (
            <div className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-secondary">
              <strong className="text-primary">Qué decirles: </strong>{guion[b.id].que_decir}
            </div>
          )}

          {abierta === b.id && (
            <div className="flex flex-col divide-y divide-black/[0.05]">
              {(b.lista || []).map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-primary">{p.nombre}</span>
                    <span className="text-[11.5px] text-tertiary">
                      {p.detalle}{p.desde ? ` · ${fechaCorta(p.desde)}` : ''} · {nombreMiembro(corrida, p.responsable)}
                    </span>
                  </div>
                  <a href={`/inbox?lead=${p.id}`} className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#0066ff] hover:underline">
                    <MessageCircle size={13} /> Conversación
                  </a>
                </div>
              ))}
              {b.personas > (b.lista || []).length && (
                <Vacio>Se muestran los {numero((b.lista || []).length)} más recientes de {numero(b.personas)}.</Vacio>
              )}
            </div>
          )}
        </Tarjeta>
      ))}
    </div>
  )
}

/* ── Conversaciones ─────────────────────────────────────────────────── */

function Ejemplos({ lista }) {
  if (!lista?.length) return null
  return (
    <ul className="flex flex-col gap-1 pl-1">
      {lista.map(t => <li key={t} className="text-[12px] leading-relaxed text-tertiary">«{t}»</li>)}
    </ul>
  )
}

export function Conversaciones({ corrida }) {
  const ins = corrida.insights
  if (!ins) return <Vacio>Esto aparece cuando termina la lectura de las conversaciones.</Vacio>
  const maxPreg = Math.max(1, ...ins.preguntas.map(p => p.personas))
  const nubeMax = Math.max(1, ...(ins.vocabulario?.nube || []).map(x => x.n))

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Lo que más preguntaron"
        nota={`Personas que preguntaron por cada tema, de ${numero(ins.leidas)} conversaciones leídas. Cuenta una vez por persona.`}
      >
        {ins.preguntas.map(p => (
          <div key={p.id} className="flex flex-col gap-1">
            <div className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] items-center gap-3">
              <span className="truncate text-[13px] text-secondary">{p.nombre}</span>
              <Barra valor={p.personas} max={maxPreg} />
              <span className="num text-[13px] font-semibold text-primary">{numero(p.personas)}</span>
            </div>
          </div>
        ))}
      </Tarjeta>

      <Tarjeta
        titulo="Lo que el agente no supo contestar"
        nota="Preguntas que se quedaron sin una respuesta clara. Esta lista es la que más rápido mejora al agente."
      >
        {ins.sinRespuesta.length === 0 && <Vacio>No hubo preguntas sin contestar.</Vacio>}
        {ins.sinRespuesta.map(p => (
          <div key={p.id} className="flex flex-col gap-1">
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="font-semibold text-primary">{p.nombre}</span>
              <span className="num text-tertiary">{numero(p.sinRespuesta)} de {numero(p.preguntas)} ({porcentaje(p.porcentajeSinRespuesta)})</span>
            </div>
            <Ejemplos lista={p.ejemplosSinRespuesta} />
          </div>
        ))}
      </Tarjeta>

      <Tarjeta
        titulo="Lo que los frenó"
        nota={`Avanzar es agendar o comprar. En general avanzó el ${porcentaje(ins.tasaAvanceGeneral)}. La objeción que más cuesta es la que más avances resta, que casi nunca es la más frecuente.`}
      >
        {ins.objeciones.length === 0 && <Vacio>No aparecieron objeciones.</Vacio>}
        {ins.objeciones.map(o => (
          <div key={o.id} className="flex flex-col gap-1 rounded-[10px] px-2 py-1.5" style={o.id === ins.objecionQueMasCuesta?.id ? { background: 'rgba(217,45,32,0.06)' } : null}>
            <div className="flex flex-wrap justify-between gap-2 text-[13px]">
              <span className="font-semibold text-primary">
                {o.nombre}{o.id === ins.objecionQueMasCuesta?.id && <span className="ml-2 text-[11px] font-bold text-[#d92d20]">la que más cuesta</span>}
              </span>
              <span className="num text-tertiary">{numero(o.personas)} personas · avanzó el {porcentaje(o.tasaAvance)}</span>
            </div>
            <Ejemplos lista={o.ejemplos.slice(0, 3)} />
          </div>
        ))}
      </Tarjeta>

      <div className="grid gap-4 md:grid-cols-2">
        <Tarjeta titulo="Cuándo salió el precio">
          {ins.momentoDelPrecio.map(x => (
            <div key={x.id} className="flex justify-between gap-3 text-[13px]">
              <span className="text-secondary">{x.nombre}</span>
              <span className="num"><strong className="text-primary">avanzó {porcentaje(x.tasaAvance)}</strong> <span className="text-tertiary">de {numero(x.personas)}</span></span>
            </div>
          ))}
        </Tarjeta>
        <Tarjeta titulo="Dónde se cayó la conversación">
          {ins.caidas.map(x => (
            <div key={x.id} className="flex justify-between gap-3 text-[13px]">
              <span className="text-secondary">{x.nombre}</span>
              <span className="num font-semibold text-primary">{numero(x.personas)}</span>
            </div>
          ))}
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Cómo hablan los que avanzan"
        nota="Frases que usaron al menos tres personas. El primer porcentaje es cuántos de ese grupo la usaron; el segundo, cuántos del otro. Sirven para escribir los anuncios con las palabras del cliente."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[['Los que avanzaron', ins.vocabulario?.frasesDeLosQueAvanzan, '#00a846'], ['Los que no', ins.vocabulario?.frasesDeLosQueNo, '#d92d20']].map(([t, fr, color]) => (
            <div key={t} className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{t}</span>
              {!fr?.length && <Vacio>Todavía no hay frases que se repitan lo suficiente.</Vacio>}
              {fr?.map(f => (
                <div key={f.frase} className="flex justify-between gap-2 text-[12.5px]">
                  <span className="text-primary">«{f.frase}»</span>
                  <span className="num whitespace-nowrap text-tertiary">{porcentaje(f.porcentaje)} <span className="opacity-70">vs {porcentaje(f.porcentajeOtro)}</span></span>
                </div>
              ))}
            </div>
          ))}
        </div>
        {ins.vocabulario?.nube?.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-black/[0.06] pt-3">
            {ins.vocabulario.nube.map(w => (
              <span key={w.palabra} className="text-primary" style={{ fontSize: `${11 + Math.round((w.n / nubeMax) * 15)}px`, opacity: 0.45 + 0.55 * (w.n / nubeMax) }}>
                {w.palabra}
              </span>
            ))}
          </div>
        )}
      </Tarjeta>

      <div className="grid gap-4 md:grid-cols-2">
        <Tarjeta titulo="La competencia que mencionaron">
          {!ins.competencia.length && <Vacio>Nadie mencionó a otro negocio.</Vacio>}
          {ins.competencia.map(c => (
            <div key={c.nombre} className="flex justify-between gap-3 text-[13px]">
              <span className="text-secondary">{c.nombre}</span>
              <span className="num font-semibold text-primary">{numero(c.personas)}</span>
            </div>
          ))}
        </Tarjeta>
        <Tarjeta titulo="Lo que se prometió sin permiso" nota="Descuentos, diagnósticos, garantías o plazos que el negocio ofreció en la conversación.">
          {!ins.promesasIndebidas.total && <Vacio>No se encontraron.</Vacio>}
          {ins.promesasIndebidas.total > 0 && (
            <>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#d92d20]">
                <AlertTriangle size={14} /> {numero(ins.promesasIndebidas.total)} encontradas
              </div>
              <Ejemplos lista={ins.promesasIndebidas.ejemplos} />
            </>
          )}
        </Tarjeta>
      </div>

      {ins.fichasConError > 0 && (
        <Vacio>{numero(ins.fichasConError)} conversaciones no se pudieron leer y no cuentan en lo de arriba.</Vacio>
      )}
    </div>
  )
}

/* ── Para el agente ─────────────────────────────────────────────────── */

export function ParaElAgente({ corrida }) {
  const lecciones = corrida.reporte?.lecciones_agente || []
  const categorias = corrida.reporte?.categorias_propuestas || []
  const copiar = async () => {
    const t = lecciones.map((l, i) => `${i + 1}. ${l.leccion}\n   Por qué: ${l.por_que}`).join('\n\n')
    try { await navigator.clipboard.writeText(t); toast.success('Copiadas') } catch { toast.error('No se pudo copiar') }
  }
  if (!corrida.reporte) return <Vacio>Las lecciones aparecen cuando termina el reporte.</Vacio>
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Lecciones propuestas para el agente"
        nota="Salen de lo que pasó en las conversaciones. Cada una dice qué dato la justifica y qué indicador debería moverse. Todavía no se aplican solas: se aplicarán desde la capa de Lecciones del agente."
      >
        {lecciones.map((l, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-[10px] border border-black/[0.06] bg-surface-2 px-3 py-2.5">
            <span className="text-[13.5px] font-semibold leading-relaxed text-primary">{l.leccion}</span>
            <span className="text-[12px] leading-relaxed text-tertiary"><strong>Por qué:</strong> {l.por_que}</span>
            <span className="text-[12px] text-tertiary"><strong>Indicador:</strong> {l.indicador}</span>
          </div>
        ))}
        {lecciones.length > 0 && (
          <button onClick={copiar} className="flex w-fit items-center gap-1.5 rounded-[8px] border border-black/[0.1] px-3 py-1.5 text-[12.5px] font-semibold text-secondary hover:text-primary">
            <Copy size={13} /> Copiar lecciones
          </button>
        )}
      </Tarjeta>

      {categorias.length > 0 && (
        <Tarjeta
          titulo="Temas nuevos que se repiten"
          nota="Lo que no cupo en ninguna categoría y apareció varias veces. Si se confirma el próximo periodo, conviene volverlo categoría."
        >
          {categorias.map(c => (
            <div key={c.nombre} className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-primary">{c.nombre}</span>
              <Ejemplos lista={c.ejemplos} />
            </div>
          ))}
        </Tarjeta>
      )}
    </div>
  )
}

/* ── Método ─────────────────────────────────────────────────────────── */

export function Metodo({ corrida }) {
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Cómo se calcula cada número">
        <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-secondary">
          <p><strong className="text-primary">Nada se teclea.</strong> Cada número sale de lo que pasó en el sistema —mensajes, citas, actividades, oportunidades— con reglas fijas. Nadie puede escribir un porcentaje: ni el dueño de la cuenta ni FlowHub. Este documento lo escribe solo el servidor, y desde el navegador no se puede modificar.</p>
          <p><strong className="text-primary">Por generación.</strong> La cadena sigue a los leads que entraron en el periodo hasta donde llegaron el día del análisis. No mezcla a la gente de un mes con las ventas de otro.</p>
          <p><strong className="text-primary">Los pasos.</strong> Llegar a Handoff es haber sido entregado a una persona, tener cita o tener una oportunidad. Agendar es tener al menos una cita. Asistir es tener una cita marcada como asistida. Recibir propuesta es tener una oportunidad. Comprar es estar cerrado o tener una oportunidad ganada. Los pasos no se exigen en orden, porque hay negocios que venden sin cita.</p>
          <p><strong className="text-primary">La asistencia</strong> se mide contra las citas que ya ocurrieron y alguien marcó. Las que nadie marcó se cuentan en la confianza de los datos.</p>
          <p><strong className="text-primary">Las bolsas de rescate</strong> cuentan como contacto solo lo que hizo una persona y ya ocurrió: una llamada pendiente o un mensaje automático no sacan a nadie de la bolsa.</p>
          <p><strong className="text-primary">Las conversaciones</strong> las lee un modelo de lenguaje, una por una, y deja una ficha con categorías fijas. El conteo lo hace el código. El modelo que escribe la lectura del periodo recibe los conteos, nunca los nombres de las personas.</p>
          <p><strong className="text-primary">«Sin movimiento»</strong> cuenta desde el último mensaje o cambio del lead. El sistema todavía no guarda la fecha de entrada a cada etapa, así que este es el mejor reloj disponible.</p>
        </div>
      </Tarjeta>

      <Tarjeta titulo="La huella de este reporte" nota="Un resumen matemático del contenido. Si alguien cambiara un solo número guardado, la huella dejaría de coincidir.">
        <code className="break-all rounded-[8px] bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-secondary">{corrida.huella || 'Se calcula al terminar el reporte'}</code>
        <div className="grid gap-1 text-[12px] text-tertiary">
          <span>Versión del método: {corrida.metricas?.versionMetodo ?? '—'}</span>
          {corrida.modelos && <span>Lectura de conversaciones: {corrida.modelos.lectura} · Reporte: {corrida.modelos.reporte}</span>}
          <span>Pedido por: {corrida.creadoPor?.email || '—'}{corrida.creadoPor?.superadmin ? ' (FlowHub)' : ''}</span>
        </div>
      </Tarjeta>

      {corrida.advertencias?.length > 0 && (
        <Tarjeta titulo="Advertencias">
          {corrida.advertencias.map(a => <Vacio key={a}>{a}</Vacio>)}
        </Tarjeta>
      )}
    </div>
  )
}

export { RESPONSABLES }
