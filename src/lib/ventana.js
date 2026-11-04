/* La ventana de 24 horas de WhatsApp.
 *
 * Meta deja escribir libre durante 24 horas contadas desde el **último
 * mensaje del cliente**. Fuera de esa ventana solo entran plantillas
 * aprobadas, que se pagan y exigen la cuenta verificada con método de pago —
 * cosas que muchas cuentas de nuestros clientes no tienen. Para ellos, fuera
 * de ventana no hay nada que mandar.
 *
 * ── Lo que hay que entender antes de tocar esto ─────────────────────
 * **Escribirle al cliente NO reabre la ventana.** Solo la reinicia un mensaje
 * suyo. Por eso el mensaje de rescate no sirve para estirar el plazo: sirve
 * para provocar una respuesta, y esa respuesta es la que reinicia el reloj.
 * Si no contesta, la ventana se cierra igual.
 *
 * Y el reloj bueno lo tiene Meta. Éste es una estimación desde el último
 * entrante que vimos: si un webhook se pierde o llega tarde, se desfasa. Por
 * eso el aviso se da con holgura y nunca al filo.
 */

export const VENTANA_HORAS = 24
const HORA = 36e5

/** Cuántas horas antes del cierre conviene intentar el rescate.
 *
 *  Seis horas de margen: da tiempo a que una persona lo vea si el agente está
 *  pausado, y a que el cliente conteste sin prisa. Al filo no sirve. */
export const AVISO_HORAS_ANTES = 6

const aDate = ts => ts?.toDate?.() || (ts instanceof Date ? ts : null)

/** El estado de la ventana de un lead.
 *
 *  Sin `lastInboundAt` no hay reloj: devuelve `desconocida` en vez de inventar
 *  que está abierta, porque de ahí saldrían mensajes que no se entregan. */
export function estadoVentana(lead, ahora = Date.now()) {
  const inbound = aDate(lead?.lastInboundAt)
  if (!inbound) return { estado: 'desconocida', horas: null, cierra: null }

  const cierra = new Date(inbound.getTime() + VENTANA_HORAS * HORA)
  const horas = (cierra.getTime() - ahora) / HORA

  if (horas <= 0) return { estado: 'cerrada', horas: 0, cierra }
  if (horas <= AVISO_HORAS_ANTES) return { estado: 'porCerrar', horas, cierra }
  return { estado: 'abierta', horas, cierra }
}

/** Cómo se dice el tiempo que queda. En minutos abajo de una hora, porque
 *  «0 h» se lee como si ya hubiera cerrado. */
export function textoVentana(lead, ahora = Date.now()) {
  const { estado, horas } = estadoVentana(lead, ahora)
  if (estado === 'desconocida') return null
  if (estado === 'cerrada') return 'Ventana cerrada'
  if (horas < 1) return `Cierra en ${Math.max(1, Math.round(horas * 60))} min`
  return `Cierra en ${Math.round(horas)} h`
}

/** Si este lead es candidato al mensaje de rescate.
 *
 *  Pide que la ventana esté por cerrar y que el último en hablar hayamos sido
 *  nosotros: si el cliente escribió y nadie le contestó, lo que falta es
 *  responderle, no rescatarlo. Eso ya se ve como «Esperando». */
export function tocaRescatar(lead, ahora = Date.now()) {
  const { estado } = estadoVentana(lead, ahora)
  return estado === 'porCerrar' && !lead?.hasUnread
}
