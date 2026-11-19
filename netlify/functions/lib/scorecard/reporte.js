/* El reporte del periodo: la lectura que hace el Gerente de resultados.
 *
 * El modelo recibe los números ya calculados y las fichas ya contadas, y
 * escribe dentro de una estructura fija: siempre las mismas secciones, en el
 * mismo orden. Así, al tercer mes, quien lo lee ya sabe dónde mirar, y la
 * presentación se arma igual cada vez.
 *
 * El modelo no recibe nombres de personas: las bolsas de rescate le llegan
 * solo como conteos. La lista con nombres vive en la pantalla, no en lo que se
 * le manda a leer.
 *
 * Es el modelo más capaz disponible, a propósito: es una sola llamada por
 * corrida, y de esta lectura sale el plan del mes.
 */
const Anthropic = require('@anthropic-ai/sdk')
const { BOLSAS } = require('./calculo')

const MODELO = process.env.ANTHROPIC_MODEL_SCORECARD || 'claude-fable-5-2'

let cliente = null
const anthropic = () => (cliente ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))

const objeto = (props) => ({
  type: 'object', additionalProperties: false, required: Object.keys(props), properties: props,
})
const texto = (description) => ({ type: 'string', description })
const lista = (items, description) => ({ type: 'array', items, ...(description ? { description } : {}) })

const RESPONSABLES = ['atraccion', 'atencion', 'agenda_y_asistencia', 'cierre', 'oferta']

const ESQUEMA = objeto({
  titular: texto('Una frase que resume el periodo. Concreta, con el número que más importa.'),
  resumen: texto('Tres o cuatro oraciones: qué pasó, qué lo explica y qué sigue.'),
  cuello_de_botella: objeto({
    paso: texto('El paso del embudo donde mejorar vale más.'),
    por_que: texto('Por qué es ese y no otro, con los números.'),
    impacto: texto('Qué ganaría el negocio si ese paso mejora, en clientes o en dinero, con el cálculo a la vista.'),
  }),
  calidad_del_dato: texto('Cuánto se puede confiar en estos números y qué hay que arreglar en los datos.'),
  capitulos: lista(objeto({
    responsable: { type: 'string', enum: RESPONSABLES },
    hallazgo: texto('Lo más importante de este capítulo, con su número.'),
    causa_probable: texto('La explicación más probable. Si es una hipótesis, dilo.'),
    rescate: texto('Qué hacer esta semana con las personas que ya se están perdiendo.'),
    correccion: texto('Qué cambiar en el proceso para que el próximo periodo no se repita.'),
    indicador: texto('El indicador que tiene que moverse.'),
    meta: texto('A dónde tiene que llegar ese indicador el próximo periodo.'),
  }), 'Exactamente cinco, uno por responsable y en este orden: atraccion, atencion, agenda_y_asistencia, cierre, oferta.'),
  clientes: objeto({
    lectura: texto('Qué dijeron los clientes en sus conversaciones, y qué significa para el negocio.'),
    preguntas_clave: lista({ type: 'string' }, 'Las preguntas que el negocio tiene que saber contestar mejor.'),
    objecion_principal: texto('La objeción que más avances cuesta, y cómo responderla.'),
  }),
  reloj: texto('Qué dicen los horarios: cuándo llega la gente, cuándo se le atiende tarde, cuándo se pierde.'),
  rescate: lista(objeto({
    bolsa: { type: 'string', enum: BOLSAS.map(b => b.id) },
    prioridad: { type: 'integer' },
    por_que: texto('Por qué esta bolsa va en este lugar.'),
    que_decir: texto('Qué decirles al contactarlos, en dos o tres líneas.'),
  }), 'Solo las bolsas que tienen personas, ordenadas por prioridad.'),
  plan_anterior: texto('Cómo le fue al plan del periodo anterior y a sus bolsas de rescate. Si no hay periodo anterior, dilo en una frase.'),
  plan: objeto({
    metas: lista(objeto({ indicador: texto(''), hoy: texto(''), meta: texto('') }), 'De tres a cinco metas.'),
    semanas: lista(objeto({
      semana: texto('Semana 1, Semana 2…'),
      acciones: lista(objeto({ accion: texto(''), responsable: { type: 'string', enum: RESPONSABLES } })),
    }), 'Cuatro semanas.'),
  }),
  lecciones_agente: lista(objeto({
    leccion: texto('Una instrucción para el agente, en segunda persona.'),
    por_que: texto('El dato que la justifica.'),
    indicador: texto('El indicador que debería mejorar si la lección funciona.'),
  }), 'De tres a ocho lecciones para el agente de IA.'),
  categorias_propuestas: lista(objeto({
    nombre: texto(''),
    ejemplos: lista({ type: 'string' }),
  }), 'Temas que se repiten en lo que no cupo en ninguna categoría. Vacío si no hay.'),
  advertencias: lista({ type: 'string' }, 'Lo que el lector tiene que saber antes de tomar decisiones con este reporte.'),
})

