import { useState, useMemo, useRef } from 'react'
import { useAppointments, APPOINTMENT_TYPES, APPOINTMENT_STATUS, VIDEO_PLATFORMS } from '@/hooks/useAppointments'
import { usePipeline } from '@/hooks/usePipeline'
import { format, isSameDay, isSameMonth, isToday, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import CallCockpit from '@/components/pipeline/CallCockpit'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  X, Plus, Clock, Calendar as CalendarIcon, Video, Phone,
  List, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  RotateCcw, Star, AlertTriangle, Search
} from 'lucide-react'

// ─── NEW APPOINTMENT MODAL ────────────────────────────────────────
function NewAppointmentModal({ leads, onClose, onCreate, defaultDate, defaultLeadId, createLead, stages }) {
  const initLead = leads.find(l => l.id === defaultLeadId)
  const [form, setForm] = useState({
    type: 'call',
    leadId: defaultLeadId || '',
    leadName: initLead?.name || '',
    date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: '10:00',
    duration: 15,
    platform: 'meet',
    link: '',
    notes: '',
  })
  const [leadSearch, setLeadSearch] = useState(initLead?.name || '')
  const [showLeadDrop, setShowLeadDrop] = useState(false)
  const [showCreateLead, setShowCreateLead] = useState(false)
  const [newLead, setNewLead] = useState({ name: '', company: '', phone: '', source: 'manual' })
  const [creatingLead, setCreatingLead] = useState(false)
  const [loading, setLoading] = useState(false)
  const leadInputRef = useRef(null)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const selectedLead = leads.find(l => l.id === form.leadId)

  const filteredLeads = useMemo(() =>
    leads.filter(l =>
      !leadSearch ||
      l.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      (l.company || '').toLowerCase().includes(leadSearch.toLowerCase())
    ).slice(0, 8),
    [leads, leadSearch]
  )

  const handleLeadPick = (lead) => {
    setForm(f => ({ ...f, leadId: lead.id, leadName: lead.name }))
    setLeadSearch(lead.name)
    setShowLeadDrop(false)
    setShowCreateLead(false)
  }

  const handleLeadClear = () => {
    setForm(f => ({ ...f, leadId: '', leadName: '' }))
    setLeadSearch('')
    setShowCreateLead(false)
  }

  const handleCreateLead = async () => {
    if (!newLead.name.trim()) { toast.error('El nombre es requerido'); return }
    setCreatingLead(true)
    try {
      const id = await createLead({
        name: newLead.name.trim(),
        company: newLead.company.trim(),
        phone: newLead.phone.trim(),
        source: newLead.source,
        stageId: stages[0]?.id || null,
      })
      if (id) {
        handleLeadPick({ id, name: newLead.name.trim(), company: newLead.company.trim() })
        setNewLead({ name: '', company: '', phone: '', source: 'manual' })
        toast.success('Lead creado ✓')
      }
    } catch { toast.error('Error al crear el lead') }
    finally { setCreatingLead(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.date || !form.time) { toast.error('Selecciona fecha y hora'); return }
    setLoading(true)
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00`)
      await onCreate({
        ...form,
        scheduledAt,
        leadName: selectedLead?.name || form.leadName || '',
      })
      toast.success(`${APPOINTMENT_TYPES[form.type].label} agendada ✓`)
      onClose()
    } catch { toast.error('Error al agendar') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-md border border-black/[0.08] max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06]">
          <div>
            <h2 className="font-display font-bold text-lg tracking-tight">Nueva cita</h2>
            <p className="text-xs text-secondary mt-0.5">Agenda una llamada o videollamada</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">

          {/* Type */}
          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Tipo *</label>
            <div className="flex gap-2">
              {Object.entries(APPOINTMENT_TYPES).map(([key, val]) => (
                <button key={key} type="button"
                  onClick={() => setForm(f => ({ ...f, type: key }))}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] border text-[13px] font-semibold transition-all',
                    form.type === key
                      ? 'border-primary bg-primary text-white'
                      : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                  )}>
                  {key === 'call' ? <Phone size={14} /> : <Video size={14} />}
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lead */}
          <div className="relative">
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Lead asociado</label>
            {form.leadId ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] border border-black/[0.1] bg-surface-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-primary truncate">{selectedLead?.name || form.leadName}</p>
                  {selectedLead?.company && <p className="text-[11px] text-secondary truncate">{selectedLead.company}</p>}
                  {selectedLead && (
                    <p className="text-[10px] text-blue-600 mt-0.5">
                      Score {selectedLead.score || 0} · {selectedLead.systemStage === 'handoff' ? '⚡ Handoff' : selectedLead.source}
                    </p>
                  )}
                </div>
                <button type="button" onClick={handleLeadClear} className="text-tertiary hover:text-primary p-1 flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none" />
                  <input
                    ref={leadInputRef}
                    value={leadSearch}
                    onChange={e => { setLeadSearch(e.target.value); setShowLeadDrop(true); setShowCreateLead(false) }}
                    onFocus={() => setShowLeadDrop(true)}
                    onBlur={() => setTimeout(() => setShowLeadDrop(false), 150)}
                    placeholder="Buscar lead por nombre o empresa…"
                    className="input pl-8 text-sm"
                  />
                </div>
                {showLeadDrop && (
                  <div className="absolute left-0 right-0 mt-1 bg-surface border border-black/[0.1] rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-10 overflow-hidden">
                    {filteredLeads.length > 0 ? (
                      filteredLeads.map(l => (
                        <button key={l.id} type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => handleLeadPick(l)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-primary truncate">{l.name}</p>
                            {l.company && <p className="text-[11px] text-secondary truncate">{l.company}</p>}
                          </div>
                          <span className="text-[10px] text-tertiary flex-shrink-0">score {l.score || 0}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-[12px] text-secondary">Sin resultados para "{leadSearch}"</div>
                    )}
                    <div className="border-t border-black/[0.06] px-3 py-2">
                      <button type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setShowLeadDrop(false)
                          setShowCreateLead(true)
                          setNewLead(nl => ({ ...nl, name: leadSearch }))
                        }}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors w-full">
                        <Plus size={13} /> Crear "{leadSearch || 'nuevo lead'}"
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {showCreateLead && !form.leadId && (
              <div className="mt-2 p-3 rounded-[10px] border border-blue-200 bg-blue-50/50 flex flex-col gap-2">
                <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Nuevo lead</p>
                <input value={newLead.name} onChange={e => setNewLead(nl => ({ ...nl, name: e.target.value }))}
                  placeholder="Nombre completo *" className="input text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={newLead.company} onChange={e => setNewLead(nl => ({ ...nl, company: e.target.value }))}
                    placeholder="Empresa" className="input text-sm" />
                  <input value={newLead.phone} onChange={e => setNewLead(nl => ({ ...nl, phone: e.target.value }))}
                    placeholder="Teléfono" className="input text-sm" />
                </div>
                <select value={newLead.source} onChange={e => setNewLead(nl => ({ ...nl, source: e.target.value }))} className="input text-sm">
                  <option value="manual">Manual</option>
                  <option value="meta_ads">Meta Ads</option>
                  <option value="instagram">Instagram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="web">Web</option>
                  <option value="referral">Referido</option>
                </select>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowCreateLead(false)} className="btn-secondary text-xs py-1.5 flex-1">Cancelar</button>
                  <button type="button" onClick={handleCreateLead} disabled={creatingLead || !newLead.name.trim()}
                    className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40">
                    {creatingLead
                      ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Plus size={12} /> Crear</>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Fecha *</label>
              <input type="date" value={form.date} onChange={set('date')} className="input" required />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Hora *</label>
              <input type="time" value={form.time} onChange={set('time')} className="input" required />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Duración</label>
            <div className="flex gap-2">
              {[10, 15, 20, 30, 45, 60].map(d => (
                <button key={d} type="button"
                  onClick={() => setForm(f => ({ ...f, duration: d }))}
                  className={clsx('flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                    form.duration === d ? 'bg-primary text-white border-primary' : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                  )}>{d}m</button>
              ))}
            </div>
          </div>

          {/* Platform — only for video */}
          {form.type === 'video' && (
            <>
              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Plataforma</label>
                <div className="grid grid-cols-2 gap-2">
                  {VIDEO_PLATFORMS.map(p => (
                    <button key={p.value} type="button"
                      onClick={() => setForm(f => ({ ...f, platform: p.value }))}
                      className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all',
                        form.platform === p.value ? 'bg-primary text-white border-primary' : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                      )}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Enlace de la reunión</label>
                <input value={form.link} onChange={set('link')}
                  placeholder={VIDEO_PLATFORMS.find(p => p.value === form.platform)?.prefix + 'abc-defg'}
                  className="input text-sm" />
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Notas previas</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              className="input resize-none text-sm" placeholder="¿Qué acordaron? ¿Qué preparar para esta llamada?" />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <>{form.type === 'call' ? <Phone size={14} /> : <Video size={14} />} Agendar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── APPOINTMENT CARD ─────────────────────────────────────────────
function AppointmentCard({ appointment, lead, onOpenCockpit, onCancel, onDelete }) {
  const dateTime = appointment.scheduledAt?.toDate?.() || new Date()
  const status = APPOINTMENT_STATUS[appointment.status] || APPOINTMENT_STATUS.pending
  const type = APPOINTMENT_TYPES[appointment.type] || APPOINTMENT_TYPES.call
  const isPending = appointment.status === 'pending'
  const isCompleted = appointment.status === 'completed'

  return (
    <div className={clsx(
      'card p-4 flex flex-col gap-3 transition-all',
      isPending && 'hover:shadow-card-md'
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={clsx(
          'w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0',
          appointment.type === 'call' ? 'bg-blue-50' : 'bg-purple-50'
        )}>
          {appointment.type === 'call'
            ? <Phone size={16} className="text-blue-600" />
            : <Video size={16} className="text-purple-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-[13.5px] text-primary truncate">
              {appointment.leadName || 'Sin lead'}
            </span>
            {lead?.profileB && (
              <Star size={10} className="text-blue-500 flex-shrink-0" fill="currentColor" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-secondary">
            <Clock size={11} />
            {format(dateTime, "EEEE d 'de' MMMM · HH:mm", { locale: es })}
            <span className="text-tertiary">·</span>
            <span>{appointment.duration}min</span>
          </div>
        </div>
        {/* Status badge */}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: status.bg, color: status.color }}>
          {status.label}
        </span>
      </div>

      {/* Lead context */}
      {lead && (
        <div className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-[8px] text-[11.5px] text-secondary">
          <span>Score: <strong className="text-primary">{lead.score || 0}</strong></span>
          {lead.value > 0 && <span>${Number(lead.value).toLocaleString()} en juego</span>}
          {lead.systemStage === 'handoff' && (
            <span className="text-amber-600 font-semibold">⚡ En Handoff</span>
          )}
        </div>
      )}

      {/* Notes preview */}
      {appointment.notes && (
        <p className="text-[12px] text-secondary leading-relaxed line-clamp-2">{appointment.notes}</p>
      )}

      {/* Video link */}
      {appointment.type === 'video' && appointment.link && (
        <a href={appointment.link} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-[12px] text-blue-600 hover:underline">
          <Video size={12} /> {VIDEO_PLATFORMS.find(p => p.value === appointment.platform)?.label || 'Videollamada'}
        </a>
      )}

      {/* Outcome summary (if completed) */}
      {isCompleted && appointment.outcome && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-[8px]">
          <CheckCircle2 size={13} className="text-green-600 flex-shrink-0" />
          <span className="text-[12px] text-green-700 font-semibold">
            {appointment.outcome === 'secure' ? `Oportunidad segura · Pago: ${appointment.paymentDate || '—'}` :
              appointment.outcome === 'open' ? 'Oportunidad abierta' :
              appointment.outcome === 'discard' ? 'Descartado' :
              appointment.outcome === 'rescheduled' ? 'Reagendado' : appointment.outcome}
          </span>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2">
          <button onClick={() => onOpenCockpit(appointment)}
            className="btn-primary flex-1 text-[12.5px] py-2 flex items-center justify-center gap-1.5">
            {appointment.type === 'call' ? <Phone size={13} /> : <Video size={13} />}
            Iniciar {type.label.toLowerCase()}
          </button>
          <button onClick={() => onCancel(appointment.id)}
            className="px-3 py-2 rounded-[8px] border border-black/[0.1] text-secondary hover:border-red-200 hover:text-red-500 transition-all text-[12px]">
            <XCircle size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── TODAY PANEL ──────────────────────────────────────────────────
function TodayPanel({ appointments, leads, onOpenCockpit, onCancel }) {
  const today = new Date()
  const todayApts = appointments.filter(a => {
    const d = a.scheduledAt?.toDate?.()
    return d && isSameDay(d, today) && a.status === 'pending'
  }).sort((a, b) => {
    const da = a.scheduledAt?.toDate?.() || 0
    const db = b.scheduledAt?.toDate?.() || 0
    return da - db
  })

  if (todayApts.length === 0) return null

  return (
    <div className="border-b border-black/[0.06] bg-amber-50/50 px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-display font-bold text-[13px] text-amber-700">
          Hoy — {todayApts.length} cita{todayApts.length !== 1 ? 's' : ''} pendiente{todayApts.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {todayApts.map(a => {
          const lead = leads.find(l => l.id === a.leadId)
          const dt = a.scheduledAt?.toDate?.()
          return (
            <div key={a.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-surface rounded-[10px] border border-amber-200">
              <div className={clsx(
                'w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0',
                a.type === 'call' ? 'bg-blue-50' : 'bg-purple-50'
              )}>
                {a.type === 'call'
                  ? <Phone size={13} className="text-blue-600" />
                  : <Video size={13} className="text-purple-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[12.5px] text-primary truncate">{a.leadName}</div>
                <div className="text-[11px] text-tertiary">
                  {dt ? format(dt, 'HH:mm') : '—'} · {a.duration}min
                </div>
              </div>
              <button onClick={() => onOpenCockpit(a)}
                className="text-[11px] font-bold px-3 py-1.5 rounded-[7px] bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-1">
                {a.type === 'call' ? <Phone size={11} /> : <Video size={11} />} Iniciar
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MAIN MEETINGS ────────────────────────────────────────────────
export default function Meetings() {
  const {
    appointments, loading,
    createAppointment, cancelAppointment, deleteAppointment
  } = useAppointments()

  const { leads: allLeads, systemLeads, createLead, stages } = usePipeline()
  const leads = [...allLeads, ...systemLeads]

  const [view, setView] = useState('list')
  const [showNew, setShowNew] = useState(false)
  const [cockpit, setCockpit] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())

  // Calendar days
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  })

  const meetingsOnDay = (day) =>
    appointments.filter(a => {
      const d = a.scheduledAt?.toDate?.()
      return d && isSameDay(d, day)
    })

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    let result = [...appointments]
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter)
    if (typeFilter !== 'all') result = result.filter(a => a.type === typeFilter)
    if (view === 'calendar' && selectedDay) result = result.filter(a => {
      const d = a.scheduledAt?.toDate?.()
      return d && isSameDay(d, selectedDay)
    })
    return result.sort((a, b) => {
      const da = a.scheduledAt?.toDate?.() || 0
      const db = b.scheduledAt?.toDate?.() || 0
      return da - db
    })
  }, [appointments, statusFilter, typeFilter, view, selectedDay])

  const handleCreate = async (data) => {
    await createAppointment(data)
  }

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar esta cita?')) return
    await cancelAppointment(id)
    toast.success('Cita cancelada')
  }

  const cockpitLead = cockpit ? leads.find(l => l.id === cockpit.leadId) : null

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 py-3 flex flex-col gap-2.5 flex-shrink-0">
        {/* Row 1 — título + badge + acción */}
        <div className="flex items-center gap-3">
          <h1 className="font-display font-bold text-[15px] tracking-tight">Agenda</h1>
          <span className="text-[11px] font-semibold bg-surface-2 border border-black/[0.08] px-2.5 py-1 rounded-full text-secondary ml-1">
            {appointments.filter(a => a.status === 'pending').length} pendientes
          </span>
          <div className="ml-auto">
            <button onClick={() => setShowNew(true)}
              className="btn-primary text-[12.5px] py-1.5 px-3.5 flex items-center gap-1.5">
              <Plus size={14} strokeWidth={3} color="white" /> Nueva cita
            </button>
          </div>
        </div>

        {/* Row 2 — filtros + vista */}
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-2 border border-black/[0.08] rounded-[8px] p-0.5">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'call', label: <><Phone size={11} className="inline mr-1" />Llamadas</> },
              { value: 'video', label: <><Video size={11} className="inline mr-1" />Video</> },
            ].map(({ value, label }) => (
              <button key={value} onClick={() => setTypeFilter(value)}
                className={clsx('px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all',
                  typeFilter === value ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
                )}>{label}</button>
            ))}
          </div>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer">
            <option value="all">Todos los estados</option>
            {Object.entries(APPOINTMENT_STATUS).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>

          <div className="flex bg-surface-2 border border-black/[0.08] rounded-[8px] p-0.5 ml-auto">
            {[
              ['list', <><List size={13} className="inline mr-1" />Lista</>],
              ['calendar', <><CalendarIcon size={13} className="inline mr-1" />Calendario</>]
            ].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)}
                className={clsx('px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all',
                  view === v ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
                )}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* TODAY PANEL */}
      <TodayPanel
        appointments={appointments}
        leads={leads}
        onOpenCockpit={setCockpit}
        onCancel={handleCancel}
      />

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden flex">

        {/* CALENDAR VIEW */}
        {view === 'calendar' && (
          <div className="flex flex-1 overflow-hidden">
            {/* Mini calendar */}
            <div className="w-[320px] min-w-[320px] border-r border-black/[0.08] flex flex-col bg-surface">
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
                <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                  className="w-7 h-7 rounded-lg border border-black/[0.1] flex items-center justify-center text-secondary hover:border-black/[0.2]">
                  <ChevronLeft size={14} />
                </button>
                <span className="font-display font-bold text-sm capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </span>
                <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                  className="w-7 h-7 rounded-lg border border-black/[0.1] flex items-center justify-center text-secondary hover:border-black/[0.2]">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                {['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-tertiary uppercase py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 px-3 pb-3 flex-1">
                {calendarDays.map(day => {
                  const dayApts = meetingsOnDay(day)
                  const isSelected = selectedDay && isSameDay(day, selectedDay)
                  const inMonth = isSameMonth(day, currentMonth)
                  const pendingCount = dayApts.filter(a => a.status === 'pending').length
                  return (
                    <button key={day.toISOString()} onClick={() => setSelectedDay(day)}
                      className={clsx(
                        'aspect-square flex flex-col items-center justify-center rounded-[8px] text-[12px] font-medium transition-all relative',
                        isSelected ? 'bg-primary text-white' :
                          isToday(day) ? 'bg-accent-blue/10 text-accent-blue font-bold' :
                            inMonth ? 'text-primary hover:bg-surface-2' : 'text-tertiary/50'
                      )}>
                      {format(day, 'd')}
                      {pendingCount > 0 && (
                        <div className={clsx('w-1 h-1 rounded-full absolute bottom-1', isSelected ? 'bg-white' : 'bg-accent-blue')} />
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="px-3 pb-4">
                <button onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }}
                  className="w-full py-2 rounded-lg border border-black/[0.1] text-xs font-semibold text-secondary hover:border-black/[0.2] hover:text-primary transition-all">
                  Hoy
                </button>
              </div>
            </div>

            {/* Day detail */}
            <div className="flex-1 overflow-y-auto p-5">
              {selectedDay && (
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-base capitalize">
                    {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                  </h2>
                  <button onClick={() => setShowNew(true)} className="btn-primary text-xs py-1.5 px-3">
                    + Agendar
                  </button>
                </div>
              )}
              {!selectedDay ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <CalendarIcon size={32} className="text-tertiary mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-secondary">Selecciona un día</p>
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-12 text-secondary text-sm">Sin citas este día</div>
              ) : (
                <div className="flex flex-col gap-3 max-w-2xl">
                  {filteredAppointments.map(a => (
                    <AppointmentCard key={a.id} appointment={a}
                      lead={leads.find(l => l.id === a.leadId)}
                      onOpenCockpit={setCockpit}
                      onCancel={handleCancel}
                      onDelete={() => deleteAppointment(a.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto p-5">
            {filteredAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <CalendarIcon size={32} className="text-tertiary" strokeWidth={1.5} />
                <p className="font-display font-bold text-lg text-primary">Sin citas</p>
                <p className="text-sm text-secondary">Agenda tu primera llamada o videollamada</p>
                <button onClick={() => setShowNew(true)} className="btn-primary text-sm py-2 px-4 mt-1">
                  Nueva cita
                </button>
              </div>
            ) : (
              <div className="max-w-3xl flex flex-col gap-3">
                {filteredAppointments.map(a => (
                  <AppointmentCard key={a.id} appointment={a}
                    lead={leads.find(l => l.id === a.leadId)}
                    onOpenCockpit={setCockpit}
                    onCancel={handleCancel}
                    onDelete={() => deleteAppointment(a.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      {showNew && (
        <NewAppointmentModal leads={leads} defaultDate={selectedDay}
          onClose={() => setShowNew(false)} onCreate={handleCreate}
          createLead={createLead} stages={stages} />
      )}

      {cockpit && (
        <CallCockpit
          appointment={cockpit}
          lead={cockpitLead}
          onClose={() => setCockpit(null)}
          onCompleted={() => setCockpit(null)}
        />
      )}
    </div>
  )
}
