import { Rocket, Target, MessageSquare, Bot, Clapperboard, CheckCircle2, ClipboardList, Wrench, Key as KeyIcon, BarChart3, Globe, Smartphone, Lightbulb, GraduationCap, Search, Sparkles, Calendar, MessageCircle, Folder, Link as LinkIcon, Pencil, FileText, Image as ImageIcon, Paperclip, Zap, User, LogOut, Info, Users } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import {
  collection, onSnapshot, query, orderBy, doc,
  addDoc, serverTimestamp, getDocs, where
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import clsx from 'clsx'

// ─── TEMPLATE STAGES (same as admin) ───
const TEMPLATE_STAGES = [
  {
    id: 'kickoff', name: 'Kickoff y diagnóstico', icon: 'rocket',
    tasks: [
      { id: 't1', name: 'Reunión de kickoff por videollamada', responsible: 'qubit', how: 'Google Meet / Zoom', requiresClient: true },
      { id: 't2', name: 'Compartir cuestionario de diagnóstico', responsible: 'qubit', how: 'Formulario enviado por WhatsApp o email', requiresClient: false },
      { id: 't3', name: 'Entregar respuestas del diagnóstico', responsible: 'client', how: 'Completa y envía el formulario', requiresClient: true },
      { id: 't4', name: 'Definir arquitectura del pipeline', responsible: 'qubit', how: 'Documento interno', requiresClient: false },
    ]
  },
  {
    id: 'pipeline', name: 'Configuración del pipeline', icon: 'target',
    tasks: [
      { id: 't5', name: 'Crear etapas personalizadas del pipeline', responsible: 'qubit', how: 'Configuración en plataforma', requiresClient: false },
      { id: 't6', name: 'Configurar campos de calificación', responsible: 'qubit', how: 'Según diagnóstico', requiresClient: false },
      { id: 't7', name: 'Validar pipeline con el cliente', responsible: 'qubit', how: 'Videollamada de revisión', requiresClient: true },
      { id: 't8', name: 'Aprobar pipeline o solicitar ajustes', responsible: 'client', how: 'Tu confirmación por escrito', requiresClient: true },
    ]
  },
  {
    id: 'meta', name: 'Conexión de canales Meta', icon: 'message-square',
    tasks: [
      { id: 't9', name: 'Compartir acceso admin a tu Página de Facebook', responsible: 'client', how: 'Agrega a Qubit Corp. como administrador', requiresClient: true },
      { id: 't10', name: 'Configurar app Meta y webhook', responsible: 'qubit', how: 'Configuración técnica completa', requiresClient: false },
      { id: 't11', name: 'Conectar Instagram Business', responsible: 'qubit', how: 'Vinculación al Business Manager', requiresClient: false },
      { id: 't12', name: 'Verificar flujo de mensajes', responsible: 'qubit', how: 'Prueba en vivo', requiresClient: false },
      { id: 't13', name: 'Proporcionar número para WhatsApp Business', responsible: 'client', how: 'Número dedicado (no personal)', requiresClient: true },
    ]
  },
  {
    id: 'agent', name: 'Entrenamiento del Agente IA', icon: 'bot',
    tasks: [
      { id: 't14', name: 'Reunión de briefing del agente IA', responsible: 'qubit', how: 'Videollamada para definir personalidad y técnica', requiresClient: true },
      { id: 't15', name: 'Entregar materiales del producto', responsible: 'client', how: 'Sube brochures, FAQs y documentos en este portal', requiresClient: true },
      { id: 't16', name: 'Configurar personalidad y técnica de venta', responsible: 'qubit', how: 'Configuración en plataforma', requiresClient: false },
      { id: 't17', name: 'Cargar base de conocimiento', responsible: 'qubit', how: 'Documentos del cliente integrados al agente', requiresClient: false },
      { id: 't18', name: 'Prueba de conversación con el agente', responsible: 'qubit', how: 'Sesión en vivo contigo', requiresClient: true },
      { id: 't19', name: 'Aprobar agente o solicitar ajustes', responsible: 'client', how: 'Tu confirmación final del agente', requiresClient: true },
    ]
  },
  {
    id: 'content', name: 'Configuración Content Studio', icon: 'clapperboard',
    tasks: [
      { id: 't20', name: 'Definir temas del radar de noticias', responsible: 'qubit', how: 'Videollamada breve de 15 min', requiresClient: true },
      { id: 't21', name: 'Configurar temas en el sistema', responsible: 'qubit', how: 'Configuración interna', requiresClient: false },
      { id: 't22', name: 'Sesión de prueba de generación de guiones', responsible: 'qubit', how: 'Primera sesión en vivo contigo', requiresClient: true },
    ]
  },
  {
    id: 'delivery', name: 'Pruebas y entrega', icon: 'check-circle-2',
    tasks: [
      { id: 't23', name: 'Pruebas con leads reales', responsible: 'qubit', how: 'Monitoreo activo de conversaciones', requiresClient: false },
      { id: 't24', name: 'Ajustes finos', responsible: 'qubit', how: 'Iteraciones según tu retroalimentación', requiresClient: false },
      { id: 't25', name: 'Sesión de capacitación completa', responsible: 'qubit', how: 'Videollamada de 60 min — tour de la plataforma', requiresClient: true },
      { id: 't26', name: 'Entrega de credenciales y accesos', responsible: 'qubit', how: 'Documento PDF en este portal', requiresClient: false },
      { id: 't27', name: 'Confirmación de entrega conforme', responsible: 'client', how: 'Tu firma de conformidad y cierre', requiresClient: true },
    ]
  },
]

const fmtDate = (d) => {
  if (!d) return '—'
  const date = d.toDate ? d.toDate() : new Date(d)
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

const fmtShort = (d) => {
  if (!d) return '—'
  const date = d.toDate ? d.toDate() : new Date(d)
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
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
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600&display=swap');

  .cp-root *, .cp-root *::before, .cp-root *::after { box-sizing: border-box; }

  .cp-root {
    font-family: 'Inter', sans-serif;
    background: #070708;
    color: white;
    min-height: 100vh;
    --black: #070708;
    --gray-4: #8e8e93;
    --gray-5: #3a3a3c;
    --gray-6: #1c1c1e;
    --blue: #0066ff;
    --green: #00c853;
    --purple: #7c3aed;
    --amber: #ff9500;
  }

  /* LOGIN */
  .cp-login {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }

  .cp-login::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 50% 60% at 20% 50%, rgba(0,102,255,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 40% 50% at 80% 30%, rgba(124,58,237,0.07) 0%, transparent 60%);
    pointer-events: none;
  }

  .cp-login-card {
    position: relative; z-index: 1;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px; padding: 40px;
    width: 100%; max-width: 380px;
  }

  .cp-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; justify-content: center; }
  .cp-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #0066ff, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .cp-logo-text { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; font-weight: 800; }

  .cp-login-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 28px; font-weight: 900; text-align: center; margin-bottom: 4px; }
  .cp-login-sub { font-size: 17px; color: var(--gray-4); text-align: center; margin-bottom: 28px; line-height: 1.6; }

  .cp-input {
    width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 9px; padding: 11px 14px; font-size: 18px; color: white;
    font-family: 'Inter', sans-serif; outline: none; transition: border-color 0.15s; margin-bottom: 10px;
  }

  .cp-input:focus { border-color: #0066ff; }
  .cp-input::placeholder { color: #3a3a3c; }

  .cp-btn-primary {
    width: 100%; padding: 12px; background: white; color: #070708;
    border: none; border-radius: 9px; font-size: 18px; font-weight: 700;
    cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s; margin-top: 6px;
  }
  .cp-btn-primary:hover { background: #e8e8ed; }
  .cp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* LAYOUT */
  .cp-layout { max-width: 800px; margin: 0 auto; padding: 0 24px 60px; }

  /* HEADER */
  .cp-header {
    padding: 28px 0 24px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    margin-bottom: 28px;
    display: flex; align-items: center; justify-content: space-between;
  }

  .cp-welcome { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; font-weight: 600; color: var(--gray-4); margin-bottom: 2px; }
  .cp-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 28px; font-weight: 900; letter-spacing: -0.3px; }

  .cp-logout { font-size: 17px; color: var(--gray-5); background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; padding: 6px 10px; border-radius: 6px; transition: all 0.15s; }
  .cp-logout:hover { color: white; background: rgba(255,255,255,0.06); }

  /* PROGRESS HERO */
  .cp-progress-hero {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px; padding: 24px 28px;
    margin-bottom: 24px;
    display: flex; align-items: center; gap: 24px;
  }

  .cp-progress-circle {
    width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }

  .cp-progress-pct { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; font-weight: 900; }

  .cp-progress-info { flex: 1; }
  .cp-progress-label { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 800; margin-bottom: 4px; }
  .cp-progress-sub { font-size: 17px; color: var(--gray-4); line-height: 1.5; }
  .cp-progress-track { height: 5px; background: rgba(255,255,255,0.08); border-radius: 3px; margin-top: 10px; overflow: hidden; }
  .cp-progress-fill { height: 100%; border-radius: 3px; background: #0066ff; transition: width 0.5s; }

  /* TABS */
  .cp-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 20px; }
  .cp-tab {
    padding: 10px 16px; font-size: 18px; font-weight: 600; color: var(--gray-4);
    border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s;
    background: none; border-top: none; border-left: none; border-right: none;
    font-family: 'Inter', sans-serif;
  }
  .cp-tab:hover { color: white; }
  .cp-tab.active { color: white; border-bottom-color: #0066ff; }

  /* STAGES */
  .cp-stage {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; margin-bottom: 10px; overflow: hidden;
  }

  .cp-stage.active { border-color: rgba(0,102,255,0.3); }
  .cp-stage.done { border-color: rgba(0,200,83,0.2); }

  .cp-stage-header {
    padding: 14px 18px; display: flex; align-items: center; gap: 10px;
    cursor: pointer; transition: background 0.15s;
  }
  .cp-stage-header:hover { background: rgba(255,255,255,0.02); }

  .cp-stage-icon { font-size: 21px; }
  .cp-stage-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; font-weight: 800; flex: 1; }
  .cp-stage-dates { font-size: 15px; color: var(--gray-4); }
  .cp-stage-badge {
    font-size: 14px; font-weight: 700; padding: 2px 8px; border-radius: 5px;
  }
  .cp-chevron { font-size: 14px; color: #3a3a3c; transition: transform 0.2s; }
  .cp-chevron.open { transform: rotate(90deg); }

  /* TASKS */
  .cp-tasks { border-top: 1px solid rgba(255,255,255,0.05); }

  .cp-task {
    padding: 12px 18px 12px 42px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    display: flex; align-items: flex-start; gap: 12px;
  }
  .cp-task:last-child { border-bottom: none; }

  .cp-task-dot {
    width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
    border: 1.5px solid rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center; font-size: 8px;
  }
  .cp-task-dot.done { background: #00c853; border-color: #00c853; color: white; }

  .cp-task-name { font-size: 17px; font-weight: 600; margin-bottom: 3px; color: white; }
  .cp-task-name.done { color: var(--gray-5); text-decoration: line-through; }
  .cp-task-how { font-size: 15px; color: var(--gray-4); line-height: 1.5; margin-bottom: 5px; }

  .cp-task-badges { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  .cp-badge {
    font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 5px;
    display: inline-flex; align-items: center;
  }
  .cp-badge-qubit { background: rgba(0,102,255,0.1); color: #4d9fff; border: 1px solid rgba(0,102,255,0.2); }
  .cp-badge-client { background: rgba(0,200,83,0.1); color: #00c853; border: 1px solid rgba(0,200,83,0.2); }
  .cp-badge-meeting { background: rgba(255,149,0,0.08); color: #ff9500; border: 1px solid rgba(255,149,0,0.2); }

  .cp-comment-btn {
    margin-left: auto; font-size: 14px; font-weight: 600; color: var(--gray-5);
    background: none; border: 1px solid rgba(255,255,255,0.07); border-radius: 5px;
    padding: 2px 8px; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s;
  }
  .cp-comment-btn:hover { color: white; border-color: rgba(255,255,255,0.15); }

  /* CHAT */
  .cp-chat-wrap { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; }
  .cp-chat-header { padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 8px; }
  .cp-chat-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; font-weight: 800; }
  .cp-chat-messages { height: 360px; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .cp-chat-input-row { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px; }

  .cp-msg { display: flex; gap: 8px; align-items: flex-end; }
  .cp-msg.mine { flex-direction: row-reverse; }

  .cp-msg-avatar { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; flex-shrink: 0; }

  .cp-msg-bubble {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 4px 12px 12px 12px; padding: 8px 12px;
    font-size: 18px; line-height: 1.55; max-width: 72%;
  }
  .cp-msg.mine .cp-msg-bubble {
    background: rgba(0,102,255,0.14); border-color: rgba(0,102,255,0.25);
    border-radius: 12px 4px 12px 12px;
  }
  .cp-msg-author { font-size: 14px; font-weight: 700; color: var(--gray-4); margin-bottom: 2px; }
  .cp-msg-time { font-size: 14px; color: #3a3a3c; margin-top: 3px; }

  /* DOCS */
  .cp-docs-wrap { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; }
  .cp-docs-header { padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; }
  .cp-docs-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; font-weight: 800; flex: 1; }

  .cp-doc-item { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .cp-doc-item:last-child { border-bottom: none; }
  .cp-doc-icon { font-size: 24px; }
  .cp-doc-name { font-size: 18px; font-weight: 600; flex: 1; }
  .cp-doc-meta { font-size: 15px; color: var(--gray-4); }

  .cp-upload-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 7px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: white; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; }
  .cp-upload-btn:hover { background: rgba(255,255,255,0.1); }

  /* MODAL */
  .cp-modal-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
  .cp-modal { background: #1c1c1e; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; width: 100%; max-width: 500px; max-height: 85vh; overflow-y: auto; }
  .cp-modal-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 800; margin-bottom: 16px; }

  .cp-empty { text-align: center; padding: 32px; color: #3a3a3c; font-size: 18px; }
  .cp-error { color: #ff6b6b; font-size: 17px; margin-top: 6px; text-align: center; }

  /* SEND BTN */
  .cp-send-btn { background: #0066ff; color: white; border: none; border-radius: 8px; padding: 8px 14px; font-size: 17px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; transition: opacity 0.15s; flex-shrink: 0; }
  .cp-send-btn:hover { opacity: 0.88; }
  .cp-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
`

// ─── TASK COMMENT MODAL ───
function TaskComments({ task, implId, clientName, onClose }) {
  const [comments, setComments] = useState([])
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'implementations', implId, 'taskComments'), orderBy('createdAt', 'asc')),
      snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.taskId === task.id))
    )
    return unsub
  }, [implId, task.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  const send = async () => {
    if (!msg.trim()) return
    setSending(true)
    try {
      await addDoc(collection(db, 'implementations', implId, 'taskComments'), {
        taskId: task.id, text: msg.trim(),
        author: clientName, authorType: 'client',
        createdAt: serverTimestamp(),
      })
      setMsg('')
    } finally { setSending(false) }
  }

  return (
    <div className="cp-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cp-modal">
        <div className="cp-modal-title"><MessageCircle size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> {task.name}</div>
        <div style={{ fontSize: 17, color: 'var(--gray-4)', marginBottom: 16, lineHeight: 1.6, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
          {task.how}
        </div>
        <div style={{ height: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {comments.length === 0 && <div className="cp-empty">Sin comentarios — escribe el primero</div>}
          {comments.map(c => (
            <div key={c.id} className={clsx('cp-msg', c.authorType === 'client' && 'mine')}>
              {c.authorType !== 'client' && (
                <div className="cp-msg-avatar" style={{ background: 'rgba(0,102,255,0.15)', color: '#4d9fff' }}>Q</div>
              )}
              <div>
                <div className={clsx('cp-msg-bubble', c.authorType === 'client' && 'mine')}>
                  <div className="cp-msg-author">{c.author}</div>
                  {c.text}
                  <div className="cp-msg-time">{c.createdAt?.toDate?.()?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || ''}</div>
                </div>
              </div>
              {c.authorType === 'client' && (
                <div className="cp-msg-avatar" style={{ background: 'rgba(0,200,83,0.15)', color: '#00c853' }}>{clientName?.[0]}</div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="cp-input" style={{ margin: 0, flex: 1 }} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Tu comentario..." onKeyDown={e => e.key === 'Enter' && send()} />
          <button className="cp-send-btn" onClick={send} disabled={sending}>Enviar</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 14px', color: '#8e8e93', cursor: 'pointer', fontSize: 17, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PORTAL ───
export default function ClientPortal() {
  const [authed, setAuthed] = useState(false)
  const [impl, setImpl] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [logging, setLogging] = useState(false)
  const [activeTab, setActiveTab] = useState('cronograma')
  const [expandedStages, setExpandedStages] = useState(new Set(['kickoff']))
  const [chatMessages, setChatMessages] = useState([])
  const [chatMsg, setChatMsg] = useState('')
  const [docs, setDocs] = useState([])
  const [sending, setSending] = useState(false)
  const [commentModal, setCommentModal] = useState(null)
  const bottomRef = useRef(null)

  const login = async () => {
    if (!emailInput || !passwordInput) { setLoginError('Ingresa tu email y contraseña'); return }
    setLogging(true)
    setLoginError('')
    try {
      const q = query(collection(db, 'implementations'), where('email', '==', emailInput.trim().toLowerCase()))
      const snap = await getDocs(q)
      if (snap.empty) { setLoginError('Email no encontrado'); return }
      const implDoc = snap.docs[0]
      const data = { id: implDoc.id, ...implDoc.data() }
      if (data.portalPassword !== passwordInput.trim()) { setLoginError('Contraseña incorrecta'); return }
      setImpl(data)
      setAuthed(true)
    } catch (e) { setLoginError('Error al iniciar sesión') } finally { setLogging(false) }
  }

  useEffect(() => {
    if (!impl?.id) return
    const unsub = onSnapshot(doc(db, 'implementations', impl.id), snap => {
      if (snap.exists()) setImpl({ id: snap.id, ...snap.data() })
    })
    const unsub2 = onSnapshot(
      query(collection(db, 'implementations', impl.id, 'chat'), orderBy('createdAt', 'asc')),
      snap => setChatMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const unsub3 = onSnapshot(
      query(collection(db, 'implementations', impl.id, 'documents'), orderBy('createdAt', 'desc')),
      snap => setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { unsub(); unsub2(); unsub3() }
  }, [impl?.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const allTasks = TEMPLATE_STAGES.flatMap(s => s.tasks)
  const doneTasks = allTasks.filter(t => impl?.tasks?.[t.id]?.done).length
  const totalTasks = allTasks.length
  const progress = impl ? Math.round((doneTasks / totalTasks) * 100) : 0

  const currentStageIndex = TEMPLATE_STAGES.findIndex(stage =>
    stage.tasks.some(t => !impl?.tasks?.[t.id]?.done)
  )
  const currentStage = TEMPLATE_STAGES[currentStageIndex] || TEMPLATE_STAGES[TEMPLATE_STAGES.length - 1]

  const toggleStage = (id) => {
    setExpandedStages(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sendChat = async (askAI = false) => {
    if (!chatMsg.trim()) return
    setSending(true)
    const userMsgText = chatMsg.trim()
    try {
      await addDoc(collection(db, 'implementations', impl.id, 'chat'), {
        text: userMsgText, author: impl.name, authorType: 'client',
        createdAt: serverTimestamp(),
      })
      setChatMsg('')

      if (askAI) {
        // Build context
        const historyText = chatMessages.slice(-8).map(m =>
          `${m.authorType === 'client' ? impl.name : m.isAI ? 'Claude IA' : 'Qubit Corp'}: ${m.text}`
        ).join('\n')

        const pendingTasks = TEMPLATE_STAGES.flatMap(s => s.tasks)
          .filter(t => !impl?.tasks?.[t.id]?.done)
          .slice(0, 5)
          .map(t => `- ${t.name} (responsable: ${t.responsible === 'qubit' ? 'Qubit Corp' : 'el cliente'})`)
          .join('\n')

        const prompt = `Eres el asistente de implementación de FlowCRM, desarrollado por Qubit Corp. Estás dentro del portal privado del cliente.

DATOS DEL CLIENTE:
- Nombre: ${impl.name}
- Empresa: ${impl.company || 'No especificada'}
- Progreso actual: ${progress}% completado
- Etapa actual: ${currentStage?.name || 'En proceso'}

TAREAS PENDIENTES MÁS PRÓXIMAS:
${pendingTasks || '- Sin tareas pendientes identificadas'}

HISTORIAL RECIENTE DEL CHAT:
${historyText || 'Sin historial previo'}

PREGUNTA DEL CLIENTE:
${userMsgText}

INSTRUCCIONES:
- Responde directamente, de forma clara y concisa
- Si la pregunta es sobre una tarea pendiente específica, explica qué se necesita y cómo avanzar
- Si es una duda técnica del CRM, respóndela con contexto de FlowCRM
- Si necesita intervención humana de Qubit Corp (algo urgente, un error técnico, una decisión de negocio), díselo y pídele que use el botón "Enviar" para que el equipo lo vea
- Máximo 3-4 oraciones. Sin listas largas. Tono profesional pero cercano.`

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 800,
            messages: [{ role: 'user', content: prompt }]
          })
        })
        const data = await res.json()
        const aiResponse = data.content?.[0]?.text || "Tuve un pequeño problema al procesar mi respuesta, por favor intenta de nuevo en unos segundos."
        
        await addDoc(collection(db, 'implementations', impl.id, 'chat'), {
          text: aiResponse, author: 'Claude IA', authorType: 'qubit', isAI: true,
          createdAt: serverTimestamp(),
        })
      }
    } catch (e) {
      console.error(e)
    } finally { setSending(false) }
  }

  const getStageDate = (stageId) => {
    const sd = impl?.stageDates?.[stageId]
    if (!sd) return ''
    const start = sd.start?.toDate ? sd.start.toDate() : new Date(sd.start)
    const end = sd.end?.toDate ? sd.end.toDate() : new Date(sd.end)
    return `${fmtShort(start)} → ${fmtShort(end)}`
  }

  const getStageStatus = (stage, idx) => {
    const done = stage.tasks.filter(t => impl?.tasks?.[t.id]?.done).length
    if (done === stage.tasks.length) return 'done'
    if (idx === currentStageIndex) return 'active'
    return 'pending'
  }

  // LOGIN SCREEN
  if (!authed) {
    return (
      <div className="cp-root">
        <style>{css}</style>
        <div className="cp-login">
          <div className="cp-login-card">
            <div className="cp-logo">
              <img src="/qubit-corp.png" alt="Qubit Corp" style={{ height: 64, objectFit: "contain" }} />
            </div>
            <div className="cp-login-title">Portal de implementación</div>
            <div className="cp-login-sub">Sigue el avance de tu proyecto en tiempo real, comunícate con el equipo y entrega los documentos necesarios.</div>
            <input className="cp-input" type="email" placeholder="Tu email" value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
            <input className="cp-input" type="password" placeholder="Contraseña" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
            {loginError && <div className="cp-error">{loginError}</div>}
            <button className="cp-btn-primary" onClick={login} disabled={logging}>{logging ? 'Verificando...' : 'Entrar a mi portal'}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cp-root">
      <style>{css}</style>
      <div className="cp-layout">

        {/* Header */}
        <div className="cp-header">
          <div>
            <div className="cp-welcome">Bienvenido de nuevo,</div>
            <div className="cp-name">{impl.name} <span style={{ color: 'var(--gray-4)', fontWeight: 500, fontSize: 21 }}>· {impl.company}</span></div>
          </div>
          <button className="cp-logout" onClick={() => { setAuthed(false); setImpl(null) }}><LogOut size={14} style={{ marginRight: 6, display: "inline-block" }} /> Salir</button>
        </div>

        {/* Progress hero */}
        <div className="cp-progress-hero">
          <div className="cp-progress-circle" style={{
            background: `conic-gradient(#0066ff ${progress * 3.6}deg, rgba(255,255,255,0.06) 0deg)`
          }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#070708', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="cp-progress-pct">{progress}%</span>
            </div>
          </div>
          <div className="cp-progress-info">
            <div className="cp-progress-label">
              {progress === 100 ? <><Sparkles size={16} style={{ marginRight: 6, display: "inline-block" }} /> ¡Implementación completada!</> : <>Etapa actual: <StageIcon icon={currentStage.icon} size={18} /> {currentStage.name}</>}
            </div>
            <div className="cp-progress-sub">
              {doneTasks} de {totalTasks} tareas completadas · Inicio: {fmtDate(impl.startDate)}
            </div>
            <div className="cp-progress-track">
              <div className="cp-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="cp-tabs">
          <button className={clsx('cp-tab', activeTab === 'cronograma' && 'active')} onClick={() => setActiveTab('cronograma')}><Calendar size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -1 }} /> Cronograma</button>
          <button className={clsx('cp-tab', activeTab === 'chat' && 'active')} onClick={() => setActiveTab('chat')}>
            <MessageCircle size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Chat {chatMessages.filter(m => m.authorType === 'qubit').length > 0 ? `(${chatMessages.filter(m => m.authorType === 'qubit').length})` : ''}
          </button>
          <button className={clsx('cp-tab', activeTab === 'documentos' && 'active')} onClick={() => setActiveTab('documentos')}><Folder size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Documentos {docs.length > 0 ? `(${docs.length})` : ''}</button>
        </div>

        {/* CRONOGRAMA */}
        {activeTab === 'cronograma' && (
          <div>
            {TEMPLATE_STAGES.map((stage, si) => {
              const status = getStageStatus(stage, si)
              const isExpanded = expandedStages.has(stage.id)
              const doneCnt = stage.tasks.filter(t => impl?.tasks?.[t.id]?.done).length

              return (
                <div key={stage.id} className={clsx('cp-stage', status)}>
                  <div className="cp-stage-header" onClick={() => toggleStage(stage.id)}>
                    <span className="cp-stage-icon"><StageIcon icon={stage.icon} /></span>
                    <span className="cp-stage-name">{stage.name}</span>
                    <span className="cp-stage-dates">{getStageDate(stage.id)}</span>
                    <span className="cp-stage-badge" style={{
                      background: status === 'done' ? 'rgba(0,200,83,0.1)' : status === 'active' ? 'rgba(0,102,255,0.1)' : 'rgba(255,255,255,0.04)',
                      color: status === 'done' ? '#00c853' : status === 'active' ? '#4d9fff' : '#3a3a3c',
                    }}>
                      {status === 'done' ? '✓ Completada' : status === 'active' ? '● En curso' : `${doneCnt}/${stage.tasks.length}`}
                    </span>
                    <span className={clsx('cp-chevron', isExpanded && 'open')}>▶</span>
                  </div>

                  {isExpanded && (
                    <div className="cp-tasks">
                      {stage.tasks.map(task => {
                        const isDone = impl?.tasks?.[task.id]?.done
                        return (
                          <div key={task.id} className="cp-task">
                            <div className={clsx('cp-task-dot', isDone && 'done')}>{isDone && '✓'}</div>
                            <div style={{ flex: 1 }}>
                              <div className={clsx('cp-task-name', isDone && 'done')}>{task.name}</div>
                              <div className="cp-task-how">{task.how}</div>
                              <div className="cp-task-badges">
                                <span className={clsx('cp-badge', task.responsible === 'qubit' ? 'cp-badge-qubit' : 'cp-badge-client')}>
                                  {task.responsible === 'qubit' ? <><Zap size={12} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} /> Qubit Corp.</> : <><User size={12} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} /> Tú</>}
                                </span>
                                {task.requiresClient && <span className="cp-badge cp-badge-meeting"><Calendar size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -1 }} /> Requiere reunión</span>}
                                <button className="cp-comment-btn" onClick={() => setCommentModal(task)}><MessageCircle size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Comentar</button>
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
          <div className="cp-chat-wrap">
            <div className="cp-chat-header">
              <span style={{ fontSize: 21 }}><MessageCircle size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /></span>
              <div className="cp-chat-title">Chat con Qubit Corp.</div>
            </div>
            <div className="cp-chat-messages">
              {chatMessages.length === 0 && <div className="cp-empty">Sin mensajes — escribe al equipo de Qubit Corp.</div>}
              {chatMessages.map(m => (
                <div key={m.id} className={clsx('cp-msg', m.authorType === 'client' && 'mine')}>
                  {m.authorType !== 'client' && (
                    <div className="cp-msg-avatar" style={{
                      background: m.isAI ? 'rgba(124,58,237,0.2)' : 'rgba(0,102,255,0.15)',
                      color: m.isAI ? '#a78bfa' : '#4d9fff'
                    }}>
                      {m.isAI ? <Sparkles size={13} /> : 'Q'}
                    </div>
                  )}
                  <div>
                    <div className={clsx('cp-msg-bubble')}>
                      <div className="cp-msg-author">{m.author}</div>
                      {m.text}
                      <div className="cp-msg-time">{m.createdAt?.toDate?.()?.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) || ''}</div>
                    </div>
                  </div>
                  {m.authorType === 'client' && (
                    <div className="cp-msg-avatar" style={{ background: 'rgba(0,200,83,0.15)', color: '#00c853' }}>{impl.name?.[0]}</div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="cp-chat-input-row">
              <input
                className="cp-input"
                style={{ margin: 0, flex: 1 }}
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                placeholder="Escribe un mensaje al equipo o pregúntale a IA..."
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              />
              <button className="cp-send-btn" style={{ background: 'transparent', border: '1px solid rgba(0,102,255,0.4)', color: '#4d9fff' }} onClick={() => sendChat(true)} disabled={sending} title="Que Claude responda ahora mismo">
                <Sparkles size={16} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> 
                Preguntar a IA
              </button>
              <button className="cp-send-btn" onClick={() => sendChat()} disabled={sending}>Enviar</button>
            </div>
          </div>
        )}

        {/* DOCUMENTOS */}
        {activeTab === 'documentos' && (
          <div className="cp-docs-wrap">
            <div className="cp-docs-header">
              <div className="cp-docs-title"><Folder size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -2 }} /> Documentos del proyecto</div>
              <label className="cp-upload-btn">
                + Subir documento
                <input type="file" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files[0]
                  if (!file) return
                  await addDoc(collection(db, 'implementations', impl.id, 'documents'), {
                    name: file.name, size: file.size, type: file.type,
                    uploadedBy: impl.name, uploaderType: 'client',
                    createdAt: serverTimestamp(),
                  })
                }} />
              </label>
            </div>
            {docs.length === 0 && <div className="cp-empty">Sin documentos — sube los materiales que te solicitamos</div>}
            {docs.map(d => (
              <div key={d.id} className="cp-doc-item">
                <span className="cp-doc-icon">{d.type?.includes('pdf') ? <FileText size={16} style={{ display: "inline-block", marginBottom: -2 }} /> : d.type?.includes('image') ? <ImageIcon size={16} style={{ display: "inline-block", marginBottom: -2 }} /> : <Paperclip size={16} style={{ display: "inline-block", marginBottom: -2 }} />}</span>
                <div style={{ flex: 1 }}>
                  <div className="cp-doc-name">{d.name}</div>
                  <div className="cp-doc-meta">{d.uploadedBy} · {fmtDate(d.createdAt)}</div>
                </div>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                  background: d.uploaderType === 'qubit' ? 'rgba(0,102,255,0.1)' : 'rgba(0,200,83,0.1)',
                  color: d.uploaderType === 'qubit' ? '#4d9fff' : '#00c853',
                  border: `1px solid ${d.uploaderType === 'qubit' ? 'rgba(0,102,255,0.2)' : 'rgba(0,200,83,0.2)'}`,
                }}>
                  {d.uploaderType === 'qubit' ? 'Qubit' : 'Tú'}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>

      {commentModal && (
        <TaskComments
          task={commentModal}
          implId={impl.id}
          clientName={impl.name}
          onClose={() => setCommentModal(null)}
        />
      )}
    </div>
  )
}
