import { Sparkles, CheckCircle2 } from 'lucide-react'

/**
 * Sugerencia de la IA con su CTA. Lila y sparkle: es la señalización de "esto
 * lo escribió la IA", y se usa solo para eso — si el lila aparece en otros
 * lugares, deja de significar nada.
 */
export default function AIInsightCard({ title = 'Siguiente mejor acción', text, ctaLabel = 'Ejecutar acción', onExecute, readOnly = false }) {
  if (!text) return null

  return (
    <div className="pv2-ai">
      <div className="pv2-ai__header">
        <span className="pv2-ai__icon"><Sparkles size={11} /></span>
        <span className="pv2-ai__title">{title}</span>
      </div>
      {/* El texto viene con <strong> para resaltar la acción concreta. */}
      <p className="pv2-ai__text" dangerouslySetInnerHTML={{ __html: text }} />
      {!readOnly && onExecute && (
        <button className="pv2-ai__cta" onClick={onExecute}>
          <CheckCircle2 size={12} /> {ctaLabel}
        </button>
      )}
    </div>
  )
}
