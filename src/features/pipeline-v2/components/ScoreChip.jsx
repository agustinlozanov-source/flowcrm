import clsx from 'clsx'

// Umbrales definidos en el briefing. 'good' no es un rango: es el estado que
// se usa cuando el deal ya está agendado o ganado, sin importar el número.
export function scoreTone(score, { won = false } = {}) {
  if (won) return 'good'
  if (score >= 70) return 'hot'
  if (score >= 40) return 'warm'
  return 'cold'
}

/**
 * Chip tri-color del score, con indicador de tendencia respecto a la semana
 * anterior. `trend` acepta 'up' | 'down' | null.
 */
export default function ScoreChip({ score, won = false, trend = null, tone }) {
  const resolved = tone || scoreTone(score, { won })

  return (
    <span className={clsx('pv2-score', `pv2-score--${resolved}`)}>
      {score}
      {trend && (
        <span
          className={clsx('pv2-score__trend', trend === 'down' && 'pv2-score__trend--down')}
          title={trend === 'up' ? 'Subió esta semana' : 'Bajó esta semana'}
        >
          {trend === 'up' ? '↑' : '↓'}
        </span>
      )}
    </span>
  )
}
