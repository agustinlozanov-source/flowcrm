import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'
import toast from 'react-hot-toast'

// MOCK DATA — reemplazar con Firestore cuando esté en producción
const MOCK_REFERRALS = [
  { id: '1', name: 'Carlos Mendoza', company: 'AgenciaVerde', plan: 'pro', status: 'active', joinedAt: '15 Ene 2025', monthlyValue: 599, commissionPct: 20 },
  { id: '2', name: 'Sofía Ramírez', company: 'MarketingHub', plan: 'pro', status: 'active', joinedAt: '3 Feb 2025', monthlyValue: 599, commissionPct: 20 },
  { id: '3', name: 'Diego Torres', company: 'DigitalSol', plan: 'starter', status: 'active', joinedAt: '22 Feb 2025', monthlyValue: 299, commissionPct: 20 },
  { id: '4', name: 'Ana López', company: 'GrowthLab', plan: 'enterprise', status: 'active', joinedAt: '8 Mar 2025', monthlyValue: 999, commissionPct: 20 },
  { id: '5', name: 'Roberto Silva', company: 'SocialCraft', plan: 'pro', status: 'pending', joinedAt: '20 Mar 2025', monthlyValue: 599, commissionPct: 20 },
]

const PLAN_CONFIG = {
  starter:    { label: 'Starter',    color: '#6e6e73', bg: 'rgba(110,110,115,0.1)' },
  pro:        { label: 'Pro',        color: '#0066ff', bg: 'rgba(0,102,255,0.1)' },
  enterprise: { label: 'Enterprise', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
}

const STATUS_CONFIG = {
  active:  { label: 'Activo',   color: '#00c853', bg: 'rgba(0,200,83,0.1)' },
  pending: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  churned: { label: 'Cancelado', color: '#ff3b30', bg: 'rgba(255,59,48,0.1)' },
}

function StatCard({ label, value, sub, color = 'text-primary', icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className={clsx('font-display font-bold text-3xl tracking-tight mb-1', color)}>{value}</div>
      <div className="text-xs text-tertiary font-medium mb-0.5">{label}</div>
      {sub && <div className="text-xs text-secondary">{sub}</div>}
    </div>
  )
}

export default function Referrals() {
  const { org } = useAuthStore()
  const [copied, setCopied] = useState(false)

  const referralCode = org?.referralCode || 'FLOW-XXXX'
  const referralLink = `https://flowcrm.app/registro?ref=${referralCode}`

  const activeReferrals = MOCK_REFERRALS.filter(r => r.status === 'active')
  const totalMonthly = activeReferrals.reduce((sum, r) => sum + (r.monthlyValue * r.commissionPct / 100), 0)
  const totalAnnual = totalMonthly * 12
  const totalDiscount = Math.min(totalMonthly, 999) // cap at plan price
  const discountPct = Math.min(Math.round((totalDiscount / 599) * 100), 100) // vs pro plan

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success('Link copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* TOPBAR */}
      <div className="bg-surface border-b border-black/[0.08] px-5 h-14 flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-[15px] tracking-tight">Programa de Referidos</h1>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700">
          ⭐ ACTIVO
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {/* HERO - My referral link */}
          <div className="rounded-[18px] p-6 text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0066ff20 100%)' }}>
            <div className="absolute inset-0 opacity-5">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="absolute rounded-full border border-white"
                  style={{ width: `${(i + 1) * 60}px`, height: `${(i + 1) * 60}px`, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              ))}
            </div>

            <div className="relative">
              <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wide mb-1">Tu código de referido</p>
              <div className="font-display font-bold text-4xl tracking-tight mb-4">{referralCode}</div>

              <p className="text-white/60 text-sm mb-4 max-w-sm">
                Comparte tu link y gana <span className="text-amber-400 font-bold">20% de descuento</span> en tu mensualidad por cada cliente activo que referencies.
              </p>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/10 border border-white/20 rounded-[10px] px-4 py-2.5 text-sm text-white/70 font-mono truncate">
                  {referralLink}
                </div>
                <button onClick={handleCopy}
                  className={clsx('flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] font-bold text-sm transition-all flex-shrink-0',
                    copied ? 'bg-green-500 text-white' : 'bg-white text-primary hover:bg-white/90'
                  )}>
                  {copied ? '✓ Copiado' : 'Copiar link'}
                </button>
              </div>
            </div>
          </div>

          {/* STAT CARDS */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon="👥"
              label="Referidos activos"
              value={activeReferrals.length}
              sub={`${MOCK_REFERRALS.length} total registrados`}
              color="text-primary"
            />
            <StatCard
              icon="💰"
              label="Descuento mensual"
              value={`$${totalDiscount}`}
              sub={`${discountPct}% de tu mensualidad`}
              color="text-green-600"
            />
            <StatCard
              icon="📈"
              label="Valor anual generado"
              value={`$${totalAnnual.toLocaleString()}`}
              sub="Para la red completa"
              color="text-accent-blue"
            />
            <StatCard
              icon="🏆"
              label="Tu nivel"
              value={activeReferrals.length >= 5 ? 'Gold' : activeReferrals.length >= 2 ? 'Silver' : 'Bronze'}
              sub={activeReferrals.length >= 5 ? '¡Top referidor!' : `${5 - activeReferrals.length} más para Gold`}
              color={activeReferrals.length >= 5 ? 'text-amber-500' : activeReferrals.length >= 2 ? 'text-secondary' : 'text-amber-700'}
            />
          </div>

          {/* EARNINGS VISUAL */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-sm">Progresión de descuento</h3>
                <p className="text-xs text-secondary mt-0.5">Cuánto más refieres, más descuento acumulas</p>
              </div>
              <div className="text-right">
                <div className="font-display font-bold text-2xl text-green-600">${totalDiscount}/mes</div>
                <div className="text-xs text-tertiary">descuento activo</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-tertiary font-semibold mb-1.5">
                <span>$0</span>
                <span>$299</span>
                <span>$599</span>
                <span>$999+</span>
              </div>
              <div className="h-3 bg-surface-2 rounded-full overflow-hidden border border-black/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min((totalDiscount / 999) * 100, 100)}%`,
                    background: 'linear-gradient(90deg, #00c853, #0066ff)',
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-tertiary mt-1">
                <span>Starter cubierto</span>
                <span>Pro cubierto</span>
                <span>Enterprise cubierto</span>
              </div>
            </div>

            {/* Milestone cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { refs: 1, discount: '$60/mes', label: 'Primer referido', achieved: activeReferrals.length >= 1 },
                { refs: 3, discount: '$180/mes', label: '3 referidos', achieved: activeReferrals.length >= 3 },
                { refs: 5, discount: '$300/mes', label: '5 referidos — Gold', achieved: activeReferrals.length >= 5 },
              ].map(m => (
                <div key={m.refs} className={clsx('rounded-[10px] border p-3 text-center',
                  m.achieved ? 'border-green-300 bg-green-50' : 'border-black/[0.08] bg-surface-2'
                )}>
                  <div className={clsx('font-display font-bold text-sm mb-0.5', m.achieved ? 'text-green-600' : 'text-tertiary')}>
                    {m.discount}
                  </div>
                  <div className="text-[10px] text-secondary">{m.label}</div>
                  {m.achieved && <div className="text-[10px] text-green-600 font-bold mt-1">✓ Logrado</div>}
                </div>
              ))}
            </div>
          </div>

          {/* REFERRALS TABLE */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
              <div>
                <h3 className="font-display font-bold text-sm">Mis referidos</h3>
                <p className="text-xs text-secondary mt-0.5">Clientes que se unieron con tu código</p>
              </div>
              <span className="text-[10.5px] text-tertiary italic">* Datos de ejemplo</span>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  {['Cliente', 'Plan', 'Estado', 'Se unió', 'Su mensualidad', 'Tu descuento'].map(h => (
                    <th key={h} className="text-left text-[10.5px] font-semibold uppercase tracking-wide text-tertiary px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_REFERRALS.map(r => {
                  const plan = PLAN_CONFIG[r.plan]
                  const status = STATUS_CONFIG[r.status]
                  const myDiscount = r.status === 'active' ? Math.round(r.monthlyValue * r.commissionPct / 100) : 0

                  return (
                    <tr key={r.id} className="border-b border-black/[0.04] last:border-0 hover:bg-surface-2 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-[13px] text-primary">{r.name}</div>
                        <div className="text-[11px] text-tertiary">{r.company}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] font-bold px-2 py-1 rounded-full"
                          style={{ background: plan.bg, color: plan.color }}>
                          {plan.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold w-fit px-2 py-1 rounded-full"
                          style={{ background: status.bg, color: status.color }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-secondary">{r.joinedAt}</td>
                      <td className="px-5 py-3.5 font-display font-semibold text-[13px] text-primary">${r.monthlyValue}/mo</td>
                      <td className="px-5 py-3.5">
                        <span className={clsx('font-display font-bold text-[13px]', myDiscount > 0 ? 'text-green-600' : 'text-tertiary')}>
                          {myDiscount > 0 ? `$${myDiscount}/mo` : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2 border-t border-black/[0.08]">
                  <td colSpan={5} className="px-5 py-3 text-[12px] font-bold text-primary text-right">Total descuento mensual:</td>
                  <td className="px-5 py-3 font-display font-bold text-green-600">${totalDiscount}/mo</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* SHARE ACTIONS */}
          <div className="card p-5">
            <h3 className="font-display font-bold text-sm mb-3">Compartir tu link</h3>
            <div className="flex gap-2 flex-wrap">
              <a href={`https://wa.me/?text=Te invito a probar FlowCRM, el CRM con IA para agencias. Regístrate aquí: ${referralLink}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/[0.1] text-sm font-semibold text-secondary hover:border-green-300 hover:text-green-600 transition-all">
                💬 WhatsApp
              </a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/[0.1] text-sm font-semibold text-secondary hover:border-blue-300 hover:text-blue-600 transition-all">
                💼 LinkedIn
              </a>
              <a href={`mailto:?subject=Te recomiendo FlowCRM&body=Hola, te recomiendo FlowCRM para gestionar tus leads con IA. Regístrate aquí: ${referralLink}`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/[0.1] text-sm font-semibold text-secondary hover:border-black/[0.25] transition-all">
                📧 Email
              </a>
              <button onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/[0.1] text-sm font-semibold text-secondary hover:border-black/[0.25] transition-all">
                🔗 Copiar link
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
