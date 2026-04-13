import { useState, useEffect } from 'react'
import { useGoals, QUARTERS, getQuarterWeeks, getQuarterMonths } from '@/hooks/useGoals'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  Target, Trophy, ChevronRight, Plus, X, Check,
  TrendingUp, TrendingDown, AlertTriangle, Pencil,
  Flame, Calendar, Star, ChevronDown, Info
} from 'lucide-react'

// ─── HELPERS ──────────────────────────────────────────────────────
const fmt = (n) => n?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || '0'
const fmtUSD = (n) => `$${fmt(n)}`

// ─── QUARTER SELECTOR ─────────────────────────────────────────────
function QuarterSelector({ selected, year, onChange, onYearChange }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-surface-2 border border-black/[0.08] rounded-[10px] p-1 gap-0.5">
        {Object.entries(QUARTERS).map(([key, q]) => (
          <button key={key} onClick={() => onChange(key)}
            className={clsx('px-3 py-1.5 rounded-[7px] text-[12px] font-bold transition-all',
              selected === key
                ? 'bg-primary text-white shadow-sm'
                : 'text-secondary hover:text-primary')}>
            {key}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onYearChange(year - 1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-primary hover:bg-surface-2 transition-colors text-sm">
          ‹
        </button>
        <span className="text-[13px] font-bold text-primary w-10 text-center">{year}</span>
        <button onClick={() => onYearChange(year + 1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-primary hover:bg-surface-2 transition-colors text-sm">
          ›
        </button>
      </div>
    </div>
  )
}

// ─── ROCK ITEM ────────────────────────────────────────────────────
function RockItem({ rock, index, onToggle, onEdit, onDelete }) {
  const [showTactic, setShowTactic] = useState(false)

  return (
    <div className={clsx('rounded-[12px] border transition-all',
      rock.done
        ? 'border-green-200 bg-green-50/50'
        : 'border-black/[0.08] bg-surface')}>
      <div className="flex items-start gap-3 p-4">
        {/* Checkbox */}
        <button onClick={() => onToggle(index)}
          className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
            rock.done
              ? 'border-green-500 bg-green-500'
              : 'border-black/20 hover:border-primary')}>
          {rock.done && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={clsx('text-[13.5px] font-semibold leading-snug',
            rock.done ? 'text-green-700 line-through' : 'text-primary')}>
            {rock.title}
          </p>

          {rock.tactic && (
            <button onClick={() => setShowTactic(v => !v)}
              className="flex items-center gap-1 mt-1 text-[11px] text-tertiary hover:text-secondary transition-colors">
              <Info size={10} />
              Táctica
              <ChevronDown size={10} className={clsx('transition-transform', showTactic && 'rotate-180')} />
            </button>
          )}

          {showTactic && rock.tactic && (
            <p className="mt-2 text-[12px] text-secondary leading-relaxed bg-surface-2 rounded-[8px] px-3 py-2">
              {rock.tactic}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(index)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-tertiary hover:text-primary hover:bg-surface-2 transition-colors">
            <Pencil size={11} />
          </button>
          <button onClick={() => onDelete(index)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors">
            <X size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ROCK MODAL ───────────────────────────────────────────────────
function RockModal({ rock, onClose, onSave }) {
  const [form, setForm] = useState({
    title:  rock?.title  || '',
    tactic: rock?.tactic || '',
  })

  const handleSave = () => {
    if (!form.title.trim()) { toast.error('El título es requerido'); return }
    onSave(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-md border border-black/[0.08] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-[15px]">
            {rock ? 'Editar roca' : 'Nueva roca'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
              Prioridad / Roca *
            </label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="ej: Cerrar 5 clientes Enterprise"
              className="input" autoFocus />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
              Táctica — el cómo
            </label>
            <textarea value={form.tactic} onChange={e => setForm(f => ({ ...f, tactic: e.target.value }))}
              placeholder="Describe brevemente cómo vas a lograr esta roca..."
              rows={3} className="input resize-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} className="btn-primary flex-1">
            {rock ? 'Guardar cambios' : 'Agregar roca'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MONTHLY TARGET MODAL ─────────────────────────────────────────
function MonthlyTargetModal({ quarter, year, goal, onClose, onSave }) {
  const qMonths = getQuarterMonths(quarter)
  const [targets, setTargets] = useState(() =>
    qMonths.map(m => ({
      monthIndex: m.monthIndex,
      name: m.name,
      targetRevenue: goal?.months?.find(gm => gm.monthIndex === m.monthIndex)?.targetRevenue
        || Math.round((goal?.targetRevenue || 0) / 3)
        || '',
    }))
  )
  const [saving, setSaving] = useState(false)
  const total = targets.reduce((s, t) => s + (Number(t.targetRevenue) || 0), 0)
  const quarterly = goal?.targetRevenue || 0

  const handleSave = async () => {
    if (targets.some(t => !t.targetRevenue)) { toast.error('Define la meta para cada mes'); return }
    setSaving(true)
    try {
      await onSave(targets.map(t => ({ ...t, targetRevenue: Number(t.targetRevenue) })))
      toast.success('Metas mensuales guardadas')
      onClose()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-md border border-black/[0.08] p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-bold text-[15px]">Metas mensuales</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2"><X size={15} /></button>
        </div>
        <p className="text-[11.5px] text-secondary mb-5">{quarter} {year} · Ingresos por mes</p>

        <div className="flex flex-col gap-3">
          {targets.map((t, i) => (
            <div key={t.monthIndex} className="flex items-center gap-3">
              <div className="w-24 text-[13px] font-semibold text-primary">{t.name}</div>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-[13px]">$</span>
                <input
                  type="number" min="0"
                  value={t.targetRevenue}
                  onChange={e => setTargets(prev => prev.map((x, j) => j === i ? { ...x, targetRevenue: e.target.value } : x))}
                  placeholder="0"
                  className="input pl-7"
                />
              </div>
            </div>
          ))}
        </div>

        {quarterly > 0 && (
          <div className={clsx('mt-4 px-3 py-2 rounded-[8px] text-[11.5px] font-semibold flex items-center justify-between',
            Math.abs(total - quarterly) < 1 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
            <span>Total mensual vs meta trimestral</span>
            <span>{fmtUSD(total)} / {fmtUSD(quarterly)}</span>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Guardar metas'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── WEEKLY TARGET MODAL ──────────────────────────────────────────
function WeeklyTargetModal({ quarter, year, goal, onClose, onSave }) {
  const weeks = getQuarterWeeks(quarter, year)
  const [targets, setTargets] = useState(() =>
    weeks.map(w => ({
      weekNum: w.weekNum,
      label: w.label,
      range: w.range,
      targetClosedDeals: goal?.weeklyTargets?.find(wt => wt.weekNum === w.weekNum)?.targetClosedDeals ?? '',
    }))
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (targets.some(t => t.targetClosedDeals === '' || t.targetClosedDeals === null)) {
      toast.error('Define la meta para cada semana'); return
    }
    setSaving(true)
    try {
      await onSave(targets.map(t => ({ ...t, targetClosedDeals: Number(t.targetClosedDeals) })))
      toast.success('Metas semanales guardadas')
      onClose()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-md border border-black/[0.08] p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-bold text-[15px]">Metas semanales</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2"><X size={15} /></button>
        </div>
        <p className="text-[11.5px] text-secondary mb-4">{quarter} {year} · Ventas cerradas por semana</p>

        <div className="max-h-72 overflow-y-auto flex flex-col gap-2 pr-1">
          {targets.map((t, i) => (
            <div key={t.weekNum} className="flex items-center gap-3 py-1">
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-semibold text-primary">{t.label}</span>
                <span className="text-[10.5px] text-tertiary ml-2">{t.range}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="number" min="0"
                  value={t.targetClosedDeals}
                  onChange={e => setTargets(prev => prev.map((x, j) => j === i ? { ...x, targetClosedDeals: e.target.value } : x))}
                  placeholder="0"
                  className="w-16 text-center input py-1 text-[13px]"
                />
                <span className="text-[10.5px] text-tertiary w-12">cierres</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Guardar metas'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── GOAL SETUP MODAL ─────────────────────────────────────────────
function GoalSetupModal({ goal, quarter, year, onClose, onSave }) {
  const [form, setForm] = useState({
    theme:         goal?.theme         || '',
    description:   goal?.description   || '',
    prize:         goal?.prize         || '',
    targetRevenue: goal?.targetRevenue || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.targetRevenue) { toast.error('La meta es requerida'); return }
    setSaving(true)
    try {
      await onSave({
        ...form,
        targetRevenue: Number(form.targetRevenue),
        rocks: goal?.rocks || [],
      })
      toast.success('Objetivos guardados')
      onClose()
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const qInfo = QUARTERS[quarter]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-lg border border-black/[0.08] p-6">

        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-[10px] bg-primary/[0.08] flex items-center justify-center flex-shrink-0">
            <Target size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-[16px]">
              Configurar {quarter} {year}
            </h2>
            <p className="text-[11.5px] text-secondary mt-0.5">{qInfo.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:bg-surface-2">
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Theme */}
          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
              Tema del trimestre
            </label>
            <input value={form.theme} onChange={set('theme')}
              placeholder="ej: Trimestre de Consolidación"
              className="input" autoFocus />
            <p className="text-[10.5px] text-tertiary mt-1">
              El nombre que le das a este período — debe inspirar
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
              Descripción — el por qué
            </label>
            <textarea value={form.description} onChange={set('description')}
              placeholder="¿Qué hace especial este trimestre? ¿Qué estás construyendo?"
              rows={2} className="input resize-none" />
          </div>

          {/* Prize */}
          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
              Premio al lograrlo 🎯
            </label>
            <input value={form.prize} onChange={set('prize')}
              placeholder="ej: Cena de equipo, viaje, día libre..."
              className="input" />
            <p className="text-[10.5px] text-tertiary mt-1">
              La celebración que se ganan al cumplir las rocas
            </p>
          </div>

          {/* Target */}
          <div>
            <label className="text-[11px] font-semibold text-secondary uppercase tracking-wide block mb-1.5">
              Meta de facturación (USD) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-[13px] font-semibold">$</span>
              <input type="number" value={form.targetRevenue} onChange={set('targetRevenue')}
                placeholder="30000" className="input pl-7" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Guardar objetivos'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PROGRESS RING ────────────────────────────────────────────────
function ProgressRing({ pct, size = 80, stroke = 7, color = '#0066ff' }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="currentColor" strokeWidth={stroke} className="text-black/[0.06]" />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
    </svg>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────
export default function Goals() {
  const {
    goals, loading, currentQuarter, currentYear,
    closedRevenue, computedMetrics,
    saveGoal, updateRock, toggleRock,
    actuals, loadActuals, saveMonthlyTargets, saveWeeklyTargets,
    QUARTERS,
  } = useGoals()

  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [showRockModal, setShowRockModal] = useState(false)
  const [editingRock, setEditingRock] = useState(null) // { index, data }
  const [activeTab, setActiveTab] = useState('trimestre')
  const [showMonthlyModal, setShowMonthlyModal] = useState(false)
  const [showWeeklyModal, setShowWeeklyModal] = useState(false)

  const goalKey = `${selectedYear}-${selectedQuarter}`
  const goalKey = `${selectedYear}-${selectedQuarter}`
  const goal = goals[goalKey] || null
  const metrics = computedMetrics(goal)
  const goalActuals = actuals[goalKey] || { monthly: {}, weekly: {} }
  const quarterWeeks = getQuarterWeeks(selectedQuarter, selectedYear)

  // Load actuals when quarter/year changes or goal becomes available
  useEffect(() => {
    if (goal) loadActuals(selectedQuarter, selectedYear)
  }, [goalKey])

  // Reset tab when switching quarters
  useEffect(() => {
    setActiveTab('trimestre')
  }, [goalKey])

  const isCurrentQuarter = selectedQuarter === currentQuarter && selectedYear === currentYear
  const qInfo = QUARTERS[selectedQuarter]
  const rocks = goal?.rocks || []
  const rocksCompleted = rocks.filter(r => r.done).length

  const handleSaveGoal = async (data) => {
    await saveGoal(selectedQuarter, selectedYear, data)
  }

  const handleSaveRock = async (rockData) => {
    const newRocks = [...rocks]
    if (editingRock !== null) {
      newRocks[editingRock.index] = { ...newRocks[editingRock.index], ...rockData }
    } else {
      newRocks.push({ ...rockData, done: false })
    }
    await updateRock(selectedQuarter, selectedYear, newRocks)
    toast.success(editingRock !== null ? 'Roca actualizada' : 'Roca agregada')
    setEditingRock(null)
  }

  const handleDeleteRock = async (index) => {
    const newRocks = rocks.filter((_, i) => i !== index)
    await updateRock(selectedQuarter, selectedYear, newRocks)
    toast.success('Roca eliminada')
  }

  const handleToggleRock = async (index) => {
    await toggleRock(selectedQuarter, selectedYear, index)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="font-display font-bold text-[15px] tracking-tight">Objetivos</h1>
        </div>

        <QuarterSelector
          selected={selectedQuarter}
          year={selectedYear}
          onChange={setSelectedQuarter}
          onYearChange={setSelectedYear}
        />

        <div className="ml-auto">
          <button onClick={() => setShowSetupModal(true)}
            className={clsx('text-[12.5px] py-1.5 px-3.5 flex items-center gap-1.5',
              goal ? 'btn-secondary' : 'btn-primary')}>
            {goal ? <><Pencil size={13} /> Editar</> : <><Plus size={14} strokeWidth={3} color="white" /> Configurar {selectedQuarter}</>}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-5">

        {!goal ? (
          /* ── EMPTY STATE ── */
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/[0.06] border border-primary/[0.12] flex items-center justify-center">
              <Target size={28} className="text-primary" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-lg text-primary">
                Sin objetivos para {selectedQuarter} {selectedYear}
              </p>
              <p className="text-sm text-secondary mt-1 max-w-xs">
                Configura tu meta trimestral, define tus rocas y celebra cuando las logres.
              </p>
            </div>
            <button onClick={() => setShowSetupModal(true)} className="btn-primary text-sm py-2 px-5 flex items-center gap-2">
              <Plus size={14} strokeWidth={3} color="white" />
              Configurar {selectedQuarter} {selectedYear}
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">

            {/* ── QUARTER HEADER ── */}
            <div className="rounded-[18px] overflow-hidden border border-black/[0.08]"
              style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 60%, #0a1628 100%)' }}>
              <div className="p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white/40 text-[11px] font-bold uppercase tracking-widest">
                        {selectedQuarter} {selectedYear} · {qInfo.name}
                      </span>
                      {isCurrentQuarter && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                          ACTIVO
                        </span>
                      )}
                    </div>
                    <h2 className="font-display font-bold text-2xl tracking-tight">
                      {goal.theme || `${selectedQuarter} ${selectedYear}`}
                    </h2>
                    {goal.description && (
                      <p className="text-white/50 text-[12.5px] mt-1.5 max-w-sm leading-relaxed">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  {/* Progress ring */}
                  {metrics && (
                    <div className="relative flex-shrink-0">
                      <ProgressRing
                        pct={metrics.progressPct}
                        size={88}
                        stroke={7}
                        color={metrics.onTrack ? '#00c853' : '#ff9800'}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-display font-bold text-[18px] text-white leading-none">
                          {metrics.progressPct}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prize */}
                {goal.prize && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-amber-500/10 border border-amber-500/20 w-fit">
                    <Trophy size={13} className="text-amber-400 flex-shrink-0" />
                    <span className="text-amber-300 text-[12px] font-semibold">{goal.prize}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── TAB SELECTOR ── */}
            <div className="flex gap-1 bg-surface-2 border border-black/[0.06] rounded-[12px] p-1 self-start">
              {[
                { id: 'trimestre', label: 'Trimestre' },
                { id: 'meses', label: 'Meses' },
                { id: 'semanas', label: 'Semanas' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={clsx('px-4 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all',
                    activeTab === tab.id
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-secondary hover:text-primary')}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── TRIMESTRE TAB ── */}
            {activeTab === 'trimestre' && (
              <div className="flex flex-col gap-5">

                {metrics && (
                  <div className="grid grid-cols-2 gap-3">

                    <div className="card p-5 col-span-2">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-[11px] font-bold text-tertiary uppercase tracking-wide">Facturación trimestral</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="font-display font-bold text-2xl text-primary">
                              {fmtUSD(metrics.achieved)}
                            </span>
                            <span className="text-secondary text-[13px]">de {fmtUSD(metrics.target)}</span>
                          </div>
                        </div>
                        <div className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-bold',
                          metrics.onTrack
                            ? 'bg-green-50 text-green-600'
                            : 'bg-amber-50 text-amber-600')}>
                          {metrics.onTrack
                            ? <><TrendingUp size={13} /> En ritmo</>
                            : <><TrendingDown size={13} /> Por debajo</>}
                        </div>
                      </div>
                      <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${metrics.progressPct}%`,
                            background: metrics.onTrack
                              ? 'linear-gradient(90deg, #00c853, #00e676)'
                              : 'linear-gradient(90deg, #ff9800, #ffb74d)',
                          }} />
                      </div>
                      <div className="flex justify-between text-[10.5px] text-tertiary mt-1.5">
                        <span>{metrics.elapsed} días transcurridos</span>
                        <span>{metrics.remaining} días restantes</span>
                      </div>
                    </div>

                    <div className="card p-4">
                      <p className="text-[10.5px] font-bold text-tertiary uppercase tracking-wide mb-1">Meta mensual</p>
                      <p className="font-display font-bold text-xl text-primary">{fmtUSD(metrics.monthlyTarget)}</p>
                      <p className="text-[11px] text-secondary mt-0.5">por mes</p>
                    </div>

                    <div className="card p-4">
                      <p className="text-[10.5px] font-bold text-tertiary uppercase tracking-wide mb-1">Meta semanal</p>
                      <p className="font-display font-bold text-xl text-primary">{fmtUSD(metrics.weeklyTarget)}</p>
                      <p className="text-[11px] text-secondary mt-0.5">por semana</p>
                    </div>

                    <div className="card p-4">
                      <p className="text-[10.5px] font-bold text-tertiary uppercase tracking-wide mb-1">Meta diaria</p>
                      <p className="font-display font-bold text-xl text-primary">{fmtUSD(metrics.dailyTarget)}</p>
                      <p className="text-[11px] text-secondary mt-0.5">por día hábil</p>
                    </div>

                    <div className={clsx('card p-4', !metrics.onTrack && 'border-amber-200 bg-amber-50/50')}>
                      <p className="text-[10.5px] font-bold text-tertiary uppercase tracking-wide mb-1">Ritmo actual</p>
                      <p className={clsx('font-display font-bold text-xl',
                        metrics.onTrack ? 'text-green-600' : 'text-amber-600')}>
                        {fmtUSD(metrics.currentPace)}
                      </p>
                      <p className="text-[11px] text-secondary mt-0.5">por día promedio</p>
                    </div>

                    {!metrics.onTrack && (
                      <div className="card p-4 border-red-200 bg-red-50/50 col-span-2">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle size={13} className="text-red-500" />
                          <p className="text-[10.5px] font-bold text-red-600 uppercase tracking-wide">Para recuperar el ritmo</p>
                        </div>
                        <p className="font-display font-bold text-xl text-red-600">{fmtUSD(metrics.dailyNeeded)}/día</p>
                        <p className="text-[11px] text-red-500/70 mt-0.5">
                          necesarios en los {metrics.remaining} días restantes para llegar a la meta
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
                    <div>
                      <h3 className="font-display font-bold text-[14px]">Rocas del trimestre</h3>
                      <p className="text-[11px] text-secondary mt-0.5">
                        {rocksCompleted} de {rocks.length} completadas
                        {rocks.length > 0 && ` · ${Math.round((rocksCompleted / rocks.length) * 100)}%`}
                      </p>
                    </div>
                    {rocks.length < 5 && (
                      <button onClick={() => { setEditingRock(null); setShowRockModal(true) }}
                        className="btn-secondary text-[12px] py-1.5 px-3 flex items-center gap-1.5">
                        <Plus size={13} /> Agregar roca
                      </button>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-2.5">
                    {rocks.length === 0 ? (
                      <div className="text-center py-8">
                        <Star size={24} className="text-tertiary mx-auto mb-2" strokeWidth={1.5} />
                        <p className="text-[13px] text-secondary">Sin rocas definidas</p>
                        <p className="text-[11.5px] text-tertiary mt-1">
                          Las rocas son tus 3-5 prioridades que mueven el trimestre
                        </p>
                        <button onClick={() => { setEditingRock(null); setShowRockModal(true) }}
                          className="btn-primary text-[12.5px] py-1.5 px-4 mt-3 flex items-center gap-1.5 mx-auto">
                          <Plus size={13} strokeWidth={3} color="white" /> Primera roca
                        </button>
                      </div>
                    ) : (
                      rocks.map((rock, i) => (
                        <RockItem key={i} rock={rock} index={i}
                          onToggle={handleToggleRock}
                          onEdit={(idx) => { setEditingRock({ index: idx, data: rock }); setShowRockModal(true) }}
                          onDelete={handleDeleteRock}
                        />
                      ))
                    )}
                    {rocks.length >= 5 && (
                      <p className="text-[11px] text-tertiary text-center pt-1">
                        Máximo 5 rocas por trimestre — enfoque es clave
                      </p>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ── MESES TAB ── */}
            {activeTab === 'meses' && (
              <div className="flex flex-col gap-4">
                {!(goal?.months?.length > 0) ? (
                  <div className="card flex flex-col items-center justify-center py-14 gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <Calendar size={24} className="text-blue-400" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-[15px] text-primary">Sin metas mensuales</p>
                      <p className="text-[12.5px] text-secondary mt-1 max-w-xs">
                        Define cuánto quieres ingresar cada mes del {selectedQuarter}
                      </p>
                    </div>
                    <button onClick={() => setShowMonthlyModal(true)}
                      className="btn-primary text-[12.5px] py-1.5 px-4 flex items-center gap-1.5">
                      <Plus size={13} strokeWidth={3} color="white" /> Configurar metas mensuales
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-secondary font-semibold">Ingresos reales vs meta · mes a mes</p>
                      <button onClick={() => setShowMonthlyModal(true)}
                        className="btn-secondary text-[12px] py-1 px-3 flex items-center gap-1.5">
                        <Pencil size={11} /> Editar metas
                      </button>
                    </div>
                    {getQuarterMonths(selectedQuarter).map(m => {
                      const monthGoal = goal.months.find(gm => gm.monthIndex === m.monthIndex)
                      const target = monthGoal?.targetRevenue || 0
                      const actual = goalActuals.monthly?.[m.monthIndex]?.revenue || 0
                      const deals = goalActuals.monthly?.[m.monthIndex]?.deals || 0
                      const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
                      return (
                        <div key={m.monthIndex} className="card p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-display font-bold text-[15px] text-primary">{m.name}</p>
                              <p className="text-[11px] text-secondary mt-0.5">
                                {deals} venta{deals !== 1 ? 's' : ''} cerrada{deals !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-display font-bold text-[20px] text-primary">{fmtUSD(actual)}</p>
                              <p className="text-[11px] text-tertiary">meta: {fmtUSD(target)}</p>
                            </div>
                          </div>
                          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                background: pct >= 100
                                  ? 'linear-gradient(90deg,#00c853,#00e676)'
                                  : pct >= 70
                                    ? 'linear-gradient(90deg,#0066ff,#3b82f6)'
                                    : 'linear-gradient(90deg,#ff9800,#ffb74d)',
                              }} />
                          </div>
                          <div className="flex justify-between text-[10.5px] text-tertiary mt-1.5">
                            <span>{pct}% completado</span>
                            {actual >= target && target > 0
                              ? <span className="text-green-600 font-semibold">✓ Meta alcanzada</span>
                              : <span>Faltan {fmtUSD(Math.max(0, target - actual))}</span>
                            }
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}

            {/* ── SEMANAS TAB ── */}
            {activeTab === 'semanas' && (
              <div className="flex flex-col gap-4">
                {!(goal?.weeklyTargets?.length > 0) ? (
                  <div className="card flex flex-col items-center justify-center py-14 gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                      <Flame size={24} className="text-purple-400" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-[15px] text-primary">Sin metas semanales</p>
                      <p className="text-[12.5px] text-secondary mt-1 max-w-xs">
                        Define cuántas ventas quieres cerrar cada semana del {selectedQuarter}
                      </p>
                    </div>
                    <button onClick={() => setShowWeeklyModal(true)}
                      className="btn-primary text-[12.5px] py-1.5 px-4 flex items-center gap-1.5">
                      <Plus size={13} strokeWidth={3} color="white" /> Configurar metas semanales
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-secondary font-semibold">Ventas cerradas vs meta · semana a semana</p>
                      <button onClick={() => setShowWeeklyModal(true)}
                        className="btn-secondary text-[12px] py-1 px-3 flex items-center gap-1.5">
                        <Pencil size={11} /> Editar metas
                      </button>
                    </div>
                    <div className="card overflow-hidden">
                      <div className="divide-y divide-black/[0.04]">
                        {quarterWeeks.map(w => {
                          const weekTarget = goal.weeklyTargets.find(wt => wt.weekNum === w.weekNum)
                          const target = weekTarget?.targetClosedDeals || 0
                          const actual = goalActuals.weekly?.[w.weekNum]?.deals || 0
                          const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
                          const now = new Date()
                          const isCurrentWeek = now >= w.startDate && now <= w.endDate
                          return (
                            <div key={w.weekNum} className={clsx('flex items-center gap-4 px-5 py-3',
                              isCurrentWeek && 'bg-primary/[0.03]')}>
                              <div className="w-[72px] flex-shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <p className={clsx('text-[12px] font-bold',
                                    isCurrentWeek ? 'text-primary' : 'text-secondary')}>
                                    {w.label}
                                  </p>
                                  {isCurrentWeek && (
                                    <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-primary text-white leading-none">HOY</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-tertiary">{w.range}</p>
                              </div>
                              <div className="flex-1">
                                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${pct}%`,
                                      background: pct >= 100 ? '#00c853' : isCurrentWeek ? '#0066ff' : '#94a3b8',
                                    }} />
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 min-w-[90px] justify-end">
                                <span className={clsx('text-[14px] font-bold',
                                  actual >= target && target > 0 ? 'text-green-600' : 'text-primary')}>
                                  {actual}
                                </span>
                                <span className="text-[11px] text-tertiary">/ {target} cierres</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* MODALS */}
      {showSetupModal && (
        <GoalSetupModal
          goal={goal}
          quarter={selectedQuarter}
          year={selectedYear}
          onClose={() => setShowSetupModal(false)}
          onSave={handleSaveGoal}
        />
      )}

      {showRockModal && (
        <RockModal
          rock={editingRock?.data || null}
          onClose={() => { setShowRockModal(false); setEditingRock(null) }}
          onSave={handleSaveRock}
        />
      )}

      {showMonthlyModal && (
        <MonthlyTargetModal
          quarter={selectedQuarter}
          year={selectedYear}
          goal={goal}
          onClose={() => setShowMonthlyModal(false)}
          onSave={(months) => saveMonthlyTargets(selectedQuarter, selectedYear, months)}
        />
      )}

      {showWeeklyModal && (
        <WeeklyTargetModal
          quarter={selectedQuarter}
          year={selectedYear}
          goal={goal}
          onClose={() => setShowWeeklyModal(false)}
          onSave={(weeks) => saveWeeklyTargets(selectedQuarter, selectedYear, weeks)}
        />
      )}
    </div>
  )
}
