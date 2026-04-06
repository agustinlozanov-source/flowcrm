import { useState, useCallback } from 'react'
import {
  Target, Users, Globe, PenLine, Send, MessageCircle, Instagram,
  MessageSquare, Info, AlertTriangle, Zap, Ear, TrendingUp, TrendingDown,
  Folder, Library, GitBranch, ClipboardList, Check, ArrowLeft, ArrowRight,
  ChevronRight, Plus, X, CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { usePipeline } from '@/hooks/usePipeline'

// ─── CONSTANTS ───────────────────────────────────────────────────
const STEPS = [
  'Fuentes', 'Canales', 'Pipelines', 'Etapas',
  'Agente', 'Score', 'Recursos', 'Plantillas', 'Resumen'
]

const FUENTES = [
  { id: 'redes',     Icon: Users,         label: 'Redes sociales',  desc: 'Orgánico o pauta — Instagram, Facebook, TikTok' },
  { id: 'referidos', Icon: Users,         label: 'Referidos',       desc: 'Clientes actuales recomiendan el negocio' },
  { id: 'web',       Icon: Globe,         label: 'Formulario web',  desc: 'El lead llena un form y entra al pipeline' },
  { id: 'manual',    Icon: PenLine,       label: 'Manual',          desc: 'Un colaborador crea el contacto directamente' },
  { id: 'masiva',    Icon: Send,          label: 'Campaña masiva',  desc: 'Base de datos importada con plantilla HSM — costo adicional' },
]

const CANALES = [
  { id: 'whatsapp',  Icon: MessageCircle, label: 'WhatsApp',     desc: 'Ventana 24h · Plantilla HSM al cerrar' },
  { id: 'instagram', Icon: Instagram,     label: 'Instagram DM', desc: 'Ventana 7 días · Plantilla IG al cerrar' },
  { id: 'messenger', Icon: MessageSquare, label: 'Messenger',    desc: 'Ventana 24h · Message Tags al cerrar' },
]

const PURPOSES = [
  { id: 'adquisicion',  label: 'Adquisición',          desc: 'Convertir prospectos nuevos en clientes' },
  { id: 'retencion',    label: 'Retención / Recompra', desc: 'Mantener y reactivar clientes activos' },
  { id: 'recuperacion', label: 'Recuperación',         desc: 'Rescatar leads que no cerraron' },
  { id: 'referidos',    label: 'Referidos',             desc: 'Activar clientes que pueden referir' },
]

const ENTRY_CONDITIONS = [
  { id: 'manual', label: 'Manual',     desc: 'Un colaborador mueve al lead manualmente' },
  { id: 'score',  label: 'Por score',  desc: 'El lead alcanza un umbral mínimo de puntos' },
  { id: 'tiempo', label: 'Por tiempo', desc: 'Han pasado X días en la etapa anterior' },
  { id: 'evento', label: 'Por evento', desc: 'El lead realizó una acción específica' },
]

const SCORE_UP_PRESETS = [
  'Respondió en menos de 1 hora', 'Preguntó por precio o condiciones',
  'Demostró disposición económica directa', 'Demostró disposición económica indirecta',
  'Solicitó demostración o llamada', 'Compartió el producto con alguien',
  'Volvió a escribir por iniciativa propia', 'Respondió con nota de voz',
]

const SCORE_DOWN_PRESETS = [
  'No respondió en más de 48 horas', 'Dijo "lo pienso" sin compromiso',
  'Pidió que le contacten más adelante', 'Expresó objeción de precio fuerte',
  'Respondió con monosílabos repetidos',
]

const BASE_TEMPLATES = [
  { id: 't1', name: 'Reactivación de ventana',     body: 'Hola {{nombre}}, hace unos días hablamos sobre {{tema}}. ¿Pudiste pensarlo?' },
  { id: 't2', name: 'Recordatorio de seguimiento', body: 'Hola {{nombre}}, solo quería darte seguimiento. ¿Tienes un momento esta semana?' },
  { id: 't3', name: 'Alerta de recompra próxima',  body: 'Hola {{nombre}}, ya se acerca el momento de renovar tu {{producto}}. ¿Te ayudo?' },
  { id: 't4', name: 'Bienvenida post-campaña',     body: 'Hola {{nombre}}, gracias por responder. ¿Tienes un momento para contarte más?' },
  { id: 't5', name: 'Cierre de ventana',           body: 'Hola {{nombre}}, no quiero que se pierda esta info. ¿Tienes 5 minutos esta semana?' },
]

function newStage() {
  return {
    name: '', entry: '', exit: '',
    agent: '', agentFreq: '', agentClosed: '',
    scoreCriteria: { up: [], down: [] },
    threshAdvance: 50, threshBack: 20, threshDrop: 5,
    _open: false,
  }
}

function purposeLabel(id) { return PURPOSES.find(p => p.id === id)?.label || '' }
function entryLabel(id) { return ENTRY_CONDITIONS.find(e => e.id === id)?.label || '—' }

// ─── CSS ──────────────────────────────────────────────────────────
const css = `
  .pb-root { font-family: 'Inter', sans-serif; }
  .pb-root * { box-sizing: border-box; }

  /* PROGRESS */
  .pb-progress {
    display: flex; align-items: center; gap: 0;
    overflow-x: auto; margin-bottom: 28px; padding-bottom: 4px;
  }
  .pb-progress::-webkit-scrollbar { display: none; }
  .pb-p-step { display: flex; align-items: center; gap: 0; cursor: pointer; }
  .pb-p-step.locked { cursor: default; pointer-events: none; }
  .pb-p-node { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 58px; padding: 0 3px; }
  .pb-p-dot {
    width: 26px; height: 26px; border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: var(--gray-5); transition: all 0.2s;
  }
  .pb-p-step.done .pb-p-dot { background: rgba(0,200,83,0.1); border-color: rgba(0,200,83,0.35); color: #00c853; }
  .pb-p-step.active .pb-p-dot { background: rgba(0,102,255,0.1); border-color: rgba(0,102,255,0.35); color: #0066ff; box-shadow: 0 0 0 3px rgba(0,102,255,0.12); }
  .pb-p-lbl { font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.18); letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; }
  .pb-p-step.done .pb-p-lbl { color: #00c853; }
  .pb-p-step.active .pb-p-lbl { color: #0066ff; }
  .pb-p-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); min-width: 12px; margin-bottom: 14px; transition: background 0.3s; }
  .pb-p-line.done { background: #00c853; }

  /* CARD */
  .pb-card {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px; overflow: hidden;
    animation: pbFadeUp 0.28s ease both;
  }
  @keyframes pbFadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

  .pb-card-header { padding: 26px 30px 22px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .pb-eyebrow {
    display: flex; align-items: center; gap: 7px;
    font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    color: #0066ff; margin-bottom: 10px;
  }
  .pb-eyebrow::before { content: ''; width: 14px; height: 1.5px; background: currentColor; }
  .pb-card-title {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; font-weight: 900;
    letter-spacing: -0.5px; line-height: 1.15; margin-bottom: 7px;
  }
  .pb-card-title em {
    font-style: normal;
    background: linear-gradient(135deg, #4d9fff, #7c3aed);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .pb-card-desc { font-size: 13.5px; color: var(--gray-4); line-height: 1.65; max-width: 540px; }
  .pb-card-body { padding: 26px 30px; }

  /* FORM */
  .pb-field { margin-bottom: 18px; }
  .pb-field:last-child { margin-bottom: 0; }
  .pb-label {
    display: block; font-size: 11px; font-weight: 700;
    letter-spacing: 0.07em; text-transform: uppercase; color: var(--gray-4); margin-bottom: 7px;
  }
  .pb-hint { font-size: 10px; font-weight: 500; color: var(--gray-5); text-transform: none; letter-spacing: 0; margin-left: 5px; }
  .pb-input, .pb-select, .pb-textarea {
    width: 100%; padding: 10px 13px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px; color: white; font-family: 'Inter', sans-serif;
    font-size: 14px; outline: none; transition: border-color 0.15s; appearance: none;
  }
  .pb-input:focus, .pb-select:focus, .pb-textarea:focus { border-color: #0066ff; }
  .pb-input::placeholder, .pb-textarea::placeholder { color: var(--gray-5); }
  .pb-select {
    cursor: pointer; background-color: rgba(255,255,255,0.05);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px;
  }
  .pb-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; }

  /* CHIPS */
  .pb-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .pb-chip {
    padding: 8px 14px; border-radius: 10px;
    border: 1.5px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
    color: var(--gray-3); font-size: 13px; font-weight: 500; cursor: pointer;
    transition: all 0.16s; user-select: none; display: flex; align-items: center; gap: 8px;
    font-family: 'Inter', sans-serif;
  }
  .pb-chip:hover { border-color: rgba(255,255,255,0.2); color: white; }
  .pb-chip.selected { background: rgba(0,102,255,0.1); border-color: rgba(0,102,255,0.35); color: white; }

  /* INFO / WARN */
  .pb-info {
    background: rgba(0,102,255,0.08); border: 1px solid rgba(0,102,255,0.25);
    border-radius: 12px; padding: 13px 15px; font-size: 13px;
    color: rgba(255,255,255,0.65); line-height: 1.6; margin-bottom: 20px;
    display: flex; gap: 10px; align-items: flex-start;
  }
  .pb-info svg { color: #0066ff; flex-shrink: 0; margin-top: 1px; }
  .pb-warn {
    background: rgba(255,149,0,0.08); border: 1px solid rgba(255,149,0,0.25);
    border-radius: 12px; padding: 13px 15px; font-size: 13px;
    color: rgba(255,200,100,0.9); line-height: 1.6; margin-bottom: 20px;
    display: flex; gap: 10px; align-items: flex-start;
  }
  .pb-warn svg { color: #ff9500; flex-shrink: 0; margin-top: 1px; }

  /* BLOCKS */
  .pb-block {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 18px 20px; margin-bottom: 12px;
  }
  .pb-block-header { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
  .pb-block-num {
    width: 22px; height: 22px; border-radius: 6px;
    background: rgba(0,102,255,0.1); border: 1px solid rgba(0,102,255,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800; color: #0066ff; flex-shrink: 0;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
  .pb-block-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 700; flex: 1; }

  /* STAGE */
  .pb-stage {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; margin-bottom: 8px; overflow: hidden;
  }
  .pb-stage-header {
    padding: 12px 15px; display: flex; align-items: center; gap: 8px;
    cursor: pointer; transition: background 0.15s;
  }
  .pb-stage-header:hover { background: rgba(255,255,255,0.03); }
  .pb-stage-num {
    width: 20px; height: 20px; border-radius: 6px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700; color: var(--gray-4); flex-shrink: 0;
  }
  .pb-stage-lbl { font-size: 13px; font-weight: 600; flex: 1; }
  .pb-stage-body { padding: 13px 15px 15px; border-top: 1px solid rgba(255,255,255,0.06); }

  /* TOGGLE */
  .pb-toggle-row { display: flex; gap: 8px; margin-bottom: 13px; }
  .pb-toggle {
    flex: 1; padding: 10px 12px; border-radius: 10px;
    border: 1.5px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
    color: var(--gray-3); font-size: 13px; font-weight: 500; cursor: pointer;
    transition: all 0.16s; text-align: center; user-select: none;
    display: flex; align-items: center; justify-content: center; gap: 7px;
    font-family: 'Inter', sans-serif;
  }
  .pb-toggle:hover { border-color: rgba(255,255,255,0.2); color: white; }
  .pb-toggle.active-green { background: rgba(0,200,83,0.1); border-color: rgba(0,200,83,0.35); color: #00c853; }
  .pb-toggle.active-blue  { background: rgba(0,102,255,0.1); border-color: rgba(0,102,255,0.35); color: white; }

  /* SCORE */
  .pb-score-lbl {
    font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase;
    margin-bottom: 9px; display: flex; align-items: center; gap: 6px;
  }
  .pb-score-item {
    display: flex; align-items: center; gap: 7px; padding: 8px 11px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; margin-bottom: 6px;
  }
  .pb-score-tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 6px; flex-shrink: 0; }
  .pb-score-tag.up   { background: rgba(0,200,83,0.1);  color: #00c853; border: 1px solid rgba(0,200,83,0.3); }
  .pb-score-tag.down { background: rgba(255,59,48,0.1);  color: #ff3b30; border: 1px solid rgba(255,59,48,0.3); }
  .pb-score-txt {
    flex: 1; padding: 4px 8px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px; color: white; font-size: 13px; outline: none; font-family: 'Inter', sans-serif;
  }
  .pb-score-txt:focus { border-color: #0066ff; }
  .pb-pts-input {
    width: 50px; padding: 4px 6px; text-align: center;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px; color: white; font-size: 13px; font-weight: 600; outline: none;
  }
  .pb-pts-input:focus { border-color: #0066ff; }
  .pb-preset-wrap { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; margin-bottom: 13px; }
  .pb-preset {
    padding: 3px 9px; border-radius: 7px; font-size: 11px; cursor: pointer;
    border: 1px dashed rgba(255,255,255,0.12); color: var(--gray-4);
    transition: all 0.15s; background: none; font-family: 'Inter', sans-serif;
  }
  .pb-preset.up:hover   { border-color: rgba(0,200,83,0.4);  color: #00c853; }
  .pb-preset.down:hover { border-color: rgba(255,59,48,0.4);  color: #ff3b30; }

  /* THRESHOLDS */
  .pb-thresh-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 14px; }
  .pb-thresh-card {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 13px; text-align: center;
  }
  .pb-thresh-lbl { font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--gray-4); margin-bottom: 9px; }
  .pb-thresh-input {
    width: 64px; padding: 5px 8px; text-align: center;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; color: white; font-size: 20px; font-weight: 800;
    font-family: 'Plus Jakarta Sans', sans-serif; outline: none; transition: border-color 0.15s;
  }
  .pb-thresh-input:focus { border-color: #0066ff; }
  .pb-thresh-sub { font-size: 10px; color: var(--gray-5); margin-top: 6px; line-height: 1.4; }

  /* RESOURCE */
  .pb-res-item {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; padding: 12px; margin-bottom: 8px;
  }
  .pb-res-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .pb-res-row:last-child { margin-bottom: 0; }

  /* TEMPLATE */
  .pb-tpl-item {
    background: rgba(255,255,255,0.03); border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; transition: border-color 0.15s;
  }
  .pb-tpl-item:hover { border-color: rgba(255,255,255,0.14); }
  .pb-tpl-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .pb-tpl-preview { font-size: 12px; color: var(--gray-4); line-height: 1.5; }

  /* SUMMARY */
  .pb-sum-pipe {
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; margin-bottom: 12px; overflow: hidden;
  }
  .pb-sum-pipe-header {
    padding: 13px 17px; display: flex; align-items: center; gap: 9px;
    background: linear-gradient(90deg, rgba(0,102,255,0.08), transparent);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .pb-sum-pipe-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 800; flex: 1; }
  .pb-sum-purpose {
    font-size: 10px; font-weight: 700; color: #0066ff; padding: 2px 8px; border-radius: 6px;
    background: rgba(0,102,255,0.1); border: 1px solid rgba(0,102,255,0.3);
  }
  .pb-sum-stages { padding: 12px 17px; display: flex; flex-direction: column; gap: 7px; }
  .pb-sum-stage { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gray-3); }
  .pb-sum-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.15); flex-shrink: 0; }

  .pb-task-title {
    font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase;
    color: var(--gray-4); margin-bottom: 11px; margin-top: 22px;
    display: flex; align-items: center; gap: 7px;
  }
  .pb-task-title svg { color: #ff9500; }
  .pb-task-item {
    display: flex; align-items: flex-start; gap: 10px; padding: 10px 13px;
    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; margin-bottom: 6px;
  }
  .pb-task-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #ff9500; flex-shrink: 0;
    margin-top: 5px; box-shadow: 0 0 8px rgba(255,149,0,0.5);
  }
  .pb-task-text { font-size: 13px; color: var(--gray-3); line-height: 1.5; }
  .pb-task-text strong { color: white; display: block; font-size: 12.5px; margin-bottom: 2px; }

  /* NAV */
  .pb-nav-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 18px 30px; border-top: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.01);
  }
  .pb-btn {
    padding: 9px 20px; border-radius: 10px; font-family: 'Inter', sans-serif;
    font-size: 13.5px; font-weight: 600; cursor: pointer; transition: all 0.16s; border: none;
    display: inline-flex; align-items: center; gap: 7px;
  }
  .pb-btn-ghost { background: transparent; color: var(--gray-3); border: 1px solid rgba(255,255,255,0.12); }
  .pb-btn-ghost:hover { background: rgba(255,255,255,0.05); color: white; }
  .pb-btn-primary { background: white; color: #070708; }
  .pb-btn-primary:hover { background: #e8e8ed; transform: translateY(-1px); }
  .pb-btn-success { background: #00c853; color: #071a0e; font-weight: 800; box-shadow: 0 4px 16px rgba(0,200,83,0.25); }
  .pb-btn-success:hover { background: #00e060; transform: translateY(-1px); }
  .pb-btn-add {
    width: 100%; padding: 9px; border-radius: 10px; border: 1.5px dashed rgba(255,255,255,0.12);
    background: none; color: var(--gray-4); font-size: 13px; font-weight: 500; cursor: pointer;
    transition: all 0.16s; font-family: 'Inter', sans-serif; margin-top: 8px;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .pb-btn-add:hover { border-color: #0066ff; color: #0066ff; }
  .pb-rm-btn {
    margin-left: auto; background: none; border: none; color: var(--gray-5); cursor: pointer;
    padding: 3px; border-radius: 6px; transition: all 0.15s; display: flex; flex-shrink: 0;
  }
  .pb-rm-btn:hover { background: rgba(255,59,48,0.1); color: #ff3b30; }
  .pb-step-counter { font-size: 11px; font-weight: 600; color: var(--gray-5); }
  .pb-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 16px 0; }
  .pb-section-header { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
  .pb-section-bar { width: 4px; height: 20px; background: #0066ff; border-radius: 2px; }
  .pb-section-name { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 800; }
  .pb-section-tag {
    font-size: 10px; font-weight: 700; color: #0066ff; padding: 2px 8px; border-radius: 6px;
    background: rgba(0,102,255,0.1); border: 1px solid rgba(0,102,255,0.25);
  }
  .pb-mb { margin-bottom: 24px; }
  .pb-mb-sm { margin-bottom: 10px; }
  .pb-stage-meta { font-size: 11.5px; color: var(--gray-5); display: flex; align-items: center; gap: 8px; }
`

// ─── MINI COMPONENTS ──────────────────────────────────────────────
function SectionHeader({ name, purpose }) {
  return (
    <div className="pb-section-header">
      <div className="pb-section-bar" />
      <div className="pb-section-name">{name}</div>
      {purpose && <div className="pb-section-tag">{purposeLabel(purpose)}</div>}
    </div>
  )
}

function StageMetaTag({ label }) {
  return <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>{label}</span>
}

// ─── STEP COMPONENTS ─────────────────────────────────────────────

// Step 0 — Fuentes
function StepFuentes({ data, onChange, onNext, onPrev }) {
  const [selected, setSelected] = useState(data.fuentes || [])
  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  return (
    <>
      <div className="pb-card-header">
        <div className="pb-eyebrow">Paso 1 de 9</div>
        <div className="pb-card-title">Fuentes de <em>entrada</em></div>
        <div className="pb-card-desc">¿Por qué canales van a llegar los leads a este pipeline? Selecciona todas las que apliquen.</div>
      </div>
      <div className="pb-card-body">
        {selected.includes('masiva') && (
          <div className="pb-warn"><AlertTriangle size={15} /><span><strong>Campaña masiva</strong> es un servicio adicional con costo. Implica envío de plantillas HSM a base de datos importada. WhatsApp cobra por mensaje enviado.</span></div>
        )}
        <div className="pb-chips">
          {FUENTES.map(f => (
            <div key={f.id} className={clsx('pb-chip', selected.includes(f.id) && 'selected')} onClick={() => toggle(f.id)}>
              <f.Icon size={15} />
              <span>{f.label}</span>
              {selected.includes(f.id) && <Check size={11} style={{ color: '#0066ff' }} />}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {FUENTES.map(f => (
            <div key={f.id} style={{ display: 'flex', gap: 9, fontSize: 12.5, color: 'var(--gray-4)', alignItems: 'flex-start' }}>
              <f.Icon size={13} style={{ flexShrink: 0, marginTop: 2, color: 'var(--gray-5)' }} />
              <span><strong style={{ color: 'var(--gray-3)' }}>{f.label}:</strong> {f.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="pb-nav-row">
        <div />
        <span className="pb-step-counter">Paso 1 de 9</span>
        <button className="pb-btn pb-btn-primary" onClick={() => {
          if (!selected.length) return toast.error('Selecciona al menos una fuente.')
          onChange({ fuentes: selected }); onNext()
        }}>Continuar <ArrowRight size={15} /></button>
      </div>
    </>
  )
}

// Step 1 — Canales
function StepCanales({ data, onChange, onNext, onPrev }) {
  const [selected, setSelected] = useState(data.canales || [])
  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  return (
    <>
      <div className="pb-card-header">
        <div className="pb-eyebrow">Paso 2 de 9</div>
        <div className="pb-card-title">Canales <em>activos</em></div>
        <div className="pb-card-desc">Cada canal tiene su propia política de ventana. Esto define qué puede hacer el agente cuando la conversación se cierra.</div>
      </div>
      <div className="pb-card-body">
        <div className="pb-info"><Info size={15} /><span>El canal activo es <strong>donde ocurre la conversación ahora</strong>, no necesariamente donde entró el lead. Las políticas aplican sobre el canal activo en tiempo real.</span></div>
        <div className="pb-chips">
          {CANALES.map(c => (
            <div key={c.id} className={clsx('pb-chip', selected.includes(c.id) && 'selected')} onClick={() => toggle(c.id)}>
              <c.Icon size={15} />
              <span>{c.label}</span>
              {selected.includes(c.id) && <Check size={11} style={{ color: '#0066ff' }} />}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CANALES.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, padding: '11px 13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, alignItems: 'center' }}>
              <c.Icon size={17} style={{ color: '#0066ff', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{c.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--gray-4)' }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="pb-nav-row">
        <button className="pb-btn pb-btn-ghost" onClick={onPrev}><ArrowLeft size={15} /> Atrás</button>
        <span className="pb-step-counter">Paso 2 de 9</span>
        <button className="pb-btn pb-btn-primary" onClick={() => {
          if (!selected.length) return toast.error('Selecciona al menos un canal.')
          onChange({ canales: selected }); onNext()
        }}>Continuar <ArrowRight size={15} /></button>
      </div>
    </>
  )
}

// Step 2 — Pipelines
function StepPipelines({ data, onChange, onNext, onPrev }) {
  const [pipelines, setPipelines] = useState(
    data.pipelines?.length ? data.pipelines : [{ name: '', purpose: '', stages: [] }]
  )
  const update = (i, field, val) => setPipelines(ps => ps.map((p, idx) => idx === i ? { ...p, [field]: val } : p))
  const add = () => setPipelines(ps => [...ps, { name: '', purpose: '', stages: [] }])
  const remove = i => setPipelines(ps => ps.filter((_, idx) => idx !== i))

  return (
    <>
      <div className="pb-card-header">
        <div className="pb-eyebrow">Paso 3 de 9</div>
        <div className="pb-card-title">Definición de <em>pipelines</em></div>
        <div className="pb-card-desc">¿Cuántos pipelines necesita este cliente? Cada uno tiene un propósito y flujo independiente.</div>
      </div>
      <div className="pb-card-body">
        {pipelines.map((p, i) => (
          <div key={i} className="pb-block">
            <div className="pb-block-header">
              <div className="pb-block-num">{i + 1}</div>
              <div className="pb-block-title">Pipeline {i + 1}</div>
              {pipelines.length > 1 && <button className="pb-rm-btn" onClick={() => remove(i)}><X size={14} /></button>}
            </div>
            <div className="pb-two-col">
              <div className="pb-field" style={{ marginBottom: 0 }}>
                <label className="pb-label">Nombre</label>
                <input className="pb-input" value={p.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Ej: Nuevos clientes" />
              </div>
              <div className="pb-field" style={{ marginBottom: 0 }}>
                <label className="pb-label">Propósito</label>
                <select className="pb-select" value={p.purpose} onChange={e => update(i, 'purpose', e.target.value)}>
                  <option value="">Selecciona...</option>
                  {PURPOSES.map(pu => <option key={pu.id} value={pu.id}>{pu.label} — {pu.desc}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
        <button className="pb-btn-add" onClick={add}><Plus size={14} /> Agregar pipeline</button>
      </div>
      <div className="pb-nav-row">
        <button className="pb-btn pb-btn-ghost" onClick={onPrev}><ArrowLeft size={15} /> Atrás</button>
        <span className="pb-step-counter">Paso 3 de 9</span>
        <button className="pb-btn pb-btn-primary" onClick={() => {
          if (!pipelines.every(p => p.name.trim() && p.purpose)) return toast.error('Completa nombre y propósito de cada pipeline.')
          const ps = pipelines.map(p => ({ ...p, stages: p.stages?.length ? p.stages : [newStage()] }))
          onChange({ pipelines: ps }); onNext()
        }}>Continuar <ArrowRight size={15} /></button>
      </div>
    </>
  )
}

// Step 3 — Etapas
function StepEtapas({ data, onChange, onNext, onPrev }) {
  const [pipelines, setPipelines] = useState(data.pipelines)
  const updateStage = (pi, si, field, val) => setPipelines(ps => ps.map((p, i) => i !== pi ? p : {
    ...p, stages: p.stages.map((s, j) => j !== si ? s : { ...s, [field]: val })
  }))
  const toggleOpen = (pi, si) => setPipelines(ps => ps.map((p, i) => i !== pi ? p : {
    ...p, stages: p.stages.map((s, j) => j !== si ? s : { ...s, _open: !s._open })
  }))
  const addStage = pi => setPipelines(ps => ps.map((p, i) => i !== pi ? p : { ...p, stages: [...p.stages, newStage()] }))
  const removeStage = (pi, si) => setPipelines(ps => ps.map((p, i) => i !== pi ? p : { ...p, stages: p.stages.filter((_, j) => j !== si) }))

  return (
    <>
      <div className="pb-card-header">
        <div className="pb-eyebrow">Paso 4 de 9</div>
        <div className="pb-card-title">Etapas del <em>pipeline</em></div>
        <div className="pb-card-desc">Define las etapas de cada pipeline y sus condiciones de entrada y salida.</div>
      </div>
      <div className="pb-card-body">
        {pipelines.map((p, pi) => (
          <div key={pi} className="pb-mb">
            <SectionHeader name={p.name || `Pipeline ${pi + 1}`} purpose={p.purpose} />
            {p.stages.map((s, si) => (
              <div key={si} className="pb-stage">
                <div className="pb-stage-header" onClick={() => toggleOpen(pi, si)}>
                  <div className="pb-stage-num">{si + 1}</div>
                  <div className="pb-stage-lbl">{s.name || `Etapa ${si + 1}`}</div>
                  <div className="pb-stage-meta">
                    {s.entry && <StageMetaTag label={`→ ${entryLabel(s.entry)}`} />}
                  </div>
                  {p.stages.length > 1 && (
                    <button className="pb-rm-btn" onClick={e => { e.stopPropagation(); removeStage(pi, si) }}><X size={13} /></button>
                  )}
                  <ChevronRight size={12} style={{ color: 'var(--gray-5)', transform: s._open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                </div>
                {s._open && (
                  <div className="pb-stage-body">
                    <div className="pb-field">
                      <label className="pb-label">Nombre de la etapa</label>
                      <input className="pb-input" value={s.name} onChange={e => updateStage(pi, si, 'name', e.target.value)} placeholder="Ej: Primer contacto, Calificación, Cierre..." />
                    </div>
                    <div className="pb-two-col">
                      <div className="pb-field" style={{ marginBottom: 0 }}>
                        <label className="pb-label">Condición de entrada <span className="pb-hint">¿cómo llega?</span></label>
                        <select className="pb-select" value={s.entry} onChange={e => updateStage(pi, si, 'entry', e.target.value)}>
                          <option value="">Selecciona...</option>
                          {ENTRY_CONDITIONS.map(e => <option key={e.id} value={e.id}>{e.label} — {e.desc}</option>)}
                        </select>
                      </div>
                      <div className="pb-field" style={{ marginBottom: 0 }}>
                        <label className="pb-label">Condición de salida <span className="pb-hint">¿cómo avanza?</span></label>
                        <select className="pb-select" value={s.exit} onChange={e => updateStage(pi, si, 'exit', e.target.value)}>
                          <option value="">Selecciona...</option>
                          {ENTRY_CONDITIONS.map(e => <option key={e.id} value={e.id}>{e.label} — {e.desc}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button className="pb-btn-add" onClick={() => addStage(pi)}><Plus size={14} /> Agregar etapa</button>
          </div>
        ))}
      </div>
      <div className="pb-nav-row">
        <button className="pb-btn pb-btn-ghost" onClick={onPrev}><ArrowLeft size={15} /> Atrás</button>
        <span className="pb-step-counter">Paso 4 de 9</span>
        <button className="pb-btn pb-btn-primary" onClick={() => {
          if (!pipelines.every(p => p.stages.every(s => s.name.trim()))) return toast.error('Ponle nombre a todas las etapas.')
          onChange({ pipelines }); onNext()
        }}>Continuar <ArrowRight size={15} /></button>
      </div>
    </>
  )
}

// Step 4 — Agente
function StepAgente({ data, onChange, onNext, onPrev }) {
  const [pipelines, setPipelines] = useState(data.pipelines)
  const updateStage = (pi, si, field, val) => setPipelines(ps => ps.map((p, i) => i !== pi ? p : {
    ...p, stages: p.stages.map((s, j) => j !== si ? s : { ...s, [field]: val })
  }))
  return (
    <>
      <div className="pb-card-header">
        <div className="pb-eyebrow">Paso 5 de 9</div>
        <div className="pb-card-title">Comportamiento del <em>agente</em></div>
        <div className="pb-card-desc">En cada etapa el agente puede ser activo (inicia la acción) o reactivo (espera al lead).</div>
      </div>
      <div className="pb-card-body">
        <div className="pb-info"><Info size={15} /><span><strong>Activo:</strong> actúa aunque el lead no haya escrito — necesita ventana abierta o plantilla HSM.<br /><strong>Reactivo:</strong> espera que el lead escriba — si la ventana está cerrada, alerta a un humano o espera.</span></div>
        {pipelines.map((p, pi) => (
          <div key={pi} className="pb-mb">
            <SectionHeader name={p.name} purpose={p.purpose} />
            {p.stages.map((s, si) => (
              <div key={si} className="pb-block pb-mb-sm">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: 12 }}>Etapa {si + 1} — {s.name}</div>
                <div className="pb-toggle-row">
                  <div className={clsx('pb-toggle', s.agent === 'activo' && 'active-green')} onClick={() => updateStage(pi, si, 'agent', 'activo')}>
                    <Zap size={14} /> Activo
                  </div>
                  <div className={clsx('pb-toggle', s.agent === 'reactivo' && 'active-blue')} onClick={() => updateStage(pi, si, 'agent', 'reactivo')}>
                    <Ear size={14} /> Reactivo
                  </div>
                </div>
                {s.agent === 'activo' && (
                  <div className="pb-field" style={{ marginBottom: 10 }}>
                    <label className="pb-label">Frecuencia de acción</label>
                    <select className="pb-select" value={s.agentFreq} onChange={e => updateStage(pi, si, 'agentFreq', e.target.value)}>
                      <option value="">Selecciona...</option>
                      <option value="inmediato">Inmediatamente al entrar a la etapa</option>
                      <option value="diario">Cada día</option>
                      <option value="2dias">Cada 2 días</option>
                      <option value="3dias">Cada 3 días</option>
                      <option value="semanal">Semanal</option>
                      <option value="trigger">Por evento específico</option>
                    </select>
                  </div>
                )}
                {(s.agent === 'activo' || s.agent === 'reactivo') && (
                  <div className="pb-field" style={{ marginBottom: 0 }}>
                    <label className="pb-label">Política — ventana cerrada</label>
                    <select className="pb-select" value={s.agentClosed} onChange={e => updateStage(pi, si, 'agentClosed', e.target.value)}>
                      <option value="">Selecciona...</option>
                      {s.agent === 'activo' && <option value="plantilla">Enviar plantilla HSM aprobada</option>}
                      <option value="esperar">Esperar — no hacer nada</option>
                      <option value="humano">Alertar a un humano</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="pb-nav-row">
        <button className="pb-btn pb-btn-ghost" onClick={onPrev}><ArrowLeft size={15} /> Atrás</button>
        <span className="pb-step-counter">Paso 5 de 9</span>
        <button className="pb-btn pb-btn-primary" onClick={() => {
          if (!pipelines.every(p => p.stages.every(s => s.agent))) return toast.error('Define el modo del agente en cada etapa.')
          onChange({ pipelines }); onNext()
        }}>Continuar <ArrowRight size={15} /></button>
      </div>
    </>
  )
}

// Step 5 — Score
function StepScore({ data, onChange, onNext, onPrev }) {
  const [pipelines, setPipelines] = useState(data.pipelines)

  const updateCriteria = (pi, si, type, newList) => setPipelines(ps => ps.map((p, i) => i !== pi ? p : {
    ...p, stages: p.stages.map((s, j) => j !== si ? s : { ...s, scoreCriteria: { ...s.scoreCriteria, [type]: newList } })
  }))
  const updateThresh = (pi, si, field, val) => setPipelines(ps => ps.map((p, i) => i !== pi ? p : {
    ...p, stages: p.stages.map((s, j) => j !== si ? s : { ...s, [field]: val })
  }))

  function CriteriaSection({ pi, si, type, stage }) {
    const list = stage.scoreCriteria?.[type] || []
    const presets = type === 'up' ? SCORE_UP_PRESETS : SCORE_DOWN_PRESETS
    const available = presets.filter(pr => !list.some(c => c.text === pr))

    const addItem = (text = '') => {
      const newList = [...list, { text, pts: 10 }]
      updateCriteria(pi, si, type, newList)
    }
    const updateItem = (ci, field, val) => {
      const newList = list.map((c, idx) => idx === ci ? { ...c, [field]: val } : c)
      updateCriteria(pi, si, type, newList)
    }
    const removeItem = ci => updateCriteria(pi, si, type, list.filter((_, idx) => idx !== ci))

    return (
      <div style={{ marginBottom: 16 }}>
        <div className="pb-score-lbl" style={{ color: type === 'up' ? '#00c853' : '#ff3b30' }}>
          {type === 'up' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {type === 'up' ? 'Comportamientos que suman' : 'Comportamientos que restan'}
        </div>
        {list.map((c, ci) => (
          <div key={ci} className="pb-score-item">
            <span className={`pb-score-tag ${type}`}>{type === 'up' ? '+' : '−'}</span>
            <input className="pb-score-txt" value={c.text} onChange={e => updateItem(ci, 'text', e.target.value)} placeholder="Describe el comportamiento..." />
            <input className="pb-pts-input" type="number" min={1} max={100} value={c.pts} onChange={e => updateItem(ci, 'pts', +e.target.value)} />
            <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>pts</span>
            <button className="pb-rm-btn" onClick={() => removeItem(ci)}><X size={13} /></button>
          </div>
        ))}
        <button className="pb-btn-add" style={{ marginTop: 6 }} onClick={() => addItem()}>
          <Plus size={13} /> Criterio {type === 'up' ? 'positivo' : 'negativo'}
        </button>
        {available.length > 0 && (
          <div className="pb-preset-wrap">
            {available.map(pr => (
              <button key={pr} className={`pb-preset ${type}`} onClick={() => addItem(pr)}>{pr}</button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="pb-card-header">
        <div className="pb-eyebrow">Paso 6 de 9</div>
        <div className="pb-card-title">Sistema de <em>score</em></div>
        <div className="pb-card-desc">Define qué comportamientos suman o restan puntos, y los umbrales que mueven al lead dentro del pipeline.</div>
      </div>
      <div className="pb-card-body">
        {pipelines.map((p, pi) => (
          <div key={pi} className="pb-mb">
            <SectionHeader name={p.name} purpose={p.purpose} />
            {p.stages.map((s, si) => (
              <div key={si} className="pb-block pb-mb-sm">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: 14 }}>Etapa {si + 1} — {s.name}</div>
                <CriteriaSection pi={pi} si={si} type="up" stage={s} />
                <CriteriaSection pi={pi} si={si} type="down" stage={s} />
                <div className="pb-divider" />
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: 12 }}>Umbrales de movimiento</div>
                <div className="pb-thresh-grid">
                  {[
                    { field: 'threshAdvance', label: 'Avanzar', color: '#00c853', sub: 'Puntos para pasar a la siguiente etapa' },
                    { field: 'threshBack',    label: 'Retroceder', color: 'var(--gray-4)', sub: 'Puntos para regresar a etapa anterior' },
                    { field: 'threshDrop',    label: 'Abandonar', color: '#ff3b30', sub: 'Puntos para pipeline de recuperación' },
                  ].map(({ field, label, color, sub }) => (
                    <div key={field} className="pb-thresh-card">
                      <div className="pb-thresh-lbl" style={{ color }}>{label}</div>
                      <input className="pb-thresh-input" type="number" min={0} max={999} value={s[field] ?? (field === 'threshAdvance' ? 50 : field === 'threshBack' ? 20 : 5)} onChange={e => updateThresh(pi, si, field, +e.target.value)} />
                      <div className="pb-thresh-sub">{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="pb-nav-row">
        <button className="pb-btn pb-btn-ghost" onClick={onPrev}><ArrowLeft size={15} /> Atrás</button>
        <span className="pb-step-counter">Paso 6 de 9</span>
        <button className="pb-btn pb-btn-primary" onClick={() => { onChange({ pipelines }); onNext() }}>Continuar <ArrowRight size={15} /></button>
      </div>
    </>
  )
}

// Step 6 — Recursos
function StepRecursos({ data, onChange, onNext, onPrev }) {
  const [resources, setResources] = useState(data.resources || {})
  const key = (pi, si) => `${pi}_${si}`
  const getList = (pi, si) => resources[key(pi, si)] || []
  const setList = (pi, si, list) => setResources(r => ({ ...r, [key(pi, si)]: list }))
  const addItem = (pi, si) => setList(pi, si, [...getList(pi, si), { type: '', name: '', moment: '', reason: '' }])
  const updateItem = (pi, si, ri, field, val) => setList(pi, si, getList(pi, si).map((r, i) => i === ri ? { ...r, [field]: val } : r))
  const removeItem = (pi, si, ri) => setList(pi, si, getList(pi, si).filter((_, i) => i !== ri))

  return (
    <>
      <div className="pb-card-header">
        <div className="pb-eyebrow">Paso 7 de 9</div>
        <div className="pb-card-title">Recursos y <em>contenido</em></div>
        <div className="pb-card-desc">¿El agente comparte archivos o links en alguna etapa? Cada recurso genera una tarea pendiente para el cliente.</div>
      </div>
      <div className="pb-card-body">
        <div className="pb-info"><Folder size={15} /><span>Cada recurso genera una <strong>tarea para el cliente</strong>: organizar el archivo con el nombre correcto en Google Drive y compartir acceso al equipo.</span></div>
        {data.pipelines.map((p, pi) => (
          <div key={pi} className="pb-mb">
            <SectionHeader name={p.name} purpose={p.purpose} />
            {p.stages.map((s, si) => (
              <div key={si} className="pb-block pb-mb-sm">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: 12 }}>Etapa {si + 1} — {s.name}</div>
                {getList(pi, si).map((r, ri) => (
                  <div key={ri} className="pb-res-item">
                    <div className="pb-res-row">
                      <select className="pb-select" style={{ flex: 1 }} value={r.type} onChange={e => updateItem(pi, si, ri, 'type', e.target.value)}>
                        <option value="">Tipo de recurso...</option>
                        <option value="video">Video</option>
                        <option value="imagen">Imagen</option>
                        <option value="documento">Documento</option>
                        <option value="enlace">Enlace / Link</option>
                      </select>
                      <input className="pb-input" style={{ flex: 2 }} value={r.name} onChange={e => updateItem(pi, si, ri, 'name', e.target.value)} placeholder="Nombre del archivo (ej: Video_Bienvenida)" />
                      <button className="pb-rm-btn" onClick={() => removeItem(pi, si, ri)}><X size={13} /></button>
                    </div>
                    <div className="pb-res-row" style={{ marginBottom: 0 }}>
                      <input className="pb-input" style={{ flex: 1 }} value={r.moment} onChange={e => updateItem(pi, si, ri, 'moment', e.target.value)} placeholder="¿Cuándo se usa?" />
                      <input className="pb-input" style={{ flex: 1 }} value={r.reason} onChange={e => updateItem(pi, si, ri, 'reason', e.target.value)} placeholder="¿Con qué intención?" />
                    </div>
                  </div>
                ))}
                <button className="pb-btn-add" onClick={() => addItem(pi, si)}><Plus size={13} /> Agregar recurso</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="pb-nav-row">
        <button className="pb-btn pb-btn-ghost" onClick={onPrev}><ArrowLeft size={15} /> Atrás</button>
        <span className="pb-step-counter">Paso 7 de 9</span>
        <button className="pb-btn pb-btn-primary" onClick={() => { onChange({ resources }); onNext() }}>Continuar <ArrowRight size={15} /></button>
      </div>
    </>
  )
}

// Step 7 — Plantillas
function StepPlantillas({ data, onChange, onNext, onPrev }) {
  const [templates, setTemplates] = useState(data.templates || {})
  const key = (pi, si) => `${pi}_${si}`
  const update = (pi, si, field, val) => setTemplates(t => ({ ...t, [key(pi, si)]: { ...(t[key(pi, si)] || { templateId: '', status: 'pendiente' }), [field]: val } }))

  const stagesNeedingTemplate = []
  data.pipelines.forEach((p, pi) => {
    p.stages.forEach((s, si) => { if (s.agentClosed === 'plantilla') stagesNeedingTemplate.push({ p, pi, s, si }) })
  })

  return (
    <>
      <div className="pb-card-header">
        <div className="pb-eyebrow">Paso 8 de 9</div>
        <div className="pb-card-title">Plantillas de <em>WhatsApp</em></div>
        <div className="pb-card-desc">Cuando la ventana se cierra, el agente solo puede usar plantillas pre-aprobadas por Meta. Planifica cuáles tramitar.</div>
      </div>
      <div className="pb-card-body">
        <div className="pb-warn"><AlertTriangle size={15} /><span>Las plantillas deben ser aprobadas por Meta antes de activarse. Esta configuración sirve para planear qué tramitar. El estado se actualiza una vez que Meta responde.</span></div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Library size={13} /> Biblioteca base — Plantillas genéricas reutilizables
          </div>
          {BASE_TEMPLATES.map(t => (
            <div key={t.id} className="pb-tpl-item">
              <div className="pb-tpl-name">{t.name}</div>
              <div className="pb-tpl-preview">{t.body}</div>
            </div>
          ))}
        </div>
        {stagesNeedingTemplate.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, fontSize: 13, color: 'var(--gray-4)' }}>
            Ninguna etapa requiere plantilla HSM en este momento.
          </div>
        ) : stagesNeedingTemplate.map(({ p, pi, s, si }) => {
          const k = key(pi, si)
          const tpl = templates[k] || { templateId: '', status: 'pendiente' }
          return (
            <div key={k} className="pb-block pb-mb-sm">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: 12 }}>{p.name} → Etapa {si + 1} — {s.name}</div>
              <div className="pb-field" style={{ marginBottom: 10 }}>
                <label className="pb-label">Plantilla asignada</label>
                <select className="pb-select" value={tpl.templateId} onChange={e => update(pi, si, 'templateId', e.target.value)}>
                  <option value="">Selecciona una plantilla base...</option>
                  {BASE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  <option value="custom">+ Plantilla personalizada (se crea después)</option>
                </select>
              </div>
              <div className="pb-field" style={{ marginBottom: 0 }}>
                <label className="pb-label">Estado de aprobación</label>
                <select className="pb-select" value={tpl.status} onChange={e => update(pi, si, 'status', e.target.value)}>
                  <option value="pendiente">⏳ Pendiente de redacción</option>
                  <option value="tramite">📤 En trámite con Meta</option>
                  <option value="aprobada">✅ Aprobada</option>
                  <option value="rechazada">❌ Rechazada — requiere ajuste</option>
                </select>
              </div>
            </div>
          )
        })}
      </div>
      <div className="pb-nav-row">
        <button className="pb-btn pb-btn-ghost" onClick={onPrev}><ArrowLeft size={15} /> Atrás</button>
        <span className="pb-step-counter">Paso 8 de 9</span>
        <button className="pb-btn pb-btn-primary" onClick={() => { onChange({ templates }); onNext() }}>Continuar <ArrowRight size={15} /></button>
      </div>
    </>
  )
}

// Step 8 — Resumen
function StepResumen({ data, onPrev, onSave, saving }) {
  const tasks = []
  Object.entries(data.resources || {}).forEach(([k, res]) => {
    res.forEach(r => {
      if (!r.name) return
      const [pi, si] = k.split('_')
      const stage = data.pipelines[+pi]?.stages[+si]?.name
      const pipe = data.pipelines[+pi]?.name
      tasks.push({ title: `Preparar ${r.type || 'recurso'}: "${r.name}"`, desc: `Pipeline "${pipe}" → Etapa "${stage}" — ${r.reason || 'según lo configurado'}` })
    })
  })
  data.pipelines.forEach(p => {
    p.stages.forEach(s => {
      if (s.agentClosed === 'plantilla') tasks.push({ title: `Tramitar plantilla HSM: Etapa "${s.name}"`, desc: `Pipeline "${p.name}" — Requiere aprobación de Meta antes de activar el agente` })
    })
  })
  if (data.fuentes?.includes('masiva')) tasks.push({ title: 'Preparar base de datos para campaña masiva', desc: 'Exportar en CSV: Nombre, Teléfono (con código de país), Canal preferido, Frecuencia de compra, Fecha de última compra' })

  return (
    <>
      <div className="pb-card-header">
        <div className="pb-eyebrow">Paso 9 de 9</div>
        <div className="pb-card-title">Resumen y <em>tareas del cliente</em></div>
        <div className="pb-card-desc">Configuración completa. El cliente debe salir de esta sesión con sus tareas claras y definidas.</div>
      </div>
      <div className="pb-card-body">
        {data.pipelines.map((p, pi) => (
          <div key={pi} className="pb-sum-pipe">
            <div className="pb-sum-pipe-header">
              <GitBranch size={15} style={{ color: '#0066ff', flexShrink: 0 }} />
              <div className="pb-sum-pipe-name">{p.name}</div>
              <div className="pb-sum-purpose">{purposeLabel(p.purpose)}</div>
            </div>
            <div className="pb-sum-stages">
              {p.stages.map((s, si) => (
                <div key={si} className="pb-sum-stage">
                  <div className="pb-sum-dot" />
                  <div>
                    <strong style={{ color: 'white' }}>{si + 1}. {s.name}</strong>
                    <span style={{ color: 'var(--gray-5)', fontSize: 12, marginLeft: 8 }}>{s.agent === 'activo' ? '⚡ Activo' : '👂 Reactivo'}</span>
                    <span style={{ color: 'var(--gray-5)', fontSize: 12, marginLeft: 8 }}>Avance: {s.threshAdvance ?? 50} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {tasks.length > 0 && (
          <>
            <div className="pb-task-title"><ClipboardList size={13} /> Tareas pendientes para el cliente</div>
            {tasks.map((t, i) => (
              <div key={i} className="pb-task-item">
                <div className="pb-task-dot" />
                <div className="pb-task-text"><strong>{t.title}</strong>{t.desc}</div>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="pb-nav-row">
        <button className="pb-btn pb-btn-ghost" onClick={onPrev}><ArrowLeft size={15} /> Atrás</button>
        <span className="pb-step-counter">Paso 9 de 9</span>
        <button className="pb-btn pb-btn-success" onClick={onSave} disabled={saving}>
          {saving ? 'Guardando...' : <><CheckCircle2 size={15} /> Guardar configuración</>}
        </button>
      </div>
    </>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────
export default function PipelineBuilder({ onDone }) {
  const { createPipeline } = usePipeline()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [formData, setFormData] = useState({
    fuentes: [], canales: [],
    pipelines: [],
    resources: {}, templates: {},
  })

  const merge = useCallback(patch => setFormData(d => ({ ...d, ...patch })), [])
  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))
  const goTo = i => { if (i <= step) setStep(i) }

  const save = async () => {
    setSaving(true)
    try {
      for (const pipeline of formData.pipelines) {
        await createPipeline({
          name: pipeline.name,
          purpose: pipeline.purpose,
          fuentes: formData.fuentes,
          canales: formData.canales,
          stages: pipeline.stages,
          templates: formData.templates,
        })
      }
      setSaved(true)
      toast.success(`Pipeline${formData.pipelines.length > 1 ? 's creados' : ' creado'} correctamente`)
      setTimeout(() => onDone?.(), 1200)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const stepProps = { data: formData, onChange: merge, onNext: next, onPrev: prev }

  return (
    <div className="pb-root" style={{ background: '#070708', color: 'white', minHeight: '100%', padding: 32 }}>
      <style>{css}</style>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={16} style={{ color: '#0066ff' }} />
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 800 }}>Nuevo Pipeline</span>
        </div>
        {saved && (
          <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.3)', color: '#00c853', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Check size={11} /> Guardado
          </div>
        )}
        {onDone && (
          <button onClick={onDone} style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--gray-4)', padding: '5px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <X size={13} /> Cancelar
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="pb-progress">
        {STEPS.map((label, i) => (
          <>
            {i > 0 && <div key={`line-${i}`} className={clsx('pb-p-line', i <= step && 'done')} />}
            <div key={i} className={clsx('pb-p-step', i < step && 'done', i === step && 'active', i > step && 'locked')} onClick={() => goTo(i)}>
              <div className="pb-p-node">
                <div className="pb-p-dot">{i < step ? <Check size={10} /> : i + 1}</div>
                <div className="pb-p-lbl">{label}</div>
              </div>
            </div>
          </>
        ))}
      </div>

      {/* Step card */}
      <div className="pb-card">
        {step === 0 && <StepFuentes   {...stepProps} />}
        {step === 1 && <StepCanales   {...stepProps} />}
        {step === 2 && <StepPipelines {...stepProps} />}
        {step === 3 && <StepEtapas    {...stepProps} />}
        {step === 4 && <StepAgente    {...stepProps} />}
        {step === 5 && <StepScore     {...stepProps} />}
        {step === 6 && <StepRecursos  {...stepProps} />}
        {step === 7 && <StepPlantillas {...stepProps} />}
        {step === 8 && <StepResumen data={formData} onPrev={prev} onSave={save} saving={saving} />}
      </div>
    </div>
  )
}
