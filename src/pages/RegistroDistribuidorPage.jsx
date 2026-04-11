import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Lock, Sun, Moon, UserCheck, Check, AlertCircle, Eye, EyeOff,
  User, Mail, Phone, MapPin, CreditCard, Instagram, Facebook,
  KeyRound, FileCheck, ArrowDown, PenLine, Send, Shield, Calendar,
  Clock, CheckCircle
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');

  [data-theme-reg] *, [data-theme-reg] *::before, [data-theme-reg] *::after {
    box-sizing: border-box; margin: 0; padding: 0;
  }

  [data-theme-reg] {
    --blue: #0066ff;
    --blue-light: rgba(0,102,255,0.10);
    --green: #00c853;
    --green-light: rgba(0,200,83,0.10);
    --purple: #7c3aed;
    --amber: #ff9500;
    --amber-light: rgba(255,149,0,0.10);
    --red: #ff3b30;
    --red-light: rgba(255,59,48,0.08);
    --radius: 14px;
    --radius-sm: 9px;
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
    line-height: 1.6;
  }

  [data-theme-reg="dark"] {
    --bg: #070708; --bg2: #0d0d10; --bg3: #141416;
    --surface: rgba(255,255,255,0.03);
    --surface-hover: rgba(255,255,255,0.055);
    --border: rgba(255,255,255,0.08);
    --border-strong: rgba(255,255,255,0.14);
    --text: #ffffff; --text-2: #c7c7cc; --text-3: #8e8e93; --text-4: #3a3a3c;
    background: #070708; color: #ffffff;
  }

  [data-theme-reg="light"] {
    --bg: #f5f5f7; --bg2: #ffffff; --bg3: #ebebef;
    --surface: rgba(0,0,0,0.03);
    --surface-hover: rgba(0,0,0,0.055);
    --border: rgba(0,0,0,0.08);
    --border-strong: rgba(0,0,0,0.14);
    --text: #070708; --text-2: #3a3a3c; --text-3: #6e6e73; --text-4: #c7c7cc;
    background: #f5f5f7; color: #070708;
  }

  .reg-nav {
    position: sticky; top: 0; left: 0; right: 0; z-index: 100;
    padding: 0 40px; height: 58px;
    display: flex; align-items: center; justify-content: space-between;
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    transition: background 0.3s;
  }
  [data-theme-reg="dark"] .reg-nav { background: rgba(7,7,8,0.9); }
  [data-theme-reg="light"] .reg-nav { background: rgba(245,245,247,0.92); }

  .reg-nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .reg-logo-text {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 15px; font-weight: 800; color: var(--text); letter-spacing: -0.3px;
  }
  .reg-nav-right { display: flex; align-items: center; gap: 10px; }
  .reg-theme-btn {
    width: 32px; height: 32px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--surface);
    color: var(--text-3); display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.15s;
  }
  .reg-theme-btn:hover { background: var(--surface-hover); color: var(--text); }
  .reg-nav-secure {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--text-3); font-weight: 500;
  }

  .reg-page-wrap { max-width: 860px; margin: 0 auto; padding: 48px 24px 80px; }

  .reg-form-header { text-align: center; margin-bottom: 40px; }
  .reg-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; padding: 5px 14px;
    font-size: 12px; font-weight: 600; color: var(--text-3); margin-bottom: 20px;
  }
  .reg-eyebrow-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--green);
    animation: regPulse 2s infinite;
  }
  @keyframes regPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
  .reg-form-header h1 {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: clamp(28px,5vw,44px); font-weight: 900;
    letter-spacing: -1.5px; line-height: 1.1; margin-bottom: 12px;
  }
  .reg-form-header h1 em {
    font-style: normal;
    background: linear-gradient(135deg,#4d9fff,#7c3aed);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .reg-form-header p { font-size: 16px; color: var(--text-3); max-width: 480px; margin: 0 auto; }

  .reg-steps-bar {
    display: flex; align-items: center; justify-content: center;
    gap: 0; margin-bottom: 40px; position: relative;
  }
  .reg-step-item { display: flex; flex-direction: column; align-items: center; position: relative; z-index: 1; }
  .reg-step-circle {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 800;
    border: 2px solid var(--border); background: var(--bg2); color: var(--text-3);
    transition: all 0.3s; position: relative; z-index: 1;
  }
  .reg-step-circle.done { background: var(--green); border-color: var(--green); color: white; }
  .reg-step-circle.active { background: var(--blue); border-color: var(--blue); color: white; box-shadow: 0 0 0 4px var(--blue-light); }
  .reg-step-label { font-size: 10.5px; font-weight: 600; color: var(--text-3); margin-top: 6px; white-space: nowrap; transition: color 0.3s; }
  .reg-step-label.active { color: var(--blue); }
  .reg-step-label.done { color: var(--green); }
  .reg-step-line { width: 64px; height: 2px; background: var(--border); margin-bottom: 22px; transition: background 0.3s; flex-shrink: 0; }
  .reg-step-line.done { background: var(--green); }

  .reg-form-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 16px; }
  .reg-form-card-header { padding: 20px 28px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
  .reg-section-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .reg-section-num { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; font-weight: 800; color: var(--text-3); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 2px; }
  .reg-section-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 16px; font-weight: 800; letter-spacing: -0.3px; }
  .reg-form-card-body { padding: 28px; }

  .reg-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .reg-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .reg-grid-full { display: grid; grid-template-columns: 1fr; gap: 16px; }

  .reg-field { display: flex; flex-direction: column; gap: 6px; }
  .reg-field-label { font-size: 12px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.07em; display: flex; align-items: center; gap: 6px; }
  .reg-required { color: var(--red); font-size: 14px; line-height: 1; }
  .reg-optional { font-size: 10px; color: var(--text-4); font-weight: 500; text-transform: none; letter-spacing: 0; }
  .reg-field-input {
    width: 100%; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-sm); padding: 11px 14px; font-size: 14.5px;
    color: var(--text); font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s; appearance: none;
  }
  .reg-field-input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-light); }
  .reg-field-input::placeholder { color: var(--text-4); }
  .reg-field-hint { font-size: 12px; color: var(--text-3); line-height: 1.4; }
  .reg-field-error { font-size: 12px; color: var(--red); display: flex; align-items: center; gap: 4px; }

  .reg-select-wrap { position: relative; }
  .reg-select-wrap select.reg-field-input {
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px;
  }

  .reg-pwd-strength { margin-top: 6px; }
  .reg-pwd-bars { display: flex; gap: 4px; margin-bottom: 4px; }
  .reg-pwd-bar { height: 3px; flex: 1; border-radius: 2px; background: var(--border); transition: background 0.3s; }
  .reg-pwd-bar.weak { background: var(--red); }
  .reg-pwd-bar.medium { background: var(--amber); }
  .reg-pwd-bar.strong { background: var(--green); }
  .reg-pwd-label { font-size: 11px; font-weight: 600; color: var(--text-3); }
  .reg-pwd-hint { font-size: 12px; color: var(--text-3); display: flex; align-items: center; gap: 4px; margin-top: 4px; }

  .reg-ref-banner {
    display: flex; align-items: center; gap: 12px;
    background: var(--blue-light); border: 1px solid rgba(0,102,255,0.2);
    border-radius: var(--radius-sm); padding: 14px 16px;
    margin-bottom: 28px; font-size: 13.5px; color: var(--text-2);
  }
  .reg-ref-banner strong { color: var(--blue); }

  .reg-contract-scroll-hint {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    font-size: 12px; color: var(--text-3); margin-bottom: 16px; padding: 8px;
    background: var(--amber-light); border: 1px solid rgba(255,149,0,0.15);
    border-radius: var(--radius-sm);
  }
  .reg-contract-box {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-sm); height: 340px; overflow-y: auto;
    padding: 24px; margin-bottom: 20px; font-size: 13px;
    color: var(--text-2); line-height: 1.75; scroll-behavior: smooth;
  }
  .reg-contract-box h3 {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 800;
    color: var(--text); margin-bottom: 8px; margin-top: 20px;
  }
  .reg-contract-box h3:first-child { margin-top: 0; }
  .reg-contract-box p { margin-bottom: 12px; }

  .reg-check-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 14px 16px; border: 1px solid var(--border);
    border-radius: var(--radius-sm); margin-bottom: 10px;
    cursor: pointer; transition: all 0.15s;
  }
  .reg-check-item:hover { background: var(--surface-hover); border-color: var(--border-strong); }
  .reg-check-item.checked { background: var(--green-light); border-color: rgba(0,200,83,0.2); }
  .reg-custom-check {
    width: 20px; height: 20px; border-radius: 5px;
    border: 2px solid var(--border-strong); background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px; transition: all 0.15s;
  }
  .reg-custom-check.checked { background: var(--green); border-color: var(--green); }
  .reg-check-text { font-size: 14px; color: var(--text-2); line-height: 1.5; }
  .reg-check-text a { color: var(--blue); text-decoration: none; }
  .reg-check-text a:hover { text-decoration: underline; }
  .reg-check-text strong { color: var(--text); }

  .reg-firma-box {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-sm); padding: 20px; margin-top: 20px;
  }
  .reg-firma-title {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 800;
    margin-bottom: 6px; display: flex; align-items: center; gap: 8px;
  }
  .reg-firma-desc { font-size: 12.5px; color: var(--text-3); margin-bottom: 16px; line-height: 1.55; }
  .reg-firma-meta { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
  .reg-firma-meta-item { font-size: 11.5px; color: var(--text-3); display: flex; align-items: center; gap: 5px; }

  .reg-submit-area { margin-top: 24px; }
  .reg-submit-btn {
    width: 100%; padding: 16px; border-radius: var(--radius-sm);
    background: var(--blue); color: white;
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 16px; font-weight: 800;
    letter-spacing: -0.2px; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    transition: all 0.18s;
  }
  .reg-submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,102,255,0.3); }
  .reg-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
  .reg-submit-note {
    text-align: center; font-size: 12px; color: var(--text-3); margin-top: 12px;
    display: flex; align-items: center; justify-content: center; gap: 5px;
  }

  .reg-success-screen { text-align: center; padding: 64px 32px; }
  .reg-success-icon {
    width: 72px; height: 72px; border-radius: 50%;
    background: var(--green-light); border: 2px solid rgba(0,200,83,0.3);
    display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;
  }
  .reg-success-title {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 28px; font-weight: 900;
    letter-spacing: -0.5px; margin-bottom: 12px;
  }
  .reg-success-sub { font-size: 16px; color: var(--text-3); max-width: 440px; margin: 0 auto 32px; line-height: 1.6; }
  .reg-success-steps { max-width: 480px; margin: 0 auto; text-align: left; }
  .reg-success-step { display: flex; align-items: flex-start; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--border); }
  .reg-success-step:last-child { border-bottom: none; }
  .reg-ss-num {
    width: 28px; height: 28px; border-radius: 50%; background: var(--blue-light);
    color: var(--blue); font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .reg-ss-title { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
  .reg-ss-sub { font-size: 12.5px; color: var(--text-3); }

  .reg-pwd-rel { position: relative; }
  .reg-pwd-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-3); display: flex; align-items: center; }

  .reg-section-gap { margin-bottom: 24px; }

  @media (max-width: 640px) {
    .reg-nav { padding: 0 20px; }
    .reg-page-wrap { padding: 32px 16px 60px; }
    .reg-form-card-body { padding: 20px; }
    .reg-grid-2, .reg-grid-3 { grid-template-columns: 1fr; }
    .reg-step-line { width: 32px; }
    .reg-step-label { font-size: 9px; }
  }
