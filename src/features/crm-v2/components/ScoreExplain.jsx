import clsx from 'clsx'
import { maturityFromScore } from '../maturity'

/**
 * Desglose del score. Un número sin explicación genera desconfianza, así que
 * cada factor muestra cuánto suma o resta.
 *
 * El número se pinta con el color de madurez que le corresponde: es la misma
 * escala que ordena el board, no una paleta aparte.
 */
export default function ScoreExplain({ score, delta, factors = [], max = 100 }) {
  const level = maturityFromScore(score)

  return (
    <div className="pv2-score-explain">
      <div className="pv2-score-explain__header">
        <span className="pv2-score-explain__title">Score · {level.label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          <span className="pv2-score-explain__number" style={{ color: level.color }}>{score}</span>
          <span className="pv2-score-explain__max">/ {max}</span>
          {delta > 0 && <span className="pv2-score-explain__trend">↑ +{delta} hoy</span>}
        </span>
      </div>

      {factors.length > 0 && (
        <div className="pv2-factors">
          {factors.map(f => (
            <div key={f.text} className="pv2-factor">
              <span className={clsx('pv2-factor__sign', f.value >= 0 ? 'pv2-factor__sign--pos' : 'pv2-factor__sign--neg')}>
                {f.value >= 0 ? '+' : '−'}
              </span>
              <span className="pv2-factor__text">{f.text}</span>
              <span className={clsx('pv2-factor__value', f.value >= 0 ? 'pv2-factor__value--pos' : 'pv2-factor__value--neg')}>
                {f.value >= 0 ? '+' : '−'}{Math.abs(f.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
