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
  { clave: '02', nombre: 'Cheque nominativo' },
  { clave: '99', nombre: 'Por definir' },
]

/* Cómo se paga: de una vez, o en partes.
 *
 * PPD no es «a plazos» a secas: obliga a emitir un complemento de pago por
 * cada abono. Para un trato partido en dos —el clásico 50 % y 50 %— sale más
 * sencillo y más difícil de olvidar emitir una factura PUE por cada pago
 * recibido, que es lo que hace casi todo el mundo. */
export const METODOS_PAGO = [
  { clave: 'PUE', nombre: 'PUE · Pago en una sola exhibición' },
  { clave: 'PPD', nombre: 'PPD · Pago en parcialidades o diferido' },
]

/* Clave de producto o servicio del SAT, POR CONCEPTO.
 *
 * Es el campo que separa una herramienta de facturación de verdad de un
 * formulario bonito. Timbrar una consultoría, una capacitación y una
 * licencia con la misma clave es declarar mal, aunque la factura salga y el
 * cliente la pague sin notarlo.
 *
 * Es un recorte del catálogo del SAT con lo que Flow Hub factura. */
export const CLAVES_SERVICIO = [
  { clave: '81161700', nombre: 'Servicios de sistemas de información (CRM, software)' },
  { clave: '81112500', nombre: 'Servicios de datos (implementación, migración)' },
  { clave: '81111500', nombre: 'Desarrollo de software' },
  { clave: '80101500', nombre: 'Consultoría de negocios y administración' },
  { clave: '80101700', nombre: 'Asesoría en dirección y planeación estratégica' },
  { clave: '86101700', nombre: 'Capacitación y formación de personal' },
  { clave: '82101500', nombre: 'Publicidad y campañas' },
  { clave: '83121700', nombre: 'Servicios de internet y hospedaje' },
  { clave: '84111500', nombre: 'Servicios contables y de auditoría' },
]

/* Unidad de medida. E48 es la de los servicios y cubre casi todo lo nuestro. */
export const CLAVES_UNIDAD = [
  { clave: 'E48', nombre: 'Unidad de servicio' },
  { clave: 'ACT', nombre: 'Actividad' },
  { clave: 'HUR', nombre: 'Hora' },
  { clave: 'MON', nombre: 'Mes' },
  { clave: 'E54', nombre: 'Licencia' },
]

export const MONEDAS = [
  { clave: 'MXN', nombre: 'Peso mexicano' },
  { clave: 'USD', nombre: 'Dólar' },
  { clave: 'EUR', nombre: 'Euro' },
]

/* Los mismos totales que va a calcular el SAT, para poder verlos antes.
 *
 * Timbrar no se deshace: cancelar un CFDI real exige que el receptor acepte.
 * La única oportunidad de descubrir que el total no era el que se acordó es
 * antes de mandarlo. Esta función es gemela de la que vive en la función de
 * Netlify, a propósito: la pantalla no puede depender de una ida al servidor
 * para enseñar una suma. */
export function totalesCfdi(conceptos = [], tasaIva = 0.16) {
  let subtotal = 0
  let iva = 0
  for (const c of conceptos) {
    const precio = Number(c.precio) || 0
    const cantidad = Number(c.cantidad) > 0 ? Number(c.cantidad) : 1
    const bruto = precio * cantidad
    if (c.ivaIncluido === true) {
      const base = bruto / (1 + tasaIva)
      subtotal += base
      iva += bruto - base
    } else {
      subtotal += bruto
      iva += bruto * tasaIva
    }
  }
  const r = n => Math.round(n * 100) / 100
  return { subtotal: r(subtotal), iva: r(iva), total: r(subtotal + iva) }
}

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
