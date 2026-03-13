import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy, doc, setDoc,
  updateDoc, deleteDoc, addDoc, serverTimestamp, getDoc, getDocs
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Target, MessageSquare, Bot, Clapperboard, Globe, BarChart, Gift, Zap, Building2, Handshake, Package, Key, ClipboardList, Save, Download, CreditCard, Hourglass, LogOut, Smartphone, Check, Calendar, Ticket, ChevronDown, ChevronRight, Edit2, Trash2, X, Plus } from 'lucide-react'
import ImplementationPortal from './ImplementationPortal'
import SupportTickets from './SupportTickets'
import OnboardingResponses from './OnboardingResponses'

// ─── DIAGNOSTICO CONFIG ───
const DEFAULT_DIAG_CATEGORIES = [
  {
    id: 'proceso', name: 'Proceso comercial', color: '#0066ff',
    questions: [
      'Tengo claro cuáles son los pasos que sigue un prospecto desde que me contacta hasta que toma una decisión.',
      'Cuando un prospecto no responde, tengo un proceso definido para darle seguimiento sin perder el hilo.',
      'Sé exactamente en qué punto del proceso se me pierden más prospectos.',
      'Registro la información de mis prospectos en algún lugar antes de que se me olvide.',
      'Mis cierres de venta son el resultado de un proceso consistente, no de la improvisación.',
      'Cuando termino una conversación con un prospecto, siempre queda claro cuál es el siguiente paso.',
      'Tengo un tiempo de respuesta promedio definido para cuando alguien me escribe por primera vez.',
      'Distingo claramente entre prospectos que tienen potencial real y los que no van a comprar.',
      'Cuando un prospecto dice "lo pienso", tengo una respuesta y una estrategia preparada.',
      'Puedo describir mi proceso de ventas en menos de cinco pasos sin esfuerzo.',
    ]
  },
  {
    id: 'producto', name: 'Conocimiento del producto', color: '#7c3aed',
    questions: [
      'Puedo explicar los beneficios de mi producto con claridad y confianza sin necesitar apoyarme en materiales.',
      'Conozco la diferencia entre cada producto o servicio de mi catálogo y sé cuál recomendar según el perfil del prospecto.',
      'Tengo respuestas preparadas para las objeciones más frecuentes que recibo sobre lo que vendo.',
      'Sé argumentar el precio de mi producto en términos de valor, no de costo.',
      'Cuando un prospecto compara mi producto con otra opción, sé cómo posicionarlo sin hablar mal de la competencia.',
      'Conozco los componentes o características clave de mi producto y puedo explicarlos de forma sencilla.',
      'Entiendo el modelo de negocio detrás de lo que vendo lo suficientemente bien como para explicárselo a alguien desde cero.',
      'Sé qué tipo de resultados puede esperar un cliente nuevo en sus primeras semanas usando mi producto.',
      'Tengo claridad sobre qué diferencia mi producto de otras opciones que existen en el mercado hoy.',
      'Me siento seguro respondiendo preguntas difíciles o técnicas sobre mi producto sin dudar.',
    ]
  },
  {
    id: 'cliente', name: 'Conocimiento del cliente ideal', color: '#00c853',
    questions: [
      'Tengo claro el perfil de la persona que tiene más probabilidades de comprar lo que vendo.',
      'Sé qué problema específico resuelve mi producto en la vida de mi cliente ideal.',
      'Conozco las razones emocionales que llevan a mi cliente a tomar la decisión de compra.',
      'Puedo identificar rápidamente si un prospecto encaja con mi cliente ideal o no.',
      'Sé en qué canales o espacios se encuentra la mayoría de mis clientes potenciales.',
      'Entiendo qué objeciones son típicas de mi cliente ideal y por qué las tiene.',
      'Conozco el nivel de ingreso o contexto económico promedio de las personas a las que le vendo.',
      'Sé qué otras soluciones ha probado mi cliente ideal antes de llegar a mí.',
      'Puedo describir a mi cliente ideal con suficiente detalle como para que alguien más lo identifique por mí.',
      'Distingo claramente entre el cliente que compra una vez y el que se convierte en cliente recurrente.',
    ]
  },
  {
    id: 'herramientas', name: 'Herramientas y hábitos actuales', color: '#ff9500',
    questions: [
      'Tengo un lugar definido donde registro la información de cada prospecto con el que hablo.',
      'Reviso mis pendientes y conversaciones abiertas al inicio de cada día de trabajo.',
      'Cuando termino mi jornada, sé exactamente qué quedó pendiente y qué sigue al día siguiente.',
      'Uso algún sistema para recordarme dar seguimiento a prospectos sin depender de mi memoria.',
      'Tengo un horario de trabajo definido y lo respeto la mayoría de los días.',
      'Cuando recibo un mensaje de un prospecto, tengo el hábito de responder dentro de un tiempo razonable.',
      'Mi información de prospectos está organizada de una forma que puedo consultar fácilmente en cualquier momento.',
      'Separo el tiempo de prospección del tiempo de seguimiento para no mezclar tareas.',
      'Llevo algún registro de mis resultados semanales aunque sea de forma básica.',
      'Siento que mis herramientas actuales me ayudan a vender más, no me generan trabajo extra.',
    ]
  },
  {
    id: 'digital', name: 'Canales y presencia digital', color: '#00b8d9',
    questions: [
      'Tengo perfiles activos en las redes sociales donde se encuentra mi cliente ideal.',
      'Publico contenido de forma regular y con una intención clara de atraer prospectos.',
      'Mis perfiles en redes sociales comunican con claridad qué vendo y a quién le puede servir.',
      'Recibo prospectos de forma orgánica gracias a mi presencia digital, sin tener que buscarlos siempre yo.',
      'Sé responder mensajes directos de prospectos de forma oportuna desde cualquier canal donde me contacten.',
      'Tengo una forma clara de llevar a un prospecto desde una red social hasta una conversación de venta.',
      'Uso WhatsApp de forma profesional y separada de mi uso personal para atender prospectos.',
      'Sé qué tipo de contenido genera más interés y conversaciones entre mi audiencia.',
      'Tengo claridad sobre en qué canal me llegan más prospectos de calidad actualmente.',
      'Cuando invierto en publicidad pagada, tengo claro qué quiero lograr y cómo medir si funcionó.',
    ]
  },
  {
    id: 'mentalidad', name: 'Mentalidad y disciplina', color: '#ff3b30',
    questions: [
      'Mantengo un ritmo de trabajo constante incluso en semanas donde los resultados no son los esperados.',
      'Cuando un prospecto me dice que no, lo proceso rápido y continúo sin que afecte mi energía.',
      'Invierto tiempo regularmente en aprender y mejorar mis habilidades de venta.',
      'Tengo metas claras de ventas y las reviso con frecuencia para saber si voy bien.',
      'Priorizo las tareas que generan ingresos antes que las que solo generan actividad.',
      'Soy consistente en mis hábitos de trabajo independientemente de cómo me sienta ese día.',
      'Cuando algo no funciona, analizo qué salió mal antes de seguir haciendo lo mismo.',
      'Me organizo con suficiente anticipación para no trabajar siempre apagando incendios.',
      'Confío en el proceso y no abandono una estrategia antes de darle el tiempo suficiente para funcionar.',
      'Siento que mi mentalidad actual es un activo para mis resultados, no un obstáculo.',
    ]
  }
]

const SCALE_LABELS_DIAG = ['', 'Nunca', 'Casi nunca', 'A veces', 'Casi siempre', 'Siempre']
const SCALE_COLORS_DIAG = ['', '#ff3b30', '#ff9500', '#ffcc00', '#00c853', '#0066ff']

function diagScoreLevel(score, min, max) {
  const pct = (score - min) / (max - min)
  if (pct < 0.2) return { label: 'Inicial', color: '#ff3b30' }
  if (pct < 0.4) return { label: 'En desarrollo', color: '#ff9500' }
  if (pct < 0.6) return { label: 'Intermedio', color: '#ffcc00' }
  if (pct < 0.8) return { label: 'Avanzado', color: '#00c853' }
  return { label: 'Profesional', color: '#0066ff' }
}

// ─── SUPERADMIN CREDENTIALS (change as needed) ───
const SA_EMAIL = 'admin@qubitcorp.mx'
const SA_PASSWORD = 'QubitAdmin2025!'

// ─── MODULES CATALOG ───
const MODULES_CATALOG = [
  { id: 'pipeline', icon: <Target size={16} strokeWidth={2} />, name: 'Pipeline de Ventas', tag: 'CRM' },
  { id: 'inbox', icon: <MessageSquare size={16} strokeWidth={2} />, name: 'Inbox Unificado', tag: 'Meta' },
  { id: 'agent', icon: <Bot size={16} strokeWidth={2} />, name: 'Agente IA de Ventas', tag: 'IA' },
  { id: 'content', icon: <Clapperboard size={16} strokeWidth={2} />, name: 'Content Studio', tag: 'Exclusivo' },
  { id: 'landing', icon: <Globe size={16} strokeWidth={2} />, name: 'Landing Pages', tag: 'Conversión' },
  { id: 'analytics', icon: <BarChart size={16} strokeWidth={2} />, name: 'Analytics & Reportes', tag: 'Data' },
  { id: 'referrals', icon: <Gift size={16} strokeWidth={2} />, name: 'Programa de Referidos', tag: 'Growth' },
]

const PLANS = [
  { id: 'starter', name: 'Starter', color: '#8e8e93' },
  { id: 'pro', name: 'Pro', color: '#0066ff' },
  { id: 'enterprise', name: 'Enterprise', color: '#7c3aed' },
]

