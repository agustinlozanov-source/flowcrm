/* Catálogos del SAT que hace falta mostrar al capturar datos fiscales.
 *
 * Son recortes, no los catálogos completos: el del SAT tiene cientos de
 * claves y la mayoría no aplica a una empresa de software. Se incluyen las
 * que de verdad se usan, con su nombre legible, porque pedirle a un cliente
 * que escriba "601" sin saber qué significa es garantizar que se equivoque —
 * y un régimen equivocado hace que el SAT rechace el timbrado.
 */

/** Régimen fiscal del receptor. Los que aplican a clientes de un CRM. */
export const REGIMENES = [
  { clave: '601', nombre: 'General de Ley Personas Morales' },
  { clave: '603', nombre: 'Personas Morales con Fines no Lucrativos' },
  { clave: '605', nombre: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave: '606', nombre: 'Arrendamiento' },
  { clave: '612', nombre: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave: '614', nombre: 'Ingresos por intereses' },
  { clave: '616', nombre: 'Sin obligaciones fiscales' },
  { clave: '621', nombre: 'Incorporación Fiscal' },
  { clave: '626', nombre: 'Régimen Simplificado de Confianza (RESICO)' },
]

/** Para qué va a usar la factura. */
export const USOS_CFDI = [
  { clave: 'G03', nombre: 'Gastos en general' },
  { clave: 'G01', nombre: 'Adquisición de mercancías' },
  { clave: 'I04', nombre: 'Equipo de cómputo y accesorios' },
  { clave: 'I08', nombre: 'Otra maquinaria y equipo' },
  { clave: 'D10', nombre: 'Pagos por servicios educativos' },
  { clave: 'S01', nombre: 'Sin efectos fiscales' },
  { clave: 'CP01', nombre: 'Pagos' },
]

export const FORMAS_PAGO = [
  { clave: '04', nombre: 'Tarjeta de crédito' },
  { clave: '28', nombre: 'Tarjeta de débito' },
  { clave: '03', nombre: 'Transferencia electrónica' },
  { clave: '01', nombre: 'Efectivo' },
  { clave: '99', nombre: 'Por definir' },
]

/* El RFC tiene dos formas: 12 caracteres para empresa y 13 para persona.
 * Validarlo aquí evita gastar un timbre en algo que el SAT va a rechazar —
 * algunos proveedores cobran el intento fallido. */
const RFC = /^([A-ZÑ&]{3,4})\d{6}[A-Z0-9]{3}$/i

export function rfcValido(rfc) {
  const limpio = String(rfc || '').trim().toUpperCase().replace(/[\s-]/g, '')
  if (limpio.length !== 12 && limpio.length !== 13) return false
  return RFC.test(limpio)
}

export function normalizarRfc(rfc) {
  return String(rfc || '').trim().toUpperCase().replace(/[\s-]/g, '')
}

/** Qué le falta a una organización para poder facturarle. */
export function faltaParaFacturar(fiscal = {}) {
  const falta = []
  if (!rfcValido(fiscal.rfc)) falta.push('RFC')
  if (!String(fiscal.razonSocial || '').trim()) falta.push('razón social')
  if (!fiscal.regimen) falta.push('régimen fiscal')
  if (!/^\d{5}$/.test(String(fiscal.cp || ''))) falta.push('código postal')
  if (!fiscal.usoCfdi) falta.push('uso de CFDI')
  return falta
}
