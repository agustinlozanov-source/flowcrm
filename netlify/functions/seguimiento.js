/* El silencio tiene regla: se rescata, y si sigue callado se descarta.
 *
 * Sin esto, una conversación que arrancó bien y se apagó se queda en el
 * embudo para siempre. Nadie la retoma —porque ya pasó su momento— y nadie la
 * saca —porque dar de baja a mano un lead que alguna vez fue bueno cuesta
 * trabajo—, así que el tablero se llena de ruido y deja de reflejar la
 * realidad.
 *
 * ── Lo que hace, en orden ───────────────────────────────────────────
 *   1. Rescata antes de que cierre la ventana de 24 horas de Meta. Después no
 *      hay nada que mandar: fuera de ventana solo entran plantillas, que
 *      exigen cuenta verificada y método de pago.
 *   2. Si tras N intentos sigue sin contestar, lo descarta con la razón
 *      «No contesta», que ya existe y admite retomarse.
 *
 * ── Por qué una bandera nueva y no la de siempre ────────────────────
 * Ya había un cron parecido que corría en Railway, y su interruptor
 * (`followUp.enabled`) sigue encendido en las organizaciones que lo activaron
 * hace meses. Revivir el trabajo mirando esa bandera habría empezado a
 * escribirle a clientes reales en el primer despliegue, sin que nadie lo
 * pidiera hoy. Por eso se exige `seguimiento.activo`, que nace apagada para
 * todos.
 *
 * ── Y por qué persigue al callado y no al que escribió ──────────────
 * El cron viejo solo actuaba cuando el lead había hablado último, que es el
 * caso contrario: ahí lo que falta es contestarle, y eso ya se ve en el
 * módulo de Actividad como «Esperando». Lo que se pierde en silencio es la
 * conversación donde el último mensaje fue nuestro.
 */
const admin = require('firebase-admin')
const { credencial } = require('./lib/credencial')

const HORA = 36e5
const VENTANA_HORAS = 24

/* Valores por omisión, pensados para no ser molestos: el primer rescate
   dentro de la ventana, el segundo al día siguiente, y al tercer silencio
   fuera. Cada organización los ajusta desde la pantalla del Agente. */
const POR_OMISION = {
  activo: false,
  horasAntesDeCerrar: 6,
  maxIntentos: 2,
  horasEntreIntentos: 24,
  descartar: false,
  usarAgente: true,
}

const PLANTILLA = [
  '¿Te late si retomamos? ¿Sigue en pie lo que platicamos?',
  '¿Lo dejamos para más adelante o te late que lo veamos esta semana?',
]

let base = null
function laBase() {
  if (!base) {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(credencial()) })
    }
    base = admin.firestore()
  }
  return base
}

const ms = ts => ts?.toDate?.()?.getTime() || 0

/** Si a este lead le toca algo, y qué.
 *
 *  Devuelve `null` cuando no hay nada que hacer, para que el ciclo de arriba
 *  se lea como una lista de razones y no como un árbol de condiciones. */
function queTocaHacer(lead, cfg, ahora) {
  if (lead.discarded || lead.systemStage) return null
  /* El cliente habló último: lo que falta es contestarle, no rescatarlo. */
  if (lead.hasUnread) return null

  const inbound = ms(lead.lastInboundAt)
  /* Sin fecha de entrante no hay reloj. Saltarlo es lo correcto: de adivinar
     saldrían mensajes fuera de ventana que no se entregan. Los leads viejos
     la ganan en cuanto el cliente escriba una vez. */
  if (!inbound) return null

  const cierra = inbound + VENTANA_HORAS * HORA
  const intentos = lead.rescates || 0
  const ultimoIntento = ms(lead.ultimoRescateAt)

  /* Agotados los intentos, se descarta. Y solo entonces: descartar a alguien
     a quien nunca se le escribió sería darlo por perdido sin intentarlo. */
  if (intentos >= cfg.maxIntentos) {
    if (!cfg.descartar) return null
    const desde = ultimoIntento || inbound
    if (ahora - desde < cfg.horasEntreIntentos * HORA) return null
    return { accion: 'descartar' }
  }

  /* El primer rescate se amarra a la ventana; los siguientes, al reloj propio,
     porque para entonces la ventana ya cerró y lo que manda es no encimarse. */
  if (intentos === 0) {
    const abre = cierra - cfg.horasAntesDeCerrar * HORA
    if (ahora < abre) return null
    if (ahora > cierra) return null  // se pasó: ya no hay mensaje que mandar
    return { accion: 'rescatar', dentroDeVentana: true }
  }

  if (ahora - ultimoIntento < cfg.horasEntreIntentos * HORA) return null
  /* Fuera de ventana solo irían plantillas aprobadas, que estas cuentas no
     tienen. Se cuenta el intento para que el conteo avance hacia el descarte,
     pero no se manda nada. */
  return { accion: 'rescatar', dentroDeVentana: ahora <= cierra }
}

