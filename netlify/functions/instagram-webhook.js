// Mensajes y comentarios de Instagram, directo desde la app de Meta.
//
// Sin intermediario: la cuenta ya está conectada a la marca por OAuth, así que
// los mensajes pueden entrar por aquí en vez de por Zernio. Cada cuenta cae en
// el pipeline de su marca, y de ahí salen el nombre del agente, sus
// instrucciones y su scoring.
const admin = require('firebase-admin')
const { initDb, destinoInicial, pipelineDeLaCuenta, saveAttachments, guardarMensaje } = require('./lib/firebase')
const ig = require('./lib/instagram')

const CANAL = 'instagram'

/* Meta reintenta los eventos, y reintenta de verdad. Sin esto, un reintento
 * crea un lead duplicado o hace que el agente conteste dos veces. */
async function reclamar(db, id) {
  if (!id) return true
  try {
    await db.collection('_ig_eventos').doc(String(id)).create({
      recibidoEn: admin.firestore.FieldValue.serverTimestamp(),
    })
    return true
  } catch {
    return false
  }
}

async function buscarOCrearLead(db, orgId, { nombre, usuarioId, cuentaId }) {
  const leads = db.collection('organizations').doc(orgId).collection('leads')

  const porCanal = await leads.where(`channelIds.${CANAL}`, '==', usuarioId).limit(10).get()
  if (!porCanal.empty) {
    const docs = porCanal.docs
    // La misma persona escribiéndole a dos marcas son dos relaciones.
    const mismo = docs.find(d => d.data().cuentaId === cuentaId)
    const heredado = docs.find(d => !d.data().cuentaId)
    const elegido = mismo || heredado
    if (elegido) {
      const datos = elegido.data()
      const parche = {}
      if (!datos.cuentaId) parche.cuentaId = cuentaId
      // Los leads que entraron antes de que supiéramos preguntar el nombre
      // se quedaron en "Sin nombre"; en cuanto se sabe, se arregla solo.
      if (nombre && (!datos.name || datos.name === 'Sin nombre')) parche.name = nombre
      if (Object.keys(parche).length) await elegido.ref.update(parche)
      return { id: elegido.id, ...datos, ...parche }
    }
  }

  const preferido = await pipelineDeLaCuenta(db, orgId, cuentaId)
  const { pipelineId, stageId } = await destinoInicial(db, orgId, preferido)

  const ref = await leads.add({
    name: nombre || 'Sin nombre',
    phone: '',
    email: '',
    company: '',
    source: CANAL,
    cuentaId,
    stageId,
    pipelineId,
    score: 0,
    assignedTo: null,
    channelIds: { [CANAL]: usuarioId },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return { id: ref.id, ...(await ref.get()).data() }
}

async function tocarLead(db, orgId, leadId, { texto, delLead }) {
  await db.collection('organizations').doc(orgId).collection('leads').doc(leadId).update({
    lastMessage: texto,
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageChannel: CANAL,
    ...(delLead ? { unread: true } : {}),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}

/** Le pasa el turno al agente, que es quien tiene el prompt y el historial. */
async function preguntarAlAgente(orgId, leadId, texto) {
  const res = await fetch(`${ig.appUrl()}/.netlify/functions/agent-manager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Ya lo guardamos en el hilo: sin esto quedaría dos veces.
    body: JSON.stringify({ action: 'chat', orgId, leadId, message: texto, skipSaveUser: true }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.response) {
    console.error('[instagram-webhook] el agente no respondió:', data.error || res.status)
    return null
  }
  return data.response
}

// ── Mensaje directo ──────────────────────────────────────────────────────
async function alLlegarMensaje(db, cuenta, evento) {
  const { orgId, brandId } = cuenta
  if (evento.message?.is_echo) return                 // lo que mandamos nosotros
  const texto = evento.message?.text || ''
  const esAdjunto = !texto.trim()

  const usuarioId = String(evento.sender?.id || '')
  const cuentaId = String(evento.recipient?.id || '')
  if (!usuarioId || !cuentaId) return

  /* Sin token no se puede contestar, pero el mensaje tiene que entrar igual:
   * perder la respuesta es molesto, perder el mensaje es grave. */
  const token = await ig.leerToken(db, orgId, brandId).catch(() => null)
  if (!token) console.error('[instagram-webhook] la marca no tiene token: entra sin respuesta')

  /* El aviso solo trae el id de quien escribe. Sin esta consulta el lead nace
   * como "Sin nombre" y en el inbox no se sabe con quién estás hablando. */
  let nombre = null
  if (token) {
    try {
      const quien = await ig.perfilDeUsuario(token, usuarioId)
      nombre = quien.name || (quien.username ? `@${quien.username}` : null)
    } catch (e) {
      console.warn('[instagram-webhook] no se pudo saber quién escribió:', e.message)
    }
  }

  const lead = await buscarOCrearLead(db, orgId, { nombre, usuarioId, cuentaId })

  /* Guardar ANTES de decidir si se contesta: las tres salidas de abajo
   * —adjunto, agente pausado, handoff— dejaban el mensaje sin escribir en
   * ningún lado, y en las tres hay alguien esperando que lo lean. */
  const cuerpo = esAdjunto ? '📎 Archivo adjunto' : texto
  await guardarMensaje(db, orgId, lead.id, { role: 'user', text: cuerpo, channel: CANAL })
  await tocarLead(db, orgId, lead.id, { texto: cuerpo, delLead: true })

  if (esAdjunto) {
    console.log(`[instagram-webhook] lead ${lead.id} mandó un adjunto — guardado, sin respuesta automática`)
    return
  }
  if (lead.agentPaused) return
  if (lead.systemStage === 'handoff') return

  const respuesta = await preguntarAlAgente(orgId, lead.id, texto)
  if (!respuesta) return

  if (!token) return
  await ig.enviarMensaje(token, { id: usuarioId }, respuesta)
  await tocarLead(db, orgId, lead.id, { texto: respuesta, delLead: false })
}

// ── Comentario ───────────────────────────────────────────────────────────
/* El "comenta X y te mando el PDF". Se contesta en el hilo y además se manda
 * un privado a quien comentó — una sola vez por comentario, y sin que eso
 * abra la conversación: hasta que la persona responda, no se le puede
 * escribir otra vez. */
async function alLlegarComentario(db, cuenta, valor) {
  const { orgId, brandId } = cuenta
  const texto = valor.text || ''
  const comentarioId = valor.id
  console.log(`[instagram-webhook] comentario "${texto}" de ${valor.from?.username || '?'}`)
  const autorId = String(valor.from?.id || '')
  const cuentaId = String(cuenta.igUserId || '')

  if (!comentarioId || !texto) return
  if (autorId && autorId === cuentaId) return        // nos comentamos a nosotros

  const marca = await ig.marcaRef(db, orgId, brandId).get()
  const reglas = marca.data()?.comentarios
  if (!reglas?.activo) { console.log('[instagram-webhook] la regla está apagada'); return }

  const gatillo = String(reglas.palabra || '').trim().toLowerCase()
  if (gatillo && !texto.toLowerCase().includes(gatillo)) {
    console.log(`[instagram-webhook] sin la palabra "${gatillo}" — se ignora`)
    return
  }

  const token = await ig.leerToken(db, orgId, brandId)
  if (!token) return

  if (reglas.respuestaPublica) {
    await ig.responderComentario(token, comentarioId, reglas.respuestaPublica)
      .catch(e => console.error('[instagram-webhook] no se pudo responder el comentario:', e.message))
  }

  if (reglas.respuestaPrivada) {
    await ig.respuestaPrivada(token, comentarioId, reglas.respuestaPrivada)
      .catch(e => console.error('[instagram-webhook] no se pudo mandar el privado:', e.message))

    // Queda como lead desde ya: comentó pidiendo algo, eso es interés.
    if (autorId) {
      const lead = await buscarOCrearLead(db, orgId, {
        nombre: valor.from?.username || null, usuarioId: autorId, cuentaId,
      })
      await tocarLead(db, orgId, lead.id, { texto: `Comentó: ${texto}`, delLead: true })
    }
  }
}

// ── Puerta ───────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // Meta verifica la URL una vez, con un token que elegimos nosotros.
  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {}
    const esperado = process.env.IG_VERIFY_TOKEN
    const recibido = q['hub.verify_token']

    if (q['hub.mode'] === 'subscribe' && recibido && recibido === esperado) {
      return { statusCode: 200, body: q['hub.challenge'] || '' }
    }

    /* Un "Forbidden" pelado no dice si falta la variable, si el valor no
     * coincide o si llegó cortada. Esto lo distingue sin enseñar el valor:
     * solo si existe y cuántos caracteres tiene. */
    const pista = !esperado
      ? 'Falta IG_VERIFY_TOKEN en el entorno de la función. Revisa que su alcance incluya Functions y vuelve a desplegar.'
      : !recibido
        ? 'No llegó hub.verify_token en la URL.'
        : `El token no coincide. El del entorno tiene ${esperado.length} caracteres; el recibido, ${recibido.length}.`

    console.warn('[instagram-webhook] verificación rechazada:', pista)
    return { statusCode: 403, body: `Forbidden — ${pista}` }
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  /* Netlify puede entregar el cuerpo en base64 según el tipo de contenido.
   * La firma se calcula sobre los bytes originales, así que comprobarla sobre
   * el texto codificado falla siempre — y el síntoma sería idéntico a que
   * Meta no llamara: un 401 silencioso por cada evento real. */
  const crudo = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '')
  const h = event.headers || {}
  const firma = h['x-hub-signature-256'] || h['X-Hub-Signature-256'] || ''
  if (!ig.verificarFirma(crudo, firma)) {
    console.error('[instagram-webhook] firma inválida — evento descartado')
    return { statusCode: 401, body: 'Unauthorized' }
  }

  /* A Meta se le contesta rápido y siempre 200: si tarda o falla, reintenta
   * y acabamos procesando lo mismo varias veces. El trabajo va después. */
  let cuerpo
  try { cuerpo = JSON.parse(crudo) } catch { return { statusCode: 200, body: 'OK' } }

  /* Deja constancia de TODA llamada. Sin esto, "no pasó nada" puede ser que
   * Meta no llamó o que llamó y nos callamos, y son problemas opuestos. */
  console.log('[instagram-webhook] recibido:', JSON.stringify({
    objeto: cuerpo.object,
    entradas: (cuerpo.entry || []).map(e => ({
      id: e.id,
      mensajes: (e.messaging || []).length,
      cambios: (e.changes || []).map(c => c.field),
    })),
  }))

  let db
  try {
    db = initDb()

    /* Se guarda el evento tal cual llegó. Los registros de Netlify se pierden
     * o no se asocian a la petición, y sin ver lo que Meta manda de verdad no
     * hay forma de saber por qué se descarta. Esto se lee después desde el
     * diagnóstico. */
    await db.collection('_ig_crudos').add({
      cuerpo: JSON.stringify(cuerpo).slice(0, 20000),
      recibidoEn: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {})
  } catch (e) {
    console.error('[instagram-webhook] sin base de datos:', e)
    return { statusCode: 200, body: 'EVENT_RECEIVED' }
  }

  try {
    for (const entrada of cuerpo.entry || []) {
      const igUserId = String(entrada.id || '')
      const cuenta = await ig.cuentaDeInstagram(db, igUserId)
      if (!cuenta) {
        /* Queda anotado en la base, no solo en el registro: así se puede
         * comparar el id que manda Meta con el que tenemos guardado, que es
         * justo donde se rompe si no coinciden. */
        await db.collection('_ig_crudos').add({
          problema: `cuenta ${igUserId} no está en el índice`,
          recibidoEn: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {})
        continue
      }
      cuenta.igUserId = igUserId

      for (const m of entrada.messaging || []) {
        if (!(await reclamar(db, m.message?.mid))) continue
        await alLlegarMensaje(db, cuenta, m)
      }

      for (const cambio of entrada.changes || []) {
        if (cambio.field !== 'comments') continue
        if (!(await reclamar(db, cambio.value?.id))) continue
        await alLlegarComentario(db, cuenta, cambio.value || {})
      }
    }
  } catch (e) {
    console.error('[instagram-webhook] error procesando:', e)
  }

  return { statusCode: 200, body: 'EVENT_RECEIVED' }
}
