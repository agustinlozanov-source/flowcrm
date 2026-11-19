/* Lo que dijeron las conversaciones, contado.
 *
 * El modelo lee cada conversación una vez y deja una ficha: qué preguntó el
 * cliente, qué objeción puso, cuándo salió el precio, dónde se cayó. Aquí no
 * hay modelo: se cuentan esas fichas y se cruzan con lo que pasó después
 * —si el lead avanzó o no—, para que el número sea exacto y se pueda
 * comparar mes contra mes.
 */

const CATEGORIAS_PREGUNTA = [
  'precio', 'formas_de_pago', 'disponibilidad_horarios', 'ubicacion',
  'requisitos_preparacion', 'detalle_del_servicio', 'resultados_y_tiempos',
  'confianza_credenciales', 'seguros_facturacion', 'promociones', 'otro',
]
const CATEGORIAS_OBJECION = [
  'precio_alto', 'no_es_buen_momento', 'consultar_con_alguien', 'desconfianza',
  'distancia_ubicacion', 'horario_no_conviene', 'prefiere_competencia', 'solo_comparando', 'otro',
]
const MOMENTOS_PRECIO = ['antes_de_ofrecer_cita', 'despues_de_ofrecer_cita', 'no_se_hablo']
const CAIDAS = ['no_se_cayo', 'tras_recibir_precio', 'tras_ofrecer_cita', 'tras_pedir_datos', 'esperando_nuestra_respuesta', 'otro']

const NOMBRES = {
  precio: 'Precio', formas_de_pago: 'Formas de pago', disponibilidad_horarios: 'Horarios y disponibilidad',
  ubicacion: 'Ubicación', requisitos_preparacion: 'Requisitos y preparación', detalle_del_servicio: 'Cómo es el servicio',
  resultados_y_tiempos: 'Resultados y tiempos', confianza_credenciales: 'Confianza y credenciales',
  seguros_facturacion: 'Seguros y facturación', promociones: 'Promociones', otro: 'Otros temas',
  precio_alto: 'El precio le parece alto', no_es_buen_momento: 'No es buen momento',
  consultar_con_alguien: 'Lo tiene que consultar', desconfianza: 'Desconfianza', distancia_ubicacion: 'Le queda lejos',
  horario_no_conviene: 'El horario no le conviene', prefiere_competencia: 'Prefiere a otro', solo_comparando: 'Solo está comparando',
  antes_de_ofrecer_cita: 'Antes de ofrecer la cita', despues_de_ofrecer_cita: 'Después de ofrecer la cita', no_se_hablo: 'No se habló de precio',
  no_se_cayo: 'No se cayó', tras_recibir_precio: 'Después de recibir el precio', tras_ofrecer_cita: 'Después de ofrecerle la cita',
  tras_pedir_datos: 'Después de pedirle sus datos', esperando_nuestra_respuesta: 'Se quedó esperando nuestra respuesta',
}
const nombreDe = (id) => NOMBRES[id] || id

const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null)

/* ── Palabras ───────────────────────────────────────────────────────── */

const VACIAS = new Set(`
a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque bien bueno buenas buenos buen cada casi
como con contra cual cuales cuando cuanto de del desde donde dos el ella ellas ellos en entre era eran eres es esa esas
ese eso esos esta estaba estado estan estar este esto estos estoy fue fueron gracias ha habia hace hacer hay he hola
la las le les lo los mas me mi mis mucho muy nada ni no nos nosotros o ok okay otra otro otros para pero poco por porque
pues que quien se sea ser si sido sin sobre solo son su sus tal tambien tan tanto te tengo tiene tienen todo todos tu tus
un una uno unos usted ustedes va vamos voy y ya yo dia dias buen buenas noches tardes
`.split(/\s+/).filter(Boolean))

const plano = (t) => String(t || '').toLowerCase()
  .replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ')

/* Las palabras de pregunta se quitan de la nube, donde no dicen nada solas,
 * pero se quedan en las frases: «cuánto cuesta», «dónde están», «a qué hora»
 * son justo las frases que más importan, y sin la primera palabra se vuelven
 * «cuesta» o «hora». */
