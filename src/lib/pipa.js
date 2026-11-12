/* PIPA — pasa la idea por aquí.
 *
 * El modelo del marco de producto: cinco fases, cada una nombrada por el
 * resultado que debe existir al terminarla. Vive aparte de la pantalla
 * porque lo necesitan tres cosas distintas —la lista, el detalle y el botón
 * que escribe el embudo en el CRM— y porque la regla de cuándo una etapa
 * está cerrada tiene que ser una sola en toda la aplicación.
 *
 * Lo que no es fase vive fuera de la fila: el ADN y el catálogo de puestos.
 * Tratarlos como etapa obliga a cargarlos a mano en cada vuelta, que fue
 * exactamente el error de la primera versión de esto.
 */

/* ── Los seis criterios del marcador ──────────────────────────────────── */
export const CRITERIOS = [
  { id: 'dolor',          nombre: 'Tamaño del dolor',       pregunta: '¿Es frecuente, intenso y está dispuesto a pagar?' },
  { id: 'diferenciacion', nombre: 'Diferenciación',         pregunta: '¿Somos claramente distintos de las alternativas?' },
  { id: 'encaje',         nombre: 'Encaje con la empresa',  pregunta: '¿Encaja con nuestra marca, clientes y capacidades?' },
  { id: 'ejecucion',      nombre: 'Facilidad de ejecución', pregunta: '¿Podemos lanzar un MVP rápido y con lo que tenemos?' },
  { id: 'potencial',      nombre: 'Potencial económico',    pregunta: '¿El mercado y el margen justifican el esfuerzo?' },
  { id: 'evidencia',      nombre: 'Nivel de evidencia',     pregunta: '¿Cuánto de esto está validado con clientes reales?' },
]

/* Los dos pilares del candado. Si cualquiera saca 2 o menos, lo máximo que
 * puede salir es iterar aunque el total dé 28: es la salvaguarda contra la
 * idea bien argumentada que no tiene un cliente detrás. */
export const CANDADO = ['dolor', 'evidencia']

export const NOMBRE_DECISION = { avanzar: 'Avanzar', iterar: 'Iterar', descartar: 'Descartar' }

/* El total y la decisión.
 *
 * `decision` queda en null mientras falte puntuar algo: media tabla llena da
 * un número que parece veredicto y no lo es.
 *
 * `frenado` y `mordio` son distintos a propósito. El candado está puesto
 * siempre que un pilar saque 2 o menos; solo CAMBIA la decisión cuando el
 * total alcanzaba para avanzar. Decir «el candado te frenó» con 23 puntos es
 * falso —23 ya era iterar— y una herramienta que se atribuye un veredicto
 * que no dio deja de merecer que le crean el resto.
 */
export function marcador(sc = {}) {
  let total = 0
  let completos = 0
  for (const c of CRITERIOS) {
    const v = Number(sc[c.id]) || 0
    total += v
    if (v > 0) completos++
  }
  if (completos < CRITERIOS.length) {
    return { total, completo: false, decision: null, frenado: false, mordio: false }
  }
  const frenado = CANDADO.some(k => Number(sc[k]) <= 2)
  let decision = total >= 24 ? 'avanzar' : total >= 15 ? 'iterar' : 'descartar'
  const mordio = frenado && decision === 'avanzar'
  if (mordio) decision = 'iterar'
  return { total, completo: true, decision, frenado, mordio }
}

/* ── Los eslabones de la pasarela ─────────────────────────────────────────
 * El camino del dinero, de punta a punta. El CRM cierra la fila: el tráfico
 * trae leads y tienen que caer en algún lado contable, porque si no está en
 * el CRM no se puede medir. */
