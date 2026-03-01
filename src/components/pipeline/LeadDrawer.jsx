import { useState, useEffect } from 'react'
import { doc, collection, addDoc, onSnapshot, serverTimestamp, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { usePipeline } from '@/hooks/usePipeline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const SOURCE_CONFIG = {
  meta_ads:  { icon: '🔵', label: 'Meta Ads' },
  instagram: { icon: '📸', label: 'Instagram' },
  whatsapp:  { icon: '💬', label: 'WhatsApp' },
  linkedin:  { icon: '💼', label: 'LinkedIn' },
  web:       { icon: '🌐', label: 'Web' },
  referral:  { icon: '⭐', label: 'Referido' },
  manual:    { icon: '✏️', label: 'Manual' },
}

const INTERACTION_TYPES = [
  { value: 'note',     label: 'Nota',       icon: '📝' },
  { value: 'call',     label: 'Llamada',    icon: '📞' },
  { value: 'whatsapp', label: 'WhatsApp',   icon: '💬' },
  { value: 'email',    label: 'Email',      icon: '📧' },
  { value: 'meeting',  label: 'Reunión',    icon: '📅' },
]

function ScoreRing({ score }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const pct = (score || 0) / 100
  const color = score >= 80 ? '#00c853' : score >= 50 ? '#f59e0b' : '#6e6e73'

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="6"/>
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display font-bold text-xl leading-none" style={{ color }}>{score || 0}</span>
        <span className="text-[9px] text-tertiary font-semibold uppercase tracking-wide">score</span>
      </div>
    </div>
  )
}