/** El mensaje. Lo escribe el agente si se puede; si no, la plantilla.
 *
 *  Tres reglas duras, porque el rescate llega a alguien que ya se enfrió una
 *  vez: termina en pregunta cerrada para que contestar cueste una palabra —y
 *  solo un mensaje suyo reabre la ventana—; sin cifras, para no inventar
 *  precios ni plazos; y sin reabrir el argumento de venta. */
async function redactar(db, orgId, lead, cfg) {
  const fijo = PLANTILLA[(lead.rescates || 0) % PLANTILLA.length]
  if (!cfg.usarAgente) return { texto: fijo, porAgente: false }

  try {
    const hist = await db.collection('organizations').doc(orgId)
      .collection('leads').doc(lead.id).collection('conversations')
      .orderBy('createdAt', 'desc').limit(10).get()
    const mensajes = hist.docs.reverse().map(d => {
      const m = d.data()
      return {
        role: (m.role === 'assistant' || m.role === 'bot' || m.role === 'agent') ? 'assistant' : 'user',
        content: m.text || m.content || '',
      }
    }).filter(m => m.content)
    if (!mensajes.length) return { texto: fijo, porAgente: false }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 120,
        system:
          'Escribes UN mensaje corto para retomar una conversación de venta que se apagó. ' +
          'El cliente dejó de contestar, así que no insistas ni vuelvas a vender: ' +
          'solo busca que conteste.\n' +
          'REGLAS:\n' +
          '1. Máximo dos oraciones, y termina SIEMPRE en una pregunta que se pueda contestar con una palabra.\n' +
          '2. Prohibido mencionar cifras: ni precios, ni plazos, ni fechas nuevas.\n' +
          '3. Prohibido repetir el argumento de venta.\n' +
          '4. Mismo tono que traía la conversación. Sin saludos largos.\n' +
          'Responde solo con el mensaje, sin comillas ni explicación.',
        messages: [
          ...mensajes,
          { role: 'user', content: '[Genera ahora el mensaje para retomar.]' },
        ],
      }),
    })
    if (!r.ok) return { texto: fijo, porAgente: false }
    const data = await r.json()
    const texto = (data?.content?.[0]?.text || '').trim()

    /* La red: si el modelo devolvió algo largo, con cifras o sin pregunta, se
       usa la plantilla. Vale más un mensaje tibio que uno que invente un
       precio o prometa una fecha. */
    if (!texto || texto.length > 240 || /\d/.test(texto) || !texto.includes('?')) {
      return { texto: fijo, porAgente: false }
    }
    return { texto, porAgente: true }
  } catch {
    return { texto: fijo, porAgente: false }
  }
}

