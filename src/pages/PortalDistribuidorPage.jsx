import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import {
  LayoutDashboard, UserCircle, Target, BarChart2, Users, Banknote,
  FileText, BookOpen, ShoppingBag, HelpCircle, LogOut, Crown, Bell,
  Sun, Moon, TrendingUp, ArrowUpRight, Clock, Gift, CheckCircle,
  Calendar, Star, Building2, UserPlus, Percent, List, Upload, FileUp,
  Landmark, ShieldCheck, AlertCircle, Folder, FileCheck, Download,
  PlayCircle, Play, MessageSquare, Presentation, Shield, Image,
  ShoppingCart, MessageCircle, Book, Save, Share2, User, Mail, Phone,
  MapPin, Hash, Camera
} from 'lucide-react'

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');

  [data-theme-portal] *, [data-theme-portal] *::before, [data-theme-portal] *::after {
    box-sizing: border-box; margin: 0; padding: 0;
  }

  [data-theme-portal] {
    --blue: #0066ff; --blue-light: rgba(0,102,255,0.10);
    --green: #00c853; --green-light: rgba(0,200,83,0.10);
    --purple: #7c3aed; --purple-light: rgba(124,58,237,0.10);
    --amber: #ff9500; --amber-light: rgba(255,149,0,0.10);
    --red: #ff3b30; --red-light: rgba(255,59,48,0.10);
    --radius: 14px; --radius-sm: 9px; --sidebar-w: 240px;
    font-family: 'Inter', sans-serif; line-height: 1.6;
  }

  [data-theme-portal="dark"] {
    --bg: #070708; --bg2: #0d0d10; --bg3: #141416;
    --surface: rgba(255,255,255,0.03); --surface-hover: rgba(255,255,255,0.055);
    --border: rgba(255,255,255,0.08); --border-strong: rgba(255,255,255,0.13);
    --text: #ffffff; --text-2: #c7c7cc; --text-3: #8e8e93; --text-4: #3a3a3c;
    --sidebar-bg: #0a0a0c;
    background: #070708; color: #ffffff;
  }

  [data-theme-portal="light"] {
    --bg: #f5f5f7; --bg2: #ffffff; --bg3: #ebebef;
    --surface: rgba(0,0,0,0.03); --surface-hover: rgba(0,0,0,0.055);
    --border: rgba(0,0,0,0.08); --border-strong: rgba(0,0,0,0.14);
    --text: #070708; --text-2: #3a3a3c; --text-3: #6e6e73; --text-4: #c7c7cc;
    --sidebar-bg: #ffffff;
    background: #f5f5f7; color: #070708;
  }

  .p-sidebar {
    width: var(--sidebar-w); min-height: 100vh; background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    position: fixed; top: 0; left: 0;
    display: flex; flex-direction: column; z-index: 50;
    transition: background 0.3s;
  }

  .p-sidebar-logo {
    padding: 20px 20px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
  }

  .p-logo-text {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px; font-weight: 800; color: var(--text);
    letter-spacing: -0.3px; line-height: 1.2;
  }

  .p-logo-sub { font-size: 10px; color: var(--text-3); font-weight: 500; }

  .p-sidebar-profile {
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
    cursor: pointer; transition: background 0.15s;
  }
  .p-sidebar-profile:hover { background: var(--surface-hover); }

  .p-profile-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: linear-gradient(135deg, var(--blue), var(--purple));
    display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 800;
    color: white; flex-shrink: 0;
  }

  .p-profile-name { font-size: 13px; font-weight: 700; color: var(--text); line-height: 1.3; }
  .p-profile-level { font-size: 11px; color: var(--amber); font-weight: 600; display: flex; align-items: center; gap: 4px; }

  .p-sidebar-nav { flex: 1; padding: 12px 10px; overflow-y: auto; }

  .p-nav-group-label {
    font-size: 10px; font-weight: 700; color: var(--text-4);
    text-transform: uppercase; letter-spacing: 0.1em;
    padding: 6px 10px 4px; margin-top: 8px;
  }

  .p-nav-item {
    display: flex; align-items: center; gap: 10px; padding: 9px 10px;
    border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s;
    font-size: 13.5px; font-weight: 500; color: var(--text-3);
    text-decoration: none; border: none; background: none; width: 100%; text-align: left;
  }
  .p-nav-item:hover { background: var(--surface-hover); color: var(--text); }
  .p-nav-item.active { background: var(--blue-light); color: var(--blue); font-weight: 600; }
  .p-nav-item svg { flex-shrink: 0; width: 16px; height: 16px; }

  .p-nav-badge {
    margin-left: auto; background: var(--blue); color: white;
    font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; line-height: 1.4;
  }
  .p-nav-badge.green { background: var(--green); }
  .p-nav-badge.amber { background: var(--amber); }

  .p-sidebar-bottom {
    padding: 12px 10px; border-top: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 2px;
  }

  .p-main { margin-left: var(--sidebar-w); flex: 1; min-height: 100vh; display: flex; flex-direction: column; }

  .p-topbar {
    height: 56px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; padding: 0 32px; gap: 16px;
    background: var(--bg); position: sticky; top: 0; z-index: 40;
  }

  .p-topbar-title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 15px; font-weight: 800; letter-spacing: -0.3px;
  }

  .p-topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }

  .p-icon-btn {
    width: 32px; height: 32px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--surface);
    color: var(--text-3); display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.15s; position: relative;
  }
  .p-icon-btn:hover { background: var(--surface-hover); color: var(--text); }
  .p-notif-dot {
    position: absolute; top: 6px; right: 6px; width: 7px; height: 7px;
    background: var(--red); border-radius: 50%; border: 2px solid var(--bg);
  }

  .p-content { flex: 1; padding: 28px 32px; }

  .p-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius); transition: border-color 0.15s;
  }
  .p-card-p { padding: 24px; }

  .p-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .p-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .p-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .p-mb-16 { margin-bottom: 16px; }
  .p-mb-24 { margin-bottom: 24px; }
  .p-mb-32 { margin-bottom: 32px; }

  .p-label-sm {
    font-size: 11px; font-weight: 700; color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.08em;
    margin-bottom: 4px; display: flex; align-items: center; gap: 6px;
  }

  .p-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 6px;
  }
  .p-badge-blue { background: var(--blue-light); color: var(--blue); }
  .p-badge-green { background: var(--green-light); color: var(--green); }
  .p-badge-amber { background: var(--amber-light); color: var(--amber); }
  .p-badge-red { background: var(--red-light); color: var(--red); }
  .p-badge-purple { background: var(--purple-light); color: var(--purple); }

  .p-progress-wrap {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 6px; height: 8px; overflow: hidden;
  }
  .p-progress-fill { height: 100%; border-radius: 6px; transition: width 0.8s ease; }

  .p-stat-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px;
  }
  .p-stat-label {
    font-size: 12px; font-weight: 600; color: var(--text-3);
    margin-bottom: 8px; display: flex; align-items: center; gap: 6px;
  }
  .p-stat-label svg { width: 14px; height: 14px; }
  .p-stat-value {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 28px; font-weight: 900; letter-spacing: -1px;
    line-height: 1; margin-bottom: 6px;
  }
  .p-stat-sub { font-size: 12px; color: var(--text-3); }
  .p-stat-trend { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; margin-top: 8px; }
  .p-trend-up { color: var(--green); }

  .p-table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); }
  .p-table-wrap table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .p-table-wrap thead th {
    background: var(--bg2); padding: 12px 16px; text-align: left;
    font-size: 11px; font-weight: 700; color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.08em;
    border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  .p-table-wrap tbody td {
    padding: 13px 16px; border-bottom: 1px solid var(--border);
    color: var(--text-2); vertical-align: middle;
  }
  .p-table-wrap tbody tr:last-child td { border-bottom: none; }
  .p-table-wrap tbody tr:hover td { background: var(--surface); }

  .p-page-header { margin-bottom: 24px; }
  .p-page-title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 22px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 4px;
  }
  .p-page-sub { font-size: 14px; color: var(--text-3); }

  .p-timeline-item {
    display: flex; gap: 16px; padding: 12px 20px;
    border-bottom: 1px solid var(--border); align-items: flex-start;
  }
  .p-timeline-item:last-child { border-bottom: none; }
  .p-timeline-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
  .p-timeline-content { flex: 1; }
  .p-timeline-title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
  .p-timeline-sub { font-size: 12.5px; color: var(--text-3); }
  .p-timeline-amount {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 16px; font-weight: 800; letter-spacing: -0.3px;
    text-align: right; flex-shrink: 0;
  }

  .p-prospect-row {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px;
    border-bottom: 1px solid var(--border); transition: background 0.15s; cursor: pointer;
  }
  .p-prospect-row:last-child { border-bottom: none; }
  .p-prospect-row:hover { background: var(--surface); }
  .p-prospect-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 800;
    color: white; flex-shrink: 0;
  }
  .p-prospect-name { font-size: 13.5px; font-weight: 600; }
  .p-prospect-sub { font-size: 12px; color: var(--text-3); }

  .p-profile-header {
    background: linear-gradient(135deg, rgba(0,102,255,0.08), rgba(124,58,237,0.05));
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: 36px; margin-bottom: 16px; position: relative; overflow: hidden;
  }
  .p-profile-header::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--blue), var(--purple));
  }
  .p-profile-avatar-lg {
    width: 88px; height: 88px; border-radius: 50%;
    background: linear-gradient(135deg, var(--blue), var(--purple));
    display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 32px; font-weight: 900;
    color: white; margin-bottom: 16px; border: 3px solid var(--border-strong);
    position: relative; overflow: hidden;
  }
  .p-profile-name-lg {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 26px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 4px;
  }
  .p-profile-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
  .p-profile-meta-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-3); }
  .p-level-pill {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(255,149,0,0.1); border: 1px solid rgba(255,149,0,0.2);
    border-radius: 20px; padding: 5px 14px; font-size: 12.5px; font-weight: 700; color: var(--amber);
  }
  .p-profile-stats {
    display: flex; gap: 32px; margin-top: 24px; padding-top: 24px;
    border-top: 1px solid var(--border); flex-wrap: wrap;
  }
  .p-profile-stat-value {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 22px; font-weight: 900; letter-spacing: -0.5px; line-height: 1; margin-bottom: 4px;
  }
  .p-profile-stat-label { font-size: 12px; color: var(--text-3); font-weight: 500; }

  .p-form-group { margin-bottom: 16px; }
  .p-form-label {
    display: block; font-size: 12px; font-weight: 600; color: var(--text-3);
    margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em;
  }
  .p-form-input {
    width: 100%; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-sm); padding: 10px 14px; font-size: 14px;
    color: var(--text); font-family: 'Inter', sans-serif; outline: none; transition: border-color 0.15s;
  }
  .p-form-input:focus { border-color: var(--blue); }

  .p-btn-sm {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px;
    border-radius: 8px; font-size: 12.5px; font-weight: 600;
    cursor: pointer; border: none; font-family: 'Inter', sans-serif; transition: all 0.15s;
  }
  .p-btn-primary { background: var(--blue); color: white; }
  .p-btn-primary:hover { opacity: 0.88; }
  .p-btn-ghost { background: var(--surface); border: 1px solid var(--border); color: var(--text-2); }
  .p-btn-ghost:hover { background: var(--surface-hover); color: var(--text); }

  .p-card-header {
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .p-card-header-title {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 800;
  }

  .p-doc-item {
    display: flex; align-items: center; gap: 14px; padding: 16px;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    transition: all 0.15s; margin-bottom: 10px;
  }
  .p-doc-item:hover { background: var(--surface-hover); }
  .p-doc-icon {
    width: 40px; height: 40px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .p-doc-name { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
  .p-doc-sub { font-size: 12px; color: var(--text-3); }
  .p-doc-action { margin-left: auto; display: flex; align-items: center; gap: 8px; }

  .p-video-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden; transition: all 0.18s; cursor: pointer;
  }
  .p-video-card:hover { border-color: var(--border-strong); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
  .p-video-thumb {
    height: 140px; display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .p-video-play {
    width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,255,255,0.95);
    display: flex; align-items: center; justify-content: center; z-index: 1;
    transition: transform 0.15s;
  }
  .p-video-card:hover .p-video-play { transform: scale(1.1); }
  .p-video-info { padding: 16px; }
  .p-video-tag { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
  .p-video-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 700; line-height: 1.4; margin-bottom: 8px; }
  .p-video-meta { font-size: 12px; color: var(--text-3); display: flex; align-items: center; gap: 8px; }

  .p-resource-item {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    margin-bottom: 8px; transition: all 0.15s; cursor: pointer;
  }
  .p-resource-item:last-child { margin-bottom: 0; }
  .p-resource-item:hover { background: var(--surface-hover); border-color: var(--border-strong); }
  .p-resource-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .p-resource-name { font-size: 13.5px; font-weight: 600; }
  .p-resource-meta { font-size: 12px; color: var(--text-3); }
  .p-resource-dl { margin-left: auto; color: var(--text-3); }

  .p-store-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden; transition: all 0.18s;
  }
  .p-store-card:hover { border-color: var(--border-strong); transform: translateY(-2px); }
  .p-store-img {
    height: 180px; display: flex; align-items: center; justify-content: center;
    font-size: 56px; border-bottom: 1px solid var(--border);
  }
  .p-store-info { padding: 16px; }
  .p-store-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .p-store-desc { font-size: 12.5px; color: var(--text-3); margin-bottom: 12px; line-height: 1.5; }
  .p-store-footer { display: flex; align-items: center; justify-content: space-between; }
  .p-store-price { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }

  @media (max-width: 768px) {
    .p-sidebar { transform: translateX(-100%); }
    .p-main { margin-left: 0; }
    .p-grid-4 { grid-template-columns: repeat(2,1fr); }
    .p-grid-3 { grid-template-columns: 1fr; }
    .p-grid-2 { grid-template-columns: 1fr; }
  }
`

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  perfil: 'Mi perfil',
  scorecard: 'Scorecard Q2',
  ventas: 'Mis ventas',
  prospectos: 'Prospectos',
  cobros: 'Cobros',
  documentos: 'Documentos',
  academia: 'Academia',
  tienda: 'Tienda Flow Hub',
  soporte: 'Soporte',
}

export default function PortalDistribuidorPage() {
  const [theme, setTheme] = useState('dark')
  const [activePage, setActivePage] = useState('dashboard')
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await signOut(auth)
      navigate('/login')
    } catch (err) {
      console.error('Error logging out:', err)
    }
  }

  const nav = (page) => () => setActivePage(page)

  return (
    <div data-theme-portal={theme} style={{ display: 'flex', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* SIDEBAR */}
      <aside className="p-sidebar">
        <div className="p-sidebar-logo">
          <img src="/logo.png" alt="Flow Hub CRM" style={{ height: '22px', objectFit: 'contain', flexShrink: 0 }} />
          <div>
            <div className="p-logo-text">Flow Hub CRM</div>
            <div className="p-logo-sub">Portal Distribuidores</div>
          </div>
        </div>

        <div className="p-sidebar-profile" onClick={nav('perfil')}>
          <div className="p-profile-avatar"><span>AL</span></div>
          <div>
            <div className="p-profile-name">Agustín Lozano</div>
            <div className="p-profile-level"><Crown size={11} /> Senior</div>
          </div>
        </div>

        <nav className="p-sidebar-nav">
          <div className="p-nav-group-label">Principal</div>
          <button className={`p-nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={nav('dashboard')}><LayoutDashboard />Dashboard</button>
          <button className={`p-nav-item ${activePage === 'perfil' ? 'active' : ''}`} onClick={nav('perfil')}><UserCircle />Mi perfil</button>
          <button className={`p-nav-item ${activePage === 'scorecard' ? 'active' : ''}`} onClick={nav('scorecard')}>
            <Target />Scorecard<span className="p-nav-badge green">Q2</span>
          </button>

          <div className="p-nav-group-label">Ventas</div>
          <button className={`p-nav-item ${activePage === 'ventas' ? 'active' : ''}`} onClick={nav('ventas')}><BarChart2 />Mis ventas</button>
          <button className={`p-nav-item ${activePage === 'prospectos' ? 'active' : ''}`} onClick={nav('prospectos')}>
            <Users />Prospectos<span className="p-nav-badge">7</span>
          </button>

          <div className="p-nav-group-label">Finanzas</div>
          <button className={`p-nav-item ${activePage === 'cobros' ? 'active' : ''}`} onClick={nav('cobros')}>
            <Banknote />Cobros<span className="p-nav-badge amber">$24K</span>
          </button>
          <button className={`p-nav-item ${activePage === 'documentos' ? 'active' : ''}`} onClick={nav('documentos')}><FileText />Documentos</button>

          <div className="p-nav-group-label">Recursos</div>
          <button className={`p-nav-item ${activePage === 'academia' ? 'active' : ''}`} onClick={nav('academia')}><BookOpen />Academia</button>
          <button className={`p-nav-item ${activePage === 'tienda' ? 'active' : ''}`} onClick={nav('tienda')}><ShoppingBag />Tienda Flow Hub</button>
        </nav>

        <div className="p-sidebar-bottom">
          <button className={`p-nav-item ${activePage === 'soporte' ? 'active' : ''}`} onClick={nav('soporte')}><HelpCircle />Soporte</button>
          <button className="p-nav-item" style={{ color: 'var(--text-3)' }} onClick={handleLogout}><LogOut />Cerrar sesión</button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="p-main">
        <header className="p-topbar">
          <div className="p-topbar-title">{PAGE_TITLES[activePage]}</div>
          <div className="p-topbar-right">
            <button className="p-icon-btn" title="Notificaciones">
              <Bell size={15} />
              <span className="p-notif-dot" />
            </button>
            <button className="p-icon-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Cambiar tema">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        <div className="p-content">

          {/* ── DASHBOARD ── */}
          {activePage === 'dashboard' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Bienvenido, Agustín 👋</div>
                <div className="p-page-sub">Aquí está tu resumen del día — Viernes 11 de Abril, 2026</div>
              </div>

              <div className="p-grid-4 p-mb-24">
                {[
                  { label: 'Ventas este trimestre', icon: <TrendingUp />, value: '9', valueColor: 'var(--green)', sub: 'Implementaciones cerradas', trend: '+3 vs trimestre anterior', trendClass: 'p-trend-up', trendIcon: <ArrowUpRight size={13} /> },
                  { label: 'Prospectos activos', icon: <Users />, value: '7', valueColor: 'var(--blue)', sub: 'En pipeline actualmente', trend: '2 a punto de cerrar', trendClass: 'p-trend-up', trendIcon: <ArrowUpRight size={13} /> },
                  { label: 'Por cobrar', icon: <Banknote />, value: '$24K', valueColor: 'var(--amber)', sub: 'MXN pendientes', trend: 'Cobras el día 10', trendStyle: { color: 'var(--amber)' }, trendIcon: <Clock size={13} /> },
                  { label: 'Puntos Q2', icon: <Target />, value: '21', valueColor: 'var(--purple)', sub: 'de 18 para bono Senior ✓', trend: 'Bono $35,000 MXN ganado', trendClass: 'p-trend-up', trendIcon: <Gift size={13} /> },
                ].map((s, i) => (
                  <div className="p-stat-card" key={i}>
                    <div className="p-stat-label">{s.icon}{s.label}</div>
                    <div className="p-stat-value" style={{ color: s.valueColor }}>{s.value}</div>
                    <div className="p-stat-sub">{s.sub}</div>
                    <div className={`p-stat-trend ${s.trendClass || ''}`} style={s.trendStyle}>{s.trendIcon}{s.trend}</div>
                  </div>
                ))}
              </div>

              {/* Progress trimestral */}
              <div className="p-card p-card-p p-mb-16">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div className="p-label-sm"><Calendar size={12} />Progreso Q2 2026 — Trimestre de Consolidación</div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', marginTop: 4 }}>21 puntos acumulados</div>
                  </div>
                  <div className="p-badge p-badge-green"><CheckCircle size={12} />Bono Senior desbloqueado</div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Asociado (8 pts)</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Senior (18 pts)</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Elite (30 pts)</span>
                  </div>
                  <div className="p-progress-wrap" style={{ height: 10 }}>
                    <div className="p-progress-fill" style={{ width: '70%', background: 'linear-gradient(90deg,var(--green),var(--blue))' }} />
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8 }}>9 puntos más para alcanzar nivel Elite y desbloquear bono de $70,000 MXN</div>
              </div>

              <div className="p-grid-2">
                {/* Actividad reciente */}
                <div className="p-card">
                  <div className="p-card-header"><div className="p-card-header-title">Actividad reciente</div></div>
                  <div style={{ padding: '8px 0' }}>
                    {[
                      { color: 'var(--green)', title: 'Implementación cerrada — Grupo Avalluo', sub: 'Cliente raíz · Hoy, 10:30 AM', amount: '+$8K', amountColor: 'var(--green)' },
                      { color: 'var(--blue)', title: 'Nuevo prospecto — María González', sub: 'Interesada en Plan Equipo · Ayer', amount: 'Pipeline', amountColor: 'var(--blue)' },
                      { color: 'var(--amber)', title: 'Cobro procesado — Quincenal', sub: 'Transferencia recibida · 5 Abr', amount: '$11K', amountColor: 'var(--amber)' },
                      { color: 'var(--green)', title: 'Implementación cerrada — Dist. Ramírez', sub: 'Distribuidor · 3 Abr', amount: '+$4K', amountColor: 'var(--green)' },
                    ].map((t, i) => (
                      <div className="p-timeline-item" key={i}>
                        <div className="p-timeline-dot" style={{ background: t.color }} />
                        <div className="p-timeline-content">
                          <div className="p-timeline-title">{t.title}</div>
                          <div className="p-timeline-sub">{t.sub}</div>
                        </div>
                        <div className="p-timeline-amount" style={{ color: t.amountColor }}>{t.amount}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prospectos calientes */}
                <div className="p-card">
                  <div className="p-card-header">
                    <div className="p-card-header-title">Prospectos calientes</div>
                    <button className="p-btn-sm p-btn-ghost" onClick={nav('prospectos')}>Ver todos</button>
                  </div>
                  {[
                    { initials: 'CM', name: 'Carlos Medina', sub: 'Interesado en raíz · Plan Red', badgeClass: 'p-badge-green', stage: 'A punto de cerrar', bg: 'var(--blue)' },
                    { initials: 'MG', name: 'María González', sub: 'Distribuidor · Plan Equipo', badgeClass: 'p-badge-amber', stage: 'Demo agendada', bg: 'var(--purple)' },
                    { initials: 'LR', name: 'Luis Reyes', sub: 'Raíz nueva · Plan Agencia', badgeClass: 'p-badge-blue', stage: 'En conversación', bg: 'var(--amber)' },
                    { initials: 'AP', name: 'Ana Pedraza', sub: 'Distribuidor · Plan Solo', badgeClass: 'p-badge-blue', stage: 'En conversación', bg: 'var(--green)' },
                    { initials: 'JH', name: 'Jorge Hernández', sub: 'Raíz · Evaluando planes', badgeClass: '', stage: 'Nuevo', bg: '#555' },
                  ].map((p, i) => (
                    <div className="p-prospect-row" key={i}>
                      <div className="p-prospect-avatar" style={{ background: p.bg }}>{p.initials}</div>
                      <div>
                        <div className="p-prospect-name">{p.name}</div>
                        <div className="p-prospect-sub">{p.sub}</div>
                      </div>
                      <div className={`p-badge ${p.badgeClass}`} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, ...(p.badgeClass === '' ? { background: 'var(--surface)', color: 'var(--text-3)' } : {}) }}>{p.stage}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PERFIL ── */}
          {activePage === 'perfil' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Mi perfil</div>
                <div className="p-page-sub">Tu información como distribuidor oficial de Flow Hub CRM</div>
              </div>
              <div className="p-profile-header p-mb-16">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
                  <div className="p-profile-avatar-lg">AL</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div className="p-profile-name-lg">Agustín Lozano</div>
                      <div className="p-level-pill"><Crown size={13} />Senior · 9 implementaciones</div>
                    </div>
                    <div className="p-profile-meta">
                      <div className="p-profile-meta-item"><Mail size={14} />hola@agustinlozano.com</div>
                      <div className="p-profile-meta-item"><Phone size={14} />+52 868 302 8939</div>
                      <div className="p-profile-meta-item"><MapPin size={14} />Monterrey, México</div>
                      <div className="p-profile-meta-item"><Calendar size={14} />Miembro desde Enero 2026</div>
                    </div>
                    <div className="p-profile-meta" style={{ marginTop: 12 }}>
                      <div className="p-profile-meta-item"><Hash size={14} />Código: <strong style={{ color: 'var(--text)' }}>FH-2026-0042</strong></div>
                      <div className="p-badge p-badge-green"><ShieldCheck size={11} />Verificado</div>
                    </div>
                  </div>
                </div>
                <div className="p-profile-stats">
                  {[['9', 'Implementaciones', 'var(--green)'], ['$71K', 'Ganado total MXN', 'var(--blue)'], ['21', 'Puntos Q2', 'var(--purple)'], ['67%', 'Tasa de conversión', 'var(--amber)']].map(([val, label, color]) => (
                    <div key={label}>
                      <div className="p-profile-stat-value" style={{ color }}>{val}</div>
                      <div className="p-profile-stat-label">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-grid-2">
                <div className="p-card p-card-p">
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={16} color="var(--blue)" />Información personal
                  </div>
                  {[['Nombre completo', 'text', 'Agustín Lozano'], ['Email', 'email', 'hola@agustinlozano.com'], ['Teléfono', 'tel', '+52 868 302 8939'], ['Ciudad', 'text', 'Monterrey, México']].map(([label, type, val]) => (
                    <div className="p-form-group" key={label}>
                      <label className="p-form-label">{label}</label>
                      <input className="p-form-input" type={type} defaultValue={val} />
                    </div>
                  ))}
                  <button className="p-btn-sm p-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 10 }}><Save size={14} />Guardar cambios</button>
                </div>
                <div className="p-card p-card-p">
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Share2 size={16} color="var(--purple)" />Redes sociales
                  </div>
                  {[['Instagram', '@tu_usuario'], ['Facebook', 'facebook.com/tu_perfil'], ['TikTok', '@tu_usuario'], ['LinkedIn', 'linkedin.com/in/tu_perfil']].map(([label, ph]) => (
                    <div className="p-form-group" key={label}>
                      <label className="p-form-label">{label}</label>
                      <input className="p-form-input" placeholder={ph} />
                    </div>
                  ))}
                  <button className="p-btn-sm p-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 10 }}><Save size={14} />Guardar redes</button>
                </div>
              </div>
            </div>
          )}

          {/* ── SCORECARD ── */}
          {activePage === 'scorecard' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Scorecard Q2 2026</div>
                <div className="p-page-sub">Trimestre de Consolidación · Abril – Junio 2026</div>
              </div>
              <div className="p-card p-card-p p-mb-16" style={{ background: 'linear-gradient(135deg,rgba(0,200,83,0.08),var(--bg2))', borderColor: 'rgba(0,200,83,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--green-light)', border: '2px solid rgba(0,200,83,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Gift size={32} color="var(--green)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="p-badge p-badge-green" style={{ marginBottom: 8 }}><CheckCircle size={12} />Bono Senior desbloqueado</div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 4 }}>$35,000 MXN garantizados</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-3)' }}>Se suma a tus comisiones al cierre del trimestre el 30 de Junio 2026</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Siguiente nivel</div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 900, color: 'var(--amber)' }}>9 pts para Elite</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Bono adicional $35,000 MXN</div>
                  </div>
                </div>
              </div>
              <div className="p-grid-4 p-mb-16">
                {[
                  { icon: <Star />, label: 'Puntos Q2', value: '21', color: 'var(--purple)', sub: 'de 30 para Elite', progress: true },
                  { icon: <Building2 />, label: 'Raíces cerradas', value: '5', color: 'var(--green)', sub: '× $10,000 = $50,000 MXN' },
                  { icon: <UserPlus />, label: 'Distribuidores cerrados', value: '4', color: 'var(--blue)', sub: '× $4,000 = $16,000 MXN' },
                  { icon: <Percent />, label: 'Conversión', value: '67%', color: 'var(--amber)', sub: '9 de 13 prospectos' },
                ].map((s, i) => (
                  <div className="p-stat-card" key={i}>
                    <div className="p-stat-label">{s.icon}{s.label}</div>
                    <div className="p-stat-value" style={{ color: s.color }}>{s.value}</div>
                    <div className="p-stat-sub">{s.sub}</div>
                    {s.progress && <div className="p-progress-wrap" style={{ marginTop: 10 }}><div className="p-progress-fill" style={{ width: '70%', background: 'var(--purple)' }} /></div>}
                  </div>
                ))}
              </div>
              <div className="p-card p-card-p p-mb-16">
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Target size={16} color="var(--amber)" />Velocidad de pago — Semana actual
                </div>
                <div className="p-grid-3">
                  {[
                    { label: 'Meta semanal', value: '2 ventas', sub: 'Nivel Senior', borderColor: 'var(--border)', bg: 'transparent', textColor: 'var(--text)', labelColor: 'var(--text-3)' },
                    { label: 'Avance esta semana', value: '1 / 2', sub: '50% completado', borderColor: 'rgba(0,200,83,0.2)', bg: 'var(--green-light)', textColor: 'var(--green)', labelColor: 'var(--green)' },
                    { label: 'Cobras el', value: 'Día 10', sub: 'Si cierras 1 más → Viernes', borderColor: 'rgba(255,149,0,0.2)', bg: 'var(--amber-light)', textColor: 'var(--amber)', labelColor: 'var(--amber)' },
                  ].map((c, i) => (
                    <div key={i} style={{ textAlign: 'center', padding: 20, border: `1px solid ${c.borderColor}`, borderRadius: 'var(--radius-sm)', background: c.bg }}>
                      <div style={{ fontSize: 12, color: c.labelColor, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
                      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: '-1px', color: c.textColor }}>{c.value}</div>
                      <div style={{ fontSize: 12, color: c.labelColor, marginTop: 4 }}>{c.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-card">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800 }}>Historial de puntos Q2</div>
                </div>
                <div className="p-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead><tr><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Comisión</th><th>Puntos</th><th>Acumulado</th></tr></thead>
                    <tbody>
                      {[
                        ['11 Abr', 'Grupo Avalluo', 'purple', 'Raíz', '$10,000', '+3', '21'],
                        ['3 Abr', 'Dist. Ramírez', 'blue', 'Distribuidor', '$4,000', '+1', '18'],
                        ['28 Mar', 'Scaling Master', 'purple', 'Raíz', '$10,000', '+3', '17'],
                        ['20 Mar', 'Dist. Torres', 'blue', 'Distribuidor', '$4,000', '+1', '14'],
                      ].map(([date, client, type, typeLabel, com, pts, acc]) => (
                        <tr key={date + client}>
                          <td style={{ color: 'var(--text-3)' }}>{date}</td>
                          <td><strong>{client}</strong></td>
                          <td><span className={`p-badge p-badge-${type}`}>{typeLabel}</span></td>
                          <td style={{ color: 'var(--green)', fontWeight: 700 }}>+{com}</td>
                          <td style={{ fontWeight: 700, color: 'var(--purple)' }}>{pts}</td>
                          <td style={{ fontWeight: 700 }}>{acc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── VENTAS ── */}
          {activePage === 'ventas' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Mis ventas</div>
                <div className="p-page-sub">Historial completo de implementaciones cerradas</div>
              </div>
              <div className="p-grid-3 p-mb-24">
                {[
                  { icon: <CheckCircle />, label: 'Total cerradas', value: '9', color: 'var(--green)', sub: 'Implementaciones 2026' },
                  { icon: <Banknote />, label: 'Total ganado', value: '$71K', color: 'var(--amber)', sub: 'MXN en comisiones' },
                  { icon: <Percent />, label: 'Ticket promedio', value: '$7.9K', color: 'var(--blue)', sub: 'MXN por venta' },
                ].map((s, i) => (
                  <div className="p-stat-card" key={i}>
                    <div className="p-stat-label">{s.icon}{s.label}</div>
                    <div className="p-stat-value" style={{ color: s.color }}>{s.value}</div>
                    <div className="p-stat-sub">{s.sub}</div>
                  </div>
                ))}
              </div>
              <div className="p-card p-table-wrap">
                <table>
                  <thead><tr><th>Fecha</th><th>Cliente</th><th>Plan</th><th>Tipo</th><th>Implementación</th><th>Tu comisión</th><th>Estado pago</th></tr></thead>
                  <tbody>
                    {[
                      ['11 Abr 2026', 'Grupo Avalluo', 'Plan Red', 'purple', 'Raíz', '$1,400 USD', '$10,000 MXN', 'amber', 'Pendiente'],
                      ['3 Abr 2026', 'Dist. Ramírez', 'Plan Equipo', 'blue', 'Distribuidor', '$550 USD', '$4,000 MXN', 'amber', 'Pendiente'],
                      ['28 Mar 2026', 'Scaling Master', 'Plan Agencia', 'purple', 'Raíz', '$1,400 USD', '$10,000 MXN', 'green', 'Pagado'],
                      ['20 Mar 2026', 'Dist. Torres', 'Plan Solo', 'blue', 'Distribuidor', '$550 USD', '$4,000 MXN', 'green', 'Pagado'],
                    ].map(([date, client, plan, type, typeLabel, impl, com, statusType, status]) => (
                      <tr key={date + client}>
                        <td style={{ color: 'var(--text-3)' }}>{date}</td>
                        <td><strong>{client}</strong></td>
                        <td>{plan}</td>
                        <td><span className={`p-badge p-badge-${type}`}>{typeLabel}</span></td>
                        <td>{impl}</td>
                        <td style={{ color: 'var(--green)', fontWeight: 700 }}>{com}</td>
                        <td><span className={`p-badge p-badge-${statusType}`}>{status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PROSPECTOS ── */}
          {activePage === 'prospectos' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Prospectos</div>
                <div className="p-page-sub">7 prospectos activos en tu pipeline</div>
              </div>
              <div className="p-grid-4 p-mb-24">
                {[
                  { icon: <Users />, label: 'Total activos', value: '7', color: 'var(--blue)' },
                  { icon: <TrendingUp />, label: 'A punto de cerrar', value: '2', color: 'var(--green)' },
                  { icon: <Calendar />, label: 'Demos agendadas', value: '1', color: 'var(--amber)' },
                  { icon: <Percent />, label: 'Conversión histórica', value: '67%', color: 'var(--purple)' },
                ].map((s, i) => (
                  <div className="p-stat-card" key={i}>
                    <div className="p-stat-label">{s.icon}{s.label}</div>
                    <div className="p-stat-value" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="p-card p-table-wrap">
                <table>
                  <thead><tr><th>Prospecto</th><th>Tipo</th><th>Plan interés</th><th>Etapa</th><th>Último contacto</th><th>Comisión potencial</th></tr></thead>
                  <tbody>
                    {[
                      ['Carlos Medina', 'purple', 'Raíz', 'Plan Red', 'green', 'A punto de cerrar', 'Hoy', '$10,000'],
                      ['María González', 'blue', 'Distribuidor', 'Plan Equipo', 'amber', 'Demo agendada', 'Ayer', '$4,000'],
                      ['Luis Reyes', 'purple', 'Raíz', 'Plan Agencia', 'blue', 'En conversación', 'Hace 2 días', '$10,000'],
                      ['Ana Pedraza', 'blue', 'Distribuidor', 'Plan Solo', 'blue', 'En conversación', 'Hace 3 días', '$4,000'],
                      ['Jorge Hernández', 'purple', 'Raíz', 'Por definir', '', 'Nuevo', 'Hace 4 días', 'TBD'],
                    ].map(([name, typeColor, typeLabel, plan, stageColor, stage, last, com]) => (
                      <tr key={name}>
                        <td><strong>{name}</strong></td>
                        <td><span className={`p-badge p-badge-${typeColor}`}>{typeLabel}</span></td>
                        <td>{plan}</td>
                        <td>{stageColor ? <span className={`p-badge p-badge-${stageColor}`}>{stage}</span> : <span className="p-badge" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>{stage}</span>}</td>
                        <td style={{ color: 'var(--text-3)' }}>{last}</td>
                        <td style={{ color: com === 'TBD' ? 'var(--text-3)' : 'var(--green)', fontWeight: 700 }}>{com}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COBROS ── */}
          {activePage === 'cobros' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Cobros</div>
                <div className="p-page-sub">Tus comisiones, fechas de pago y facturas</div>
              </div>
              <div className="p-card p-card-p p-mb-16" style={{ background: 'linear-gradient(135deg,rgba(255,149,0,0.08),var(--bg2))', borderColor: 'rgba(255,149,0,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div className="p-label-sm" style={{ color: 'var(--amber)', marginBottom: 8 }}><Clock size={12} />Próximo cobro estimado</div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 48, fontWeight: 900, letterSpacing: '-2px', color: 'var(--amber)', lineHeight: 1 }}>$24,000</div>
                    <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>MXN · Comisiones pendientes Q2</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ padding: 16, background: 'var(--amber-light)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 700, marginBottom: 4 }}>¿Cuándo cobras?</div>
                      <div style={{ fontSize: 14, color: 'var(--text-2)' }}>Cierra <strong>1 venta más esta semana</strong> y cobras el <strong>viernes.</strong> Si no, cobras el día 10 del mes.</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Bono trimestral</div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--green)' }}>$35,000</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>MXN · Al cierre Q2</div>
                  </div>
                </div>
              </div>
              <div className="p-grid-2 p-mb-16">
                <div className="p-card p-card-p">
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <List size={16} color="var(--blue)" />Desglose por cobrar
                  </div>
                  {[
                    { color: 'var(--amber)', title: 'Grupo Avalluo — Raíz', sub: '11 Abr · Pendiente de factura', amount: '$10,000' },
                    { color: 'var(--amber)', title: 'Dist. Ramírez — Distribuidor', sub: '3 Abr · Pendiente de factura', amount: '$4,000' },
                    { color: 'var(--amber)', title: 'Bono trimestral Q2', sub: 'Se acredita al 30 Jun', amount: '$35,000' },
                  ].map((t, i) => (
                    <div className="p-timeline-item" key={i} style={{ padding: '16px 0' }}>
                      <div className="p-timeline-dot" style={{ background: t.color }} />
                      <div className="p-timeline-content">
                        <div className="p-timeline-title">{t.title}</div>
                        <div className="p-timeline-sub">{t.sub}</div>
                      </div>
                      <div className="p-timeline-amount" style={{ color: 'var(--green)' }}>{t.amount}</div>
                    </div>
                  ))}
                </div>
                <div className="p-card p-card-p">
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={16} color="var(--green)" />Pagos recibidos
                  </div>
                  {[
                    { date: '5 Abr · CLABE ****8939', amount: '$14,000' },
                    { date: '22 Mar · CLABE ****8939', amount: '$14,000' },
                    { date: '10 Mar · CLABE ****8939', amount: '$29,000' },
                  ].map((t, i) => (
                    <div className="p-timeline-item" key={i} style={{ padding: '16px 0' }}>
                      <div className="p-timeline-dot" style={{ background: 'var(--green)' }} />
                      <div className="p-timeline-content">
                        <div className="p-timeline-title">Pago procesado</div>
                        <div className="p-timeline-sub">{t.date}</div>
                      </div>
                      <div className="p-timeline-amount">{t.amount}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-card p-card-p">
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload size={16} color="var(--blue)" />Subir factura para cobro
                </div>
                <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 36, textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--blue)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <FileUp size={32} color="var(--text-3)" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Arrastra tu CFDI aquí</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>O haz clic para seleccionar · XML y PDF aceptados</div>
                </div>
              </div>
            </div>
          )}

          {/* ── DOCUMENTOS ── */}
          {activePage === 'documentos' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Documentos oficiales</div>
                <div className="p-page-sub">Tu información fiscal y contrato como comisionista mercantil</div>
              </div>
              <div className="p-grid-2 p-mb-16">
                <div className="p-card p-card-p">
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Landmark size={16} color="var(--blue)" />Datos fiscales
                  </div>
                  {[['RFC', 'text', 'LOAA900101XXX'], ['CLABE interbancaria', 'text', '18 dígitos'], ['Banco', 'text', 'BBVA, HSBC, Banorte...']].map(([label, type, ph]) => (
                    <div className="p-form-group" key={label}>
                      <label className="p-form-label">{label}</label>
                      <input className="p-form-input" type={type} placeholder={ph} />
                    </div>
                  ))}
                  <div className="p-form-group">
                    <label className="p-form-label">Régimen fiscal</label>
                    <select className="p-form-input">
                      <option>Persona Física — Actividad Empresarial</option>
                      <option>RESICO</option>
                    </select>
                  </div>
                  <button className="p-btn-sm p-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 10 }}><Save size={14} />Guardar datos fiscales</button>
                </div>
                <div className="p-card p-card-p">
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} color="var(--green)" />Estado de verificación
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { icon: <CheckCircle size={20} color="var(--green)" />, title: 'Contrato firmado', sub: 'Firmado el 15 de Enero 2026', border: 'rgba(0,200,83,0.2)', bg: 'var(--green-light)' },
                      { icon: <Clock size={20} color="var(--amber)" />, title: 'RFC — Pendiente de verificación', sub: 'Sube tu constancia fiscal', border: 'var(--border)', bg: 'transparent' },
                      { icon: <AlertCircle size={20} color="var(--red)" />, title: 'CLABE — No registrada', sub: 'Necesaria para recibir pagos', border: 'var(--border)', bg: 'transparent' },
                      { icon: <CheckCircle size={20} color="var(--green)" />, title: 'Identidad verificada', sub: 'ID validado por el equipo Flow Hub', border: 'rgba(0,200,83,0.2)', bg: 'var(--green-light)' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: `1px solid ${item.border}`, borderRadius: 'var(--radius-sm)', background: item.bg }}>
                        {item.icon}
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-card p-card-p">
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Folder size={16} color="var(--amber)" />Documentos requeridos
                </div>
                {[
                  { iconBg: 'var(--green-light)', icon: <FileCheck size={18} color="var(--green)" />, name: 'Contrato de Comisionista Mercantil', sub: 'Firmado · 15 Ene 2026 · PDF', badge: 'p-badge-green', badgeLabel: 'Verificado', btnClass: 'p-btn-ghost', btnIcon: <Download size={13} /> },
                  { iconBg: 'var(--amber-light)', icon: <FileText size={18} color="var(--amber)" />, name: 'Constancia de Situación Fiscal', sub: 'Pendiente de subir · SAT · XML o PDF', badge: 'p-badge-amber', badgeLabel: 'Pendiente', btnClass: 'p-btn-primary', btnIcon: <><Upload size={13} /> Subir</> },
                  { iconBg: 'var(--red-light)', icon: <FileText size={18} color="var(--red)" />, name: 'Comprobante bancario (CLABE)', sub: 'No subido · Estado de cuenta o carta bancaria', badge: 'p-badge-red', badgeLabel: 'Faltante', btnClass: 'p-btn-primary', btnIcon: <><Upload size={13} /> Subir</> },
                  { iconBg: 'var(--green-light)', icon: <ShieldCheck size={18} color="var(--green)" />, name: 'Identificación oficial', sub: 'Verificada · INE · Ene 2026', badge: 'p-badge-green', badgeLabel: 'Verificado', btnClass: 'p-btn-ghost', btnIcon: <Download size={13} /> },
                ].map((doc, i) => (
                  <div className="p-doc-item" key={i}>
                    <div className="p-doc-icon" style={{ background: doc.iconBg }}>{doc.icon}</div>
                    <div>
                      <div className="p-doc-name">{doc.name}</div>
                      <div className="p-doc-sub">{doc.sub}</div>
                    </div>
                    <div className="p-doc-action">
                      <span className={`p-badge ${doc.badge}`}>{doc.badgeLabel}</span>
                      <button className={`p-btn-sm ${doc.btnClass}`}>{doc.btnIcon}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ACADEMIA ── */}
          {activePage === 'academia' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Academia Flow Hub</div>
                <div className="p-page-sub">Todo lo que necesitas para vender con confianza y cerrar más</div>
              </div>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlayCircle size={18} color="var(--blue)" />Capacitación en video
              </div>
              <div className="p-grid-3 p-mb-32">
                {[
                  { bg: 'linear-gradient(135deg,#0d1b2e,#1a0a3b)', tag: 'Fundamentos', tagColor: 'var(--blue)', title: 'Cómo presentar Flow Hub en 5 minutos', dur: '5:32', seen: true },
                  { bg: 'linear-gradient(135deg,#0a1f0d,#1a2e0d)', tag: 'Know How', tagColor: 'var(--green)', title: 'El funnel de 5 pasos que cierra solo', dur: '12:18', seen: true },
                  { bg: 'linear-gradient(135deg,#1f0d0a,#2e1a0d)', tag: 'Objeciones', tagColor: 'var(--amber)', title: 'Cómo responder "está muy caro"', dur: '8:45', seen: false },
                  { bg: 'linear-gradient(135deg,#0d0a1f,#1a0d2e)', tag: 'Avanzado', tagColor: 'var(--purple)', title: 'Presentación en conferencias grupales', dur: '22:10', seen: false },
                  { bg: 'linear-gradient(135deg,#0a1f18,#0d2e1a)', tag: 'Demostración', tagColor: 'var(--green)', title: 'Demo en vivo — Flow Hub paso a paso', dur: '18:30', seen: false },
                  { bg: 'linear-gradient(135deg,#1f180a,#2e1a0a)', tag: 'Estrategia', tagColor: 'var(--amber)', title: 'Cómo usar tu genealogía para cerrar', dur: '14:20', seen: false },
                ].map((v, i) => (
                  <div className="p-video-card" key={i}>
                    <div className="p-video-thumb" style={{ background: v.bg }}>
                      <div className="p-video-play"><Play size={18} color="#070708" style={{ marginLeft: 2 }} /></div>
                    </div>
                    <div className="p-video-info">
                      <div className="p-video-tag" style={{ color: v.tagColor }}>{v.tag}</div>
                      <div className="p-video-title">{v.title}</div>
                      <div className="p-video-meta">
                        <Clock size={12} /> {v.dur} <span>·</span>
                        {v.seen ? <CheckCircle size={12} color="var(--green)" /> : <span style={{ color: 'var(--text-4)' }}>Pendiente</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Download size={18} color="var(--green)" />Material descargable
              </div>
              <div className="p-card p-card-p">
                {[
                  { iconBg: 'var(--blue-light)', icon: <FileText size={18} color="var(--blue)" />, name: 'Script de venta 1 a 1', meta: 'PDF · 8 páginas · Actualizado Mar 2026' },
                  { iconBg: 'var(--purple-light)', icon: <Presentation size={18} color="var(--purple)" />, name: 'Presentación para conferencias', meta: 'PPTX · 24 slides · Editable' },
                  { iconBg: 'var(--amber-light)', icon: <MessageSquare size={18} color="var(--amber)" />, name: 'Plantillas de WhatsApp — Primer contacto', meta: 'PDF · 12 mensajes listos para usar' },
                  { iconBg: 'var(--green-light)', icon: <Shield size={18} color="var(--green)" />, name: 'Respuestas a las 10 objeciones más comunes', meta: 'PDF · 6 páginas · Muy recomendado' },
                  { iconBg: 'var(--red-light)', icon: <Image size={18} color="var(--red)" />, name: 'Pack de imágenes para redes sociales', meta: 'ZIP · 24 imágenes · Editables en Canva' },
                ].map((r, i) => (
                  <div className="p-resource-item" key={i}>
                    <div className="p-resource-icon" style={{ background: r.iconBg }}>{r.icon}</div>
                    <div>
                      <div className="p-resource-name">{r.name}</div>
                      <div className="p-resource-meta">{r.meta}</div>
                    </div>
                    <button className="p-btn-sm p-btn-ghost p-resource-dl"><Download size={13} />Descargar</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TIENDA ── */}
          {activePage === 'tienda' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Tienda Flow Hub</div>
                <div className="p-page-sub">Lleva la marca contigo — merch oficial para distribuidores</div>
              </div>
              <div className="p-grid-3">
                {[
                  { emoji: '🧥', bg: 'linear-gradient(135deg,#0a0a0c,#141416)', name: 'Hoodie Flow Hub', desc: 'Hoodie premium con logo bordado. Negro con detalle azul. Tallas S a XXL.', price: '$750 MXN' },
                  { emoji: '🧢', bg: 'linear-gradient(135deg,#0d0a1f,#1a0a2e)', name: 'Gorra Flow Hub', desc: 'Gorra snapback con logo bordado en frente. Ajustable. Negro y azul.', price: '$450 MXN' },
                  { emoji: '👕', bg: 'linear-gradient(135deg,#0a1f0d,#0d2e14)', name: 'Playera Flow Hub', desc: 'Playera de algodón 100%. Logo en pecho y en espalda. Negro. Tallas S a XXL.', price: '$380 MXN' },
                  { emoji: '📓', bg: 'linear-gradient(135deg,#1f0d0a,#2e1a12)', name: 'Libreta Premium', desc: 'Libreta de piel con logo grabado. 200 hojas. Perfecta para presentaciones con clientes.', price: '$290 MXN' },
                  { emoji: '📌', bg: 'linear-gradient(135deg,#0a1018,#1a2030)', name: 'Pin Flow Hub', desc: 'Pin metálico esmaltado con logo de Flow Hub. Ideal para trajes y mochilas.', price: '$120 MXN' },
                  { emoji: '☕', bg: 'linear-gradient(135deg,#18100a,#2e200d)', name: 'Termo Flow Hub', desc: 'Termo de acero inoxidable 500ml. Logo en relieve. Mantiene frío 24h y calor 12h.', price: '$580 MXN' },
                ].map((item, i) => (
                  <div className="p-store-card" key={i}>
                    <div className="p-store-img" style={{ background: item.bg }}>{item.emoji}</div>
                    <div className="p-store-info">
                      <div className="p-store-name">{item.name}</div>
                      <div className="p-store-desc">{item.desc}</div>
                      <div className="p-store-footer">
                        <div className="p-store-price">{item.price}</div>
                        <button className="p-btn-sm p-btn-primary"><ShoppingCart size={13} />Agregar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SOPORTE ── */}
          {activePage === 'soporte' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Soporte</div>
                <div className="p-page-sub">Estamos aquí para ayudarte a vender más y mejor</div>
              </div>
              <div className="p-grid-3">
                {[
                  { iconBg: 'var(--green-light)', icon: <MessageCircle size={24} color="var(--green)" />, title: 'WhatsApp directo', desc: 'Escríbenos al +52 868 000 0000. Respuesta en menos de 2 horas en días hábiles.', btn: 'Abrir WhatsApp', href: 'https://wa.me/528680000000' },
                  { iconBg: 'var(--blue-light)', icon: <Calendar size={24} color="var(--blue)" />, title: 'Agendar sesión', desc: 'Reserva una videollamada de 30 minutos con un especialista de Flow Hub.', btn: 'Agendar llamada', href: '#' },
                  { iconBg: 'var(--purple-light)', icon: <Book size={24} color="var(--purple)" />, title: 'Base de conocimiento', desc: 'Guías, tutoriales y preguntas frecuentes sobre el sistema y el programa.', btn: 'Ver artículos', href: '#' },
                ].map((card, i) => (
                  <div className="p-card p-card-p" key={i} style={{ textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{card.icon}</div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{card.title}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginBottom: 16 }}>{card.desc}</div>
                    <button className="p-btn-sm p-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.open(card.href, '_blank')}>{card.btn}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
