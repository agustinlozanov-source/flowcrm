/* Escuchar el audio, no solo leer el texto.
 *
 * El fileteado por transcripción tiene un techo: asume que entre palabra y
 * palabra hay silencio, y cuando se habla de corrido no lo hay. Cortar en un
 * silencio que no existe es cortar dentro del sonido, y se oye.
 *
 * Esto se hace en el navegador y en el momento de subir, mientras el archivo
 * todavía está aquí. Así no hay que volver a descargarlo, no hace falta
 * configurar permisos de origen cruzado, y no cuesta nada.
 *
 * De la onda salen dos cosas: dónde se calla de verdad, y dónde hay sonido
 * que la transcripción no recogió — que es donde viven los "eeeh" de arrastre
 * y las respiraciones.
 */

const HZ = 25            // muestras del envolvente por segundo
const MIN_SILENCIO = 0.18 // por debajo de esto no es una pausa, es un hueco entre sílabas

/** Potencia del sonido en ventanas regulares, de 0 a 100. */
function envolvente(canal, tasa, hz) {
  const porVentana = Math.max(1, Math.round(tasa / hz))
  const n = Math.floor(canal.length / porVentana)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let suma = 0
    const desde = i * porVentana
    for (let j = 0; j < porVentana; j++) {
      const v = canal[desde + j]
      suma += v * v
    }
    out[i] = Math.sqrt(suma / porVentana)
  }
  return out
}

/* El umbral no puede ser fijo: una grabación en el coche tiene un ruido de
 * fondo que en un estudio sería voz. Se saca del propio material — el suelo de
 * ruido es lo que suena en los tramos más callados, y se corta bastante por
 * encima de eso. */
function umbralDe(rms) {
  const orden = Array.from(rms).sort((a, b) => a - b)
  const suelo = orden[Math.floor(orden.length * 0.10)] || 0
  const alto = orden[Math.floor(orden.length * 0.95)] || 1
  // Entre el suelo y la voz, más cerca del suelo.
  return Math.max(suelo * 2.5, suelo + (alto - suelo) * 0.08)
}

function tramosBajoUmbral(rms, hz, umbral, minimo) {
  const tramos = []
  let desde = null
  for (let i = 0; i < rms.length; i++) {
    if (rms[i] < umbral) {
      if (desde === null) desde = i
    } else if (desde !== null) {
      const largo = (i - desde) / hz
      if (largo >= minimo) tramos.push({ inicio: desde / hz, fin: i / hz })
      desde = null
    }
  }
  if (desde !== null) {
    const largo = (rms.length - desde) / hz
    if (largo >= minimo) tramos.push({ inicio: desde / hz, fin: rms.length / hz })
  }
  return tramos
}

/** Analiza el audio de un archivo de video o audio. */
export async function analizar(file, { hz = HZ } = {}) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
    const canal = buffer.numberOfChannels > 1
      ? mezclar(buffer)
      : buffer.getChannelData(0)

    const rms = envolvente(canal, buffer.sampleRate, hz)
    const umbral = umbralDe(rms)
    const silencios = tramosBajoUmbral(rms, hz, umbral, MIN_SILENCIO)

    return {
      hz,
      duracion: buffer.duration,
      silencios,
      // Se guarda en enteros de 0 a 100: un video de cuatro minutos son unos
      // seis mil números, que caben de sobra y sirven para dibujar la onda.
      envolvente: Array.from(rms, v => Math.round(Math.min(1, v / (umbral * 8 || 1)) * 100)),
      umbral,
    }
  } finally {
    ctx.close()
  }
}

function mezclar(buffer) {
  const n = buffer.length
  const out = new Float32Array(n)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const datos = buffer.getChannelData(c)
    for (let i = 0; i < n; i++) out[i] += datos[i]
  }
  for (let i = 0; i < n; i++) out[i] /= buffer.numberOfChannels
  return out
}

/** ¿Hay silencio de verdad en este instante? */
export function esSilencio(silencios, t, margen = 0) {
  return silencios.some(s => t >= s.inicio - margen && t <= s.fin + margen)
}

/* Sonido que la transcripción no recogió: eso es un "eeeh", una respiración o
 * un chasquido. Es la señal que ninguna de las dos fuentes da por separado. */
export function sonidoSinPalabras(analisis, palabras, { minimo = 0.45 } = {}) {
  if (!analisis?.silencios || !palabras?.length) return []
  const huecos = []
  for (let i = 1; i < palabras.length; i++) {
    const desde = palabras[i - 1].fin
    const hasta = palabras[i].inicio
    if (hasta - desde < minimo) continue

    // Cuánto de ese hueco es silencio de verdad.
    const callado = analisis.silencios.reduce((a, s) => {
      const ini = Math.max(desde, s.inicio)
      const fin = Math.min(hasta, s.fin)
      return a + Math.max(0, fin - ini)
    }, 0)

    const conSonido = (hasta - desde) - callado
    // Si más de un tercio de segundo de ese hueco tiene sonido, ahí hay algo
    // que no es ni palabra ni silencio.
    if (conSonido >= 0.33) huecos.push({ inicio: desde, fin: hasta, conSonido })
  }
  return huecos
}

/* Dónde cortar entre dos instantes, ahora sí con el oído puesto: el centro
 * del silencio real que haya entre ellos. Si no hay silencio, devuelve null y
 * el tramo NO se corta — es preferible dejar una muletilla que partir una
 * palabra. */
export function puntoDeCorte(silencios, desde, hasta) {
  const dentro = silencios.filter(s => s.fin > desde && s.inicio < hasta)
  if (!dentro.length) return null
  const mayor = dentro.reduce((a, b) => (b.fin - b.inicio > a.fin - a.inicio ? b : a))
  return (Math.max(mayor.inicio, desde) + Math.min(mayor.fin, hasta)) / 2
}
