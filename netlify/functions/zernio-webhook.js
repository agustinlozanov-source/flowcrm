// Receptor de eventos de Zernio. Es la ÚNICA fuente de verdad del estado de
// conexión: la UI escucha organizations/{orgId}/settings/integrations en
// tiempo real, así que acá escribimos y la pantalla se actualiza sola.
const admin = require('firebase-admin')
const { initDb, verifyWebhookSignature } = require('./lib/zernio')

// Zernio manda el mismo dato con nombres distintos según el evento.
const profileIdOf = (p) => p.profileId || p.account?.profileId || p.profile?._id || null
const accountIdOf = (p) => p.account?.id || p.account?.accountId || p.accountId || null
const platformOf = (p) => p.account?.platform || p.platform || 'whatsapp'
// En WhatsApp el "username" de la cuenta es el número de teléfono.
const phoneOf = (p) => p.account?.phoneNumber || p.phoneNumber || p.account?.username || null

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  const rawBody = event.body || ''
  const h = event.headers || {}
  const signature = h['x-zernio-signature'] || h['X-Zernio-Signature'] || ''
  const eventId = h['x-zernio-event-id'] || h['X-Zernio-Event-Id'] || null

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('[zernio-webhook] firma inválida — evento descartado')
    return { statusCode: 401, body: 'Unauthorized' }
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const db = initDb()

  // Idempotencia: Zernio reintenta los eventos. create() falla si el id ya
  // existe, y eso significa que este evento ya se procesó.
  if (eventId) {
    try {
      await db.collection('zernio_events').doc(eventId).create({
        event: payload.event || null,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    } catch {
      return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicado' }) }
    }
  }

  try {
    const profileId = profileIdOf(payload)
    if (!profileId) {
      console.warn('[zernio-webhook] evento sin profileId — skip:', payload.event)
      return { statusCode: 200, body: JSON.stringify({ skipped: 'sin profileId' }) }
    }

    const orgSnap = await db.collection('organizations')
      .where('zernioProfileId', '==', profileId).limit(1).get()
    if (orgSnap.empty) {
      console.warn(`[zernio-webhook] profile ${profileId} no pertenece a ninguna org — skip`)
      return { statusCode: 200, body: JSON.stringify({ skipped: 'org no encontrada' }) }
    }

    const orgId = orgSnap.docs[0].id
    const platform = platformOf(payload)
    const ref = db.collection('organizations').doc(orgId)
      .collection('settings').doc('integrations')
    const now = admin.firestore.FieldValue.serverTimestamp()

    switch (payload.event) {
      case 'account.connected': {
        const data = { connected: true, accountId: accountIdOf(payload), connectedAt: now }
        const phone = phoneOf(payload)
        if (phone) data.assignedNumber = phone
        await ref.set({ [platform]: data }, { merge: true })
        console.log(`[zernio-webhook] ${platform} conectado para org ${orgId}`)
        break
      }
      case 'account.disconnected': {
        await ref.set({ [platform]: { connected: false, disconnectedAt: now } }, { merge: true })
        console.log(`[zernio-webhook] ${platform} desconectado para org ${orgId}`)
        break
      }
      case 'whatsapp.number.activated': {
        const phone = phoneOf(payload)
        await ref.set({
          whatsapp: { connected: true, assignedNumber: phone, activatedAt: now },
        }, { merge: true })
        console.log(`[zernio-webhook] número ${phone} activado para org ${orgId}`)
        break
      }
      default:
        console.log('[zernio-webhook] evento ignorado:', payload.event)
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (e) {
    // 200 a propósito: si devolvemos error, Zernio reintenta y el evento ya
    // quedó reclamado en zernio_events, así que el reintento se descartaría igual.
    console.error('[zernio-webhook] error procesando evento:', e)
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) }
  }
}
