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
    id: 'brands',
    nombre: 'Marca personal',
    descripcion: 'Varias marcas por cuenta, métricas de Instagram, escáner de referencias y teleprompter.',
  },
]

/** Los extras que tiene contratados una organización. */
export function tieneExtra(org, addonId) {
  return (org?.addons || []).includes(addonId)
}
