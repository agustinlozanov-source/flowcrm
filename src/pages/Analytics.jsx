import { useMemo, useState } from 'react'
import { usePipeline } from '@/hooks/usePipeline'
import { startOfMonth, endOfMonth, startOfWeek, subDays, isWithinInterval, format, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import clsx from 'clsx'

const PERIODS = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
]

const SOURCE_CONFIG = {
  meta_ads: { icon: '🔵', label: 'Meta Ads' },
  instagram: { icon: '📸', label: 'Instagram' },
  whatsapp: { icon: '💬', label: 'WhatsApp' },
  linkedin: { icon: '💼', label: 'LinkedIn' },
  web: { icon: '🌐', label: 'Web' },
  referral: { icon: '⭐', label: 'Referido' },
  manual: { icon: '✏️', label: 'Manual' },
}

const COLORS = ['#0066ff', '#7c3aed', '#00c853', '#f59e0b', '#ff3b30', '#00b8d9', '#ff9500']

function StatCard({ label, value, sub, color = 'text-primary' }) {
  return (
    <div className="card p-5">
      <div className={clsx('font-display font-bold text-3xl tracking-tight mb-1', color)}>{value}</div>
      <div className="text-xs text-tertiary font-medium mb-1">{label}</div>
      {sub && <div className="text-xs text-secondary">{sub}</div>}
    </div>
  )
}

function BarChart({ data, height = 120, color = '#0066ff' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div className="relative flex-1 flex items-end w-full">
            <div
              className="w-full rounded-t-[3px] transition-all duration-300 group-hover:opacity-80"
              style={{ height: `${(d.value / max) * 100}%`, background: color, minHeight: d.value > 0 ? 3 : 0 }}
            />
            {d.value > 0 && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {d.value}
              </div>
            )}
          </div>
          <span className="text-[9px] text-tertiary truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function FunnelChart({ stages, leadsByStage }) {
  const data = stages.map(s => ({
    name: s.name,
    color: s.color,
    count: (leadsByStage[s.id] || []).length,
    value: (leadsByStage[s.id] || []).reduce((sum, l) => sum + (l.value || 0), 0),
  }))
  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="flex flex-col gap-2">
      {data.map((stage, i) => {
        const pct = Math.round((stage.count / maxCount) * 100)
        const convRate = i === 0 ? 100 : data[0].count > 0 ? Math.round((stage.count / data[0].count) * 100) : 0
        return (
          <div key={stage.name} className="flex items-center gap-3">
            <div className="w-20 text-[11.5px] font-semibold text-primary truncate">{stage.name}</div>
            <div className="flex-1 bg-surface-2 rounded-full h-6 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center px-2 transition-all duration-500"
                style={{ width: `${Math.max(pct, 4)}%`, background: stage.color }}
              >
                {stage.count > 0 && (
                  <span className="text-[10px] font-bold text-white whitespace-nowrap">{stage.count}</span>
                )}
              </div>
            </div>
            <div className="w-10 text-[11px] text-tertiary text-right">{convRate}%</div>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ data, size = 120 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <span className="text-xs text-tertiary">Sin datos</span>
    </div>
  )

  let cumulative = 0
  const segments = data.map(d => {
    const pct = d.value / total
    const start = cumulative
    cumulative += pct
    return { ...d, pct, start }
  })

  const r = 40
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth="18"
          strokeDasharray={`${seg.pct * circumference} ${circumference}`}
          strokeDashoffset={-seg.start * circumference}
          transform={`rotate(-90 ${cx} ${cy})`}
          className="transition-all duration-500"
        />
      ))}
      <circle cx={cx} cy={cy} r="28" fill="white" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0a0a0a">{total}</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="8" fill="#a0a0a5">leads</text>
    </svg>
  )
}

