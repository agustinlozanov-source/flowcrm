import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Superadmin() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, 'organizations'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const planColor = {
    starter: 'bg-black/[0.05] text-secondary',
    pro: 'bg-blue-50 text-accent-blue',
    distributor: 'bg-purple-50 text-accent-purple',
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-black/[0.08] px-6 h-14 flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L7 4H10L7.5 5.8L8.5 9L6 7.2L3.5 9L4.5 5.8L2 4H5L6 1Z" fill="white"/>
            </svg>
          </div>
          <h1 className="font-display font-bold text-base tracking-tight">Superadmin</h1>
        </div>
        <span className="text-xs text-tertiary">Panel de control global</span>
        <div className="ml-auto">
          <span className="badge bg-black/[0.05] text-secondary">
            {orgs.length} organizaciones
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 p-6 pb-0">
        {[
          { label: 'Organizaciones', value: orgs.length, color: 'text-primary' },
          { label: 'Plan Starter', value: orgs.filter(o => o.plan === 'starter').length, color: 'text-secondary' },
          { label: 'Plan Pro', value: orgs.filter(o => o.plan === 'pro').length, color: 'text-accent-blue' },
          { label: 'Distribuidor', value: orgs.filter(o => o.plan === 'distributor').length, color: 'text-accent-purple' },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className={`font-display font-bold text-3xl tracking-tight ${s.color} mb-1`}>{s.value}</div>
            <div className="text-xs text-tertiary font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-black/[0.06] flex items-center gap-2">
            <span className="text-sm font-semibold text-primary">Todas las organizaciones</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-black/10 border-t-primary rounded-full animate-spin" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="text-center py-16 text-secondary text-sm">
              No hay organizaciones registradas aún.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  {['Organización', 'Plan', 'Owner ID', 'Código referido', 'Miembros', 'Fecha'].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-tertiary px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgs.map((org, i) => (
                  <tr key={org.id} className={`border-b border-black/[0.04] hover:bg-surface-2 transition-colors ${i === orgs.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-sm text-primary">{org.name}</div>
                      <div className="text-xs text-tertiary">{org.id}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`badge ${planColor[org.plan] || planColor.starter} capitalize`}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-secondary font-mono">{org.ownerId?.slice(0, 12)}...</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs bg-surface-2 px-2 py-1 rounded text-primary">
                        {org.referralCode || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-secondary">{org.membersCount || 1}</td>
                    <td className="px-5 py-3.5 text-xs text-tertiary">
                      {org.createdAt?.toDate
                        ? format(org.createdAt.toDate(), "dd MMM yyyy", { locale: es })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