`

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
  'Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Guanajuato',
  'Guerrero','Hidalgo','Jalisco','México','Michoacán','Morelos','Nayarit',
  'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
  'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
]

const BANCOS_MX = [
  'BBVA México','Banamex (Citibanamex)','Santander','Banorte','HSBC México',
  'Scotiabank México','Inbursa','Banco Azteca','BanBajío','Afirme',
  'Multiva','Mifel','Ve por Más','Bansí','Intercam','Otro'
]

const REGIMENES = [
  'Persona Física con Actividad Empresarial',
  'Régimen Simplificado de Confianza (RESICO)',
  'Régimen de Incorporación Fiscal (RIF)',
  'Honorarios (Actividades Profesionales)',
  'Arrendamiento',
  'Persona Moral',
]

function getPwdStrength(pwd) {
  if (!pwd) return 0
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  return score
}

export default function RegistroDistribuidorPage() {
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''
  const [theme, setTheme] = useState('dark')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showPwdConfirm, setShowPwdConfirm] = useState(false)
  const contractRef = useRef(null)
  const now = new Date()
  const firmaDate = now.toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' })
  const firmaHour = now.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })

  const [form, setForm] = useState({
    nombre: '', apellido_paterno: '', apellido_materno: '',
    fecha_nacimiento: '', genero: '', nacionalidad: 'Mexicana', curp: '',
    pais_residencia: 'México',
    email: '', email_confirm: '', telefono: '', whatsapp: '', estado: '', ciudad: '',
    rfc: '', regimen_fiscal: '', clabe: '', banco: '', titular_cuenta: '',
    instagram: '', facebook: '', tiktok: '', linkedin: '',
    password: '', password_confirm: '',
  })
  const [checks, setChecks] = useState({ contrato: false, terminos: false, privacidad: false, fiscal: false })
  const [firma, setFirma] = useState('')

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const allChecked = Object.values(checks).every(Boolean)
  const canSubmit = allChecked && firma.trim().length > 5 && !loading

  const pwdStrength = getPwdStrength(form.password)
  const pwdLabel = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'][pwdStrength] || ''
  const pwdBarClass = (i) => {
    if (i > pwdStrength) return ''
    if (pwdStrength <= 1) return 'weak'
    if (pwdStrength <= 2) return 'medium'
    return 'strong'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    try {
      await addDoc(collection(db, 'distributorApplications'), {
        ...form,
        refCode,
        firma,
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      setSubmitted(true)
    } catch (err) {
      console.error('Error submitting distributor application:', err)
    } finally {
      setLoading(false)
    }
  }

  // Determine step states for progress bar
  const stepStates = [
    'active','','','','',''
  ]

  return (
    <div data-theme-reg={theme} style={{ minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav className="reg-nav">
        <a className="reg-nav-logo" href="/">
          <img src="/logo.png" alt="Flow Hub CRM" style={{ height: '28px', objectFit: 'contain' }} />
          <span className="reg-logo-text">Flow Hub CRM</span>
        </a>
        <div className="reg-nav-right">
          <div className="reg-nav-secure">
            <Lock size={13} color="var(--green)" />
            Conexión segura
          </div>
          <button
            className="reg-theme-btn"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </nav>

      {/* PAGE */}
      <div className="reg-page-wrap">

        {submitted ? (
          /* SUCCESS SCREEN */
          <div className="reg-success-screen">
            <div className="reg-success-icon">
              <CheckCircle size={32} color="var(--green)" />
            </div>
            <div className="reg-success-title">¡Solicitud enviada!</div>
            <p className="reg-success-sub">
              Tu registro fue recibido con éxito. El equipo de Flow Hub CRM revisará tu información
              y te enviará un correo con tus credenciales de acceso.
            </p>
            <div className="reg-success-steps">
              {[
                { title: 'Revisión de documentos', sub: 'El equipo verifica tu RFC, CLABE y datos fiscales — 24 a 48 horas hábiles' },
                { title: 'Acceso a tu portal', sub: 'Recibirás un email con tus credenciales para acceder al portal de distribuidores' },
                { title: 'Carga de documentos oficiales', sub: 'Dentro del portal, sube tu constancia fiscal y comprobante bancario' },
                { title: 'Verificación y activación', sub: 'Una vez verificado, te habilitamos acceso completo y tu Pipeline de clientes Flow Hub' },
              ].map((s, i) => (
                <div className="reg-success-step" key={i}>
                  <div className="reg-ss-num">{i + 1}</div>
                  <div>
                    <div className="reg-ss-title">{s.title}</div>
                    <div className="reg-ss-sub">{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div className="reg-form-header">
              <div className="reg-eyebrow">
                <div className="reg-eyebrow-dot" />
                Registro de Distribuidor Oficial
              </div>
              <h1>Únete como<br /><em>distribuidor Flow Hub</em></h1>
              <p>Completa el formulario para activar tu cuenta como comisionista mercantil y acceder a tu portal de distribuidores.</p>
            </div>

            {/* REF BANNER */}
            {refCode && (
              <div className="reg-ref-banner">
                <UserCheck size={20} color="var(--blue)" style={{ flexShrink: 0 }} />
                <div>Fuiste invitado con el código <strong>{refCode}</strong>. Tu registro quedará vinculado a este distribuidor.</div>
              </div>
            )}

            {/* PROGRESS STEPS */}
            <div className="reg-steps-bar">
              {['Datos personales','Contacto','Datos fiscales','Redes sociales','Acceso','Contrato'].map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="reg-step-item">
                    <div className={`reg-step-circle ${i === 0 ? 'active' : ''}`}>{i + 1}</div>
                    <div className={`reg-step-label ${i === 0 ? 'active' : ''}`}>{label}</div>
                  </div>
                  {i < 5 && <div className="reg-step-line" />}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit}>

              {/* SECTION 1 — DATOS PERSONALES */}
              <div className="reg-form-card">
                <div className="reg-form-card-header">
                  <div className="reg-section-icon" style={{ background: 'var(--blue-light)' }}>
                    <User size={18} color="var(--blue)" />
                  </div>
                  <div>
                    <div className="reg-section-num">Sección 01</div>
                    <div className="reg-section-title">Datos personales</div>
                  </div>
                </div>
                <div className="reg-form-card-body">
                  <div className="reg-grid-2 reg-section-gap">
                    <div className="reg-field">
                      <label className="reg-field-label">Nombre(s) <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="text" value={form.nombre} onChange={set('nombre')} placeholder="Ej. Agustín" required />
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">Apellido paterno <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="text" value={form.apellido_paterno} onChange={set('apellido_paterno')} placeholder="Ej. Lozano" required />
                    </div>
                  </div>
                  <div className="reg-grid-3 reg-section-gap">
                    <div className="reg-field">
                      <label className="reg-field-label">Apellido materno <span className="reg-optional">(opcional)</span></label>
                      <input className="reg-field-input" type="text" value={form.apellido_materno} onChange={set('apellido_materno')} placeholder="Ej. García" />
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">Fecha de nacimiento <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="date" value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')} required />
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">Género <span className="reg-required">*</span></label>
                      <div className="reg-select-wrap">
                        <select className="reg-field-input" value={form.genero} onChange={set('genero')} required>
                          <option value="">Selecciona...</option>
                          <option>Masculino</option>
                          <option>Femenino</option>
                          <option>Prefiero no especificar</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="reg-grid-3">
                    <div className="reg-field">
                      <label className="reg-field-label">Nacionalidad <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="text" value={form.nacionalidad} onChange={set('nacionalidad')} placeholder="Ej. Mexicana" required />
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">CURP <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="text" value={form.curp} onChange={e => setForm(f => ({ ...f, curp: e.target.value.toUpperCase() }))} placeholder="18 caracteres" maxLength={18} required style={{ textTransform: 'uppercase' }} />
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">País de residencia <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="text" value={form.pais_residencia} onChange={set('pais_residencia')} placeholder="Ej. México" required />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2 — DATOS DE CONTACTO */}
              <div className="reg-form-card">
                <div className="reg-form-card-header">
                  <div className="reg-section-icon" style={{ background: 'var(--purple)', opacity: 0.85 }}>
                    <Mail size={18} color="white" />
                  </div>
                  <div>
                    <div className="reg-section-num">Sección 02</div>
                    <div className="reg-section-title">Datos de contacto</div>
                  </div>
                </div>
                <div className="reg-form-card-body">
                  <div className="reg-grid-2 reg-section-gap">
                    <div className="reg-field">
                      <label className="reg-field-label">Correo electrónico <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="email" value={form.email} onChange={set('email')} placeholder="correo@ejemplo.com" required />
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">Confirmar correo <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="email" value={form.email_confirm} onChange={set('email_confirm')} placeholder="Repite tu correo" required />
                    </div>
                  </div>
                  <div className="reg-grid-2 reg-section-gap">
                    <div className="reg-field">
                      <label className="reg-field-label">Teléfono <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="tel" value={form.telefono} onChange={set('telefono')} placeholder="+52 81 0000 0000" required />
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">WhatsApp <span className="reg-optional">(si es diferente)</span></label>
                      <input className="reg-field-input" type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+52 81 0000 0000" />
                    </div>
                  </div>
                  <div className="reg-grid-2">
                    <div className="reg-field">
                      <label className="reg-field-label">Estado <span className="reg-required">*</span></label>
                      <div className="reg-select-wrap">
                        <select className="reg-field-input" value={form.estado} onChange={set('estado')} required>
                          <option value="">Selecciona estado...</option>
                          {ESTADOS_MX.map(e => <option key={e}>{e}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">Ciudad <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="text" value={form.ciudad} onChange={set('ciudad')} placeholder="Ej. Monterrey" required />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3 — DATOS FISCALES */}
              <div className="reg-form-card">
                <div className="reg-form-card-header">
                  <div className="reg-section-icon" style={{ background: 'var(--green-light)' }}>
                    <CreditCard size={18} color="var(--green)" />
                  </div>
                  <div>
                    <div className="reg-section-num">Sección 03</div>
                    <div className="reg-section-title">Datos fiscales y bancarios</div>
                  </div>
                </div>
                <div className="reg-form-card-body">
                  <div className="reg-grid-2 reg-section-gap">
                    <div className="reg-field">
                      <label className="reg-field-label">RFC <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="text" value={form.rfc} onChange={e => setForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))} placeholder="13 caracteres" maxLength={13} required style={{ textTransform: 'uppercase' }} />
                      <span className="reg-field-hint">13 caracteres (persona física con homoclave)</span>
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">Régimen fiscal <span className="reg-required">*</span></label>
                      <div className="reg-select-wrap">
                        <select className="reg-field-input" value={form.regimen_fiscal} onChange={set('regimen_fiscal')} required>
                          <option value="">Selecciona régimen...</option>
                          {REGIMENES.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="reg-grid-2 reg-section-gap">
                    <div className="reg-field">
                      <label className="reg-field-label">CLABE interbancaria <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="text" value={form.clabe} onChange={set('clabe')} placeholder="18 dígitos" maxLength={18} required />
                      <span className="reg-field-hint">18 dígitos — aquí recibirás tus comisiones</span>
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">Banco <span className="reg-required">*</span></label>
                      <div className="reg-select-wrap">
                        <select className="reg-field-input" value={form.banco} onChange={set('banco')} required>
                          <option value="">Selecciona banco...</option>
                          {BANCOS_MX.map(b => <option key={b}>{b}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="reg-grid-full">
                    <div className="reg-field">
                      <label className="reg-field-label">Titular de la cuenta <span className="reg-required">*</span></label>
                      <input className="reg-field-input" type="text" value={form.titular_cuenta} onChange={set('titular_cuenta')} placeholder="Nombre completo como aparece en el estado de cuenta" required />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4 — REDES SOCIALES */}
              <div className="reg-form-card">
                <div className="reg-form-card-header">
                  <div className="reg-section-icon" style={{ background: 'rgba(124,58,237,0.12)' }}>
                    <Instagram size={18} color="var(--purple)" />
                  </div>
                  <div>
                    <div className="reg-section-num">Sección 04</div>
                    <div className="reg-section-title">Redes sociales</div>
                  </div>
                </div>
                <div className="reg-form-card-body">
                  <div className="reg-grid-2">
                    <div className="reg-field">
                      <label className="reg-field-label">Instagram <span className="reg-optional">(opcional)</span></label>
                      <input className="reg-field-input" type="text" value={form.instagram} onChange={set('instagram')} placeholder="@usuario" />
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">Facebook <span className="reg-optional">(opcional)</span></label>
                      <input className="reg-field-input" type="text" value={form.facebook} onChange={set('facebook')} placeholder="facebook.com/usuario" />
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">TikTok <span className="reg-optional">(opcional)</span></label>
                      <input className="reg-field-input" type="text" value={form.tiktok} onChange={set('tiktok')} placeholder="@usuario" />
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">LinkedIn <span className="reg-optional">(opcional)</span></label>
                      <input className="reg-field-input" type="text" value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/usuario" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 5 — ACCESO AL PORTAL */}
              <div className="reg-form-card">
                <div className="reg-form-card-header">
                  <div className="reg-section-icon" style={{ background: 'var(--amber-light)' }}>
                    <KeyRound size={18} color="var(--amber)" />
                  </div>
                  <div>
                    <div className="reg-section-num">Sección 05</div>
                    <div className="reg-section-title">Acceso al portal</div>
                  </div>
                </div>
                <div className="reg-form-card-body">
                  <div className="reg-grid-full reg-section-gap">
                    <div className="reg-field">
                      <label className="reg-field-label">Tu correo de acceso</label>
                      <input className="reg-field-input" type="email" value={form.email} readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                      <span className="reg-field-hint">Usarás este correo para iniciar sesión en el portal.</span>
                    </div>
                  </div>
                  <div className="reg-grid-2">
                    <div className="reg-field">
                      <label className="reg-field-label">Contraseña <span className="reg-required">*</span></label>
                      <div className="reg-pwd-rel">
                        <input
                          className="reg-field-input"
                          type={showPwd ? 'text' : 'password'}
                          value={form.password}
                          onChange={set('password')}
                          placeholder="Crea una contraseña segura"
                          required
                          style={{ paddingRight: 40 }}
                        />
                        <button type="button" className="reg-pwd-eye" onClick={() => setShowPwd(v => !v)}>
                          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {form.password && (
                        <div className="reg-pwd-strength">
                          <div className="reg-pwd-bars">
                            {[1,2,3,4].map(i => (
                              <div key={i} className={`reg-pwd-bar ${pwdBarClass(i)}`} />
                            ))}
                          </div>
                          <div className="reg-pwd-label">Seguridad: {pwdLabel}</div>
                        </div>
                      )}
                      <div className="reg-pwd-hint">
                        <AlertCircle size={12} />
                        Mínimo 8 caracteres requeridos
                      </div>
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">Confirmar contraseña <span className="reg-required">*</span></label>
                      <div className="reg-pwd-rel">
                        <input
                          className="reg-field-input"
                          type={showPwdConfirm ? 'text' : 'password'}
                          value={form.password_confirm}
                          onChange={set('password_confirm')}
                          placeholder="Repite tu contraseña"
                          required
                          style={{ paddingRight: 40 }}
                        />
                        <button type="button" className="reg-pwd-eye" onClick={() => setShowPwdConfirm(v => !v)}>
                          {showPwdConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {form.password_confirm && form.password !== form.password_confirm && (
                        <div className="reg-field-error">
                          <AlertCircle size={12} /> Las contraseñas no coinciden
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 6 — CONTRATO Y FIRMA */}
              <div className="reg-form-card">
                <div className="reg-form-card-header">
                  <div className="reg-section-icon" style={{ background: 'var(--green-light)' }}>
                    <FileCheck size={18} color="var(--green)" />
                  </div>
                  <div>
                    <div className="reg-section-num">Sección 06 — Final</div>
                    <div className="reg-section-title">Contrato y firma digital</div>
                  </div>
                </div>
                <div className="reg-form-card-body">
                  <div className="reg-contract-scroll-hint">
                    <ArrowDown size={13} color="var(--amber)" />
                    Debes leer el contrato completo antes de firmar
                  </div>

                  {/* CONTRACT */}
                  <div className="reg-contract-box" ref={contractRef}>
                    <h3>CONTRATO DE COMISIONISTA MERCANTIL</h3>
                    <p>El presente contrato de comisionista mercantil (en adelante, "el Contrato") se celebra entre <strong>Qubit Corp S.A. de C.V.</strong>, en adelante denominada "Flow Hub CRM" o "la Empresa", y la persona física que complete y firme este formulario en línea, en adelante denominada "el Comisionista" o "el Distribuidor".</p>
                    <h3>PRIMERO — OBJETO DEL CONTRATO</h3>
                    <p>Flow Hub CRM autoriza al Comisionista para promover, gestionar y concretar la contratación de servicios de software CRM bajo la marca "Flow Hub CRM", en la modalidad de comisionista mercantil independiente. El Comisionista actuará en nombre propio y por cuenta de Flow Hub CRM únicamente para efectos de la concreción de las ventas aquí descritas.</p>
                    <p>El presente contrato no establece ninguna relación laboral, de sociedad, agencia exclusiva o representación legal entre las partes. El Comisionista es un empresario independiente y como tal asumirá todas las responsabilidades fiscales, de seguridad social y legales derivadas de su actividad.</p>
                    <h3>SEGUNDO — OBLIGACIONES DEL COMISIONISTA</h3>
                    <p>El Comisionista se obliga a: (a) Promover los servicios de Flow Hub CRM de manera profesional y ética; (b) No realizar declaraciones falsas o engañosas sobre los servicios, precios o condiciones ofrecidas por la Empresa; (c) Entregar a Flow Hub CRM toda la información requerida para el alta de nuevos clientes; (d) Emitir facturas electrónicas (CFDI) válidas a Flow Hub CRM por cada comisión devengada; (e) Mantener actualizados sus datos fiscales y bancarios en el portal de distribuidores; (f) Cumplir con todas las disposiciones fiscales aplicables en su régimen fiscal registrado ante el SAT; (g) No ceder, sublicenciar ni transferir los derechos y obligaciones de este contrato sin autorización previa y por escrito de Flow Hub CRM.</p>
                    <h3>TERCERO — OBLIGACIONES DE FLOW HUB CRM</h3>
                    <p>Flow Hub CRM se obliga a: (a) Proporcionar al Comisionista los materiales de venta, capacitación y acceso al portal de distribuidores necesarios para el ejercicio de su actividad; (b) Pagar las comisiones devengadas conforme a la tabla de bonos vigente y en los plazos establecidos, previa recepción de la factura CFDI correspondiente; (c) Mantener disponible el portal del distribuidor con información actualizada sobre sus ventas, comisiones y documentos.</p>
                    <h3>CUARTO — COMISIONES Y CONDICIONES DE PAGO</h3>
                    <p>Las comisiones a las que tiene derecho el Comisionista se determinarán conforme a la tabla de bonos vigente en el Programa de Distribuidores de Flow Hub CRM, la cual podrá ser modificada por la Empresa con previo aviso de 30 días naturales al Comisionista.</p>
                    <p>El pago de comisiones estará condicionado a: (i) La verificación completa del Comisionista por parte de Flow Hub CRM; (ii) La recepción de factura CFDI válida emitida por el Comisionista; (iii) El cumplimiento de los requisitos de la tabla de velocidad de pago vigente. Flow Hub CRM no será responsable de demoras en el pago ocasionadas por datos bancarios incorrectos o facturas con errores.</p>
                    <h3>QUINTO — CONFIDENCIALIDAD</h3>
                    <p>El Comisionista se compromete a mantener en estricta confidencialidad toda la información de carácter comercial, técnico, financiero o de cualquier otra naturaleza que reciba de Flow Hub CRM en el ejercicio de sus funciones. Esta obligación permanecerá vigente durante la vigencia del contrato y por un período de dos (2) años después de su terminación.</p>
                    <h3>SEXTO — PROPIEDAD INTELECTUAL</h3>
                    <p>Todos los materiales de venta, presentaciones, logotipos, marcas, software y cualquier otro activo intelectual proporcionados por Flow Hub CRM son y seguirán siendo propiedad exclusiva de Qubit Corp S.A. de C.V. El Comisionista podrá utilizar dichos materiales únicamente para los fines establecidos en este Contrato y de acuerdo con las directrices de la Empresa.</p>
                    <h3>SÉPTIMO — VIGENCIA Y TERMINACIÓN</h3>
                    <p>El presente Contrato tendrá vigencia indefinida a partir de la fecha de su aceptación digital. Cualquiera de las partes podrá dar por terminado el presente Contrato mediante notificación por escrito con 15 días naturales de anticipación. La terminación del Contrato no afectará el derecho del Comisionista a percibir comisiones devengadas con anterioridad a la fecha de terminación, siempre que se hayan cumplido todos los requisitos de facturación y verificación.</p>
                    <h3>OCTAVO — FIRMA DIGITAL Y VALIDEZ</h3>
                    <p>La aceptación de este contrato mediante el sistema en línea de Flow Hub CRM, incluyendo el registro del nombre completo del Comisionista, la dirección IP de conexión, la fecha y hora de aceptación, y la marca de verificación en el formulario de registro, constituye una firma electrónica con plena validez legal conforme a lo establecido en el Código de Comercio de los Estados Unidos Mexicanos y la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</p>
                    <h3>NOVENO — JURISDICCIÓN Y LEY APLICABLE</h3>
                    <p>Para la interpretación y cumplimiento del presente Contrato, las partes se someten expresamente a las leyes vigentes en los Estados Unidos Mexicanos y a la jurisdicción de los tribunales competentes de la ciudad de Monterrey, Nuevo León, renunciando a cualquier otro fuero que pudiera corresponderles en razón de sus domicilios presentes o futuros.</p>
                    <p style={{ marginTop: 16, fontWeight: 600, color: 'var(--text)' }}>Versión 1.0 — Vigente desde el 1 de Enero de 2026 — Qubit Corp S.A. de C.V.</p>
                  </div>

                  {/* CHECKBOXES */}
                  <div>
                    {[
                      { key: 'contrato', label: <><strong>He leído, entendido y acepto el Contrato de Comisionista Mercantil</strong> en su totalidad, incluyendo todas sus cláusulas y condiciones.</> },
                      { key: 'terminos', label: <>Acepto los <a href="/terms" onClick={e => e.stopPropagation()}>Términos y Condiciones</a> del servicio de Flow Hub CRM y reconozco que mi actividad como distribuidor está sujeta a las políticas de la Empresa.</> },
                      { key: 'privacidad', label: <>He leído y acepto el <a href="/privacy" onClick={e => e.stopPropagation()}>Aviso de Privacidad</a>. Autorizo a Flow Hub CRM a tratar mis datos personales conforme a lo establecido en la Ley Federal de Protección de Datos Personales.</> },
                      { key: 'fiscal', label: <>Declaro bajo protesta de decir verdad que los datos fiscales proporcionados (RFC, CLABE y régimen fiscal) son correctos y corresponden a mi situación fiscal actual ante el SAT.</> },
                    ].map(({ key, label }) => (
                      <div
                        key={key}
                        className={`reg-check-item ${checks[key] ? 'checked' : ''}`}
                        onClick={() => setChecks(c => ({ ...c, [key]: !c[key] }))}
                      >
                        <div className={`reg-custom-check ${checks[key] ? 'checked' : ''}`}>
                          {checks[key] && <Check size={13} color="white" />}
                        </div>
                        <div className="reg-check-text">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* FIRMA DIGITAL */}
                  <div className="reg-firma-box">
                    <div className="reg-firma-title">
                      <PenLine size={16} color="var(--blue)" />
                      Firma digital — Nombre como aparece en tu identificación oficial
                    </div>
                    <div className="reg-firma-desc">
                      Al escribir tu nombre completo a continuación y enviar este formulario, estás firmando digitalmente este contrato. Esta firma tiene la misma validez legal que una firma autógrafa conforme al Código de Comercio mexicano.
                    </div>
                    <div className="reg-field">
                      <label className="reg-field-label">
                        Nombre completo (firma digital) <span className="reg-required">*</span>
                      </label>
                      <input
                        className="reg-field-input"
                        type="text"
                        value={firma}
                        onChange={e => setFirma(e.target.value)}
                        placeholder="Escribe tu nombre completo exactamente como en tu INE"
                        required
                        style={{ fontSize: 16 }}
                      />
                    </div>
                    <div className="reg-firma-meta">
                      <div className="reg-firma-meta-item">
                        <Calendar size={13} color="var(--green)" />
                        <span>{firmaDate}</span>
                      </div>
                      <div className="reg-firma-meta-item">
                        <Clock size={13} color="var(--blue)" />
                        <span>{firmaHour}</span>
                      </div>
                      <div className="reg-firma-meta-item">
                        <Shield size={13} color="var(--purple)" />
                        IP registrada automáticamente
                      </div>
                    </div>
                  </div>

                  {/* SUBMIT */}
                  <div className="reg-submit-area">
                    <button type="submit" className="reg-submit-btn" disabled={!canSubmit}>
                      <Send size={18} />
                      {loading ? 'Enviando solicitud...' : 'Enviar solicitud y crear mi cuenta'}
                    </button>
                    <div className="reg-submit-note">
                      <Lock size={13} color="var(--green)" />
                      Tu información está encriptada y protegida · Flow Hub CRM verificará tu cuenta en 24-48 horas hábiles
                    </div>
                  </div>
                </div>
              </div>

            </form>
          </>
        )}
      </div>
    </div>
  )
}
