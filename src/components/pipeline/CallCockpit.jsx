import { useState } from 'react'
import { useAppointments, DISCARD_CATEGORIES_CALL } from '@/hooks/useAppointments'
import { usePipeline, DISCARD_CATEGORIES } from '@/hooks/usePipeline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  Phone, Video, X, CheckCircle2, Clock,
  XCircle, ArrowRight, RotateCcw, User,
  FileText, AlertTriangle
} from 'lucide-react'

// ─── OUTCOME OPTIONS ─────────────────────────────────────────────
const OUTCOMES = [
  {
    value: 'secure',
    label: 'Tiene fecha de pago',
    desc: 'Se comprometió a pagar en una fecha específica',
    color: '#0066ff',
    bg: 'rgba(0,102,255,0.06)',
    border: 'rgba(0,102,255,0.2)',
    icon: CheckCircle2,
    iconColor: 'text-blue-600',
  },
  {
    value: 'open',
    label: 'Interesado pero sin fecha',
    desc: 'Hubo interés pero no se confirmó cuándo paga',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.06)',
    border: 'rgba(99,102,241,0.2)',
    icon: Clock,
    iconColor: 'text-indigo-500',
  },
  {
    value: 'rescheduled',
    label: 'Reagendar llamada',
    desc: 'No contestó o necesita otra llamada',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.2)',
    icon: RotateCcw,
    iconColor: 'text-amber-500',
  },
  {
    value: 'discard',
    label: 'No se va a cerrar',
    desc: 'La llamada no resultó en oportunidad viable',
    color: '#ff3b30',
    bg: 'rgba(255,59,48,0.06)',
    border: 'rgba(255,59,48,0.2)',
    icon: XCircle,
    iconColor: 'text-red-500',
  },
]

