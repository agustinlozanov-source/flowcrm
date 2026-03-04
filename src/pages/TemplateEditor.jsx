import { useState, useEffect } from 'react'
import {
  doc, getDoc, setDoc, serverTimestamp,
  collection, getDocs, updateDoc, query, orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ─── DEFAULT TEMPLATE (used if Firestore has nothing yet) ───
export const DEFAULT_TEMPLATE = [
  {
    id: 'kickoff', name: 'Kickoff y diagnóstico', icon: 'rocket', durationDays: 3,
    tasks: [
      { id: 't1', name: 'Reunión de kickoff por videollamada', responsible: 'qubit', how: 'Google Meet / Zoom — compartir link al cliente', requiresClient: true },
      { id: 't2', name: 'Compartir cuestionario de diagnóstico comercial', responsible: 'qubit', how: 'Enviar formulario por WhatsApp o email', requiresClient: false },
      { id: 't3', name: 'Entregar respuestas del diagnóstico', responsible: 'client', how: 'Cliente llena y envía el formulario', requiresClient: true },
      { id: 't4', name: 'Definir arquitectura del pipeline', responsible: 'qubit', how: 'Documento interno con etapas y criterios acordados', requiresClient: false },
    ]
  },
  {
    id: 'pipeline', name: 'Configuración del pipeline', icon: 'target', durationDays: 4,
    tasks: [
      { id: 't5', name: 'Crear etapas personalizadas del pipeline', responsible: 'qubit', how: 'Configuración directa en plataforma', requiresClient: false },
      { id: 't6', name: 'Configurar campos de calificación de leads', responsible: 'qubit', how: 'Según diagnóstico acordado en kickoff', requiresClient: false },
      { id: 't7', name: 'Validar pipeline con el cliente', responsible: 'qubit', how: 'Videollamada de revisión — máx. 30 min', requiresClient: true },
      { id: 't8', name: 'Aprobar pipeline o solicitar ajustes', responsible: 'client', how: 'Cliente confirma por escrito o en videollamada', requiresClient: true },
    ]
  },
  {
    id: 'meta', name: 'Conexión de canales Meta', icon: 'message-square', durationDays: 5,
    tasks: [
      { id: 't9', name: 'Compartir acceso de administrador a Página de Facebook', responsible: 'client', how: 'Cliente agrega a Qubit Corp. como admin de su página', requiresClient: true },
      { id: 't10', name: 'Configurar app Meta y webhook', responsible: 'qubit', how: 'Meta Developers — configuración técnica completa', requiresClient: false },
      { id: 't11', name: 'Conectar Instagram Business', responsible: 'qubit', how: 'Vincular cuenta Instagram al Business Manager del cliente', requiresClient: false },
      { id: 't12', name: 'Verificar flujo de mensajes en inbox', responsible: 'qubit', how: 'Prueba en vivo enviando mensaje de prueba', requiresClient: false },
      { id: 't13', name: 'Proporcionar número para WhatsApp Business', responsible: 'client', how: 'Número dedicado (no personal) — puede ser Twilio', requiresClient: true },
    ]
  },
  {
    id: 'agent', name: 'Entrenamiento del Agente IA', icon: 'bot', durationDays: 5,
    tasks: [
      { id: 't14', name: 'Reunión de briefing del agente IA', responsible: 'qubit', how: 'Videollamada para definir personalidad, técnica y objeciones', requiresClient: true },
      { id: 't15', name: 'Entregar materiales del producto (brochures, FAQs)', responsible: 'client', how: 'Subir documentos en el portal', requiresClient: true },
      { id: 't16', name: 'Configurar personalidad y técnica de venta', responsible: 'qubit', how: 'Configuración en panel de Agente IA de la plataforma', requiresClient: false },
      { id: 't17', name: 'Cargar base de conocimiento', responsible: 'qubit', how: 'Subir documentos del cliente al RAG del agente', requiresClient: false },
      { id: 't18', name: 'Prueba de conversación con el agente', responsible: 'qubit', how: 'Sesión en vivo con el cliente para validar respuestas', requiresClient: true },
      { id: 't19', name: 'Aprobar agente o solicitar ajustes', responsible: 'client', how: 'Cliente confirma que el agente representa bien su negocio', requiresClient: true },
    ]
  },
  {
    id: 'content', name: 'Configuración Content Studio', icon: 'clapperboard', durationDays: 3,
    tasks: [
      { id: 't20', name: 'Definir temas del radar de noticias', responsible: 'qubit', how: 'Videollamada breve — 15 min para definir industria y temas', requiresClient: true },
      { id: 't21', name: 'Configurar temas en el sistema', responsible: 'qubit', how: 'Guardar temas en Firestore del cliente', requiresClient: false },
      { id: 't22', name: 'Sesión de prueba de generación de guiones', responsible: 'qubit', how: 'En vivo con el cliente — generar primer guión juntos', requiresClient: true },
    ]
  },
  {
    id: 'delivery', name: 'Pruebas y entrega', icon: 'check-circle-2', durationDays: 10,
    tasks: [
      { id: 't23', name: 'Pruebas con leads reales', responsible: 'qubit', how: 'Monitoreo activo de conversaciones e inbox', requiresClient: false },
      { id: 't24', name: 'Ajustes finos según retroalimentación', responsible: 'qubit', how: 'Iteraciones según lo que reporte el cliente', requiresClient: false },
      { id: 't25', name: 'Sesión de capacitación completa', responsible: 'qubit', how: 'Videollamada de 60 min — tour completo de la plataforma', requiresClient: true },
      { id: 't26', name: 'Entrega de documento de accesos y credenciales', responsible: 'qubit', how: 'Subir PDF con todas las credenciales al portal', requiresClient: false },
      { id: 't27', name: 'Firma de conformidad y cierre', responsible: 'client', how: 'Cliente confirma recepción conforme del proyecto', requiresClient: true },
    ]
  },
]

// ─── HOOK: load template from Firestore ───
export function useTemplate() {
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDoc(doc(db, 'config', 'implementationTemplate'))
      .then(snap => {
        if (snap.exists() && snap.data().stages?.length > 0) {
          setTemplate(snap.data().stages)
        } else {
          setTemplate(DEFAULT_TEMPLATE)
        }
      })
      .catch(() => setTemplate(DEFAULT_TEMPLATE))
      .finally(() => setLoading(false))
  }, [])

  return { template, loading }
}

