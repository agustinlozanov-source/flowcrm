import { useState, useEffect, useMemo } from 'react'
import {
  collection, addDoc, onSnapshot, query,
  orderBy, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { usePipeline } from '@/hooks/usePipeline'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, startOfWeek, endOfWeek
} from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { X, Plus, Clock, User, Calendar as CalendarIcon, Video, Monitor, Users, Link2, List } from 'lucide-react'

const PLATFORMS = [
  { value: 'meet', label: 'Google Meet', icon: <Video className="w-3.5 h-3.5" />, prefix: 'https://meet.google.com/' },
  { value: 'zoom', label: 'Zoom', icon: <Monitor className="w-3.5 h-3.5" />, prefix: 'https://zoom.us/j/' },
  { value: 'teams', label: 'Microsoft Teams', icon: <Users className="w-3.5 h-3.5" />, prefix: 'https://teams.microsoft.com/' },
  { value: 'custom', label: 'Enlace propio', icon: <Link2 className="w-3.5 h-3.5" />, prefix: '' },
]

const STATUS_CONFIG = {
  scheduled: { label: 'Agendada', color: '#0066ff', bg: 'rgba(0,102,255,0.08)' },
  completed: { label: 'Realizada', color: '#00c853', bg: 'rgba(0,200,83,0.08)' },
  cancelled: { label: 'Cancelada', color: '#ff3b30', bg: 'rgba(255,59,48,0.08)' },
  noshow: { label: 'No show', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
}

function NewMeetingModal({ leads, onClose, onCreate, defaultDate }) {
  const [form, setForm] = useState({
    leadId: '',
    title: '',
    date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: '10:00',
    duration: 30,
    platform: 'meet',
    link: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Agrega un título'); return }
    if (!form.date || !form.time) { toast.error('Selecciona fecha y hora'); return }
    setLoading(true)
    try {
      const dateTime = new Date(`${form.date}T${form.time}:00`)
      await onCreate({ ...form, dateTime })
      toast.success('Reunión agendada')
      onClose()
    } catch { toast.error('Error al agendar') }
    finally { setLoading(false) }
  }

  const selectedLead = leads.find(l => l.id === form.leadId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-md border border-black/[0.08]">

        <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.06]">
          <div>
            <h2 className="font-display font-bold text-lg tracking-tight">Nueva reunión</h2>
            <p className="text-xs text-secondary mt-0.5">Agenda una videollamada de cierre</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">

          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Título *</label>
            <input value={form.title} onChange={set('title')} placeholder="Demo FlowCRM — Carlos Ramírez" className="input" required autoFocus />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Lead asociado</label>
            <select value={form.leadId} onChange={set('leadId')} className="input">
              <option value="">Sin asociar</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.name}{l.company ? ` — ${l.company}` : ''}</option>)}
            </select>
          </div>

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

          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Duración</label>
            <div className="flex gap-2">
              {[15, 30, 45, 60, 90].map(d => (
                <button key={d} type="button"
                  onClick={() => setForm(f => ({ ...f, duration: d }))}
                  className={clsx('flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                    form.duration === d ? 'bg-primary text-white border-primary' : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                  )}
                >{d}m</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Plataforma</label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map(p => (
                <button key={p.value} type="button"
                  onClick={() => setForm(f => ({ ...f, platform: p.value }))}
                  className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all',
                    form.platform === p.value ? 'bg-primary text-white border-primary' : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                  )}
                >
                  <span className="text-secondary opacity-70 flex items-center">{p.icon}</span> {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
              Enlace de la reunión
            </label>
            <input
              value={form.link} onChange={set('link')}
              placeholder={PLATFORMS.find(p => p.value === form.platform)?.prefix + 'abc-defg-hij'}
              className="input text-sm"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">Notas</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className="input resize-none text-sm" placeholder="Contexto para la reunión..." />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Agendar reunión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MeetingCard({ meeting, leads, onStatusChange, onDelete }) {
  const lead = leads.find(l => l.id === meeting.leadId)
  const platform = PLATFORMS.find(p => p.value === meeting.platform) || PLATFORMS[0]
  const status = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled
  const dateTime = meeting.dateTime?.toDate ? meeting.dateTime.toDate() : new Date(meeting.dateTime)

  return (
    <div className="card p-4 flex gap-4 hover:shadow-card-md transition-all">
      {/* Date block */}
      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-[10px] bg-surface-2 border border-black/[0.08] flex-shrink-0">
        <span className="text-[10px] font-bold text-tertiary uppercase">{format(dateTime, 'MMM', { locale: es })}</span>
        <span className="font-display font-bold text-lg leading-none text-primary">{format(dateTime, 'd')}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-display font-semibold text-[13.5px] text-primary leading-tight truncate">{meeting.title}</h3>
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11.5px] text-secondary flex-wrap">
          <span className="flex items-center gap-1"><Clock size={12} className="opacity-70" /> {format(dateTime, 'HH:mm')} · {meeting.duration}min</span>
          <span className="flex items-center gap-1"><span className="opacity-70 flex items-center">{platform.icon}</span> {platform.label}</span>
          {lead && <span className="flex items-center gap-1"><User size={12} className="opacity-70" /> {lead.name}</span>}
        </div>

        {meeting.notes && (
          <p className="text-[11.5px] text-tertiary mt-1.5 line-clamp-1">{meeting.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        {meeting.link && (
          <a href={meeting.link} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent-blue text-white text-[11px] font-bold hover:opacity-90 transition-opacity">
            Unirse →
          </a>
        )}
        <select
          value={meeting.status}
          onChange={e => onStatusChange(meeting.id, e.target.value)}
          className="text-[11px] bg-surface-2 border border-black/[0.08] rounded-lg px-2 py-1 text-secondary outline-none cursor-pointer"
        >
          {Object.entries(STATUS_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
        <button onClick={() => onDelete(meeting.id)}
          className="text-[11px] text-tertiary hover:text-red-500 transition-colors text-center py-0.5">
          Eliminar
        </button>
      </div>
    </div>
  )
}

export default function Meetings() {
  const { org } = useAuthStore()
  const { leads } = usePipeline()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'calendar'
  const [showNew, setShowNew] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  // Real-time meetings
  useEffect(() => {
    if (!org?.id) return
    const q = query(
      collection(db, 'organizations', org.id, 'meetings'),
      orderBy('dateTime', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [org?.id])

  const handleCreate = async (data) => {
    await addDoc(collection(db, 'organizations', org.id, 'meetings'), {
      title: data.title,
      leadId: data.leadId || null,
      dateTime: data.dateTime,
      duration: data.duration,
      platform: data.platform,
      link: data.link || '',
      notes: data.notes || '',
      status: 'scheduled',
      createdAt: serverTimestamp(),
    })
  }

  const handleStatusChange = async (id, status) => {
    await updateDoc(doc(db, 'organizations', org.id, 'meetings', id), { status })
    toast.success('Estado actualizado')
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta reunión?')) return
    await deleteDoc(doc(db, 'organizations', org.id, 'meetings', id))
    toast.success('Reunión eliminada')
  }

  // Calendar days
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const meetingsOnDay = (day) => meetings.filter(m => {
    const d = m.dateTime?.toDate ? m.dateTime.toDate() : new Date(m.dateTime)
    return isSameDay(d, day)
  })

  const filteredMeetings = useMemo(() => {
    let result = [...meetings]
    if (statusFilter !== 'all') result = result.filter(m => m.status === statusFilter)
    if (selectedDay) result = result.filter(m => {
      const d = m.dateTime?.toDate ? m.dateTime.toDate() : new Date(m.dateTime)
      return isSameDay(d, selectedDay)
    })
    return result
  }, [meetings, statusFilter, selectedDay])

  const upcomingCount = meetings.filter(m => m.status === 'scheduled').length

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-[15px] tracking-tight">Reuniones</h1>

        {upcomingCount > 0 && (
          <span className="text-[11px] font-semibold bg-blue-50 text-accent-blue px-2.5 py-1 rounded-full">
            {upcomingCount} próximas
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Status filter */}
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setSelectedDay(null) }}
            className="text-[12.5px] bg-surface-2 border border-black/[0.08] rounded-[8px] px-3 py-1.5 text-secondary outline-none cursor-pointer">
            <option value="all">Todos los estados</option>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex bg-surface-2 border border-black/[0.08] rounded-[8px] p-0.5">
            {[['list', <><List size={13} className="mr-1" /> Lista</>], ['calendar', <><CalendarIcon size={13} className="mr-1" /> Calendario</>]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)}
                className={clsx('px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all',
                  view === v ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
                )}>{l}</button>
            ))}
          </div>

          <button onClick={() => setShowNew(true)} className="btn-primary text-[12.5px] py-1.5 px-3.5 flex items-center gap-1.5">
            <Plus size={14} strokeWidth={3} color="white" />
            Nueva reunión
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">

        {/* CALENDAR VIEW */}
        {view === 'calendar' && (
          <div className="flex flex-1 overflow-hidden">

            {/* Calendar */}
            <div className="w-[340px] min-w-[340px] border-r border-black/[0.08] flex flex-col bg-surface">
              {/* Month nav */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
                <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                  className="w-7 h-7 rounded-lg border border-black/[0.1] flex items-center justify-center text-secondary hover:border-black/[0.2]">
                  ‹
                </button>
                <span className="font-display font-bold text-sm capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </span>
                <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                  className="w-7 h-7 rounded-lg border border-black/[0.1] flex items-center justify-center text-secondary hover:border-black/[0.2]">
                  ›
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-tertiary uppercase py-1">{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 px-3 pb-3 flex-1">
                {calendarDays.map(day => {
                  const dayMeetings = meetingsOnDay(day)
                  const isSelected = selectedDay && isSameDay(day, selectedDay)
                  const inMonth = isSameMonth(day, currentMonth)

                  return (
                    <button key={day.toISOString()} onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={clsx(
                        'aspect-square flex flex-col items-center justify-center rounded-[8px] text-[12px] font-medium transition-all relative',
                        isSelected ? 'bg-primary text-white' :
                          isToday(day) ? 'bg-accent-blue/10 text-accent-blue font-bold' :
                            inMonth ? 'text-primary hover:bg-surface-2' : 'text-tertiary/50'
                      )}
                    >
                      {format(day, 'd')}
                      {dayMeetings.length > 0 && (
                        <div className={clsx('w-1 h-1 rounded-full absolute bottom-1', isSelected ? 'bg-white' : 'bg-accent-blue')} />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Today button */}
              <div className="px-3 pb-4">
                <button onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }}
                  className="w-full py-2 rounded-lg border border-black/[0.1] text-xs font-semibold text-secondary hover:border-black/[0.2] hover:text-primary transition-all">
                  Hoy
                </button>
              </div>
            </div>

            {/* Day meetings list */}
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
                  <div className="w-16 h-16 rounded-2xl bg-black/[0.02] border border-black/[0.05] flex items-center justify-center text-tertiary mb-2 mx-auto">
                    <CalendarIcon size={32} strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-semibold text-secondary">Selecciona un día</p>
                  <p className="text-xs text-tertiary mt-1">Los puntos azules indican días con reuniones</p>
                </div>
              ) : filteredMeetings.length === 0 ? (
                <div className="text-center py-12 text-secondary text-sm">
                  Sin reuniones este día
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredMeetings.map(m => (
                    <MeetingCard key={m.id} meeting={m} leads={leads}
                      onStatusChange={handleStatusChange} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto p-5">
            {filteredMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-16 h-16 rounded-2xl bg-black/[0.02] border border-black/[0.05] flex items-center justify-center text-tertiary mb-2">
                  <CalendarIcon size={32} strokeWidth={1.5} />
                </div>
                <p className="font-display font-bold text-lg text-primary">Sin reuniones</p>
                <p className="text-sm text-secondary">Agenda tu primera videollamada de cierre</p>
                <button onClick={() => setShowNew(true)} className="btn-primary text-sm py-2 px-4 mt-1">
                  Nueva reunión
                </button>
              </div>
            ) : (
              <div className="max-w-3xl flex flex-col gap-3">
                {filteredMeetings.map(m => (
                  <MeetingCard key={m.id} meeting={m} leads={leads}
                    onStatusChange={handleStatusChange} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showNew && (
        <NewMeetingModal
          leads={leads}
          defaultDate={selectedDay}
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
