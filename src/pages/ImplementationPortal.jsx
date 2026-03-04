import { Rocket, Target, MessageSquare, Bot, Clapperboard, CheckCircle2, ClipboardList, Wrench, Key as KeyIcon, BarChart3, Globe, Smartphone, Lightbulb, GraduationCap, Search, Sparkles, Calendar, MessageCircle, Folder, Link as LinkIcon, Pencil, FileText, Image as ImageIcon, Paperclip, Zap, User, LogOut, Info, Users } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import {
  collection, onSnapshot, query, orderBy, doc, setDoc,
  updateDoc, addDoc, serverTimestamp, getDoc, deleteDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { DEFAULT_TEMPLATE } from './TemplateEditor'
import TemplateEditorComponent from './TemplateEditor'

// Wrapper so TemplateEditor renders inside the same page
const TemplateEditorInline = () => <TemplateEditorComponent />

// ─── TEMPLATE STAGES — loaded dynamically from Firestore ───
// Falls back to DEFAULT_TEMPLATE if nothing saved yet
let TEMPLATE_STAGES = DEFAULT_TEMPLATE

async function loadTemplate() {
  try {
    const snap = await getDoc(doc(db, 'config', 'implementationTemplate'))
    if (snap.exists() && snap.data().stages?.length > 0) {
      TEMPLATE_STAGES = snap.data().stages
    }
  } catch {}
}

// Hook to get live template stages
function useTemplateStages() {
  const [stages, setStages] = useState(TEMPLATE_STAGES)
  useEffect(() => {
    loadTemplate().then(() => setStages([...TEMPLATE_STAGES]))
    const unsub = onSnapshot(doc(db, 'config', 'implementationTemplate'), snap => {
      if (snap.exists() && snap.data().stages?.length > 0) {
        TEMPLATE_STAGES = snap.data().stages
        setStages([...TEMPLATE_STAGES])
      }
    })
    return unsub
  }, [])
  return stages
}

const addBusinessDays = (date, days) => {
  let d = new Date(date), added = 0
  while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++ }
  return d
}

