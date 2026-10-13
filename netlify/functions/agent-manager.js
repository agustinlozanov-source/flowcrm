const Anthropic = require('@anthropic-ai/sdk')
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = admin.firestore()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── BUILD SYSTEM PROMPT ───────────────────────────────────────────
function buildSystemPrompt(config, ragContent, products, scoringConfig, leadContext, resources, allPipelines = [], resolvedPipelineId = null, agenda = {}) {
  const {
    agentName = 'Asistente',
    customInstructions = '',
  } = config

  // Products section
  // Sin la fecha de hoy el agente no puede traducir "el lunes" ni "mañana" a
  // una fecha concreta, así que no puede consultar ni agendar nada.
  const tz = agenda.tz || 'America/Mexico_City'
  const hoy = new Intl.DateTimeFormat('es-MX', {
    timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date())
  const hoyISO = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())

  const agendaSection = `
AGENDA:
Hoy es ${hoy} (${hoyISO}), zona horaria ${tz}.
- Si el lead quiere una cita, consultá la agenda ANTES de ofrecer cualquier horario. Nunca inventes disponibilidad ni prometas un horario sin haberlo verificado.
- Si pide un horario puntual, fijate si está libre. Si no lo está, decíselo y ofrecé los que sí, sin rodeos.
- Si muestra intención pero no da día ni hora, proponé vos dos o tres opciones concretas de los huecos libres. No preguntes "¿cuándo te queda cómodo?" y lo dejes ahí.
- Cuando quede acordado, agendala. No digas que la agendaste si no usaste la herramienta.
- El tipo de cita es presencial si el lead viene a la sede, video si es videollamada y call si es telefónica. Ante la duda, preguntá.

OPORTUNIDADES:
En cada respuesta tenés que llenar el campo "oportunidades" con los productos del catálogo que apliquen a este lead. Si no aplica ninguno, mandá la lista vacía. No lo omitas.
- Apenas el lead cuenta para qué viene, ya hay al menos una. Si mencionaste un producto por nombre o por precio en tu respuesta, esa oportunidad va en la lista.
- Distinguí bien las dos clases. La "real" es la de entrada: la consulta, la valoración, la cita que se va a agendar — lo concreto que está por pasar. La "potencial" es lo que se deduce de lo que contó y vendría después: el tratamiento, la cirugía, el estudio de especialidad.
- Ejemplo: alguien dice que quiere operarse la vista. Son dos: la consulta de valoración es real, y el estudio o la cirugía que necesita es potencial.
- El precio y el nombre salen del catálogo. No los inventes ni los negocies.
- No repitas las que ya registraste en mensajes anteriores de esta conversación.
- Es trabajo interno: no se lo anuncies al lead.`

  const productsSection = products.length > 0
    ? `\nPRODUCTOS QUE MANEJO (usá el id tal cual para oportunidades y productos detectados):\n${products.map(p =>
        `- [id: ${p.id}] ${p.name} · $${Number(p.price).toLocaleString()} ${p.currency || 'USD'}${p.durationDays ? ` · Dura ${p.durationDays} días` : ''}${p.problemTags?.length ? ` · Resuelve: ${p.problemTags.join(', ')}` : ''}`
      ).join('\n')}`
    : '\nNo tenés catálogo de productos cargado, así que mandá la lista de oportunidades vacía.'

  // Scoring instructions — supports array format (categories/subcategories/signals) and legacy object format
  const isArrayScoring = Array.isArray(scoringConfig)
  const hasScoring = isArrayScoring ? scoringConfig.length > 0 : (scoringConfig && Object.keys(scoringConfig).length > 0)
  const scoringSection = hasScoring
    ? `\nSISTEMA DE SCORING ACTIVO:
Mientras conversas, evalúa silenciosamente al lead.
Después de CADA respuesta, indica en el JSON interno qué señales se activaron.

${isArrayScoring
  ? scoringConfig.map(cat => {
      const signals = (cat.subcategories || []).flatMap(sub => sub.signals || [])
      return `${cat.label.toUpperCase()} (tope: ${cat.tope} pts)${cat.desc ? ` — ${cat.desc}` : ''}\n` +
        signals.slice(0, 8).map(s => `  · ${s.text} → ${s.weight >= 0 ? '+' : ''}${s.weight} pts`).join('\n')
    }).join('\n\n')
  : Object.entries(scoringConfig).map(([catId, cat]) => {
      const catLabel = { necesidad: 'NECESIDAD', capacidad: 'CAPACIDAD', intencion: 'INTENCIÓN', confianza: 'CONFIANZA' }[catId] || catId
      const allSignals = []
      if (cat.subcategories) {
        Object.values(cat.subcategories).forEach(sub => {
          if (sub.signals) {
            Object.entries(sub.signals).forEach(([sigId, sigConfig]) => {
              if (sigConfig.enabled) allSignals.push({ sigId, pts: sigConfig.pts })
            })
          }
          if (sub.customSignals) {
            sub.customSignals.forEach(cs => allSignals.push({ text: cs.text, pts: cs.pts }))
          }
        })
      }
      return `${catLabel} (tope: ${cat.cap} pts)\n${allSignals.slice(0, 5).map(s => `  · ${s.text || s.sigId} → ${s.pts} pts`).join('\n')}`
    }).join('\n\n')
}`
    : ''

  // Lead context
  const leadSection = leadContext
    ? `\nCONTEXTO DEL LEAD ACTUAL:
${leadContext.name ? `- Se llama ${leadContext.name} — úsalo al dirigirte a él o ella.` : '- Todavía no sabes su nombre; puedes preguntárselo con naturalidad.'}
- Score actual: ${leadContext.score || 0}/100
- Etapa actual: ${leadContext.stageName || 'Sin etapa'}
- Pipeline: ${leadContext.pipelineName || 'Sin pipeline'}
- Umbral para avanzar: score ${leadContext.stageScoreMax || 100}
- Perfil B detectado: ${leadContext.profileB ? 'SÍ' : 'No'}
${leadContext.productId ? `- Producto de interés: ${leadContext.productName || leadContext.productId}` : ''}`
    : ''

  // Resources available for sharing
  const resourcesSection = resources?.length > 0
    ? `\nRECURSOS DISPONIBLES PARA COMPARTIR:
Sigue ESTRICTAMENTE la instrucción de cuándo compartir cada uno.
- Los de tipo ENLACE se comparten escribiendo su URL dentro de "response". Nunca inventes URLs: usa exactamente la que está aquí.
- Los de tipo ARCHIVO, IMAGEN y VIDEO se envían como adjunto. NO escribas su URL ni la menciones en "response": agrega su id al arreglo "shareResources" y el sistema lo adjunta solo. En el texto anúncialo con naturalidad ("te paso la guía").
${resources.map(r =>
        r.type === 'enlace'
          ? `- [ENLACE] "${r.name}"${r.whenToShare ? ` → Compartir cuando: ${r.whenToShare}` : ''}. URL: ${r.url}`
          : `- [${r.type.toUpperCase()}] "${r.name}" (id: ${r.id})${r.whenToShare ? ` → Compartir cuando: ${r.whenToShare}` : ''}`
      ).join('\n')}`
    : ''

  // Routing section — when no pipeline identified yet
  const routingSection = (!resolvedPipelineId && allPipelines.length > 0)
    ? `\nROUTING — IDENTIFICACIÓN DEL FLUJO:\nEste lead aún no tiene un flujo de ventas asignado. Tu primera tarea es identificarlo con 1-2 preguntas naturales sobre su situación o interés. NO menciones los nombres técnicos de los flujos al lead.\n\nFlujos disponibles (solo para tu referencia interna):\n${allPipelines.map(p => `  • ${p.name}${p.purpose ? ` — ${p.purpose}` : ''} [ID: ${p.id}]`).join('\n')}\n\nCuando identifiques el flujo, incluye en el JSON: "detectedPipelineId": "id_aqui". Si no tienes información suficiente aún, deja "detectedPipelineId": null.`
    : ''

  return `Eres ${agentName}, un agente de ventas especializado.

INSTRUCCIONES PRINCIPALES:
- Responde siempre en español, de forma breve (máximo 3-4 oraciones)
- Nunca menciones que eres una IA a menos que te lo pregunten directamente
- Termina siempre con una pregunta o llamada a acción concreta
- Adapta tu tono al del lead (formal/informal)
- Tu objetivo es calificar al lead y prepararlo para una llamada con el vendedor humano

${agendaSection}
${productsSection}
${scoringSection}
${leadSection}
${routingSection}
${resourcesSection}

BASE DE CONOCIMIENTO:
${ragContent || 'No hay documentos cargados aún.'}

${customInstructions ? `INSTRUCCIONES ADICIONALES:\n${customInstructions}` : ''}

FORMATO DE RESPUESTA IMPORTANTE:
Responde SIEMPRE llamando a la herramienta "responder". No escribas texto suelto.
- "response": el mensaje visible para el lead
- "scoring": una entrada por cada categoría en la que se activó una señal, con su categoryId, los puntos (delta, negativo si resta) y el motivo. Arreglo vacío si no se activó ninguna.
- "profileB": true si el lead muestra señales de potencial distribuidor
- "suggestHandoff": true si el lead está listo para una llamada con el vendedor
- "detectedProductId": id del producto si mostró interés en uno específico, null si no
- "detectedPipelineId": id del flujo si lograste identificarlo (solo en modo routing), null si no
- "shareResources": ids de los recursos tipo archivo, imagen o video a adjuntar en este mensaje
- "shareResources": ids de los recursos de tipo archivo, imagen o video que deben adjuntarse en este mensaje. Vacío si no corresponde ninguno.`
}

