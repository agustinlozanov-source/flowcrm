import clsx from 'clsx'

/* Los motivos reales por los que una cuenta queda limitada. Se nombran en
 * concreto: "revisá WhatsApp" no le dice a nadie qué hacer. */
export const WA_REASONS = {
  payment: 'Método de pago rechazado',
  verification: 'Falta verificación de empresa',
  templates: 'Plantillas sin aprobar',
  quota: 'Cuota del plan agotada',
  window: 'Ventana de 24 h cerrada',
}

/**
 * Estado de la cuenta de WhatsApp Business. Tres niveles:
 *
 *   ok    — todo funciona.
 *   warn  — se puede responder pero no iniciar conversaciones.
 *   block — no entra ni sale nada.
 *
 * Existe porque el equipo operaba creyendo que todo andaba mientras la cuenta
 * estaba limitada. El badge dice el motivo, no solo el color.
 */
export default function WhatsAppStatusBadge({ status = 'ok', reasons = [], compact = false, onClick }) {
  const label = {
    ok: 'WhatsApp OK',
    warn: 'WhatsApp limitado',
    block: 'WhatsApp bloqueado',
  }[status]

  const detail = reasons.map(r => WA_REASONS[r] || r).join(' · ')

  return (
    <button
      className={clsx('pv2-wa', `pv2-wa--${status}`)}
      onClick={onClick}
      title={detail || label}
    >
      <span className="pv2-wa__dot" />
      {compact ? null : label}
      {!compact && detail && <span style={{ opacity: 0.75, fontWeight: 500 }}>· {detail}</span>}
    </button>
  )
}