/** Mandarlo por donde el lead viene hablando. */
async function enviar(orgId, lead, texto) {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || ''
  const r = await fetch(`${base}/.netlify/functions/send-message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orgId,
      leadId: lead.id,
      text: texto,
      channel: lead.lastMessageChannel || lead.source || 'whatsapp',
    }),
  })
  return r.ok
}

async function rescatar(db, orgId, lead, cfg, dentroDeVentana) {
  const ref = db.collection('organizations').doc(orgId).collection('leads').doc(lead.id)

  /* Fuera de ventana no se manda nada: el mensaje no se entregaría y el error
     ensucia la conversación. Se cuenta el intento igual, para que el lead
     avance hacia el descarte en vez de quedarse en el limbo. */
  if (!dentroDeVentana) {
    await ref.update({
      rescates: admin.firestore.FieldValue.increment(1),
      ultimoRescateAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return 'fueraDeVentana'
  }

  const { texto, porAgente } = await redactar(db, orgId, lead, cfg)
  const ok = await enviar(orgId, lead, texto)
  if (!ok) return 'falloEnvio'

  await ref.update({
    rescates: admin.firestore.FieldValue.increment(1),
    ultimoRescateAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  /* Queda registrado y marcado como automático. Si se viera igual que un
     mensaje escrito por una persona, en dos meses nadie sabría quién lo
     mandó, y esa duda contamina todo el historial. */
  await ref.collection('activities').add({
    orgId,
    leadId: lead.id,
    leadNombre: [lead.name, lead.lastName].filter(Boolean).join(' ') || '',
    pipelineId: lead.pipelineId || null,
    tipo: 'whatsapp',
    estado: 'hecha',
    occurredAt: admin.firestore.FieldValue.serverTimestamp(),
    dueAt: null,
    resumen: `Rescate automático: «${texto}»`,
    automatica: true,
    porAgente,
    ownerUid: null,
    ownerNombre: 'Agente',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdByUid: null,
    createdByNombre: 'Agente',
  })
  return porAgente ? 'rescateAgente' : 'rescatePlantilla'
}

async function descartar(db, orgId, lead) {
  const ref = db.collection('organizations').doc(orgId).collection('leads').doc(lead.id)
  await ref.update({
    discarded: true,
    discardedAt: admin.firestore.FieldValue.serverTimestamp(),
    discardedBy: 'agente',
    discardCategory: 'no_answer',
    discardNotes: `Sin respuesta tras ${lead.rescates || 0} intentos de retomar.`,
    /* Dónde estaba, para que reactivarlo lo devuelva a su lugar. Es el mismo
       campo que usa el descarte a mano. */
    systemStageAntes: lead.systemStage || null,
    systemStage: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  await ref.collection('interactions').add({
    type: 'discard',
    content: `Descartado por el agente — No contesta (${lead.rescates || 0} intentos)`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'agente',
  })
}

exports.handler = async () => {
  const db = laBase()
  const ahora = Date.now()
  const resumen = { orgs: 0, revisados: 0, rescateAgente: 0, rescatePlantilla: 0, fueraDeVentana: 0, descartados: 0, falloEnvio: 0, fallos: 0 }

  const orgs = await db.collection('organizations').get()

  for (const org of orgs.docs) {
    let cfg
    try {
      const snap = await org.ref.collection('settings').doc('agent').get()
      cfg = { ...POR_OMISION, ...(snap.exists ? snap.data().seguimiento : null) }
    } catch { continue }
    if (!cfg.activo) continue
    resumen.orgs++

    /* Una sola igualdad en la consulta y el resto en memoria: con dos filtros
       y un orden haría falta un índice compuesto por organización, y al
       volumen de un embudo esto no se nota. */
    let leads
    try {
      leads = await org.ref.collection('leads').where('discarded', '==', false).get()
    } catch (e) {
      resumen.fallos++
      console.error(`[seguimiento] ${org.id}:`, e.message)
      continue
    }

    for (const d of leads.docs) {
      const lead = { id: d.id, ...d.data() }
      const toca = queTocaHacer(lead, cfg, ahora)
      if (!toca) continue
      resumen.revisados++
      try {
        if (toca.accion === 'descartar') {
          await descartar(db, org.id, lead)
          resumen.descartados++
        } else {
          const r = await rescatar(db, org.id, lead, cfg, toca.dentroDeVentana)
          resumen[r] = (resumen[r] || 0) + 1
        }
      } catch (e) {
        resumen.fallos++
        console.error(`[seguimiento] ${org.id}/${d.id}:`, e.message)
      }
    }
  }

  console.log('[seguimiento]', JSON.stringify(resumen))
  return { statusCode: 200, body: JSON.stringify(resumen) }
}
