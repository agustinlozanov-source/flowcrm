import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { useAparato, REPARTO, ESCALA } from '@/hooks/useAparato'
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

  /* Columna flexible para que el pie se pegue abajo: las descripciones tienen
     distinto largo y, sin esto, los precios de una misma fila no se alinean. */
  .p-store-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden; transition: all 0.18s;
    display: flex; flex-direction: column;
  }
  .p-store-card:hover { border-color: var(--border-strong); transform: translateY(-2px); }
  .p-store-img {
    height: 180px; display: flex; align-items: center; justify-content: center;
    font-size: 56px; border-bottom: 1px solid var(--border); overflow: hidden;
  }
  /* La foto viene en 16:10 con el producto a la derecha, que es casi la
     proporción del hueco: cover no recorta nada que importe. */
  .p-store-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .p-store-info { padding: 16px; flex: 1; display: flex; flex-direction: column; }
  .p-store-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .p-store-desc { font-size: 12.5px; color: var(--text-3); margin-bottom: 12px; line-height: 1.5; }
  .p-store-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; }
  /* Sin esto el precio se parte en dos renglones y se mete debajo del botón:
     la tarjeta mide ~290px y 20px en negra no caben junto a «Agregar». */
  .p-store-price { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; white-space: nowrap; }
  .p-store-footer .p-btn-sm { flex-shrink: 0; }

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
  scorecard: 'Mi compensación',
  ventas: 'Mis ventas',
  prospectos: 'Prospectos',
  cobros: 'Cobros',
  documentos: 'Documentos',
  academia: 'Academia',
  tienda: 'Tienda Flow Hub',
  bolsa: 'La bolsa',
  soporte: 'Soporte',
}

