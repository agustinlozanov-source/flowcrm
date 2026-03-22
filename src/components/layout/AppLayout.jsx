import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const navSections = [
  {
    label: 'CRM',
    items: [
      {
        to: '/pipeline',
        label: 'Pipeline',
        badge: null,
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="4" height="16" rx="1.5" fill="currentColor" />
            <rect x="7" y="5" width="4" height="12" rx="1.5" fill="currentColor" />
            <rect x="13" y="8" width="4" height="9" rx="1.5" fill="currentColor" />
          </svg>
        ),
      },
      {
        to: '/leads',
        label: 'Contactos',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        to: '/products',
        label: 'Catálogo',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        ),
      },
      {
        to: '/agent',
        label: 'Agente IA',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <path d="M9 1.5L11.47 6.5H16.5L12.5 9.97L14 15L9 12L4 15L5.5 9.97L1.5 6.5H6.53L9 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        to: '/inbox',
        label: 'Inbox',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <path d="M2 9a7 7 0 1114 0 7 7 0 01-14 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 16c1.6 0 3.1-.5 4.3-1.4L16 16l-1.4-2.7A7 7 0 002 9a7 7 0 007 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        to: '/meetings',
        label: 'Reuniones',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="3" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 7h8M5 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      {
        to: '/import',
        label: 'Importar',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <path d="M9 1v10M5 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 13v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        to: '/analytics',
        label: 'Analytics',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <path d="M3 12L6 9 9 11 13 6 16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="1" y="1" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        ),
      },
      {
        to: '/content',
        label: 'Content Studio',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 8l4 2.5L7 13V8z" fill="currentColor" opacity="0.6" />
          </svg>
        ),
      },
      {
        to: '/landing',
        label: 'Landing Pages',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 6h14M6 16V6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        ),
      },
      {
        to: '/referrals',
        label: 'Referidos',
        badge: '3',
        icon: (
          <svg className="w-[17px] h-[17px]" viewBox="0 0 18 18" fill="none">
            <path d="M9 1L11 7H17L12 11L14 17L9 13L4 17L6 11L1 7H7L9 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
]

export default function AppLayout() {
  const { org, user } = useAuthStore()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut(auth)
      navigate('/login')
    } catch {
      toast.error('Error al cerrar sesión')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">

      {/* SIDEBAR */}
      <aside className="w-[240px] min-w-[240px] bg-surface border-r border-black/[0.08] flex flex-col h-full">

        {/* Logo */}
        <div className="px-5 h-[68px] border-b border-black/[0.08] flex items-center gap-2.5 flex-shrink-0">
          <img src="/logo.png" alt="Logo" className="w-28 object-contain" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navSections.map((section) => (
            <div key={section.label} className="px-3 mb-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tertiary px-2 py-1 mb-1">
                {section.label}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-150 mb-0.5',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-secondary hover:bg-surface-2 hover:text-primary'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={isActive ? 'opacity-100' : 'opacity-60'}>
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className={clsx(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                          isActive ? 'bg-white/20 text-white' : 'bg-accent-blue text-white'
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-black/[0.08] p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer group">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-white">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold text-primary truncate leading-tight">
                {user?.email || 'Usuario'}
              </div>
              <div className="text-[11px] text-tertiary">Admin</div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-tertiary hover:text-red-500"
              title="Cerrar sesión"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M6 2H3a1 1 0 00-1 1v9a1 1 0 001 1h3M10 10l3-3-3-3M13 7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

    </div>
  )
}
