/* PIPA — pasa la idea por aquí.
 *
 * El expediente de una idea, cruzando cinco fases. La diferencia con un
 * documento con un formulario adelante es que acá cada etapa declara cuándo
 * está cerrada, y la fase no avanza porque alguien diga que avanzó.
 *
 * Las etapas están todas a la vista: la fase en curso abierta y las demás
 * plegadas. Se puede entrar a cualquiera —nadie queda trabado— pero el
 * contador de arriba dice la verdad sobre dónde está parada la idea.
 */
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  Plus, ChevronLeft, ChevronDown, Check, Trash2, Lightbulb,
  Dna, Workflow, ArrowRight, Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { usePipeline } from '@/hooks/usePipeline'
import { useIdeas, useAdn } from '@/features/pipa/usePipa'
import {
  FASES, CRITERIOS, ESLABONES, ESTADOS_ORDEN, RAMAS, ETAPAS_NUEVO_EMBUDO,
  NOMBRE_DECISION, marcador, etapaCerrada, avanceDeFase, faseActual,
  ideaVacia, instruccionesDelAgente, descripcionDelEmbudo,
} from '@/lib/pipa'

const COLOR_DECISION = {
  avanzar: { texto: '#00a846', borde: '#00c853' },
  iterar: { texto: '#c47000', borde: '#f59e0b' },
  descartar: { texto: '#8e8e93', borde: '#c7c7cc' },
}

/* ── Piezas chicas ──────────────────────────────────────────────────── */

function Pildora({ children, color, punteada }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold',
        punteada ? 'border border-dashed' : 'border',
      )}
      style={color
        ? { color: color.texto, borderColor: color.borde }
        : { color: 'var(--text-tertiary)', borderColor: 'var(--border)' }}
    >
      {children}
    </span>
  )
}

function Campo({ campo, valor, onChange }) {
  const comun = {
    value: valor ?? '',
    onChange: e => onChange(e.target.value),
    className:
      'w-full rounded-[8px] border border-black/[0.08] bg-surface-2 px-3 py-2 text-[13.5px] ' +
      'text-primary outline-none transition-colors placeholder-tertiary focus:border-primary/40',
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wide text-tertiary">
        {campo.label}
      </label>
      {campo.tipo === 'texto'
        ? <textarea {...comun} rows={campo.filas || 3} className={comun.className + ' resize-y leading-relaxed'} />
        : <input {...comun} type={campo.tipo === 'fecha' ? 'date' : 'text'} placeholder={campo.placeholder || ''} />}
      {campo.pista && <p className="text-[11.5px] leading-relaxed text-tertiary">{campo.pista}</p>}
    </div>
  )
}

/* ── Etapas con forma propia ────────────────────────────────────────── */