export const ESLABONES = [
  { id: 'producto',    nombre: 'Producto',    detalle: 'Existe y está definido qué incluye' },
  { id: 'stripe',      nombre: 'Stripe',      detalle: 'En el catálogo, con precio y meses sin intereses' },
  { id: 'liga',        nombre: 'Liga de pago', detalle: 'Activa y probada' },
  { id: 'landing',     nombre: 'Landing',     detalle: 'Donde descansa la oferta' },
  { id: 'facturacion', nombre: 'Facturación', detalle: 'Quién factura y por dónde entra' },
  { id: 'indexacion',  nombre: 'Indexación',  detalle: 'Se puede encontrar' },
  { id: 'trafico',     nombre: 'Tráfico',     detalle: 'Segmentación y presupuesto' },
  { id: 'crm',         nombre: 'CRM',         detalle: 'El lead cae en un embudo y se puede medir' },
]

/* Los puestos a los que se despacha. Es el valor por omisión: cada
 * organización lo edita en el ADN, porque las órdenes van dirigidas a un
 * puesto y el sistema tiene que saber cuáles existen en esa casa. */
export const PUESTOS_POR_OMISION = [
  { id: 'diseno',      nombre: 'Diseño' },
  { id: 'audiovisual', nombre: 'Audiovisual' },
  { id: 'web',         nombre: 'Web' },
  { id: 'cobro',       nombre: 'Cobro' },
  { id: 'facturacion', nombre: 'Facturación' },
  { id: 'buscadores',  nombre: 'Buscadores' },
  { id: 'trafico',     nombre: 'Tráfico' },
  { id: 'ventas',      nombre: 'Ventas · CRM' },
]

export const ESTADOS_ORDEN = [
  { id: 'pendiente', nombre: 'Pendiente' },
  { id: 'curso',     nombre: 'En curso' },
  { id: 'hecha',     nombre: 'Hecha' },
]

/* ── Las cinco fases ──────────────────────────────────────────────────────
 * Cada etapa declara sus campos y, sobre todo, cuándo se da por cerrada.
 * Esa regla es la que convierte esto en un expediente que avanza y no en un
 * formulario largo: una fase no termina porque alguien diga que terminó.
 */