// ─── HELPERS ───
const genId = () => Math.random().toString(36).slice(2, 10)

const ICONS = ['rocket', 'target', 'message-square', 'bot', 'clapperboard', 'check-circle-2', 'clipboard-list', 'wrench', 'key', 'bar-chart-3', 'globe', 'smartphone', 'lightbulb', 'graduation-cap', 'search']


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
  .te-root * { box-sizing: border-box; }
  .te-root { font-family: 'Inter', sans-serif; }

  .te-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .te-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 800; flex: 1; }

  .te-stage {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; margin-bottom: 10px; overflow: hidden;
  }

  .te-stage-header {
    padding: 12px 16px;
    display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .te-stage-drag {
    color: #3a3a3c; cursor: grab; font-size: 14px; flex-shrink: 0;
  }

  .te-icon-picker {
    position: relative;
  }

  .te-icon-btn {
    width: 32px; height: 32px; border-radius: 8px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 16px; flex-shrink: 0;
    transition: background 0.15s;
  }
  .te-icon-btn:hover { background: rgba(255,255,255,0.1); }

  .te-icon-dropdown {
    position: absolute; top: 36px; left: 0; z-index: 50;
    background: #1c1c1e; border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px; padding: 8px;
    display: flex; flex-wrap: wrap; gap: 4px; width: 196px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }

  .te-icon-opt {
    width: 32px; height: 32px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 16px; transition: background 0.1s;
    border: none; background: transparent;
  }
  .te-icon-opt:hover { background: rgba(255,255,255,0.1); }

  .te-stage-name-input {
    flex: 1; background: transparent; border: none; outline: none;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13px; font-weight: 800; color: white;
    padding: 0;
  }

  .te-duration {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; color: #8e8e93; flex-shrink: 0;
  }

  .te-duration-input {
    width: 36px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 5px; padding: 3px 5px; font-size: 11px; color: white;
    font-family: 'Inter', sans-serif; outline: none; text-align: center;
  }

  .te-stage-actions { display: flex; gap: 4px; }

  .te-tasks { padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }

  .te-task {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px; padding: 10px 12px;
    display: flex; align-items: flex-start; gap: 8px;
  }

  .te-task-drag { color: #3a3a3c; cursor: grab; font-size: 12px; margin-top: 2px; flex-shrink: 0; }

  .te-task-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }

  .te-task-row { display: flex; gap: 6px; align-items: center; }

  .te-task-input {
    background: transparent; border: none; outline: none;
    font-size: 12.5px; font-weight: 600; color: white;
    font-family: 'Inter', sans-serif; flex: 1; padding: 0;
  }

  .te-task-input::placeholder { color: #3a3a3c; }

  .te-how-input {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px; padding: 5px 9px; font-size: 11.5px; color: #8e8e93;
    font-family: 'Inter', sans-serif; outline: none; width: 100%;
    transition: border-color 0.15s;
  }
  .te-how-input:focus { border-color: #0066ff; color: white; }
  .te-how-input::placeholder { color: #3a3a3c; }

  .te-select {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px; padding: 3px 7px; font-size: 10.5px; font-weight: 700;
    color: white; font-family: 'Inter', sans-serif; outline: none; cursor: pointer;
  }
  .te-select option { background: #1c1c1e; }

  .te-toggle {
    display: flex; align-items: center; gap: 4px;
    font-size: 10px; color: #8e8e93; cursor: pointer; flex-shrink: 0;
  }

  .te-toggle-box {
    width: 14px; height: 14px; border-radius: 3px;
    border: 1.5px solid rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; transition: all 0.15s;
  }

  .te-toggle-box.on { background: #ff9500; border-color: #ff9500; color: #070708; }

  .te-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 7px;
    font-size: 11.5px; font-weight: 700; cursor: pointer; border: none;
    font-family: 'Inter', sans-serif; transition: all 0.15s;
  }

  .te-btn-white { background: white; color: #070708; }
  .te-btn-white:hover { background: #e8e8ed; }
  .te-btn-ghost { background: transparent; color: #8e8e93; border: 1px solid rgba(255,255,255,0.1); }
  .te-btn-ghost:hover { background: rgba(255,255,255,0.06); color: white; }
  .te-btn-danger { background: rgba(255,59,48,0.08); color: #ff6b6b; border: 1px solid rgba(255,59,48,0.15); }
  .te-btn-danger:hover { background: rgba(255,59,48,0.15); }
  .te-btn-blue { background: #0066ff; color: white; }
  .te-btn-blue:hover { opacity: 0.88; }
  .te-btn-sm { padding: 4px 8px; font-size: 10.5px; border-radius: 5px; }
  .te-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .te-add-task {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px 10px;
    font-size: 11.5px; font-weight: 600; color: #3a3a3c;
    cursor: pointer; transition: color 0.15s; border: none;
    background: transparent; font-family: 'Inter', sans-serif;
    width: 100%;
  }
  .te-add-task:hover { color: #8e8e93; }

  .te-add-stage {
    display: flex; align-items: center; gap: 8px;
    padding: 14px 18px;
    background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);
    border-radius: 12px; cursor: pointer; transition: all 0.15s;
    font-size: 13px; font-weight: 600; color: #3a3a3c;
    border-style: dashed; width: 100%; font-family: 'Inter', sans-serif;
    justify-content: center;
  }
  .te-add-stage:hover { border-color: rgba(255,255,255,0.2); color: #8e8e93; }

  /* APPLY MODAL */
  .te-modal-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }

  .te-modal {
    background: #1c1c1e; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 18px; padding: 28px;
    width: 100%; max-width: 480px; max-height: 80vh; overflow-y: auto;
  }

  .te-modal-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 16px; font-weight: 800; margin-bottom: 6px; }
  .te-modal-sub { font-size: 12.5px; color: #8e8e93; line-height: 1.6; margin-bottom: 18px; }

  .te-client-check {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 8px; cursor: pointer;
    border: 1.5px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);
    margin-bottom: 6px; transition: all 0.15s;
  }
  .te-client-check:hover { border-color: rgba(255,255,255,0.15); }
  .te-client-check.selected { border-color: rgba(0,102,255,0.4); background: rgba(0,102,255,0.06); }

  .te-check-box {
    width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0;
    border: 1.5px solid rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center; font-size: 9px;
    transition: all 0.15s;
  }
  .te-client-check.selected .te-check-box { background: #0066ff; border-color: #0066ff; color: white; }

  .te-client-name { font-size: 13px; font-weight: 600; }
  .te-client-sub { font-size: 11px; color: #8e8e93; }

  .te-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

  .te-warning {
    background: rgba(255,149,0,0.06); border: 1px solid rgba(255,149,0,0.18);
    border-radius: 8px; padding: 10px 14px;
    font-size: 12px; color: #ff9500; line-height: 1.6; margin-bottom: 16px;
  }
`

// ─── ICON PICKER ───
function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="te-icon-picker">
      <div className="te-icon-btn" onClick={() => setOpen(o => !o)}><StageIcon icon=<StageIcon icon={value} /> /></div>
      {open && (
        <div className="te-icon-dropdown">
          {ICONS.map(ic => (
            <button key=<StageIcon icon=<StageIcon icon={ic} /> /> className="te-icon-opt" onClick={() => { onChange(ic); setOpen(false) }}><StageIcon icon=<StageIcon icon={ic} /> /></button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── APPLY MODAL ───
function ApplyModal({ impls, onApply, onClose }) {
  const [selected, setSelected] = useState(new Set())
  const [applying, setApplying] = useState(false)

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const apply = async () => {
    setApplying(true)
    await onApply([...selected])
    setApplying(false)
  }

  const activeImpls = impls.filter(i => i.status === 'active')

  return (
    <div className="te-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="te-modal">
        <div className="te-modal-title">¿Aplicar a implementaciones activas?</div>
        <div className="te-modal-sub">La plantilla ya fue guardada. Selecciona a cuáles clientes quieres aplicar los cambios de etapas y tareas. Las tareas ya completadas se conservan.</div>

        <div className="te-warning">
          ⚠️ Solo se agregan etapas y tareas nuevas. Las tareas existentes que hayas completado no se pierden.
        </div>

        {activeImpls.length === 0
          ? <div style={{ fontSize: 13, color: '#8e8e93', textAlign: 'center', padding: '16px 0' }}>Sin implementaciones activas</div>
          : activeImpls.map(impl => (
            <div
              key={impl.id}
              className={clsx('te-client-check', selected.has(impl.id) && 'selected')}
              onClick={() => toggle(impl.id)}
            >
              <div className={clsx('te-check-box')}>{selected.has(impl.id) && '✓'}</div>
              <div>
                <div className="te-client-name">{impl.name}</div>
                <div className="te-client-sub">{impl.company}</div>
              </div>
            </div>
          ))
        }

        <div className="te-modal-actions">
          <button className="te-btn te-btn-ghost" onClick={onClose}>Solo guardar plantilla</button>
          <button
            className="te-btn te-btn-white"
            onClick={apply}
            disabled={selected.size === 0 || applying}
          >
            {applying ? 'Aplicando...' : `Aplicar a ${selected.size} cliente${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN TEMPLATE EDITOR ───
export default function TemplateEditor() {
  const [stages, setStages] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showApply, setShowApply] = useState(false)
  const [impls, setImpls] = useState([])
  const [openIcons, setOpenIcons] = useState({})

  // Load template
  useEffect(() => {
    getDoc(doc(db, 'config', 'implementationTemplate'))
      .then(snap => {
        if (snap.exists() && snap.data().stages?.length > 0) {
          setStages(JSON.parse(JSON.stringify(snap.data().stages)))
        } else {
          setStages(JSON.parse(JSON.stringify(DEFAULT_TEMPLATE)))
        }
      })
      .catch(() => setStages(JSON.parse(JSON.stringify(DEFAULT_TEMPLATE))))
      .finally(() => setLoading(false))
  }, [])

  // Load active impls for apply modal
  useEffect(() => {
    getDocs(query(collection(db, 'implementations'), orderBy('createdAt', 'desc')))
      .then(snap => setImpls(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  const updateStage = (idx, key, val) => {
    setStages(prev => prev.map((s, i) => i === idx ? { ...s, [key]: val } : s))
  }

  const removeStage = (idx) => {
    if (!window.confirm('¿Eliminar esta etapa?')) return
    setStages(prev => prev.filter((_, i) => i !== idx))
  }

  const addStage = () => {
    setStages(prev => [...prev, {
      id: genId(), name: 'Nueva etapa', icon: 'clipboard-list', durationDays: 3, tasks: []
    }])
  }

  const moveStage = (idx, dir) => {
    const next = [...stages]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setStages(next)
  }

  const updateTask = (sIdx, tIdx, key, val) => {
    setStages(prev => prev.map((s, i) => i !== sIdx ? s : {
      ...s,
      tasks: s.tasks.map((t, j) => j !== tIdx ? t : { ...t, [key]: val })
    }))
  }

  const removeTask = (sIdx, tIdx) => {
    setStages(prev => prev.map((s, i) => i !== sIdx ? s : {
      ...s, tasks: s.tasks.filter((_, j) => j !== tIdx)
    }))
  }

  const addTask = (sIdx) => {
    setStages(prev => prev.map((s, i) => i !== sIdx ? s : {
      ...s, tasks: [...s.tasks, {
        id: genId(), name: '', responsible: 'qubit', how: '', requiresClient: false
      }]
    }))
  }

  const moveTask = (sIdx, tIdx, dir) => {
    setStages(prev => prev.map((s, i) => {
      if (i !== sIdx) return s
      const tasks = [...s.tasks]
      const swap = tIdx + dir
      if (swap < 0 || swap >= tasks.length) return s
      ;[tasks[tIdx], tasks[swap]] = [tasks[swap], tasks[tIdx]]
      return { ...s, tasks }
    }))
  }

  const saveTemplate = async () => {
    // Validate
    for (const stage of stages) {
      if (!stage.name.trim()) { toast.error('Todas las etapas deben tener nombre'); return }
      for (const task of stage.tasks) {
        if (!task.name.trim()) { toast.error('Todas las tareas deben tener nombre'); return }
      }
    }
    setSaving(true)
    try {
      await setDoc(doc(db, 'config', 'implementationTemplate'), {
        stages, updatedAt: serverTimestamp()
      })
      toast.success('Plantilla guardada')
      setShowApply(true)
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const applyToImpls = async (implIds) => {
    if (implIds.length === 0) { setShowApply(false); return }
    try {
      for (const implId of implIds) {
        const implDoc = await getDoc(doc(db, 'implementations', implId))
        if (!implDoc.exists()) continue
        const data = implDoc.data()
        const existingTasks = data.tasks || {}

        // Merge: add new tasks, keep existing ones
        const newTasks = { ...existingTasks }
        stages.forEach(stage => {
          stage.tasks.forEach(task => {
            if (!newTasks[task.id]) {
              newTasks[task.id] = { done: false, doneAt: null, note: '' }
            }
          })
        })

        await updateDoc(doc(db, 'implementations', implId), {
          tasks: newTasks,
          updatedAt: serverTimestamp(),
        })
      }
      toast.success(`Plantilla aplicada a ${implIds.length} cliente${implIds.length !== 1 ? 's' : ''}`)
    } catch (e) { toast.error(e.message) }
    setShowApply(false)
  }

  if (loading) return <div style={{ padding: 32, color: '#8e8e93', fontSize: 13 }}>Cargando plantilla...</div>

  return (
    <div className="te-root sa-content" style={{ maxWidth: 760 }}>
      <style>{css}</style>

      <div className="te-header">
        <div>
          <div className="te-title">Plantilla de implementación</div>
          <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>
            {stages.length} etapas · {stages.reduce((s, st) => s + st.tasks.length, 0)} tareas · {stages.reduce((s, st) => s + (st.durationDays || 0), 0)} días hábiles totales
          </div>
        </div>
        <button className="te-btn te-btn-white" onClick={saveTemplate} disabled={saving}>
          {saving ? 'Guardando...' : '💾 Guardar plantilla'}
        </button>
      </div>

      {stages.map((stage, sIdx) => (
        <div key={stage.id} className="te-stage">
          {/* Stage header */}
          <div className="te-stage-header">
            <span className="te-stage-drag" title="Mover">⠿</span>

            <IconPicker value=<StageIcon icon=<StageIcon icon={stage.icon} /> /> onChange={val => updateStage(sIdx, 'icon', val)} />

            <input
              className="te-stage-name-input"
              value={stage.name}
              onChange={e => updateStage(sIdx, 'name', e.target.value)}
              placeholder="Nombre de la etapa"
            />

            <div className="te-duration">
              <input
                className="te-duration-input"
                type="number" min="1" max="60"
                value={stage.durationDays}
                onChange={e => updateStage(sIdx, 'durationDays', parseInt(e.target.value) || 1)}
              />
              <span>días</span>
            </div>

            <div className="te-stage-actions">
              <button className="te-btn te-btn-ghost te-btn-sm" onClick={() => moveStage(sIdx, -1)} disabled={sIdx === 0} title="Subir">↑</button>
              <button className="te-btn te-btn-ghost te-btn-sm" onClick={() => moveStage(sIdx, 1)} disabled={sIdx === stages.length - 1} title="Bajar">↓</button>
              <button className="te-btn te-btn-danger te-btn-sm" onClick={() => removeStage(sIdx)}>✕</button>
            </div>
          </div>

          {/* Tasks */}
          <div className="te-tasks">
            {stage.tasks.map((task, tIdx) => (
              <div key={task.id} className="te-task">
                <span className="te-task-drag" title="Mover">⠿</span>
                <div className="te-task-body">
                  <div className="te-task-row">
                    <input
                      className="te-task-input"
                      value={task.name}
                      onChange={e => updateTask(sIdx, tIdx, 'name', e.target.value)}
                      placeholder="Nombre de la tarea..."
                    />
                    <select
                      className="te-select"
                      value={task.responsible}
                      onChange={e => updateTask(sIdx, tIdx, 'responsible', e.target.value)}
                    >
                      <option value="qubit"><Zap size={12} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} /> Qubit</option>
                      <option value="client"><User size={12} style={{ marginRight: 4, display: "inline-block", marginBottom: -1 }} /> Cliente</option>
                    </select>
                    <div
                      className="te-toggle"
                      onClick={() => updateTask(sIdx, tIdx, 'requiresClient', !task.requiresClient)}
                      title="¿Requiere reunión con el cliente?"
                    >
                      <div className={clsx('te-toggle-box', task.requiresClient && 'on')}>
                        {task.requiresClient && '<Calendar size={14} style={{ marginRight: 6, display: "inline-block", marginBottom: -1 }} />'}
                      </div>
                      <span>Reunión</span>
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="te-btn te-btn-ghost te-btn-sm" onClick={() => moveTask(sIdx, tIdx, -1)} disabled={tIdx === 0}>↑</button>
                      <button className="te-btn te-btn-ghost te-btn-sm" onClick={() => moveTask(sIdx, tIdx, 1)} disabled={tIdx === stage.tasks.length - 1}>↓</button>
                      <button className="te-btn te-btn-danger te-btn-sm" onClick={() => removeTask(sIdx, tIdx)}>✕</button>
                    </div>
                  </div>
                  <input
                    className="te-how-input"
                    value={task.how}
                    onChange={e => updateTask(sIdx, tIdx, 'how', e.target.value)}
                    placeholder="¿Cómo se realiza esta tarea? (visible para el cliente)"
                  />
                </div>
              </div>
            ))}
            <button className="te-add-task" onClick={() => addTask(sIdx)}>
              + Agregar tarea
            </button>
          </div>
        </div>
      ))}

      <button className="te-add-stage" onClick={addStage}>
        + Agregar etapa
      </button>

      {showApply && (
        <ApplyModal
          impls={impls}
          onApply={applyToImpls}
          onClose={() => setShowApply(false)}
        />
      )}
    </div>
  )
}