function EtapaPasarela({ datos, set }) {
  const rama = datos.rama || ''
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wide text-tertiary">
          ¿El proceso de venta es distinto al de lo que ya vendemos?
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {RAMAS.map(r => (
            <button
              key={r.id}
              onClick={() => set({ ...datos, rama: r.id })}
              className={clsx(
                'rounded-[10px] border p-3 text-left transition-all',
                rama === r.id ? 'border-primary/40 bg-primary/[0.05]' : 'border-black/[0.08] hover:border-black/20',
              )}
            >
              <div className="text-[13px] font-semibold text-primary">{r.nombre}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-tertiary">{r.detalle}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wide text-tertiary">
          El camino del dinero
        </label>
        <p className="text-[11.5px] leading-relaxed text-tertiary">
          Si falta un eslabón, no se puede cobrar por más que la idea sea buena. El CRM cierra la fila:
          si el lead no cae en un embudo, no se puede medir.
        </p>
        <div className="mt-1 flex flex-col gap-1.5">
          {ESLABONES.map(e => {
            const estado = datos?.[e.id]?.estado || ''
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-[10px] border border-black/[0.08] bg-surface px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-primary">{e.nombre}</div>
                  <div className="text-[11.5px] text-tertiary">{e.detalle}</div>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  {[
                    { id: 'listo', texto: 'Listo' },
                    { id: 'na', texto: 'No aplica' },
                  ].map(op => (
                    <button
                      key={op.id}
                      onClick={() => set({ ...datos, [e.id]: { estado: estado === op.id ? '' : op.id } })}
                      className={clsx(
                        'rounded-[7px] border px-2.5 py-1 text-[11.5px] font-semibold transition-all',
                        estado === op.id
                          ? 'border-primary bg-primary text-white'
                          : 'border-black/[0.08] text-tertiary hover:text-primary',
                      )}
                    >
                      {op.texto}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EtapaPuntaje({ datos, set }) {
  const m = marcador(datos)
  const color = m.decision ? COLOR_DECISION[m.decision] : null

  let veredicto
  if (!m.completo) veredicto = 'Faltan criterios por puntuar. El total parcial no es un veredicto.'
  else if (m.mordio) veredicto = `El candado la frenó. El total da ${m.total}, que alcanzaba para avanzar, pero tamaño del dolor o nivel de evidencia sacaron 2 o menos.`
  else if (m.frenado && m.decision === 'iterar') veredicto = 'Iterar. Y ojo: dolor o evidencia están en 2 o menos, así que no puede avanzar por más que suba el total.'
  else if (m.decision === 'avanzar') veredicto = 'Avanzar: las órdenes se pueden despachar.'
  else if (m.decision === 'iterar') veredicto = 'Iterar: corregir lo que salió bajo y volver a pasar.'
  else veredicto = 'Descartar: archivar con lo aprendido, y cargarlo al ADN.'

  return (
    <div className="flex flex-col gap-4">
      {CRITERIOS.map(c => {
        const v = Number(datos[c.id]) || 0
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <div>
              <div className="text-[13px] font-semibold text-primary">{c.nombre}</div>
              <div className="text-[11.5px] leading-relaxed text-tertiary">{c.pregunta}</div>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  // Volver a tocar la misma nota la quita, para despuntuar sin recargar.
                  onClick={() => set({ ...datos, [c.id]: v === n ? 0 : n })}
                  className={clsx(
                    'flex-1 rounded-[8px] border py-1.5 text-[13px] font-bold transition-all',
                    v === n
                      ? 'border-primary bg-primary text-white'
                      : 'border-black/[0.08] text-tertiary hover:border-black/20 hover:text-primary',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <div className="flex items-baseline gap-3 border-t border-black/[0.08] pt-4">
        <span className="text-[34px] font-black leading-none tracking-tight text-primary">
          {m.total || '—'}
        </span>
        <span className="text-[13px] text-tertiary">de 30</span>
        <span className="ml-auto">
          {m.decision
            ? <Pildora color={color}>{NOMBRE_DECISION[m.decision]}</Pildora>
            : <Pildora punteada>Sin puntuar</Pildora>}
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-secondary">{veredicto}</p>
    </div>
  )
}

function EtapaPuestos({ datos, set, puestos, puedeDespachar }) {
  const ordenes = datos.ordenes || []

  const agregar = (puesto) => set({
    ...datos,
    ordenes: [...ordenes, {
      id: `o_${Date.now()}`, puesto: puesto.nombre,
      detalle: '', espacios: 1, estado: 'pendiente',
    }],
  })
  const editar = (id, parche) =>
    set({ ...datos, ordenes: ordenes.map(o => o.id === id ? { ...o, ...parche } : o) })
  const quitar = (id) => set({ ...datos, ordenes: ordenes.filter(o => o.id !== id) })

  return (
    <div className="flex flex-col gap-4">
      {!puedeDespachar && (
        <div className="rounded-[10px] border border-amber-500/30 bg-amber-50/50 p-3 text-[12.5px] leading-relaxed text-secondary">
          El puntaje todavía no dice avanzar. Se pueden escribir las órdenes, pero
          nadie debería salir a producir nada hasta que lo diga.
        </div>
      )}

      {ordenes.length === 0 && (
        <p className="text-[13px] text-tertiary">
          Una orden por puesto, específica para que la persona la lea, se vaya y la ejecute sin volver a preguntar.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {ordenes.map(o => (
          <div key={o.id} className="rounded-[10px] border border-black/[0.08] bg-surface p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[13px] font-bold text-primary">{o.puesto}</span>
              <input
                type="number" min={1} max={20} value={o.espacios}
                onChange={e => editar(o.id, { espacios: Math.max(1, Number(e.target.value) || 1) })}
                className="w-14 rounded-[6px] border border-black/[0.08] bg-surface-2 px-2 py-1 text-center text-[12px] text-primary outline-none"
                title="Cuántas piezas pide esta orden"
              />
              <span className="text-[11px] text-tertiary">espacios</span>
              <button
                onClick={() => quitar(o.id)}
                className="ml-auto rounded-[6px] p-1 text-tertiary transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <textarea
              value={o.detalle}
              onChange={e => editar(o.id, { detalle: e.target.value })}
              rows={2}
              placeholder="Qué exactamente: justificado en qué dolor, con qué copy, qué llamado y para dónde"
              className="w-full resize-y rounded-[8px] border border-black/[0.08] bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-primary outline-none placeholder-tertiary focus:border-primary/40"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {puestos.map(p => (
          <button
            key={p.id}
            onClick={() => agregar(p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-secondary transition-colors hover:border-black/20 hover:text-primary"
          >
            <Plus size={12} /> {p.nombre}
          </button>
        ))}
      </div>
    </div>
  )
}

/* Las órdenes de P2, con sus espacios. La orden es el molde del espacio: si
 * P2 pidió cuatro piezas, aquí hay cuatro huecos, y el hueco está lleno o
 * está vacío. Nadie escribe una lista de pendientes aparte. */
function EtapaOrdenes({ idea, guardar }) {
  const ordenes = idea?.p2?.puestos?.ordenes || []

  if (ordenes.length === 0) {
    return <p className="text-[13px] text-tertiary">Todavía no hay órdenes. Se despachan en P2 · Puestos.</p>
  }

  const cambiarEstado = (id, estado) => {
    guardar({
      'p2.puestos.ordenes': ordenes.map(o => o.id === id ? { ...o, estado } : o),
    })
  }
  const cambiarEvidencia = (id, i, valor) => {
    guardar({
      'p2.puestos.ordenes': ordenes.map(o => {
        if (o.id !== id) return o
        const ev = [...(o.evidencias || [])]
        ev[i] = valor
        return { ...o, evidencias: ev }
      }),
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      {ordenes.map(o => {
        const espacios = Array.from({ length: o.espacios || 1 })
        const llenos = (o.evidencias || []).filter(e => e?.trim()).length
        return (
          <div key={o.id} className="rounded-[10px] border border-black/[0.08] bg-surface p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold text-primary">{o.puesto}</span>
              <span className="text-[11.5px] text-tertiary">{llenos} de {o.espacios || 1}</span>
              <div className="ml-auto flex gap-1">
                {ESTADOS_ORDEN.map(e => (
                  <button
                    key={e.id}
                    onClick={() => cambiarEstado(o.id, e.id)}
                    className={clsx(
                      'rounded-[7px] border px-2.5 py-1 text-[11.5px] font-semibold transition-all',
                      (o.estado || 'pendiente') === e.id
                        ? 'border-primary bg-primary text-white'
                        : 'border-black/[0.08] text-tertiary hover:text-primary',
                    )}
                  >
                    {e.nombre}
                  </button>
                ))}
              </div>
            </div>
            {o.detalle && <p className="mb-2 text-[12.5px] leading-relaxed text-secondary">{o.detalle}</p>}
            <div className="flex flex-col gap-1.5">
              {espacios.map((_, i) => (
                <input
                  key={i}
                  value={(o.evidencias || [])[i] || ''}
                  onChange={e => cambiarEvidencia(o.id, i, e.target.value)}
                  placeholder={`Pieza ${i + 1} — enlace o dónde quedó`}
                  className="w-full rounded-[8px] border border-black/[0.08] bg-surface-2 px-3 py-1.5 text-[12.5px] text-primary outline-none placeholder-tertiary focus:border-primary/40"
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EtapaPromesa({ datos, set, idea }) {
  const obj = idea?.p1?.objetivo || {}
  const prop = idea?.p1?.proposito || {}
  const preguntas = [
    { id: 'numero', texto: `¿Se consiguió el número?`, detalle: [obj.numero, obj.unidad].filter(Boolean).join(' ') || 'Sin objetivo escrito en P1' },
    { id: 'proposito', texto: '¿Se cumplió el propósito?', detalle: prop.comoSabremos || 'Sin vara escrita en P1' },
  ]
  return (
    <div className="flex flex-col gap-4">
      {preguntas.map(p => (
        <div key={p.id} className="flex flex-col gap-2">
          <div>
            <div className="text-[13px] font-semibold text-primary">{p.texto}</div>
            <div className="text-[11.5px] leading-relaxed text-tertiary">{p.detalle}</div>
          </div>
          <div className="flex gap-1.5">
            {[{ v: true, t: 'Sí' }, { v: false, t: 'No' }].map(op => (
              <button
                key={op.t}
                onClick={() => set({ ...datos, [p.id]: datos[p.id] === op.v ? null : op.v })}
                className={clsx(
                  'flex-1 rounded-[8px] border py-1.5 text-[13px] font-bold transition-all',
                  datos[p.id] === op.v
                    ? 'border-primary bg-primary text-white'
                    : 'border-black/[0.08] text-tertiary hover:border-black/20 hover:text-primary',
                )}
              >
                {op.t}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[12.5px] leading-relaxed text-tertiary">
        Separadas a propósito: se puede acertar una y fallar la otra, y la idea que cumple el
        número sin cumplir el propósito es la más fácil de repetir por error.
      </p>
    </div>
  )
}

/* ── El botón que escribe el embudo ─────────────────────────────────── */

function LlevarAlCRM({ idea, guardar }) {
  const { createPipeline } = usePipeline()
  const [trabajando, setTrabajando] = useState(false)
  const rama = idea?.p2?.pasarela?.rama
  const m = marcador(idea?.p2?.puntaje || {})

  if (idea.pipelineId) {
    return (
      <div className="rounded-[10px] border border-green-500/30 bg-green-50/40 p-3 text-[12.5px] leading-relaxed text-secondary">
        <b className="text-primary">Embudo creado.</b> Guarda el número de esta idea, así que desde
        cualquier pedido se puede llegar al propósito que lo originó.
      </div>
    )
  }

  if (rama !== 'unidad') {
    return (
      <p className="text-[12.5px] leading-relaxed text-tertiary">
        El botón crea el embudo cuando la pasarela dice que es una unidad de negocio.
        Si es un producto, el embudo ya existe y va al catálogo.
      </p>
    )
  }

  const crear = async () => {
    if (trabajando) return
    setTrabajando(true)
    try {
      const pipelineId = await createPipeline({
        name: idea.titulo || 'Embudo sin nombre',
        purpose: 'adquisicion',
        descripcion: descripcionDelEmbudo(idea),
        stages: ETAPAS_NUEVO_EMBUDO,
      })
      /* La idea guarda el embudo y el embudo guarda la idea. Ése es el
         eslabón que hace recorrible la trazabilidad hacia atrás, de un
         pedido cobrado hasta el propósito que lo mandó a existir. */
      await guardar({ pipelineId })
      toast.success('Embudo creado con sus cuatro etapas')
    } catch (e) {
      toast.error(`No se pudo crear: ${e.message}`)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[10px] border border-black/[0.08] bg-surface-2 p-3">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-tertiary">
          Lo que se va a escribir
        </div>
        <ul className="flex flex-col gap-1 text-[12.5px] leading-relaxed text-secondary">
          <li>Embudo «{idea.titulo || 'sin nombre'}» con sus cuatro etapas y sus rangos de score.</li>
          <li>Descripción para el conmutador: {descripcionDelEmbudo(idea) || '— falta el perfil —'}</li>
        </ul>
      </div>

      <details className="rounded-[10px] border border-black/[0.08] bg-surface-2 p-3">
        <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-wide text-tertiary">
          Instrucciones para el agente
        </summary>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-secondary">
          {instruccionesDelAgente(idea)}
        </pre>
        <p className="mt-2 text-[11.5px] leading-relaxed text-tertiary">
          Sale de la Propuesta, sin volver a teclearla. Hoy se copia a mano al Agente IA;
          colgarla sola es el siguiente paso.
        </p>
      </details>

      <button
        onClick={crear}
        disabled={trabajando || m.decision !== 'avanzar'}
        className="btn-primary flex items-center justify-center gap-2 py-2.5 text-[13.5px] disabled:opacity-40"
      >
        {trabajando ? <Loader2 size={15} className="animate-spin" /> : <Workflow size={15} />}
        {trabajando ? 'Creando…' : 'Crear el embudo en el CRM'}
      </button>
      {m.decision !== 'avanzar' && (
        <p className="text-[11.5px] text-tertiary">
          Se habilita cuando el puntaje dice avanzar.
        </p>
      )}
    </div>
  )
}

/* ── Fase y etapa ───────────────────────────────────────────────────── */

function BloqueEtapa({ fase, etapa, idea, guardar, adn }) {
  const datos = idea?.[fase.id]?.[etapa.id] || {}
  const cerrada = etapaCerrada(fase, etapa, idea)
  const set = (nuevos) => guardar({ [`${fase.id}.${etapa.id}`]: nuevos })
  const setCampo = (campoId, valor) => set({ ...datos, [campoId]: valor })

  const puedeDespachar = marcador(idea?.p2?.puntaje || {}).decision === 'avanzar'

  return (
    <div className="rounded-[12px] border border-black/[0.08] bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={clsx(
            'flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border',
            cerrada ? 'border-green-500 bg-green-500 text-white' : 'border-black/15',
          )}
        >
          {cerrada && <Check size={11} strokeWidth={3} />}
        </span>
        <h4 className="text-[14px] font-bold tracking-tight text-primary">{etapa.nombre}</h4>
      </div>

      {etapa.tipo === 'pasarela' && <EtapaPasarela datos={datos} set={set} />}
      {etapa.tipo === 'puntaje' && <EtapaPuntaje datos={datos} set={set} />}
      {etapa.tipo === 'puestos' && (
        <EtapaPuestos datos={datos} set={set} puestos={adn.puestos} puedeDespachar={puedeDespachar} />
      )}
      {etapa.tipo === 'ordenes' && <EtapaOrdenes idea={idea} guardar={guardar} />}
      {etapa.tipo === 'promesa' && <EtapaPromesa datos={datos} set={set} idea={idea} />}

      {etapa.campos && (
        <div className="flex flex-col gap-3.5">
          {etapa.campos.map(c => (
            <Campo key={c.id} campo={c} valor={datos[c.id]} onChange={v => setCampo(c.id, v)} />
          ))}
        </div>
      )}

      {fase.id === 'p2' && etapa.id === 'puestos' && (
        <div className="mt-4 border-t border-black/[0.08] pt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-tertiary">
            El entregable para la máquina
          </div>
          <LlevarAlCRM idea={idea} guardar={guardar} />
        </div>
      )}
    </div>
  )
}

function BloqueFase({ fase, idea, guardar, adn, abierta, onAbrir }) {
  const { hechas, total, completa } = avanceDeFase(fase, idea)
  return (
    <div className="rounded-[14px] border border-black/[0.08] bg-surface-2">
      <button
        onClick={onAbrir}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-[12px] font-black tracking-wider text-tertiary">{fase.clave}</span>
        <span className="text-[16px] font-bold tracking-tight text-primary">{fase.nombre}</span>
        <span className="ml-auto flex items-center gap-2">
          {completa
            ? <Pildora color={COLOR_DECISION.avanzar}>Cerrada</Pildora>
            : <Pildora punteada>{hechas} de {total}</Pildora>}
          <ChevronDown
            size={16}
            className={clsx('text-tertiary transition-transform', abierta && 'rotate-180')}
          />
        </span>
      </button>

      {abierta && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          <p className="text-[13px] leading-relaxed text-secondary">{fase.frase}</p>
          {fase.etapas.map(e => (
            <BloqueEtapa key={e.id} fase={fase} etapa={e} idea={idea} guardar={guardar} adn={adn} />
          ))}
          <p className="text-[12px] leading-relaxed text-tertiary">
            <b className="text-secondary">Resultado:</b> {fase.resultado}
          </p>
        </div>
      )}
    </div>
  )
}

/* ── La página ──────────────────────────────────────────────────────── */

export default function Pipa() {
  const { org, user } = useAuthStore()
  const orgId = org?.id
  const quien = user?.displayName || user?.email || ''

  const { ideas, cargando, error, crear, guardar, borrar } = useIdeas(orgId)
  const { adn, guardarAdn } = useAdn(orgId)

  const [vista, setVista] = useState('ideas')
  const [abiertaId, setAbiertaId] = useState(null)
  const [faseAbierta, setFaseAbierta] = useState('p1')
  const [confirmando, setConfirmando] = useState(false)
  const [textoAdn, setTextoAdn] = useState(null)

  const idea = useMemo(() => ideas.find(i => i.id === abiertaId) || null, [ideas, abiertaId])

  const nueva = async () => {
    const id = await crear({ ...ideaVacia(quien), titulo: 'Idea sin nombre' })
    setAbiertaId(id)
    setFaseAbierta('p1')
  }

  /* ── Detalle ── */
  if (idea) {
    const actual = faseActual(idea)
    const m = marcador(idea?.p2?.puntaje || {})
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-4 p-6">
        <button
          onClick={() => { setAbiertaId(null); setConfirmando(false) }}
          className="flex items-center gap-1.5 self-start text-[13px] text-tertiary transition-colors hover:text-primary"
        >
          <ChevronLeft size={15} /> La línea de trabajo
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={idea.titulo || ''}
            onChange={e => guardar(idea.id, { titulo: e.target.value })}
            placeholder="Nombre de la idea"
            className="min-w-0 flex-1 border-none bg-transparent text-[24px] font-bold tracking-tight text-primary outline-none placeholder-tertiary"
          />
          <Pildora>{actual.clave} · {actual.nombre}</Pildora>
          {m.decision && <Pildora color={COLOR_DECISION[m.decision]}>{NOMBRE_DECISION[m.decision]}</Pildora>}
        </div>

        {FASES.map(f => (
          <BloqueFase
            key={f.id}
            fase={f}
            idea={idea}
            guardar={parches => guardar(idea.id, parches)}
            adn={adn}
            abierta={faseAbierta === f.id}
            onAbrir={() => setFaseAbierta(faseAbierta === f.id ? null : f.id)}
          />
        ))}

        <div className="flex items-center gap-3 pt-2">
          {confirmando ? (
            <>
              <span className="text-[13px] text-secondary">¿Borrar esta idea? No se deshace.</span>
              <button
                onClick={async () => { await borrar(idea.id); setAbiertaId(null); setConfirmando(false) }}
                className="text-[13px] font-semibold text-red-500 underline"
              >
                Sí, borrar
              </button>
              <button onClick={() => setConfirmando(false)} className="text-[13px] text-tertiary underline">
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmando(true)}
              className="text-[13px] text-tertiary underline transition-colors hover:text-red-500"
            >
              Borrar la idea
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ── Lista y ADN ── */
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-5 p-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-primary">PIPA</h1>
        <p className="mt-1 text-[14px] text-secondary">
          Pasa la idea por aquí. Entra una idea, sale trabajo repartido.
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { id: 'ideas', nombre: 'Ideas', Icon: Lightbulb },
          { id: 'adn', nombre: 'ADN', Icon: Dna },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setVista(t.id)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-all',
              vista === t.id
                ? 'border-primary bg-primary text-white'
                : 'border-black/[0.08] bg-surface-2 text-secondary hover:text-primary',
            )}
          >
            <t.Icon size={14} /> {t.nombre}
          </button>
        ))}
      </div>

      {vista === 'ideas' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[18px] font-bold tracking-tight text-primary">La línea de trabajo</h2>
            <button onClick={nueva} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-[13px]">
              <Plus size={14} /> Nueva idea
            </button>
          </div>

          {error && (
            <div className="rounded-[12px] border border-red-500/30 bg-red-50/50 p-4 text-[13px] text-secondary">
              No se pudo leer: {error}
            </div>
          )}

          {!cargando && ideas.length === 0 && (
            <div className="rounded-[14px] border border-black/[0.08] bg-surface py-16 text-center">
              <p className="text-[16px] font-semibold text-primary">Todavía no hay ninguna idea</p>
              <p className="mt-1 text-[13.5px] text-tertiary">
                La primera que pase por aquí empieza la línea de trabajo.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {ideas.map(i => {
              const f = faseActual(i)
              const m = marcador(i?.p2?.puntaje || {})
              const av = avanceDeFase(f, i)
              return (
                <button
                  key={i.id}
                  onClick={() => { setAbiertaId(i.id); setFaseAbierta(f.id) }}
                  className="flex flex-wrap items-center gap-3 rounded-[12px] border border-black/[0.08] bg-surface px-4 py-3.5 text-left transition-colors hover:border-black/20"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-semibold text-primary">
                      {i.titulo || 'Idea sin nombre'}
                    </div>
                    <div className="mt-0.5 text-[12px] text-tertiary">
                      {i.autor || '—'}
                      {i.pipelineId && ' · embudo creado'}
                    </div>
                  </div>
                  <Pildora>{f.clave} · {f.nombre}</Pildora>
                  <Pildora punteada>{av.hechas} de {av.total}</Pildora>
                  <span className="w-[76px] text-right">
                    {m.completo
                      ? <span className="text-[16px] font-bold text-primary">{m.total}<span className="text-[11px] text-tertiary">/30</span></span>
                      : <span className="text-[12px] text-tertiary">sin puntuar</span>}
                  </span>
                  {m.decision
                    ? <Pildora color={COLOR_DECISION[m.decision]}>{NOMBRE_DECISION[m.decision]}</Pildora>
                    : <span className="w-[62px]" />}
                  <ArrowRight size={15} className="text-tertiary" />
                </button>
              )
            })}
          </div>
        </>
      )}

      {vista === 'adn' && (
        <div className="flex flex-col gap-5">
          <div className="rounded-[14px] border border-black/[0.08] bg-surface p-5">
            <h2 className="text-[16px] font-bold tracking-tight text-primary">El contexto de la empresa</h2>
            <p className="mb-3 mt-1 text-[13px] leading-relaxed text-secondary">
              El suelo sobre el que paran las cinco fases. No es una etapa: nadie lo recorre,
              se consulta en todas y se actualiza al cerrar cada vuelta.
            </p>
            <textarea
              value={textoAdn ?? adn.texto}
              onChange={e => setTextoAdn(e.target.value)}
              rows={18}
              placeholder="Qué hacemos, cómo vendemos, a quién, la voz de marca, y lo que todavía no sabemos."
              className="w-full resize-y rounded-[10px] border border-black/[0.08] bg-surface-2 px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-primary outline-none placeholder-tertiary focus:border-primary/40"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={async () => {
                  await guardarAdn({ texto: textoAdn ?? adn.texto }, quien)
                  setTextoAdn(null)
                  toast.success('ADN guardado')
                }}
                className="btn-primary px-4 py-2 text-[13px]"
              >
                Guardar
              </button>
              <span className="text-[12px] text-tertiary">
                {adn.actualizadoPor ? `Última vez, por ${adn.actualizadoPor}` : 'Sin guardar todavía'}
              </span>
            </div>
          </div>

          <div className="rounded-[14px] border border-black/[0.08] bg-surface p-5">
            <h2 className="text-[16px] font-bold tracking-tight text-primary">Los puestos</h2>
            <p className="mb-3 mt-1 text-[13px] leading-relaxed text-secondary">
              Las órdenes de P2 van dirigidas a un puesto, así que el sistema necesita saber
              cuáles existen en esta casa.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {adn.puestos.map(p => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-surface-2 px-3 py-1.5 text-[12.5px] text-primary"
                >
                  {p.nombre}
                  <button
                    onClick={() => guardarAdn({ puestos: adn.puestos.filter(x => x.id !== p.id) }, quien)}
                    className="text-tertiary transition-colors hover:text-red-500"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={e => {
                e.preventDefault()
                const nombre = new FormData(e.currentTarget).get('nombre')?.toString().trim()
                if (!nombre) return
                guardarAdn(
                  { puestos: [...adn.puestos, { id: `p_${Date.now()}`, nombre }] },
                  quien,
                )
                e.currentTarget.reset()
              }}
            >
              <input
                name="nombre"
                placeholder="Agregar un puesto"
                className="w-full max-w-[240px] rounded-[8px] border border-black/[0.08] bg-surface-2 px-3 py-2 text-[13px] text-primary outline-none placeholder-tertiary focus:border-primary/40"
              />
              <button type="submit" className="btn-secondary px-3 py-2 text-[13px]">Agregar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