export default function PortalDistribuidorPage() {
  const [theme, setTheme] = useState('dark')
  const [activePage, setActivePage] = useState('dashboard')

  /* El número del mes, en vivo. Sale de las oportunidades ganadas y la meta
     viene de los objetivos del CRM: nada de esto está escrito acá. */
  const ap = useAparato()
  const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX')
  const cortos = n => {
    const v = Math.round(Number(n) || 0)
    return v >= 1000 ? '$' + Math.round(v / 1000).toLocaleString('es-MX') + 'K' : '$' + v
  }
  const [distribConfig, setDistribConfig] = useState(null)
  const navigate = useNavigate()

  // ── Load distribuidor global config (pipeline stages, scoring, agent prompt) ──
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'flowhub_config', 'distribuidor_niveles'), snap => {
      if (snap.exists()) setDistribConfig(snap.data())
    })
    return unsub
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      navigate('/distribuidor-login')
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
            <div className="p-logo-sub">Portal del equipo</div>
          </div>
        </div>

        <div className="p-sidebar-profile" onClick={nav('perfil')}>
          <div className="p-profile-avatar"><span>AL</span></div>
          <div>
            <div className="p-profile-name">Agustín Lozano</div>
            <div className="p-profile-level">Dirección comercial</div>
          </div>
        </div>

        <nav className="p-sidebar-nav">
          <div className="p-nav-group-label">Principal</div>
          <button className={`p-nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={nav('dashboard')}><LayoutDashboard />Dashboard</button>
          <button className={`p-nav-item ${activePage === 'perfil' ? 'active' : ''}`} onClick={nav('perfil')}><UserCircle />Mi perfil</button>
          <button className={`p-nav-item ${activePage === 'scorecard' ? 'active' : ''}`} onClick={nav('scorecard')}>
            <Target />Mi compensación
          </button>

          <div className="p-nav-group-label">Ventas</div>
          <button className={`p-nav-item ${activePage === 'ventas' ? 'active' : ''}`} onClick={nav('ventas')}><BarChart2 />Mis ventas</button>
          <button className={`p-nav-item ${activePage === 'prospectos' ? 'active' : ''}`} onClick={nav('prospectos')}>
            <Users />Prospectos<span className="p-nav-badge">7</span>
          </button>

          <div className="p-nav-group-label">Finanzas</div>
          <button className={`p-nav-item ${activePage === 'cobros' ? 'active' : ''}`} onClick={nav('cobros')}>
            <Banknote />Cobros<span className="p-nav-badge amber">{cortos(ap.porParte)}</span>
          </button>
          <button className={`p-nav-item ${activePage === 'documentos' ? 'active' : ''}`} onClick={nav('documentos')}><FileText />Documentos</button>

          <div className="p-nav-group-label">Recursos</div>
          <button className={`p-nav-item ${activePage === 'academia' ? 'active' : ''}`} onClick={nav('academia')}><BookOpen />Academia</button>
          <button className={`p-nav-item ${activePage === 'bolsa' ? 'active' : ''}`} onClick={nav('bolsa')}><Gift />La bolsa</button>
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
                <div className="p-page-title">El mes</div>
                <div className="p-page-sub">
                  {ap.cargando
                    ? 'Cargando…'
                    : `${ap.cierres} ${ap.cierres === 1 ? 'venta cerrada' : 'ventas cerradas'} · el bono se paga el ${ap.cobra}`}
                </div>
              </div>

              {/* Los dos motivos por los que esta consulta falla piden arreglos
                  distintos, así que se distinguen. Decir «falta un índice»
                  cuando el problema son los permisos manda a buscar al lugar
                  equivocado, y se pierde media hora. */}
              {ap.error && (
                <div className="p-card p-card-p p-mb-16">
                  {ap.error.code === 'permission-denied' ? (
                    <>
                      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Las reglas de Firestore bloquean la consulta</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.55 }}>
                        Juntar las ventas de toda la organización lee el grupo de colecciones
                        <strong> opportunities</strong>, y eso necesita su propia regla:
                        una consulta de grupo no hereda el permiso de la ruta anidada.
                        Hace falta un <strong>match /&#123;path=**&#125;/opportunities/&#123;oppId&#125;</strong> en la consola de Firebase.
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Falta un índice en Firestore</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.55 }}>
                        Juntar las ventas de toda la organización necesita un índice compuesto.
                        Firestore manda el enlace para crearlo en la consola del navegador: se abre,
                        se crea, y en un par de minutos esta pantalla se llena sola.
                      </div>
                    </>
                  )}
                </div>
              )}

              {!ap.cargando && !ap.error && !ap.hayMeta && (
                <div className="p-card p-card-p p-mb-16">
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Sin objetivo cargado</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.55 }}>
                    El mes no tiene meta, así que el cumplimiento y el bono no se pueden calcular.
                    Se carga en Objetivos, en el trimestre que corresponda.
                  </div>
                </div>
              )}

              <div className="p-grid-4 p-mb-24">
                <div className="p-stat-card">
                  <div className="p-stat-label"><TrendingUp />Venta del mes</div>
                  <div className="p-stat-value" style={{ color: 'var(--green)' }}>{cortos(ap.venta)}</div>
                  <div className="p-stat-sub">{ap.hayMeta ? `de ${cortos(ap.meta)} de meta` : 'sin meta cargada'}</div>
                  <div className={`p-stat-trend ${ap.hayMeta && ap.faltaParaMeta === 0 ? 'p-trend-up' : ''}`}>
                    {ap.hayMeta && ap.faltaParaMeta === 0 ? <CheckCircle size={13} /> : <Clock size={13} />}
                    {ap.hayMeta
                      ? (ap.faltaParaMeta > 0 ? `Faltan ${cortos(ap.faltaParaMeta)}` : 'Meta cumplida')
                      : 'Carga el objetivo'}
                  </div>
                </div>

                <div className="p-stat-card">
                  <div className="p-stat-label"><Target />Cumplimiento</div>
                  <div className="p-stat-value" style={{ color: ap.factor > 0 ? 'var(--blue)' : 'var(--text-3)' }}>
                    {ap.hayMeta ? `${Math.round(ap.cumplimiento * 100)}%` : '—'}
                  </div>
                  <div className="p-stat-sub">
                    {ap.factor > 0 ? `Paga ${Math.round(ap.factor * 100)}% de la bolsa` : 'El bono arranca en 80%'}
                  </div>
                  <div className={`p-stat-trend ${ap.hayMeta && ap.faltaParaBono === 0 ? 'p-trend-up' : ''}`}>
                    {ap.hayMeta && ap.faltaParaBono === 0 ? <CheckCircle size={13} /> : <Clock size={13} />}
                    {ap.hayMeta
                      ? (ap.faltaParaBono > 0 ? `${cortos(ap.faltaParaBono)} para desbloquearlo` : 'Bono desbloqueado')
                      : 'Sin referencia'}
                  </div>
                </div>

                <div className="p-stat-card">
                  <div className="p-stat-label"><Gift />Mi bono</div>
                  <div className="p-stat-value" style={{ color: 'var(--purple)' }}>{pesos(ap.porParte)}</div>
                  <div className="p-stat-sub">1 de {REPARTO.partes} partes iguales</div>
                  <div className="p-stat-trend"><Gift size={13} />Bolsa {cortos(ap.bolsa)}</div>
                </div>

                <div className="p-stat-card">
                  <div className="p-stat-label"><Percent />Cedido</div>
                  <div className="p-stat-value" style={{ color: 'var(--amber)' }}>
                    {Math.round(ap.cedidoPct * 100)}%
                  </div>
                  <div className="p-stat-sub">{pesos(ap.cedido)} en descuentos y cortesías</div>
                  <div className="p-stat-trend" style={{ color: 'var(--text-3)' }}>
                    <Percent size={13} />Del precio de lista
                  </div>
                </div>
              </div>

              {/* La escala del bono. Sustituye a los puntos y niveles del portal de
                  distribuidores: acá el bono es de equipo y se reparte en partes
                  iguales, así que no hay niveles individuales que subir. */}
              <div className="p-card p-card-p p-mb-16">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div className="p-label-sm"><Target size={12} />Escala del bono</div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', marginTop: 4 }}>
                      {ap.hayMeta ? `${pesos(ap.venta)} de ${pesos(ap.meta)}` : 'Sin objetivo del mes'}
                    </div>
                  </div>
                  {ap.factor > 0 ? (
                    <div className="p-badge p-badge-green"><CheckCircle size={12} />Bono desbloqueado</div>
                  ) : (
                    <div className="p-badge"><Clock size={12} />Arranca en 80%</div>
                  )}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>80%</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>100%</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>130%</span>
                  </div>
                  <div className="p-progress-wrap" style={{ height: 10 }}>
                    {/* La barra arranca en 80 y termina en 130: antes del 80 no hay
                        bono, y después del 130 ya no crece. */}
                    <div
                      className="p-progress-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, ((ap.cumplimiento - 0.80) / 0.50) * 100))}%`,
                        background: 'linear-gradient(90deg,var(--green),var(--blue))',
                      }}
                    />
                  </div>
                </div>

                <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8 }}>
                  {!ap.hayMeta
                    ? 'Carga el objetivo del trimestre para ver el avance.'
                    : ap.factor === 0
                      ? `Faltan ${pesos(ap.faltaParaBono)} para desbloquear el bono.`
                      : ap.faltaParaMeta > 0
                        ? `Vas en ${Math.round(ap.cumplimiento * 100)}% y la bolsa paga ${pesos(ap.bolsa)}. Con ${pesos(ap.faltaParaMeta)} más llegas al 100%.`
                        : `Vas en ${Math.round(ap.cumplimiento * 100)}%. La bolsa paga ${pesos(ap.bolsa)} y a cada quien le tocan ${pesos(ap.porParte)}.`}
                </div>
              </div>

              <div className="p-grid-2">
                {/* Actividad reciente */}
                <div className="p-card">
                  <div className="p-card-header"><div className="p-card-header-title">Actividad reciente</div></div>
                  <div style={{ padding: '8px 0' }}>
                    {[
                      { color: 'var(--green)', title: 'Onboarding cerrado — Grupo Avalluo', sub: 'Flow Hub CRM · Hoy, 10:30', amount: '+$30K', amountColor: 'var(--green)' },
                      { color: 'var(--blue)', title: 'Nuevo calificado — María González', sub: 'Origen: evento · Ayer', amount: 'Prospección', amountColor: 'var(--blue)' },
                      { color: 'var(--amber)', title: 'Cobro recibido — Scaling Master', sub: 'Segunda mitad del onboarding · 5 Abr', amount: '$15K', amountColor: 'var(--amber)' },
                      { color: 'var(--green)', title: 'Taller — 4 lugares vendidos', sub: 'Taller Flujo Noviembre · 3 Abr', amount: '+$26K', amountColor: 'var(--green)' },
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
                    { initials: 'CM', name: 'Carlos Medina', sub: 'Onboarding CRM · $30,000', badgeClass: 'p-badge-green', stage: 'Cierre', bg: 'var(--blue)' },
                    { initials: 'MG', name: 'María González', sub: 'Taller Flujo Nov · 2 lugares', badgeClass: 'p-badge-amber', stage: 'Seguimiento', bg: 'var(--purple)' },
                    { initials: 'LR', name: 'Luis Reyes', sub: 'Consultoría · 20 h', badgeClass: 'p-badge-blue', stage: 'Seguimiento', bg: 'var(--amber)' },
                    { initials: 'AP', name: 'Ana Pedraza', sub: 'Onboarding CRM · $30,000', badgeClass: 'p-badge-blue', stage: 'Seguimiento', bg: 'var(--green)' },
                    { initials: 'JH', name: 'Jorge Hernández', sub: 'Sin calificar · Origen: Meta Ads', badgeClass: '', stage: 'Prospección', bg: '#555' },
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
                <div className="p-page-sub">Tus datos y lo que llevas en el mes</div>
              </div>
              <div className="p-profile-header p-mb-16">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
                  <div className="p-profile-avatar-lg">AL</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div className="p-profile-name-lg">Agustín Lozano</div>
                      <div className="p-level-pill">Dirección comercial</div>
                    </div>
                    <div className="p-profile-meta">
                      <div className="p-profile-meta-item"><Mail size={14} />hola@agustinlozano.com</div>
                      <div className="p-profile-meta-item"><Phone size={14} />+52 868 302 8939</div>
                      <div className="p-profile-meta-item"><MapPin size={14} />Monterrey, México</div>
                      <div className="p-profile-meta-item"><Calendar size={14} />En el equipo desde Noviembre 2026</div>
                    </div>
                    <div className="p-profile-meta" style={{ marginTop: 12 }}>
                      <div className="p-profile-meta-item"><Hash size={14} />Comisión: <strong style={{ color: 'var(--text)' }}>3% de dirección</strong></div>
                      <div className="p-profile-meta-item"><Banknote size={14} />Cobra el {ap.cobra}</div>
                    </div>
                  </div>
                </div>
                <div className="p-profile-stats">
                  {[[String(ap.cierres), 'Cierres del mes', 'var(--green)'], [cortos(ap.venta), 'Venta del mes', 'var(--blue)'], [cortos(ap.porParte), 'Mi parte del bono', 'var(--purple)'], [cortos(ap.comisiones.direccion), 'Comisión de dirección', 'var(--amber)']].map(([val, label, color]) => (
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

          {/* ── MI COMPENSACIÓN ── */}
          {/* Sustituye al Scorecard de puntos y niveles. Acá el bono es de
              equipo y se reparte en partes iguales, así que no hay nivel
              individual que subir: lo que se muestra es la escala en pesos. */}
          {activePage === 'scorecard' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Mi compensación</div>
                <div className="p-page-sub">Lo que llevas ganado este mes y cuándo lo cobras</div>
              </div>

              {!ap.hayMeta ? (
                <div className="p-card p-card-p" style={{ borderColor: 'rgba(255,149,0,0.2)', background: 'var(--amber-light)' }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
                    No hay objetivo cargado para este trimestre en el CRM. El bono se calcula contra esa meta,
                    así que primero hay que ponerla en <strong>Objetivos</strong>.
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-card p-card-p p-mb-16" style={{ background: 'linear-gradient(135deg,rgba(0,200,83,0.08),var(--bg2))', borderColor: 'rgba(0,200,83,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--green-light)', border: '2px solid rgba(0,200,83,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Gift size={32} color="var(--green)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div className={`p-badge ${ap.factor > 0 ? 'p-badge-green' : 'p-badge-amber'}`} style={{ marginBottom: 8 }}>
                          {ap.factor > 0
                            ? <><CheckCircle size={12} />Bono activo</>
                            : <><Clock size={12} />Bono sin activar</>}
                        </div>
                        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 4 }}>
                          {pesos(ap.porParte)} MXN
                        </div>
                        <div style={{ fontSize: 13.5, color: 'var(--text-3)' }}>
                          Mi parte de la bolsa de {pesos(ap.bolsa)} · se cobra el {ap.cobra}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                          {ap.factor > 0 ? 'Falta para el 100%' : 'Falta para activarlo'}
                        </div>
                        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 900, color: 'var(--amber)' }}>
                          {pesos(ap.factor > 0 ? ap.faltaParaMeta : ap.faltaParaBono)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          {ap.factor > 0 ? 'de venta nueva' : 'de venta para el 80%'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-grid-4 p-mb-16">
                    {[
                      { icon: <Banknote />, label: 'Venta del mes', value: cortos(ap.venta), color: 'var(--green)', sub: `Meta ${cortos(ap.meta)} MXN` },
                      { icon: <Percent />, label: 'Cumplimiento', value: Math.round(ap.cumplimiento * 100) + '%', color: 'var(--blue)', sub: `Factor ${ap.factor.toFixed(2)}×` },
                      { icon: <Gift />, label: 'Bolsa del bono', value: cortos(ap.bolsa), color: 'var(--purple)', sub: `${REPARTO.partes} partes iguales` },
                      { icon: <CheckCircle />, label: 'Cierres', value: String(ap.cierres), color: 'var(--amber)', sub: `${cortos(ap.cedido)} cedidos` },
                    ].map((s, i) => (
                      <div className="p-stat-card" key={i}>
                        <div className="p-stat-label">{s.icon}{s.label}</div>
                        <div className="p-stat-value" style={{ color: s.color }}>{s.value}</div>
                        <div className="p-stat-sub">{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  <div className="p-card p-card-p p-mb-16">
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Target size={16} color="var(--amber)" />Las comisiones del mes
                    </div>
                    <div className="p-grid-3">
                      {[
                        { label: 'Prospección', pct: REPARTO.comision.prospeccion, monto: ap.comisiones.prospeccion, quien: 'Mario' },
                        { label: 'Cierres', pct: REPARTO.comision.cierre, monto: ap.comisiones.cierre, quien: 'Román' },
                        { label: 'Dirección', pct: REPARTO.comision.direccion, monto: ap.comisiones.direccion, quien: 'Agustín' },
                      ].map((c, i) => (
                        <div key={i} style={{ textAlign: 'center', padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
                          <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: '-1px' }}>{pesos(c.monto)}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{Math.round(c.pct * 100)}% · {c.quien}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-card">
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800 }}>La escala, en pesos</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>
                        Contra la meta de {pesos(ap.meta)} del mes. Entre escalones se interpola.
                      </div>
                    </div>
                    <div className="p-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                      <table>
                        <thead><tr><th>Cumplimiento</th><th>Venta</th><th>Factor</th><th>Bolsa</th><th>Mi parte</th></tr></thead>
                        <tbody>
                          {(() => {
                            /* Se resalta el escalón más alto alcanzado, para que la fila
                               marcada sea una sola y se lea de un golpe. */
                            const alcanzado = ESCALA.filter(e => ap.cumplimiento >= e.desde).slice(-1)[0]
                            return ESCALA.map(e => {
                              const bolsa = Math.round(ap.meta * REPARTO.bolsaPct * e.factor)
                              const aqui = alcanzado && alcanzado.desde === e.desde
                              return (
                                <tr key={e.desde} style={aqui ? { background: 'var(--green-light)' } : undefined}>
                                  <td><strong>{Math.round(e.desde * 100)}%</strong>{aqui && <span style={{ color: 'var(--green)', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>vas aquí</span>}</td>
                                  <td style={{ color: 'var(--text-3)' }}>{pesos(ap.meta * e.desde)}</td>
                                  <td>{e.factor.toFixed(2)}×</td>
                                  <td style={{ fontWeight: 700 }}>{pesos(bolsa)}</td>
                                  <td style={{ color: 'var(--green)', fontWeight: 700 }}>{pesos(bolsa / REPARTO.partes)}</td>
                                </tr>
                              )
                            })
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── VENTAS ── */}
          {activePage === 'ventas' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Mis ventas</div>
                <div className="p-page-sub">Cada cierre con su precio de lista, lo que se cedió y lo que entró</div>
              </div>
              <div className="p-grid-3 p-mb-24">
                {[
                  { icon: <CheckCircle />, label: 'Cierres del mes', value: String(ap.cierres), color: 'var(--green)', sub: `Venta ${cortos(ap.venta)} MXN` },
                  { icon: <Gift />, label: 'Cedido', value: cortos(ap.cedido), color: 'var(--amber)', sub: `${Math.round(ap.cedidoPct * 100)}% del precio de lista` },
                  { icon: <Percent />, label: 'Ticket promedio', value: cortos(ap.cierres ? ap.venta / ap.cierres : 0), color: 'var(--blue)', sub: 'MXN por cierre' },
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
                  <thead><tr><th>Fecha</th><th>Cliente</th><th>Producto</th><th>Fase</th><th>Precio de lista</th><th>Precio de cierre</th><th>Estado pago</th></tr></thead>
                  <tbody>
                    {[
                      ['11 Nov 2026', 'Grupo Avalluo', 'Onboarding CRM', 'green', 'Cierre', '$30,000', '$30,000', 'amber', 'Mitad pagada'],
                      ['9 Nov 2026', 'Cypress Interiors', 'Diseño de sistemas', 'purple', 'Cierre', '$300,000', '$285,000', 'amber', 'Pendiente'],
                      ['5 Nov 2026', 'Taller Flujo Nov · 4 lugares', 'Taller abierto', 'blue', 'Cierre', '$26,000', '$26,000', 'green', 'Pagado'],
                      ['3 Nov 2026', 'Bright Finishing', 'Consultoría · 20 h', 'green', 'Cierre', '$60,000', '$54,000', 'green', 'Pagado'],
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

              {/* ── Etapas del pipeline (desde Superadmin) ── */}
              {(distribConfig?.pipelineStages?.length > 0) && (
                <div className="p-card p-card-p p-mb-16">
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={15} color="var(--blue)" />Etapas del pipeline
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {distribConfig.pipelineStages.map((stage, i) => (
                      <div key={stage.id || i} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 8,
                        background: stage.color ? stage.color + '22' : 'var(--surface)',
                        border: `1px solid ${stage.color || 'var(--border)'}44`,
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color || 'var(--text-3)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>{stage.name}</span>
                        {(stage.scoreMin != null && stage.scoreMax != null) && (
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{stage.scoreMin}–{stage.scoreMax} pts</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-card p-table-wrap">
                <table>
                  <thead><tr><th>Prospecto</th><th>Fase</th><th>Producto</th><th>Etapa</th><th>Último contacto</th><th>Venta potencial</th></tr></thead>
                  <tbody>
                    {[
                      ['Carlos Medina', 'green', 'Cierre', 'Onboarding CRM', 'green', 'Propuesta enviada', 'Hoy', '$30,000'],
                      ['María González', 'blue', 'Seguimiento', 'Taller Flujo Nov · 2 lugares', 'amber', 'Demo agendada', 'Ayer', '$13,000'],
                      ['Luis Reyes', 'blue', 'Seguimiento', 'Consultoría · 20 h', 'blue', 'En conversación', 'Hace 2 días', '$60,000'],
                      ['Ana Pedraza', 'blue', 'Seguimiento', 'Onboarding CRM', 'blue', 'En conversación', 'Hace 3 días', '$30,000'],
                      ['Jorge Hernández', 'purple', 'Prospección', 'Sin calificar', '', 'Nuevo', 'Hace 4 días', 'TBD'],
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
                    { color: 'var(--amber)', title: 'Comisión de dirección — 3%', sub: `Sobre ${pesos(ap.venta)} de venta del mes`, amount: pesos(ap.comisiones.direccion) },
                    { color: 'var(--amber)', title: 'Mi parte del bono', sub: `Bolsa de ${pesos(ap.bolsa)} entre ${REPARTO.partes}`, amount: pesos(ap.porParte) },
                    { color: 'var(--text-3)', title: 'Factura por emitir', sub: 'Todo egreso va con factura · antes del día 5', amount: '—' },
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
                <div className="p-page-sub">El método de cierre de la casa. Todos lo aprenden.</div>
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
                  { bg: 'linear-gradient(135deg,#1f180a,#2e1a0a)', tag: 'Estrategia', tagColor: 'var(--amber)', title: 'El tamiz — qué entra y qué no entra al catálogo', dur: '14:20', seen: false },
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

          {/* ── LA BOLSA ── */}
          {/* Sustituye a la tienda de merch. Lo que se consulta a media
              negociación es qué se puede ceder hoy y cuánto vale, así que la
              compuerta y el precio de lista van juntos en la misma tarjeta. */}
          {activePage === 'bolsa' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">La bolsa</div>
                <div className="p-page-sub">Qué se puede ceder esta semana, y cuánto vale lo que cedes</div>
              </div>

              <div className="p-card p-card-p p-mb-16" style={{ borderColor: 'rgba(255,149,0,0.2)', background: 'var(--amber-light)' }}>
                <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
                  <strong>Los precios de lista están pendientes.</strong> Son el entregable de las dos
                  semanas de construcción. Sin precio, regalar una herramienta no vale nada en la
                  negociación y la bolsa no se puede medir.
                </div>
              </div>

              <div className="p-grid-3">
                {[
                  { sigla: 'SCANx',  bg: 'linear-gradient(135deg,#0d1b2e,#1a0a3b)', color: 'var(--blue)',   name: 'SCANx', desc: 'Radiografía comercial y las 3 prioridades. Es la compuerta de apertura, arriba del embudo.', momento: 'Apertura', estado: 'abierta' },
                  { sigla: 'SCALEx', bg: 'linear-gradient(135deg,#0a1f0d,#0d2e14)', color: 'var(--green)',  name: 'SCALEx', desc: 'La metodología completa. Columna de consultoría, high ticket.', momento: 'High ticket', estado: 'autorización' },
                  { sigla: 'TEAMx',  bg: 'linear-gradient(135deg,#0d0a1f,#1a0d2e)', color: 'var(--purple)', name: 'TEAMx', desc: 'Ciclos de 14 semanas con el equipo del cliente. Asegura un cierre o expande una cuenta.', momento: 'Cierre / expansión', estado: 'abierta' },
                  { sigla: 'BOARDx', bg: 'linear-gradient(135deg,#1f180a,#2e1a0a)', color: 'var(--amber)',  name: 'BOARDx', desc: 'Consejo técnico trimestral. Gobierno, no operación semanal.', momento: 'Asamblea trimestral', estado: 'cerrada' },
                  { sigla: 'SKILLx', bg: 'linear-gradient(135deg,#0a1f18,#0d2e1a)', color: 'var(--green)',  name: 'SKILLx', desc: 'Formación continua para el equipo del cliente. Entra sin costo extra en el plan.', momento: 'Post-venta', estado: 'abierta' },
                  { sigla: 'LUGAR',  bg: 'linear-gradient(135deg,#1f0d0a,#2e1a12)', color: 'var(--red)',    name: 'Lugar en taller', desc: 'Un asiento del taller del mes. Lo más pedido y lo más fácil de regalar de más.', momento: 'Cierre', estado: 'autorización' },
                ].map((item, i) => (
                  <div className="p-store-card" key={i}>
                    <div className="p-store-img" style={{ background: item.bg, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', color: item.color }}>
                      {item.sigla}
                    </div>
                    <div className="p-store-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <div className="p-store-name" style={{ margin: 0 }}>{item.name}</div>
                        <div
                          className={`p-badge ${item.estado === 'abierta' ? 'p-badge-green' : item.estado === 'autorización' ? 'p-badge-amber' : ''}`}
                          style={item.estado === 'cerrada' ? { background: 'var(--surface)', color: 'var(--text-3)' } : undefined}
                        >
                          {item.estado === 'abierta'
                            ? <><CheckCircle size={11} />Abierta</>
                            : item.estado === 'autorización'
                              ? <><Shield size={11} />Pide autorización</>
                              : <><Clock size={11} />Cerrada</>}
                        </div>
                      </div>
                      <div className="p-store-desc">{item.desc}</div>
                      <div className="p-store-footer">
                        <div>
                          <div className="p-store-price" style={{ color: 'var(--text-3)' }}>Por definir</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{item.momento}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-card p-card-p" style={{ marginTop: 16 }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <List size={16} color="var(--blue)" />Cómo funcionan las compuertas
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.7 }}>
                  Dirección abre y cierra herramientas por periodo. Lo que está <strong style={{ color: 'var(--green)' }}>abierto</strong> se
                  cede sin preguntar y queda registrado como cortesía al marcar la venta ganada.
                  Lo que <strong style={{ color: 'var(--amber)' }}>pide autorización</strong> se consulta antes.
                  Un descuento a mano siempre está disponible; acuñar un código reutilizable es una táctica, y las tácticas son de dirección.
                </div>
              </div>
            </div>
          )}

          {/* ── TIENDA ── */}
          {activePage === 'tienda' && (
            <div>
              <div className="p-page-header">
                <div className="p-page-title">Tienda Flow Hub</div>
                <div className="p-page-sub">Merch oficial. Para el equipo, para regalar a un cliente, o para canjear.</div>
              </div>
              <div className="p-grid-3">
                {[
                  { img: '/merch/hoodie.webp', emoji: '🧥', bg: 'linear-gradient(135deg,#0a0a0c,#141416)', name: 'Hoodie Flow Hub', desc: 'Hoodie premium con logo bordado. Negro con detalle azul. Tallas S a XXL.', price: '$750 MXN' },
                  { img: '/merch/gorra.webp', emoji: '🧢', bg: 'linear-gradient(135deg,#0d0a1f,#1a0a2e)', name: 'Gorra Flow Hub', desc: 'Gorra snapback con logo bordado en frente. Ajustable. Negro y azul.', price: '$450 MXN' },
                  { img: '/merch/playera.webp', emoji: '👕', bg: 'linear-gradient(135deg,#0a1f0d,#0d2e14)', name: 'Playera Flow Hub', desc: 'Playera de algodón 100%. Logo en pecho y en espalda. Negro. Tallas S a XXL.', price: '$380 MXN' },
                  { img: '/merch/libreta.webp', emoji: '📓', bg: 'linear-gradient(135deg,#1f0d0a,#2e1a12)', name: 'Libreta Premium', desc: 'Libreta de piel con logo grabado. 200 hojas. Perfecta para presentaciones con clientes.', price: '$290 MXN' },
                  { img: '/merch/pin.webp', emoji: '📌', bg: 'linear-gradient(135deg,#0a1018,#1a2030)', name: 'Pin Flow Hub', desc: 'Pin metálico esmaltado con logo de Flow Hub. Ideal para trajes y mochilas.', price: '$120 MXN' },
                  { img: '/merch/termo.webp', emoji: '☕', bg: 'linear-gradient(135deg,#18100a,#2e200d)', name: 'Termo Flow Hub', desc: 'Termo de acero inoxidable 500ml. Logo en relieve. Mantiene frío 24h y calor 12h.', price: '$580 MXN' },
                ].map((item, i) => (
                  <div className="p-store-card" key={i}>
                    <div className="p-store-img" style={{ background: item.bg }}>
                      {item.img
                        ? <img src={item.img} alt={item.name} loading="lazy" />
                        : item.emoji}
                    </div>
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
                  { iconBg: 'var(--green-light)', icon: <MessageCircle size={24} color="var(--green)" />, title: 'WhatsApp directo', desc: 'Escríbenos al +1 956 476 0388. Respuesta en menos de 2 horas en días hábiles.', btn: 'Abrir WhatsApp', href: 'https://wa.me/19564760388' },
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