// ─── STYLES ───
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600&display=swap');

  .sa-root *, .sa-root *::before, .sa-root *::after { box-sizing: border-box; }

  .sa-root {
    font-family: 'Inter', sans-serif;
    background: #070708;
    color: white;
    min-height: 100vh;
    --black: #070708;
    --gray-1: #f5f5f7;
    --gray-2: #e8e8ed;
    --gray-3: #c7c7cc;
    --gray-4: #8e8e93;
    --gray-5: #3a3a3c;
    --gray-6: #1c1c1e;
    --blue: #0066ff;
    --green: #00c853;
    --purple: #7c3aed;
    --amber: #ff9500;
    --red: #ff3b30;
    --radius: 14px;
  }

  /* LOGIN */
  .sa-login {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: #070708;
    position: relative; overflow: hidden;
  }

  .sa-login::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 60% 60% at 20% 50%, rgba(0,102,255,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 40% 50% at 80% 30%, rgba(124,58,237,0.07) 0%, transparent 60%);
    pointer-events: none;
  }

  .sa-login-card {
    position: relative; z-index: 1;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 40px;
    width: 100%; max-width: 380px;
  }

  .sa-login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; justify-content: center; }

  .sa-logo-icon {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, #0066ff, #7c3aed);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
  }

  .sa-logo-text { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 19px; font-weight: 800; }
  .sa-logo-badge {
    font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
    background: rgba(124,58,237,0.15); color: #a78bfa;
    border: 1px solid rgba(124,58,237,0.25); border-radius: 5px; padding: 2px 7px;
  }

  .sa-login-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22px; font-weight: 900; text-align: center; margin-bottom: 4px; }
  .sa-login-sub { font-size: 14px; color: var(--gray-4); text-align: center; margin-bottom: 28px; }

  .sa-input {
    width: 100%;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 9px; padding: 11px 14px;
    font-size: 15px; color: white;
    font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.15s; margin-bottom: 10px;
  }

  .sa-input:focus { border-color: #0066ff; }
  .sa-input::placeholder { color: var(--gray-5); }

  .sa-btn-primary {
    width: 100%; padding: 12px;
    background: white; color: #070708;
    border: none; border-radius: 9px;
    font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: 'Inter', sans-serif;
    transition: all 0.15s; margin-top: 6px;
  }

  .sa-btn-primary:hover { background: #e8e8ed; transform: translateY(-1px); }
  .sa-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* LAYOUT */
  .sa-layout { display: flex; min-height: 100vh; }

  .sa-sidebar {
    width: 220px; min-width: 220px;
    background: #0d0d0f;
    border-right: 1px solid rgba(255,255,255,0.06);
    display: flex; flex-direction: column;
    position: sticky; top: 0; height: 100vh;
  }

  .sa-sidebar-header {
    padding: 20px 18px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .sa-nav { flex: 1; padding: 12px 10px; display: flex; flex-direction: column; gap: 2px; }

  .sa-nav-item {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 10px; border-radius: 8px;
    font-size: 14px; font-weight: 600; color: var(--gray-4);
    cursor: pointer; transition: all 0.15s; border: none;
    background: transparent; width: 100%; text-align: left;
    font-family: 'Inter', sans-serif;
  }

  .sa-nav-item:hover { background: rgba(255,255,255,0.05); color: white; }
  .sa-nav-item.active { background: rgba(255,255,255,0.08); color: white; }
  .sa-nav-icon { font-size: 16px; flex-shrink: 0; }

  .sa-nav-section {
    font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.8px;
    color: var(--gray-5); font-weight: 700; padding: 10px 10px 4px;
  }

  .sa-sidebar-footer {
    padding: 12px 10px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .sa-logout {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 7px;
    font-size: 14px; font-weight: 600; color: var(--gray-5);
    cursor: pointer; transition: all 0.15s; border: none;
    background: transparent; width: 100%; text-align: left;
    font-family: 'Inter', sans-serif;
  }

  .sa-logout:hover { color: var(--red); background: rgba(255,59,48,0.06); }

  /* MAIN */
  .sa-main { flex: 1; overflow-y: auto; background: #fdfdfd; color: #070708; }

  .sa-topbar {
    padding: 0 32px;
    height: 60px;
    border-bottom: 1px solid rgba(0,0,0,0.08);
    display: flex; align-items: center;
    background: rgba(253,253,253,0.95);
    position: sticky; top: 0; z-index: 40;
    gap: 12px;
  }

  .sa-topbar-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 17px; font-weight: 800; flex: 1; }
  .sa-topbar-sub { font-size: 14px; color: var(--gray-4); }

  .sa-content { padding: 28px 32px; max-width: 1100px; }

  /* CARDS */
  .sa-card {
    background: white;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .sa-card-header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    display: flex; align-items: center; gap: 10px;
  }

  .sa-card-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 800; flex: 1; }

  /* STATS */
  .sa-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }

  .sa-stat {
    background: white;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    border-radius: var(--radius);
    padding: 18px 20px;
  }

  .sa-stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gray-4); font-weight: 700; margin-bottom: 8px; }
  .sa-stat-value { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 28px; font-weight: 900; letter-spacing: -1px; }
  .sa-stat-sub { font-size: 13px; color: var(--gray-5); margin-top: 3px; }

  /* TABLE */
  .sa-table { width: 100%; border-collapse: collapse; }
  .sa-table th {
    padding: 10px 16px; text-align: left;
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--gray-5); font-weight: 700;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .sa-table td {
    padding: 12px 16px;
    font-size: 14px;
    border-bottom: 1px solid rgba(0,0,0,0.04);
    vertical-align: middle;
  }
  .sa-table tr:last-child td { border-bottom: none; }
  .sa-table tr:hover td { background: rgba(0,0,0,0.02); }

  /* BADGES */
  .sa-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 5px;
    font-size: 12px; font-weight: 700;
  }

  .badge-green { background: rgba(0,200,83,0.12); color: #00c853; border: 1px solid rgba(0,200,83,0.2); }
  .badge-blue { background: rgba(0,102,255,0.12); color: #4d9fff; border: 1px solid rgba(0,102,255,0.2); }
  .badge-purple { background: rgba(124,58,237,0.12); color: #a78bfa; border: 1px solid rgba(124,58,237,0.2); }
  .badge-gray { background: rgba(255,255,255,0.06); color: var(--gray-4); border: 1px solid rgba(255,255,255,0.1); }
  .badge-red { background: rgba(255,59,48,0.12); color: #ff6b6b; border: 1px solid rgba(255,59,48,0.2); }
  .badge-amber { background: rgba(255,149,0,0.12); color: #ff9500; border: 1px solid rgba(255,149,0,0.2); }

  /* BUTTONS */
  .sa-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 8px;
    font-size: 14px; font-weight: 700; cursor: pointer; border: none;
    font-family: 'Inter', sans-serif; transition: all 0.15s;
  }

  .sa-btn-white { background: #070708; color: white; }
  .sa-btn-white:hover { background: #1c1c1e; }

  .sa-btn-ghost {
    background: transparent; color: var(--gray-3);
    border: 1px solid rgba(255,255,255,0.1);
  }
  .sa-btn-ghost:hover { background: rgba(255,255,255,0.06); color: white; }

  .sa-btn-danger { background: rgba(255,59,48,0.1); color: #ff6b6b; border: 1px solid rgba(255,59,48,0.2); }
  .sa-btn-danger:hover { background: rgba(255,59,48,0.2); }

  .sa-btn-blue { background: #0066ff; color: white; }
  .sa-btn-blue:hover { opacity: 0.88; }

  .sa-btn-sm { padding: 5px 10px; font-size: 13px; border-radius: 6px; }

  /* FORM */
  .sa-form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
  .sa-form-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gray-4); font-weight: 700; }
  .sa-form-input {
    background: white; border: 1px solid rgba(0,0,0,0.15);
    border-radius: 8px; padding: 9px 13px;
    font-size: 15px; color: #070708; font-family: 'Inter', sans-serif; outline: none;
    transition: border-color 0.15s; width: 100%;
  }
  .sa-form-input:focus { border-color: #0066ff; }
  .sa-form-input::placeholder { color: var(--gray-5); }
  .sa-form-select { cursor: pointer; }
  .sa-form-select option { background: white; color: #070708; }
  .sa-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  /* MODAL */
  .sa-modal-overlay {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }

  .sa-modal {
    background: #1c1c1e; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 18px; padding: 28px;
    width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
  }

  .sa-modal-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 19px; font-weight: 800; margin-bottom: 20px; }

  .sa-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

  /* MODULE TOGGLES */
  .sa-module-grid { display: flex; flex-direction: column; gap: 6px; }
  .sa-module-toggle {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 8px; cursor: pointer;
    border: 1.5px solid rgba(0,0,0,0.1);
    background: white; transition: all 0.15s;
  }
  .sa-module-toggle:hover { border-color: rgba(0,0,0,0.2); }
  .sa-module-toggle.on { border-color: rgba(0,102,255,0.4); background: rgba(0,102,255,0.06); }
  .sa-module-check {
    width: 16px; height: 16px; border-radius: 4px;
    border: 1.5px solid rgba(0,0,0,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; flex-shrink: 0; transition: all 0.15s;
  }
  .sa-module-toggle.on .sa-module-check { background: #0066ff; border-color: #0066ff; }

  /* API CONFIG */
  .sa-api-section { margin-bottom: 20px; }
  .sa-api-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap-8px; gap: 8px; }
  .sa-api-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* QUOTER */
  .sa-quoter { display: flex; gap: 24px; }
  .sa-quoter-form { width: 360px; min-width: 360px; }
  .sa-quoter-preview { flex: 1; min-height: 600px; }

  /* PLAN CARD */
  .sa-plan-card {
    background: white;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    border-radius: var(--radius); padding: 20px;
    margin-bottom: 12px;
  }

  .sa-plan-header { display: flex; align-items: center; gap-10px; gap: 10px; margin-bottom: 14px; }
  .sa-plan-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 17px; font-weight: 800; flex: 1; }

  /* DIVIDER */
  .sa-divider { height: 1px; background: rgba(0,0,0,0.05); margin: 16px 0; }

  /* EMPTY */
  .sa-empty { text-align: center; padding: 40px 20px; color: var(--gray-5); }
  .sa-empty-icon { font-size: 32px; margin-bottom: 10px; opacity: 0.4; }
  .sa-empty-text { font-size: 15px; }

  /* DOT */
  .sa-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

  /* TABS */
  .sa-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(0,0,0,0.06); margin-bottom: 20px; }
  .sa-tab {
    padding: 10px 16px; font-size: 14px; font-weight: 600;
    color: var(--gray-4); border-bottom: 2px solid transparent;
    cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif;
    background: none; border-top: none; border-left: none; border-right: none;
  }
  .sa-tab:hover { color: black; }
  .sa-tab.active { color: black; border-bottom-color: #0066ff; }

  /* TOGGLE */
  .sa-toggle { position: relative; width: 36px; height: 20px; cursor: pointer; }
  .sa-toggle input { opacity: 0; width: 0; height: 0; }
  .sa-toggle-slider {
    position: absolute; inset: 0; background: rgba(255,255,255,0.1);
    border-radius: 20px; transition: 0.2s;
  }
  .sa-toggle-slider::before {
    content: ''; position: absolute;
    width: 14px; height: 14px; border-radius: 50%;
    background: white; left: 3px; top: 3px; transition: 0.2s;
  }
  .sa-toggle input:checked + .sa-toggle-slider { background: #0066ff; }
  .sa-toggle input:checked + .sa-toggle-slider::before { transform: translateX(16px); }
`

// ─── HELPER COMPONENTS ───
function Modal({ title, onClose, children, actions }) {
  return (
    <div className="sa-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sa-modal">
        <div className="sa-modal-title">{title}</div>
        {children}
        {actions && <div className="sa-modal-actions">{actions}</div>}
      </div>
    </div>
  )
}

function Btn({ children, onClick, variant = 'ghost', sm, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx('sa-btn', `sa-btn-${variant}`, sm && 'sa-btn-sm', className)}
    >
      {children}
    </button>
  )
}

function Badge({ children, color = 'gray' }) {
  return <span className={clsx('sa-badge', `badge-${color}`)}>{children}</span>
}

// ─── MODULES ───

// DASHBOARD
function Dashboard({ orgs, resellers }) {
  const activeOrgs = orgs.filter(o => o.status === 'active').length
  const totalMRR = orgs.reduce((s, o) => s + (o.mrr || 0), 0)

  return (
    <div className="sa-content">
      <div className="sa-stats">
        <div className="sa-stat">
          <div className="sa-stat-label">Organizaciones</div>
          <div className="sa-stat-value">{orgs.length}</div>
          <div className="sa-stat-sub">{activeOrgs} activas</div>
        </div>
        <div className="sa-stat">
          <div className="sa-stat-label">Resellers</div>
          <div className="sa-stat-value">{resellers.length}</div>
          <div className="sa-stat-sub">Partners activos</div>
        </div>
        <div className="sa-stat">
          <div className="sa-stat-label">MRR estimado</div>
          <div className="sa-stat-value" style={{ fontSize: 22 }}>${totalMRR.toLocaleString()}</div>
          <div className="sa-stat-sub">USD / mes</div>
        </div>
        <div className="sa-stat">
          <div className="sa-stat-label">Módulos activos</div>
          <div className="sa-stat-value">{MODULES_CATALOG.length}</div>
          <div className="sa-stat-sub">En catálogo</div>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-card-title">Organizaciones recientes</div>
        </div>
        <table className="sa-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Plan</th>
              <th>Usuarios</th>
              <th>MRR</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {orgs.slice(0, 8).map(org => (
              <tr key={org.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{org.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-4)' }}>{org.ownerEmail}</div>
                </td>
                <td><Badge color={org.plan === 'enterprise' ? 'purple' : org.plan === 'pro' ? 'blue' : 'gray'}>{org.plan || 'starter'}</Badge></td>
                <td style={{ color: 'var(--gray-3)' }}>{org.users || 1}</td>
                <td style={{ fontWeight: 700 }}>${org.mrr || 0}</td>
                <td><Badge color={org.status === 'active' ? 'green' : 'red'}>{org.status || 'active'}</Badge></td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr><td colSpan={5} className="sa-empty"><div className="sa-empty-icon" style={{ display: "flex", justifyContent: "center" }}><Building2 size={32} strokeWidth={1.5} /></div><div className="sa-empty-text">Sin organizaciones aún</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ORGANIZATIONS
function Organizations({ orgs, resellers, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [editOrg, setEditOrg] = useState(null)
  const [form, setForm] = useState({ name: '', ownerEmail: '', ownerPassword: '', plan: 'starter', users: 1, mrr: 50, status: 'active', resellerId: '', modules: ['pipeline', 'inbox', 'agent', 'analytics'] })
  const [saving, setSaving] = useState(false)

  const openNew = () => {
    setEditOrg(null)
    setForm({ name: '', ownerEmail: '', ownerPassword: '', plan: 'starter', users: 1, mrr: 50, status: 'active', resellerId: '', modules: ['pipeline', 'inbox', 'agent', 'analytics'] })
    setShowModal(true)
  }

  const openEdit = (org) => {
    setEditOrg(org)
    setForm({ ...org, ownerPassword: '' })
    setShowModal(true)
  }

  const toggleModule = (id) => {
    setForm(f => ({
      ...f,
      modules: f.modules.includes(id) ? f.modules.filter(m => m !== id) : [...f.modules, id]
    }))
  }

  const save = async () => {
    if (!form.name || !form.ownerEmail) { toast.error('Nombre y email requeridos'); return }
    setSaving(true)
    try {
      if (editOrg) {
        await updateDoc(doc(db, 'organizations', editOrg.id), {
          ...form,
          updatedAt: serverTimestamp(),
        })
        toast.success('Organización actualizada')
      } else {
        // Create Firebase Auth user
        let uid = null
        try {
          const cred = await createUserWithEmailAndPassword(auth, form.ownerEmail, form.ownerPassword || 'FlowCRM2025!')
          uid = cred.user.uid
        } catch (e) {
          if (e.code !== 'auth/email-already-in-use') throw e
          toast('Email ya existe en Auth — vinculando org', { icon: 'ℹ️' })
        }

        const orgRef = await addDoc(collection(db, 'organizations'), {
          name: form.name,
          ownerEmail: form.ownerEmail,
          plan: form.plan,
          users: form.users,
          mrr: form.mrr,
          status: form.status,
          resellerId: form.resellerId || null,
          modules: form.modules,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        if (uid) {
          await setDoc(doc(db, 'users', uid), {
            email: form.ownerEmail,
            orgId: orgRef.id,
            role: 'admin',
            createdAt: serverTimestamp(),
          })
        }
        toast.success('Organización creada')
      }
      setShowModal(false)
      onRefresh()
    } catch (e) {
      console.error(e)
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (org) => {
    const newStatus = org.status === 'active' ? 'suspended' : 'active'
    await updateDoc(doc(db, 'organizations', org.id), { status: newStatus, updatedAt: serverTimestamp() })
    toast.success(`Organización ${newStatus === 'active' ? 'activada' : 'suspendida'}`)
    onRefresh()
  }

  return (
    <div className="sa-content">
      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-card-title">Organizaciones ({orgs.length})</div>
          <Btn variant="white" onClick={openNew}>+ Nueva organización</Btn>
        </div>
        <table className="sa-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Plan</th>
              <th>Módulos</th>
              <th>Usuarios</th>
              <th>MRR</th>
              <th>Reseller</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => (
              <tr key={org.id}>
                <td>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{org.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-4)' }}>{org.ownerEmail}</div>
                </td>
                <td><Badge color={org.plan === 'enterprise' ? 'purple' : org.plan === 'pro' ? 'blue' : 'gray'}>{org.plan || 'starter'}</Badge></td>
                <td style={{ fontSize: 13, color: 'var(--gray-4)' }}>{(org.modules || []).length} módulos</td>
                <td style={{ color: 'var(--gray-3)', fontWeight: 600 }}>{org.users || 1}</td>
                <td style={{ fontWeight: 700 }}>${org.mrr || 0}</td>
                <td style={{ fontSize: 13, color: 'var(--gray-4)' }}>{org.resellerId ? resellers.find(r => r.id === org.resellerId)?.name || org.resellerId : '—'}</td>
                <td>
                  <span className="sa-dot" style={{ background: org.status === 'active' ? 'var(--green)' : 'var(--red)', marginRight: 5 }} />
                  <span style={{ fontSize: 13, color: 'var(--gray-4)' }}>{org.status || 'active'}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn sm variant="ghost" onClick={() => openEdit(org)}>Editar</Btn>
                    <Btn sm variant={org.status === 'active' ? 'danger' : 'ghost'} onClick={() => toggleStatus(org)}>
                      {org.status === 'active' ? 'Suspender' : 'Activar'}
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr><td colSpan={8}><div className="sa-empty"><div className="sa-empty-icon" style={{ display: "flex", justifyContent: "center" }}><Building2 size={32} strokeWidth={1.5} /></div><div className="sa-empty-text">Sin organizaciones — crea la primera</div></div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal
          title={editOrg ? `Editar: ${editOrg.name}` : 'Nueva organización'}
          onClose={() => setShowModal(false)}
          actions={<>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn variant="white" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </>}
        >
          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">Nombre de la organización</label>
              <input className="sa-form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Aktivz" />
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Email del administrador</label>
              <input className="sa-form-input" type="email" value={form.ownerEmail} onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))} placeholder="omar@aktivz.com" />
            </div>
          </div>
          {!editOrg && (
            <div className="sa-form-group">
              <label className="sa-form-label">Password inicial (mín. 6 caracteres)</label>
              <input className="sa-form-input" type="password" value={form.ownerPassword} onChange={e => setForm(f => ({ ...f, ownerPassword: e.target.value }))} placeholder="FlowCRM2025!" />
            </div>
          )}
          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">Plan</label>
              <select className="sa-form-input sa-form-select" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                {PLANS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Usuarios</label>
              <input className="sa-form-input" type="number" min="1" value={form.users} onChange={e => setForm(f => ({ ...f, users: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">MRR (USD/mes)</label>
              <input className="sa-form-input" type="number" value={form.mrr} onChange={e => setForm(f => ({ ...f, mrr: parseFloat(e.target.value) }))} placeholder="50" />
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Reseller (opcional)</label>
              <select className="sa-form-input sa-form-select" value={form.resellerId || ''} onChange={e => setForm(f => ({ ...f, resellerId: e.target.value }))}>
                <option value="">— Directo —</option>
                {resellers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="sa-form-group">
            <label className="sa-form-label">Estado</label>
            <select className="sa-form-input sa-form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>
              <option value="trial">Trial</option>
            </select>
          </div>
          <div className="sa-divider" />
          <div className="sa-form-label" style={{ marginBottom: 10 }}>Módulos habilitados</div>
          <div className="sa-module-grid">
            {MODULES_CATALOG.map(m => (
              <div key={m.id} className={clsx('sa-module-toggle', form.modules?.includes(m.id) && 'on')} onClick={() => toggleModule(m.id)}>
                <div className="sa-module-check">{form.modules?.includes(m.id) && <Check size={12} />}</div>
                <span style={{ fontSize: 15 }}>{m.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{m.name}</span>
                <span style={{ fontSize: 12, color: 'var(--gray-5)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>{m.tag}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

// RESELLERS
function Resellers({ resellers, orgs, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const [editR, setEditR] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', commissionPct: 20, setupFee: 2000, monthlyFee: 300, maxOrgs: 10, status: 'active' })
  const [saving, setSaving] = useState(false)

  const openNew = () => { setEditR(null); setForm({ name: '', email: '', phone: '', commissionPct: 20, setupFee: 2000, monthlyFee: 300, maxOrgs: 10, status: 'active' }); setShowModal(true) }
  const openEdit = (r) => { setEditR(r); setForm({ ...r }); setShowModal(true) }

  const save = async () => {
    if (!form.name || !form.email) { toast.error('Nombre y email requeridos'); return }
    setSaving(true)
    try {
      if (editR) {
        await updateDoc(doc(db, 'resellers', editR.id), { ...form, updatedAt: serverTimestamp() })
      } else {
        await addDoc(collection(db, 'resellers'), { ...form, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      }
      toast.success(editR ? 'Reseller actualizado' : 'Reseller creado')
      setShowModal(false)
      onRefresh()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="sa-content">
      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-card-title">Resellers ({resellers.length})</div>
          <Btn variant="white" onClick={openNew}>+ Nuevo reseller</Btn>
        </div>
        <table className="sa-table">
          <thead>
            <tr>
              <th>Reseller</th>
              <th>Comisión</th>
              <th>Setup fee</th>
              <th>Mensualidad</th>
              <th>Orgs activas</th>
              <th>Max orgs</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {resellers.map(r => {
              const activeOrgs = orgs.filter(o => o.resellerId === r.id).length
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-4)' }}>{r.email}</div>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--green)' }}>{r.commissionPct}%</td>
                  <td>${r.setupFee?.toLocaleString()} USD</td>
                  <td>${r.monthlyFee?.toLocaleString()} USD</td>
                  <td style={{ fontWeight: 700 }}>{activeOrgs}</td>
                  <td style={{ color: 'var(--gray-4)' }}>{r.maxOrgs}</td>
                  <td><Badge color={r.status === 'active' ? 'green' : 'red'}>{r.status}</Badge></td>
                  <td><Btn sm variant="ghost" onClick={() => openEdit(r)}>Editar</Btn></td>
                </tr>
              )
            })}
            {resellers.length === 0 && (
              <tr><td colSpan={8}><div className="sa-empty"><div className="sa-empty-icon" style={{ display: "flex", justifyContent: "center" }}><Handshake size={32} strokeWidth={1.5} /></div><div className="sa-empty-text">Sin resellers — agrega el primero</div></div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal
          title={editR ? `Editar: ${editR.name}` : 'Nuevo reseller'}
          onClose={() => setShowModal(false)}
          actions={<>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Btn>
            <Btn variant="white" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </>}
        >
          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">Nombre del reseller</label>
              <input className="sa-form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Agencia XYZ" />
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Email</label>
              <input className="sa-form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">Teléfono</label>
              <input className="sa-form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+52..." />
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Comisión (%)</label>
              <input className="sa-form-input" type="number" min="0" max="100" value={form.commissionPct} onChange={e => setForm(f => ({ ...f, commissionPct: parseFloat(e.target.value) }))} />
            </div>
          </div>
          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">Setup fee (USD)</label>
              <input className="sa-form-input" type="number" value={form.setupFee} onChange={e => setForm(f => ({ ...f, setupFee: parseFloat(e.target.value) }))} />
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Mensualidad (USD)</label>
              <input className="sa-form-input" type="number" value={form.monthlyFee} onChange={e => setForm(f => ({ ...f, monthlyFee: parseFloat(e.target.value) }))} />
            </div>
          </div>
          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">Máx. organizaciones</label>
              <input className="sa-form-input" type="number" value={form.maxOrgs} onChange={e => setForm(f => ({ ...f, maxOrgs: parseInt(e.target.value) }))} />
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Estado</label>
              <select className="sa-form-input sa-form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Activo</option>
                <option value="suspended">Suspendido</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// PLANS
function Plans() {
  const [plans, setPlans] = useState([
    { id: 'starter', name: 'Starter', color: '#8e8e93', implPrice: 10000, implCurrency: 'MXN', monthlyUSD: 29, modules: ['pipeline', 'analytics'] },
    { id: 'pro', name: 'Pro', color: '#0066ff', implPrice: 20000, implCurrency: 'MXN', monthlyUSD: 50, modules: ['pipeline', 'inbox', 'agent', 'analytics', 'landing'] },
    { id: 'enterprise', name: 'Enterprise', color: '#7c3aed', implPrice: 40000, implCurrency: 'MXN', monthlyUSD: 99, modules: ['pipeline', 'inbox', 'agent', 'content', 'analytics', 'landing', 'referrals'] },
  ])
  const [saving, setSaving] = useState(false)

  const toggleModule = (planId, modId) => {
    setPlans(ps => ps.map(p => p.id === planId ? {
      ...p,
      modules: p.modules.includes(modId) ? p.modules.filter(m => m !== modId) : [...p.modules, modId]
    } : p))
  }

  const updatePlan = (planId, key, val) => {
    setPlans(ps => ps.map(p => p.id === planId ? { ...p, [key]: val } : p))
  }

  const save = async () => {
    setSaving(true)
    try {
      for (const plan of plans) {
        await setDoc(doc(db, 'plans', plan.id), { ...plan, updatedAt: serverTimestamp() })
      }
      toast.success('Planes guardados')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="sa-content">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Btn variant="white" onClick={save} disabled={saving}>{saving ? 'Guardando...' : <><Save size={14} style={{ marginRight: 4 }} /> Guardar planes</>}</Btn>
      </div>
      {plans.map(plan => (
        <div key={plan.id} className="sa-plan-card">
          <div className="sa-plan-header">
            <div className="sa-dot" style={{ background: plan.color, width: 10, height: 10 }} />
            <div className="sa-plan-name">{plan.name}</div>
            <Badge color={plan.id === 'enterprise' ? 'purple' : plan.id === 'pro' ? 'blue' : 'gray'}>{plan.id}</Badge>
          </div>
          <div className="sa-form-row" style={{ marginBottom: 14 }}>
            <div className="sa-form-group" style={{ margin: 0 }}>
              <label className="sa-form-label">Precio implementación</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="sa-form-input sa-form-select" style={{ width: 80 }} value={plan.implCurrency} onChange={e => updatePlan(plan.id, 'implCurrency', e.target.value)}>
                  <option>MXN</option><option>USD</option>
                </select>
                <input className="sa-form-input" type="number" value={plan.implPrice} onChange={e => updatePlan(plan.id, 'implPrice', parseFloat(e.target.value))} />
              </div>
            </div>
            <div className="sa-form-group" style={{ margin: 0 }}>
              <label className="sa-form-label">Mensualidad por usuario (USD)</label>
              <input className="sa-form-input" type="number" value={plan.monthlyUSD} onChange={e => updatePlan(plan.id, 'monthlyUSD', parseFloat(e.target.value))} />
            </div>
          </div>
          <div className="sa-form-label" style={{ marginBottom: 8 }}>Módulos incluidos</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MODULES_CATALOG.map(m => (
              <div
                key={m.id}
                onClick={() => toggleModule(plan.id, m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                  border: `1.5px solid ${plan.modules.includes(m.id) ? 'rgba(0,102,255,0.4)' : 'rgba(0,0,0,0.08)'}`,
                  background: plan.modules.includes(m.id) ? 'rgba(0,102,255,0.08)' : 'rgba(0,0,0,0.02)',
                  fontSize: 14, fontWeight: 600,
                  color: plan.modules.includes(m.id) ? '#4d9fff' : 'var(--gray-4)',
                  transition: 'all 0.15s',
                }}
              >
                {m.icon} {m.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// API CONFIG
function ApiConfig({ orgs }) {
  const [selectedOrg, setSelectedOrg] = useState('')
  const [config, setConfig] = useState({
    metaPageAccessToken: '', metaVerifyToken: '', whatsappToken: '', whatsappPhoneId: '',
    openaiApiKey: '', instagramPageId: '', facebookPageId: '',
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedOrg) return
    setLoading(true)
    getDoc(doc(db, 'organizations', selectedOrg, 'settings', 'apis'))
      .then(snap => { if (snap.exists()) setConfig({ ...config, ...snap.data() }) })
      .finally(() => setLoading(false))
  }, [selectedOrg])

  const save = async () => {
    if (!selectedOrg) { toast.error('Selecciona una organización'); return }
    setSaving(true)
    try {
      await setDoc(doc(db, 'organizations', selectedOrg, 'settings', 'apis'), {
        ...config, updatedAt: serverTimestamp()
      })
      toast.success('APIs guardadas')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const Field = ({ label, id, type = 'text', placeholder }) => (
    <div className="sa-form-group">
      <label className="sa-form-label">{label}</label>
      <input
        className="sa-form-input"
        type={type}
        value={config[id] || ''}
        onChange={e => setConfig(c => ({ ...c, [id]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <div className="sa-content">
      <div className="sa-card">
        <div className="sa-card-header">
          <div className="sa-card-title">Configuración de APIs por organización</div>
        </div>
        <div style={{ padding: '20px 20px 0' }}>
          <div className="sa-form-group">
            <label className="sa-form-label">Organización</label>
            <select className="sa-form-input sa-form-select" value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}>
              <option value="">— Selecciona una organización —</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name} — {o.ownerEmail}</option>)}
            </select>
          </div>
        </div>

        {selectedOrg && !loading && (
          <div style={{ padding: '0 20px 20px' }}>
            <div className="sa-api-section">
              <div className="sa-api-title"><MessageSquare size={16} /> Meta — Messenger & Instagram</div>
              <div className="sa-api-grid">
                <Field label="Page Access Token" id="metaPageAccessToken" placeholder="EAAGm0..." />
                <Field label="Verify Token" id="metaVerifyToken" placeholder="flowcrm2025" />
                <Field label="Facebook Page ID" id="facebookPageId" placeholder="128809..." />
                <Field label="Instagram Page ID" id="instagramPageId" placeholder="178..." />
              </div>
            </div>
            <div className="sa-divider" />
            <div className="sa-api-section">
              <div className="sa-api-title"><Smartphone size={16} /> WhatsApp Business</div>
              <div className="sa-api-grid">
                <Field label="WhatsApp Token" id="whatsappToken" placeholder="EAAGm0..." />
                <Field label="Phone Number ID" id="whatsappPhoneId" placeholder="123456..." />
              </div>
            </div>
            <div className="sa-divider" />
            <div className="sa-api-section">
              <div className="sa-api-title"><Bot size={16} /> OpenAI</div>
              <div className="sa-api-grid">
                <Field label="API Key" id="openaiApiKey" type="password" placeholder="sk-..." />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Btn variant="white" onClick={save} disabled={saving}>{saving ? 'Guardando...' : <><Save size={14} style={{ marginRight: 4 }} /> Guardar APIs</>}</Btn>
            </div>
          </div>
        )}

        {selectedOrg && loading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-4)', fontSize: 15 }}>Cargando configuración...</div>
        )}

        {!selectedOrg && (
          <div className="sa-empty" style={{ padding: '32px 20px' }}>
            <div className="sa-empty-icon" style={{ display: "flex", justifyContent: "center" }}><Key size={32} strokeWidth={1.5} /></div>
            <div className="sa-empty-text">Selecciona una organización para configurar sus APIs</div>
          </div>
        )}
      </div>
    </div>
  )
}

// QUOTER — embeds the standalone quoter logic
function Quoter() {
  const [form, setForm] = useState({
    name: '', company: '', users: 1, validityDays: 10,
    implTime: '30 días hábiles', implPrice: '', implCurrency: 'MXN',
    saasPrice: '50', saasCurrency: 'USD',
    paymentTerms: '100% por adelantado de contado',
    payLink: '', payBtnText: 'Pagar implementación',
    folio: '', notes: '',
  })
  const [selectedModules, setSelectedModules] = useState(new Set(['pipeline', 'inbox', 'agent', 'analytics']))

  const genFolio = () => {
    const now = new Date()
    return `QC-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`
  }

  useEffect(() => {
    if (!form.folio) setForm(f => ({ ...f, folio: genFolio() }))
  }, [])

  const toggleMod = (id) => {
    setSelectedModules(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const formatDate = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const addBusinessDays = (date, days) => {
    let d = new Date(date), added = 0
    while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++ }
    return d
  }

  const today = new Date()
  const expiry = addBusinessDays(today, form.validityDays || 10)
  const initials = [form.name.split(' ')[0]?.[0], form.name.split(' ')[1]?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const activeMods = MODULES_CATALOG.filter(m => selectedModules.has(m.id))

  const downloadHTML = () => {
    const preview = document.getElementById('sa-quote-preview')
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Cotización — ${form.company}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><style>body{font-family:Inter,sans-serif;background:#070708;color:white;margin:0;padding:0;}${document.querySelector('#sa-quote-style')?.textContent || ''}</style></head><body>${preview.innerHTML}</body></html>`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    a.download = `cotizacion-${form.company.toLowerCase().replace(/\s+/g, '-')}-${form.folio}.html`
    a.click()
    toast.success('HTML descargado')
  }

  const f = form

  return (
    <div className="sa-content" style={{ maxWidth: '100%' }}>
      <style id="sa-quote-style">{`
        .q2-header { padding: 40px 48px 32px; display:flex; align-items:flex-start; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.06); position:relative; overflow:hidden; }
        .q2-header::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 60% 80% at 10% 50%,rgba(0,102,255,0.08) 0%,transparent 60%),radial-gradient(ellipse 40% 60% at 90% 30%,rgba(124,58,237,0.07) 0%,transparent 60%); pointer-events:none; }
        .q2-logo-row { display:flex; align-items:center; gap:10px; margin-bottom:18px; position:relative; z-index:1; }
        .q2-logo-icon { width:34px; height:34px; background:linear-gradient(135deg,#0066ff,#7c3aed); border-radius:9px; display:flex; align-items:center; justify-content:center; }
        .q2-logo-text { font-family:'Plus Jakarta Sans',sans-serif; font-size: 19px; font-weight:800; }
        .q2-logo-sub { font-size: 12px; color:#8e8e93; font-weight:500; letter-spacing:0.5px; text-transform:uppercase; }
        .q2-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:26px; font-weight:900; letter-spacing:-0.5px; margin-bottom:5px; position:relative; z-index:1; }
        .q2-meta { font-size: 14px; color:#8e8e93; line-height:1.7; position:relative; z-index:1; }
        .q2-meta strong { color:#c7c7cc; }
        .q2-badge { display:inline-flex; align-items:center; gap:5px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:4px 11px; font-size: 13px; font-weight:600; color:#c7c7cc; margin-bottom:10px; }
        .q2-folio-dot { width:5px; height:5px; border-radius:50%; background:#ff9500; }
        .q2-client-section { padding:28px 48px; border-bottom:1px solid rgba(255,255,255,0.06); }
        .q2-client-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:22px 26px; display:flex; gap:16px; align-items:center; }
        .q2-avatar { width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#0066ff,#7c3aed); display:flex; align-items:center; justify-content:center; font-family:'Plus Jakarta Sans',sans-serif; font-size: 19px; font-weight:800; flex-shrink:0; }
        .q2-client-name { font-family:'Plus Jakarta Sans',sans-serif; font-size: 18px; font-weight:800; margin-bottom:2px; }
        .q2-client-co { font-size: 14px; color:#8e8e93; }
        .q2-client-meta { margin-left:auto; display:flex; gap:24px; }
        .q2-meta-item { text-align:right; }
        .q2-meta-label { font-size:9.5px; text-transform:uppercase; letter-spacing:0.5px; color:#3a3a3c; font-weight:700; margin-bottom:3px; }
        .q2-meta-value { font-family:'Plus Jakarta Sans',sans-serif; font-size: 15px; font-weight:700; color:#e8e8ed; }
        .q2-section { padding:28px 48px; border-bottom:1px solid rgba(255,255,255,0.06); }
        .q2-section-label { font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:#3a3a3c; font-weight:700; margin-bottom:5px; }
        .q2-section-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:18px; font-weight:800; letter-spacing:-0.3px; margin-bottom:16px; }
        .q2-modules { display:flex; flex-direction:column; gap:8px; }
        .q2-module { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:14px 18px; display:flex; gap:12px; }
        .q2-mod-icon { width:30px; height:30px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size: 15px; flex-shrink:0; }
        .q2-mod-name { font-family:'Plus Jakarta Sans',sans-serif; font-size: 15px; font-weight:700; margin-bottom:5px; }
        .q2-mod-features { display:flex; flex-wrap:wrap; gap:4px; }
        .q2-feat { font-size: 12px; color:#8e8e93; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:4px; padding:2px 7px; }
        .q2-price-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
        .q2-price-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:22px; }
        .q2-price-card-hl { border-color:rgba(0,102,255,0.3); background:rgba(0,102,255,0.05); }
        .q2-price-label { font-size:9.5px; text-transform:uppercase; letter-spacing:0.8px; color:#8e8e93; font-weight:700; margin-bottom:7px; }
        .q2-price-amount { font-family:'Plus Jakarta Sans',sans-serif; font-size:32px; font-weight:900; letter-spacing:-1.5px; line-height:1; margin-bottom:5px; }
        .q2-price-amount span { font-size: 15px; font-weight:600; color:#8e8e93; letter-spacing:0; }
        .q2-price-note { font-size: 13px; color:#8e8e93; margin-bottom:10px; }
        .q2-includes { display:flex; flex-direction:column; gap:5px; }
        .q2-include { display:flex; align-items:center; gap:6px; font-size: 13px; color:#c7c7cc; }
        .q2-check { width:13px; height:13px; border-radius:50%; background:rgba(0,200,83,0.12); border:1px solid rgba(0,200,83,0.2); display:flex; align-items:center; justify-content:center; font-size:7px; color:#00c853; font-weight:700; flex-shrink:0; }
        .q2-payment { background:rgba(255,149,0,0.05); border:1px solid rgba(255,149,0,0.2); border-radius:10px; padding:16px 20px; display:flex; align-items:center; gap:12px; margin-bottom:10px; }
        .q2-pay-icon { width:36px; height:36px; border-radius:8px; background:rgba(255,149,0,0.12); display:flex; align-items:center; justify-content:center; font-size: 18px; flex-shrink:0; }
        .q2-pay-title { font-family:'Plus Jakarta Sans',sans-serif; font-size: 14px; font-weight:700; margin-bottom:2px; }
        .q2-pay-desc { font-size: 13px; color:#8e8e93; }
        .q2-pay-btn { display:inline-flex; align-items:center; gap:5px; background:#ff9500; color:#070708; padding:8px 14px; border-radius:7px; font-size: 13px; font-weight:700; text-decoration:none; margin-left:auto; flex-shrink:0; }
        .q2-validity { display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:12px 18px; }
        .q2-validity-label { font-size: 13px; color:#8e8e93; }
        .q2-validity-date { font-family:'Plus Jakarta Sans',sans-serif; font-size: 14px; font-weight:700; color:#e8e8ed; }
        .q2-validity-badge { display:inline-flex; align-items:center; gap:4px; background:rgba(255,59,48,0.1); border:1px solid rgba(255,59,48,0.2); border-radius:5px; padding:3px 8px; font-size: 12px; font-weight:700; color:#ff6b6b; }
        .q2-footer { padding:24px 48px; border-top:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:space-between; }
        .q2-footer-brand { font-family:'Plus Jakarta Sans',sans-serif; font-size: 13px; font-weight:700; color:#3a3a3c; }
        .q2-footer-note { font-size: 12px; color:#3a3a3c; text-align:center; line-height:1.5; }
        .q2-footer-folio { font-size: 13px; color:#8e8e93; text-align:right; }
      `}</style>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Form */}
        <div style={{ width: 320, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="sa-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-5)', marginBottom: 12 }}>Cliente</div>
            <div className="sa-form-row">
              <div className="sa-form-group" style={{ margin: 0 }}>
                <label className="sa-form-label">Nombre</label>
                <input className="sa-form-input" value={f.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Omar Pizarro" />
              </div>
              <div className="sa-form-group" style={{ margin: 0 }}>
                <label className="sa-form-label">Empresa</label>
                <input className="sa-form-input" value={f.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Aktivz" />
              </div>
            </div>
            <div className="sa-form-row" style={{ marginTop: 10 }}>
              <div className="sa-form-group" style={{ margin: 0 }}>
                <label className="sa-form-label">Usuarios</label>
                <input className="sa-form-input" type="number" min="1" value={f.users} onChange={e => setForm(p => ({ ...p, users: parseInt(e.target.value) }))} />
              </div>
              <div className="sa-form-group" style={{ margin: 0 }}>
                <label className="sa-form-label">Vigencia (días)</label>
                <input className="sa-form-input" type="number" value={f.validityDays} onChange={e => setForm(p => ({ ...p, validityDays: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="sa-form-group" style={{ marginTop: 10 }}>
              <label className="sa-form-label">Tiempo de implementación</label>
              <input className="sa-form-input" value={f.implTime} onChange={e => setForm(p => ({ ...p, implTime: e.target.value }))} placeholder="30 días hábiles" />
            </div>
          </div>

          <div className="sa-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-5)', marginBottom: 10 }}>Módulos</div>
            <div className="sa-module-grid">
              {MODULES_CATALOG.map(m => (
                <div key={m.id} className={clsx('sa-module-toggle', selectedModules.has(m.id) && 'on')} onClick={() => toggleMod(m.id)}>
                  <div className="sa-module-check">{selectedModules.has(m.id) && <Check size={12} />}</div>
                  <span style={{ fontSize: 15 }}>{m.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{m.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sa-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-5)', marginBottom: 12 }}>Inversión</div>
            <div className="sa-form-group">
              <label className="sa-form-label">Implementación</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="sa-form-input sa-form-select" style={{ width: 72 }} value={f.implCurrency} onChange={e => setForm(p => ({ ...p, implCurrency: e.target.value }))}>
                  <option>MXN</option><option>USD</option>
                </select>
                <input className="sa-form-input" value={f.implPrice} onChange={e => setForm(p => ({ ...p, implPrice: e.target.value }))} placeholder="20,000" />
              </div>
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">SaaS por usuario</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="sa-form-input sa-form-select" style={{ width: 72 }} value={f.saasCurrency} onChange={e => setForm(p => ({ ...p, saasCurrency: e.target.value }))}>
                  <option>USD</option><option>MXN</option>
                </select>
                <input className="sa-form-input" value={f.saasPrice} onChange={e => setForm(p => ({ ...p, saasPrice: e.target.value }))} placeholder="50" />
              </div>
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Condiciones de pago</label>
              <select className="sa-form-input sa-form-select" value={f.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))}>
                <option>100% por adelantado de contado</option>
                <option>50% al inicio, 50% al entregar</option>
                <option>Mensualidades desde el inicio</option>
                <option>A convenir</option>
              </select>
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Link de pago</label>
              <input className="sa-form-input" value={f.payLink} onChange={e => setForm(p => ({ ...p, payLink: e.target.value }))} placeholder="https://mpago.la/..." />
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Texto botón de pago</label>
              <input className="sa-form-input" value={f.payBtnText} onChange={e => setForm(p => ({ ...p, payBtnText: e.target.value }))} placeholder="Pagar implementación" />
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Folio</label>
              <input className="sa-form-input" value={f.folio} onChange={e => setForm(p => ({ ...p, folio: e.target.value }))} />
            </div>
            <div className="sa-form-group">
              <label className="sa-form-label">Notas</label>
              <input className="sa-form-input" value={f.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Observaciones..." />
            </div>
          </div>

          <Btn variant="white" onClick={downloadHTML}><Download size={14} /> Descargar HTML</Btn>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, background: '#0d0d0f', borderRadius: 14, overflow: 'auto', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div id="sa-quote-preview" style={{ background: "#070708", color: "white", minHeight: "100%" }}>

            {/* Header */}
            <div className="q2-header">
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="q2-logo-row"><img src="/qubit-corp.png" alt="Logo" style={{ height: 56, objectFit: "contain" }} /></div><div className="q2-title">Propuesta Comercial</div>
                <div className="q2-meta">
                  <strong>Solución:</strong> FlowCRM — Suite completa<br />
                  <strong>Elaborado por:</strong> Equipo &nbsp;·&nbsp; <strong>Fecha:</strong> {formatDate(today)}
                </div>
              </div>
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'right' }}>
                <div className="q2-badge"><div className="q2-folio-dot" />{f.folio}</div>
                <div className="q2-meta" style={{ textAlign: 'right', lineHeight: 1.9 }}>
                  <strong>Vigencia:</strong> {f.validityDays} días hábiles<br />
                  <strong>Vence:</strong> {formatDate(expiry)}<br />
                  <strong>Moneda:</strong> {f.implCurrency} / {f.saasCurrency}
                </div>
              </div>
            </div>

            {/* Client */}
            <div className="q2-client-section">
              <div className="q2-client-card">
                <div className="q2-avatar">{initials}</div>
                <div>
                  <div className="q2-client-name">{f.name || 'Nombre del cliente'}</div>
                  <div className="q2-client-co">{f.company || 'Empresa'}</div>
                </div>
                <div className="q2-client-meta">
                  <div className="q2-meta-item"><div className="q2-meta-label">Usuarios</div><div className="q2-meta-value">{f.users}</div></div>
                  <div className="q2-meta-item"><div className="q2-meta-label">Modalidad</div><div className="q2-meta-value">SaaS + Impl.</div></div>
                  <div className="q2-meta-item"><div className="q2-meta-label">Implementación</div><div className="q2-meta-value">{f.implTime}</div></div>
                </div>
              </div>
            </div>

            {/* Modules */}
            {activeMods.length > 0 && (
              <div className="q2-section">
                <div className="q2-section-label">Alcance de la solución</div>
                <div className="q2-section-title">Módulos incluidos</div>
                <div className="q2-modules">
                  {activeMods.map(m => (
                    <div key={m.id} className="q2-module">
                      <div className="q2-mod-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>{m.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div className="q2-mod-name">{m.name}</div>
                        <div className="q2-mod-features">
                          {(m.features || []).map(feat => <span key={feat} className="q2-feat">{feat}</span>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing */}
            <div className="q2-section">
              <div className="q2-section-label">Inversión</div>
              <div className="q2-section-title">Resumen de costos</div>
              <div className="q2-price-grid">
                <div className="q2-price-card q2-price-card-hl">
                  <div className="q2-price-label">Implementación (pago único)</div>
                  <div className="q2-price-amount">{f.implPrice ? '$' + f.implPrice : '—'} <span>{f.implCurrency}</span></div>
                  <div className="q2-price-note">Configuración completa, integraciones y sesiones de trabajo.</div>
                  <div className="q2-includes">
                    <div className="q2-include"><div className="q2-check">✓</div> Setup completo de la plataforma</div>
                    <div className="q2-include"><div className="q2-check">✓</div> Sesiones de trabajo videollamada</div>
                    <div className="q2-include"><div className="q2-check">✓</div> Capacitación y documentación</div>
                  </div>
                </div>
                <div className="q2-price-card">
                  <div className="q2-price-label">Renta mensual SaaS</div>
                  <div className="q2-price-amount">{f.saasPrice ? '$' + f.saasPrice : '—'} <span>{f.saasCurrency}/usuario</span></div>
                  <div className="q2-price-note">Acceso completo. Facturado mensualmente.</div>
                  <div className="q2-includes">
                    <div className="q2-include"><div className="q2-check">✓</div> {activeMods.length} módulos incluidos</div>
                    <div className="q2-include"><div className="q2-check">✓</div> Soporte técnico por WhatsApp</div>
                    <div className="q2-include"><div className="q2-check">✓</div> Actualizaciones incluidas</div>
                  </div>
                </div>
              </div>
              <div className="q2-payment">
                <div className="q2-pay-icon"><CreditCard size={20} /></div>
                <div>
                  <div className="q2-pay-title">Condiciones de pago — {f.paymentTerms}</div>
                  <div className="q2-pay-desc">La renta mensual se activa al finalizar la implementación.</div>
                </div>
                {f.payLink && <a href={f.payLink} className="q2-pay-btn" target="_blank" rel="noreferrer"><CreditCard size={14} /> {f.payBtnText}</a>}
              </div>
              <div className="q2-validity">
                <div>
                  <div className="q2-validity-label">Vigencia de esta cotización</div>
                  <div className="q2-validity-date">Válida hasta el {formatDate(expiry)}</div>
                </div>
                <div className="q2-validity-badge"><Hourglass size={12} /> {f.validityDays} días hábiles</div>
              </div>
              {f.notes && <div style={{ marginTop: 10, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 14, color: 'var(--gray-4)' }}><strong style={{ color: 'var(--gray-3)' }}>Notas: </strong>{f.notes}</div>}
            </div>

            {/* Footer */}
            <div className="q2-footer">
              <div className="q2-footer-brand">© {today.getFullYear()}</div>
              <div className="q2-footer-note">Propuesta confidencial dirigida a {f.name || 'el cliente'} / {f.company}.<br />Sujeta a la vigencia indicada.</div>
              <div className="q2-footer-folio">{f.folio}<br /></div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ─── DIAGNOSTICO CONFIG ───
function DiagnosticoConfig({ orgs = [] }) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [editingCat, setEditingCat] = useState(null)
  const [editingQ, setEditingQ] = useState(null)
  const [editText, setEditText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkOrg, setLinkOrg] = useState('')
  const [linkName, setLinkName] = useState('')

  const baseUrl = window.location.origin
  const selectedOrgData = orgs.find(o => o.id === linkOrg)
  const generatedLink = linkOrg
    ? `${baseUrl}/diagnostico?org=${linkOrg}&orgName=${encodeURIComponent(selectedOrgData?.name || '')}&name=${encodeURIComponent(linkName)}`
    : ''

  const copyLink = () => {
    if (!generatedLink) return
    navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    toast.success('Link copiado al portapapeles')
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    getDoc(doc(db, 'diagnostico_config', 'v1')).then(snap => {
      setCategories(snap.exists() ? snap.data().categories : DEFAULT_DIAG_CATEGORIES)
      if (!snap.exists()) setDirty(true)
    }).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'diagnostico_config', 'v1'), { categories, updatedAt: serverTimestamp() })
      toast.success('Configuración guardada')
      setDirty(false)
    } catch { toast.error('Error guardando') } finally { setSaving(false) }
  }

  const toggleExpand = id => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const addCategory = () => {
    const c = { id: 'cat_' + Date.now(), name: 'Nueva categoría', color: '#8e8e93', questions: ['Nueva afirmación.'] }
    setCategories(p => [...p, c])
    setExpanded(p => ({ ...p, [c.id]: true }))
    setDirty(true)
  }

  const deleteCategory = id => {
    if (!window.confirm('¿Eliminar esta categoría y todas sus preguntas?')) return
    setCategories(p => p.filter(c => c.id !== id))
    setDirty(true)
  }

  const updateCat = (id, key, val) => { setCategories(p => p.map(c => c.id === id ? { ...c, [key]: val } : c)); setDirty(true) }

  const addQuestion = catId => { setCategories(p => p.map(c => c.id === catId ? { ...c, questions: [...c.questions, 'Nueva afirmación.'] } : c)); setDirty(true) }
  const deleteQuestion = (catId, qi) => { setCategories(p => p.map(c => c.id === catId ? { ...c, questions: c.questions.filter((_, i) => i !== qi) } : c)); setDirty(true) }

  const saveEditQ = () => {
    setCategories(p => p.map(c => c.id === editingQ.catId ? { ...c, questions: c.questions.map((q, i) => i === editingQ.qi ? editText : q) } : c))
    setEditingQ(null); setDirty(true)
  }

  const totalQ = categories.reduce((s, c) => s + c.questions.length, 0)

  if (loading) return <div className="sa-content" style={{ color: 'var(--gray-4)', paddingTop: 40 }}>Cargando...</div>

  return (
    <div className="sa-content">
      <style>{diagConfigCss}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--gray-4)' }}>{categories.length} categorías · {totalQ} afirmaciones · Score máximo: {totalQ * 5} pts</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dirty && <span style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600 }}>● Cambios sin guardar</span>}
          <button className="sa-btn sa-btn-blue" onClick={save} disabled={saving || !dirty}>{saving ? 'Guardando...' : '💾 Guardar cambios'}</button>
        </div>
      </div>

      <div className="sa-card" style={{ padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-4)', marginBottom: 14 }}>Generar link del cuestionario</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: 'var(--gray-4)', fontWeight: 600, marginBottom: 5 }}>Organización</div>
            <select className="sa-form-input sa-form-select" value={linkOrg} onChange={e => setLinkOrg(e.target.value)}>
              <option value="">— Selecciona —</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 12, color: 'var(--gray-4)', fontWeight: 600, marginBottom: 5 }}>Nombre del participante</div>
            <input className="sa-form-input" placeholder="Omar Pizarro" value={linkName} onChange={e => setLinkName(e.target.value)} />
          </div>
          <button
            className="sa-btn sa-btn-blue"
            onClick={copyLink}
            disabled={!generatedLink}
            style={{ opacity: generatedLink ? 1 : 0.4 }}
          >
            {copied ? <><Check size={14} /> Copiado</> : <><Download size={14} /> Copiar link</>}
          </button>
        </div>
        {generatedLink && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#f5f5f7', borderRadius: 8, fontSize: 12, color: 'var(--gray-4)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {generatedLink}
          </div>
        )}
      </div>

      <div className="sa-card" style={{ padding: '14px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-4)', marginBottom: 8 }}>Escala de respuestas (igual para todas las afirmaciones)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Nunca', 'Casi nunca', 'A veces', 'Casi siempre', 'Siempre'].map((opt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f5f7', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: '#3a3a3c' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#070708', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{i + 1}</div>
              {opt}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {categories.map((cat) => (
          <div key={cat.id} className="sa-card">
            <div className="dc-cat-header" onClick={() => toggleExpand(cat.id)}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
              {editingCat === cat.id
                ? <input className="dc-cat-name-input" value={cat.name} onChange={e => updateCat(cat.id, 'name', e.target.value)} onClick={e => e.stopPropagation()} onBlur={() => setEditingCat(null)} autoFocus />
                : <div className="dc-cat-name">{cat.name}</div>
              }
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <span style={{ fontSize: 12, color: 'var(--gray-4)', fontWeight: 600 }}>{cat.questions.length} afirmaciones</span>
                <input type="color" value={cat.color} onChange={e => updateCat(cat.id, 'color', e.target.value)} onClick={e => e.stopPropagation()} style={{ width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }} />
                <button className="dc-icon-btn" onClick={e => { e.stopPropagation(); setEditingCat(cat.id) }} title="Renombrar"><Edit2 size={13} /></button>
                <button className="dc-icon-btn dc-icon-btn-danger" onClick={e => { e.stopPropagation(); deleteCategory(cat.id) }}><Trash2 size={13} /></button>
                {expanded[cat.id] ? <ChevronDown size={15} color="var(--gray-4)" /> : <ChevronRight size={15} color="var(--gray-4)" />}
              </div>
            </div>

            {expanded[cat.id] && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: '10px 18px 14px' }}>
                {cat.questions.map((q, qi) => (
                  <div key={qi} className="dc-q-row">
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: cat.color + '22', color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{qi + 1}</div>
                    {editingQ?.catId === cat.id && editingQ?.qi === qi
                      ? <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                          <textarea className="dc-q-textarea" value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={2} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <button className="dc-icon-btn" style={{ color: '#00c853', borderColor: 'rgba(0,200,83,0.3)' }} onClick={saveEditQ}><Check size={13} /></button>
                            <button className="dc-icon-btn" onClick={() => setEditingQ(null)}><X size={13} /></button>
                          </div>
                        </div>
                      : <>
                          <div style={{ flex: 1, fontSize: 14, color: '#3a3a3c', lineHeight: 1.5, paddingTop: 2 }}>{q}</div>
                          <div className="dc-q-actions">
                            <button className="dc-icon-btn" onClick={() => { setEditingQ({ catId: cat.id, qi }); setEditText(q) }}><Edit2 size={12} /></button>
                            <button className="dc-icon-btn dc-icon-btn-danger" onClick={() => deleteQuestion(cat.id, qi)}><Trash2 size={12} /></button>
                          </div>
                        </>
                    }
                  </div>
                ))}
                <button className="dc-add-q-btn" onClick={() => addQuestion(cat.id)}><Plus size={13} /> Agregar afirmación</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="dc-add-cat-btn" onClick={addCategory}><Plus size={15} /> Agregar categoría</button>
    </div>
  )
}

// ─── DIAGNOSTICO RESPONSES ───
function DiagnosticoResponses({ orgs }) {
  const [responses, setResponses] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [generating, setGenerating] = useState({})

  useEffect(() => {
    getDoc(doc(db, 'diagnostico_config', 'v1')).then(snap => { if (snap.exists()) setConfig(snap.data()) })
    const q = query(collection(db, 'diagnosticos'), orderBy('respondedAt', 'desc'))
    const unsub = onSnapshot(q, snap => { setResponses(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) })
    return () => unsub()
  }, [])

  const generateAndExport = async (resp) => {
    if (!config) return toast.error('Configuración no cargada')
    setGenerating(p => ({ ...p, [resp.id]: true }))
    try {
      const cats = config.categories
      const totalQ = cats.reduce((s, c) => s + c.questions.length, 0)
      const minScore = totalQ, maxScore = totalQ * 5
      const catSummaries = cats.map(cat => {
        const score = cat.questions.reduce((s, _, qi) => s + (resp.answers?.[`${cat.id}_${qi}`] || 1), 0)
        const max = cat.questions.length * 5, min = cat.questions.length
        return { name: cat.name, score, max, min, level: diagScoreLevel(score, min, max), color: cat.color }
      })
      const weakCats = [...catSummaries].sort((a, b) => (a.score / a.max) - (b.score / b.max)).slice(0, 3)
      const totalLevel = diagScoreLevel(resp.totalScore, minScore, maxScore)

      const prompt = `Eres un consultor de ventas y CRM experto. Recibiste los resultados del diagnóstico comercial de un vendedor. Genera un reporte profesional, directo y útil.

PARTICIPANTE: ${resp.respondentName || 'Participante'} · ${resp.orgName || 'Sin org'}
SCORE TOTAL: ${resp.totalScore} / ${maxScore} — Nivel: ${totalLevel.label}
SCORES POR CATEGORÍA:
${catSummaries.map(c => `- ${c.name}: ${c.score}/${c.max} (${c.level.label})`).join('\n')}
CATEGORÍAS MÁS DÉBILES: ${weakCats.map(c => c.name).join(', ')}

Genera el reporte con tono humilde, profesional, directo. Sin drama. Máximo 3-4 oraciones por sección.

Responde SOLO con JSON válido, sin markdown ni backticks, con estas claves:
resumen, fortalezas, oportunidades, recomendaciones, implementacion, mensaje`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await res.json()
      const analysis = JSON.parse(data.content?.[0]?.text?.replace(/```json|```/g, '').trim() || '{}')
      const html = buildDiagReportHTML(resp, catSummaries, totalLevel, analysis, maxScore, minScore)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `diagnostico-${(resp.respondentName || resp.id).replace(/\s+/g, '-').toLowerCase()}.html`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Reporte exportado')
    } catch (e) { console.error(e); toast.error('Error generando reporte') }
    finally { setGenerating(p => ({ ...p, [resp.id]: false })) }
  }

  const cats = config?.categories || []
  const totalQ = cats.reduce((s, c) => s + c.questions.length, 0)
  const minScore = totalQ, maxScore = totalQ * 5

  if (loading) return <div className="sa-content" style={{ color: 'var(--gray-4)', paddingTop: 40 }}>Cargando respuestas...</div>

  return (
    <div className="sa-content">
      <style>{diagRespCss}</style>
      {responses.length === 0
        ? <div className="sa-card"><div className="sa-empty" style={{ padding: '60px 20px' }}><div className="sa-empty-icon" style={{ display: 'flex', justifyContent: 'center' }}><BarChart size={40} strokeWidth={1.2} /></div><div className="sa-empty-text">Aún no hay respuestas del diagnóstico</div></div></div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {responses.map(resp => {
              const level = diagScoreLevel(resp.totalScore || minScore, minScore, maxScore)
              const pct = Math.round(((resp.totalScore || minScore) - minScore) / (maxScore - minScore) * 100)
              const isOpen = expanded[resp.id]
              return (
                <div key={resp.id} className="sa-card">
                  <div className="dr-row-header" onClick={() => setExpanded(p => ({ ...p, [resp.id]: !p[resp.id] }))}>
                    <div className="dr-avatar">{(resp.respondentName || '?')[0].toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 15 }}>{resp.respondentName || 'Sin nombre'}</div>
                      <div style={{ fontSize: 13, color: 'var(--gray-4)', marginTop: 2 }}>{resp.orgName || resp.id}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 80 }}>
                      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 20, fontWeight: 900, color: level.color, lineHeight: 1 }}>{resp.totalScore || '—'}<span style={{ fontSize: 13, color: 'var(--gray-4)', fontWeight: 500 }}>/{maxScore}</span></div>
                      <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 20, background: level.color + '18', color: level.color, border: `1px solid ${level.color}33`, fontSize: 11, fontWeight: 700 }}>{level.label}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 110 }}>
                      {cats.map(cat => {
                        const cs = cat.questions.reduce((s, _, qi) => s + (resp.answers?.[`${cat.id}_${qi}`] || 1), 0)
                        const cp = Math.round((cs - cat.questions.length) / (cat.questions.length * 4) * 100)
                        return <div key={cat.id} style={{ height: 4, background: 'rgba(0,0,0,0.07)', borderRadius: 2, overflow: 'hidden' }} title={`${cat.name}: ${cs}/${cat.questions.length * 5}`}><div style={{ height: '100%', width: cp + '%', background: cat.color, borderRadius: 2 }} /></div>
                      })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--gray-4)' }}>{resp.respondedAt?.toDate?.()?.toLocaleDateString('es-MX') || '—'}</div>
                      <button className="sa-btn sa-btn-blue sa-btn-sm" onClick={e => { e.stopPropagation(); generateAndExport(resp) }} disabled={generating[resp.id]}><Download size={13} />{generating[resp.id] ? 'Generando...' : 'Exportar'}</button>
                      {isOpen ? <ChevronDown size={15} color="var(--gray-4)" /> : <ChevronRight size={15} color="var(--gray-4)" />}
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', padding: 20 }}>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-4)' }}>Score total</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: level.color }}>{resp.totalScore} pts · {pct}%</span>
                        </div>
                        <div style={{ height: 8, background: 'rgba(0,0,0,0.07)', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: level.color, borderRadius: 4 }} /></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
                        {cats.map(cat => {
                          const cs = cat.questions.reduce((s, _, qi) => s + (resp.answers?.[`${cat.id}_${qi}`] || 1), 0)
                          const cp = Math.round((cs - cat.questions.length) / (cat.questions.length * 4) * 100)
                          const cl = diagScoreLevel(cs, cat.questions.length, cat.questions.length * 5)
                          return (
                            <div key={cat.id} style={{ background: '#f9f9f9', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10, padding: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color }} />
                                <div style={{ fontWeight: 700, fontSize: 12, flex: 1 }}>{cat.name}</div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: cl.color }}>{cs}/{cat.questions.length * 5}</div>
                              </div>
                              <div style={{ height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: cp + '%', background: cat.color, borderRadius: 3 }} /></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: 'var(--gray-4)' }}><span>{cl.label}</span><span>{cp}%</span></div>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-4)', marginBottom: 12 }}>Respuestas individuales</div>
                      {cats.map(cat => (
                        <div key={cat.id} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: cat.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color }} />{cat.name}
                          </div>
                          {cat.questions.map((q, qi) => {
                            const val = resp.answers?.[`${cat.id}_${qi}`] || 1
                            return (
                              <div key={qi} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '7px 10px', borderRadius: 7, marginBottom: 3 }}>
                                <div style={{ flex: 1, fontSize: 13, color: '#3a3a3c', lineHeight: 1.45 }}>{q}</div>
                                <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', background: SCALE_COLORS_DIAG[val] + '18', color: SCALE_COLORS_DIAG[val], border: `1px solid ${SCALE_COLORS_DIAG[val]}33` }}>{val} · {SCALE_LABELS_DIAG[val]}</div>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

function buildDiagReportHTML(resp, catSummaries, totalLevel, analysis, maxScore, minScore) {
  const pct = Math.round(((resp.totalScore || minScore) - minScore) / (maxScore - minScore) * 100)
  const date = resp.respondedAt?.toDate?.()?.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) || 'Reciente'
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Diagnóstico — ${resp.respondentName || 'Participante'}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#f5f5f7;color:#070708}.page{max-width:860px;margin:0 auto;padding:48px 24px}.header{background:#070708;border-radius:20px;padding:40px 44px;margin-bottom:24px;position:relative;overflow:hidden}.header::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 70% at 20% 50%,rgba(0,102,255,.2) 0%,transparent 60%),radial-gradient(ellipse 50% 60% at 80% 30%,rgba(124,58,237,.15) 0%,transparent 60%)}.hi{position:relative;z-index:1}.logo{display:flex;align-items:center;gap:10px;margin-bottom:28px}.lm{width:32px;height:32px;background:linear-gradient(135deg,#0066ff,#7c3aed);border-radius:9px;display:flex;align-items:center;justify-content:center}.lt{font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:800;color:white}.card{background:white;border:1px solid rgba(0,0,0,.07);border-radius:16px;padding:28px;margin-bottom:16px}.ct{font-family:'Plus Jakarta Sans',sans-serif;font-size:17px;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:10px}.ci{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}.st{font-size:15px;line-height:1.7;color:#3a3a3c}.cg{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cc{border:1px solid rgba(0,0,0,.07);border-radius:12px;padding:16px}.cn{font-size:13px;font-weight:700;margin-bottom:8px}.cb{height:6px;background:#f0f0f2;border-radius:3px;overflow:hidden;margin-bottom:6px}.cbf{height:100%;border-radius:3px}.cm{display:flex;justify-content:space-between;font-size:11px;color:#8e8e93}.footer{text-align:center;padding:32px 0 0;color:#8e8e93;font-size:13px;border-top:1px solid rgba(0,0,0,.07);margin-top:32px}</style></head><body><div class="page">
<div class="header"><div class="hi">
<div class="logo"><div class="lm"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div><span class="lt">FlowCRM</span></div>
<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:8px">Diagnóstico Comercial · ${date}</div>
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:36px;font-weight:900;color:white;letter-spacing:-1px;margin-bottom:4px">${resp.respondentName || 'Participante'}</div>
<div style="font-size:15px;color:rgba(255,255,255,.4);margin-bottom:28px">${resp.orgName || ''}</div>
<div style="display:flex;align-items:center;gap:20px">
<div><div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:52px;font-weight:900;color:white;letter-spacing:-2px;line-height:1">${resp.totalScore}<span style="font-size:18px;color:rgba(255,255,255,.35);font-weight:500">/${maxScore}</span></div>
<div style="margin-top:8px"><span style="display:inline-flex;padding:6px 18px;border-radius:20px;background:${totalLevel.color}18;color:${totalLevel.color};border:1px solid ${totalLevel.color}33;font-weight:700;font-size:14px">${totalLevel.label}</span></div></div>
<div style="flex:1"><div style="height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#0066ff,#7c3aed);border-radius:3px"></div></div>
<div style="font-size:12px;color:rgba(255,255,255,.3);margin-top:6px">${pct}% del máximo posible</div></div></div>
</div></div>

<div class="card"><div class="ct"><div class="ci" style="background:#f5f5f7">📊</div>Resultados por categoría</div>
<div class="cg">${catSummaries.map(c => { const cp = Math.round((c.score - c.min) / (c.max - c.min) * 100); return `<div class="cc"><div class="cn" style="color:${c.color}">${c.name}</div><div class="cb"><div class="cbf" style="width:${cp}%;background:${c.color}"></div></div><div class="cm"><span>${c.level.label}</span><span>${c.score}/${c.max} · ${cp}%</span></div></div>` }).join('')}</div></div>

<div class="card"><div class="ct"><div class="ci" style="background:#f0f7ff">🔍</div>Resumen ejecutivo</div><div class="st">${analysis.resumen || ''}</div></div>
<div class="card"><div class="ct"><div class="ci" style="background:#f0fdf4">💪</div>Fortalezas</div><div class="st">${analysis.fortalezas || ''}</div></div>
<div class="card"><div class="ct"><div class="ci" style="background:#fffbeb">🎯</div>Áreas de oportunidad</div><div class="st">${analysis.oportunidades || ''}</div></div>
<div class="card"><div class="ct"><div class="ci" style="background:#fdf4ff">⚡</div>Recomendaciones específicas</div><div class="st">${analysis.recomendaciones || ''}</div></div>
<div class="card" style="border-color:rgba(0,102,255,.2);background:rgba(0,102,255,.02)"><div class="ct"><div class="ci" style="background:rgba(0,102,255,.1)">🚀</div>Cómo enfocar su implementación de FlowCRM</div><div class="st">${analysis.implementacion || ''}</div></div>
<div style="background:#070708;border-radius:16px;padding:32px;text-align:center;margin-bottom:16px"><div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:900;color:white;line-height:1.3;max-width:600px;margin:0 auto">"${analysis.mensaje || ''}"</div><div style="margin-top:16px;font-size:13px;color:rgba(255,255,255,.3)">FlowCRM · Qubit Corp.</div></div>
<div class="footer">Reporte generado el ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })} · FlowCRM by Qubit Corp.</div>
</div></body></html>`
}

const diagConfigCss = `
  .dc-cat-header{display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;transition:background .15s;border-radius:14px 14px 0 0}
  .dc-cat-header:hover{background:rgba(0,0,0,.02)}
  .dc-cat-name{font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:800;flex:1;color:#070708}
  .dc-cat-name-input{flex:1;font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:800;color:#070708;border:1px solid #0066ff;border-radius:6px;padding:3px 8px;outline:none}
  .dc-icon-btn{width:27px;height:27px;border-radius:6px;border:1px solid rgba(0,0,0,.1);background:white;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--gray-4);transition:all .15s}
  .dc-icon-btn:hover{color:#070708;border-color:rgba(0,0,0,.2)}
  .dc-icon-btn-danger:hover{color:#ff3b30;border-color:rgba(255,59,48,.3);background:rgba(255,59,48,.05)}
  .dc-q-row{display:flex;align-items:flex-start;gap:10px;padding:7px 10px;border-radius:8px;margin-bottom:3px;transition:background .1s}
  .dc-q-row:hover{background:rgba(0,0,0,.02)}
  .dc-q-actions{display:flex;gap:4px;opacity:0;transition:opacity .15s}
  .dc-q-row:hover .dc-q-actions{opacity:1}
  .dc-q-textarea{flex:1;width:100%;padding:8px 10px;border:1px solid #0066ff;border-radius:8px;font-size:14px;color:#070708;font-family:'Inter',sans-serif;outline:none;resize:vertical;line-height:1.5}
  .dc-add-q-btn{display:flex;align-items:center;gap:6px;margin-top:8px;padding:7px 12px;border:1px dashed rgba(0,0,0,.15);border-radius:8px;background:transparent;color:var(--gray-4);font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .15s;width:100%}
  .dc-add-q-btn:hover{border-color:#0066ff;color:#0066ff;background:rgba(0,102,255,.03)}
  .dc-add-cat-btn{display:flex;align-items:center;gap:8px;padding:12px 20px;width:100%;border:2px dashed rgba(0,0,0,.1);border-radius:14px;background:transparent;color:var(--gray-4);font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .15s}
  .dc-add-cat-btn:hover{border-color:#0066ff;color:#0066ff;background:rgba(0,102,255,.02)}
`
const diagRespCss = `
  .dr-row-header{display:flex;align-items:center;gap:14px;padding:16px 20px;cursor:pointer;transition:background .15s;border-radius:14px}
  .dr-row-header:hover{background:rgba(0,0,0,.015)}
  .dr-avatar{width:38px;height:38px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,#0066ff,#7c3aed);display:flex;align-items:center;justify-content:center;font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:800;color:white}
`

// ─── MAIN SUPERADMIN ───
export default function Superadmin() {
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [logging, setLogging] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [orgs, setOrgs] = useState([])
  const [resellers, setResellers] = useState([])

  const login = async () => {
    setLogging(true)
    try {
      if (email === SA_EMAIL && password === SA_PASSWORD) {
        setAuthed(true)
        toast.success('Bienvenido, Agustín')
      } else {
        toast.error('Credenciales incorrectas')
      }
    } finally { setLogging(false) }
  }

  useEffect(() => {
    if (!authed) return
    const q1 = query(collection(db, 'organizations'), orderBy('createdAt', 'desc'))
    const unsub1 = onSnapshot(q1, snap => setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const q2 = query(collection(db, 'resellers'), orderBy('createdAt', 'desc'))
    const unsub2 = onSnapshot(q2, snap => setResellers(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return () => { unsub1(); unsub2() }
  }, [authed])

  const NAV = [
    { id: 'dashboard', icon: <Zap size={16} />, label: 'Dashboard' },
    { id: 'orgs', icon: <Building2 size={16} />, label: 'Organizaciones' },
    { id: 'resellers', icon: <Handshake size={16} />, label: 'Resellers' },
    { id: 'plans', icon: <Package size={16} />, label: 'Planes' },
    { id: 'apis', icon: <Key size={16} />, label: 'APIs por cliente' },
    { id: 'quoter', icon: <ClipboardList size={16} />, label: 'Cotizador' },
    { id: 'implementations', icon: <Calendar size={16} />, label: 'Implementaciones' },
    { id: 'support', icon: <Ticket size={16} />, label: 'Soporte' },
    { id: 'onboarding', icon: '📋', label: 'Formularios' },
    { id: 'diag_config', icon: <ClipboardList size={16} />, label: 'Diagnóstico' },
    { id: 'diag_resp', icon: <BarChart size={16} />, label: 'Respuestas Diag.' },
  ]

  const TITLES = { dashboard: 'Dashboard', orgs: 'Organizaciones', resellers: 'Resellers', plans: 'Diseño de planes', apis: 'Configuración de APIs', quoter: 'Cotizador', implementations: 'Implementaciones', support: 'Soporte técnico', onboarding: 'Formularios de bienvenida', diag_config: 'Diagnóstico — Configuración', diag_resp: 'Diagnóstico — Respuestas' }

  if (!authed) {
    return (
      <div className="sa-root">
        <style>{css}</style>
        <div className="sa-login">
          <div className="sa-login-card">
            <div className="sa-login-logo" style={{ flexDirection: "column" }}><img src="/qubit-corp.png" alt="Logo" style={{ height: 72, objectFit: "contain" }} /><span className="sa-logo-badge" style={{ marginTop: 8 }}>Superadmin</span></div><div className="sa-login-title">Acceso restringido</div>
            <div className="sa-login-sub">Solo para administradores.</div>
            <input className="sa-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
            <input className="sa-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} />
            <button className="sa-btn-primary" onClick={login} disabled={logging}>{logging ? 'Verificando...' : 'Entrar'}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sa-root">
      <style>{css}</style>
      <div className="sa-layout">
        {/* Sidebar */}
        <div className="sa-sidebar">
          <div className="sa-sidebar-header">
            <div className="sa-login-logo" style={{ justifyContent: "flex-start", margin: 0, marginBottom: 4 }}><img src="/qubit-corp.png" alt="Logo" style={{ height: 36, objectFit: "contain" }} /></div><div style={{ fontSize: 12, color: 'var(--gray-5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Superadmin</div>
          </div>

          <div className="sa-nav">
            <div className="sa-nav-section">General</div>
            {NAV.map(n => (
              <button key={n.id} className={clsx('sa-nav-item', activeTab === n.id && 'active')} onClick={() => setActiveTab(n.id)}>
                <span className="sa-nav-icon">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>

          <div className="sa-sidebar-footer">
            <button className="sa-logout" onClick={() => setAuthed(false)}>
              <LogOut size={14} /> Cerrar sesión
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="sa-main">
          <div className="sa-topbar">
            <div className="sa-topbar-title">{TITLES[activeTab]}</div>
            <div className="sa-topbar-sub">{orgs.length} orgs · {resellers.length} resellers</div>
          </div>

          {activeTab === 'dashboard' && <Dashboard orgs={orgs} resellers={resellers} />}
          {activeTab === 'orgs' && <Organizations orgs={orgs} resellers={resellers} onRefresh={() => { }} />}
          {activeTab === 'resellers' && <Resellers resellers={resellers} orgs={orgs} onRefresh={() => { }} />}
          {activeTab === 'plans' && <Plans />}
          {activeTab === 'apis' && <ApiConfig orgs={orgs} />}
          {activeTab === 'quoter' && <Quoter />}
          {activeTab === 'implementations' && <ImplementationPortal />}
          {activeTab === 'support' && <SupportTickets />}
          {activeTab === 'onboarding' && <OnboardingResponses />}
          {activeTab === 'diag_config' && <DiagnosticoConfig orgs={orgs} />}
          {activeTab === 'diag_resp' && <DiagnosticoResponses orgs={orgs} />}
        </div>
      </div>
    </div>
  )
}
