/* La pista de audio del video ya cortado, hecha de verdad.
 *
 * Esto es lo que resuelve el problema del corte seco. La vista previa saltaba
 * sobre el archivo original, y cada salto es un empalme a cuchillo: chasquea.
 * Aquí se construye el audio completo del montaje en un solo trozo, bajando
 * el volumen veinte milisegundos antes de cada corte y subiéndolo después.
 * El oído no lo registra; el chasquido desaparece.
 *
 * Se hace fuera de tiempo real: cuatro minutos de audio se montan en un par
 * de segundos. No es una reproducción, es una mezcla.
 */

// Suficiente para matar el chasquido, demasiado corto para oírse como fundido.
const FUNDIDO = 0.02

/** Pasa un instante del video original al instante que le toca en el montaje. */
export function aTiempoDeMontaje(segmentos, t) {
  let acumulado = 0
  for (const s of segmentos) {
    if (t < s.inicio) return acumulado
    if (t <= s.fin) return acumulado + (t - s.inicio)
    acumulado += s.fin - s.inicio
  }
  return acumulado
}

/** Y al revés: del montaje al original, que es lo que necesita el reproductor. */
export function aTiempoOriginal(segmentos, t) {
  let acumulado = 0
  for (const s of segmentos) {
    const largo = s.fin - s.inicio
    if (t <= acumulado + largo) return s.inicio + (t - acumulado)
    acumulado += largo
  }
  return segmentos.length ? segmentos[segmentos.length - 1].fin : 0
}

/** Decodifica el audio del archivo una sola vez. */
export async function decodificar(file) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  try {
    return await ctx.decodeAudioData(await file.arrayBuffer())
  } finally {
    ctx.close()
  }
}

/**
 * Monta el audio de los tramos conservados en una sola pista continua.
 * @returns AudioBuffer con la duración exacta del montaje
 */
export async function mezclar(buffer, segmentos, { fundido = FUNDIDO } = {}) {
  const duracion = segmentos.reduce((a, s) => a + (s.fin - s.inicio), 0)
  if (duracion <= 0) throw new Error('No queda audio que montar')

  const ctx = new OfflineAudioContext(
    Math.min(2, buffer.numberOfChannels),
    Math.ceil(duracion * buffer.sampleRate),
    buffer.sampleRate
  )

  let cursor = 0
  for (const s of segmentos) {
    const largo = s.fin - s.inicio
    if (largo <= 0.001) continue
    const f = Math.min(fundido, largo / 4)

    const fuente = ctx.createBufferSource()
    fuente.buffer = buffer
    const vol = ctx.createGain()
    fuente.connect(vol).connect(ctx.destination)

    // Entra desde cero y sale a cero: el empalme deja de existir.
    vol.gain.setValueAtTime(0, cursor)
    vol.gain.linearRampToValueAtTime(1, cursor + f)
    vol.gain.setValueAtTime(1, cursor + largo - f)
    vol.gain.linearRampToValueAtTime(0, cursor + largo)

    fuente.start(cursor, s.inicio, largo)
    cursor += largo
  }

  return ctx.startRendering()
}

/** AudioBuffer a WAV, que es lo que entiende todo el mundo sin convertir. */
export function aWav(buffer) {
  const canales = buffer.numberOfChannels
  const muestras = buffer.length
  const bytes = muestras * canales * 2
  const vista = new DataView(new ArrayBuffer(44 + bytes))

  const texto = (pos, s) => { for (let i = 0; i < s.length; i++) vista.setUint8(pos + i, s.charCodeAt(i)) }
  texto(0, 'RIFF'); vista.setUint32(4, 36 + bytes, true); texto(8, 'WAVE')
  texto(12, 'fmt '); vista.setUint32(16, 16, true); vista.setUint16(20, 1, true)
  vista.setUint16(22, canales, true); vista.setUint32(24, buffer.sampleRate, true)
  vista.setUint32(28, buffer.sampleRate * canales * 2, true)
  vista.setUint16(32, canales * 2, true); vista.setUint16(34, 16, true)
  texto(36, 'data'); vista.setUint32(40, bytes, true)

  const pistas = Array.from({ length: canales }, (_, c) => buffer.getChannelData(c))
  let pos = 44
  for (let i = 0; i < muestras; i++) {
    for (let c = 0; c < canales; c++) {
      const v = Math.max(-1, Math.min(1, pistas[c][i]))
      vista.setInt16(pos, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      pos += 2
    }
  }
  return new Blob([vista.buffer], { type: 'audio/wav' })
}
