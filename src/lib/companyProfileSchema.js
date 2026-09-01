// Company Profile Builder — esquema de las 7 secciones.
//
// Este archivo es la única fuente de verdad del formulario: el renderizado, el
// cálculo de progreso, la lista de campos críticos y (en Fase 2) el prompt de
// extracción se derivan todos de aquí. Agregar un campo es agregarlo acá.
//
// Las claves de sección y de campo replican el schema del Anexo A de la spec,
// para que el snapshot enviado tenga exactamente esa forma.

export const CATEGORIES = [
  'Salud', 'Educación', 'Bienes raíces', 'Servicios profesionales', 'Retail',
  'Automotriz', 'Turismo', 'Financiero', 'Belleza y estética', 'Fitness',
  'Alimentos y bebidas', 'Tecnología', 'Otro',
]

export const CURRENCIES = ['MXN', 'USD', 'EUR']

export const WEEKDAYS = [
  { id: 'mon', label: 'Lunes', short: 'Lun' },
  { id: 'tue', label: 'Martes', short: 'Mar' },
  { id: 'wed', label: 'Miércoles', short: 'Mié' },
  { id: 'thu', label: 'Jueves', short: 'Jue' },
  { id: 'fri', label: 'Viernes', short: 'Vie' },
  { id: 'sat', label: 'Sábado', short: 'Sáb' },
  { id: 'sun', label: 'Domingo', short: 'Dom' },
]

export const MATERIAL_TYPES = [
  'Catálogo general', 'Lista de precios', 'Brochure de servicio específico',
  'Foto de instalaciones', 'Foto de equipo humano', 'Foto de equipamiento / tecnología',
  'Testimonio / caso de éxito', 'Documento de bienvenida', 'Formato / cuestionario médico',
  'Contrato / términos y condiciones', 'Otro',
]

export const WHEN_TO_SERVE = [
  'Cuando alguien pide información general',
  'Cuando pregunta por precios',
  'Cuando pregunta por un servicio específico',
  'Cuando pide ver instalaciones',
  'Cuando pide referencias / casos',
  'Cuando ya agendó cita (materiales de bienvenida)',
  'Solo si el vendedor humano lo pide',
]

export const DIFFERENTIATOR_OPTIONS = [
  'Precio competitivo',
  'Experiencia / trayectoria del equipo',
  'Tecnología / equipamiento superior',
  'Ubicación / accesibilidad',
  'Trato humano / cercanía',
  'Rapidez de atención',
  'Casos de éxito comprobados',
  'Personalización del servicio',
  'Cobertura de casos complejos',
  'Otro',
]

// Preguntas de la entrevista guiada de la sección 5 (§5.5).
export const INTERVIEW_QUESTIONS = [
  { id: 'q1', text: 'Piensa en tu último cliente satisfecho. ¿Qué edad tenía, aproximadamente?' },
  { id: 'q2', text: '¿Vino solo o acompañado? Si vino acompañado, ¿por quién?' },
  { id: 'q3', text: '¿Qué lo trajo hasta ustedes — un dolor, un problema, un objetivo específico?' },
  { id: 'q4', text: '¿Cuánto pagó por su tratamiento / servicio completo, aproximadamente?' },
  { id: 'q5', text: 'Ahora piensa en un cliente que NO era para ustedes. ¿Qué tenía en común con otros que también terminaron mal? (edad, expectativa, presupuesto, actitud…)' },
]

