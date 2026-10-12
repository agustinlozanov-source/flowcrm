// Cliente de Google Calendar sobre la API REST, sin el paquete googleapis:
// esa dependencia no está en el package.json raíz y hace el bundle enorme.
const admin = require('firebase-admin')

const SCOPE = 'https://www.googleapis.com/auth/calendar'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars'
const CAL_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList'

// Una cuenta de Google puede tener varias agendas (personal, consultorio,
// quirófano). Antes mandábamos todo a 'primary' sin preguntar; ahora 'primary'
// es solo el valor por defecto cuando la org todavía no eligió ninguna.
function eventsUrl(calendarId) {
  return `${CAL_BASE}/${encodeURIComponent(calendarId || 'primary')}/events`
}

function appUrl() {
  return process.env.URL || process.env.DEPLOY_URL || 'https://flowhubcrm.app'
}

function redirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || `${appUrl()}/.netlify/functions/google-callback`
}

function integrationsRef(db, orgId) {
  return db.collection('organizations').doc(orgId).collection('settings').doc('integrations')
}

function authUrl(state) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    // Sin esto Google no devuelve refresh_token en las reautorizaciones.
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`
}

async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`)
  return res.json()
}

// Devuelve un access token vigente, refrescándolo y persistiéndolo si venció.
// El backend viejo no guardaba el token refrescado, así que lo renovaba en
// cada llamada sin necesidad.
async function getAccessToken(db, orgId) {
  const snap = await integrationsRef(db, orgId).get()
  const t = snap.data()?.googleCalendar
  if (!t?.connected) throw new Error('Google Calendar no conectado')

  const margin = 60_000 // refrescar un minuto antes de que venza
  if (t.accessToken && t.expiryDate && Date.now() < t.expiryDate - margin) {
    return t.accessToken
  }
  if (!t.refreshToken) throw new Error('Falta el refresh token — reconectá Google Calendar')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: t.refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google refresh ${res.status}: ${await res.text()}`)
  const fresh = await res.json()

  await integrationsRef(db, orgId).set({
    googleCalendar: {
      accessToken: fresh.access_token,
      expiryDate: Date.now() + (fresh.expires_in || 3600) * 1000,
    },
  }, { merge: true })

  return fresh.access_token
}

async function saveTokens(db, orgId, tokens) {
  await integrationsRef(db, orgId).set({
    googleCalendar: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: Date.now() + (tokens.expires_in || 3600) * 1000,
      connected: true,
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  }, { merge: true })
}

// La agenda elegida por la org, o la principal si nunca eligió.
async function getCalendarId(db, orgId) {
  const snap = await integrationsRef(db, orgId).get()
  return snap.data()?.googleCalendar?.calendarId || 'primary'
}

async function setCalendarId(db, orgId, calendarId, calendarName) {
  await integrationsRef(db, orgId).set({
    googleCalendar: { calendarId, calendarName: calendarName || '' },
  }, { merge: true })
}

// Solo las agendas donde esta cuenta puede crear eventos: las de solo lectura
// (feriados, calendarios suscritos) no sirven de nada acá.
async function listCalendars(token) {
  const res = await fetch(`${CAL_LIST_URL}?minAccessRole=writer`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.items || []).map(c => ({
    id: c.id,
    name: c.summaryOverride || c.summary,
    primary: !!c.primary,
    color: c.backgroundColor || '',
  }))
}

// withMeet=false para las citas presenciales: ahí no hay videollamada que
// crear, y en cambio sí hay una sede a la que el lead tiene que llegar.
async function createEvent(token, { title, scheduledAt, duration, leadEmail, leadName, notes, location, withMeet = true, calendarId }) {
  const start = new Date(scheduledAt)
  const end = new Date(start.getTime() + (duration || 30) * 60000)

  const res = await fetch(`${eventsUrl(calendarId)}?conferenceDataVersion=1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: title,
      description: notes || '',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      ...(location ? { location } : {}),
      ...(withMeet ? { conferenceData: { createRequest: { requestId: `flowcrm-${Date.now()}` } } } : {}),
      attendees: leadEmail ? [{ email: leadEmail, displayName: leadName }] : [],
    }),
  })
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${await res.text()}`)
  const ev = await res.json()
  // Devolvemos la agenda usada para poder borrar el evento más tarde aunque
  // la org haya cambiado de agenda en el medio.
  return {
    meetLink: ev.conferenceData?.entryPoints?.[0]?.uri || '',
    eventId: ev.id,
    calendarId: calendarId || 'primary',
  }
}

async function deleteEvent(token, eventId, calendarId) {
  const res = await fetch(`${eventsUrl(calendarId)}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  // 410 = ya estaba borrado; 404 = no existe. Ninguno es un fallo real.
  if (!res.ok && ![404, 410].includes(res.status)) {
    throw new Error(`Google Calendar ${res.status}: ${await res.text()}`)
  }
}

module.exports = {
  authUrl, exchangeCode, saveTokens, getAccessToken,
  createEvent, deleteEvent, listCalendars, getCalendarId, setCalendarId, appUrl,
}
