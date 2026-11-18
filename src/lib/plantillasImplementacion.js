// Plantillas de implementación por proyecto.
//
// La plantilla general (config/implementationTemplate, la que se edita en
// «Editar plantilla») sigue siendo la del CRM. Un proyecto distinto, como
// Medical Hub OS, guarda su propio plan en el documento de la implementación
// (campo `stages`): así su cronograma no cambia cuando alguien edita la
// plantilla general, ni al revés.

export const PLANTILLAS = {
  crm: {
    id: 'crm',
    nombre: 'Flow Hub CRM (plantilla general)',
    proyecto: 'Flow Hub CRM',
  },
  medicalHubOs: {
    id: 'medicalHubOs',
    nombre: 'Medical Hub OS',
    proyecto: 'Medical Hub OS',
    stages: [
      {
        id: 'mh-levantamiento', name: 'Levantamiento', icon: 'search', durationDays: 5,
        tasks: [
          { id: 'mh01', name: 'Reunión de arranque', responsible: 'qubit', how: 'Presentación de equipos, calendario de las cuatro semanas y canales de contacto', requiresClient: true },
          { id: 'mh02', name: 'Recorrido del paciente', responsible: 'qubit', how: 'Recepción, optometría, estudios, consulta, quirófano, óptica y caja, en Monte Sinaí y en Shalom', requiresClient: true },
          { id: 'mh03', name: 'Entregar datos fiscales para la factura', responsible: 'client', how: 'Razón social, RFC, régimen fiscal, código postal y uso de CFDI', requiresClient: false },
          { id: 'mh04', name: 'Entregar marca y modelo de cada equipo de estudios', responsible: 'client', how: 'OCT, campímetro, biómetro, topógrafo y retinógrafo. Una foto de la etiqueta basta', requiresClient: false },
          { id: 'mh05', name: 'Entregar los formatos actuales', responsible: 'client', how: 'Hoja de consulta, receta, consentimientos y orden de óptica, como los usan hoy', requiresClient: false },
          { id: 'mh06', name: 'Dar acceso para exportar la aplicación actual', responsible: 'client', how: 'Acceso de administrador; Flow Hub hace la exportación', requiresClient: false },
          { id: 'mh07', name: 'Inventario de equipos: qué exporta cada uno', responsible: 'qubit', how: 'DICOM, PDF o imagen, equipo por equipo', requiresClient: false },
          { id: 'mh08', name: 'Documento de levantamiento', responsible: 'qubit', how: 'Cómo funciona hoy la clínica y cómo va a quedar configurado el sistema', requiresClient: false },
        ],
      },
      {
        id: 'mh-configuracion', name: 'Configuración', icon: 'wrench', durationDays: 5,
        tasks: [
          { id: 'mh09', name: 'Entregar la lista del personal', responsible: 'client', how: 'Nombre, puesto y correo de cada persona que usará el sistema', requiresClient: false },
          { id: 'mh10', name: 'Entregar logotipos de Monte Sinaí y Óptica Shalom', responsible: 'client', how: 'En la mejor calidad que tengan', requiresClient: false },
          { id: 'mh11', name: 'Entregar servicios y precios actuales', responsible: 'client', how: 'Consultas, estudios y cirugías, con su costo si lo tienen', requiresClient: false },
          { id: 'mh12', name: 'Entregar el inventario de Óptica Shalom', responsible: 'client', how: 'Armazones, micas y tratamientos, con precio y costo', requiresClient: false },
          { id: 'mh13', name: 'Comprar un servidor con no-break por sede', responsible: 'client', how: 'Flow Hub les dice cuál; va a nombre de la clínica', requiresClient: false },
          { id: 'mh14', name: 'Abrir las cuentas de nube, IA y facturación', responsible: 'client', how: 'A nombre de la clínica, con su tarjeta. Se configuran juntos', requiresClient: true },
          { id: 'mh15', name: 'Citas, horarios y catálogo de servicios', responsible: 'qubit', how: 'Tipos de cita con su duración, horarios por médico y servicios con su costo', requiresClient: false },
          { id: 'mh16', name: 'Formatos con la marca de cada sede', responsible: 'qubit', how: 'Expediente, receta, consentimientos y orden de óptica', requiresClient: false },
          { id: 'mh17', name: 'Instalación de los servidores', responsible: 'qubit', how: 'Un servidor por sede, conectado a la nube de la clínica', requiresClient: true },
          { id: 'mh18', name: 'Usuarios y roles por puesto', responsible: 'qubit', how: 'Médicos, optometría, recepción, óptica, caja y dirección', requiresClient: false },
          { id: 'mh19', name: 'Conexión de los equipos de estudios', responsible: 'qubit', how: 'Cada equipo deja su estudio en el expediente del paciente', requiresClient: true },
        ],
      },
      {
        id: 'mh-migracion', name: 'Migración y capacitación', icon: 'graduation-cap', durationDays: 5,
        tasks: [
          { id: 'mh20', name: 'Tener lista la e.firma vigente del doctor', responsible: 'client', how: 'Para firmar las recetas. La carga el doctor directamente; nadie más la ve', requiresClient: false },
          { id: 'mh21', name: 'Limpieza y carga de la base', responsible: 'qubit', how: 'Pacientes sin duplicados, historial y citas futuras', requiresClient: false },
          { id: 'mh22', name: 'Revisar una muestra contra la aplicación anterior', responsible: 'client', how: 'Recepción compara una muestra de pacientes y citas antes del corte', requiresClient: false },
          { id: 'mh23', name: 'Capacitación por puesto', responsible: 'qubit', how: 'Recepción, optometría, médicos, óptica y caja', requiresClient: true },
          { id: 'mh24', name: 'Pruebas con casos reales', responsible: 'qubit', how: 'Pacientes del día recorriendo todo el sistema, de la cita a la caja', requiresClient: true },
        ],
      },
      {
        id: 'mh-arranque', name: 'Arranque', icon: 'rocket', durationDays: 7,
        tasks: [
          { id: 'mh25', name: 'Día de corte', responsible: 'qubit', how: 'Las citas futuras ya viven en Medical Hub OS y se deja la aplicación anterior', requiresClient: true },
          { id: 'mh26', name: 'Acompañamiento en sitio', responsible: 'qubit', how: 'Flow Hub en la clínica los primeros días de operación', requiresClient: true },
          { id: 'mh27', name: 'Consultoría de uso y ajustes', responsible: 'qubit', how: 'Ajustes al proceso con lo que se aprendió en los primeros días', requiresClient: true },
          { id: 'mh28', name: 'Entrega del manual operativo', responsible: 'qubit', how: 'El manual de la clínica, escrito con su propio proceso', requiresClient: false },
        ],
      },
    ],
    // Cada entrega se marca como entregada y el cliente la aprueba en el portal.
    // `etapa` dice en qué etapa vence, para calcular su fecha.
    entregables: [
      { id: 'me01', titulo: 'Documento de levantamiento', detalle: 'Cómo funciona hoy la clínica y cómo va a quedar configurado el sistema.', etapa: 'mh-levantamiento' },
      { id: 'me02', titulo: 'Sistema configurado', detalle: 'Citas, servicios, formatos y usuarios con la marca de cada sede.', etapa: 'mh-configuracion' },
      { id: 'me03', titulo: 'Servidores instalados y equipos conectados', detalle: 'Cada sede trabajando aunque se caiga el internet.', etapa: 'mh-configuracion' },
      { id: 'me04', titulo: 'Base migrada y revisada', detalle: 'Pacientes, historial y citas en Medical Hub OS.', etapa: 'mh-migracion' },
      { id: 'me05', titulo: 'Capacitación por puesto', detalle: 'Cada persona sabe usar lo que le toca.', etapa: 'mh-migracion' },
      { id: 'me06', titulo: 'Operación en Medical Hub OS', detalle: 'Día de corte: la clínica trabaja en su propio sistema.', etapa: 'mh-arranque' },
      { id: 'me07', titulo: 'Manual operativo', detalle: 'El proceso de la clínica, por escrito.', etapa: 'mh-arranque' },
      { id: 'me08', titulo: 'Cierre del proyecto', detalle: 'Acta de entrega de Medical Hub OS.', etapa: 'mh-arranque' },
    ],
  },
}

/** El plan de una implementación: el suyo si lo tiene, si no la plantilla general. */
export function etapasDe(impl, general) {
  return impl?.stages?.length ? impl.stages : general
}

const sumarDiasHabiles = (fecha, dias) => {
  const d = new Date(fecha)
  let n = 0
  while (n < dias) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) n++
  }
  return d
}

/** Fecha de inicio y fin de cada etapa, en días hábiles desde el arranque. */
export function calcularFechasEtapas(stages, inicio) {
  const fechas = {}
  let actual = new Date(inicio)
  for (const etapa of stages) {
    const fin = sumarDiasHabiles(actual, etapa.durationDays || 0)
    fechas[etapa.id] = { start: new Date(actual), end: fin }
    actual = new Date(fin)
    actual.setDate(actual.getDate() + 1)
  }
  return fechas
}