export const FASES = [
  {
    id: 'p1', clave: 'P1', nombre: 'Propósito',
    frase: 'Por qué nos sentamos en esta mesa. Ninguna idea arranca por creatividad sola.',
    resultado: 'La ficha de propósito.',
    etapas: [
      {
        id: 'proposito', nombre: 'Propósito',
        campos: [
          { id: 'paraQue', label: 'Para qué lo queremos', tipo: 'texto', filas: 3 },
          { id: 'comoSabremos', label: 'Sabremos que se cumplió si…', tipo: 'texto', filas: 2,
            pista: 'Con esto se califica en P5. Si no se puede escribir hoy, el propósito todavía es un deseo.' },
        ],
        cerrada: d => !!(d.paraQue?.trim() && d.comoSabremos?.trim()),
      },
      {
        id: 'objetivo', nombre: 'Objetivo',
        campos: [
          { id: 'numero', label: 'El número', tipo: 'linea', placeholder: 'Ej: 2,000,000' },
          { id: 'unidad', label: 'Unidad', tipo: 'linea', placeholder: 'pesos · clientes · %' },
          { id: 'fecha', label: 'Fecha límite', tipo: 'fecha',
            pista: 'De aquí sale la fecha de la plenaria de P5.' },
        ],
        cerrada: d => !!(d.numero?.trim() && d.fecha?.trim()),
      },
      {
        id: 'brief', nombre: 'Brief',
        campos: [
          { id: 'queEs', label: 'Qué es', tipo: 'texto', filas: 3 },
          { id: 'paraQuien', label: 'Para quién', tipo: 'texto', filas: 2 },
          { id: 'problema', label: 'Qué problema resuelve', tipo: 'texto', filas: 2 },
          { id: 'porQueAhora', label: 'Por qué ahora', tipo: 'texto', filas: 2 },
          { id: 'evidencia', label: 'Qué evidencia hay', tipo: 'texto', filas: 2 },
        ],
        cerrada: d => ['queEs', 'paraQuien', 'problema', 'porQueAhora'].every(k => d[k]?.trim()),
      },
    ],
  },

  {
    id: 'p2', clave: 'P2', nombre: 'Plan',
    frase: 'Lo que no se delega. Las ideas son nuestras; la máquina es el escribano. Primero el orden, después la creatividad.',
    resultado: 'La pasarela diseñada de punta a punta, el trabajo repartido en órdenes, y el agente configurado.',
    etapas: [
      {
        id: 'perfil', nombre: 'Perfil',
        campos: [
          { id: 'quienDecide', label: 'Quién decide la compra', tipo: 'texto', filas: 2 },
          { id: 'momento', label: 'En qué momento aparece el problema', tipo: 'texto', filas: 2 },
          { id: 'dolor', label: 'El dolor principal, en sus palabras', tipo: 'texto', filas: 3,
            pista: 'Entre comillas y como lo diría el cliente. De aquí sale el scoring del agente.' },
        ],
        cerrada: d => ['quienDecide', 'momento', 'dolor'].every(k => d[k]?.trim()),
      },
      {
        id: 'propuesta', nombre: 'Propuesta',
        campos: [
          { id: 'entregable', label: 'Qué entregamos', tipo: 'texto', filas: 3 },
          { id: 'diferenciacion', label: 'En qué somos distintos, en una frase', tipo: 'texto', filas: 2 },
          { id: 'precio', label: 'Precio', tipo: 'linea' },
          { id: 'costo', label: 'Costo', tipo: 'linea' },
          { id: 'garantia', label: 'Garantía', tipo: 'texto', filas: 2 },
          { id: 'mensaje', label: 'El mensaje y sus tres ganchos', tipo: 'texto', filas: 4 },
          { id: 'queEsCierre', label: 'Qué cuenta como cierre de este producto', tipo: 'texto', filas: 2,
            pista: 'Sin esto P4 no sabe qué contar y el agente no sabe dónde parar. Ej: el onboarding pagado.' },
        ],
        cerrada: d => ['entregable', 'diferenciacion', 'precio', 'queEsCierre'].every(k => String(d[k] ?? '').trim()),
      },
      {
        id: 'pasarela', nombre: 'Pasarela', tipo: 'pasarela',
        cerrada: d => ESLABONES.every(e => d?.[e.id]?.estado === 'listo' || d?.[e.id]?.estado === 'na'),
      },
      {
        id: 'puntaje', nombre: 'Puntaje', tipo: 'puntaje',
        cerrada: d => marcador(d).completo,
      },
      {
        id: 'puestos', nombre: 'Puestos', tipo: 'puestos',
        cerrada: d => Array.isArray(d?.ordenes) && d.ordenes.length > 0,
      },
    ],
  },

  {
    id: 'p3', clave: 'P3', nombre: 'Presencia',
    frase: 'Que el cliente vea la oferta y pueda comprar. Aquí se ejecutan las órdenes de P2, y la evidencia vive en la orden misma.',
    resultado: 'La vitrina cableada. Si un eslabón falla, la fase no termina.',
    etapas: [
      { id: 'piezas', nombre: 'Piezas', tipo: 'ordenes',
        cerrada: (d, idea) => {
          const ordenes = idea?.p2?.puestos?.ordenes || []
          return ordenes.length > 0 && ordenes.every(o => o.estado === 'hecha')
        } },
      {
        id: 'publicacion', nombre: 'Publicación',
        campos: [
          { id: 'notas', label: 'Dónde quedó publicado y con qué código', tipo: 'texto', filas: 3,
            pista: 'El código es lo que viaja con el lead. Publicar por fuera corta el hilo y P5 se queda sin saber qué pieza vendió.' },
        ],
        cerrada: d => !!d.notas?.trim(),
      },
      {
        id: 'prueba', nombre: 'Prueba',
        campos: [
          { id: 'notas', label: 'El camino completo, probado', tipo: 'texto', filas: 3,
            pista: 'Palabra clave, WhatsApp, respuesta y liga de pago. De punta a punta.' },
        ],
        cerrada: d => !!d.notas?.trim(),
      },
    ],
  },

  {
    id: 'p4', clave: 'P4', nombre: 'Pedido',
    frase: 'Va al equipo de venta y a sus líderes. Marca la actividad concreta y si se está haciendo.',
    resultado: 'Cobrado y en marcha.',
    etapas: [
      {
        id: 'prospecto', nombre: 'Prospecto',
        campos: [
          { id: 'cuantos', label: 'Prospectos llegados desde este origen', tipo: 'linea' },
          { id: 'nota', label: 'Nota', tipo: 'texto', filas: 2 },
        ],
        cerrada: d => !!String(d.cuantos ?? '').trim(),
      },
      {
        id: 'pacto', nombre: 'Pacto',
        campos: [
          { id: 'cuantos', label: 'Cierres, como se definió en P2', tipo: 'linea' },
          { id: 'nota', label: 'Nota', tipo: 'texto', filas: 2 },
        ],
        cerrada: d => !!String(d.cuantos ?? '').trim(),
      },
      {
        id: 'puestaEnMarcha', nombre: 'Puesta en marcha',
        campos: [
          { id: 'nota', label: 'Qué se entregó y cuándo', tipo: 'texto', filas: 3,
            pista: 'No siempre coincide con el pacto. Para FlowHub: capacitar, entrenar al equipo y dejar el CRM definido.' },
        ],
        cerrada: d => !!d.nota?.trim(),
      },
    ],
  },

  {
    id: 'p5', clave: 'P5', nombre: 'Progreso',
    frase: 'La última reunión sobre esta idea. Se califica lo prometido, se abre el micrófono y lo aprendido vuelve al ADN.',
    resultado: 'El documento del ciclo, y el ADN actualizado.',
    etapas: [
      {
        id: 'promesa', nombre: 'Promesa', tipo: 'promesa',
        cerrada: d => d?.numero === true || d?.numero === false,
      },
      {
        id: 'plenaria', nombre: 'Plenaria',
        campos: [
          { id: 'dolio', label: 'Qué nos dolió', tipo: 'texto', filas: 3 },
          { id: 'distinto', label: 'Qué hicimos distinto sobre la marcha', tipo: 'texto', filas: 3 },
          { id: 'creimos', label: 'Qué creíamos que funcionaría y no funcionó', tipo: 'texto', filas: 3 },
          { id: 'procesos', label: 'Qué procesos no estaban establecidos', tipo: 'texto', filas: 3 },
        ],
        cerrada: d => ['dolio', 'distinto', 'creimos', 'procesos'].some(k => d[k]?.trim()),
      },
      {
        id: 'precedente', nombre: 'Precedente',
        campos: [
          { id: 'alAdn', label: 'Lo que sube al ADN', tipo: 'texto', filas: 4,
            pista: 'Destilado. El documento completo se queda aquí; al ADN sube solo lo que sirve para la próxima, o en seis vueltas nadie lo lee y encima ensucia el contexto del agente.' },
        ],
        cerrada: d => !!d.alAdn?.trim(),
      },
    ],
  },
]