// ── HERRAMIENTA DE RESPUESTA ──────────────────────────────────────
// El scoring va como arreglo y no como objeto de claves dinámicas: un esquema
// estricto necesita propiedades conocidas y additionalProperties en false.
/* ── Herramientas de trabajo del agente ─────────────────────────────────
 *
 * Hasta acá el agente estaba forzado a una sola herramienta, responder, así
 * que podía decir "te agendo el viernes" y no quedaba nada escrito. Estas tres
 * le dan la capacidad de hacer lo que el prompt ya le pedía.
 *
 * responder sigue siendo la única forma de hablarle al lead, así que el texto
 * nunca sale sin pasar por el esquema.
 */
const CONSULTAR_AGENDA = {
  name: 'consultar_agenda',
  description: 'Devuelve los horarios libres de un día, respetando los horarios de atención, las citas ya tomadas y el buffer entre reuniones. Úsala SIEMPRE antes de proponer u ofrecer un horario: nunca inventes disponibilidad.',
  input_schema: {
    type: 'object',
    properties: {
      fecha: { type: 'string', description: 'Día a consultar en formato YYYY-MM-DD' },
      duracion: { type: 'integer', description: 'Duración en minutos de la cita que se quiere agendar' },
    },
    required: ['fecha'],
    additionalProperties: false,
  },
}

