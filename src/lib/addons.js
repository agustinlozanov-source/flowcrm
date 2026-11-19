/* Extras que se cobran aparte del plan.
 *
 * Un módulo del plan viene con el paquete; un extra se vende por separado y se
 * enciende organización por organización desde el Superadmin. Marca Personal
 * nace así a propósito: es otro producto, con otro comprador — el grow
 * operator, no la empresa que vende con el CRM.
 *
 * Meterlo como feature de un plan obligaría a inventar un plan nuevo por cada
 * combinación. Con extras, el plan se queda quieto y el extra se enciende.
 */
export const ADDONS = [
  {
    id: 'pipa',
    nombre: 'PIPA · Marco de producto',
    descripcion: 'Pasa la idea por aquí: cinco fases de propósito a progreso, con el marcador que decide y las órdenes de trabajo por puesto. Termina creando el embudo en el CRM.',
  },
  {
    id: 'scorecard',
    nombre: 'Scorecard · Gerente de resultados',
    descripcion: 'Análisis profundo de un periodo: la cadena de conversión por embudo, quién está atorado y en qué etapa, a quién rescatar primero, y lo que dijeron los clientes en todas sus conversaciones. Termina en un plan semanal y en lecciones para el agente.',
  },
  {
    id: 'trafficker',
    nombre: 'Trafficker · Publicar y medir',
    descripcion: 'Publica a Facebook e Instagram desde el CRM, con la liga armada y un código adentro. Cada post dice cuántos leads trajo, porque esos leads entran al CRM con el post anotado.',
  },
  {
    id: 'reporte_ia',
    nombre: 'Reporte de dirección',
    descripcion: 'Un botón en Analítica que lee todos los números de la organización y escribe el reporte: hallazgos por categoría, decisiones para dirección y acciones para quien atiende clientes.',
  },
  {
    id: 'brands',
    nombre: 'Marca personal',
    descripcion: 'Varias marcas por cuenta, métricas de Instagram, escáner de referencias y teleprompter.',
  },
]

/** Los extras que tiene contratados una organización. */
export function tieneExtra(org, addonId) {
  return (org?.addons || []).includes(addonId)
}
