// Placeholder genérico para módulos en construcción
const Placeholder = ({ title, icon, description }) => (
  <div className="h-full flex flex-col">
    <div className="bg-surface border-b border-black/[0.08] px-6 h-[68px] flex items-center flex-shrink-0">
      <h1 className="font-display font-bold text-base tracking-tight">{title}</h1>
    </div>
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">{icon}</div>
        <p className="font-display font-bold text-lg text-primary mb-1">{title}</p>
        <p className="text-secondary text-sm max-w-xs">{description}</p>
        <div className="mt-4 inline-flex items-center gap-2 bg-surface border border-black/[0.08] rounded-full px-4 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse" />
          <span className="text-xs font-semibold text-secondary">En construcción</span>
        </div>
      </div>
    </div>
  </div>
)

export const Leads = () => <Placeholder title="Contactos" icon="👥" description="Vista completa de todos tus contactos y leads organizados." />
export const Agent = () => <Placeholder title="Agente IA" icon="⚡" description="Panel de control del agente: fuentes, configuración y actividad en tiempo real." />
export const Meetings = () => <Placeholder title="Reuniones" icon="📅" description="Calendario de videollamadas de cierre agendadas por el agente." />
export const Import = () => <Placeholder title="Importar" icon="📂" description="Sube tu base de datos en cualquier formato. La IA hace el mapeo." />
export const Analytics = () => <Placeholder title="Analytics" icon="📊" description="Métricas de conversión, performance del agente y ROI por canal." />
export const Content = () => <Placeholder title="Content Studio" icon="🎬" description="Radar de noticias, guiones, teleprompter y publicación automatizada." />
export const Referrals = () => <Placeholder title="Referidos" icon="⭐" description="Programa de referidos: tus códigos, comisiones y referidos activos." />
