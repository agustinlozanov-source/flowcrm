/* Registrar una actividad de venta, y de paso el compromiso que dejó.
 *
 * Un solo diálogo para las dos cosas porque en la vida pasan juntas: «mandé el
 * WhatsApp y quedé de regresarle el jueves a las 11» es un hecho y un
 * pendiente dichos en la misma frase. Separarlos en dos pantallas garantiza
 * que la segunda no se llene nunca, y el pendiente es justo la parte que mueve
 * el embudo.
 *
 * La fecha de «cuándo pasó» se puede mover hacia atrás a propósito: el lunes
 * en la mañana uno captura las llamadas del viernes. Lo que no se puede mover
 * es `createdAt`, y la diferencia entre las dos queda a la vista.
 */
import { useState } from 'react'
import { Check } from 'lucide-react'
import { TIPOS } from '@/hooks/useActividades'
import SelectorConCrear from './SelectorConCrear'

const normalizar = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/* `datetime-local` habla en hora local sin zona, así que la conversión se hace
   a mano: `toISOString` daría UTC y correría la hora seis horas. */
const aInput = (d) => {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const deInput = (s) => (s ? new Date(s) : null)

/**
 * @param leds     leads entre los que elegir. Solo lo pasa el módulo de
 *                 Actividad; desde el panel del lead ya se sabe de quién es.
 * @param inicial  prefill, para completar una pendiente sin volver a escribir
 *                 de qué tipo era.
 */
export default function ActividadDialog({
  modo = 'registrar',
  leads = null,
  inicial = null,
  titulo,
  subtitulo,
  onGuardar,
  onCerrar,
}) {
  const agendando = modo === 'agendar'

  const [lead, setLead] = useState(null)
  const [tipo, setTipo] = useState(inicial?.tipo || 'llamada')
  const [cuando, setCuando] = useState(aInput(new Date()))
  const [resumen, setResumen] = useState(inicial?.resumen || '')

  const [hayCompromiso, setHayCompromiso] = useState(false)
  const [tipoC, setTipoC] = useState('llamada')
  const [cuandoC, setCuandoC] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
    return aInput(d)
  })
  const [resumenC, setResumenC] = useState('')
  const [guardando, setGuardando] = useState(false)

  const confirmar = async () => {
    setGuardando(true)
    try {
      const hecho = agendando
        ? null
        : { tipo, estado: 'hecha', occurredAt: deInput(cuando), resumen }
      const pendiente = (agendando || hayCompromiso)
        ? {
            tipo: agendando ? tipo : tipoC,
            estado: 'pendiente',
            dueAt: deInput(agendando ? cuando : cuandoC),
            resumen: agendando ? resumen : resumenC,
          }
        : null
      await onGuardar({ hecho, pendiente, lead })
    } finally {
      setGuardando(false)
    }
  }

  const listo = (!leads || !!lead) && (agendando
    ? !!cuando
    : resumen.trim().length > 0 && (!hayCompromiso || !!cuandoC))

  const Tipos = ({ valor, onElegir }) => (
    <div className="pv2-seg pv2-seg--wrap">
      {TIPOS.map(t => (
        <button
          key={t.id}
          className={valor === t.id ? 'on' : ''}
          onClick={() => onElegir(t.id)}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="pv2-dialog">
      <div className="pv2-dialog__backdrop" onClick={onCerrar} />
      <div className="pv2-dialog__box" style={{ maxWidth: 440 }}>
        <h2 className="pv2-dialog__title">
          {titulo || (agendando ? 'Agendar actividad' : 'Registrar actividad')}
        </h2>
        <p className="pv2-dialog__hint">
          {subtitulo || (agendando
            ? 'Lo que queda por hacer, con su fecha.'
            : 'Lo que ya hiciste con este lead, y lo que quedó pendiente.')}
        </p>

        {leads && (
          <div>
            <label className="pv2-input-label">Con quién</label>
            <SelectorConCrear
              items={leads}
              valor={lead}
              etiqueta={l => l.nombre}
              detalle={l => l.detalle || ''}
              filtrar={(l, t) => normalizar(l.nombre).includes(normalizar(t)) || normalizar(l.detalle).includes(normalizar(t))}
              placeholder="Elige el contacto"
              onElegir={setLead}
              mensajeVacio="Ninguno coincide"
            />
          </div>
        )}

        <div>
          <label className="pv2-input-label">{agendando ? 'Qué toca hacer' : 'Qué fue'}</label>
          <Tipos valor={tipo} onElegir={setTipo} />
        </div>

        <div>
          <label className="pv2-input-label">{agendando ? 'Para cuándo' : 'Cuándo pasó'}</label>
          <input
            className="pv2-input"
            type="datetime-local"
            value={cuando}
            onChange={e => setCuando(e.target.value)}
          />
          {!agendando && (
            <p className="pv2-hint">
              Muévela hacia atrás si estás capturando algo de días pasados. Queda registrado cuándo lo capturaste.
            </p>
          )}
        </div>

        <div>
          <label className="pv2-input-label">
            {agendando ? 'Qué hay que hacer' : 'Qué se dijo o qué se acordó'}
          </label>
          <textarea
            className="pv2-input"
            rows={3}
            value={resumen}
            onChange={e => setResumen(e.target.value)}
            placeholder={agendando ? 'Mandarle la propuesta revisada' : 'Le mandé la cotización. Dijo que la ve con su socio.'}
            style={{ resize: 'vertical' }}
          />
        </div>

        {!agendando && (
          <div>
            <label className="pv2-check">
              <input
                type="checkbox"
                checked={hayCompromiso}
                onChange={e => setHayCompromiso(e.target.checked)}
              />
              <span>Quedé de algo</span>
            </label>

            {hayCompromiso && (
              <div className="pv2-compromiso">
                <Tipos valor={tipoC} onElegir={setTipoC} />
                <input
                  className="pv2-input"
                  type="datetime-local"
                  value={cuandoC}
                  onChange={e => setCuandoC(e.target.value)}
                />
                <input
                  className="pv2-input"
                  value={resumenC}
                  onChange={e => setResumenC(e.target.value)}
                  placeholder="Regresarle para cerrar fecha de arranque"
                />
                <p className="pv2-hint">Aparece en tus actividades pendientes.</p>
              </div>
            )}
          </div>
        )}

        <div className="pv2-dialog__actions">
          <button type="button" className="pv2-btn" onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className="pv2-btn pv2-btn--primary"
            onClick={confirmar}
            disabled={guardando || !listo}
          >
            <Check size={13} /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
