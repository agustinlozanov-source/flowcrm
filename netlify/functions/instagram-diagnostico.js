// Por qué una cuenta no recibe eventos.
//
// Son cuatro cosas distintas con el mismo síntoma —no pasa nada— y mirarlas
// de una en una a ciegas cuesta más que preguntarlas todas juntas.
//
//   /.netlify/functions/instagram-diagnostico?handle=coach.lozano&token=EL_DE_VERIFICACION
//
// Con &sondeo=1 prueba además si se puede leer comentarios y mensajes sin
// webhook, que es el plan B mientras Meta no dé Acceso avanzado.
const { initDb } = require('./lib/firebase')
const ig = require('./lib/instagram')

exports.handler = async (event) => {
  const q = event.queryStringParameters || {}

  // Se protege con el token de verificación que ya existe: esto dice si una
  // cuenta está conectada, y eso no es para cualquiera.
  if (!process.env.IG_VERIFY_TOKEN || q.token !== process.env.IG_VERIFY_TOKEN) {
    return { statusCode: 403, body: 'Forbidden' }
  }

  /* Con ?crudos=1 devuelve lo último que mandó Meta, tal cual. Es lo que
   * permite comparar el id de cuenta que trae el evento con el que tenemos
   * guardado — donde se rompe todo si no coinciden. */
  if (q.crudos) {
    const db = initDb()
    const snap = await db.collection('_ig_crudos')
      .orderBy('recibidoEn', 'desc').limit(Number(q.crudos) || 5).get()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(snap.docs.map(d => {
        const x = d.data()
        return {
          cuando: x.recibidoEn?.toDate?.()?.toISOString() || null,
          problema: x.problema || null,
          cuerpo: x.cuerpo ? JSON.parse(x.cuerpo) : null,
        }
      }), null, 2),
    }
  }

  const handle = String(q.handle || '').replace(/^@/, '').toLowerCase()
  if (!handle) return { statusCode: 400, body: 'Falta ?handle=' }

  const pasos = []
  const responder = () => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ handle, pasos }, null, 2),
  })
  const paso = (nombre, bien, detalle) => pasos.push({ paso: nombre, bien, detalle })

  try {
    const db = initDb()

    // 1 · ¿Existe la marca?
    let orgId = null, brandId = null, marca = null
    const orgs = await db.collection('organizations').get()
    for (const org of orgs.docs) {
      const b = await org.ref.collection('brands').where('handle', '==', handle).limit(1).get()
      if (!b.empty) { orgId = org.id; brandId = b.docs[0].id; marca = b.docs[0].data(); break }
    }
    if (!marca) {
      paso('marca', false, `Ninguna marca con el handle "${handle}".`)
      return responder()
    }
    paso('marca', true, `${marca.nombre} · pipeline ${marca.pipelineId || 'SIN ASIGNAR'}`)
    if (!marca.pipelineId) {
      paso('pipeline', false, 'La marca no tiene pipeline: los mensajes llegarían sin saber a dónde ir.')
    }

    // 2 · ¿Hay token guardado y sirve?
    let token = null
    try {
      token = await ig.leerToken(db, orgId, brandId)
      paso('token', Boolean(token), token ? 'Guardado y descifrado.' : 'No hay token guardado.')
    } catch (e) {
      paso('token', false, `No se pudo leer: ${e.message}`)
    }
    if (!token) return responder()

    let igUserId = null
    try {
      const datos = await ig.perfil(token)
      igUserId = String(datos.user_id || datos.id || '')
      paso('cuenta', true, `@${datos.username} · id ${igUserId} · ${datos.account_type || 'sin tipo'}`)
    } catch (e) {
      paso('cuenta', false, `El token no sirve: ${e.message}`)
      return responder()
    }

    // 3 · ¿Está en el índice que usa el webhook?
    const enIndice = await ig.cuentaDeInstagram(db, igUserId)
    paso('indice', Boolean(enIndice),
      enIndice ? `Apunta a la marca ${enIndice.brandId}.` : 'No está: el webhook recibiría el evento sin saber de quién es.')

    // 4 · ¿Meta tiene la app suscrita a esta cuenta?
    try {
      const subs = await ig.suscritoA(token)
      const campos = (subs?.data || []).flatMap(x => x.subscribed_fields || [])
      const tiene = ['messages', 'comments'].filter(c => campos.includes(c))
      paso('suscripcion', tiene.length === 2,
        campos.length ? `Campos activos: ${campos.join(', ')}` : 'La app NO está suscrita a esta cuenta: Meta no va a mandar nada.')
    } catch (e) {
      paso('suscripcion', false, `No se pudo consultar: ${e.message}`)
    }

    /* 4b · ¿Podemos enterarnos SIN webhook?
     *
     * Los webhooks exigen Acceso avanzado de Meta, que es un trámite. Leer no.
     * Si estas dos lecturas responden con el token que ya tenemos, el sistema
     * puede sondear cada tanto y funcionar igual, sin esperar a Meta. Se pide
     * con ?sondeo=1 porque gasta varias llamadas a la API. */
    if (q.sondeo) {
      // Comentarios: se prueba sobre la publicación más reciente que tenga.
      try {
        const medios = await ig.publicaciones(token, 10)
        const conComentarios = medios.find(m => (m.comments_count || 0) > 0) || medios[0]
        if (!conComentarios) {
          paso('leer-comentarios', false, 'La cuenta no tiene publicaciones para probar.')
        } else {
          const lista = await ig.comentariosDe(token, conComentarios.id, 10)
          paso('leer-comentarios', true,
            `SÍ se pueden leer. ${lista.length} comentario(s) en ${conComentarios.permalink || conComentarios.id}` +
            (lista[0] ? ` · el último: "${lista[0].text}" de @${lista[0].username}` : ''))
        }
      } catch (e) {
        paso('leer-comentarios', false, `NO se pueden leer: ${e.message}`)
      }

      // Mensajes: la lista de conversaciones y el último mensaje de la primera.
      try {
        const convs = await ig.conversaciones(token, 10)
        if (!convs.length) {
          paso('leer-mensajes', true, 'SÍ se puede leer el inbox, pero está vacío. Mándate un DM y vuelve a correr esto.')
        } else {
          let detalle = `SÍ se puede leer. ${convs.length} conversación(es).`
          try {
            const msgs = await ig.mensajesDe(token, convs[0].id, 3)
            if (msgs[0]) detalle += ` El último mensaje: "${msgs[0].message}" de ${msgs[0].from?.username || msgs[0].from?.id || '?'}`
          } catch (e) {
            detalle += ` Pero los mensajes de adentro no: ${e.message}`
          }
          paso('leer-mensajes', true, detalle)
        }
      } catch (e) {
        paso('leer-mensajes', false, `NO se puede leer el inbox: ${e.message}`)
      }
    }

    // 5 · Las reglas de comentarios
    const c = marca.comentarios
    paso('comentarios', Boolean(c?.activo),
      !c ? 'Sin configurar.'
        : !c.activo ? 'Configurado pero apagado.'
          : `Activo · palabra "${c.palabra || '(todas)'}" · privado ${c.respuestaPrivada ? 'sí' : 'NO'}`)

    return responder()
  } catch (e) {
    paso('error', false, e.message)
    return responder()
  }
}
