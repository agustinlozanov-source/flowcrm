import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Building2, Target, BarChart, MessageSquare, Settings, Rocket, Check, ArrowRight, ArrowLeft, ClipboardList, SmilePlus, Lightbulb, PartyPopper, AlertTriangle } from 'lucide-react'

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600&display=swap');

  .wf-root *, .wf-root *::before, .wf-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .wf-root {
    font-family: 'Inter', sans-serif;
    background: #070708;
    color: white;
    min-height: 100vh;
    --blue: #0066ff;
    --green: #00c853;
    --purple: #7c3aed;
    --gray-3: #c7c7cc;
    --gray-4: #8e8e93;
    --gray-5: #3a3a3c;
    --gray-6: #1c1c1e;
  }

  /* BG */
  .wf-bg {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background:
      radial-gradient(ellipse 60% 50% at 10% 20%, rgba(0,102,255,0.07) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 90% 80%, rgba(124,58,237,0.06) 0%, transparent 60%);
  }

  .wf-wrap {
    position: relative; z-index: 1;
    max-width: 680px; margin: 0 auto;
    padding: 48px 24px 80px;
  }

  /* HEADER */
  .wf-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 40px; }
  .wf-logo-icon {
    width: 34px; height: 34px; border-radius: 9px;
    background: linear-gradient(135deg, #0066ff, #7c3aed);
    display: flex; align-items: center; justify-content: center;
  }
  .wf-logo-text { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; font-weight: 800; }

  .wf-hero { margin-bottom: 40px; }
  .wf-hero-tag {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(0,102,255,0.1); border: 1px solid rgba(0,102,255,0.2);
    border-radius: 20px; padding: 5px 14px;
    font-size: 15px; font-weight: 500; font-weight: 700; color: #4d9fff;
    margin-bottom: 14px;
  }
  .wf-hero-title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 34px; font-weight: 900; letter-spacing: -0.5px;
    line-height: 1.25; margin-bottom: 12px;
  }
  .wf-hero-sub { font-size: 16px; color: var(--gray-4); line-height: 1.7; max-width: 520px; }

  /* PROGRESS */
  .wf-progress { margin-bottom: 36px; }
  .wf-progress-track { height: 4px; background: rgba(255,255,255,0.07); border-radius: 2px; margin-bottom: 10px; }
  .wf-progress-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, #0066ff, #7c3aed); transition: width 0.4s ease; }
  .wf-progress-label { font-size: 15px; font-weight: 500; color: var(--gray-4); font-weight: 600; }
  .wf-progress-label span { color: white; font-weight: 700; }

  /* SECTION */
  .wf-section {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px; padding: 32px;
    margin-bottom: 16px;
  }

  .wf-section-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
  .wf-section-icon {
    width: 44px; height: 44px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; font-size: 20px;
    flex-shrink: 0;
  }
  .wf-section-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; font-weight: 800; }
  .wf-section-sub { font-size: 14px; color: var(--gray-4); margin-top: 2px; }

  /* FIELDS */
  .wf-field { margin-bottom: 22px; }
  .wf-field:last-child { margin-bottom: 0; }

  .wf-label {
    display: block; font-size: 14px; font-weight: 700;
    color: var(--gray-3); margin-bottom: 8px; letter-spacing: 0.1px;
  }
  .wf-label-req { color: #4d9fff; margin-left: 2px; }

  .wf-input, .wf-textarea, .wf-select {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px; padding: 13px 16px;
    font-size: 15px; color: white;
    font-family: 'Inter', sans-serif;
    outline: none; transition: all 0.15s;
  }
  .wf-input:focus, .wf-textarea:focus, .wf-select:focus {
    border-color: rgba(0,102,255,0.5);
    background: rgba(0,102,255,0.04);
  }
  .wf-input::placeholder, .wf-textarea::placeholder { color: #3a3a3c; }
  .wf-textarea { resize: vertical; min-height: 100px; line-height: 1.6; }
  .wf-select { cursor: pointer; }
  .wf-select option { background: #1c1c1e; }

  .wf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  /* RADIO / CHECKBOX GROUPS */
  .wf-options { display: flex; flex-direction: column; gap: 9px; }
  .wf-options-row { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }

  .wf-option {
    display: flex; align-items: center; gap: 10px;
    padding: 13px 16px; border-radius: 9px; cursor: pointer;
    border: 1.5px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
    transition: all 0.15s; font-size: 15px; font-weight: 500;
  }
  .wf-option:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); }
  .wf-option.selected { border-color: rgba(0,102,255,0.45); background: rgba(0,102,255,0.07); color: #4d9fff; }

  .wf-option-dot {
    width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
    border: 1.5px solid rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .wf-option.selected .wf-option-dot { background: #0066ff; border-color: #0066ff; }
  .wf-option-dot-inner { width: 8px; height: 8px; border-radius: 50%; background: white; }

  .wf-check-dot {
    width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0;
    border: 1.5px solid rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; transition: all 0.15s;
  }
  .wf-option.selected .wf-check-dot { background: #0066ff; border-color: #0066ff; }

  /* SCALE */
  .wf-scale { display: flex; gap: 8px; }
  .wf-scale-btn {
    flex: 1; padding: 11px 4px; border-radius: 8px; cursor: pointer; text-align: center;
    border: 1.5px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);
    font-size: 14px; font-weight: 700; color: var(--gray-4);
    transition: all 0.15s; font-family: 'Inter', sans-serif;
  }
  .wf-scale-btn:hover { border-color: rgba(255,255,255,0.15); color: white; }
  .wf-scale-btn.selected { background: rgba(0,102,255,0.12); border-color: rgba(0,102,255,0.4); color: #4d9fff; }
  .wf-scale-labels { display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px; font-weight: 600; color: var(--gray-5); }

  /* HINT */
  .wf-hint { font-size: 13px; color: var(--gray-5); margin-top: 6px; line-height: 1.5; }

  /* NAVIGATION */
  .wf-nav { display: flex; align-items: center; justify-content: space-between; margin-top: 32px; }

  .wf-btn {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 13px 26px; border-radius: 12px;
    font-size: 15px; font-weight: 700; cursor: pointer; border: none;
    font-family: 'Inter', sans-serif; transition: all 0.15s;
  }
  .wf-btn-white { background: white; color: #070708; }
  .wf-btn-white:hover { background: #e8e8ed; }
  .wf-btn-ghost { background: transparent; color: var(--gray-4); border: 1px solid rgba(255,255,255,0.1); }
  .wf-btn-ghost:hover { background: rgba(255,255,255,0.06); color: white; }
  .wf-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* SUCCESS */
  .wf-success {
    text-align: center; padding: 60px 20px;
  }
  .wf-success-icon { font-size: 52px; margin-bottom: 20px; }
  .wf-success-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; font-weight: 900; margin-bottom: 12px; letter-spacing: -0.3px; }
  .wf-success-sub { font-size: 16px; color: var(--gray-4); line-height: 1.7; max-width: 400px; margin: 0 auto; }

  @media (max-width: 600px) {
    .wf-row { grid-template-columns: 1fr; }
    .wf-options-row { grid-template-columns: 1fr; }
    .wf-hero-title { font-size: 22px; }
    .wf-section { padding: 20px; }
  }
`

// ─── FORM STRUCTURE ───
const SECTIONS = [
  {
    id: 'general',
    icon: <Building2 size={24} strokeWidth={2} />,
    iconBg: 'rgba(0,102,255,0.12)',
    title: 'Datos generales',
    sub: 'Información básica de tu empresa',
    fields: [
      { id: 'company', label: 'Nombre de la empresa', type: 'text', placeholder: 'Ej. Aktivz Agency', required: true },
      { id: 'industry', label: 'Industria o giro de negocio', type: 'text', placeholder: 'Ej. Marketing digital, Salud, Bienes raíces...', required: true },
      { id: 'website', label: 'Sitio web', type: 'text', placeholder: 'https://tuempresa.com' },
      { id: 'contactName', label: 'Nombre del contacto principal', type: 'text', placeholder: 'Tu nombre completo', required: true },
      { id: 'contactRole', label: 'Cargo o rol', type: 'text', placeholder: 'Ej. Director Comercial, CEO, Gerente de Ventas' },
      {
        id: 'teamSize', label: '¿Cuántas personas hay en tu equipo de ventas?', type: 'radio',
        options: ['Solo yo', '2–5 personas', '6–15 personas', 'Más de 15']
      },
    ]
  },
  {
    id: 'sales',
    icon: <Target size={24} strokeWidth={2} />,
    iconBg: 'rgba(124,58,237,0.12)',
    title: 'Proceso de ventas actual',
    sub: 'Cómo funciona tu ciclo comercial hoy',
    fields: [
      {
        id: 'leadSource', label: '¿De dónde vienen la mayoría de tus leads hoy?', type: 'checkbox',
        options: ['Redes sociales (orgánico)', 'Publicidad pagada (Meta Ads, Google)', 'Referidos / boca a boca', 'Base de datos propia', 'Eventos o ferias', 'Otro']
      },
      {
        id: 'salesProcess', label: '¿Tienes un proceso de ventas definido?', type: 'radio',
        options: ['Sí, bien documentado', 'Sí, pero informal', 'En construcción', 'No tenemos proceso definido']
      },
      { id: 'salesProcessDesc', label: '¿Cómo describes tu proceso de venta actual?', type: 'textarea', placeholder: 'Ej. El cliente llega por Instagram, le escribimos por DM, mandamos cotización por WhatsApp, seguimiento por llamada...' },
      { id: 'avgCycle', label: '¿Cuánto tiempo tarda en cerrar una venta desde el primer contacto?', type: 'select', options: ['Menos de 24 horas', '1–7 días', '1–4 semanas', '1–3 meses', 'Más de 3 meses'] },
      { id: 'avgTicket', label: 'Ticket promedio de venta (valor en MXN o USD)', type: 'text', placeholder: 'Ej. $5,000 MXN / $300 USD' },
    ]
  },
  {
    id: 'metrics',
    icon: <BarChart size={24} strokeWidth={2} />,
    iconBg: 'rgba(0,200,83,0.1)',
    title: 'Métricas actuales',
    sub: 'Números aproximados — no necesitan ser exactos',
    fields: [
      { id: 'monthlyLeads', label: '¿Cuántos leads nuevos recibes al mes aproximadamente?', type: 'select', options: ['Menos de 20', '20–50', '50–150', '150–500', 'Más de 500'] },
      { id: 'closeRate', label: '¿Cuál es tu tasa de cierre aproximada?', type: 'select', options: ['Menos del 5%', '5–15%', '15–30%', '30–50%', 'Más del 50%', 'No lo sé'] },
      { id: 'mainChallenge', label: '¿Cuál es tu mayor reto comercial hoy?', type: 'radio', options: ['Generar más leads', 'Convertir más leads a clientes', 'Dar seguimiento a tiempo', 'Organizar y centralizar la información', 'Escalar el equipo'] },
      { id: 'lostLeads', label: '¿Qué pasa con los leads que no cierran?', type: 'textarea', placeholder: 'Ej. Se pierden en WhatsApp, no hay seguimiento, no tenemos base de datos...' },
    ]
  },
  {
    id: 'channels',
    icon: <MessageSquare size={24} strokeWidth={2} />,
    iconBg: 'rgba(255,149,0,0.1)',
    title: 'Canales de comunicación',
    sub: 'Cómo te comunicas con tus clientes y prospectos',
    fields: [
      {
        id: 'activeChannels', label: '¿Qué canales usas actualmente para atender prospectos?', type: 'checkbox',
        options: ['WhatsApp (personal)', 'WhatsApp Business', 'Facebook Messenger', 'Instagram DM', 'Email', 'Teléfono / llamadas', 'Presencial']
      },
      { id: 'mainChannel', label: '¿Cuál es el canal donde más interacciones tienes?', type: 'text', placeholder: 'Ej. WhatsApp, Instagram DM...' },
      {
        id: 'hasFacebook', label: '¿Tu empresa tiene Página de Facebook activa?', type: 'radio',
        options: ['Sí, activa y con seguidores', 'Sí, pero poco activa', 'No tenemos página', 'En proceso de crearla']
      },
      {
        id: 'hasInstagram', label: '¿Tienen cuenta de Instagram Business?', type: 'radio',
        options: ['Sí, cuenta de empresa', 'Sí, pero es personal', 'No tenemos Instagram', 'En proceso']
      },
      { id: 'socialManager', label: '¿Quién maneja las redes sociales?', type: 'radio', options: ['Yo mismo / el dueño', 'Un empleado interno', 'Una agencia externa', 'Nadie, no las gestionamos'] },
    ]
  },
  {
    id: 'tech',
    icon: <Settings size={24} strokeWidth={2} />,
    iconBg: 'rgba(255,59,48,0.08)',
    title: 'Tecnología y herramientas',
    sub: 'Tu nivel de adopción tecnológica actual',
    fields: [
      {
        id: 'currentTools', label: '¿Qué herramientas usas hoy para gestionar clientes o ventas?', type: 'checkbox',
        options: ['Excel / Google Sheets', 'WhatsApp Business', 'CRM (HubSpot, Salesforce, otro)', 'Trello / Notion', 'Ninguna — todo de memoria', 'Otro']
      },
      {
        id: 'techLevel', label: '¿Cómo describirías tu nivel de comodidad con herramientas digitales?', type: 'scale',
        scaleMin: 'Básico', scaleMax: 'Muy avanzado', scaleCount: 5,
        scaleLabels: ['Básico', 'Principiante', 'Intermedio', 'Avanzado', 'Experto']
      },
      {
        id: 'aiExperience', label: '¿Has usado herramientas de inteligencia artificial antes?', type: 'radio',
        options: ['Nunca', 'Sí, ChatGPT u otros para texto', 'Sí, en procesos de negocio', 'Sí, de forma intensiva']
      },
      { id: 'integrations', label: '¿Tienes alguna herramienta que necesite integrarse con el CRM?', type: 'textarea', placeholder: 'Ej. Usamos Calendly para agendar, Stripe para pagos, ActiveCampaign para email...', hint: 'No es obligatorio, pero nos ayuda a planificar mejor la implementación.' },
    ]
  },
  {
    id: 'goals',
    icon: <Rocket size={24} strokeWidth={2} />,
    iconBg: 'rgba(0,102,255,0.1)',
    title: 'Objetivos y expectativas',
    sub: 'Qué esperas lograr con FlowCRM',
    fields: [
      { id: 'mainGoal', label: '¿Cuál es el principal resultado que esperas lograr en los primeros 90 días?', type: 'textarea', placeholder: 'Ej. Triplicar el número de leads atendidos, reducir el tiempo de respuesta, tener visibilidad de todo el pipeline...', required: true },
      {
        id: 'priority', label: '¿Qué módulo te genera más expectativa?', type: 'radio',
        options: ['Pipeline de ventas', 'Inbox unificado (Meta)', 'Agente IA de ventas', 'Content Studio', 'Analytics y reportes']
      },
      {
        id: 'successMetric', label: '¿Cómo medirías el éxito de la implementación?', type: 'checkbox',
        options: ['Más leads atendidos por semana', 'Mayor tasa de conversión', 'Menos tiempo de respuesta', 'Equipo más organizado', 'Reducción de trabajo manual', 'Más contenido publicado']
      },
      { id: 'concerns', label: '¿Tienes alguna preocupación o duda antes de empezar?', type: 'textarea', placeholder: 'Cualquier cosa que quieras que sepamos antes del Kickoff — sin filtro.' },
      { id: 'extraNotes', label: '¿Algo más que quieras agregar?', type: 'textarea', placeholder: 'Información adicional, contexto especial, casos particulares de tu negocio...' },
    ]
  },
]

// ─── HELPERS ───
function RadioGroup({ field, value, onChange }) {
  return (
    <div className={field.options.length <= 4 ? 'wf-options-row' : 'wf-options'}>
      {field.options.map(opt => (
        <div
          key={opt}
          className={`wf-option ${value === opt ? 'selected' : ''}`}
          onClick={() => onChange(opt)}
        >
          <div className="wf-option-dot">
            {value === opt && <div className="wf-option-dot-inner" />}
          </div>
          {opt}
        </div>
      ))}
    </div>
  )
}

function CheckboxGroup({ field, value = [], onChange }) {
  const toggle = (opt) => {
    const next = value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]
    onChange(next)
  }
  return (
    <div className={field.options.length <= 4 ? 'wf-options-row' : 'wf-options'}>
      {field.options.map(opt => (
        <div
          key={opt}
          className={`wf-option ${value.includes(opt) ? 'selected' : ''}`}
          onClick={() => toggle(opt)}
        >
          <div className="wf-check-dot">
            {value.includes(opt) && <Check size={14} strokeWidth={3} />}
          </div>
          {opt}
        </div>
      ))}
    </div>
  )
}

function ScaleGroup({ field, value, onChange }) {
  return (
    <div>
      <div className="wf-scale">
        {Array.from({ length: field.scaleCount }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            className={`wf-scale-btn ${value === n ? 'selected' : ''}`}
            onClick={() => onChange(n)}
            type="button"
          >
            {n}
          </button>
        ))}
      </div>
      <div className="wf-scale-labels">
        <span>{field.scaleMin}</span>
        <span>{field.scaleMax}</span>
      </div>
    </div>
  )
}

function Field({ field, value, onChange }) {
  const val = value ?? (field.type === 'checkbox' ? [] : '')

  return (
    <div className="wf-field">
      <label className="wf-label">
        {field.label}
        {field.required && <span className="wf-label-req">*</span>}
      </label>

      {field.type === 'text' && (
        <input className="wf-input" value={val} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ''} />
      )}

      {field.type === 'textarea' && (
        <textarea className="wf-textarea" value={val} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ''} />
      )}

      {field.type === 'select' && (
        <select className="wf-select" value={val} onChange={e => onChange(e.target.value)}>
          <option value="">Selecciona una opción</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {field.type === 'radio' && <RadioGroup field={field} value={val} onChange={onChange} />}
      {field.type === 'checkbox' && <CheckboxGroup field={field} value={val} onChange={onChange} />}
      {field.type === 'scale' && <ScaleGroup field={field} value={val} onChange={onChange} />}

      {field.hint && <div className="wf-hint"><Lightbulb size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: 4, color: '#ffd166' }} /> {field.hint}</div>}
    </div>
  )
}

// ─── MAIN ───
export default function WelcomeForm() {
  const [currentSection, setCurrentSection] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Get orgId from URL params
  const params = new URLSearchParams(window.location.search)
  const orgId = params.get('org') || null
  const clientName = params.get('name') || ''

  const section = SECTIONS[currentSection]
  const progress = Math.round(((currentSection) / SECTIONS.length) * 100)
  const isLast = currentSection === SECTIONS.length - 1

  const setAnswer = (fieldId, value) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }))
  }

  const validateSection = () => {
    const required = section.fields.filter(f => f.required)
    for (const field of required) {
      const val = answers[field.id]
      if (!val || (Array.isArray(val) && val.length === 0) || val === '') {
        setError(`Por favor completa: "${field.label}"`)
        return false
      }
    }
    setError('')
    return true
  }

  const next = () => {
    if (!validateSection()) return
    setCurrentSection(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const back = () => {
    setCurrentSection(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setError('')
  }

  const submit = async () => {
    if (!validateSection()) return
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'onboardingForms'), {
        orgId,
        clientName,
        answers,
        sections: SECTIONS.map(s => s.id),
        submittedAt: serverTimestamp(),
        status: 'pending_review',
      })
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError('Error al enviar. Por favor intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="wf-root">
        <style>{css}</style>
        <div className="wf-bg" />
        <div className="wf-wrap">
          <div className="wf-logo">
            <img src="/qubit-corp.png" alt="Qubit Corp" style={{ height: 38, objectFit: "contain" }} />
          </div>
          <div className="wf-success">
            <div className="wf-success-icon"><PartyPopper size={52} strokeWidth={1.5} color="#7c3aed" /></div>
            <div className="wf-success-title">¡Formulario enviado!</div>
            <div className="wf-success-sub">
              Recibimos toda tu información. El equipo de Qubit Corp. la revisará antes del Kickoff para que la sesión sea lo más productiva posible.<br /><br />
              Te contactaremos por Telegram o email para confirmar la fecha y hora de la videollamada.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="wf-root">
      <style>{css}</style>
      <div className="wf-bg" />
      <div className="wf-wrap">

        {/* Logo */}
        <div className="wf-logo">
            <img src="/qubit-corp.png" alt="Qubit Corp" style={{ height: 38, objectFit: "contain" }} />
          </div>

        {/* Hero — only on first section */}
        {currentSection === 0 && (
          <div className="wf-hero">
            <div className="wf-hero-tag"><ClipboardList size={14} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} /> Formulario de bienvenida</div>
            <div className="wf-hero-title">
              {clientName ? `Hola, ${clientName}` : 'Bienvenido a FlowCRM'} <SmilePlus size={28} style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} /><br />
              Cuéntanos sobre tu negocio
            </div>
            <div className="wf-hero-sub">
              Este formulario nos ayuda a entender tu operación antes del Kickoff para que esa sesión sea 100% estratégica y sin tiempo perdido. Toma aprox. 8–10 minutos.
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="wf-progress">
          <div className="wf-progress-track">
            <div className="wf-progress-fill" style={{ width: `${Math.max(progress, 5)}%` }} />
          </div>
          <div className="wf-progress-label">
            Sección <span>{currentSection + 1}</span> de <span>{SECTIONS.length}</span> — <span>{section.title}</span>
          </div>
        </div>

        {/* Current section */}
        <div className="wf-section">
          <div className="wf-section-header">
            <div className="wf-section-icon" style={{ background: section.iconBg }}>{section.icon}</div>
            <div>
              <div className="wf-section-title">{section.title}</div>
              <div className="wf-section-sub">{section.sub}</div>
            </div>
          </div>

          {section.fields.map(field => (
            <Field
              key={field.id}
              field={field}
              value={answers[field.id]}
              onChange={val => setAnswer(field.id, val)}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: 12.5, color: '#ff6b6b', marginBottom: 12, padding: '10px 14px', background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.15)', borderRadius: 8 }}>
            <AlertTriangle size={14} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'text-bottom' }} /> {error}
          </div>
        )}

        {/* Navigation */}
        <div className="wf-nav">
          <button
            className="wf-btn wf-btn-ghost"
            onClick={back}
            disabled={currentSection === 0}
          >
            <ArrowLeft size={16} /> Anterior
          </button>

          {isLast ? (
            <button className="wf-btn wf-btn-white" onClick={submit} disabled={submitting}>
              {submitting ? 'Enviando...' : <><Check size={16} /> Enviar formulario</>}
            </button>
          ) : (
            <button className="wf-btn wf-btn-white" onClick={next}>
              Siguiente <ArrowRight size={16} />
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, fontSize: 11.5, color: '#3a3a3c', textAlign: 'center', lineHeight: 1.6 }}>
          Tu información es confidencial y será usada únicamente por el equipo de Qubit Corp.<br />
          para preparar tu implementación de FlowCRM.
        </div>

      </div>
    </div>
  )
}
