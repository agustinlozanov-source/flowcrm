/* De los cortes a un archivo que Premiere entienda.
 *
 * Se genera aquí, en el navegador, porque ya tenemos todos los datos: no hace
 * falta molestar a un servidor para armar un texto.
 *
 * El formato es el XML viejo de Final Cut 7 (xmeml) y no el FCPXML moderno,
 * porque Premiere lleva veinte años importando el primero y es el que entra
 * sin pelear.
 *
 * Premiere trabaja en fotogramas, no en segundos, así que todo se convierte
 * con los cuadros por segundo del material. Si eso no coincide, los cortes
 * quedan corridos — por eso se pregunta en vez de adivinarse.
 */

/** Los tramos que SÍ se quedan, que son los huecos entre los cortes. */
export function segmentosConservados(cortes, duracion) {
  const fuera = (cortes || [])
    .filter(c => c.activo !== false)
    .slice()
    .sort((a, b) => a.inicio - b.inicio)

  const dentro = []
  let cursor = 0
  for (const c of fuera) {
    if (c.inicio > cursor + 0.05) dentro.push({ inicio: cursor, fin: c.inicio })
    cursor = Math.max(cursor, c.fin)
  }
  if (duracion > cursor + 0.05) dentro.push({ inicio: cursor, fin: duracion })
  return dentro
}

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

/** El XML de la secuencia, con una pista de video y una de audio. */
export function aXML({ segmentos, nombre, archivo, rutaLocal, fps = 30, ancho = 1080, alto = 1920, duracionTotal }) {
  const f = (s) => Math.round(s * fps)
  const totalCuadros = f(duracionTotal || 0)
  // Premiere pide una ruta de archivo. Casi nunca va a acertar, y no pasa
  // nada: muestra "media offline" y se vuelve a enlazar una vez, con un clic.
  const pathurl = `file://localhost/${esc(rutaLocal || archivo || 'video.mp4')}`

  // El archivo se describe entero UNA vez y después solo se le hace
  // referencia por su id. Declararlo dos veces confunde al importador.
  let yaDeclarado = false
  const ficha = () => {
    if (yaDeclarado) return `
          <file id="origen"/>`
    yaDeclarado = true
    return `
          <file id="origen">
            <name>${esc(archivo)}</name>
            <pathurl>${pathurl}</pathurl>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <duration>${totalCuadros}</duration>
            <media>
              <video><samplecharacteristics><width>${ancho}</width><height>${alto}</height></samplecharacteristics></video>
              <audio><channelcount>2</channelcount></audio>
            </media>
          </file>`
  }

  let cursor = 0
  const video = []
  const audio = []
  segmentos.forEach((s, i) => {
    const largo = f(s.fin) - f(s.inicio)
    if (largo <= 0) return
    const inicioLinea = cursor
    cursor += largo
    const comun = `
            <name>${esc(archivo)}</name>
            <duration>${totalCuadros}</duration>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <start>${inicioLinea}</start>
            <end>${cursor}</end>
            <in>${f(s.inicio)}</in>
            <out>${f(s.fin)}</out>`
    video.push(`          <clipitem id="v${i}">${comun}${ficha()}
          </clipitem>`)
    audio.push(`          <clipitem id="a${i}">${comun}${ficha()}
            <sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>
          </clipitem>`)
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="secuencia">
    <name>${esc(nombre)}</name>
    <duration>${cursor}</duration>
    <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <width>${ancho}</width>
            <height>${alto}</height>
          </samplecharacteristics>
        </format>
        <track>
${video.join('\n')}
        </track>
      </video>
      <audio>
        <track>
${audio.join('\n')}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>
`
}

const reloj = (s) => {
  const ms = Math.round((s % 1) * 1000)
  const t = Math.floor(s)
  const h = String(Math.floor(t / 3600)).padStart(2, '0')
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0')
  const seg = String(t % 60).padStart(2, '0')
  return `${h}:${m}:${seg},${String(ms).padStart(3, '0')}`
}

/* Los subtítulos van con los tiempos del video YA cortado, no del crudo. Si
 * se exportaran con los tiempos originales irían corriéndose cada vez más
 * según avanza el video, que es el error clásico. */
export function aSRT({ palabras, cortes, duracion, porLinea = 7 }) {
  const segmentos = segmentosConservados(cortes, duracion)

  // Cuánto se ha quitado antes de un instante dado.
  const trasladar = (t) => {
    let fuera = 0
    for (const s of segmentos) {
      if (t < s.inicio) break
      if (t <= s.fin) return t - s.inicio + fuera
      fuera += s.fin - s.inicio
    }
    return null   // cae dentro de un corte: no se subtitula
  }

  const vivas = (palabras || [])
    .map(p => ({ ...p, desde: trasladar(p.inicio), hasta: trasladar(p.fin) }))
    .filter(p => p.desde !== null && p.hasta !== null)

  const lineas = []
  for (let i = 0; i < vivas.length; i += porLinea) {
    const grupo = vivas.slice(i, i + porLinea)
    lineas.push({
      desde: grupo[0].desde,
      hasta: grupo[grupo.length - 1].hasta,
      texto: grupo.map(p => p.texto).join(' '),
    })
  }

  return lineas
    .map((l, i) => `${i + 1}\n${reloj(l.desde)} --> ${reloj(l.hasta)}\n${l.texto}\n`)
    .join('\n')
}

export function descargar(texto, nombre, tipo = 'text/plain') {
  const url = URL.createObjectURL(new Blob([texto], { type: `${tipo};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
