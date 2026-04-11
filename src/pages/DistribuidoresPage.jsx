import { useNavigate } from 'react-router-dom'
import {
  Zap, Sun, Moon, UserCheck, ArrowRight, BarChart2, MessageCircle,
  TrendingUp, LayoutDashboard, Megaphone, AlertCircle, Sparkles,
  Eye, GitMerge, Sprout, Lightbulb, FileText, ClipboardList, CheckCircle,
  User, Star, Crown, Target, Gift, Activity, Rocket, MinusCircle,
  Key, BarChart, Calendar, CalendarCheck, Cpu, BookOpen, Banknote,
  ArrowUpRight, ShieldCheck, Building2, UserPlus, Percent, Check, Minus,
  ArrowUp,
} from 'lucide-react'
import { useState } from 'react'

const css = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

:root {
  --blue: #0066ff;
  --blue-light: rgba(0,102,255,0.12);
  --green: #00c853;
  --green-light: rgba(0,200,83,0.12);
  --purple: #7c3aed;
  --purple-light: rgba(124,58,237,0.12);
  --amber: #ff9500;
  --amber-light: rgba(255,149,0,0.12);
  --radius: 16px;
  --radius-sm: 10px;
}
[data-theme-dist="dark"] {
  --bg: #070708; --bg2: #0d0d10; --bg3: #141416;
  --surface: rgba(255,255,255,0.03); --surface-hover: rgba(255,255,255,0.05);
  --border: rgba(255,255,255,0.08); --border-strong: rgba(255,255,255,0.14);
  --text: #ffffff; --text-2: #c7c7cc; --text-3: #8e8e93; --text-4: #3a3a3c;
}
[data-theme-dist="light"] {
  --bg: #f5f5f7; --bg2: #ffffff; --bg3: #f0f0f3;
  --surface: rgba(0,0,0,0.03); --surface-hover: rgba(0,0,0,0.05);
  --border: rgba(0,0,0,0.08); --border-strong: rgba(0,0,0,0.14);
  --text: #070708; --text-2: #3a3a3c; --text-3: #6e6e73; --text-4: #c7c7cc;
}
.dist-wrap { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; line-height: 1.6; transition: background 0.3s, color 0.3s; min-height: 100vh; }
.dist-wrap nav { position: fixed; top:0;left:0;right:0; z-index:100; padding:0 48px; height:60px; display:flex; align-items:center; gap:32px; background:rgba(7,7,8,0.85); backdrop-filter:blur(20px); border-bottom:1px solid var(--border); transition:background 0.3s; }
[data-theme-dist="light"] .dist-wrap nav { background:rgba(245,245,247,0.9); }
.nav-logo { display:flex; align-items:center; gap:10px; text-decoration:none; cursor:pointer; }
.nav-logo-text { font-family:'Plus Jakarta Sans',sans-serif; font-size:15px; font-weight:800; color:var(--text); letter-spacing:-0.3px; }
.nav-links { display:flex; gap:28px; margin-left:8px; }
.nav-links a { font-size:13px; color:var(--text-3); text-decoration:none; transition:color 0.15s; font-weight:500; }
.nav-links a:hover { color:var(--text); }
.nav-right { margin-left:auto; display:flex; align-items:center; gap:10px; }
.theme-toggle { width:36px;height:36px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text-3); display:flex;align-items:center;justify-content:center; cursor:pointer; transition:all 0.15s; }
.theme-toggle:hover { background:var(--surface-hover); color:var(--text); }
.nav-btn { padding:8px 18px; border-radius:8px; font-size:13px;font-weight:600; cursor:pointer;border:none; font-family:'Inter',sans-serif; transition:all 0.15s; background:var(--blue); color:white; }
.nav-btn:hover { opacity:0.88; transform:translateY(-1px); }
.hero-main { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:120px 48px 80px; text-align:center; position:relative; overflow:hidden; }
.hero-bg { position:absolute;inset:0;z-index:0; background:radial-gradient(ellipse 80% 60% at 20% 50%,rgba(0,102,255,0.12) 0%,transparent 60%), radial-gradient(ellipse 60% 60% at 80% 30%,rgba(124,58,237,0.10) 0%,transparent 60%), radial-gradient(ellipse 50% 40% at 50% 80%,rgba(0,200,83,0.06) 0%,transparent 60%); }
[data-theme-dist="light"] .hero-bg { background:radial-gradient(ellipse 80% 60% at 20% 50%,rgba(0,102,255,0.07) 0%,transparent 60%), radial-gradient(ellipse 60% 60% at 80% 30%,rgba(124,58,237,0.06) 0%,transparent 60%); }
.hero-grid { position:absolute;inset:0;z-index:0;opacity:0.03; background-image:linear-gradient(var(--text) 1px,transparent 1px),linear-gradient(90deg,var(--text) 1px,transparent 1px); background-size:60px 60px; }
.hero-content { position:relative;z-index:1; max-width:860px; }
.hero-badge { display:inline-flex;align-items:center;gap:8px; background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:6px 16px; font-size:12.5px;font-weight:600; color:var(--text-3); margin-bottom:28px; }
.badge-dot { width:6px;height:6px; border-radius:50%; background:var(--green); animation:dist-pulse 2s infinite; }
@keyframes dist-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
.hero-main h1 { font-family:'Plus Jakarta Sans',sans-serif; font-size:clamp(44px,7vw,80px); font-weight:900; line-height:1.04; letter-spacing:-2.5px; margin-bottom:24px; }
.hero-main h1 em { font-style:normal; background:linear-gradient(135deg,#4d9fff 0%,#7c3aed 50%,#00c853 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.hero-sub { font-size:19px; color:var(--text-3); line-height:1.65; max-width:580px; margin:0 auto 40px; }
.hero-actions { display:flex;gap:12px;justify-content:center;flex-wrap:wrap; margin-bottom:64px; }
.btn-primary { display:inline-flex;align-items:center;gap:8px; background:var(--text); color:var(--bg); padding:14px 28px; border-radius:var(--radius-sm); font-size:15px;font-weight:700; cursor:pointer;border:none; font-family:'Inter',sans-serif; transition:all 0.18s; text-decoration:none; }
.btn-primary:hover { opacity:0.88; transform:translateY(-2px); }
.btn-ghost { display:inline-flex;align-items:center;gap:8px; background:transparent; color:var(--text-2); padding:14px 28px; border-radius:var(--radius-sm); font-size:15px;font-weight:600; cursor:pointer; border:1px solid var(--border-strong); font-family:'Inter',sans-serif; transition:all 0.18s; text-decoration:none; }
.btn-ghost:hover { background:var(--surface-hover); color:var(--text); }
.hero-metrics { display:flex;justify-content:center; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); backdrop-filter:blur(20px); overflow:hidden; max-width:720px; margin:0 auto; }
.hero-metric { flex:1; padding:24px 28px; text-align:center; border-right:1px solid var(--border); }
.hero-metric:last-child { border-right:none; }
.metric-big { font-family:'Plus Jakarta Sans',sans-serif; font-size:34px;font-weight:900; letter-spacing:-1px;line-height:1; margin-bottom:6px; }
.metric-small { font-size:12.5px; color:var(--text-3); font-weight:500; line-height:1.4; }
.section { padding:100px 48px; max-width:1200px; margin:0 auto; }
.section-label { display:inline-flex;align-items:center;gap:6px; font-size:11.5px;font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--blue); margin-bottom:16px; }
.section-label::before { content:''; width:20px;height:1.5px; background:currentColor; }
h2 { font-family:'Plus Jakarta Sans',sans-serif; font-size:clamp(32px,4vw,50px); font-weight:800; letter-spacing:-1.5px; line-height:1.08; margin-bottom:16px; }
h2 em { font-style:normal; color:var(--text-3); }
.section-sub { font-size:17px; color:var(--text-3); max-width:560px; line-height:1.65; margin-bottom:56px; }
.dist-divider { border:none; border-top:1px solid var(--border); max-width:1200px; margin:0 auto; }
.deficit-hero { padding:100px 48px; max-width:1200px; margin:0 auto; }
.deficit-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.deficit-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:32px; transition:all 0.18s; position:relative; overflow:hidden; }
.deficit-card:hover { background:var(--surface-hover); border-color:var(--border-strong); transform:translateY(-2px); }
.deficit-num { font-family:'Plus Jakarta Sans',sans-serif; font-size:13px;font-weight:800; color:var(--text-4); letter-spacing:0.08em; margin-bottom:16px; }
.deficit-icon { width:44px;height:44px; border-radius:10px; display:flex;align-items:center;justify-content:center; margin-bottom:16px; }
.deficit-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:18px;font-weight:800; letter-spacing:-0.3px; margin-bottom:10px; }
.deficit-desc { font-size:14.5px; color:var(--text-3); line-height:1.6; margin-bottom:20px; }
.deficit-solution { font-size:13.5px; color:var(--green); font-weight:600; padding:12px 16px; background:var(--green-light); border-radius:var(--radius-sm); line-height:1.5; display:flex; align-items:flex-start; gap:8px; }
.cycle-box { background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; margin-top:48px; }
.cycle-header { padding:24px 32px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }
.cycle-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:17px;font-weight:800; letter-spacing:-0.3px; }
.badge-pill { display:inline-flex;align-items:center;gap:6px; background:var(--green-light); color:var(--green); border:1px solid rgba(0,200,83,0.2); border-radius:20px; padding:5px 12px; font-size:12px;font-weight:700; }
.cycle-steps { display:grid; grid-template-columns:repeat(4,1fr); }
.cycle-step { padding:28px; border-right:1px solid var(--border); }
.cycle-step:last-child { border-right:none; }
.cycle-step-num { font-family:'Plus Jakarta Sans',sans-serif; font-size:11px;font-weight:700; color:var(--text-4); letter-spacing:0.08em; text-transform:uppercase; margin-bottom:14px; }
.cycle-step-icon { width:40px;height:40px; border-radius:10px; background:var(--surface); border:1px solid var(--border); display:flex;align-items:center;justify-content:center; margin-bottom:14px; }
.cycle-step-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:15px;font-weight:700; margin-bottom:8px; }
.cycle-step-desc { font-size:13.5px; color:var(--text-3); line-height:1.55; margin-bottom:14px; }
.auto-badge { display:inline-flex;align-items:center;gap:5px; background:var(--green-light); color:var(--green); border-radius:6px; padding:4px 9px; font-size:11.5px;font-weight:700; }
.etapas-hero { padding:0 48px 80px; max-width:1200px; margin:0 auto; }
.etapas-hero-header { background:linear-gradient(135deg,rgba(0,102,255,0.08),rgba(124,58,237,0.06)); border:1px solid var(--border); border-radius:var(--radius); padding:64px 56px; margin-bottom:16px; position:relative; overflow:hidden; }
.etapas-hero-header::before { content:''; position:absolute; top:0;left:0;right:0; height:2px; background:linear-gradient(90deg,var(--blue),var(--purple)); }
.etapas-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
.etapa-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:36px 32px; transition:all 0.18s; position:relative; overflow:hidden; }
.etapa-card:hover { background:var(--surface-hover); border-color:var(--border-strong); transform:translateY(-2px); }
.etapa-tag { display:inline-flex;align-items:center;gap:6px; font-size:11px;font-weight:700; letter-spacing:0.08em; text-transform:uppercase; padding:4px 10px; border-radius:6px; margin-bottom:20px; }
.etapa-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:24px;font-weight:800; letter-spacing:-0.5px; margin-bottom:6px; }
.etapa-subtitle { font-size:14px;font-weight:600; margin-bottom:16px; }
.etapa-problem { font-size:14px; color:var(--text-3); padding:14px 16px; background:rgba(255,59,48,0.05); border:1px solid rgba(255,59,48,0.12); border-radius:var(--radius-sm); line-height:1.6; margin-bottom:20px; display:flex; gap:10px; align-items:flex-start; }
.etapa-features { list-style:none; display:flex; flex-direction:column; gap:10px; margin-bottom:20px; }
.etapa-features li { font-size:14px; color:var(--text-2); display:flex; align-items:flex-start; gap:10px; line-height:1.5; }
.etapa-features li svg { flex-shrink:0; margin-top:2px; color:var(--blue); }
.etapa-unique { font-size:14px;font-weight:600; color:var(--text); padding:14px 16px; background:var(--blue-light); border-radius:var(--radius-sm); line-height:1.55; display:flex; gap:10px; align-items:flex-start; }
.genea-hero { padding:0 48px 80px; max-width:1200px; margin:0 auto; }
.genea-banner { background:linear-gradient(135deg,#050f1e,#0d0d10); border:1px solid rgba(0,102,255,0.2); border-radius:var(--radius); padding:72px 64px; position:relative; overflow:hidden; margin-bottom:16px; }
[data-theme-dist="light"] .genea-banner { background:linear-gradient(135deg,#e8f0ff,#f0ecff); border-color:rgba(0,102,255,0.15); }
.genea-banner::before { content:''; position:absolute; top:0;left:0;right:0; height:2px; background:linear-gradient(90deg,var(--blue),var(--purple),var(--green)); }
.genea-banner h2 { font-size:clamp(36px,5vw,60px); max-width:600px; margin-bottom:16px; }
.genea-desc { font-size:17px; color:var(--text-3); max-width:580px; line-height:1.65; margin-bottom:40px; }
.genea-features { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.gen-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); padding:24px; transition:all 0.18s; }
.gen-card:hover { background:var(--surface-hover); }
.gen-icon { width:40px;height:40px; border-radius:10px; display:flex;align-items:center;justify-content:center; margin-bottom:14px; }
.gen-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:15px;font-weight:700; margin-bottom:6px; }
.gen-desc { font-size:13.5px; color:var(--text-3); line-height:1.55; }
.highlight-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:28px 32px; display:flex; gap:16px; align-items:flex-start; }
.highlight-card p { font-size:16px; color:var(--text-2); line-height:1.65; }
.highlight-card strong { color:var(--text); }
.planes-section { padding:100px 48px; max-width:1200px; margin:0 auto; }
.planes-section table { width:100%; border-collapse:collapse; font-size:14px; }
.planes-section th { background:var(--bg2); padding:14px 16px; text-align:center; font-family:'Plus Jakarta Sans',sans-serif; font-size:14px;font-weight:800; border-bottom:1px solid var(--border); letter-spacing:-0.2px; }
.planes-section th:first-child { text-align:left; }
.planes-section td { padding:13px 16px; text-align:center; border-bottom:1px solid var(--border); color:var(--text-2); }
.planes-section td:first-child { text-align:left; color:var(--text-3); font-weight:500; }
.planes-section tr:hover td { background:var(--surface); }
.price-main { font-family:'Plus Jakarta Sans',sans-serif; font-size:26px;font-weight:900; letter-spacing:-1px; color:var(--text); line-height:1; }
.price-sub { font-size:11px; color:var(--text-3); font-weight:500; }
.price-annual { font-size:15px; color:var(--blue); font-weight:700; }
.price-savings { font-size:12px; color:var(--green); font-weight:700; }
.t-check { color:var(--green); }
.t-cross { color:var(--text-4); }
.t-section td { font-size:11px;font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-3); background:var(--surface); padding:8px 16px; }
.niveles-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:48px; }
.nivel-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:32px 28px; transition:all 0.18s; }
.nivel-card:hover { background:var(--surface-hover); border-color:var(--border-strong); transform:translateY(-2px); }
.nivel-card.elite { background:rgba(255,149,0,0.05); border-color:rgba(255,149,0,0.2); }
.nivel-badge { display:inline-flex;align-items:center;gap:6px; font-size:11px;font-weight:800; letter-spacing:0.1em; text-transform:uppercase; padding:4px 10px; border-radius:6px; margin-bottom:16px; }
.nivel-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:28px;font-weight:900; letter-spacing:-0.5px; margin-bottom:4px; }
.nivel-req { font-size:13px; color:var(--text-3); margin-bottom:24px; font-weight:500; }
.nivel-comision { margin-bottom:16px; }
.nivel-comision-label { font-size:11px;font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:0.07em; display:flex;align-items:center;gap:5px; margin-bottom:4px; }
.nivel-comision-value { font-family:'Plus Jakarta Sans',sans-serif; font-size:32px;font-weight:900; letter-spacing:-1px; line-height:1; }
.nivel-comision-currency { font-size:11px; color:var(--text-3); margin-top:2px; }
.nivel-meta { background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm); padding:14px 16px; margin-top:24px; }
.nivel-meta-label { font-size:11px;font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:4px; }
.nivel-meta-value { font-family:'Plus Jakarta Sans',sans-serif; font-size:16px;font-weight:800; letter-spacing:-0.3px; }
.puntos-box { display:flex;align-items:center;gap:24px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:32px; margin-bottom:32px; justify-content:center; }
.punto-item { text-align:center; }
.punto-value { font-family:'Plus Jakarta Sans',sans-serif; font-size:48px;font-weight:900; letter-spacing:-2px; color:var(--purple); line-height:1; }
.punto-label { font-size:12px;font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px; }
.punto-sub { font-size:13px; color:var(--text-3); line-height:1.4; }
.puntos-plus { font-family:'Plus Jakarta Sans',sans-serif; font-size:32px;font-weight:900; color:var(--text-3); }
.bono-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:48px; }
.bono-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:28px; }
.bono-nivel { font-size:12px;font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px; }
.bono-pts { font-size:13.5px; color:var(--text-2); display:flex;align-items:center;gap:6px; margin-bottom:14px; }
.bono-amount { font-family:'Plus Jakarta Sans',sans-serif; font-size:36px;font-weight:900; letter-spacing:-1.5px; color:var(--text); line-height:1; margin-bottom:4px; }
.bono-currency { font-size:12px; color:var(--text-3); }
.velocidad-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:48px; }
.vel-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:28px; text-align:center; }
.vel-pct { font-family:'Plus Jakarta Sans',sans-serif; font-size:48px;font-weight:900; letter-spacing:-2px; line-height:1; margin-bottom:8px; }
.vel-label { font-size:14px; color:var(--text-3); margin-bottom:16px; }
.vel-pago { display:inline-flex;align-items:center;gap:6px; background:var(--green-light); color:var(--green); border:1px solid rgba(0,200,83,0.2); border-radius:var(--radius-sm); padding:10px 16px; font-size:13px;font-weight:700; }
.escenarios-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.esc-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:32px 28px; }
.esc-card.medio { background:rgba(0,102,255,0.04); border-color:rgba(0,102,255,0.2); }
.esc-card.agresivo { background:rgba(0,200,83,0.04); border-color:rgba(0,200,83,0.2); }
.esc-tag { display:inline-flex;align-items:center;gap:5px; font-size:11px;font-weight:700; padding:4px 10px; border-radius:6px; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:12px; }
.esc-nivel { font-size:13px; color:var(--text-3); margin-bottom:20px; font-weight:500; }
.esc-line { display:flex;justify-content:space-between;align-items:center; padding:8px 0; border-bottom:1px solid var(--border); font-size:13.5px; }
.esc-line-label { color:var(--text-3); }
.esc-line-val { color:var(--text-2); font-weight:600; }
.esc-total { padding:20px 0 16px; text-align:center; }
.esc-total-label { font-size:11px;font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:8px; }
.esc-total-mes { font-family:'Plus Jakarta Sans',sans-serif; font-size:40px;font-weight:900; letter-spacing:-2px; line-height:1; }
.esc-total-sub { font-size:12px; color:var(--text-3); }
.esc-bono { display:flex;align-items:center;gap:6px;justify-content:center; font-size:13px;font-weight:700; color:var(--green); padding:12px; background:var(--green-light); border-radius:var(--radius-sm); }
.knowhow-hero { padding:0 48px 80px; max-width:1200px; margin:0 auto; }
.knowhow-banner { background:linear-gradient(135deg,rgba(124,58,237,0.08),rgba(0,102,255,0.05)); border:1px solid var(--border); border-radius:var(--radius); padding:64px 56px; margin-bottom:16px; position:relative; overflow:hidden; }
.knowhow-banner::before { content:''; position:absolute; top:0;left:0;right:0; height:2px; background:linear-gradient(90deg,var(--purple),var(--blue)); }
.funnel-steps { display:flex;flex-direction:column; gap:0; }
.funnel-step { display:flex;gap:24px; padding:28px 32px; border:1px solid var(--border); border-radius:var(--radius); margin-bottom:12px; background:var(--surface); transition:all 0.18s; }
.funnel-step:hover { background:var(--surface-hover); border-color:var(--border-strong); }
.funnel-num { font-family:'Plus Jakarta Sans',sans-serif; font-size:36px;font-weight:900; letter-spacing:-1px; color:var(--text-4); line-height:1; flex-shrink:0; min-width:56px; }
.funnel-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:18px;font-weight:800; letter-spacing:-0.3px; margin-bottom:8px; }
.funnel-desc { font-size:14.5px; color:var(--text-3); line-height:1.6; margin-bottom:12px; }
.funnel-key { font-size:13.5px; color:var(--text-2); padding:12px 16px; background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius-sm); line-height:1.55; }
.funnel-key strong { color:var(--text); }
.impl-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
.impl-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:40px 36px; }
.impl-price { font-family:'Plus Jakarta Sans',sans-serif; font-size:56px;font-weight:900; letter-spacing:-3px; line-height:1; color:var(--green); margin-bottom:4px; }
.impl-price-mxn { font-size:12px; color:var(--text-3); margin-bottom:20px; font-weight:600; }
.impl-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:22px;font-weight:900; letter-spacing:-0.5px; margin-bottom:20px; }
.impl-list { list-style:none; display:flex;flex-direction:column; gap:12px; }
.impl-list li { font-size:14px; color:var(--text-2); display:flex; align-items:flex-start; gap:10px; line-height:1.5; }
.impl-list li svg { flex-shrink:0; margin-top:2px; color:var(--green); }
.portal-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:48px; }
.portal-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:28px; transition:all 0.18s; }
.portal-card:hover { background:var(--surface-hover); border-color:var(--border-strong); transform:translateY(-2px); }
.portal-icon { width:44px;height:44px; border-radius:10px; display:flex;align-items:center;justify-content:center; margin-bottom:16px; }
.portal-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:16px;font-weight:800; margin-bottom:8px; }
.portal-desc { font-size:14px; color:var(--text-3); line-height:1.6; }
.fiscal-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
.fiscal-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:32px; }
.fiscal-title { font-family:'Plus Jakarta Sans',sans-serif; font-size:17px;font-weight:800; letter-spacing:-0.3px; margin-bottom:20px; display:flex;align-items:center;gap:10px; }
.fiscal-list { list-style:none; display:flex;flex-direction:column; gap:12px; }
.fiscal-list li { font-size:14px; color:var(--text-2); display:flex; align-items:flex-start; gap:10px; line-height:1.5; }
.fiscal-list li svg { flex-shrink:0; margin-top:2px; color:var(--green); }
.pitch-section { padding:80px 48px; }
.pitch-box { max-width:840px; margin:0 auto; text-align:center; background:linear-gradient(135deg,rgba(0,102,255,0.08),rgba(124,58,237,0.05)); border:1px solid var(--border); border-radius:var(--radius); padding:72px 64px; position:relative; overflow:hidden; }
.pitch-box::before { content:''; position:absolute; top:0;left:0;right:0; height:2px; background:linear-gradient(90deg,var(--blue),var(--purple),var(--green)); }
.pitch-box h2 { font-size:clamp(28px,4vw,44px); margin-bottom:20px; }
.pitch-sub { font-size:17px; color:var(--text-3); line-height:1.65; margin-bottom:40px; max-width:560px; margin-left:auto; margin-right:auto; }
.pitch-actions { display:flex;gap:12px;justify-content:center;flex-wrap:wrap; }
.dist-footer { padding:32px 48px; border-top:1px solid var(--border); display:flex;align-items:center;justify-content:space-between; }
.footer-logo { display:flex;align-items:center;gap:10px; font-family:'Plus Jakarta Sans',sans-serif; font-size:14px;font-weight:800; color:var(--text); }
.footer-note { font-size:12.5px; color:var(--text-3); }
@media(max-width:768px) {
  .dist-wrap nav { padding:0 20px; }
  .nav-links { display:none; }
  .hero-main { padding:100px 24px 60px; }
  .section { padding:60px 24px; }
  .deficit-grid,.etapas-grid,.genea-features,.niveles-grid,.bono-grid,.velocidad-grid,.escenarios-grid,.impl-grid,.portal-grid,.fiscal-grid { grid-template-columns:1fr; }
  .cycle-steps { grid-template-columns:1fr 1fr; }
  .etapas-hero,.genea-hero,.knowhow-hero { padding:0 24px 60px; }
  .planes-section { padding:60px 24px; }
  .genea-banner { padding:40px 28px; }
  .pitch-box { padding:40px 28px; }
}
`

export default function DistribuidoresPage() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState('dark')

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <div data-theme-dist={theme} className="dist-wrap">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav>
        <div className="nav-logo" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="Flow Hub CRM" style={{ height: '28px', objectFit: 'contain' }} />
          <span className="nav-logo-text">Flow Hub CRM</span>
        </div>
        <div className="nav-links">
          <a href="#sistema">El sistema</a>
          <a href="#etapas">Etapas</a>
          <a href="#planes">Planes</a>
          <a href="#programa">Comisiones</a>
          <a href="#knowhow">Know how</a>
          <a href="#portal">Tu portal</a>
        </div>
        <div className="nav-right">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="nav-btn" onClick={() => navigate('/unirse')}>
            Quiero ser distribuidor
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero-main">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-badge">
            <div className="badge-dot" />
            Programa oficial de distribuidores Flow Hub 2026
          </div>
          <h1>
            Vende el sistema<br />
            <em>que usas todos los días</em>
          </h1>
          <p className="hero-sub">
            Conviértete en distribuidor oficial de Flow Hub CRM. Gana comisiones vendiendo la herramienta de ventas con IA más completa del mercado — y úsala para vender más mientras lo haces.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate('/unirse')}>
              <UserCheck size={16} />
              Quiero ser distribuidor
            </button>
            <a href="#sistema" className="btn-ghost">
              <ArrowRight size={16} />
              Ver el programa completo
            </a>
          </div>
          <div className="hero-metrics">
            <div className="hero-metric">
              <div className="metric-big" style={{ color: 'var(--green)' }}>$8–12K</div>
              <div className="metric-small">MXN por implementación<br />de cliente raíz</div>
            </div>
            <div className="hero-metric">
              <div className="metric-big" style={{ color: 'var(--blue)' }}>$3–5K</div>
              <div className="metric-small">MXN por implementación<br />de distribuidor</div>
            </div>
            <div className="hero-metric">
              <div className="metric-big" style={{ color: 'var(--amber)' }}>$70K</div>
              <div className="metric-small">MXN bono trimestral<br />nivel Elite</div>
            </div>
            <div className="hero-metric">
              <div className="metric-big">100%</div>
              <div className="metric-small">Comisiones el mismo<br />viernes si cumples meta</div>
            </div>
          </div>
        </div>
      </div>

      <hr className="dist-divider" />

      {/* SISTEMA */}
      <div className="deficit-hero" id="sistema">
        <div className="section-label">01 — El problema que resuelves</div>
        <h2>Lo que <em>frena</em> a los distribuidores</h2>
        <p className="section-sub">Tres déficits que tienen todos los distribuidores MLM y cómo Flow Hub los elimina de raíz.</p>
        <div className="deficit-grid">
          {[
            { num: '01', icon: <BarChart2 size={20} style={{ color: 'var(--blue)' }} />, bg: 'var(--blue-light)', title: 'Sin sistema de ventas', desc: 'Prospectos que llegan y se pierden. Seguimiento inconsistente. Sin pipeline, sin métricas, sin visibilidad de qué funciona y qué no.', sol: 'Flow Hub organiza todos tus prospectos, automatiza el seguimiento y te da el pipeline visual que un distribuidor necesita para escalar.' },
            { num: '02', icon: <MessageCircle size={20} style={{ color: 'var(--purple)' }} />, bg: 'var(--purple-light)', title: 'Bandeja fragmentada', desc: 'WhatsApp, Instagram y Facebook en apps separadas. Prospectos sin respuesta. El primer respondedor cierra — y el lento pierde.', sol: 'La bandeja unificada centraliza todos tus mensajes. El agente IA responde 24/7 para que nunca pierdas un prospecto por tiempo de respuesta.' },
            { num: '03', icon: <TrendingUp size={20} style={{ color: 'var(--green)' }} />, bg: 'var(--green-light)', title: 'Contenido inconsistente', desc: 'Publicar todos los días requiere creatividad, diseño y tiempo. Tres recursos que la mayoría de los distribuidores no tienen.', sol: 'Content Studio + IA genera el guión, las imágenes y el plan de contenido. El distribuidor solo graba y publica — el sistema hace el resto.' },
          ].map((c) => (
            <div className="deficit-card" key={c.num}>
              <div className="deficit-num">Déficit {c.num}</div>
              <div className="deficit-icon" style={{ background: c.bg }}>{c.icon}</div>
              <div className="deficit-title">{c.title}</div>
              <p className="deficit-desc">{c.desc}</p>
              <div className="deficit-solution">
                <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                {c.sol}
              </div>
            </div>
          ))}
        </div>

        {/* Cycle */}
        <div className="cycle-box">
          <div className="cycle-header">
            <div className="cycle-title">Cómo fluye el prospecto en Flow Hub</div>
            <div className="badge-pill"><Cpu size={12} />100% automatizado</div>
          </div>
          <div className="cycle-steps">
            {[
              { num: 'Paso 01', icon: <Megaphone size={20} />, color: 'var(--blue)', title: 'Publica contenido', desc: 'El Content Studio genera el guión y las imágenes. Tú grabas 60 segundos. El sistema publica en todas tus redes.', badge: 'Guión generado por IA' },
              { num: 'Paso 02', icon: <MessageCircle size={20} />, color: 'var(--purple)', title: 'El prospecto escribe', desc: 'Alguien responde tu publicación. El agente IA contesta al instante, califica el interés y recopila información clave.', badge: 'El agente responde solo' },
              { num: 'Paso 03', icon: <BarChart2 size={20} />, color: 'var(--amber)', title: 'Califica y organiza', desc: 'El sistema determina el nivel de interés y mueve al prospecto a la etapa correcta del pipeline.', badge: 'Se mueve solo en el pipeline' },
              { num: 'Paso 04', icon: <CalendarCheck size={20} />, color: 'var(--green)', title: 'Agenda la cita', desc: 'Cuando el prospecto está listo, el agente agenda la reunión de cierre contigo automáticamente.', badge: 'Tú recibes la notificación' },
            ].map((s) => (
              <div className="cycle-step" key={s.num}>
                <div className="cycle-step-num">{s.num}</div>
                <div className="cycle-step-icon" style={{ color: s.color }}>{s.icon}</div>
                <div className="cycle-step-title">{s.title}</div>
                <p className="cycle-step-desc">{s.desc}</p>
                <div className="auto-badge"><Cpu size={11} />{s.badge}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <hr className="dist-divider" />

      {/* ETAPAS */}
      <div className="etapas-hero" id="etapas">
        <div className="etapas-hero-header">
          <div className="section-label">02 — El ciclo completo</div>
          <h2>Flow Hub cubre<br /><em>todo el proceso</em></h2>
          <p className="section-sub" style={{ marginBottom: 0 }}>Nunca antes un distribuidor tuvo acceso a esta infraestructura completa en una sola herramienta — desde generar el prospecto hasta cerrar la venta.</p>
        </div>
        <div className="etapas-grid">
          {[
            {
              tag: 'Etapa 01 — Atraer', tagBg: 'rgba(0,102,255,0.1)', tagColor: 'var(--blue)',
              icon: <Megaphone size={12} />, title: 'Nunca te quedes sin prospectos',
              subtitle: '"No sé de qué publicar ni tengo tiempo de diseñar"', subtitleColor: 'var(--blue)',
              problem: 'El problema: no tienes formación, no tienes diseñador y el tiempo siempre es escaso. Sin contenido no hay prospectos.',
              features: ['Radar de noticias virales — la IA encuentra los temas del día que tu audiencia ya está buscando', 'Generador de guión — te dice exactamente qué decir en tu video con hook, desarrollo y llamada a la acción', 'Imágenes con IA — diseño profesional en segundos, sin Canva ni diseñador externo', 'Kits de marca — tus colores, tipografías y logo siempre consistentes en todo tu contenido', 'Publicación directa — desde Flow Hub a todas tus redes, sin salir del sistema'],
              unique: 'No necesitas ser creativo ni diseñador. La herramienta convierte tu industria en contenido que atrae prospectos todos los días.'
            },
            {
              tag: 'Etapa 02 — Conectar', tagBg: 'var(--purple-light)', tagColor: 'var(--purple)',
              icon: <MessageCircle size={12} />, title: 'Nunca pierdas un prospecto por falta de respuesta',
              subtitle: '"Me escriben de 3 lados y no puedo responder a todos"', subtitleColor: 'var(--purple)',
              problem: 'El problema: los prospectos llegan pero se pierden porque la respuesta llega tarde o no llega. Cada hora que pasa es una venta perdida.',
              features: ['Bandeja unificada — WhatsApp, Instagram y Facebook en un solo lugar, sin cambiar de app', 'Agente IA 24/7 — responde inmediatamente mientras tú duermes, trabajas o cierras otra venta', 'Memoria del prospecto — conoce el historial completo de cada conversación sin repetirte', 'Responde con tu material — el agente aprende de tu negocio, tu producto y tu estilo personal', 'Páginas de captura — landing pages integradas para recibir prospectos de campañas'],
              unique: 'No es un bot genérico. Tu agente habla como tú hablarías. Nunca se cansa, nunca olvida, nunca deja de responder.'
            },
            {
              tag: 'Etapa 03 — Convertir', tagBg: 'var(--green-light)', tagColor: 'var(--green)',
              icon: <TrendingUp size={12} />, title: 'Cierra más sin trabajar más',
              subtitle: '"Tengo prospectos pero no sé cuáles están listos para cerrar"', subtitleColor: 'var(--green)',
              problem: 'El problema: hay oportunidades pero el desorden las hace invisibles. El olvido es el mayor enemigo de un vendedor sin sistema.',
              features: ['Pipeline visual — todos tus prospectos organizados por etapa en un tablero claro y fácil de leer', 'Puntuación automática — el sistema te dice quién necesita atención urgente hoy', 'Historial completo — sabes todo del prospecto antes de llamarle, sin preparación extra', 'Llamadas de venta IA — tu agente puede hacer la llamada de contacto inicial por ti', 'Catálogo de productos — cada oportunidad asociada al producto y valor correcto', 'Transferencia de leads — pasa prospectos a tu equipo cuando no alcanzas a atender todos'],
              unique: 'El contexto completo siempre a la mano. Nunca pierdas una oportunidad por olvido o por no saber dónde está cada prospecto.',
              cardStyle: { borderColor: 'rgba(0,200,83,0.2)', background: 'linear-gradient(160deg,var(--green-light),var(--surface))' }
            },
            {
              tag: 'Etapa 04 — Administrar', tagBg: 'var(--amber-light)', tagColor: 'var(--amber)',
              icon: <LayoutDashboard size={12} />, title: 'Construye un negocio, no solo ventas',
              subtitle: '"No sé si voy bien o mal ni qué está haciendo mi equipo"', subtitleColor: 'var(--amber)',
              problem: 'El problema: sin visibilidad no hay dirección. Sin métricas no sabes dónde mejorar. Sin sistema de metas no hay crecimiento sostenido.',
              features: ['Metas trimestrales — el sistema de rocas que desglosa tu meta anual en acciones concretas del día', 'Indicadores en tiempo real — dashboard completo de tu negocio siempre actualizado', 'Genealogía y equipo — toda tu red en un solo lugar con permisos configurables por rol', 'Múltiples kits de marca — identidad visual consistente para cada tipo de contenido', 'Análisis de conversión — identifica exactamente dónde se pierden tus prospectos'],
              unique: 'No es solo para cerrar ventas de hoy. Es para construir un negocio sostenible donde toda tu genealogía habla el mismo idioma.'
            },
          ].map((e, i) => (
            <div className="etapa-card" key={i} style={e.cardStyle || {}}>
              <div className="etapa-tag" style={{ background: e.tagBg, color: e.tagColor }}>
                {e.icon}{e.tag}
              </div>
              <div className="etapa-title">{e.title}</div>
              <div className="etapa-subtitle" style={{ color: e.subtitleColor }}>{e.subtitle}</div>
              <div className="etapa-problem">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1, color: '#ff3b30' }} />
                {e.problem}
              </div>
              <ul className="etapa-features">
                {e.features.map((f, j) => (
                  <li key={j}><ArrowRight size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--blue)' }} />{f}</li>
                ))}
              </ul>
              <div className="etapa-unique">
                <Sparkles size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--blue)' }} />
                {e.unique}
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="dist-divider" />

      {/* GENEALOGIA */}
      <div className="genea-hero">
        <div className="genea-banner">
          <div className="section-label">03 — El diferenciador único</div>
          <h2>La genealogía<br /><em>conectada</em></h2>
          <p className="genea-desc">Nunca antes un líder de multinivel pudo ver el negocio de toda su red en una sola pantalla — y hacer que los leads fluyan hacia abajo para que su equipo los cierre.</p>
          <div className="genea-features">
            {[
              { icon: <Eye size={20} style={{ color: 'var(--blue)' }} />, bg: 'var(--blue-light)', title: 'Visibilidad total de la red', desc: 'Como raíz ves en tiempo real cuántos leads tiene cada distribuidor, en qué etapa están y quién necesita apoyo urgente.' },
              { icon: <GitMerge size={20} style={{ color: 'var(--purple)' }} />, bg: 'var(--purple-light)', title: 'Transferencia de leads', desc: 'Cuando no alcanzas a atender todos tus prospectos, los transfieres a distribuidores de tu genealogía. Ninguna oportunidad se pierde.' },
              { icon: <Sprout size={20} style={{ color: 'var(--green)' }} />, bg: 'var(--green-light)', title: 'El distribuidor crece desde el día 1', desc: 'Al unirse a Flow Hub, el distribuidor puede recibir leads calificados de arriba. Su inversión mensual puede generarle oportunidades inmediatamente.' },
            ].map((g, i) => (
              <div className="gen-card" key={i}>
                <div className="gen-icon" style={{ background: g.bg }}>{g.icon}</div>
                <div className="gen-title">{g.title}</div>
                <p className="gen-desc">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="highlight-card">
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lightbulb size={20} style={{ color: 'var(--blue)' }} />
          </div>
          <p><strong>El argumento más poderoso para el distribuidor:</strong> Al pagar $100 al mes de Flow Hub no solo tienes el sistema para vender más. También entras al ecosistema donde tu upline puede mandarte prospectos que tú cierras. Es la única herramienta donde tu inversión mensual puede generarte leads calificados desde arriba — desde el primer día.</p>
        </div>
      </div>

      <hr className="dist-divider" />

      {/* PLANES */}
      <div className="planes-section" id="planes">
        <div className="section-label">04 — Planes y precios</div>
        <h2>Lo que <em>ofreces</em></h2>
        <p className="section-sub">5 planes para cada etapa del distribuidor. Desde quien empieza solo hasta quien lidera una red de cientos de personas.</p>
        <table>
          <thead>
            <tr><th></th><th>BÁSICO</th><th>SOLO</th><th>EQUIPO</th><th>AGENCIA</th><th>RED</th></tr>
          </thead>
          <tbody>
            <tr className="t-section"><td colSpan={6}>Precio</td></tr>
            <tr><td>Mensual</td><td><div className="price-main">$49</div><div className="price-sub">USD/mes</div></td><td><div className="price-main">$100</div><div className="price-sub">USD/mes</div></td><td><div className="price-main">$199</div><div className="price-sub">USD/mes</div></td><td><div className="price-main">$349</div><div className="price-sub">USD/mes</div></td><td><div className="price-main">$599</div><div className="price-sub">USD/mes</div></td></tr>
            <tr><td>Anual / mes</td><td><div className="price-annual">$41</div></td><td><div className="price-annual">$83</div></td><td><div className="price-annual">$166</div></td><td><div className="price-annual">$291</div></td><td><div className="price-annual">$499</div></td></tr>
            <tr><td>Ahorro anual</td><td><div className="price-savings">$96 USD</div></td><td><div className="price-savings">$204 USD</div></td><td><div className="price-savings">$396 USD</div></td><td><div className="price-savings">$696 USD</div></td><td><div className="price-savings">$1,200 USD</div></td></tr>
            <tr className="t-section"><td colSpan={6}>Límites</td></tr>
            <tr><td>Usuarios</td><td>1</td><td>1</td><td>5</td><td>15</td><td>∞</td></tr>
            <tr><td>Leads activos</td><td>250</td><td>500</td><td>2,500</td><td>10,000</td><td>∞</td></tr>
            <tr><td>Pipelines</td><td>1</td><td>3</td><td>∞</td><td>∞</td><td>∞</td></tr>
            <tr className="t-section"><td colSpan={6}>Funciones clave</td></tr>
            {['Genealogía y red', 'Agente IA 24/7', 'Content Studio completo', 'WhatsApp + IG + Facebook'].map(f => (
              <tr key={f}><td>{f}</td>{[...Array(5)].map((_,i) => <td key={i} className="t-check"><Check size={16} /></td>)}</tr>
            ))}
            <tr><td>Reportes del equipo</td><td className="t-cross"><Minus size={16} /></td><td className="t-cross"><Minus size={16} /></td><td className="t-check"><Check size={16} /></td><td className="t-check"><Check size={16} /></td><td className="t-check"><Check size={16} /></td></tr>
            <tr><td>Campos personalizados</td><td className="t-cross"><Minus size={16} /></td><td className="t-cross"><Minus size={16} /></td><td className="t-cross"><Minus size={16} /></td><td className="t-check"><Check size={16} /></td><td className="t-check"><Check size={16} /></td></tr>
          </tbody>
        </table>
      </div>

      <hr className="dist-divider" />

      {/* PROGRAMA */}
      <div className="section" id="programa">
        <div className="section-label">05 — Programa de ganancias</div>
        <h2>Tu programa de <em>comisiones</em></h2>
        <p className="section-sub">Un modelo basado en bonos fijos — no porcentajes. Sabes exactamente cuánto ganas por cada venta antes de hacerla.</p>
        <div className="niveles-grid">
          {[
            { badge: 'Asociado', badgeBg: 'var(--surface)', badgeColor: 'var(--text-3)', badgeBorder: '1px solid var(--border)', icon: <User size={11} />, title: 'Asociado', req: '0 a 4 implementaciones acumuladas', raiz: '$8,000', dist: '$3,000', meta: '1 venta / semana' },
            { badge: 'Senior', badgeBg: 'var(--blue-light)', badgeColor: 'var(--blue)', badgeBorder: 'none', icon: <Star size={11} />, title: 'Senior', req: '5 a 14 implementaciones acumuladas', raiz: '$10,000', dist: '$4,000', meta: '2 ventas / semana' },
            { badge: 'Elite', badgeBg: 'rgba(255,149,0,0.1)', badgeColor: 'var(--amber)', badgeBorder: 'none', icon: <Crown size={11} />, title: 'Elite', req: '15+ implementaciones acumuladas', raiz: '$12,000', dist: '$5,000', meta: '3 ventas / semana', elite: true },
          ].map((n) => (
            <div className={`nivel-card${n.elite ? ' elite' : ''}`} key={n.title}>
              <div className="nivel-badge" style={{ background: n.badgeBg, color: n.badgeColor, border: n.badgeBorder }}>{n.icon}{n.badge}</div>
              <div className="nivel-title">{n.title}</div>
              <div className="nivel-req">{n.req}</div>
              <div className="nivel-comision">
                <div className="nivel-comision-label"><Building2 size={12} />Bono venta raíz</div>
                <div className="nivel-comision-value" style={{ color: 'var(--green)' }}>{n.raiz}</div>
                <div className="nivel-comision-currency">MXN por implementación vendida</div>
              </div>
              <div className="nivel-comision">
                <div className="nivel-comision-label"><UserPlus size={12} />Bono venta distribuidor</div>
                <div className="nivel-comision-value" style={{ color: 'var(--blue)' }}>{n.dist}</div>
                <div className="nivel-comision-currency">MXN por implementación vendida</div>
              </div>
              <div className="nivel-meta">
                <div className="nivel-meta-label">Meta semanal para pago inmediato</div>
                <div className="nivel-meta-value">{n.meta}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="section-label">Sistema de puntos — Bono trimestral</div>
        <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.6 }}>Cada tipo de venta vale puntos. Acumula puntos para desbloquear el bono trimestral.</p>
        <div className="puntos-box">
          <div className="punto-item">
            <div className="punto-value">3</div>
            <div className="punto-label">puntos</div>
            <div className="punto-sub">Venta a cliente raíz<br />($1,400 USD implementación)</div>
          </div>
          <div className="puntos-plus">+</div>
          <div className="punto-item">
            <div className="punto-value" style={{ color: 'var(--purple)' }}>1</div>
            <div className="punto-label">punto</div>
            <div className="punto-sub">Venta a distribuidor<br />($550 USD implementación)</div>
          </div>
        </div>

        <div className="bono-grid">
          {[
            { nivel: 'Asociado', pts: '8 puntos en el trimestre', amount: '$15,000', bg: 'var(--surface)', border: 'var(--border)', amtColor: 'var(--text)', iconColor: 'var(--blue)' },
            { nivel: 'Senior', pts: '18 puntos en el trimestre', amount: '$35,000', bg: 'var(--blue-light)', border: 'rgba(0,102,255,0.2)', amtColor: 'var(--text)', iconColor: 'var(--blue)' },
            { nivel: 'Elite', pts: '30 puntos en el trimestre', amount: '$70,000', bg: 'rgba(255,149,0,0.06)', border: 'rgba(255,149,0,0.2)', amtColor: 'var(--amber)', iconColor: 'var(--amber)' },
          ].map((b) => (
            <div className="bono-card" key={b.nivel} style={{ background: b.bg, borderColor: b.border }}>
              <div className="bono-nivel">{b.nivel}</div>
              <div className="bono-pts"><Target size={14} style={{ color: b.iconColor }} />{b.pts}</div>
              <div className="bono-amount" style={{ color: b.amtColor }}>{b.amount}</div>
              <div className="bono-currency">MXN de bono trimestral</div>
            </div>
          ))}
        </div>

        <div className="section-label" style={{ marginTop: 16 }}>Velocidad de pago</div>
        <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.6 }}>No hay fecha fija de pago. Tu velocidad de cierre determina cuándo recibes tu dinero.</p>
        <div className="velocidad-grid">
          {[
            { pct: '100%', pctColor: 'var(--green)', label: 'Meta semanal cumplida', pagoBg: 'var(--green-light)', pagoColor: 'var(--green)', pagoBorder: 'rgba(0,200,83,0.2)', icon: <Zap size={14} />, pago: 'Cobras ese mismo viernes' },
            { pct: '75%', pctColor: 'var(--amber)', label: 'Meta semanal al 75%', pagoBg: 'rgba(255,149,0,0.1)', pagoColor: 'var(--amber)', pagoBorder: 'rgba(255,149,0,0.2)', icon: <Calendar size={14} />, pago: 'Cobras al día 10' },
            { pct: '—', pctColor: 'var(--text-3)', label: 'Sin meta cumplida esa semana', pagoBg: 'var(--surface)', pagoColor: 'var(--text-3)', pagoBorder: 'var(--border)', icon: <Calendar size={14} />, pago: 'Cobras al día 30' },
          ].map((v, i) => (
            <div className="vel-card" key={i}>
              <div className="vel-pct" style={{ color: v.pctColor }}>{v.pct}</div>
              <div className="vel-label">{v.label}</div>
              <div className="vel-pago" style={{ background: v.pagoBg, color: v.pagoColor, borderColor: v.pagoBorder }}>{v.icon}{v.pago}</div>
            </div>
          ))}
        </div>

        <div className="section-label" style={{ marginTop: 16 }}>Escenarios de ganancia</div>
        <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.6 }}>Tres perfiles reales de vendedor con números reales.</p>
        <div className="escenarios-grid">
          {[
            { cls: '', tag: 'Conservador', tagBg: 'var(--surface)', tagColor: 'var(--text-3)', tagBorder: '1px solid var(--border)', icon: <MinusCircle size={11} />, nivel: 'Asociado activo', lines: [['1 raíz al mes × $8,000', '$8,000'], ['1 distribuidor × $3,000', '$3,000'], ['Puntos trimestre', '12 pts → Bono ✓']], total: '$16,000', bono: '+ Bono trimestral $15,000 MXN' },
            { cls: 'medio', tag: 'Medio', tagBg: 'var(--blue-light)', tagColor: 'var(--blue)', tagBorder: 'none', icon: <Activity size={11} />, nivel: 'Senior en forma', lines: [['2 raíces al mes × $10,000', '$20,000'], ['3 distribuidores × $4,000', '$12,000'], ['Puntos trimestre', '27 pts → Bono ✓']], total: '$43,666', bono: '+ Bono trimestral $35,000 MXN' },
            { cls: 'agresivo', tag: 'Agresivo', tagBg: 'var(--green-light)', tagColor: 'var(--green)', tagBorder: 'none', icon: <Rocket size={11} />, nivel: 'Elite productivo', lines: [['4 raíces al mes × $12,000', '$48,000'], ['5 distribuidores × $5,000', '$25,000'], ['Puntos trimestre', '51 pts → Bono ✓']], total: '$96,333', bono: '+ Bono trimestral $70,000 MXN' },
          ].map((e) => (
            <div className={`esc-card ${e.cls}`} key={e.tag}>
              <div className="esc-tag" style={{ background: e.tagBg, color: e.tagColor, border: e.tagBorder }}>{e.icon}{e.tag}</div>
              <div className="esc-nivel">{e.nivel}</div>
              {e.lines.map(([l, v]) => <div className="esc-line" key={l}><span className="esc-line-label">{l}</span><span className="esc-line-val">{v}</span></div>)}
              <div className="esc-total">
                <div className="esc-total-label">Promedio mensual (con bono)</div>
                <div className="esc-total-mes">{e.total}</div>
                <div className="esc-total-sub">MXN / mes</div>
              </div>
              <div className="esc-bono"><Gift size={14} />{e.bono}</div>
            </div>
          ))}
        </div>
      </div>

      <hr className="dist-divider" />

      {/* KNOW HOW */}
      <div className="knowhow-hero" id="knowhow">
        <div className="knowhow-banner">
          <div className="section-label">06 — El know how</div>
          <h2>Cómo se <em>vende</em></h2>
          <p className="section-sub" style={{ marginBottom: 0 }}>El know how no es un manual — es el sistema que hace que la venta sea casi inevitable.</p>
        </div>
        <div className="highlight-card" style={{ margin: '16px 0 32px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Key size={20} style={{ color: 'var(--purple)' }} />
          </div>
          <p><strong>La regla de oro:</strong> No vendes Flow Hub CRM. Muestras tus resultados. Flow Hub aparece como la herramienta que los hizo posibles. El prospecto pide verla — tú no la ofreces nunca primero.</p>
        </div>
        <div className="funnel-steps">
          {[
            { num: '01', title: 'El anzuelo — Muestra resultados, no el producto', desc: 'Publica contenido de tus propios resultados: cierres del mes, crecimiento del equipo, organización de tu negocio. No mencionas Flow Hub. Solo muestras que algo cambió en tu negocio.', key: 'Funciona en: conversaciones 1 a 1, conferencias de tu red, publicaciones y stories en redes sociales, y en eventos presenciales de reclutamiento MLM.' },
            { num: '02', title: 'La curiosidad — El prospecto levanta la mano', desc: 'Alguien pregunta "¿qué estás haciendo diferente?" o lanzas: "Voy a compartir algo que cambió mi negocio con 5 personas este mes." El prospecto viene con intención propia.', key: 'Por qué funciona: El prospecto que levanta la mano ya está a medio cerrar. Solo necesita ver la solución a su propio problema.' },
            { num: '03', title: 'La conversación — Haz visible el dolor', desc: 'No es una venta — es una conversación. Preguntas que revelan el problema: "¿Cuántos prospectos tienes sin seguimiento?" "¿Cuántos perdiste este mes?"', key: 'El resultado: El prospecto se convence solo de que tiene un problema. Tú solo hiciste las preguntas correctas.' },
            { num: '04', title: 'La invitación — Inevitable decir que sí', desc: '"Lo que yo uso para resolver exactamente eso que me describes te lo puedo mostrar en 20 minutos. ¿Cuándo tienes tiempo?" No es una presentación de ventas — es mostrar la solución a su propio dolor.', key: 'A esta altura: El prospecto ya quiere ver la solución. Solo tienes que mostrarla. La resistencia desapareció.' },
            { num: '05', title: 'La demostración — El punto climax', desc: 'Abres tu propio Flow Hub en vivo. Le muestras TU agente respondiendo. TU pipeline organizado. TUS leads en seguimiento automático. La pregunta final: "¿Quieres esto para tu negocio?"', key: 'Por qué es inevitable: No fue una venta. Fue una revelación. El prospecto tomó la decisión solo porque vio la solución a su problema en tiempo real.' },
          ].map((f) => (
            <div className="funnel-step" key={f.num}>
              <div className="funnel-num">{f.num}</div>
              <div>
                <div className="funnel-title">{f.title}</div>
                <p className="funnel-desc">{f.desc}</p>
                <div className="funnel-key">{f.key}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="dist-divider" />

      {/* IMPLEMENTACION */}
      <div className="section">
        <div className="section-label">07 — Implementación</div>
        <h2>Lo que <em>entregas</em></h2>
        <p className="section-sub">La implementación es el producto que vendes junto con el plan mensual.</p>
        <div className="impl-grid">
          <div className="impl-card">
            <div className="impl-price">$1,400</div>
            <div className="impl-price-mxn">USD · ~$25,000 MXN · Cliente Raíz</div>
            <div className="impl-title">Implementación Raíz</div>
            <ul className="impl-list">
              {['4 horas de sesiones en videollamada (kickoff, onboarding técnico y capacitación del equipo)', 'Configuración completa del agente IA con personalidad y material del negocio del cliente', 'Conexión de WhatsApp, Instagram y Facebook al inbox unificado', 'Diseño de pipelines personalizados según el modelo de negocio', 'Configuración de scoring y calificación automática de leads', 'Brand Kit completo — logo, colores y tipografías de la marca', 'El cliente completa tareas guiadas entre sesiones', '30 días de soporte post-implementación por WhatsApp'].map((f) => (
                <li key={f}><CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--green)' }} />{f}</li>
              ))}
            </ul>
          </div>
          <div className="impl-card">
            <div className="impl-price" style={{ color: 'var(--purple)' }}>$550</div>
            <div className="impl-price-mxn">USD · ~$10,000 MXN · Distribuidor de la red</div>
            <div className="impl-title">Implementación Distribuidor</div>
            <ul className="impl-list">
              {['2 horas de sesiones en videollamada (onboarding técnico y capacitación)', 'Copia de la configuración de su raíz — mismos procesos y el mismo lenguaje de ventas', 'Ajustes de marca personal — logo y colores propios del distribuidor', 'Conexión de sus canales de comunicación propios', 'El cliente completa tareas guiadas entre sesiones', '15 días de soporte post-implementación por WhatsApp'].map((f) => (
                <li key={f}><CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--green)' }} />{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <hr className="dist-divider" />

      {/* PORTAL */}
      <div className="section" id="portal">
        <div className="section-label">08 — Tu portal como distribuidor</div>
        <h2>Todo lo que <em>recibes</em></h2>
        <p className="section-sub">Al registrarte como distribuidor oficial tienes acceso a un ecosistema completo.</p>
        <div className="portal-grid">
          {[
            { icon: <BarChart2 size={20} style={{ color: 'var(--blue)' }} />, bg: 'var(--blue-light)', title: 'Tu dashboard personal', desc: 'Ve en tiempo real tus ventas, comisiones acumuladas, nivel actual y cuánto te falta para el siguiente nivel.' },
            { icon: <Target size={20} style={{ color: 'var(--amber)' }} />, bg: 'rgba(255,149,0,0.1)', title: 'Tus metas y progreso', desc: 'Meta semanal, mensual y trimestral siempre visibles. Sabes exactamente qué necesitas para el próximo bono.' },
            { icon: <Banknote size={20} style={{ color: 'var(--green)' }} />, bg: 'var(--green-light)', title: 'Historial de pagos', desc: 'Fechas de corte, montos de cada comisión, estado de cada pago y el resumen para emitir tu factura.' },
            { icon: <Crown size={20} style={{ color: 'var(--amber)' }} />, bg: 'rgba(255,149,0,0.1)', title: 'Tu nivel y trayectoria', desc: 'Asociado, Senior o Elite. Ves cuántas implementaciones acumuladas tienes y cuántas te faltan para subir de nivel.' },
            { icon: <LayoutDashboard size={20} style={{ color: 'var(--blue)' }} />, bg: 'var(--blue-light)', title: 'Tu cuenta Flow Hub incluida', desc: 'Tu propio CRM con el pipeline de clientes Flow Hub activo. Usas la herramienta para vender la herramienta.' },
            { icon: <BookOpen size={20} style={{ color: 'var(--purple)' }} />, bg: 'var(--purple-light)', title: 'Material de capacitación', desc: 'Scripts de venta, guías de demostración, respuestas a objeciones y recursos para presentaciones grupales.' },
          ].map((p, i) => (
            <div className="portal-card" key={i}>
              <div className="portal-icon" style={{ background: p.bg }}>{p.icon}</div>
              <div className="portal-title">{p.title}</div>
              <p className="portal-desc">{p.desc}</p>
            </div>
          ))}
        </div>

        <div className="section-label" style={{ marginTop: 56 }}>Modelo de pago — Transparencia total</div>
        <div className="fiscal-grid">
          <div className="fiscal-card">
            <div className="fiscal-title"><FileText size={20} style={{ color: 'var(--blue)' }} />Cómo funciona el pago</div>
            <ul className="fiscal-list">
              {['Eres un comisionista mercantil independiente — no un empleado', 'Al alcanzar tu corte recibes el resumen exacto de tu comisión', 'Emites una factura CFDI a Flow Hub por el monto de tu comisión', 'Flow Hub realiza la transferencia bancaria a tu CLABE', 'Todo documentado y respaldado fiscalmente sin complicaciones'].map(f => (
                <li key={f}><CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--green)' }} />{f}</li>
              ))}
            </ul>
          </div>
          <div className="fiscal-card">
            <div className="fiscal-title"><ClipboardList size={20} style={{ color: 'var(--green)' }} />Requisitos para activarte</div>
            <ul className="fiscal-list">
              {['Tener una cuenta Flow Hub activa en cualquier plan', 'RFC activo como persona física — actividad empresarial o RESICO', 'CLABE interbancaria para recibir transferencias bancarias', 'Firma del contrato de comisionista mercantil con Flow Hub', 'Constancia de situación fiscal actualizada del SAT'].map(f => (
                <li key={f}><CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--green)' }} />{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <hr className="dist-divider" />

      {/* PITCH */}
      <div className="pitch-section">
        <div className="pitch-box">
          <h2>La mayoría de las herramientas resuelven<br /><em>una parte</em> del problema.<br />Flow Hub resuelve el ciclo completo.</h2>
          <p className="pitch-sub">Atrae prospectos con contenido IA. Los conecta y califica automáticamente. Los convierte con seguimiento inteligente. Y te da la claridad para construir un negocio real — no solo ventas del día.</p>
          <div className="pitch-actions">
            <button className="btn-primary" onClick={() => navigate('/unirse')}>
              <UserCheck size={16} />
              Quiero ser distribuidor
            </button>
            <a href="#sistema" className="btn-ghost">
              <ArrowUp size={16} />
              Leer desde el inicio
            </a>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="dist-footer">
        <div className="footer-logo">
          <img src="/logo.png" alt="Flow Hub CRM" style={{ height: '22px', objectFit: 'contain' }} />
          FlowHub CRM
        </div>
        <div className="footer-note">Documento interno — Programa de Distribuidores · 2026</div>
      </footer>
    </div>
  )
}
