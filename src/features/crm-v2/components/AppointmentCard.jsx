import clsx from 'clsx'
import { Phone, Video, MapPin, Clock, Calendar, Check, X } from 'lucide-react'

// Tres tipos de cita. El botón principal cambia con el tipo: en una presencial
// "Iniciar llamada" no significa nada para quien está en recepción.
const TIPOS = {
  llamada:    { Icon: Phone, label: 'Llamada',      cta: 'Iniciar llamada' },
  video:      { Icon: Video, label: 'Videollamada', cta: 'Entrar a Meet' },
  presencial: { Icon: MapPin, label: 'Presencial',  cta: 'Marcar asistencia' },
}

const STATUS = {
  pendiente:  { label: 'Pendiente', cls: 'pendiente' },
  confirmada: { label: 'Confirmada', cls: 'confirmada' },
  curso:      { label: 'En curso', cls: 'curso' },
  asistio:    { label: 'Asistió', cls: 'asistio' },
  noshow:     { label: 'No asistió', cls: 'noshow' },
  reagendada: { label: 'Reagendada', cls: 'reagendada' },
  cancelada:  { label: 'Cancelada', cls: 'cancelada' },
}

/**
 * Cita de la agenda. Soporta los tres tipos y los status enriquecidos.
 *
 * `lateMinutes` controla la alerta de recepción: ámbar a los 15 minutos de
 * retraso, rojo a los 30, para que se vea de reojo sin leer.
 */
export default function AppointmentCard({ appointment, onPrimary, onReschedule, onCancel }) {
  const { name, hour, ampm, type = 'presencial', status = 'pendiente', location, requirements, reason, lateMinutes = 0 } = appointment
  const tipo = TIPOS[type] || TIPOS.presencial
  const st = STATUS[status] || STATUS.pendiente
  const sinMarcar = lateMinutes > 0 && !['asistio', 'noshow', 'cancelada'].includes(status)

  return (
    <div className="pv2-appt" style={sinMarcar ? { borderColor: lateMinutes >= 30 ? 'var(--red)' : 'var(--amber)' } : undefined}>
      <div className="pv2-appt__time">
        <span className="pv2-appt__hour">{hour}</span>
        <span className="pv2-appt__ampm">{ampm}</span>
      </div>

      <div className="pv2-appt__main">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pv2-appt__name">{name}</span>
          <span className={clsx('pv2-status', `pv2-status--${st.cls}`)}>{st.label}</span>
        </div>

        <div className="pv2-appt__meta">
          <tipo.Icon size={11} /> {tipo.label}
          {location && <><span style={{ color: 'var(--text-muted)' }}>·</span> {location}</>}
          {reason && <><span style={{ color: 'var(--text-muted)' }}>·</span> {reason}</>}
        </div>

        {requirements && (
          <div className="pv2-appt__req"><Clock size={11} /> {requirements}</div>
        )}

        {sinMarcar && (
          <div className="pv2-appt__req" style={{ color: lateMinutes >= 30 ? 'var(--red)' : 'var(--amber)' }}>
            Sin marcar · {lateMinutes} min de retraso
          </div>
        )}
      </div>

      <div className="pv2-appt__actions">
        <button className="pv2-btn pv2-btn--primary" onClick={onPrimary} style={{ fontSize: 11.5, padding: '5px 10px' }}>
          {status === 'asistio' ? <Check size={12} /> : <tipo.Icon size={12} />}
          {status === 'asistio' ? 'Asistió' : tipo.cta}
        </button>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <button className="pv2-icon-btn" onClick={onReschedule} title="Reagendar"><Calendar size={12} /></button>
          <button className="pv2-icon-btn" onClick={onCancel} title="Cancelar"><X size={12} /></button>
        </div>
      </div>
    </div>
  )
}
