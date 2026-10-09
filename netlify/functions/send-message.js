const admin = require('firebase-admin')
const { initDb, sendMessage: sendViaZernio } = require('./lib/zernio')


exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const { orgId, leadId, text, channel } = JSON.parse(event.body)
    const db = initDb()

    if (!orgId || !leadId || !text || !channel) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) }
    }

    // Get lead channelIds
    const leadSnap = await db.collection('organizations').doc(orgId).collection('leads').doc(leadId).get()
    if (!leadSnap.exists) return { statusCode: 404, body: JSON.stringify({ error: 'Lead not found' }) }

    const lead = leadSnap.data()
    const channelUserId = lead.channelIds?.[channel] || lead.phone

    // Canales conectados por Zernio: el channelId del lead es el id de la
    // conversación en Zernio, y la cuenta está en la org.
    const org = (await db.collection('organizations').doc(orgId).get()).data() || {}
    if (org.zernioAccountId && lead.channelIds?.[channel]) {
      // A propósito sin try/catch: si no sale, no queremos guardar el mensaje
      // como enviado. Antes se tragaba el error y el Inbox mentía.
      await sendViaZernio(lead.channelIds[channel], org.zernioAccountId, text)
    } else if (channelUserId && channel !== 'web') {
      let url, body, token

      if (channel === 'whatsapp') {
        url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`
        token = process.env.WHATSAPP_TOKEN
        body = {
          messaging_product: 'whatsapp',
          to: channelUserId,
          type: 'text',
          text: { body: text },
        }
      } else {
        // messenger | instagram
        url = `https://graph.facebook.com/v19.0/me/messages`
        token = process.env.META_PAGE_ACCESS_TOKEN
        body = {
          recipient: { id: channelUserId },
          message: { text },
        }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error(`Meta send ${res.status}: ${await res.text()}`)
    }

    // Save message to Firestore
    await db.collection('organizations').doc(orgId)
      .collection('leads').doc(leadId)
      .collection('conversations').add({
        text,
        channel,
        role: 'agent', // sent by human agent
        read: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

    await db.collection('organizations').doc(orgId)
      .collection('leads').doc(leadId)
      .update({
        lastMessage: text,
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageChannel: channel,
        hasUnread: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    }
  } catch (err) {
    console.error('send-message error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