export const SECTIONS = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'identity',
    num: 1,
    title: 'Identidad del negocio',
    icon: 'building',
    intro: 'Los datos fundacionales. Es lo que el agente responde cuando alguien pregunta dónde están, a qué hora abren o cómo contactarlos.',
    fields: [
      {
        id: 'tradeName', label: 'Nombre comercial', type: 'text', required: true,
        placeholder: 'Ej: Clínica Visión Total', minLength: 2,
        help: 'El nombre con el que la gente los conoce, no la razón social.',
      },
      {
        id: 'legalName', label: 'Razón social', type: 'text',
        placeholder: 'Ej: Clínica Visión Total S.A. de C.V.',
        help: 'La denominación legal completa. Se usa solo en documentos formales.',
      },
      {
        id: 'category', label: 'Categoría / industria', type: 'category', required: true,
        options: CATEGORIES,
        subPlaceholder: 'Ej: Oftalmología, Odontología, Residencial vertical',
        help: 'La categoría gruesa, y una subcategoría específica que describa mejor lo que hacen.',
      },
      {
        id: 'locations', label: 'Sedes / ubicaciones', type: 'table', required: true, minRows: 1,
        addLabel: '+ Agregar otra sede',
        help: 'Agrega cada sede que atienda clientes presencialmente.',
        columns: [
          { key: 'name', label: 'Nombre de sede', type: 'text', required: true, placeholder: 'Matriz Reforma' },
          { key: 'address', label: 'Dirección completa', type: 'text', required: true, placeholder: 'Av. Reforma 123, Col. Centro', minLength: 8 },
          { key: 'phone', label: 'Teléfono', type: 'phone', placeholder: '55 1234 5678' },
          { key: 'city', label: 'Ciudad', type: 'text', required: true, placeholder: 'CDMX' },
          { key: 'isMain', label: 'Es matriz', type: 'exclusive-check' },
        ],
      },
      {
        id: 'schedule', label: 'Horarios de atención', type: 'schedule', required: true,
        dependsOn: 'locations',
        help: 'Marca los días que abren y define el horario. Al menos un día debe tener horario.',
      },
      {
        id: 'contacts', label: 'Contactos institucionales', type: 'group', required: true,
        help: 'El WhatsApp de atención es el número que vamos a conectar al sistema. Debe ser un número dedicado al negocio, no personal.',
        fields: [
          { id: 'email', label: 'Email general', type: 'email', required: true, placeholder: 'contacto@empresa.com' },
          { id: 'phone', label: 'Teléfono general', type: 'phone', placeholder: '55 1234 5678' },
          { id: 'whatsapp', label: 'WhatsApp de atención', type: 'phone', required: true, placeholder: '55 1234 5678' },
        ],
      },
      {
        id: 'digitalPresence', label: 'Presencia digital', type: 'group', required: true,
        requiredMode: 'atLeastOne',
        help: 'Con que llenes una basta, pero mientras más nos des, mejor entendemos cómo se presentan.',
        fields: [
          { id: 'website', label: 'Sitio web', type: 'url', placeholder: 'https://empresa.com' },
          { id: 'facebook', label: 'Facebook', type: 'url', placeholder: 'https://facebook.com/empresa' },
          { id: 'instagram', label: 'Instagram', type: 'url', placeholder: 'https://instagram.com/empresa' },
          { id: 'tiktok', label: 'TikTok', type: 'url', placeholder: 'https://tiktok.com/@empresa' },
          { id: 'youtube', label: 'YouTube', type: 'url', placeholder: 'https://youtube.com/@empresa' },
          { id: 'linkedin', label: 'LinkedIn', type: 'url', placeholder: 'https://linkedin.com/company/empresa' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'history',
    num: 2,
    title: 'Historia y filosofía',
    icon: 'heart',
    intro: 'La capa humana. Es lo que el agente responde cuando alguien pregunta "¿quiénes son?" o "¿por qué debería elegirlos a ustedes?".',
    fields: [
      {
        id: 'foundedYear', label: 'Año de fundación', type: 'number',
        min: 1900, max: new Date().getFullYear(), placeholder: '2008',
      },
      {
        id: 'briefHistory', label: 'Historia breve', type: 'textarea', required: true, maxLength: 600,
        placeholder: 'Ej: Fundada en 2008 por el Dr. Rodríguez, la clínica nació con la misión de acercar diagnósticos oftalmológicos de primer nivel a familias del sur de la ciudad...',
        help: 'Cuenta en pocas frases cómo empezaron y qué los motivó. Es lo que un vendedor con experiencia diría en una primera reunión.',
      },
      {
        id: 'mission', label: 'Misión', type: 'textarea', maxLength: 300,
        help: 'En una frase, ¿qué hacen y para quién? Si no la tienen escrita formalmente, escribe lo primero que se te venga.',
      },
      {
        id: 'vision', label: 'Visión', type: 'textarea', maxLength: 300,
        help: 'Hacia dónde van. Dónde quieren estar en unos años.',
      },
      {
        id: 'values', label: 'Valores', type: 'table', required: true, minRows: 3, maxRows: 8,
        addLabel: '+ Agregar valor',
        help: 'No pongas solo la palabra — explica qué significa en tu negocio. "Innovación" puede querer decir cosas muy distintas en dos empresas.',
        columns: [
          { key: 'name', label: 'Valor', type: 'text', required: true, placeholder: 'Ética' },
          { key: 'meaning', label: 'Qué significa para nosotros', type: 'textarea', required: true, maxLength: 200, placeholder: 'Cómo se vive ese valor en el día a día' },
        ],
      },
      {
        id: 'beliefs', label: 'En qué creen', type: 'textarea', maxLength: 500,
        placeholder: 'Ej: Creemos que un diagnóstico bien hecho vale más que diez tratamientos genéricos.',
        help: 'Frases o creencias que guían tus decisiones. Las cosas que dirías si te preguntaran "a qué le apuestan ustedes".',
      },
      {
        id: 'antiBeliefs', label: 'En qué NO creen', type: 'textarea', maxLength: 500,
        placeholder: 'Ej: No creemos en vender tratamientos que la persona no necesita. No creemos en descuentos agresivos que devalúan el trabajo profesional.',
        help: 'Igual de importante que lo que sí creen. Sirve para que el agente sepa qué caminos NO tomar en una conversación.',
      },
      {
        id: 'slogan', label: 'Frase o slogan', type: 'text',
        placeholder: 'Ej: Ver bien es vivir bien.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'catalog',
    num: 3,
    title: 'Catálogo de productos o servicios',
    icon: 'package',
    intro: 'El bloque más importante. Sin esto el agente no puede responder qué ofrecen ni cuánto cuesta.',
    fields: [
      {
        id: 'services', label: 'Catálogo', type: 'table', required: true, minRows: 1,
        addLabel: '+ Agregar servicio', importable: true, compactable: true,
        compactColumns: ['name', 'price'],
        help: 'Cada producto o servicio que ofrecen, con el precio que manejan hoy.',
        columns: [
          { key: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Consulta oftalmológica general' },
          { key: 'category', label: 'Categoría', type: 'suggest', placeholder: 'Consultas', suggestFrom: 'services.category' },
          { key: 'shortDescription', label: 'Descripción corta', type: 'textarea', maxLength: 300, placeholder: '1-2 frases que usarías para explicárselo a un cliente' },
          { key: 'priceType', label: 'Precio es', type: 'select', options: ['fijo', 'desde', 'rango', 'consultar'], default: 'fijo' },
          { key: 'price', label: 'Precio', type: 'number', placeholder: '1200', hideWhen: { priceType: 'consultar' } },
          { key: 'priceMax', label: 'Precio máximo', type: 'number', placeholder: '2400', showWhen: { priceType: 'rango' } },
          { key: 'currency', label: 'Moneda', type: 'select', options: CURRENCIES, default: 'MXN', hideWhen: { priceType: 'consultar' } },
          { key: 'duration', label: 'Duración / tiempo', type: 'text', placeholder: '45 min' },
          { key: 'prerequisites', label: 'Requisitos previos', type: 'textarea', maxLength: 200, placeholder: 'Ej: requiere ayuno de 8 horas' },
          { key: 'internalNotes', label: 'Notas internas', type: 'textarea', maxLength: 300, internal: true, placeholder: 'Lo que el agente debe saber pero no necesariamente compartir' },
        ],
      },
      {
        id: 'doesNotOffer', label: 'Servicios que NO ofrecen (aunque preguntan por ellos)', type: 'table',
        addLabel: '+ Agregar servicio que no ofrecen',
        help: 'Servicios que la gente asume que ofrecen pero no. Ayuda al agente a no crear falsas expectativas.',
        columns: [
          { key: 'name', label: 'Nombre', type: 'text', placeholder: 'Cirugía LASIK' },
          { key: 'whatToSay', label: 'Qué decir cuando pregunten', type: 'textarea', maxLength: 300, placeholder: 'No ofrecemos ese servicio, pero recomendamos a la Clínica X que sí lo hace.' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'capabilities',
    num: 4,
    title: 'Capacidades, tecnología y credenciales',
    icon: 'award',
    intro: 'Los argumentos de autoridad. Lo que le da confianza al prospecto de que está tratando con profesionales serios.',
    fields: [
      {
        id: 'yearsOfExperience', label: 'Años de experiencia', type: 'number', required: true,
        min: 0, max: 100, placeholder: '18',
      },
      {
        id: 'casesAttended', label: 'Casos / clientes atendidos', type: 'group',
        help: 'Un número aproximado con el contexto. No hace falta que sea exacto — pero sí honesto.',
        fields: [
          { id: 'number', label: 'Número aproximado', type: 'number', placeholder: '12000' },
          { id: 'context', label: 'Contexto de la cifra', type: 'text', placeholder: 'acumulados desde 2010' },
        ],
      },
      {
        id: 'certifications', label: 'Certificaciones y avales', type: 'table',
        addLabel: '+ Agregar certificación',
        columns: [
          { key: 'name', label: 'Certificación / institución', type: 'text', placeholder: 'Consejo Mexicano de Oftalmología' },
          { key: 'year', label: 'Año o vigencia', type: 'text', placeholder: '2019 — vigente' },
          { key: 'description', label: 'Qué certifica', type: 'textarea', maxLength: 200 },
        ],
      },
      {
        id: 'technology', label: 'Tecnología y equipamiento', type: 'table', required: true, minRows: 1,
        skippable: true, skipLabel: 'Mi negocio no usa tecnología o equipamiento relevante',
        addLabel: '+ Agregar equipo',
        help: 'Menciona la tecnología por su nombre — la gente lo googlea y se genera confianza.',
        columns: [
          { key: 'name', label: 'Nombre del equipo o tecnología', type: 'text', required: true, placeholder: 'Topógrafo corneal Pentacam AXL' },
          { key: 'brand', label: 'Marca / fabricante', type: 'text', placeholder: 'Oculus' },
          { key: 'purpose', label: 'Para qué sirve', type: 'textarea', required: true, maxLength: 300, placeholder: 'En lenguaje que entienda el cliente final' },
          { key: 'useCategory', label: 'Categoría de uso', type: 'select', options: ['diagnóstico', 'tratamiento', 'cirugía', 'seguimiento', 'otro'], default: 'diagnóstico' },
        ],
      },
      {
        id: 'specialists', label: 'Especialistas / equipo humano', type: 'table',
        addLabel: '+ Agregar especialista',
        help: 'Opcional pero muy recomendado — el equipo suele ser el argumento más fuerte.',
        columns: [
          { key: 'name', label: 'Nombre completo', type: 'text' },
          { key: 'role', label: 'Rol / especialidad', type: 'text' },
          { key: 'credentials', label: 'Formación / credenciales', type: 'textarea', maxLength: 300 },
          { key: 'publicMention', label: 'Autorizado a mencionar', type: 'check' },
        ],
      },
      {
        id: 'emblematicCases', label: 'Casos emblemáticos', type: 'table',
        addLabel: '+ Agregar caso',
        help: 'Casos que sirven de ejemplo cuando alguien pregunta "¿han hecho algo así?". Cuida no incluir datos personales del paciente sin autorización.',
        columns: [
          { key: 'title', label: 'Título del caso', type: 'text', placeholder: 'Corrección de queratocono avanzado en paciente joven' },
          { key: 'description', label: 'Descripción', type: 'textarea', maxLength: 400 },
          { key: 'authorized', label: 'Autorizado a mencionar', type: 'check' },
        ],
      },
      {
        id: 'recognitions', label: 'Reconocimientos o premios', type: 'table',
        addLabel: '+ Agregar reconocimiento',
        columns: [
          { key: 'title', label: 'Reconocimiento', type: 'text' },
          { key: 'entity', label: 'Entidad', type: 'text' },
          { key: 'year', label: 'Año', type: 'text' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'idealCustomer',
    num: 5,
    title: 'Cliente al que sirven',
    icon: 'users',
    intro: 'Perfil del cliente ideal. Esta sección casi no se puede sacar de material institucional — los archivos hablan del negocio, no del cliente. Por eso la entrevista guiada ayuda.',
    hasInterview: true,
    fields: [
      {
        id: 'ageRange', label: 'Rango de edad típico', type: 'agerange', required: true,
        help: 'El rango donde cae la mayoría de tus clientes, no los casos extremos.',
      },
      {
        id: 'genderPredominant', label: 'Género predominante', type: 'select', required: true,
        options: ['Femenino', 'Masculino', 'Mixto sin sesgo', 'Otro'],
      },
      {
        id: 'lifeSituations', label: 'Situación de vida típica', type: 'multiselect', required: true,
        options: ['empleado corporativo', 'dueño de negocio', 'profesionista independiente', 'retirado / jubilado', 'estudiante', 'ama/o de casa', 'otro'],
        allowOther: true,
      },
      {
        id: 'incomeRange', label: 'Rango de ingreso mensual del hogar', type: 'select', required: true,
        options: ['menos de 20K MXN', '20K–50K', '50K–100K', '100K–200K', 'más de 200K', 'no aplica'],
        help: 'Estimación gruesa. Nos ayuda a que el agente calibre cómo hablar de precios.',
      },
      {
        id: 'contactTrigger', label: 'Detonante típico de contacto', type: 'textarea', required: true, maxLength: 500,
        placeholder: 'Ej: Empezaron a molestarles los dolores de cabeza al leer, notaron visión borrosa al manejar, un familiar los recomendó, un examen de rutina detectó algo…',
        help: 'La situación real que hace que la persona te busque. Piensa en varios casos y describe lo común.',
      },
      {
        id: 'urgency', label: 'Urgencia típica', type: 'select', required: true,
        options: ['urgencia inmediata (necesita atención esta semana)', 'media (dentro del mes)', 'baja (evaluando en varios meses)', 'varía mucho según servicio'],
      },
      {
        id: 'typicalBudget', label: 'Presupuesto que suele manejar', type: 'text',
        placeholder: 'Ej: entre 5,000 y 15,000 MXN por procedimiento.',
        help: 'Rango que suelen mencionar cuando preguntan por precios. Nos ayuda a distinguir un lead que cabe en tu oferta de uno que no.',
      },
      {
        id: 'doNotWorkWith', label: 'Con quién NO trabajan', type: 'textarea', required: true, maxLength: 500,
        placeholder: 'Ej: menores de 18 años sin autorización de padres, personas con condiciones cardíacas específicas, casos que requieren especialidades que no tenemos…',
        help: 'Muy importante. Le dice al agente cuándo NO seguir insistiendo en agendar una cita. Sé específico.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'differentiation',
    num: 6,
    title: 'Diferenciación',
    icon: 'target',
    intro: 'Los argumentos comparativos. Qué los hace distintos, y qué no son — para que el agente no venda promesas que no cumplen.',
    fields: [
      {
        id: 'competitors', label: 'Competidores directos', type: 'table', maxRows: 5,
        addLabel: '+ Agregar competidor',
        help: 'Sé honesto sobre en qué son mejores ellos. Ayuda al agente a saber cuándo no atacar de frente y cuándo pivotear a nuestros diferenciales reales.',
        columns: [
          { key: 'name', label: 'Competidor', type: 'text' },
          { key: 'relativePrice', label: 'Precio relativo', type: 'select', options: ['mucho más barato', 'más barato', 'similar', 'más caro', 'mucho más caro'] },
          { key: 'betterThem', label: 'En qué son mejores ellos', type: 'textarea', maxLength: 200 },
          { key: 'betterUs', label: 'En qué somos mejores nosotros', type: 'textarea', maxLength: 200 },
        ],
      },
      {
        id: 'ownDifferentiators', label: 'Diferenciadores propios', type: 'checklist', required: true, minChecked: 3,
        options: DIFFERENTIATOR_OPTIONS,
        detailLabel: '¿Por qué específicamente?', detailMaxLength: 300,
        help: 'Marca al menos 3 y explica cada uno. El detalle es lo que el agente va a usar como argumento — "precio competitivo" solo no le sirve.',
      },
      {
        id: 'whatWeAreNot', label: 'Lo que NO somos', type: 'textarea', required: true, maxLength: 500,
        placeholder: 'Ej: No somos la opción más barata del mercado. No somos una clínica de trámite rápido — nuestro enfoque es diagnóstico profundo.',
        help: 'Delimita las expectativas. Le dice al agente qué promesas NO puede hacer, aunque el cliente presione.',
      },
      {
        id: 'guarantees', label: 'Garantías o compromisos', type: 'textarea', maxLength: 400,
        placeholder: 'Ej: Si el diagnóstico requiere seguimiento, la segunda consulta va sin costo dentro de los primeros 30 días.',
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    key: 'materials',
    num: 7,
    title: 'Materiales para conversaciones',
    icon: 'folder',
    intro: 'El inventario de archivos que el agente puede compartir en una conversación. Etiqueta cada uno para que sepa cuándo entregarlo.',
    isMaterials: true,
    fields: [],
  },
]

export const SECTION_BY_KEY = Object.fromEntries(SECTIONS.map(s => [s.key, s]))

// ── Estado de un campo ──────────────────────────────────────────────────────
// green  → extraído con confianza ≥ 80 (Fase 2)
// yellow → extraído con confianza 50-79, pendiente de confirmar (Fase 2)
// red    → crítico vacío
// gray   → opcional vacío, o lleno manualmente
export const FIELD_STATE = { GREEN: 'green', YELLOW: 'yellow', RED: 'red', GRAY: 'gray', FILLED: 'filled' }

const isBlankScalar = v => v === undefined || v === null || (typeof v === 'string' && !v.trim())

/** ¿El valor de este campo cuenta como lleno según su tipo y sus reglas? */
export function isFieldFilled(field, value, ctx = {}) {
  switch (field.type) {
    case 'table': {
      const rows = Array.isArray(value) ? value : []
      if (field.skippable && ctx.skipped?.[field.id]) return true
      const valid = rows.filter(r => rowHasContent(field, r))
      return valid.length >= (field.minRows || 1)
    }
    case 'group': {
      const v = value || {}
      const req = field.fields.filter(sf => sf.required)
      // Sin sub-campos requeridos, el grupo cuenta solo si tiene algo escrito:
      // `[].every()` es true y marcaría como lleno un grupo vacío.
      if (field.requiredMode === 'atLeastOne' || !req.length) {
        return field.fields.some(sf => !isBlankScalar(v[sf.id]))
      }
      return req.every(sf => !isBlankScalar(v[sf.id]))
    }
    case 'category':
      return !isBlankScalar(value?.main)
    case 'schedule': {
      const v = value || {}
      return Object.values(v).some(loc =>
        WEEKDAYS.some(d => loc?.[d.id]?.open && (loc[d.id].is24h || (loc[d.id].from && loc[d.id].to)))
      )
    }
    case 'agerange':
      return typeof value?.min === 'number' && typeof value?.max === 'number'
    case 'multiselect':
      return Array.isArray(value) && value.length > 0
    case 'checklist': {
      const v = value || {}
      const checked = Object.keys(v).filter(k => v[k]?.checked)
      return checked.length >= (field.minChecked || 1)
    }
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value)
    default:
      return !isBlankScalar(value)
  }
}

/** Una fila cuenta si tiene contenido en al menos una de sus columnas requeridas
 *  (o en cualquier columna, si la tabla no marca ninguna como requerida). */
export function rowHasContent(field, row) {
  if (!row) return false
  const req = field.columns.filter(c => c.required)
  const cols = req.length ? req : field.columns
  return cols.every(c => {
    if (c.type === 'check' || c.type === 'exclusive-check') return true
    return !isBlankScalar(row[c.key])
  }) && cols.some(c => !isBlankScalar(row[c.key]))
}

/** Estado visual de un campo. `extraction` es el mapa de metadata de Fase 2. */
export function fieldState(field, value, ctx = {}) {
  const meta = ctx.extraction?.[`${ctx.sectionKey}.${field.id}`]
  const filled = isFieldFilled(field, value, ctx)
  if (filled && meta && !meta.confirmed) {
    if (meta.confidence >= 80) return FIELD_STATE.GREEN
    if (meta.confidence >= 50) return FIELD_STATE.YELLOW
  }
  if (filled) return FIELD_STATE.FILLED
  return field.required ? FIELD_STATE.RED : FIELD_STATE.GRAY
}

/** Campos críticos vacíos de una sección. */
export function missingCritical(section, sectionData, ctx = {}) {
  if (section.isMaterials) return []
  return section.fields
    .filter(f => f.required && !isFieldFilled(f, sectionData?.[f.id], { ...ctx, skipped: sectionData?._skipped }))
    .map(f => ({ sectionKey: section.key, fieldId: f.id, label: f.label }))
}

/** Campos opcionales vacíos de una sección. */
export function missingOptional(section, sectionData, ctx = {}) {
  if (section.isMaterials) return []
  return section.fields
    .filter(f => !f.required && !isFieldFilled(f, sectionData?.[f.id], ctx))
    .map(f => ({ sectionKey: section.key, fieldId: f.id, label: f.label }))
}

/** Porcentaje de completitud de una sección (críticos pesan doble). */
export function sectionProgress(section, sectionData, ctx = {}) {
  if (section.isMaterials) {
    const mats = ctx.materials || []
    if (!mats.length) return 100
    const tagged = mats.filter(m => m.materialType && m.whenToServe?.length).length
    return Math.round(tagged / mats.length * 100)
  }
  let total = 0, done = 0
  for (const f of section.fields) {
    const w = f.required ? 2 : 1
    total += w
    if (isFieldFilled(f, sectionData?.[f.id], { ...ctx, skipped: sectionData?._skipped })) done += w
  }
  return total === 0 ? 100 : Math.round(done / total * 100)
}

/** Ícono de estado de una sección en el sidebar (§4.5). */
export function sectionStatus(section, sectionData, ctx = {}) {
  if (!ctx.visited?.[section.key]) return 'untouched'
  if (missingCritical(section, sectionData, ctx).length) return 'critical'
  const hasUnconfirmed = section.fields.some(f => {
    const meta = ctx.extraction?.[`${section.key}.${f.id}`]
    return meta && !meta.confirmed && meta.confidence < 80
  })
  if (hasUnconfirmed) return 'review'
  return 'complete'
}

/** Progreso global ponderado por número de campos. */
export function globalProgress(data, ctx = {}) {
  const scored = SECTIONS.filter(s => !s.isMaterials)
  const sum = scored.reduce((acc, s) => acc + sectionProgress(s, data?.[s.key], ctx), 0)
  return Math.round(sum / scored.length)
}

/** Todos los críticos vacíos del perfil. Bloquean el envío (§8.1). */
export function allMissingCritical(data, ctx = {}) {
  return SECTIONS.flatMap(s => missingCritical(s, data?.[s.key], ctx))
}

/** Estructura vacía inicial del perfil. */
export function emptyProfile() {
  const d = {}
  for (const s of SECTIONS) {
    if (s.isMaterials) continue
    d[s.key] = {}
    for (const f of s.fields) {
      if (f.type === 'table') d[s.key][f.id] = f.minRows ? Array.from({ length: f.minRows }, () => emptyRow(f)) : []
      else if (f.type === 'group') d[s.key][f.id] = {}
      else if (f.type === 'category') d[s.key][f.id] = { main: '', sub: '' }
      else if (f.type === 'schedule') d[s.key][f.id] = {}
      else if (f.type === 'multiselect') d[s.key][f.id] = []
      else if (f.type === 'checklist') d[s.key][f.id] = {}
      else if (f.type === 'agerange') d[s.key][f.id] = {}
      else d[s.key][f.id] = ''
    }
  }
  return d
}

export function emptyRow(field) {
  const r = {}
  for (const c of field.columns) r[c.key] = c.default ?? (c.type === 'check' || c.type === 'exclusive-check' ? false : '')
  return r
}

/** Limpia el perfil para el snapshot final: quita filas vacías y campos internos. */
export function buildSnapshot(data, materials) {
  const out = {}
  for (const s of SECTIONS) {
    if (s.isMaterials) continue
    const src = data?.[s.key] || {}
    const dst = {}
    for (const f of s.fields) {
      const v = src[f.id]
      if (f.type === 'table') {
        const rows = (Array.isArray(v) ? v : []).filter(r => rowHasContent(f, r))
        if (rows.length) dst[f.id] = rows
      } else if (f.type === 'checklist') {
        const items = Object.entries(v || {})
          .filter(([, x]) => x?.checked)
          .map(([type, x]) => ({ type, detail: x.detail || '' }))
        if (items.length) dst[f.id] = items
      } else if (isFieldFilled(f, v, { skipped: src._skipped })) {
        dst[f.id] = v
      }
    }
    if (src._skipped) dst._skipped = src._skipped
    out[s.key] = dst
  }
  out.materials = (materials || []).map(m => ({
    fileId: m.fileId, originalName: m.originalName, type: m.type, size: m.size,
    storagePath: m.storagePath, materialType: m.materialType || '',
    whenToServe: m.whenToServe || [], agentDescription: m.agentDescription || '',
    extractedFieldsCount: m.extractedFieldsCount || 0,
  }))
  return out
}