export const FASE_POR_ID = Object.fromEntries(FASES.map(f => [f.id, f]))

/** ¿Está cerrada esta etapa? Centralizado para que la lista, el detalle y el
 *  avance de fase respondan lo mismo. */
export function etapaCerrada(fase, etapa, idea) {
  const datos = idea?.[fase.id]?.[etapa.id] || {}
  try { return !!etapa.cerrada(datos, idea) } catch { return false }
}

/** Cuántas etapas de la fase están cerradas, y si la fase entera lo está. */
export function avanceDeFase(fase, idea) {
  const hechas = fase.etapas.filter(e => etapaCerrada(fase, e, idea)).length
  return { hechas, total: fase.etapas.length, completa: hechas === fase.etapas.length }
}

/** La fase en la que realmente está la idea: la primera sin terminar. */
export function faseActual(idea) {
  for (const f of FASES) {
    if (!avanceDeFase(f, idea).completa) return f
  }
  return FASES[FASES.length - 1]
}

/* ── La bifurcación del CRM ───────────────────────────────────────────────
 * La pregunta que decide la rama es una sola: ¿el proceso de venta es
 * distinto al de lo que ya vendemos? Si se vende igual, es un producto y el
 * embudo ya existe. Si se vende distinto, es una unidad de negocio y hay que
 * crear el embudo entero. */
