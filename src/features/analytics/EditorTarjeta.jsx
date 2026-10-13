import { useState, useMemo } from 'react'
import { MEDIDAS, DIMENSIONES, FORMAS, formasValidas, dimensionesPara } from './catalogo'
import { calcular } from './motor'
import { RENDERIZADORES } from './Formas'
import { AlertTriangle, Check } from 'lucide-react'

const ANCHOS = [
  { v: 1, label: 'Un cuarto' },
  { v: 2, label: 'Media fila' },
  { v: 3, label: 'Tres cuartos' },
  { v: 4, label: 'Fila entera' },
]

/**
 * Editor de una tarjeta. El orden de las preguntas no es casual: primero QUÉ
 * querés medir, después CONTRA QUÉ abrirlo, y recién entonces cómo verlo —
 * porque las formas disponibles dependen del cruce y no al revés.
 *
 * Muestra el resultado en vivo mientras elegís, con su aviso de confiabilidad,
 * así se decide viendo y no imaginando.
 */
export default function EditorTarjeta({ inicial, datos, periodo, espacioLibre, onGuardar, onCerrar }) {
  const [medida, setMedida] = useState(inicial?.medida || 'leads')
  const [dimension, setDimension] = useState(inicial?.dimension || 'ninguna')
  const [forma, setForma] = useState(inicial?.forma || 'numero')
  const [ancho, setAncho] = useState(inicial?.ancho || 1)
  const [titulo, setTitulo] = useState(inicial?.titulo || '')

  const dimsPosibles = useMemo(() => dimensionesPara(medida), [medida])
  const formasPosibles = useMemo(() => formasValidas(medida, dimension), [medida, dimension])

  // Cambiar de medida puede invalidar la dimensión elegida, y eso cambia las
  // formas. Se corrige acá en vez de dejar al usuario con una combinación rota.
  const cambiarMedida = (m) => {
    setMedida(m)
    const dims = dimensionesPara(m).map(d => d.id)
    const nuevaDim = dims.includes(dimension) ? dimension : 'ninguna'
    setDimension(nuevaDim)
    const fs = formasValidas(m, nuevaDim)
    if (!fs.includes(forma)) setForma(fs[0])
  }

  const cambiarDimension = (d) => {
    setDimension(d)
    const fs = formasValidas(medida, d)
    if (!fs.includes(forma)) setForma(fs[0])
  }

  const vista = useMemo(
    () => calcular(datos, medida, dimension, periodo),
    [datos, medida, dimension, periodo],
  )
  const Render = RENDERIZADORES[forma] || RENDERIZADORES.numero

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCerrar} />
      <div className="relative card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-display font-bold text-base">
            {inicial ? 'Editar tarjeta' : 'Nueva tarjeta'}
          </h2>
          <p className="text-xs text-secondary mt-0.5">
            Elegí qué medir y contra qué abrirlo. Las formas que no tienen sentido para ese cruce no se ofrecen.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-[11px] font-bold text-tertiary uppercase tracking-wide mb-1.5">
                1 · Qué querés medir
              </label>
              <select className="input text-sm" value={medida} onChange={e => cambiarMedida(e.target.value)}>
                {Object.entries(MEDIDAS).map(([id, m]) => (
                  <option key={id} value={id}>{m.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-tertiary mt-1">{MEDIDAS[medida].descripcion}</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-tertiary uppercase tracking-wide mb-1.5">
                2 · Contra qué lo abrís
              </label>
              <select className="input text-sm" value={dimension} onChange={e => cambiarDimension(e.target.value)}>
                {dimsPosibles.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-tertiary uppercase tracking-wide mb-1.5">
                3 · Cómo lo ves
              </label>
              <div className="flex flex-wrap gap-1.5">
                {formasPosibles.map(f => (
                  <button key={f} onClick={() => setForma(f)}
                    className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                      forma === f ? 'bg-accent-blue text-white border-accent-blue'
                                  : 'border-border-strong text-secondary hover:text-primary'
                    }`}>{FORMAS[f].label}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-tertiary uppercase tracking-wide mb-1.5">
                4 · Cuánto espacio ocupa
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ANCHOS.map(a => (
                  <button key={a.v} onClick={() => setAncho(a.v)}
                    disabled={espacioLibre != null && a.v > espacioLibre && a.v !== inicial?.ancho}
                    title={espacioLibre != null && a.v > espacioLibre ? `En esta fila quedan ${espacioLibre} de 4` : undefined}
                    className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-all disabled:opacity-30 ${
                      ancho === a.v ? 'bg-accent-blue text-white border-accent-blue'
                                    : 'border-border-strong text-secondary hover:text-primary'
                    }`}>{a.label}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-tertiary uppercase tracking-wide mb-1.5">
                Título (opcional)
              </label>
              <input className="input text-sm" value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder={dimension === 'ninguna'
                  ? MEDIDAS[medida].label
                  : `${MEDIDAS[medida].label} por ${DIMENSIONES[dimension].label.toLowerCase()}`} />
            </div>
          </div>

          {/* Vista previa con datos reales: se decide viendo, no imaginando. */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-tertiary uppercase tracking-wide">Así se va a ver</span>
            <div className="card p-4 flex-1">
              <h3 className="font-display font-bold text-[13.5px] mb-2">
                {titulo || (dimension === 'ninguna'
                  ? MEDIDAS[medida].label
                  : `${MEDIDAS[medida].label} por ${DIMENSIONES[dimension].label.toLowerCase()}`)}
              </h3>
              {forma === 'numero'
                ? <Render valor={vista.total} formato={vista.formato} sub={`${vista.casos} casos`} />
                : <Render filas={vista.filas} formato={vista.formato} />}
            </div>
            {vista.aviso && (
              <div className={`flex items-start gap-1.5 text-[11.5px] leading-snug ${
                vista.aviso.nivel === 'vacio' ? 'text-tertiary' : 'text-amber-500'
              }`}>
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span>{vista.aviso.texto}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button className="btn-secondary text-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primary text-sm flex items-center gap-1.5"
            onClick={() => onGuardar({ medida, dimension, forma, ancho, titulo: titulo.trim() || null })}>
            <Check size={14} /> {inicial ? 'Guardar cambios' : 'Agregar al tablero'}
          </button>
        </div>
      </div>
    </div>
  )
}
