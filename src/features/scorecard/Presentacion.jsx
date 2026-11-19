/* La presentación del periodo, en modo filmina.
 *
 * La estructura es fija a propósito: siempre las mismas láminas, en el mismo
 * orden. Al tercer mes, quien la ve ya sabe dónde mirar, y comparar un periodo
 * con otro es pasar las mismas láminas.
 *
 * Los números salen del cálculo; el modelo solo escribió los textos. Esta
 * pantalla no inventa ni redondea nada.
 */
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react'
import { porcentaje, numero, periodoTexto, RESPONSABLES, QUIEN_RESPONDE } from './useScorecards'
import { MapaDeCalor } from './Vistas'

function Lamina({ etiqueta, titulo, children }) {
  return (
    <div className="flex h-full w-full flex-col gap-5 overflow-y-auto px-8 py-8 sm:px-14 sm:py-12">
      {etiqueta && <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#1AAB99]">{etiqueta}</span>}
      {titulo && <h2 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-white sm:text-[38px]">{titulo}</h2>}
      <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-white/80 sm:text-[17px]">{children}</div>
    </div>
  )
}

const Grande = ({ valor, nota }) => (
  <div className="flex flex-col">
    <span className="font-display text-[64px] font-extrabold leading-none tracking-tight text-white sm:text-[96px]">{valor}</span>
    {nota && <span className="mt-2 text-[15px] text-white/60">{nota}</span>}
  </div>
)

const Bloque = ({ titulo, children }) => (
  <div className="flex flex-col gap-1 rounded-[14px] bg-white/[0.06] px-4 py-3">
    <span className="text-[11px] font-bold uppercase tracking-wide text-white/50">{titulo}</span>
    <span className="text-white/90">{children}</span>
  </div>
)

/** Las láminas, en orden. Las que no tienen con qué llenarse no aparecen. */
export function laminasDe(c) {
  const r = c.reporte || {}
  const m = c.metricas || {}
  const total = m.conversiones?.total
  const l = []

  l.push(
    <Lamina key="portada" etiqueta={`${c.organizacion?.nombre || ''} · ${periodoTexto(c)}`} titulo={r.titular || 'Scorecard del periodo'}>
      <p>{r.resumen}</p>
    </Lamina>,
  )

  l.push(
    <Lamina key="numero" etiqueta="El número del periodo" titulo="De cada 100 que entran, cuántos compran">
      <Grande
        valor={porcentaje(total?.actual?.puntaAPunta)}
        nota={`${numero(total?.actual?.pasos?.[0]?.valor)} entraron · ${numero(total?.actual?.pasos?.[6]?.valor)} compraron · periodo anterior ${porcentaje(total?.previo?.puntaAPunta)}`}
      />
    </Lamina>,
  )

  l.push(
    <Lamina key="calidad" etiqueta="Antes de leer" titulo={`Confianza en los datos: ${m.calidad?.nivel || '—'}`}>
      <p>{r.calidad_del_dato}</p>
    </Lamina>,
  )

  if (r.cuello_de_botella) {
    l.push(
      <Lamina key="cuello" etiqueta="Donde mejorar vale más" titulo={r.cuello_de_botella.paso}>
        <p>{r.cuello_de_botella.por_que}</p>
        <Bloque titulo="Lo que se gana">{r.cuello_de_botella.impacto}</Bloque>
      </Lamina>,
    )
  }

  if (total?.actual?.pasos) {
    const max = total.actual.pasos[0]?.valor || 1
    l.push(
      <Lamina key="cadena" etiqueta="La cadena" titulo="Paso por paso">
        <div className="flex flex-col gap-2.5">
          {total.actual.pasos.map(p => (
            <div key={p.id} className="grid grid-cols-[minmax(0,170px)_minmax(0,1fr)_auto] items-center gap-3 text-[14px]">
              <span className="truncate text-white/70">{p.nombre}</span>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#1AAB99]" style={{ width: `${Math.max(2, Math.round((p.valor / max) * 100))}%` }} />
              </div>
              <span className="num whitespace-nowrap font-semibold text-white">
                {numero(p.valor)}{p.tasa != null && <span className="ml-2 font-normal text-white/50">{porcentaje(p.tasa)}</span>}
              </span>
            </div>
          ))}
        </div>
      </Lamina>,
    )
  }

  for (const cap of r.capitulos || []) {
    l.push(
      <Lamina key={'cap-' + cap.responsable} etiqueta={`${RESPONSABLES[cap.responsable] || cap.responsable} · ${QUIEN_RESPONDE[cap.responsable] || ''}`} titulo={cap.hallazgo}>
        <p>{cap.causa_probable}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Bloque titulo="Rescate, esta semana">{cap.rescate}</Bloque>
          <Bloque titulo="Corrección del proceso">{cap.correccion}</Bloque>
        </div>
        <Bloque titulo="El indicador">{cap.indicador} → {cap.meta}</Bloque>
      </Lamina>,
    )
  }

  if (r.clientes) {
    l.push(
      <Lamina key="clientes" etiqueta="Lo que dijeron los clientes" titulo={r.clientes.objecion_principal}>
        <p>{r.clientes.lectura}</p>
        {r.clientes.preguntas_clave?.length > 0 && (
          <Bloque titulo="Preguntas que hay que saber contestar">
            <ul className="mt-1 list-disc pl-5">{r.clientes.preguntas_clave.map(p => <li key={p}>{p}</li>)}</ul>
          </Bloque>
        )}
      </Lamina>,
    )
  }

  if (r.reloj) {
    l.push(
      <Lamina key="reloj" etiqueta="El reloj" titulo="Cuándo llegan, cuándo se nos van">
        <p>{r.reloj}</p>
        <div className="rounded-[14px] bg-white p-3"><MapaDeCalor reloj={m.reloj} compacto /></div>
      </Lamina>,
    )
  }

  const conPersonas = (m.bolsas || []).filter(b => b.personas > 0)
  if (conPersonas.length) {
    l.push(
      <Lamina key="rescate" etiqueta="A quién rescatar" titulo="Primero, quien estuvo más cerca de comprar">
        <div className="flex flex-col gap-2">
          {conPersonas.map(b => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.06] px-4 py-2.5">
              <span className="text-white/85">{b.nombre}</span>
              <span className="num font-display text-[24px] font-extrabold text-white">{numero(b.personas)}</span>
            </div>
          ))}
        </div>
      </Lamina>,
    )
  }

  if (r.plan_anterior) {
    l.push(
      <Lamina key="anterior" etiqueta="El periodo anterior" titulo="Cómo nos fue con el plan">
        <p>{r.plan_anterior}</p>
      </Lamina>,
    )
  }

  if (r.plan) {
    l.push(
      <Lamina key="plan" etiqueta="El plan" titulo="Lo que sigue">
        <div className="grid gap-2 sm:grid-cols-2">
          {(r.plan.metas || []).map(x => (
            <Bloque key={x.indicador} titulo={x.indicador}>{x.hoy} → <strong className="text-white">{x.meta}</strong></Bloque>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(r.plan.semanas || []).map(s => (
            <div key={s.semana} className="flex flex-col gap-1.5 rounded-[14px] border border-white/10 px-4 py-3">
              <span className="text-[12px] font-bold uppercase tracking-wide text-[#1AAB99]">{s.semana}</span>
              {(s.acciones || []).map((a, i) => (
                <span key={i} className="text-[14px] text-white/85">
                  {a.accion} <span className="text-white/45">· {RESPONSABLES[a.responsable] || a.responsable}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </Lamina>,
    )
  }

  return l
}

export default function Presentacion({ corrida, onCerrar }) {
  const laminas = laminasDe(corrida)
  const [i, setI] = useState(0)
  const ir = useCallback((d) => setI(x => Math.min(laminas.length - 1, Math.max(0, x + d))), [laminas.length])

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); ir(1) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); ir(-1) }
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ir, onCerrar])

  /* La pantalla completa es una cortesía: si el navegador no la da, la
     presentación igual ocupa toda la ventana. */
  const completa = () => { document.documentElement.requestFullscreen?.().catch(() => {}) }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#050507]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-[12px] font-semibold text-white/40">{i + 1} / {laminas.length}</span>
        <div className="flex items-center gap-1">
          <button onClick={completa} title="Pantalla completa" className="rounded-[8px] p-2 text-white/50 hover:text-white"><Maximize2 size={16} /></button>
          <button onClick={onCerrar} title="Cerrar" className="rounded-[8px] p-2 text-white/50 hover:text-white"><X size={18} /></button>
        </div>
      </div>
      <div className="relative mx-auto flex min-h-0 w-full max-w-[1100px] flex-1">
        {laminas[i]}
      </div>
      <div className="flex items-center justify-center gap-3 px-5 py-4">
        <button onClick={() => ir(-1)} disabled={i === 0} className="rounded-full border border-white/15 p-2.5 text-white/70 disabled:opacity-25"><ChevronLeft size={18} /></button>
        <div className="flex gap-1.5">
          {laminas.map((_, n) => (
            <button key={n} onClick={() => setI(n)} className="h-1.5 rounded-full transition-all" style={{ width: n === i ? 22 : 6, background: n === i ? '#1AAB99' : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
        <button onClick={() => ir(1)} disabled={i === laminas.length - 1} className="rounded-full border border-white/15 p-2.5 text-white/70 disabled:opacity-25"><ChevronRight size={18} /></button>
      </div>
    </div>
  )
}
