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
export default function ScoreChip({ score, won = false, trend = null, tone = 'plain' }) {
  // 'plain' es el default a propósito: en el board la tarjeta entera lleva el
  // color de madurez, así que un chip de color compite con esa señal. El modo
  // de color queda para contextos sin tarjeta, como listas o reportes.
  const resolved = tone === 'auto' ? scoreTone(score, { won }) : tone

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