export default function CallCockpit({ appointment, lead, onClose, onCompleted }) {
  const { completeAppointment, createAppointment } = useAppointments()
  const { resolveHandoff, discardLead } = usePipeline()

  const [notes, setNotes] = useState(appointment.notes || '')
  const [outcome, setOutcome] = useState(null)
  const [paymentDate, setPaymentDate] = useState('')
  const [discardCategory, setDiscardCategory] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('10:00')
  const [saving, setSaving] = useState(false)

  const isCall = appointment.type === 'call'
  const dateTime = appointment.scheduledAt?.toDate?.() || new Date()

  const handleComplete = async () => {
    if (!outcome) { toast.error('Selecciona el resultado de la llamada'); return }
    if (outcome === 'secure' && !paymentDate) { toast.error('Ingresa la fecha de pago'); return }
    if (outcome === 'discard' && !discardCategory) { toast.error('Selecciona la razón de descarte'); return }
    if (outcome === 'rescheduled' && !rescheduleDate) { toast.error('Selecciona la fecha de la nueva llamada'); return }

    setSaving(true)
    try {
      // 1. Complete the appointment
      await completeAppointment(appointment.id, {
        outcome,
        outcomeNotes: notes,
        paymentDate: outcome === 'secure' ? paymentDate : null,
        discardCategory: outcome === 'discard' ? discardCategory : null,
      })

      // 2. Update pipeline if lead is in handoff
      if (lead?.systemStage === 'handoff') {
        if (outcome === 'secure') {
          await resolveHandoff(lead.id, 'secure_opportunity', { paymentDate, handoffNotes: notes })
          toast.success('Lead movido a Oportunidad Segura ✓')
        } else if (outcome === 'open') {
          await resolveHandoff(lead.id, 'open_opportunity', { handoffNotes: notes })
          toast.success('Lead movido a Oportunidad Abierta')
        } else if (outcome === 'discard') {
          await resolveHandoff(lead.id, 'discard', { category: discardCategory, notes })
          toast.success('Lead descartado')
        }
      }

      // 3. If rescheduled — create new appointment
      if (outcome === 'rescheduled') {
        const newDateTime = new Date(`${rescheduleDate}T${rescheduleTime}:00`)
        await createAppointment({
          leadId: appointment.leadId,
          leadName: appointment.leadName,
          type: appointment.type,
          scheduledAt: newDateTime,
          duration: appointment.duration,
          platform: appointment.platform,
          link: appointment.link,
          notes: `Reagendada desde llamada del ${format(dateTime, "d 'de' MMMM", { locale: es })}`,
          assignedTo: appointment.assignedTo,
        })
        toast.success('Nueva llamada agendada')
      }

      onCompleted?.()
      onClose()
    } catch (err) {
      toast.error('Error al registrar resultado')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[20px] shadow-[0_32px_80px_rgba(0,0,0,0.2)] w-full max-w-lg border border-black/[0.08] max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-black/[0.06]">
          <div className={clsx(
            'w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0',
            isCall ? 'bg-blue-50' : 'bg-purple-50'
          )}>
            {isCall
              ? <Phone size={18} className="text-blue-600" />
              : <Video size={18} className="text-purple-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={clsx(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                isCall ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
              )}>
                {isCall ? 'Llamada' : 'Videollamada'}
              </span>
              <span className="text-[11px] text-tertiary">
                {format(dateTime, "d 'de' MMMM · HH:mm", { locale: es })}
              </span>
            </div>
            <h2 className="font-display font-bold text-lg tracking-tight leading-tight">
              {appointment.leadName || 'Sin lead asignado'}
            </h2>
            {lead && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] text-secondary flex items-center gap-1">
                  <User size={10} /> Score: {lead.score || 0}
                </span>
                {lead.value > 0 && (
                  <span className="text-[11px] text-secondary">
                    ${Number(lead.value).toLocaleString()} en juego
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Lead context */}
        {lead && lead.score > 0 && (
          <div className="px-6 py-3 border-b border-black/[0.06] bg-surface-2">
            <p className="text-[10px] font-bold text-secondary uppercase tracking-wide mb-2">Contexto del lead</p>
            <div className="flex flex-wrap gap-3 text-[11.5px] text-secondary">
              {lead.company && <span>🏢 {lead.company}</span>}
              {lead.email && <span>✉️ {lead.email}</span>}
              {lead.phone && <span>📱 {lead.phone}</span>}
              {lead.source && <span>📍 {lead.source}</span>}
            </div>
          </div>
        )}

        <div className="p-6 flex flex-col gap-5">

          {/* Notes */}
          <div>
            <label className="text-[11px] font-bold text-secondary uppercase tracking-wide block mb-2 flex items-center gap-1.5">
              <FileText size={12} /> Notas de la llamada
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className="input resize-none text-sm leading-relaxed"
              placeholder="¿Qué dijo el lead? ¿Qué objeciones tuvo? ¿En qué quedaron?&#10;&#10;Estas notas quedan en el historial del lead..."
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="text-[11px] font-bold text-secondary uppercase tracking-wide block mb-3">
              ¿Cómo terminó la llamada? *
            </label>
            <div className="flex flex-col gap-2">
              {OUTCOMES.map(opt => {
                const Icon = opt.icon
                return (
                  <button key={opt.value} type="button"
                    onClick={() => setOutcome(opt.value)}
                    className="flex items-start gap-3 px-4 py-3 rounded-[10px] border text-left transition-all"
                    style={{
                      borderColor: outcome === opt.value ? opt.color : 'rgba(0,0,0,0.08)',
                      background: outcome === opt.value ? opt.bg : 'transparent',
                    }}>
                    <Icon size={15} className={clsx('flex-shrink-0 mt-0.5', opt.iconColor)} />
                    <div>
                      <div className="text-[13px] font-semibold text-primary">{opt.label}</div>
                      <div className="text-[11px] text-tertiary">{opt.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Secure — payment date */}
          {outcome === 'secure' && (
            <div>
              <label className="text-[11px] font-bold text-secondary uppercase tracking-wide block mb-1.5">
                Fecha de pago *
              </label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                className="input" min={new Date().toISOString().split('T')[0]} />
              {paymentDate && (
                <p className="text-[10px] text-blue-600 mt-1.5">
                  ✓ El lead pasará a Oportunidad Segura con fecha de pago: {format(new Date(paymentDate), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              )}
            </div>
          )}

          {/* Discard — category */}
          {outcome === 'discard' && (
            <div>
              <label className="text-[11px] font-bold text-secondary uppercase tracking-wide block mb-1.5">
                Razón del descarte *
              </label>
              <div className="flex flex-col gap-1.5">
                {DISCARD_CATEGORIES.filter(c => c.value !== 'handoff_bound').map(cat => (
                  <button key={cat.value} type="button"
                    onClick={() => setDiscardCategory(cat.value)}
                    className={clsx(
                      'flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] border text-left transition-all',
                      discardCategory === cat.value
                        ? 'border-red-300 bg-red-50'
                        : 'border-black/[0.08] hover:border-black/[0.16]'
                    )}>
                    <div className={clsx(
                      'w-3 h-3 rounded-full border-2 flex-shrink-0 mt-0.5',
                      discardCategory === cat.value ? 'border-red-500 bg-red-500' : 'border-black/20'
                    )} />
                    <div>
                      <div className="text-[12px] font-semibold text-primary">{cat.label}</div>
                      <div className="text-[10.5px] text-tertiary">{cat.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              {discardCategory === 'blacklist' && (
                <div className="flex items-start gap-2 p-3 mt-2 bg-red-50 border border-red-200 rounded-[8px]">
                  <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700">Este lead no volverá a aparecer en el pipeline.</p>
                </div>
              )}
            </div>
          )}

          {/* Rescheduled — new date */}
          {outcome === 'rescheduled' && (
            <div>
              <label className="text-[11px] font-bold text-secondary uppercase tracking-wide block mb-1.5">
                Nueva fecha y hora *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                  className="input" min={new Date().toISOString().split('T')[0]} />
                <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                  className="input" />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button
              onClick={handleComplete}
              disabled={saving || !outcome}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><ArrowRight size={14} /> Registrar resultado</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
