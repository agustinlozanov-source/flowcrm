// Crea o borra eventos en Google Calendar.
// Reemplaza a POST /meetings/google/create y DELETE /meetings/google/delete
// (esta última nunca existió en el backend: el front la llamaba y daba 404,
// así que borrar una cita dejaba el evento vivo en el calendario).
const { initDb } = require('./lib/firebase')
const {
  getAccessToken, createEvent, deleteEvent,
  listCalendars, getCalendarId, setCalendarId,
} = require('./lib/google')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  const headers = { 'Content-Type': 'application/json' }

  try {
    const body = JSON.parse(event.body || '{}')
    const { action, orgId } = body
    if (!orgId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'orgId es requerido' }) }

    const db = initDb()
    const token = await getAccessToken(db, orgId)

    // Lista las agendas de la cuenta para que la org elija a cuál agendar.
    if (action === 'list-calendars') {
      const calendars = await listCalendars(token)
      const selected = await getCalendarId(db, orgId)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, calendars, selected }) }
    }

    if (action === 'set-calendar') {
      if (!body.calendarId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'calendarId es requerido' }) }
      }
      await setCalendarId(db, orgId, body.calendarId, body.calendarName)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (action === 'delete') {
      if (!body.googleEventId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'googleEventId es requerido' }) }
      }
      // La agenda donde se creó, no la que esté elegida hoy: si la cambiaron
      // en el medio, el evento viejo sigue viviendo en la anterior.
      const calendarId = body.googleCalendarId || await getCalendarId(db, orgId)
      await deleteEvent(token, body.googleEventId, calendarId)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    if (!body.title || !body.scheduledAt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'title y scheduledAt son requeridos' }) }
    }
    const calendarId = await getCalendarId(db, orgId)
    const result = await createEvent(token, { ...body, calendarId })
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...result }) }
  } catch (e) {
    console.error('google-event error:', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) }
  }
}
