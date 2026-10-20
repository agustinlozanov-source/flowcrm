/* Transcripción con tiempos palabra por palabra.
 *
 * Palabra por palabra no es un lujo: sobre esos tiempos se decide después qué
 * pedazo del video se queda y cuál se va. Sin ellos no hay fileteado, solo un
 * texto bonito.
 *
 * Va por Deepgram y no por Whisper porque Whisper exige subirle el archivo y
 * topa en 25 MB — un video de tres minutos no cabe. Deepgram recibe la URL y
 * lo descarga él. El proveedor se cambia tocando solo este archivo.
 */
const BASE = 'https://api.deepgram.com/v1/listen'

// nova-3 es el bueno; si una cuenta todavía no lo tiene, nova-2 también habla
// español. Se intenta en ese orden en vez de dar el error en la cara.
const MODELOS = ['nova-3', 'nova-2']

function hayProveedor() {
  return Boolean(process.env.DEEPGRAM_API_KEY)
}

async function pedir(modelo, url, idioma) {
  const p = new URLSearchParams({
    model: modelo,
    language: idioma || 'es',
    punctuate: 'true',
    smart_format: 'true',
    paragraphs: 'true',
    // Por defecto se las come, y para nosotros son justo lo que hay que
    // cortar: si no vienen escritas no tienen segundo, y sin segundo no hay
    // forma de quitarlas del video aunque el texto se lea perfecto.
    filler_words: 'true',
  })
  const res = await fetch(`${BASE}?${p}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  })
  const cuerpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = cuerpo?.err_msg || cuerpo?.message || cuerpo?.error || `HTTP ${res.status}`
    const e = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    e.estado = res.status
    throw e
  }
  return cuerpo
}

async function transcribir(url, { idioma } = {}) {
  if (!hayProveedor()) {
    const e = new Error('SIN_PROVEEDOR')
    e.sinProveedor = true
    throw e
  }

  let crudo = null
  let usado = null
  let ultimo = null
  for (const modelo of MODELOS) {
    try { crudo = await pedir(modelo, url, idioma); usado = modelo; break }
    catch (e) { ultimo = e; if (e.estado !== 400 && e.estado !== 404) throw e }
  }
  if (!crudo) throw ultimo || new Error('No se pudo transcribir')

  const alt = crudo.results?.channels?.[0]?.alternatives?.[0] || {}
  const palabras = (alt.words || []).map(w => ({
    // Con puntuación se lee; sin ella se busca. Guardamos la primera y
    // minúsculas aparte para poder cazar muletillas sin pelear con comas.
    texto: w.punctuated_word || w.word || '',
    plano: (w.word || '').toLowerCase(),
    inicio: w.start,
    fin: w.end,
    confianza: w.confidence ?? null,
  }))

  return {
    texto: alt.transcript || '',
    palabras,
    duracion: crudo.metadata?.duration ?? null,
    modelo: usado,
    idioma: idioma || 'es',
  }
}

module.exports = { hayProveedor, transcribir }
