import { useMemo, useState } from 'react'
import { usePipeline } from '@/hooks/usePipeline'
import { useAppointments } from '@/hooks/useAppointments'
import Tablero from '@/features/analytics/Tablero'
import { startOfMonth, endOfMonth, startOfWeek, subDays, isWithinInterval, format, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import clsx from 'clsx'
import { MousePointerClick, Instagram, MessageCircle, Linkedin, Globe, Star, PenTool, Pin } from 'lucide-react'

const PERIODS = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
]

const SOURCE_CONFIG = {
  meta_ads: { icon: <MousePointerClick size={14} className="text-blue-500" />, label: 'Meta Ads' },
  instagram: { icon: <Instagram size={14} className="text-pink-500" />, label: 'Instagram' },
  whatsapp: { icon: <MessageCircle size={14} className="text-green-500" />, label: 'WhatsApp' },
  linkedin: { icon: <Linkedin size={14} className="text-blue-700" />, label: 'LinkedIn' },
  web: { icon: <Globe size={14} className="text-indigo-500" />, label: 'Web' },
  referral: { icon: <Star size={14} className="text-yellow-500" />, label: 'Referido' },
  manual: { icon: <PenTool size={14} className="text-gray-500" />, label: 'Manual' },
}

const COLORS = ['#0066ff', '#7c3aed', '#00c853', '#f59e0b', '#ff3b30', '#00b8d9', '#ff9500']

export default function Analytics() {
  const {
    stages, leadsByStage, loading,
    leads: leadsActivos, systemLeads, discardedLeads, members,
  } = usePipeline()
  const { appointments } = useAppointments()

  // Todos los leads, no solo los de calentamiento.
  const leads = useMemo(
    () => [...leadsActivos, ...systemLeads, ...discardedLeads],
    [leadsActivos, systemLeads, discardedLeads],
  )
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
        icon: SOURCE_CONFIG[source]?.icon || <Pin size={14} />,
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
      <div className="bg-surface border-b border-black/[0.08] px-5 py-3 flex flex-col gap-2.5 flex-shrink-0">
        {/* Row 1 — título */}
        <div className="flex items-center">
          <h1 className="font-display font-bold text-[15px] tracking-tight">Analytics</h1>
        </div>
        {/* Row 2 — selector de período */}
        <div className="flex gap-1 bg-surface-2 border border-black/[0.08] rounded-[8px] p-0.5 w-fit">
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
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <Tablero
              datos={{ leads, citas: appointments, miembros: members }}
              periodo={{ desde: start, hasta: end }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