export default function Analytics() {
  const { stages, leads, leadsByStage, loading } = usePipeline()
  const [period, setPeriod] = useState('month')

  const { start, end } = useMemo(() => {
    const now = new Date()
    if (period === '7d') return { start: subDays(now, 7), end: now }
    if (period === '30d') return { start: subDays(now, 30), end: now }
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) }
    return { start: new Date(now.getFullYear(), 0, 1), end: now }
  }, [period])

  const periodLeads = useMemo(() =>
    leads.filter(l => {
      const d = l.createdAt?.toDate?.()
      return d && isWithinInterval(d, { start, end })
    }), [leads, start, end])

  // Daily leads chart
  const dailyData = useMemo(() => {
    const days = period === 'year'
      ? Array.from({ length: 12 }, (_, i) => ({ label: format(new Date(new Date().getFullYear(), i, 1), 'MMM', { locale: es }), month: i }))
      : eachDayOfInterval({ start, end }).map(d => ({ label: format(d, 'd'), date: d }))

    if (period === 'year') {
      return days.map(({ label, month }) => ({
        label,
        value: leads.filter(l => {
          const d = l.createdAt?.toDate?.()
          return d && d.getMonth() === month && d.getFullYear() === new Date().getFullYear()
        }).length
      }))
    }

    return days.map(({ label, date }) => ({
      label,
      value: leads.filter(l => {
        const d = l.createdAt?.toDate?.()
        return d && format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      }).length
    }))
  }, [leads, start, end, period])

  // Source breakdown
  const sourceData = useMemo(() => {
    const counts = {}
    periodLeads.forEach(l => {
      counts[l.source || 'manual'] = (counts[l.source || 'manual'] || 0) + 1
    })
    return Object.entries(counts)
      .map(([source, count], i) => ({
        source,
        label: SOURCE_CONFIG[source]?.label || source,
        icon: SOURCE_CONFIG[source]?.icon || '📌',
        value: count,
        color: COLORS[i % COLORS.length],
        pct: periodLeads.length > 0 ? Math.round((count / periodLeads.length) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [periodLeads])

  // Pipeline value
  const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0)
  const periodValue = periodLeads.reduce((sum, l) => sum + (l.value || 0), 0)
  const avgScore = leads.length > 0
    ? Math.round(leads.filter(l => l.score > 0).reduce((sum, l) => sum + l.score, 0) / Math.max(leads.filter(l => l.score > 0).length, 1))
    : 0

  const formatMoney = (v) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
    return `$${v}`
  }

  // Closing stage count (last stage)
  const closingStage = stages[stages.length - 1]
  const closingLeads = closingStage ? (leadsByStage[closingStage.id] || []).length : 0
  const conversionRate = leads.length > 0 ? Math.round((closingLeads / leads.length) * 100) : 0

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-[68px] flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-[15px] tracking-tight">Analytics</h1>
        <div className="ml-auto flex gap-1 bg-surface-2 border border-black/[0.08] rounded-[8px] p-0.5">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={clsx('px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all',
                period === p.value ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
              )}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-5xl mx-auto flex flex-col gap-5">

          {/* STAT CARDS */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Total leads"
              value={leads.length}
              sub={`${periodLeads.length} en el período`}
              color="text-primary"
            />
            <StatCard
              label="Valor en pipeline"
              value={formatMoney(totalValue)}
              sub={`${formatMoney(periodValue)} este período`}
              color="text-accent-blue"
            />
            <StatCard
              label="Tasa de conversión"
              value={`${conversionRate}%`}
              sub={`${closingLeads} en etapa de cierre`}
              color={conversionRate >= 20 ? 'text-green-600' : 'text-amber-600'}
            />
            <StatCard
              label="Score promedio IA"
              value={avgScore || '—'}
              sub={avgScore >= 60 ? 'Leads bien calificados' : 'Califica más leads'}
              color={avgScore >= 60 ? 'text-green-600' : 'text-secondary'}
            />
          </div>

          {/* LEADS POR DÍA + FUNNEL */}
          <div className="grid grid-cols-2 gap-4">

            {/* Daily chart */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-bold text-sm">Leads por período</h3>
                  <p className="text-xs text-tertiary mt-0.5">{periodLeads.length} leads en el período seleccionado</p>
                </div>
              </div>
              <BarChart data={dailyData} height={140} color="#0066ff" />
            </div>

            {/* Funnel */}
            <div className="card p-5">
              <div className="mb-4">
                <h3 className="font-display font-bold text-sm">Funnel de conversión</h3>
                <p className="text-xs text-tertiary mt-0.5">Leads por etapa · % vs primer etapa</p>
              </div>
              <FunnelChart stages={stages} leadsByStage={leadsByStage} />
            </div>
          </div>

          {/* SOURCE BREAKDOWN */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-sm">ROI por canal</h3>
                <p className="text-xs text-tertiary mt-0.5">Distribución de leads por fuente de origen</p>
              </div>
            </div>

            {sourceData.length === 0 ? (
              <p className="text-sm text-tertiary text-center py-6">Sin datos en el período seleccionado</p>
            ) : (
              <div className="flex gap-8 items-center">
                <DonutChart
                  size={140}
                  data={sourceData.map(s => ({ ...s, color: s.color }))}
                />
                <div className="flex-1 flex flex-col gap-2">
                  {sourceData.map((s, i) => (
                    <div key={s.source} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-sm flex-1">{s.icon} {s.label}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-surface-2 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                        </div>
                        <span className="text-xs font-bold text-secondary w-8 text-right">{s.value}</span>
                        <span className="text-xs text-tertiary w-8 text-right">{s.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PIPELINE BY STAGE VALUE */}
          <div className="card p-5">
            <div className="mb-4">
              <h3 className="font-display font-bold text-sm">Valor por etapa</h3>
              <p className="text-xs text-tertiary mt-0.5">Valor total de los deals en cada etapa del pipeline</p>
            </div>
            <div className="flex flex-col gap-3">
              {stages.map(stage => {
                const stageLeads = leadsByStage[stage.id] || []
                const stageValue = stageLeads.reduce((sum, l) => sum + (l.value || 0), 0)
                const pct = totalValue > 0 ? (stageValue / totalValue) * 100 : 0
                return (
                  <div key={stage.id} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-28">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
                      <span className="text-[12px] font-semibold text-primary truncate">{stage.name}</span>
                    </div>
                    <div className="flex-1 bg-surface-2 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center px-2 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 2)}%`, background: stage.color }}
                      >
                        {stageValue > 0 && pct > 10 && (
                          <span className="text-[10px] font-bold text-white whitespace-nowrap">{formatMoney(stageValue)}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <span className="text-[12px] font-bold text-primary">{formatMoney(stageValue)}</span>
                      <span className="text-[10px] text-tertiary ml-1">{stageLeads.length} leads</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
