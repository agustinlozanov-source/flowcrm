import { useState } from 'react'
import AppShellV2 from '../layout/AppShellV2'
import Topbar from '../components/Topbar'
import AppointmentCard from '../components/AppointmentCard'
import SidePanel from '../components/SidePanel'
import { appointments } from '../mockData'

const FILTROS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'todas', label: 'Todas' },
  { id: 'noshow', label: 'No asistieron' },
]

/**
 * Agenda. Abre en "Hoy" a propósito: es la vista que se usa en operación
 * diaria, y en recepción es la única que importa.
 */
export default function ReunionesV2() {
  const [filtro, setFiltro] = useState('hoy')
  const [selected, setSelected] = useState(null)

  const citas = filtro === 'noshow'
    ? appointments.filter(a => a.status === 'noshow')
    : appointments

  const pendientes = citas.filter(a => !['asistio', 'noshow', 'cancelada'].includes(a.status))
  const resueltas = citas.filter(a => ['asistio', 'noshow', 'cancelada'].includes(a.status))

  return (
    <AppShellV2 active="reuniones">
      <Topbar
        breadcrumb="Reuniones" title="Hoy"
        stats={[
          { label: 'Hoy', value: String(appointments.length) },
          { label: 'Esta semana', value: '31' },
          { label: 'Asistencia 30d', value: '78%', tone: 'green' },
          { label: 'No shows 30d', value: '9', tone: 'amber' },
        ]}
        onSearch={() => {}}
        primaryLabel="Nueva cita" onPrimary={() => {}}
      />

      <div className="pv2-filters">
        {FILTROS.map(f => (
          <button
            key={f.id}
            className={`pv2-chip-btn ${filtro === f.id ? 'pv2-chip-btn--active' : ''}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="pv2-agenda">
        {pendientes.length > 0 && <div className="pv2-agenda__sep">Por atender</div>}
        {pendientes.map(a => (
          <AppointmentCard key={a.id} appointment={a} onPrimary={() => setSelected(a)} />
        ))}

        {resueltas.length > 0 && <div className="pv2-agenda__sep">Resueltas</div>}
        {resueltas.map(a => (
          <AppointmentCard key={a.id} appointment={a} onPrimary={() => setSelected(a)} />
        ))}

        {citas.length === 0 && (
          <div className="pv2-placeholder"><strong>Sin citas</strong>No hay nada con este filtro.</div>
        )}
      </div>

      <SidePanel
        deal={selected ? {
          name: selected.name,
          stageName: 'Cita',
          stageColor: 'var(--blue)',
          service: selected.reason,
          channel: selected.location,
          createdLabel: `${selected.hour} ${selected.ampm}`,
          amount: 1200,
          score: 80,
          owner: { name: 'Recepción' },
          nextActionLabel: selected.requirements || 'Sin requisitos previos',
          fields: [
            { label: 'Tipo', value: selected.type },
            { label: 'Estado', value: selected.status },
            { label: 'Sede', value: selected.location || '—' },
            ...(selected.requirements ? [{ label: 'Requisitos', value: selected.requirements }] : []),
          ],
        } : null}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </AppShellV2>
  )
}