const DE_PREGUNTA = new Set(['cuanto', 'cuanta', 'cuantos', 'cuantas', 'cuando', 'donde', 'como', 'que', 'cual', 'cuales', 'quien'])

/* Solo palabras de letras: lo que trae dígitos —teléfonos, fechas, montos,
 * folios— se descarta, que es también la forma más simple de no sacar datos
 * personales a la nube de palabras. */
function palabras(texto, { paraFrases = false } = {}) {
  return plano(texto).split(/[^a-zñ]+/).filter(p =>
    p.length >= 3 && (!VACIAS.has(p) || (paraFrases && DE_PREGUNTA.has(p))))
}

function frases(lista, n) {
  const r = []
  for (let i = 0; i + n <= lista.length; i++) r.push(lista.slice(i, i + n).join(' '))
  return r
}

/* La nube y el vocabulario de los que avanzan.
 *
 * Cada frase cuenta una vez por persona: alguien que repite «cuánto cuesta»
 * seis veces no pesa seis veces más que seis personas que lo preguntan una.
 * Para comparar, se toma la proporción de personas de cada grupo que la usó,
 * y se exige un mínimo de tres para que una coincidencia no parezca patrón. */
function vocabulario(fichas) {
  const nube = new Map()
  const grupos = { avanzo: new Map(), noAvanzo: new Map() }
  const tam = { avanzo: 0, noAvanzo: 0 }

  for (const f of fichas) {
    if (!f.textoCliente) continue
    const ps = palabras(f.textoCliente)
    for (const p of new Set(ps)) nube.set(p, (nube.get(p) || 0) + 1)
    const g = f.avanzo ? 'avanzo' : 'noAvanzo'
    tam[g]++
    const pf = palabras(f.textoCliente, { paraFrases: true })
    for (const fr of new Set([...frases(pf, 2), ...frases(pf, 3)])) {
      grupos[g].set(fr, (grupos[g].get(fr) || 0) + 1)
    }
  }

  const distintivas = (de, contra) => {
    const r = []
    for (const [frase, n] of grupos[de]) {
      if (n < 3) continue
      const propia = n / Math.max(tam[de], 1)
      const otra = (grupos[contra].get(frase) || 0) / Math.max(tam[contra], 1)
      /* Se guarda el porcentaje de cada grupo, para mostrar «40% contra 5%».
         El cociente solo ordena: como número suelto no le dice nada a quien
         lee, y con un grupo en cero se dispara. */
      r.push({
        frase, personas: n, porcentaje: pct(n, tam[de]),
        porcentajeOtro: pct(grupos[contra].get(frase) || 0, tam[contra]) ?? 0,
        orden: (propia + 0.01) / (otra + 0.01),
      })
    }
    return r.sort((a, b) => b.orden - a.orden || b.personas - a.personas).slice(0, 15).map(({ orden: _o, ...x }) => x)
  }

  return {
    personas: tam,
    nube: [...nube.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([palabra, n]) => ({ palabra, n })),
    frasesDeLosQueAvanzan: distintivas('avanzo', 'noAvanzo'),
    frasesDeLosQueNo: distintivas('noAvanzo', 'avanzo'),
  }
}

/* ── Las fichas, contadas ───────────────────────────────────────────── */

function ejemplos(lista, max) {
  const vistos = new Set()
  const r = []
  for (const t of lista) {
    const k = plano(t).trim()
    if (!k || vistos.has(k)) continue
    vistos.add(k)
    r.push(t)
    if (r.length >= max) break
  }
  return r
}

