// Aviso de confidencialidad y tratamiento de datos del Company Profile Builder.
//
// El contenido describe lo que el sistema hace de verdad, no un texto genérico:
// dónde se guarda cada cosa, quién puede verla y por dónde pasa. Si cambia el
// funcionamiento —por ejemplo si se agrega otro proveedor de IA o cambia la
// retención— hay que actualizar esto Y subir NOTICE_VERSION, porque la
// aceptación se registra contra la versión que el cliente leyó.
//
// ⚠️ REVISIÓN LEGAL PENDIENTE
// Esto no es asesoría legal. Para funcionar como Aviso de Privacidad formal
// bajo la LFPDPPP le faltan datos que solo Flow Hub tiene, marcados abajo como
// [POR DEFINIR]. Conviene que lo revise quien lleve lo legal antes de que se
// use con clientes.

export const NOTICE_VERSION = '1.0'
export const NOTICE_DATE = '3 de septiembre de 2026'

export const LEGAL_NAME = 'Flow Hub Tecnología e Inteligencia Comercial S.A. de C.V.'
export const CONTACT_EMAIL = 'atencion@flowhubcrm.app'

export const NOTICE_SUMMARY = [
  'Lo que nos compartas se usa con un solo fin: configurar tu CRM y entrenar al agente de IA que atenderá a tus clientes.',
  'No lo vendemos, no lo compartimos con otros clientes y no lo usamos para nada más.',
  'Puedes pedirnos una copia, una corrección o que lo borremos, cuando quieras.',
]

export const NOTICE_SECTIONS = [
  {
    title: 'Quién trata tu información',
    body: [
      `${LEGAL_NAME} es responsable del tratamiento de la información que compartas en este formulario.`,
      `Para cualquier asunto relacionado con tus datos puedes escribirnos a ${CONTACT_EMAIL}.`,
      'Domicilio del responsable: [POR DEFINIR].',
    ],
  },
  {
    title: 'Qué información recopilamos',
    body: [
      'Datos de tu negocio: nombre comercial y razón social, giro, sedes, horarios, teléfonos, correos y redes sociales.',
      'Información comercial: tu catálogo de productos o servicios con precios y notas internas, tu tecnología y equipamiento, certificaciones, y el perfil del cliente al que le vendes.',
      'Los archivos que subas: catálogos, listas de precios, brochures, fotografías, presentaciones y cualquier otro material institucional.',
      'Si incluyes nombres de personas de tu equipo o casos de clientes, esa información también queda guardada. Te pedimos que solo incluyas datos de personas que te hayan autorizado a compartirlos.',
    ],
  },
  {
    title: 'Para qué la usamos',
    body: [
      'Configurar tu CRM: dar de alta tus sedes, horarios, catálogo y etapas de venta.',
      'Entrenar al agente de inteligencia artificial que atenderá a tus prospectos, para que responda con información correcta sobre tu negocio y con tu forma de hablar.',
      'Diseñar tu proceso comercial: las etapas del pipeline, los criterios de calificación y el manejo de objeciones.',
      'No la usamos para ningún otro fin. No la vendemos, no la cedemos y no la compartimos con otros clientes nuestros.',
    ],
  },
  {
    title: 'Dónde se guarda',
    body: [
      'Los datos del formulario se almacenan en Cloud Firestore y los archivos que subes en Firebase Storage, ambos servicios de infraestructura de Google Cloud.',
      'La información viaja cifrada (HTTPS) y se almacena cifrada en reposo.',
      'La infraestructura de Google Cloud puede procesar y almacenar la información fuera de México. Región de almacenamiento: [POR DEFINIR].',
    ],
  },
  {
    title: 'Quién puede verla',
    body: [
      'Tú, con el correo y el código de acceso que te compartimos.',
      'El equipo de Flow Hub encargado de tu implementación.',
      'Las reglas de acceso del sistema están configuradas para que ningún otro cliente pueda ver tu perfil ni tus archivos, aunque conozca la dirección.',
    ],
  },
  {
    title: 'Proveedores que intervienen',
    body: [
      'Google (Firebase / Google Cloud): almacenamiento de los datos y de los archivos.',
      'Anthropic (Claude): cuando usamos análisis asistido por inteligencia artificial para leer tus documentos o preparar tu agente, el contenido se procesa a través de este proveedor.',
      'Estos proveedores actúan por cuenta nuestra y bajo sus propios compromisos de seguridad. No están autorizados a usar tu información para fines propios.',
    ],
  },
  {
    title: 'Por cuánto tiempo',
    body: [
      'Conservamos tu perfil mientras exista una relación de servicio contigo, y después durante el plazo necesario para cumplir obligaciones legales o contractuales.',
      'Plazo de conservación tras terminar el servicio: [POR DEFINIR].',
      'Cuando envías el formulario guardamos una copia del estado en que quedó. Esa copia no se modifica después; si necesitas cambiar algo, escríbenos y lo actualizamos.',
    ],
  },
  {
    title: 'Tus derechos',
    body: [
      'Puedes pedirnos en cualquier momento acceder a la información que tenemos tuya, corregirla si está mal, cancelarla, u oponerte a que la usemos para algún fin.',
      `Para ejercer cualquiera de estos derechos escríbenos a ${CONTACT_EMAIL} desde el correo con el que accedes a este formulario.`,
      'También puedes pedirnos que borremos los archivos que subiste sin borrar el resto del perfil.',
    ],
  },
  {
    title: 'Cambios a este aviso',
    body: [
      `Este es el aviso versión ${NOTICE_VERSION}, del ${NOTICE_DATE}.`,
      'Si cambiamos la forma en que tratamos tu información, te lo haremos saber y te pediremos que revises la versión nueva.',
    ],
  },
]
