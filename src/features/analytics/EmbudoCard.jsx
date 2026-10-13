import { useMemo } from 'react'
import { TrendingDown } from 'lucide-react'
import { embudo } from './motor'

/**
 * El embudo del proceso completo, de punta a punta.
 *
 * Cada escalón se mide contra el anterior, no contra el total: así la tarjeta
 * contesta "dónde se me cae la gente", que es la pregunta útil. Mirado contra
 * el total, todos los escalones bajan y ninguno explica por qué.
 *
 * Las barras se dimensionan en porcentaje del ancho disponible, nunca en
 * píxeles: la tarjeta tiene que poder ocupar media fila o la fila entera sin
 * que los números se salgan.
 */
export default function EmbudoCard({ leads, citas, periodo }) {
  const pasos = useMemo(() => embudo({ leads, citas }, periodo), [leads, citas, periodo])
  const entraron = pasos[0]?.cantidad || 0

  // El escalón que más gente pierde, sin contar el primero que no pierde nada.
  const peor = pasos.slice(1).reduce(
    (p, e) => (e.perdidos > (p?.perdidos ?? -1) ? e : p), null,
  )

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h3 className="font-display font-bold text-[15px]">Embudo del proceso</h3>
        <span className="text-[11px] text-tertiary">
          {entraron} {entraron === 1 ? 'contacto' : 'contactos'} en el período
        </span>
      </div>
      <p className="text-xs text-secondary mb-4">
        Cada escalón sobre el anterior — ahí se ve dónde se cae la gente.
      </p>

      {entraron === 0 ? (
        <p className="text-xs text-tertiary py-6 text-center">
          No entró ningún contacto en este período.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pasos.map((p, i) => (
            <div key={p.id}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[12.5px] font-semibold truncate">{p.label}</span>
                <span className="text-[12.5px] font-bold tabular-nums flex-shrink-0">
                  {p.cantidad}
                  <span className="text-[11px] text-tertiary font-medium ml-1.5">
                    {p.desdeElInicio}% del total
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${p.desdeElInicio}%`,
                    background: 'linear-gradient(90deg, #1aab99, #3533cd)',
                  }}
                />
              </div>
              {i > 0 && p.perdidos > 0 && (
                <div className="text-[10.5px] text-tertiary mt-1">
                  {p.pasoAnterior}% del paso anterior · se perdieron {p.perdidos}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {peor?.perdidos > 0 && (
        <div className="flex items-start gap-2 mt-4 pt-3 border-t border-border">
          <TrendingDown size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-secondary leading-relaxed">
            Donde más gente se pierde es al pasar a <strong>{peor.label.toLowerCase()}</strong>:
            se caen {peor.perdidos} de cada {peor.perdidos + peor.cantidad}.
          </p>
        </div>
      )}
    </div>
  )
}
