// netlify/functions/telegram-reply.js
// Called by Superadmin when agent replies to a ticket

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const { chatId, ticketId, message } = body

  if (!chatId || !message) {
    return { statusCode: 400, body: 'Missing chatId or message' }
  }

  try {
    const text = `📩 *Respuesta de Qubit Corp.* — Ticket #${ticketId}\n\n${message}`

    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      }
    )

    const data = await res.json()

    if (!data.ok) {
      console.error('Telegram error:', data)
      return { statusCode: 500, body: `Telegram error: ${data.description}` }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('Reply error:', err)
    return { statusCode: 500, body: err.message }
  }
}