export const RAMAS = [
  { id: 'producto', nombre: 'Es un producto',
    detalle: 'Se vende igual que lo que ya vendemos. El embudo existe: va al catálogo y se amplía el conocimiento del agente.' },
  { id: 'unidad', nombre: 'Es una unidad de negocio',
    detalle: 'El proceso de venta es distinto. Se crea el embudo entero y el conocimiento del agente nace de cero.' },
]

/* Las etapas con las que nace un embudo creado desde PIPA. Son las mismas
 * cuatro de siempre, con sus rangos de score, para que el agente pueda
 * colocar al lead desde el primer mensaje. */
export const ETAPAS_NUEVO_EMBUDO = [
  { name: 'Nuevo',       color: '#64748b', scoreMin: 0,  scoreMax: 25 },
  { name: 'En contacto', color: '#3b82f6', scoreMin: 26, scoreMax: 50 },
  { name: 'Calificado',  color: '#22c55e', scoreMin: 51, scoreMax: 75 },
  { name: 'Cerrado',     color: '#6366f1', scoreMin: 76, scoreMax: 100 },
]

/* El texto que se cuelga del agente para ese embudo.
 *
 * Se arma de lo que el equipo ya escribió en P2, y no se vuelve a teclear:
 * ahí es donde hoy el precio queda viejo y la garantía termina distinta de
 * la que dice la landing. Saliendo de la misma fuente, no hay dos versiones
 * que puedan separarse. El ADN va por debajo y lo pone el propio agente.
 */
export function instruccionesDelAgente(idea) {
  const p = idea?.p2?.propuesta || {}
  const perfil = idea?.p2?.perfil || {}
  const l = []
  l.push(`Vendes: ${p.entregable || '—'}`)
  l.push('')
  l.push(`A quién: ${perfil.quienDecide || '—'}.`)
  if (perfil.momento) l.push(`Suele escribir cuando ${perfil.momento}`)
  if (perfil.dolor) l.push(`Lo que le duele, en sus palabras: ${perfil.dolor}`)
  l.push('')
  if (p.precio) l.push(`Precio: ${p.precio}`)
  if (p.garantia) l.push(`Garantía: ${p.garantia}`)
  if (p.diferenciacion) l.push(`En qué somos distintos: ${p.diferenciacion}`)
  l.push('')
  if (p.mensaje) { l.push('Cómo lo contamos:'); l.push(p.mensaje); l.push('') }
  l.push(`Hasta dónde llegas: tu trabajo termina cuando ${p.queEsCierre || 'una persona toma la conversación'}. A partir de ahí entrega la conversación.`)
  return l.join('\n')
}

/** Para quién es el embudo, en una frase. La lee el conmutador cuando una
 *  misma cuenta atiende varios embudos. */
export function descripcionDelEmbudo(idea) {
  const perfil = idea?.p2?.perfil || {}
  return [perfil.quienDecide, perfil.momento].filter(Boolean).join(', que ').trim()
}

/** Una idea nueva, vacía. Las cinco fases ya existen para que nada tenga que
 *  comprobar si el objeto está o no está. */
export function ideaVacia(autor = '') {
  return {
    titulo: '',
    autor,
    archivada: false,
    pipelineId: null,
    p1: {}, p2: {}, p3: {}, p4: {}, p5: {},
  }
}