const AGENDAR_CITA = {
  name: 'agendar_cita',
  description: 'Agenda una cita en un horario que consultar_agenda haya devuelto como libre. Si el lead pidió un horario que no está libre, no la uses: ofrecé los que sí lo están.',
  input_schema: {
    type: 'object',
    properties: {
      fecha: { type: 'string', description: 'YYYY-MM-DD' },
      hora: { type: 'string', description: 'HH:MM en 24 horas, hora local de la organización' },
      tipo: { type: 'string', enum: ['presencial', 'video', 'call'], description: 'presencial si el lead viene a la sede, video si es videollamada, call si es telefónica' },
      duracion: { type: 'integer', description: 'Minutos. Por defecto 30' },
      motivo: { type: 'string', description: 'Qué se va a atender, en una línea' },
    },
    required: ['fecha', 'hora', 'tipo'],
    additionalProperties: false,
  },
}




/* ── Ejecución de las herramientas ──────────────────────────────────────
 *
 * Cada una devuelve texto para el modelo. Los errores se devuelven como texto
 * y no se lanzan: si Google falla, el agente tiene que poder decir "no pude
 * ver la agenda" en vez de dejar al lead sin respuesta.
 */
async function ejecutarHerramienta(nombre, input, ctx) {
  const { orgId, leadId, leadName, products } = ctx

  if (nombre === 'consultar_agenda') {
    if (leadId === 'test') {
      return 'Modo prueba: no se consulta la agenda real. Asumí que hay huecos a las 10:00, 11:00 y 16:00.'
    }
    const { disponibilidad } = require('./lib/agenda')
    const { slots, tz, buffer } = await disponibilidad(db, orgId, {
      fecha: input.fecha,
      duracion: input.duracion || 30,
    })
    if (!slots.length) {
      return `No hay horarios libres el ${input.fecha}. Puede ser día no laborable o estar completo. Ofrecé otro día.`
    }
    return `Horarios libres el ${input.fecha} (zona ${tz}, buffer de ${buffer} min entre citas): ${slots.map(s => s.hora).join(', ')}.`
  }

  if (nombre === 'agendar_cita') {
    if (leadId === 'test') return 'Modo prueba: la cita no se creó realmente.'
    const { instanteDesdeLocal, configDeAgenda, disponibilidad } = require('./lib/agenda')
    // db es el handle de arriba del archivo.
    const { tz } = await configDeAgenda(db, orgId)
    const duracion = input.duracion || 30

    // Se vuelve a verificar antes de escribir: entre que el agente consultó y
    // decidió, alguien pudo tomar ese hueco.
    const { slots } = await disponibilidad(db, orgId, { fecha: input.fecha, duracion })
    if (!slots.some(x => x.hora === input.hora)) {
      return `Ese horario ya no está libre. Los que quedan el ${input.fecha} son: ${slots.map(s => s.hora).join(', ') || 'ninguno'}. Ofrecé uno de esos.`
    }

    const cuando = instanteDesdeLocal(input.fecha, input.hora, tz)
    const ref = await db.collection('organizations').doc(orgId).collection('appointments').add({
      leadId,
      leadName: leadName || '',
      type: input.tipo,
      // El mismo estado que usa la interfaz, o la cita aparece sin etiqueta
      // en Reuniones y los filtros no la encuentran.
      status: 'pending',
      scheduledAt: admin.firestore.Timestamp.fromDate(cuando),
      duration: duracion,
      notes: input.motivo || '',
      link: '',
      location: '',
      requirements: '',
      // Queda marcado quién la creó: una cita que puso el agente se revisa
      // distinto que una que puso una persona.
      createdByAgent: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // El evento en Google es lo que hace que el equipo la vea en su agenda.
    let avisoCalendario = ''
    try {
      const { getAccessToken, createEvent, getCalendarId } = require('./lib/google')
      const token = await getAccessToken(db, orgId)
      const calendarId = await getCalendarId(db, orgId)
      const ev = await createEvent(token, {
        title: `${input.tipo === 'presencial' ? 'Cita' : 'Reunión'} con ${leadName || 'lead'}`,
        scheduledAt: cuando.toISOString(),
        duration: duracion,
        leadName,
        notes: input.motivo || '',
        withMeet: input.tipo === 'video',
        calendarId,
      })
      await ref.update({ googleEventId: ev.eventId, googleCalendarId: ev.calendarId, ...(ev.meetLink ? { link: ev.meetLink } : {}) })
      if (ev.meetLink) avisoCalendario = ` El enlace de la videollamada es ${ev.meetLink} — pasáselo al lead.`
    } catch (e) {
      // La cita ya quedó guardada en FlowHub: que Google falle no la cancela.
      console.warn('[agent] cita creada sin evento en Calendar:', e.message)
      if (input.tipo === 'video') {
        // Sin decirlo, el agente podía prometerle al lead un enlace que no
        // existe — exactamente lo que hay que evitar.
        avisoCalendario = ' NO hay enlace de videollamada: el calendario no está conectado. No le prometas ningún enlace; decile que se lo vas a enviar antes de la reunión.'
      }
    }

    /* No se toca el score acá. El cierre del turno lo recalcula desde el valor
     * que leyó ANTES de este bucle, así que cualquier escritura nuestra queda
     * pisada. Se avisa y el ajuste se hace en un solo lugar, al final. */
    ctx.citaAgendada = true

    return `Cita agendada para el ${input.fecha} a las ${input.hora} (${duracion} min, ${input.tipo}).${avisoCalendario} Confirmásela al lead con fecha y hora.`
  }

  return `Herramienta desconocida: ${nombre}`
}

/**
 * Crea las oportunidades que el modelo declaró en su respuesta.
 *
 * No lanza: una oportunidad que no se pudo registrar no puede impedir que el
 * lead reciba su respuesta.
 */
async function registrarOportunidades(orgId, leadId, lista, products) {
  if (!Array.isArray(lista) || !lista.length || leadId === 'test') return 0
  const leadRef = db.collection('organizations').doc(orgId).collection('leads').doc(leadId)

  let creadas = 0
  try {
    const previas = await leadRef.collection('opportunities').get()
    const yaAbiertas = new Set(
      previas.docs.filter(d => d.data().status === 'abierta').map(d => d.data().productId),
    )

    const normalizar = t => String(t || '').trim().toLowerCase()
    for (const o of lista) {
      // Por id, y si manda el nombre se acepta igual: el precio sale del
      // catálogo de todos modos, así que no se gana nada siendo estricto.
      const producto = products.find(p => p.id === o?.productId)
        || products.find(p => normalizar(p.name) === normalizar(o?.productId))
      if (!producto) {
        console.warn(`[agent] producto no reconocido: ${o?.productId}`)
        continue
      }
      if (yaAbiertas.has(producto.id)) continue

      await leadRef.collection('opportunities').add({
        name: producto.name,
        productId: producto.id,
        value: Number(producto.price) || 0,
        kind: o.tipo === 'potencial' ? 'potencial' : 'real',
        probability: 'media',
        status: 'abierta',
        auto: true,
        reason: o.motivo || '',
        createdBy: 'agent',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      yaAbiertas.add(producto.id)
      creadas++
    }

    if (creadas) await recalcularOportunidades(db, orgId, leadId)
  } catch (e) {
    console.error('[agent] no se pudieron registrar oportunidades:', e.message)
  }
  return creadas
}

/* Los totales se copian al lead porque el board lee cientos de leads de una
 * sola consulta. Es el mismo cálculo que hace el front en useOpportunities. */
async function recalcularOportunidades(db, orgId, leadId) {
  const leadRef = db.collection('organizations').doc(orgId).collection('leads').doc(leadId)
  const snap = await leadRef.collection('opportunities').get()
  const todas = snap.docs.map(d => d.data())
  const abiertas = todas.filter(o => o.status === 'abierta')
  const ganadas = todas.filter(o => o.status === 'ganada')
  const suma = arr => arr.reduce((s, o) => s + (Number(o.value) || 0), 0)
  await leadRef.update({
    opportunityStats: {
      total: todas.length,
      open: abiertas.length,
      won: ganadas.length,
      valueOpen: suma(abiertas),
      valueWon: suma(ganadas),
      // Solo abiertas: ver el comentario en useOpportunities.js.
      valueReal: suma(abiertas.filter(o => (o.kind || 'real') === 'real')),
      valuePotencial: suma(abiertas.filter(o => o.kind === 'potencial')),
    },
  })
}

const RESPONSE_TOOL = {
  name: 'responder',
  description: 'Entrega la respuesta para el lead junto con la evaluación interna. Es la única forma de responder.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      response: { type: 'string', description: 'El mensaje que verá el lead' },
      scoring: {
        type: 'array',
        description: 'Una entrada por categoría en la que se activó alguna señal',
        items: {
          type: 'object',
          properties: {
            categoryId: { type: 'string' },
            delta: { type: 'number' },
            reason: { type: 'string' },
          },
          required: ['categoryId', 'delta', 'reason'],
          additionalProperties: false,
        },
      },
      profileB: { type: 'boolean' },
      profileBReason: { type: 'string' },
      suggestHandoff: { type: 'boolean' },
      suggestHandoffReason: { type: 'string' },
      detectedProductId: { type: ['string', 'null'] },
      detectedPipelineId: { type: ['string', 'null'] },
      // Las oportunidades viajan en la salida obligatoria y no en una
      // herramienta aparte: como herramienta opcional el modelo simplemente no
      // la usaba — conversaba bien, agendaba, y no registraba nada. Acá tiene
      // que declararlas en cada respuesta, aunque sea con la lista vacía.
      oportunidades: {
        type: 'array',
        description: 'Productos del catálogo que aplican a este lead según lo que viene contando. Una entrada por producto, sin repetir los que ya registraste antes.',
        items: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'Id exacto de un producto del catálogo' },
            tipo: {
              type: 'string',
              enum: ['real', 'potencial'],
              description: 'real es la de entrada: la consulta o valoración que se va a agendar. potencial es lo que se deduce del problema y vendría después: la cirugía, el tratamiento.',
            },
            motivo: { type: 'string', description: 'Qué dijo el lead que hace que aplique' },
          },
          required: ['productId', 'tipo', 'motivo'],
          additionalProperties: false,
        },
      },
      shareResources: {
        type: 'array',
        description: 'Ids de recursos tipo archivo, imagen o video para adjuntar',
        items: { type: 'string' },
      },
    },
    required: [
      'response', 'scoring', 'profileB', 'profileBReason', 'suggestHandoff',
      'suggestHandoffReason', 'detectedProductId', 'detectedPipelineId', 'shareResources',
      'oportunidades',
    ],
    additionalProperties: false,
  },
}

