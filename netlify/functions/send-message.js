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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  try {
    const { orgId, leadId, text, channel } = JSON.parse(event.body)

    if (!orgId || !leadId || !text || !channel) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) }
    }

    // Get lead channelIds
    const leadSnap = await db.collection('organizations').doc(orgId).collection('leads').doc(leadId).get()
    if (!leadSnap.exists) return { statusCode: 404, body: JSON.stringify({ error: 'Lead not found' }) }

    const lead = leadSnap.data()
    const channelUserId = lead.channelIds?.[channel] || lead.phone

    // Send via Meta API
    if (channelUserId && channel !== 'web') {
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

      if (!res.ok) {
        const err = await res.json()
        console.error('Meta send error:', err)
      }
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
