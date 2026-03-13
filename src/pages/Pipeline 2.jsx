import { useAuthStore } from '@/store/authStore'

export default function Pipeline() {
  const { org } = useAuthStore()

  return (
    <div className="h-full flex flex-col">
      {/* Topbar */}
      <div className="bg-surface border-b border-black/[0.08] px-6 h-14 flex items-center gap-3 flex-shrink-0">
        <h1 className="font-display font-bold text-base tracking-tight">Pipeline</h1>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary text-xs py-1.5 px-3">Filtrar</button>
          <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v9M1 5.5h9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Nuevo lead
          </button>
        </div>
      </div>

      {/* Content placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-surface rounded-2xl border border-black/[0.08] flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="1" width="4" height="16" rx="1.5" fill="#0a0a0a" opacity="0.15"/>
              <rect x="7" y="5" width="4" height="12" rx="1.5" fill="#0a0a0a" opacity="0.15"/>
              <rect x="13" y="8" width="4" height="9" rx="1.5" fill="#0a0a0a" opacity="0.15"/>
            </svg>
          </div>
          <p className="font-display font-bold text-lg text-primary mb-1">Pipeline listo</p>
          <p className="text-secondary text-sm">
            Conectado a <span className="font-semibold">{org?.name}</span>.<br/>
            El kanban completo viene en el siguiente paso.
          </p>
        </div>
      </div>
    </div>
  )
}