const SISTEMA = `Eres el Gerente de resultados de un negocio que vende por WhatsApp con FlowHub. Recibes los números de un periodo, ya calculados, y lo que dijeron las conversaciones, ya contado. Escribes la lectura del periodo y el plan para el siguiente.

Cómo trabajas:
- Usas solo los números que vienen en los datos y los citas tal cual. No calculas porcentajes nuevos salvo que muestres la cuenta, y nunca inventas una cifra.
- Si la confianza en los datos es baja o media, lo dices primero y no sacas conclusiones fuertes de los números afectados.
- Separas lo que se sabe de lo que se supone. Una causa que no se puede probar con los datos se escribe como hipótesis.
- Cada hallazgo termina en una acción concreta con un responsable. Nada de «mejorar la comunicación».
- Hay dos tipos de acción: el rescate, que recupera a las personas que ya se están perdiendo, y la corrección, que cambia el proceso para que no se repita.
- Los responsables son cinco: atraccion (marketing o la agencia), atencion (el agente de IA y quien lo entrena), agenda_y_asistencia (recepción o quien agenda), cierre (ventas) y oferta (dirección: precio, producto, competencia).
- Las lecciones para el agente nunca mencionan precios, descuentos, promociones ni promesas: eso lo deciden el catálogo y la dirección. Si los datos piden un cambio de precio, va en el capítulo de oferta, no en una lección.
- Escribes en español de México, de tú, claro y directo, como le hablarías al dueño del negocio. Frases cortas. Sin jerga de consultoría.
- No uses la construcción «no es X, es Y» ni sus variantes.
- Cada texto, corto: dos o tres oraciones como máximo. El reporte completo se tiene que poder leer en cinco minutos.`

/** Los datos que lee el modelo: todo lo calculado, menos los nombres. */
function paraElModelo({ organizacion, metricas, insights, anterior }) {
  const { bolsasIds, ...resto } = metricas
  return {
    organizacion,
    ...resto,
    bolsas: (metricas.bolsas || []).map(({ lista: _lista, ...b }) => b),
    conversaciones: insights,
    periodoAnterior: anterior
      ? { periodo: anterior.periodo, plan: anterior.plan || null, recuperados: metricas.recuperados }
      : null,
  }
}

/* Escribe el reporte. Lanza si algo sale mal, con un mensaje que se puede
 * mostrar tal cual en la pantalla. */
/* `esfuerzo` empieza en medio. Este modelo piensa antes de escribir, y lo
 * pensado cuenta contra el mismo tope de tokens: en alto, con todos los datos
 * de un periodo, una corrida real se quedó sin espacio antes de terminar. Si
 * aun así no alcanza, la corrida reintenta sola con esfuerzo bajo. */
async function escribirReporte(entrada, { esfuerzo = 'medium' } = {}) {
  const datos = paraElModelo(entrada)
  /* Respaldo en el servidor: si el modelo principal se niega por una regla de
     seguridad, la API reintenta sola con otro modelo dentro de la misma
     llamada. Es la forma recomendada para este modelo. */
  const stream = anthropic().beta.messages.stream({
    model: MODELO,
    max_tokens: 48000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SISTEMA,
    messages: [{
      role: 'user',
      content: `Estos son los datos del periodo, en JSON:\n\n${JSON.stringify(datos)}\n\nEscribe el reporte.`,
    }],
    output_config: { effort: esfuerzo, format: { type: 'json_schema', schema: ESQUEMA } },
  })
  const r = await stream.finalMessage()

  if (r.stop_reason === 'refusal') {
    throw new Error('El modelo no quiso escribir el reporte. Revisa que los datos no traigan contenido sensible.')
  }
  if (r.stop_reason === 'max_tokens') {
    const e = new Error('El reporte quedó incompleto: se acabó el espacio de escritura.')
    e.codigo = 'INCOMPLETO'
    throw e
  }
  const t = r.content.find(b => b.type === 'text')?.text
  if (!t) throw new Error('El modelo respondió sin reporte.')
  return { reporte: JSON.parse(t), modelo: r.model || MODELO, tokens: r.usage || null }
}

module.exports = { escribirReporte, paraElModelo, ESQUEMA, MODELO, RESPONSABLES }