// El resto del sistema espera scoring como objeto { categoriaId: {delta, reason} }.
function normalizeToolInput(input) {
  const scoring = {}
  for (const row of input.scoring || []) {
    if (row?.categoryId) scoring[row.categoryId] = { delta: row.delta || 0, reason: row.reason || '' }
  }
  return { ...input, scoring }
}

// ── PARSE AGENT RESPONSE ──────────────────────────────────────────
function parseAgentResponse(text) {
  try {
    // Try direct JSON parse
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {}
  // Fallback — treat entire text as response
  return {
    response: text,
    scoring: { necesidad: { delta: 0 }, capacidad: { delta: 0 }, intencion: { delta: 0 }, confianza: { delta: 0 } },
    profileB: false,
    suggestHandoff: false,
    detectedProductId: null,
  }
}

// ── CALCULATE NEW SCORE ───────────────────────────────────────────
function calculateNewScore(currentScore, scoringDeltas) {
  if (!scoringDeltas || Object.keys(scoringDeltas).length === 0) return currentScore
  // Sum all category deltas, clamp result to 0–100
  return Math.max(0, Math.min(100,
    currentScore + Object.values(scoringDeltas).reduce((sum, s) => sum + (s.delta || 0), 0)
  ))
}

// ── FIND TARGET STAGE BY SCORE ────────────────────────────────────
async function findTargetStage(orgId, pipelineId, score) {
  const stagesSnap = await db.collection('organizations').doc(orgId)
    .collection('pipeline_stages')
    .where('pipelineId', '==', pipelineId)
    .orderBy('order', 'asc')
    .get()

  const stages = stagesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  // Find stage where score fits
  for (const stage of stages) {
    const min = stage.scoreMin ?? 0
    const max = stage.scoreMax ?? 100
    if (score >= min && score <= max) return stage
  }

  // If score exceeds all stages → suggest handoff
  const maxStage = stages[stages.length - 1]
  if (maxStage && score > (maxStage.scoreMax ?? 100)) return { id: '__handoff__', name: 'Handoff' }

  return null
}

// ── UPDATE LEAD SCORE AND STAGE ───────────────────────────────────
async function updateLeadScoreAndStage(orgId, leadId, parsedResponse, currentScore, scoringConfig, { citaAgendada = false, bonoPorAgendar = 25 } = {}) {
  const leadRef = db.collection('organizations').doc(orgId).collection('leads').doc(leadId)
  const leadSnap = await leadRef.get()
  if (!leadSnap.exists) return

  const lead = leadSnap.data()
  if (!parsedResponse.scoring && !citaAgendada) return Number(lead.score || 0)
  // Agendar es la conversión de este negocio: para una clínica la cita ya es
  // el cierre de la parte que nos toca. Sin esto, alguien que ya tenía su cita
  // quedaba en 51 — ni cerca del handoff.
  const newScore = Math.min(100,
    calculateNewScore(currentScore, parsedResponse.scoring) + (citaAgendada ? bonoPorAgendar : 0),
  )

  const updateData = {
    score: newScore,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  // ProfileB detection
  if (parsedResponse.profileB && !lead.profileB) {
    updateData.profileB = true
    updateData.profileBDetectedAt = admin.firestore.FieldValue.serverTimestamp()
    // Create alert
    await db.collection('organizations').doc(orgId).collection('alerts').add({
      type: 'profile_b',
      leadId,
      leadName: lead.name,
      message: `${lead.name} tiene perfil de distribuidor — ${parsedResponse.profileBReason || ''}`,
      assignedTo: lead.assignedTo || null,
      seen: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }

  // Detected product interest
  if (parsedResponse.detectedProductId && !lead.productId) {
    updateData.productId = parsedResponse.detectedProductId
  }

  // Stage advancement based on score
  if (!lead.systemStage) {
    const targetStage = lead.pipelineId
      ? await findTargetStage(orgId, lead.pipelineId, newScore)
      : null
    // Con cita agendada se pasa a handoff aunque el pipeline no tenga umbrales
    // configurados o el score no llegue: la conversión ya ocurrió.
    if (citaAgendada || (targetStage && targetStage.id !== lead.stageId)) {
      if (targetStage.id === '__handoff__' || parsedResponse.suggestHandoff || citaAgendada) {
        // Move to handoff
        updateData.systemStage = 'handoff'
        updateData.systemStageAt = admin.firestore.FieldValue.serverTimestamp()
        updateData.stageId = null
        updateData.handoffAt = admin.firestore.FieldValue.serverTimestamp()
        // Alert the assigned user
        if (lead.assignedTo) {
          await db.collection('organizations').doc(orgId).collection('alerts').add({
            type: 'handoff_assigned',
            leadId,
            leadName: lead.name,
            assignedTo: lead.assignedTo,
            message: `${lead.name} está listo para llamada — score ${newScore}`,
            seen: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }
      } else {
        updateData.stageId = targetStage.id
      }
    }
  }

  await leadRef.update(updateData)

  // ── Save score event for history ──
  const scoringDeltas = parsedResponse.scoring || {}
  const totalDelta = newScore - currentScore
  if (totalDelta !== 0 || Object.keys(scoringDeltas).length > 0) {
    await leadRef.collection('score_events').add({
      prevScore: currentScore,
      newScore,
      delta: totalDelta,
      categories: scoringDeltas,
      source: 'agent',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {})
  }

  return newScore
}

// ── SYNC AGENT CONFIG ─────────────────────────────────────────────
async function syncAssistant(orgId, config) {
  const settingsRef = db.collection('organizations').doc(orgId).collection('settings').doc('agent')
  // Firestore rechaza undefined — filtrar antes de guardar
  const cleanConfig = Object.fromEntries(
    Object.entries({ ...config, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      .filter(([, v]) => v !== undefined)
  )
  await settingsRef.set(cleanConfig, { merge: true })
  return { success: true }
}

// ── UPLOAD FILE ───────────────────────────────────────────────────
async function uploadFile(orgId, fileBuffer, fileName, mimeType, pipelineId) {
  let content = ''
  try {
    content = fileBuffer.toString('utf-8')
  } catch {}
  const fileRef = await db.collection('organizations').doc(orgId).collection('agent_files').add({
    name: fileName,
    size: fileBuffer.length,
    mimeType,
    content,
    status: 'ready',
    pipelineId: pipelineId || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return { fileId: fileRef.id }
}

// ── DELETE FILE ───────────────────────────────────────────────────
async function deleteFile(orgId, fileDocId) {
  const fileSnap = await db.collection('organizations').doc(orgId).collection('agent_files').doc(fileDocId).get()
  if (fileSnap.exists) await fileSnap.ref.delete()
}

// ── CLEAR TEST THREAD ─────────────────────────────────────────────
async function clearTestThread(orgId) {
  const ref = db.collection('organizations').doc(orgId)
    .collection('agent_test_threads').doc('test').collection('messages')
  const snap = await ref.get()
  const batch = db.batch()
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
}

// ── GET CONVERSATION HISTORY ──────────────────────────────────────
async function getConversationHistory(orgId, leadId) {
  const collPath = leadId === 'test'
    ? db.collection('organizations').doc(orgId).collection('agent_test_threads').doc(leadId).collection('messages')
    : db.collection('organizations').doc(orgId).collection('leads').doc(leadId).collection('conversations')
  const snap = await collPath.orderBy('createdAt', 'desc').limit(10).get()
  return snap.docs.reverse().map(d => ({
    role: d.data().role === 'user' ? 'user' : 'assistant',
    content: d.data().text || d.data().content || '',
  }))
}

// ── SAVE MESSAGE ──────────────────────────────────────────────────
async function saveTestMessage(orgId, leadId, role, text) {
  if (leadId !== 'test') return
  await db.collection('organizations').doc(orgId)
    .collection('agent_test_threads').doc(leadId)
    .collection('messages').add({
      role, text, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
}

async function saveLeadMessage(orgId, leadId, role, text) {
  if (leadId === 'test') return
  await db.collection('organizations').doc(orgId)
    .collection('leads').doc(leadId)
    .collection('conversations').add({
      role, text, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
}

// ── LOAD DISTRIBUIDOR GLOBAL CONFIG ──────────────────────────────
async function loadDistribuidorConfig(orgId) {
  try {
    const orgSnap = await db.collection('organizations').doc(orgId).get()
    if (!orgSnap.exists || !orgSnap.data()?.isDistribuidor) return null
    const configSnap = await db.collection('flowhub_config').doc('distribuidor_niveles').get()
    return configSnap.exists ? configSnap.data() : null
  } catch {
    return null
  }
}

// ── BUILD DISTRIBUIDOR SCORING TEXT ──────────────────────────────
function buildDistribuidorScoringText(scoringSignals) {
  if (!scoringSignals?.length) return ''
  return '\n\nSEÑALES DE CALIFICACIÓN PARA DISTRIBUIDORES:\n' +
    scoringSignals.map(cat =>
      `${cat.label || cat.name} (máx ${cat.tope} pts):\n` +
      (cat.subcategories || []).map(sub =>
        `  ${sub.label || sub.name}:\n` +
        (sub.signals || []).map(sig => `    - ${sig.text || sig.name}: ${sig.weight >= 0 ? '+' : ''}${sig.weight} pts`).join('\n')
      ).join('\n')
    ).join('\n\n')
}

// ── CHAT WITH AGENT ───────────────────────────────────────────────
async function chatWithAssistant(orgId, leadId, message, testPipelineId = null, skipSaveUser = false) {
  // Load agent config
  const settingsSnap = await db.collection('organizations').doc(orgId).collection('settings').doc('agent').get()
  if (!settingsSnap.exists) throw new Error('Agente no configurado.')
  let agentConfig = settingsSnap.data() || {}

  // ── Distribuidor override: merge global agentPrompt + scoringSignals ──
  const distribConfig = await loadDistribuidorConfig(orgId)
  if (distribConfig) {
    const extraScoringText = buildDistribuidorScoringText(distribConfig.scoringSignals)
    if (distribConfig.agentPrompt) {
      agentConfig = {
        ...agentConfig,
        customInstructions: distribConfig.agentPrompt + extraScoringText,
      }
    } else if (extraScoringText) {
      // customInstructions may be an object (per-pipeline) — we'll handle resolution later; just append to base string
      const base = typeof agentConfig.customInstructions === 'string' ? agentConfig.customInstructions : ''
      agentConfig = {
        ...agentConfig,
        customInstructions: base + extraScoringText,
      }
    }
  }

  // Load lead context (if real lead, not test) — debe ir ANTES del RAG filter
  let leadContext = null
  let currentScore = 0
  let scoringConfig = null
  let pipelineId = testPipelineId || null

  if (leadId !== 'test') {
    const leadSnap = await db.collection('organizations').doc(orgId).collection('leads').doc(leadId).get()
    if (leadSnap.exists) {
      const lead = leadSnap.data()
      currentScore = lead.score || 0
      pipelineId = lead.pipelineId

      // Load stage info
      let stageName = 'Sin etapa'
      let stageScoreMax = 100
      if (lead.stageId) {
        const stageSnap = await db.collection('organizations').doc(orgId).collection('pipeline_stages').doc(lead.stageId).get()
        if (stageSnap.exists) {
          stageName = stageSnap.data().name
          stageScoreMax = stageSnap.data().scoreMax ?? 100
        }
      }

      // Load pipeline info
      let pipelineName = ''
      if (pipelineId) {
        const pipelineSnap = await db.collection('organizations').doc(orgId).collection('pipelines').doc(pipelineId).get()
        if (pipelineSnap.exists) pipelineName = pipelineSnap.data().name || ''
      }

      // Load scoring config for this pipeline
      if (pipelineId && agentConfig.scoring?.[pipelineId]) {
        scoringConfig = agentConfig.scoring[pipelineId]
      } else if (agentConfig.scoring) {
        // Fallback to first scoring config
        const keys = Object.keys(agentConfig.scoring)
        if (keys.length) scoringConfig = agentConfig.scoring[keys[0]]
      }

      // Load product name if associated
      let productName = ''
      if (lead.productId) {
        const productSnap = await db.collection('organizations').doc(orgId).collection('products').doc(lead.productId).get()
        if (productSnap.exists) productName = productSnap.data().name || ''
      }

      leadContext = {
        // Sin el nombre el agente no puede personalizar: en WhatsApp viene del
        // perfil del contacto, así que puede faltar o ser un apodo.
        name: lead.name && lead.name !== 'Sin nombre' ? lead.name : null,
        score: currentScore,
        stageName,
        stageScoreMax,
        pipelineName,
        profileB: lead.profileB || false,
        productId: lead.productId,
        productName,
      }
    }
  }

  // Test mode with a specific pipeline selected — load scoring config for that pipeline
  if (leadId === 'test' && testPipelineId) {
    pipelineId = testPipelineId
    if (agentConfig.scoring?.[pipelineId]) {
      scoringConfig = agentConfig.scoring[pipelineId]
    } else if (agentConfig.scoring) {
      const keys = Object.keys(agentConfig.scoring)
      if (keys.length) scoringConfig = agentConfig.scoring[keys[0]]
    }
  }

  // Load all pipelines (used for routing section in system prompt)
  let allPipelines = []
  try {
    const pipelinesSnap = await db.collection('organizations').doc(orgId).collection('pipelines').orderBy('createdAt', 'asc').get()
    allPipelines = pipelinesSnap.docs.map(d => ({ id: d.id, name: d.data().name || '', purpose: d.data().purpose || '' }))
  } catch {
    // orderBy may fail without index — fall back to unordered
    try {
      const pipelinesSnap = await db.collection('organizations').doc(orgId).collection('pipelines').get()
      allPipelines = pipelinesSnap.docs.map(d => ({ id: d.id, name: d.data().name || '', purpose: d.data().purpose || '' }))
    } catch {}
  }

  // Resolve per-pipeline customInstructions (new {pipelineId: string} object or legacy string)
  const rawInstructions = agentConfig.customInstructions
  if (typeof rawInstructions === 'object' && rawInstructions !== null && !Array.isArray(rawInstructions)) {
    const resolved = (pipelineId && rawInstructions[pipelineId])
      || rawInstructions['__default__']
      || Object.values(rawInstructions).find(Boolean)
      || ''
    agentConfig = { ...agentConfig, customInstructions: resolved }
  }
  // (if already a string — legacy or distribuidor override — leave as-is)

  // Load RAG files — filter by pipelineId (now resolved)
  const filesSnap = await db.collection('organizations').doc(orgId).collection('agent_files')
    .where('status', '==', 'ready').get()
  const ragContent = filesSnap.docs
    .filter(d => !d.data().pipelineId || d.data().pipelineId === pipelineId)
    .map(d => d.data().content || '').filter(Boolean).join('\n\n---\n\n')

  /* Productos que ve el agente.
   *
   * Si la organización eligió cuáles habilitar, se respeta esa lista. Pero si
   * no eligió ninguno se le dan todos, no cero: "sin restricción configurada"
   * significa que puede usar el catálogo entero, no que no tiene catálogo.
   *
   * Con el comportamiento anterior, una organización que nunca pasó por esa
   * pantalla tenía un agente que hablaba de los productos —los precios salen
   * de la base de conocimiento— y no podía registrar una sola oportunidad,
   * porque para él el catálogo estaba vacío.
   */
  let products = []
  const productsRef = db.collection('organizations').doc(orgId).collection('products')
  if (agentConfig.enabledProductIds?.length) {
    const productSnaps = await Promise.all(
      agentConfig.enabledProductIds.map(id => productsRef.doc(id).get())
    )
    products = productSnaps.filter(s => s.exists).map(s => ({ id: s.id, ...s.data() }))
  } else {
    const todos = await productsRef.get()
    products = todos.docs.map(d => ({ id: d.id, ...d.data() }))
  }
  console.log(`[agent] catálogo: ${products.length} producto(s)${agentConfig.enabledProductIds?.length ? ' (lista habilitada)' : ' (todos, sin lista configurada)'}`)

  // Load resources available for sharing
  const resourcesSnap = await db.collection('organizations').doc(orgId).collection('agent_resources')
    .orderBy('createdAt', 'desc').get()
  const resources = resourcesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  // La zona horaria sale de la organización: el agente tiene que razonar en la
  // hora del cliente, no en la del servidor.
  let agendaInfo = {}
  try {
    const { configDeAgenda } = require('./lib/agenda')
    if (leadId !== 'test') agendaInfo = await configDeAgenda(db, orgId)
  } catch (e) {
    console.warn('[agent] sin config de agenda:', e.message)
  }

  const systemPrompt = buildSystemPrompt(agentConfig, ragContent, products, scoringConfig, leadContext, resources, allPipelines, pipelineId, agendaInfo)

  // Load conversation history
  const history = await getConversationHistory(orgId, leadId)

  // Save user message. Al reintentar una respuesta que falló, el mensaje del
  // lead ya está en el hilo: volver a guardarlo lo duplicaría.
  if (!skipSaveUser) {
    await saveTestMessage(orgId, leadId, 'user', message)
    await saveLeadMessage(orgId, leadId, 'user', message)
  }

  try {
    // Hasta cuántas veces puede usar herramientas antes de responder. Es un
    // tope de seguridad: si se queda dando vueltas, se corta y responde.
    const MAX_PASOS = 6
    const turnos = [
      ...history,
      { role: 'user', content: message },
    ]
    const ctx = { orgId, leadId, leadName: leadContext?.name, products }

    let parsed = null
    let response = null

    for (let paso = 0; paso < MAX_PASOS && !parsed; paso++) {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: turnos,
        // Salida estructurada: con strict, la API garantiza que los argumentos
        // validen contra el esquema. Pedir JSON dentro del texto fallaba cuando
        // la respuesta llevaba comillas (por ejemplo: dos hojas: "Estado de
        // cuenta"), el JSON.parse reventaba y el lead recibía el JSON crudo.
        //
        // tool_choice 'any' obliga a usar alguna herramienta, así que el texto
        // al lead sigue saliendo solo por responder, pero ahora antes puede
        // mirar la agenda, agendar o registrar una oportunidad.
        tools: [RESPONSE_TOOL, CONSULTAR_AGENDA, AGENDAR_CITA],
        tool_choice: { type: 'any' },
      })

      const usos = response.content.filter(b => b.type === 'tool_use')
      const respuesta = usos.find(u => u.name === RESPONSE_TOOL.name)

      if (respuesta) { parsed = normalizeToolInput(respuesta.input); break }
      if (!usos.length) break // sin herramienta: se sale y se usa el texto

      turnos.push({ role: 'assistant', content: response.content })
      const resultados = []
      for (const uso of usos) {
        let texto
        try {
          texto = await ejecutarHerramienta(uso.name, uso.input, ctx)
        } catch (e) {
          console.error(`[agent] ${uso.name} falló:`, e.message)
          texto = `La herramienta falló: ${e.message}. Seguí la conversación sin prometer lo que no pudiste hacer.`
        }
        resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: texto })
      }
      turnos.push({ role: 'user', content: resultados })
    }

    if (!parsed) {
      parsed = parseAgentResponse(response?.content?.find(b => b.type === 'text')?.text || '')
    }
    const visibleReply = parsed.response

    // Save agent response
    await saveTestMessage(orgId, leadId, 'assistant', visibleReply)
    await saveLeadMessage(orgId, leadId, 'assistant', visibleReply)

    // Update lead score and stage (only for real leads)
    let newScore = currentScore
    if (leadId !== 'test') {
      // Se corre aunque no haya scoring configurado: si agendó hay que moverlo
      // a handoff igual, y antes eso dependía de tener scoring.
      newScore = await updateLeadScoreAndStage(orgId, leadId, parsed, currentScore, scoringConfig, {
        citaAgendada: !!ctx.citaAgendada,
        bonoPorAgendar: Number(agentConfig.scoreOnBooking ?? 25),
      })
    }

    // Se registra qué declaró el modelo aunque no se cree nada: sin esto, un
    // fallo acá es invisible y hay que adivinar.
    console.log(`[agent] oportunidades declaradas: ${JSON.stringify(parsed.oportunidades || [])}`)
    const nuevasOps = await registrarOportunidades(orgId, leadId, parsed.oportunidades, products)
    if (nuevasOps) console.log(`[agent] ${nuevasOps} oportunidad(es) registradas para ${leadId}`)

    // Se resuelven acá para que quien envíe no tenga que volver a leerlos.
    const toShare = Array.isArray(parsed.shareResources)
      ? parsed.shareResources
          .map(id => resources.find(r => r.id === id))
          .filter(r => r && r.type !== 'enlace')
      : []

    return {
      response: visibleReply,
      score: newScore,
      profileB: parsed.profileB,
      suggestHandoff: parsed.suggestHandoff,
      shareResources: toShare,
    }
  } catch (err) {
    console.error('❌ Anthropic error:', err.status, err.message)
    throw err
  }
}

// ── MAIN HANDLER ──────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const headers = { 'Content-Type': 'application/json' }

  try {
    const body = JSON.parse(event.body)
    const { action, orgId } = body
    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing orgId' }) }

    if (action === 'sync') {
      const result = await syncAssistant(orgId, body.config)
      return { statusCode: 200, headers, body: JSON.stringify(result) }
    }
    if (action === 'upload') {
      const buffer = Buffer.from(body.fileData, 'base64')
      const result = await uploadFile(orgId, buffer, body.fileName, body.mimeType, body.pipelineId || null)
      return { statusCode: 200, headers, body: JSON.stringify(result) }
    }
    if (action === 'delete_file') {
      await deleteFile(orgId, body.fileDocId)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }
    if (action === 'clear_thread') {
      await clearTestThread(orgId)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }
    if (action === 'chat') {
      const result = await chatWithAssistant(orgId, body.leadId || 'test', body.message, body.pipelineId || null, body.skipSaveUser === true)
      return { statusCode: 200, headers, body: JSON.stringify(result) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) }
  } catch (err) {
    console.error('agent-manager error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
