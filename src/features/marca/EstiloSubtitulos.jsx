/* Los mandos del aspecto de los subtítulos. Todo lo que se toca aquí se ve al
 * momento en el visor, porque es el mismo dibujo. */
import clsx from 'clsx'
import { FUENTES, RESALTADOS, POR_DEFECTO } from './estilo'

function Fila({ titulo, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[86px] shrink-0 text-[11px] font-semibold text-tertiary">{titulo}</span>
      <div className="flex-1 flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function Pastilla({ activa, onClick, children, title }) {
  return (
    <button onClick={onClick} title={title}
      className={clsx('px-2.5 py-1 rounded-btn text-[12px] font-semibold border transition-colors',
        activa ? 'bg-accent-blue text-white border-accent-blue'
               : 'bg-surface-2 border-border text-secondary hover:text-primary')}>
      {children}
    </button>
  )
}

function Color({ valor, onChange, title }) {
  return (
    <label title={title}
      className="w-7 h-7 rounded-btn border border-border overflow-hidden cursor-pointer shrink-0"
      style={{ background: valor }}>
      <input type="color" value={valor} onChange={e => onChange(e.target.value)}
        className="opacity-0 w-full h-full cursor-pointer" />
    </label>
  )
}

export default function EstiloSubtitulos({ estilo, onCambiar }) {
  const e = { ...POR_DEFECTO, ...(estilo || {}) }
  const set = (cambio) => onCambiar?.({ ...e, ...cambio })

  return (
    <div className="space-y-2.5">
      <Fila titulo="Tipografía">
        {Object.entries(FUENTES).map(([k, f]) => (
          <Pastilla key={k} activa={e.fuente === k} onClick={() => set({ fuente: k })}>
            <span style={{ fontFamily: f.css, fontWeight: f.peso }}>{f.nombre}</span>
          </Pastilla>
        ))}
      </Fila>

      <Fila titulo="Tamaño">
        <input type="range" min="3" max="12" step="0.5" value={e.tamano}
          onChange={ev => set({ tamano: Number(ev.target.value) })}
          className="flex-1 min-w-[120px] accent-accent-blue" />
        <span className="text-[11px] text-tertiary w-7 text-right">{e.tamano}</span>
      </Fila>

      <Fila titulo="Texto">
        <Color valor={e.color} onChange={color => set({ color })} title="Color del texto" />
        <Pastilla activa={e.mayusculas} onClick={() => set({ mayusculas: !e.mayusculas })}>
          MAYÚS
        </Pastilla>
        <Pastilla activa={e.contorno} onClick={() => set({ contorno: !e.contorno })}
          title="Despega el texto del fondo; sin esto, sobre ropa clara desaparece">
          Contorno
        </Pastilla>
      </Fila>

      <Fila titulo="Fondo">
        <Pastilla activa={e.fondo === 'caja'} onClick={() => set({ fondo: 'caja' })}>Caja</Pastilla>
        <Pastilla activa={e.fondo === 'ninguno'} onClick={() => set({ fondo: 'ninguno' })}>Sin fondo</Pastilla>
        {e.fondo === 'caja' && (
          <>
            <Color valor={e.colorFondo} onChange={colorFondo => set({ colorFondo })} title="Color de la caja" />
            <input type="range" min="0.2" max="1" step="0.05" value={e.opacidadFondo}
              onChange={ev => set({ opacidadFondo: Number(ev.target.value) })}
              className="w-20 accent-accent-blue" title="Opacidad de la caja" />
          </>
        )}
      </Fila>

      <Fila titulo="Posición">
        <Pastilla activa={e.posicion === 'abajo'} onClick={() => set({ posicion: 'abajo' })}>Abajo</Pastilla>
        <Pastilla activa={e.posicion === 'centro'} onClick={() => set({ posicion: 'centro' })}>Centro</Pastilla>
      </Fila>

      <Fila titulo="Resaltado">
        {Object.entries(RESALTADOS).map(([k, nombre]) => (
          <Pastilla key={k} activa={e.resaltado === k} onClick={() => set({ resaltado: k })}
            title="Enciende la palabra que se está diciendo">
            {nombre}
          </Pastilla>
        ))}
        {e.resaltado !== 'ninguno' && (
          <Color valor={e.colorResaltado} onChange={colorResaltado => set({ colorResaltado })}
            title="Color del resaltado" />
        )}
      </Fila>
    </div>
  )
}
