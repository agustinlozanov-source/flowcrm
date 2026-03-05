import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy, doc, setDoc,
  updateDoc, deleteDoc, addDoc, serverTimestamp, getDoc, getDocs
} from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Target, MessageSquare, Bot, Clapperboard, Globe, BarChart, Gift, Zap, Building2, Handshake, Package, Key, ClipboardList, Save, Download, CreditCard, Hourglass, LogOut, Smartphone, Check, Calendar, Ticket } from 'lucide-react'
import ImplementationPortal from './ImplementationPortal'
import SupportTickets from './SupportTickets'
import OnboardingResponses from './OnboardingResponses'

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
  ]

  const TITLES = { dashboard: 'Dashboard', orgs: 'Organizaciones', resellers: 'Resellers', plans: 'Diseño de planes', apis: 'Configuración de APIs', quoter: 'Cotizador', implementations: 'Implementaciones', support: 'Soporte técnico', onboarding: 'Formularios de bienvenida' }

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
        </div>
      </div>
    </div>
  )
}