const fmtDate = (d) => {
  if (!d) return '—'
  const date = d.toDate ? d.toDate() : new Date(d)
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

const fmtDateInput = (d) => {
  if (!d) return ''
  const date = d.toDate ? d.toDate() : new Date(d)
  return date.toISOString().split('T')[0]
}

// ─── STYLES ───

const StageIcon = ({ icon, size = 16 }) => {
  const map = {
    'rocket': <Rocket size={size} />,
    'target': <Target size={size} />,
    'message-square': <MessageSquare size={size} />,
    'bot': <Bot size={size} />,
    'clapperboard': <Clapperboard size={size} />,
    'check-circle-2': <CheckCircle2 size={size} />,
    'clipboard-list': <ClipboardList size={size} />,
    'wrench': <Wrench size={size} />,
    'key': <KeyIcon size={size} />,
    'bar-chart-3': <BarChart3 size={size} />,
    'globe': <Globe size={size} />,
    'smartphone': <Smartphone size={size} />,
    'lightbulb': <Lightbulb size={size} />,
    'graduation-cap': <GraduationCap size={size} />,
    'search': <Search size={size} />
  }
  return map[icon] || <Sparkles size={size} />
}

const css = `
  .ip-root { font-family: 'Inter', sans-serif; }
  .ip-root * { box-sizing: border-box; }

  .ip-grid { display: grid; grid-template-columns: 320px 1fr; gap: 20px; }

  .ip-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; overflow: hidden;
  }

  .ip-card-header {
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; align-items: center; gap: 10px;
  }

  .ip-card-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 800; flex: 1; }

  .ip-client-list { display: flex; flex-direction: column; }

  .ip-client-item {
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    cursor: pointer; transition: background 0.15s;
    display: flex; align-items: center; gap: 12px;
  }

  .ip-client-item:last-child { border-bottom: none; }
  .ip-client-item:hover { background: rgba(255,255,255,0.03); }
  .ip-client-item.active { background: rgba(0,102,255,0.08); border-left: 2px solid #0066ff; }

  .ip-client-avatar {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #0066ff, #7c3aed);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13px; font-weight: 800; flex-shrink: 0;
  }

  .ip-client-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 700; margin-bottom: 2px; }
  .ip-client-sub { font-size: 11px; color: var(--gray-4); }

  .ip-progress-bar {
    height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px;
    margin-top: 6px; overflow: hidden;
  }
  .ip-progress-fill { height: 100%; border-radius: 2px; background: #0066ff; transition: width 0.3s; }

  /* STAGES */
  .ip-stages { display: flex; flex-direction: column; gap: 12px; }

  .ip-stage {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; overflow: hidden;
  }

  .ip-stage-header {
    padding: 14px 18px;
    display: flex; align-items: center; gap: 10px;
    cursor: pointer; transition: background 0.15s;
  }

  .ip-stage-header:hover { background: rgba(255,255,255,0.02); }

  .ip-stage-icon { font-size: 16px; }

  .ip-stage-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 800; flex: 1; }

  .ip-stage-dates { font-size: 11px; color: var(--gray-4); }

  .ip-stage-progress {
    font-size: 11px; font-weight: 700;
    padding: 2px 8px; border-radius: 5px;
  }

  .ip-stage-chevron { font-size: 11px; color: var(--gray-5); transition: transform 0.2s; }
  .ip-stage-chevron.open { transform: rotate(90deg); }

  /* TASKS */
  .ip-tasks { border-top: 1px solid rgba(255,255,255,0.05); }

  .ip-task {
    padding: 12px 18px 12px 48px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    display: flex; align-items: flex-start; gap: 12px;
    transition: background 0.15s;
  }

  .ip-task:last-child { border-bottom: none; }
  .ip-task:hover { background: rgba(255,255,255,0.02); }

  .ip-task-check {
    width: 18px; height: 18px; border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px; cursor: pointer;
    transition: all 0.15s; font-size: 9px;
  }

  .ip-task-check.done { background: #00c853; border-color: #00c853; color: white; }
  .ip-task-check.client-done { background: #0066ff; border-color: #0066ff; color: white; }

  .ip-task-content { flex: 1; }

  .ip-task-name {
    font-size: 12.5px; font-weight: 600; margin-bottom: 3px;
    text-decoration: none; color: white;
  }

  .ip-task-name.done { text-decoration: line-through; color: var(--gray-5); }

  .ip-task-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  .ip-task-how { font-size: 11px; color: var(--gray-4); flex: 1; line-height: 1.4; margin-top: 3px; }

  .ip-badge {
    font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 5px;
    display: inline-flex; align-items: center; gap: 3px;
  }

  .ip-badge-qubit { background: rgba(0,102,255,0.12); color: #4d9fff; border: 1px solid rgba(0,102,255,0.2); }
  .ip-badge-client { background: rgba(0,200,83,0.12); color: #00c853; border: 1px solid rgba(0,200,83,0.2); }
  .ip-badge-meeting { background: rgba(255,149,0,0.1); color: #ff9500; border: 1px solid rgba(255,149,0,0.2); }

  .ip-task-date { font-size: 10.5px; color: var(--gray-5); }

  /* TOPBAR */
  .ip-detail-topbar {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 18px;
  }

  .ip-stat-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 18px; }

  .ip-stat {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 14px 16px;
  }

  .ip-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gray-4); font-weight: 700; margin-bottom: 5px; }
  .ip-stat-value { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
  .ip-stat-sub { font-size: 10.5px; color: var(--gray-5); margin-top: 2px; }

  /* CHAT */
  .ip-chat { display: flex; flex-direction: column; height: 340px; }
  .ip-chat-messages { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
  .ip-chat-input-row { padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px; }

  .ip-msg {
    display: flex; gap: 8px; align-items: flex-start;
  }

  .ip-msg-avatar {
    width: 26px; height: 26px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800; flex-shrink: 0;
  }

  .ip-msg-bubble {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 0 10px 10px 10px; padding: 8px 12px;
    font-size: 12.5px; line-height: 1.5; max-width: 80%;
  }

  .ip-msg-bubble.mine {
    background: rgba(0,102,255,0.12); border-color: rgba(0,102,255,0.2);
    border-radius: 10px 0 10px 10px;
  }

  .ip-msg-name { font-size: 10px; color: var(--gray-4); margin-bottom: 3px; font-weight: 700; }
  .ip-msg-time { font-size: 10px; color: var(--gray-5); margin-top: 3px; }

  .ip-input {
    flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 8px 12px; font-size: 12.5px; color: white;
    font-family: 'Inter', sans-serif; outline: none;
  }
  .ip-input:focus { border-color: #0066ff; }
  .ip-input::placeholder { color: var(--gray-5); }

  .ip-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 7px 14px; border-radius: 8px;
    font-size: 12px; font-weight: 700; cursor: pointer; border: none;
    font-family: 'Inter', sans-serif; transition: all 0.15s;
  }
  .ip-btn-white { background: white; color: #070708; }
  .ip-btn-white:hover { background: #e8e8ed; }
  .ip-btn-ghost { background: transparent; color: var(--gray-3); border: 1px solid rgba(255,255,255,0.1); }
  .ip-btn-ghost:hover { background: rgba(255,255,255,0.06); }
  .ip-btn-blue { background: #0066ff; color: white; }
  .ip-btn-blue:hover { opacity: 0.88; }
  .ip-btn-sm { padding: 5px 10px; font-size: 11px; }

  /* DOCS */
  .ip-docs { display: flex; flex-direction: column; gap: 6px; padding: 12px 16px; }
  .ip-doc-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
  }
  .ip-doc-icon { font-size: 16px; flex-shrink: 0; }
  .ip-doc-name { font-size: 12.5px; font-weight: 600; flex: 1; }
  .ip-doc-meta { font-size: 10.5px; color: var(--gray-4); }

  /* MODAL */
  .ip-modal-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .ip-modal {
    background: #1c1c1e; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 18px; padding: 28px; width: 100%; max-width: 560px;
    max-height: 90vh; overflow-y: auto;
  }
  .ip-modal-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 17px; font-weight: 800; margin-bottom: 20px; }
  .ip-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

  .ip-form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
  .ip-form-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gray-4); font-weight: 700; }
  .ip-form-input {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 9px 13px; font-size: 12.5px; color: white;
    font-family: 'Inter', sans-serif; outline: none; width: 100%;
  }
  .ip-form-input:focus { border-color: #0066ff; }
  .ip-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* LINK BADGE */
  .ip-link-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(0,200,83,0.08); border: 1px solid rgba(0,200,83,0.2);
    border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; color: #00c853;
    cursor: pointer; transition: all 0.15s;
  }
  .ip-link-badge:hover { background: rgba(0,200,83,0.14); }

  /* TABS */
  .ip-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 16px; }
  .ip-tab {
    padding: 9px 14px; font-size: 12px; font-weight: 600; color: var(--gray-4);
    border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s;
    background: none; border-top: none; border-left: none; border-right: none;
    font-family: 'Inter', sans-serif;
  }
  .ip-tab:hover { color: white; }
  .ip-tab.active { color: white; border-bottom-color: #0066ff; }

  .ip-empty { text-align: center; padding: 32px; color: var(--gray-5); font-size: 13px; }
`

// ─── HELPER: compute stage dates from startDate ───
function computeStageDates(startDate) {
  const dates = {}
  let current = new Date(startDate)
  TEMPLATE_STAGES.forEach(stage => {
    const start = new Date(current)
    const end = addBusinessDays(current, stage.durationDays)
    dates[stage.id] = { start, end }
    current = new Date(end)
    current.setDate(current.getDate() + 1)
  })
  return dates
}

// ─── NEW CLIENT MODAL ───
function NewClientModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', startDate: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.name || !form.email || !form.startDate) { toast.error('Nombre, email y fecha de inicio requeridos'); return }
    setSaving(true)
    try {
      // Load latest template
      await loadTemplate()
      const stageDates = computeStageDates(form.startDate)
      const tasks = {}
      TEMPLATE_STAGES.forEach(stage => {
        stage.tasks.forEach(task => {
          tasks[task.id] = { done: false, doneAt: null, note: '' }
        })
      })

      const ref = await addDoc(collection(db, 'implementations'), {
        name: form.name,
        company: form.company,
        email: form.email,
        phone: form.phone,
        startDate: new Date(form.startDate),
        stageDates,
        tasks,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Create portal access password (simple)
      const portalPassword = Math.random().toString(36).slice(2, 10).toUpperCase()
      await updateDoc(doc(db, 'implementations', ref.id), { portalPassword })

      toast.success(`Implementación creada — Password portal: ${portalPassword}`)
      onSave(ref.id)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="ip-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ip-modal">
        <div className="ip-modal-title">Nueva implementación</div>
        <div className="ip-form-row">
          <div className="ip-form-group">
            <label className="ip-form-label">Nombre del contacto</label>
            <input className="ip-form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Omar Pizarro" />
          </div>
          <div className="ip-form-group">
            <label className="ip-form-label">Empresa</label>
            <input className="ip-form-input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Aktivz" />
          </div>
        </div>
        <div className="ip-form-row">
          <div className="ip-form-group">
            <label className="ip-form-label">Email (acceso al portal)</label>
            <input className="ip-form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="omar@aktivz.com" />
          </div>
          <div className="ip-form-group">
            <label className="ip-form-label">Teléfono</label>
            <input className="ip-form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+52..." />
          </div>
        </div>
        <div className="ip-form-group">
          <label className="ip-form-label">Fecha de inicio</label>
          <input className="ip-form-input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div style={{ background: 'rgba(0,102,255,0.06)', border: '1px solid rgba(0,102,255,0.15)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#4d9fff', marginTop: 4 }}>
          <Info size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Se generará un password aleatorio para el acceso del cliente al portal. Aparecerá en el toast de confirmación — guárdalo para compartirlo con el cliente.
        </div>
        <div className="ip-modal-actions">
          <button className="ip-btn ip-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="ip-btn ip-btn-white" onClick={save} disabled={saving}>{saving ? 'Creando...' : 'Crear implementación'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── TASK COMMENT MODAL ───
function TaskCommentModal({ task, stageTask, implId, onClose }) {
  const [comments, setComments] = useState([])
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'implementations', implId, 'taskComments'), orderBy('createdAt', 'asc')),
      snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.taskId === stageTask.id))
    )
    return unsub
  }, [implId, stageTask.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  const send = async () => {
    if (!msg.trim()) return
    setSending(true)
    try {
      await addDoc(collection(db, 'implementations', implId, 'taskComments'), {
        taskId: stageTask.id, text: msg.trim(),
        author: 'Qubit Corp.', authorType: 'qubit',
        createdAt: serverTimestamp(),
      })
      setMsg('')
    } finally { setSending(false) }
  }

  return (
    <div className="ip-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ip-modal">
        <div className="ip-modal-title"><MessageCircle size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> {stageTask.name}</div>
        <div style={{ fontSize: 12, color: 'var(--gray-4)', marginBottom: 16, lineHeight: 1.6 }}>
          <span style={{ marginRight: 8 }}>Responsable: <strong style={{ color: 'white' }}>{stageTask.responsible === 'qubit' ? 'Qubit Corp.' : 'Cliente'}</strong></span>
          <span>Cómo: {stageTask.how}</span>
        </div>
        <div className="ip-chat">
          <div className="ip-chat-messages">
            {comments.length === 0 && <div className="ip-empty">Sin comentarios aún — sé el primero</div>}
            {comments.map(c => (
              <div key={c.id} className={clsx('ip-msg', c.authorType === 'qubit' && 'justify-end')} style={{ justifyContent: c.authorType === 'qubit' ? 'flex-end' : 'flex-start' }}>
                {c.authorType !== 'qubit' && (
                  <div className="ip-msg-avatar" style={{ background: 'rgba(0,200,83,0.2)', color: '#00c853' }}>{c.author?.[0]}</div>
                )}
                <div>
                  <div className={clsx('ip-msg-bubble', c.authorType === 'qubit' && 'mine')}>
                    <div className="ip-msg-name">{c.author}</div>
                    {c.text}
                    <div className="ip-msg-time">{c.createdAt?.toDate?.()?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || ''}</div>
                  </div>
                </div>
                {c.authorType === 'qubit' && (
                  <div className="ip-msg-avatar" style={{ background: 'rgba(0,102,255,0.2)', color: '#4d9fff' }}>Q</div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="ip-chat-input-row">
            <input className="ip-input" value={msg} onChange={e => setMsg(e.target.value)} placeholder="Escribe un comentario..." onKeyDown={e => e.key === 'Enter' && send()} />
            <button className="ip-btn ip-btn-blue ip-btn-sm" onClick={send} disabled={sending}>Enviar</button>
          </div>
        </div>
        <div className="ip-modal-actions">
          <button className="ip-btn ip-btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ─── IMPLEMENTATION DETAIL ───
function ImplementationDetail({ impl, onUpdate }) {
  const TEMPLATE_STAGES = useTemplateStages()
  const [expandedStages, setExpandedStages] = useState(new Set(['kickoff']))
  const [activeTab, setActiveTab] = useState('cronograma')
  const [chatMsg, setChatMsg] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [docs, setDocs] = useState([])
  const [commentModal, setCommentModal] = useState(null)
  const [sending, setSending] = useState(false)
  const [editDate, setEditDate] = useState(false)
  const [newStartDate, setNewStartDate] = useState(fmtDateInput(impl.startDate))
  const bottomRef = useRef(null)

  const implId = impl.id

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, 'implementations', implId, 'chat'), orderBy('createdAt', 'asc')),
      snap => setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const unsub2 = onSnapshot(
      query(collection(db, 'implementations', implId, 'documents'), orderBy('createdAt', 'desc')),
      snap => setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { unsub1(); unsub2() }
  }, [implId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  // Compute stats
  const allTasks = TEMPLATE_STAGES.flatMap(s => s.tasks)
  const doneTasks = allTasks.filter(t => impl.tasks?.[t.id]?.done).length
  const totalTasks = allTasks.length
  const progress = Math.round((doneTasks / totalTasks) * 100)

  const currentStageIndex = TEMPLATE_STAGES.findIndex(stage =>
    stage.tasks.some(t => !impl.tasks?.[t.id]?.done)
  )
  const currentStage = TEMPLATE_STAGES[currentStageIndex] || TEMPLATE_STAGES[TEMPLATE_STAGES.length - 1]

  const toggleStage = (id) => {
    setExpandedStages(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleTask = async (taskId) => {
    const current = impl.tasks?.[taskId]?.done || false
    await updateDoc(doc(db, 'implementations', implId), {
      [`tasks.${taskId}.done`]: !current,
      [`tasks.${taskId}.doneAt`]: !current ? new Date() : null,
      updatedAt: serverTimestamp(),
    })
    onUpdate()
  }

  const sendChat = async () => {
    if (!chatMsg.trim()) return
    setSending(true)
    try {
      await addDoc(collection(db, 'implementations', implId, 'chat'), {
        text: chatMsg.trim(), author: 'Qubit Corp.', authorType: 'qubit',
        createdAt: serverTimestamp(),
      })
      setChatMsg('')
    } finally { setSending(false) }
  }

  const updateStartDate = async () => {
    if (!newStartDate) return
    const stageDates = computeStageDates(newStartDate)
    await updateDoc(doc(db, 'implementations', implId), {
      startDate: new Date(newStartDate), stageDates, updatedAt: serverTimestamp()
    })
    toast.success('Fechas actualizadas')
    setEditDate(false)
    onUpdate()
  }

  const getStageProgress = (stage) => {
    const done = stage.tasks.filter(t => impl.tasks?.[t.id]?.done).length
    return { done, total: stage.tasks.length, pct: Math.round((done / stage.tasks.length) * 100) }
  }

  const getStageDate = (stageId) => {
    const sd = impl.stageDates?.[stageId]
    if (!sd) return ''
    const start = sd.start?.toDate ? sd.start.toDate() : new Date(sd.start)
    const end = sd.end?.toDate ? sd.end.toDate() : new Date(sd.end)
    return `${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} → ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
  }

  const portalUrl = `${window.location.origin}/portal`

  return (
    <div>
      {/* Topbar */}
      <div className="ip-detail-topbar">
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 900, letterSpacing: '-0.3px', marginBottom: 2 }}>
            {impl.name} <span style={{ color: 'var(--gray-4)', fontWeight: 500, fontSize: 14 }}>/ {impl.company}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-4)' }}>{impl.email} · {impl.phone}</div>
        </div>
        <div
          className="ip-link-badge"
          onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('URL del portal copiada') }}
        >
          <LinkIcon size={14} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} /> Copiar link del portal
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-5)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '6px 12px' }}>
          <KeyIcon size={14} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} /> {impl.portalPassword}
        </div>
      </div>

      {/* Stats */}
      <div className="ip-stat-row">
        <div className="ip-stat">
          <div className="ip-stat-label">Progreso</div>
          <div className="ip-stat-value">{progress}%</div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 6 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#0066ff', borderRadius: 2 }} />
          </div>
        </div>
        <div className="ip-stat">
          <div className="ip-stat-label">Tareas</div>
          <div className="ip-stat-value">{doneTasks}<span style={{ fontSize: 14, color: 'var(--gray-4)', fontWeight: 500 }}>/{totalTasks}</span></div>
          <div className="ip-stat-sub">completadas</div>
        </div>
        <div className="ip-stat">
          <div className="ip-stat-label">Etapa actual</div>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, marginTop: 4 }}><StageIcon icon=<StageIcon icon={currentStage.icon} size={18} /> size={18} /> {currentStage.name}</div>
        </div>
        <div className="ip-stat">
          <div className="ip-stat-label">Inicio</div>
          {editDate ? (
            <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
              <input className="ip-form-input" type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} style={{ fontSize: 11, padding: '4px 8px' }} />
              <button className="ip-btn ip-btn-blue ip-btn-sm" onClick={updateStartDate}>✓</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700 }}>{fmtDate(impl.startDate)}</span>
              <button className="ip-btn ip-btn-ghost ip-btn-sm" onClick={() => setEditDate(true)}><Pencil size={12} style={{ display: "inline-block", marginBottom: -1 }} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="ip-tabs">
        {[['cronograma', '<Calendar size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -1 }} /> Cronograma'], ['chat', '<MessageCircle size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Chat'], ['documentos', '<Folder size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Documentos']].map(([id, label]) => (
          <button key={id} className={clsx('ip-tab', activeTab === id && 'active')} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* CRONOGRAMA */}
      {activeTab === 'cronograma' && (
        <div className="ip-stages">
          {TEMPLATE_STAGES.map((stage, si) => {
            const sp = getStageProgress(stage)
            const isExpanded = expandedStages.has(stage.id)
            const isActive = si === currentStageIndex
            const isDone = sp.done === sp.total

            return (
              <div key={stage.id} className="ip-stage" style={{ borderColor: isActive ? 'rgba(0,102,255,0.3)' : undefined }}>
                <div className="ip-stage-header" onClick={() => toggleStage(stage.id)}>
                  <span className="ip-stage-icon"><StageIcon icon=<StageIcon icon={stage.icon} /> /></span>
                  <span className="ip-stage-name">{stage.name}</span>
                  <span className="ip-stage-dates">{getStageDate(stage.id)}</span>
                  <span className="ip-stage-progress" style={{
                    background: isDone ? 'rgba(0,200,83,0.1)' : isActive ? 'rgba(0,102,255,0.1)' : 'rgba(255,255,255,0.05)',
                    color: isDone ? '#00c853' : isActive ? '#4d9fff' : 'var(--gray-4)',
                  }}>
                    {sp.done}/{sp.total}
                  </span>
                  {isActive && <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(0,102,255,0.15)', color: '#4d9fff', padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(0,102,255,0.25)' }}>EN CURSO</span>}
                  <span className={clsx('ip-stage-chevron', isExpanded && 'open')}>▶</span>
                </div>

                {isExpanded && (
                  <div className="ip-tasks">
                    {stage.tasks.map(task => {
                      const taskState = impl.tasks?.[task.id]
                      const isDoneTask = taskState?.done
                      return (
                        <div key={task.id} className="ip-task">
                          <div
                            className={clsx('ip-task-check', isDoneTask && (task.responsible === 'qubit' ? 'done' : 'client-done'))}
                            onClick={() => toggleTask(task.id)}
                            title="Marcar como completada"
                          >
                            {isDoneTask && '✓'}
                          </div>
                          <div className="ip-task-content">
                            <div className={clsx('ip-task-name', isDoneTask && 'done')}>{task.name}</div>
                            <div className="ip-task-how">{task.how}</div>
                            <div className="ip-task-meta" style={{ marginTop: 5 }}>
                              <span className={clsx('ip-badge', task.responsible === 'qubit' ? 'ip-badge-qubit' : 'ip-badge-client')}>
                                {task.responsible === 'qubit' ? '<Zap size={12} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} /> Qubit' : '<User size={12} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} /> Cliente'}
                              </span>
                              {task.requiresClient && <span className="ip-badge ip-badge-meeting"><Calendar size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -1 }} /> Requiere reunión</span>}
                              {isDoneTask && taskState?.doneAt && (
                                <span className="ip-task-date">✓ {fmtDate(taskState.doneAt)}</span>
                              )}
                              <button
                                className="ip-btn ip-btn-ghost ip-btn-sm"
                                style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 8px' }}
                                onClick={() => setCommentModal({ task: taskState, stageTask: task })}
                              >
                                <MessageCircle size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Comentarios
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* CHAT */}
      {activeTab === 'chat' && (
        <div className="ip-card">
          <div className="ip-card-header">
            <div className="ip-card-title"><MessageCircle size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Chat del proyecto — {impl.name}</div>
          </div>
          <div className="ip-chat">
            <div className="ip-chat-messages">
              {chatMessages.length === 0 && <div className="ip-empty">Sin mensajes — inicia la conversación</div>}
              {chatMessages.map(m => (
                <div key={m.id} className="ip-msg" style={{ justifyContent: m.authorType === 'qubit' ? 'flex-end' : 'flex-start' }}>
                  {m.authorType !== 'qubit' && (
                    <div className="ip-msg-avatar" style={{ background: 'rgba(0,200,83,0.15)', color: '#00c853' }}>{m.author?.[0]}</div>
                  )}
                  <div>
                    <div className={clsx('ip-msg-bubble', m.authorType === 'qubit' && 'mine')}>
                      <div className="ip-msg-name">{m.author}</div>
                      {m.text}
                      <div className="ip-msg-time">{m.createdAt?.toDate?.()?.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) || ''}</div>
                    </div>
                  </div>
                  {m.authorType === 'qubit' && (
                    <div className="ip-msg-avatar" style={{ background: 'rgba(0,102,255,0.15)', color: '#4d9fff' }}>Q</div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="ip-chat-input-row">
              <input
                className="ip-input"
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                placeholder="Mensaje para el cliente..."
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              />
              <button className="ip-btn ip-btn-blue ip-btn-sm" onClick={sendChat} disabled={sending}>Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENTOS */}
      {activeTab === 'documentos' && (
        <div className="ip-card">
          <div className="ip-card-header">
            <div className="ip-card-title"><Folder size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Documentos del proyecto</div>
            <label className="ip-btn ip-btn-white ip-btn-sm" style={{ cursor: 'pointer' }}>
              + Subir documento
              <input type="file" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files[0]
                if (!file) return
                // Store as metadata only (no actual upload in this version)
                await addDoc(collection(db, 'implementations', implId, 'documents'), {
                  name: file.name, size: file.size, type: file.type,
                  uploadedBy: 'Qubit Corp.', uploaderType: 'qubit',
                  createdAt: serverTimestamp(),
                })
                toast.success('Documento registrado')
              }} />
            </label>
          </div>
          <div className="ip-docs">
            {docs.length === 0 && <div className="ip-empty">Sin documentos — sube el primero</div>}
            {docs.map(d => (
              <div key={d.id} className="ip-doc-item">
                <span className="ip-doc-icon">{d.type?.includes('pdf') ? '<FileText size={16} style={{ display: "inline-block", marginBottom: -2 }} />' : d.type?.includes('image') ? '<ImageIcon size={16} style={{ display: "inline-block", marginBottom: -2 }} />' : '<Paperclip size={16} style={{ display: "inline-block", marginBottom: -2 }} />'}</span>
                <div style={{ flex: 1 }}>
                  <div className="ip-doc-name">{d.name}</div>
                  <div className="ip-doc-meta">{d.uploadedBy} · {fmtDate(d.createdAt)}</div>
                </div>
                <span className={clsx('ip-badge', d.uploaderType === 'qubit' ? 'ip-badge-qubit' : 'ip-badge-client')}>
                  {d.uploaderType === 'qubit' ? 'Qubit' : 'Cliente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comment modal */}
      {commentModal && (
        <TaskCommentModal
          task={commentModal.task}
          stageTask={commentModal.stageTask}
          implId={implId}
          onClose={() => setCommentModal(null)}
        />
      )}
    </div>
  )
}

// ─── MAIN EXPORT ───
export default function ImplementationPortal() {
  const TEMPLATE_STAGES = useTemplateStages()
  const [impls, setImpls] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [activeView, setActiveView] = useState('clients') // 'clients' | 'template'
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const q = query(collection(db, 'implementations'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setImpls(data)
      if (!selectedId && data.length > 0) setSelectedId(data[0].id)
    })
    return unsub
  }, [refresh])

  const selected = impls.find(i => i.id === selectedId)

  const getProgress = (impl) => {
    const allTasks = TEMPLATE_STAGES.flatMap(s => s.tasks)
    const done = allTasks.filter(t => impl.tasks?.[t.id]?.done).length
    return Math.round((done / allTasks.length) * 100)
  }

  const getInitials = (name) => name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

  return (
    <div className="ip-root sa-content" style={{ maxWidth: '100%' }}>
      <style>{css}</style>

      {/* View toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button
          className={clsx('ip-btn', activeView === 'clients' ? 'ip-btn-white' : 'ip-btn-ghost')}
          onClick={() => setActiveView('clients')}
        >
          <Users size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Clientes
        </button>
        <button
          className={clsx('ip-btn', activeView === 'template' ? 'ip-btn-white' : 'ip-btn-ghost')}
          onClick={() => setActiveView('template')}
        >
          <Pencil size={12} style={{ display: "inline-block", marginBottom: -1 }} /> Editar plantilla
        </button>
        <span style={{ fontSize: 11, color: 'var(--gray-5)', marginLeft: 4 }}>
          {TEMPLATE_STAGES.length} etapas · {TEMPLATE_STAGES.reduce((s, st) => s + st.tasks.length, 0)} tareas
        </span>
      </div>

      {activeView === 'template' && <TemplateEditorInline />}

      {activeView === 'clients' && (
        <div className="ip-grid">
          {/* Client list */}
          <div>
            <div className="ip-card">
              <div className="ip-card-header">
                <div className="ip-card-title">Clientes ({impls.length})</div>
                <button className="ip-btn ip-btn-white ip-btn-sm" onClick={() => setShowNew(true)}>+ Nuevo</button>
              </div>
              <div className="ip-client-list">
                {impls.length === 0 && <div className="ip-empty">Sin implementaciones — crea la primera</div>}
                {impls.map(impl => {
                  const pct = getProgress(impl)
                  return (
                    <div
                      key={impl.id}
                      className={clsx('ip-client-item', selectedId === impl.id && 'active')}
                      onClick={() => setSelectedId(impl.id)}
                    >
                      <div className="ip-client-avatar">{getInitials(impl.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ip-client-name">{impl.name}</div>
                        <div className="ip-client-sub">{impl.company}</div>
                        <div className="ip-progress-bar">
                          <div className="ip-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--gray-5)', marginTop: 3 }}>{pct}% completado</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Detail */}
          <div>
            {selected
              ? <ImplementationDetail key={selectedId} impl={selected} onUpdate={() => setRefresh(r => r + 1)} />
              : <div className="ip-empty" style={{ paddingTop: 80 }}>Selecciona un cliente para ver su cronograma</div>
            }
          </div>
        </div>
      )}

      {showNew && (
        <NewClientModal
          onClose={() => setShowNew(false)}
          onSave={(id) => { setShowNew(false); setSelectedId(id); setRefresh(r => r + 1) }}
        />
      )}
    </div>
  )
}