/** `fichas`: [{ leadId, avanzo, compro, extraccion: {...} | null, textoCliente }] */
function resumirFichas(fichas) {
  const leidas = fichas.filter(f => f.extraccion)
  const tasaGeneral = pct(leidas.filter(f => f.avanzo).length, leidas.length)

  /* Preguntas: cuánta gente preguntó por cada tema, y cuántas de esas
     preguntas se quedaron sin una respuesta clara. */
  const preguntas = CATEGORIAS_PREGUNTA.map(cat => {
    const quienes = leidas.filter(f => (f.extraccion.preguntas || []).some(p => p.categoria === cat))
    const todas = leidas.flatMap(f => (f.extraccion.preguntas || []).filter(p => p.categoria === cat))
    const sin = todas.filter(p => !p.respondida)
    return {
      id: cat, nombre: nombreDe(cat), personas: quienes.length, preguntas: todas.length,
      sinRespuesta: sin.length, porcentajeSinRespuesta: pct(sin.length, todas.length),
      ejemplos: ejemplos(todas.map(p => p.texto), 6), ejemplosSinRespuesta: ejemplos(sin.map(p => p.texto), 8),
    }
  }).filter(p => p.preguntas > 0).sort((a, b) => b.personas - a.personas)

  /* Objeciones: la más frecuente casi nunca es la que más ventas cuesta. El
     impacto estima cuántos avances se pierden: cuánta gente la puso, por
     cuánto queda su tasa debajo de la de todos. */
  const objeciones = CATEGORIAS_OBJECION.map(cat => {
    const quienes = leidas.filter(f => (f.extraccion.objeciones || []).some(o => o.categoria === cat))
    const tasa = pct(quienes.filter(f => f.avanzo).length, quienes.length)
    const brecha = tasa == null || tasaGeneral == null ? 0 : Math.max(0, tasaGeneral - tasa)
    return {
      id: cat, nombre: nombreDe(cat), personas: quienes.length, tasaAvance: tasa,
      impacto: Math.round(quienes.length * brecha) / 100,
      ejemplos: ejemplos(quienes.flatMap(f => (f.extraccion.objeciones || []).filter(o => o.categoria === cat).map(o => o.texto)), 6),
    }
  }).filter(o => o.personas > 0)

  const porValor = (campo, valores) => valores.map(v => {
    const g = leidas.filter(f => f.extraccion[campo] === v)
    return { id: v, nombre: nombreDe(v), personas: g.length, tasaAvance: pct(g.filter(f => f.avanzo).length, g.length) }
  }).filter(x => x.personas > 0)

  const competencia = new Map()
  for (const f of leidas) {
    for (const c of new Set((f.extraccion.competencia || []).map(x => String(x).trim()).filter(Boolean))) {
      const k = plano(c)
      const prev = competencia.get(k)
      competencia.set(k, { nombre: prev?.nombre || c, personas: (prev?.personas || 0) + 1 })
    }
  }

  const promesas = leidas.flatMap(f => f.extraccion.promesas_indebidas || [])

  return {
    conversaciones: fichas.length,
    leidas: leidas.length,
    tasaAvanceGeneral: tasaGeneral,
    preguntas,
    sinRespuesta: [...preguntas].filter(p => p.sinRespuesta > 0).sort((a, b) => b.sinRespuesta - a.sinRespuesta),
    objeciones: [...objeciones].sort((a, b) => b.personas - a.personas),
    /* Solo si de verdad resta: una objeción cuya gente avanza igual o más que
       el promedio no le cuesta nada al negocio, aunque sea la única. */
    objecionQueMasCuesta: [...objeciones].filter(o => o.impacto > 0).sort((a, b) => b.impacto - a.impacto)[0] || null,
    momentoDelPrecio: porValor('precio', MOMENTOS_PRECIO),
    caidas: porValor('caida', CAIDAS).sort((a, b) => b.personas - a.personas),
    urgencia: porValor('urgencia', ['alta', 'media', 'baja']),
    sentimiento: porValor('sentimiento', ['positivo', 'neutral', 'negativo']),
    competencia: [...competencia.values()].sort((a, b) => b.personas - a.personas).slice(0, 15),
    promesasIndebidas: { total: promesas.length, ejemplos: ejemplos(promesas, 8) },
    /* Lo que no cupo en ninguna categoría: el reporte lo agrupa y propone
       categorías nuevas para el mes que sigue. */
    sinCategoria: ejemplos(leidas.flatMap(f => [
      ...(f.extraccion.preguntas || []).filter(p => p.categoria === 'otro').map(p => p.texto),
      ...(f.extraccion.objeciones || []).filter(o => o.categoria === 'otro').map(o => o.texto),
    ]), 40),
    vocabulario: vocabulario(fichas),
  }
}

module.exports = {
  CATEGORIAS_PREGUNTA, CATEGORIAS_OBJECION, MOMENTOS_PRECIO, CAIDAS, NOMBRES, nombreDe,
  resumirFichas, vocabulario, palabras,
}