function InteractionItem({ item }) {
  const type = INTERACTION_TYPES.find(t => t.value === item.type) || INTERACTION_TYPES[0]
  const date = item.createdAt?.toDate ? format(item.createdAt.toDate(), "d MMM · HH:mm", { locale: es }) : ''

  return (
    <div className="flex gap-3 py-3 border-b border-black/[0.05] last:border-0">
      <div className="w-7 h-7 rounded-lg bg-surface-2 border border-black/[0.06] flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
        {type.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-semibold text-secondary">{type.label}</span>
          <span className="text-[11px] text-tertiary">{date}</span>
        </div>
        <p className="text-[13px] text-primary leading-relaxed">{item.content}</p>
      </div>
    </div>
  )
}

export default function LeadDrawer({ lead, onClose, onUpdate }) {
  const { org } = useAuthStore()
  const { stages, updateLead, deleteLead } = usePipeline()
  const [interactions, setInteractions] = useState([])
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState('note')
  const [addingNote, setAddingNote] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: lead.name || '',
    company: lead.company || '',
    email: lead.email || '',
    phone: lead.phone || '',
    value: lead.value || '',
  })
  const [saving, setSaving] = useState(false)

  const currentStage = stages.find(s => s.id === lead.stageId)
  const source = SOURCE_CONFIG[lead.source] || SOURCE_CONFIG.manual

  // Real-time interactions
  useEffect(() => {
    if (!org?.id || !lead.id) return
    const q = query(
      collection(db, 'organizations', org.id, 'leads', lead.id, 'interactions'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setInteractions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [org?.id, lead.id])

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    try {
      await addDoc(
        collection(db, 'organizations', org.id, 'leads', lead.id, 'interactions'),
        { type: noteType, content: noteText.trim(), createdAt: serverTimestamp() }
      )
      setNoteText('')
      toast.success('Guardado')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setAddingNote(false)
    }
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      await updateLead(lead.id, {
        ...editForm,
        value: Number(editForm.value) || 0,
      })
      setEditing(false)
      toast.success('Actualizado')
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleStageChange = async (stageId) => {
    try {
      await updateLead(lead.id, { stageId })
      toast.success('Etapa actualizada')
    } catch {
      toast.error('Error')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar a ${lead.name}? Esta acción no se puede deshacer.`)) return
    try {
      await deleteLead(lead.id)
      toast.success('Lead eliminado')
      onClose()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const formatValue = (v) => v ? `$${Number(v).toLocaleString()} USD` : '—'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-surface z-50 flex flex-col shadow-[−8px_0_40px_rgba(0,0,0,0.12)] border-l border-black/[0.08]">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-black/[0.08] flex-shrink-0">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: currentStage?.color || '#0a0a0a' }}
          >
            {lead.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-lg tracking-tight leading-tight truncate">
              {lead.name}
            </h2>
            {lead.company && (
              <p className="text-sm text-secondary truncate">{lead.company}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setEditing(!editing)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors"
              title="Editar"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M10 2l2 2-8 8H2v-2l8-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Eliminar"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2 hover:text-primary transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* SCORE + META ROW */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-black/[0.06]">
            <ScoreRing score={lead.score} />
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wide w-16">Fuente</span>
                <span className="text-[12.5px] font-medium text-primary flex items-center gap-1">
                  {source.icon} {source.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wide w-16">Valor</span>
                <span className="text-[12.5px] font-bold text-primary">{formatValue(lead.value)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wide w-16">Email</span>
                <span className="text-[12.5px] text-primary truncate">{lead.email || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wide w-16">Tel</span>
                <span className="text-[12.5px] text-primary">{lead.phone || '—'}</span>
              </div>
            </div>
          </div>

          {/* EDIT FORM */}
          {editing && (
            <div className="px-6 py-4 border-b border-black/[0.06] bg-surface-2">
              <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Editar información</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'name', label: 'Nombre', placeholder: 'Carlos Ramírez' },
                  { key: 'company', label: 'Empresa', placeholder: 'TechSoluciones' },
                  { key: 'email', label: 'Email', placeholder: 'carlos@empresa.com' },
                  { key: 'phone', label: 'Teléfono', placeholder: '+52 81 0000 0000' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1">{f.label}</label>
                    <input
                      value={editForm[f.key]}
                      onChange={e => setEditForm(ef => ({ ...ef, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="input text-[12.5px] py-1.5"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-semibold text-tertiary uppercase tracking-wide block mb-1">Valor (USD)</label>
                  <input
                    type="number"
                    value={editForm.value}
                    onChange={e => setEditForm(ef => ({ ...ef, value: e.target.value }))}
                    placeholder="0"
                    className="input text-[12.5px] py-1.5"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditing(false)} className="btn-secondary text-xs py-1.5 flex-1">Cancelar</button>
                <button onClick={handleSaveEdit} disabled={saving} className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1.5">
                  {saving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"/> : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* STAGE SELECTOR */}
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Etapa</p>
            <div className="flex flex-wrap gap-2">
              {stages.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => handleStageChange(stage.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150"
                  style={{
                    borderColor: lead.stageId === stage.id ? stage.color : 'rgba(0,0,0,0.1)',
                    background: lead.stageId === stage.id ? `${stage.color}15` : 'transparent',
                    color: lead.stageId === stage.id ? stage.color : '#6e6e73',
                  }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  {stage.name}
                </button>
              ))}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Acciones rápidas</p>
            <div className="flex gap-2">
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/[0.1] text-xs font-semibold text-secondary hover:border-black/[0.2] hover:text-primary transition-all"
                >
                  📞 Llamar
                </a>
              )}
              {lead.phone && (
                <a
                  href={`https://wa.me/${lead.phone?.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/[0.1] text-xs font-semibold text-secondary hover:border-green-300 hover:text-green-600 transition-all"
                >
                  💬 WhatsApp
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-black/[0.1] text-xs font-semibold text-secondary hover:border-blue-300 hover:text-blue-600 transition-all"
                >
                  📧 Email
                </a>
              )}
            </div>
          </div>

          {/* ADD INTERACTION */}
          <div className="px-6 py-4 border-b border-black/[0.06]">
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-3">Agregar interacción</p>

            {/* Type selector */}
            <div className="flex gap-1.5 mb-3">
              {INTERACTION_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setNoteType(t.value)}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all',
                    noteType === t.value
                      ? 'bg-primary text-white border-primary'
                      : 'border-black/[0.1] text-secondary hover:border-black/[0.2]'
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Escribe aquí..."
              rows={3}
              className="input resize-none text-[13px] leading-relaxed"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote()
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-tertiary">⌘+Enter para guardar</span>
              <button
                onClick={handleAddNote}
                disabled={addingNote || !noteText.trim()}
                className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 disabled:opacity-40"
              >
                {addingNote
                  ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"/>
                  : 'Guardar'}
              </button>
            </div>
          </div>

          {/* INTERACTIONS HISTORY */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-semibold text-secondary uppercase tracking-wide mb-1">
              Historial ({interactions.length})
            </p>
            {interactions.length === 0 ? (
              <p className="text-sm text-tertiary py-4 text-center">Sin interacciones aún</p>
            ) : (
              interactions.map(item => <InteractionItem key={item.id} item={item} />)
            )}
          </div>

        </div>
      </div>
    </>
  )
}
