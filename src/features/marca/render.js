/* Render dentro del navegador.
 *
 * Aquí es donde el fileteado deja de ser una lista de tramos y se convierte en
 * un video. Y es también donde se arregla lo que ningún análisis podía
 * arreglar: el corte seco.
 *
 * Un editor no corta a cuchillo en medio del habla. Baja el audio en veinte
 * milisegundos y lo vuelve a subir del otro lado — el oído no lo registra,
 * pero el chasquido desaparece. Eso solo se puede hacer generando el archivo;
 * ni una vista previa que salta sobre el original ni un XML lo permiten.
 *
 * Corre en la máquina de quien edita: el video no se sube a ningún servicio,
 * no cuesta por minuto y no depende de nadie.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const CDN = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'

// Veinte milisegundos: suficiente para matar el chasquido, demasiado corto
// para que se note como un fundido.
const FUNDIDO = 0.02

let motor = null

/* ffmpeg no lanza excepciones con mensaje: escupe el motivo por su registro y
 * devuelve un código. Sin guardar ese registro, cualquier fallo llega aquí
 * como un error vacío y no hay forma de saber qué pasó. */
const bitacora = []

async function arrancar() {
  if (motor) return motor
  const ff = new FFmpeg()
  ff.on('log', ({ message }) => {
    if (!message) return
    bitacora.push(message)
    if (bitacora.length > 400) bitacora.shift()
  })
  try {
    await ff.load({
      coreURL: await toBlobURL(`${CDN}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CDN}/ffmpeg-core.wasm`, 'application/wasm'),
    })
  } catch (e) {
    throw new Error(`No se pudo cargar el motor de video (${e?.message || 'sin detalle'}). Puede ser la red o un bloqueador.`)
  }
  motor = ff
  return ff
}

/** Lo último que dijo ffmpeg que parezca una explicación. */
function ultimoMotivo() {
  const pistas = bitacora.filter(l =>
    /error|invalid|no such|unable|failed|out of memory|abort|does not contain/i.test(l))
  return pistas.length ? pistas[pistas.length - 1] : bitacora[bitacora.length - 1] || ''
}

/** El filtro que recorta, le pone fundido a cada tramo y los pega. */
export function filtro(segmentos, { fundido = FUNDIDO, alto = null } = {}) {
  const partes = []
  const etiquetas = []
  segmentos.forEach((s, i) => {
    const dur = s.fin - s.inicio
    const f = Math.min(fundido, dur / 4)
    const escala = alto ? `,scale=-2:${alto}` : ''
    partes.push(`[0:v]trim=start=${s.inicio.toFixed(3)}:end=${s.fin.toFixed(3)},setpts=PTS-STARTPTS${escala}[v${i}]`)
    partes.push(
      `[0:a]atrim=start=${s.inicio.toFixed(3)}:end=${s.fin.toFixed(3)},asetpts=PTS-STARTPTS,` +
      `afade=t=in:st=0:d=${f.toFixed(3)},afade=t=out:st=${Math.max(0, dur - f).toFixed(3)}:d=${f.toFixed(3)}[a${i}]`
    )
    etiquetas.push(`[v${i}][a${i}]`)
  })
  partes.push(`${etiquetas.join('')}concat=n=${segmentos.length}:v=1:a=1[v][a]`)
  return partes.join(';')
}

/**
 * Genera el MP4 ya cortado.
 * @param file        el archivo original, del disco
 * @param segmentos   los tramos que se conservan
 * @param opciones    alProgresar(0..1), calidad, alto
 */
export async function renderizar(file, segmentos, {
  alProgresar,
  alAvisar,
  calidad = 'ultrafast',
  alto = null,
} = {}) {
  if (!segmentos?.length) throw new Error('No queda nada que renderizar')

  alAvisar?.('Preparando el motor…')
  const ff = await arrancar()
  if (alProgresar) ff.on('progress', ({ progress }) => alProgresar(Math.min(1, Math.max(0, progress))))

  const entrada = 'entrada' + (file.name.match(/\.[^.]+$/)?.[0] || '.mp4')
  const salida = 'salida.mp4'

  alAvisar?.('Cargando el video…')
  try {
    await ff.writeFile(entrada, await fetchFile(file))
  } catch (e) {
    throw new Error(`No se pudo cargar el video en el motor (${Math.round(file.size / 1e6)} MB). ${e?.message || ''}`)
  }

  alAvisar?.(`Cortando ${segmentos.length} tramos…`)
  bitacora.length = 0
  const codigo = await ff.exec([
    '-i', entrada,
    '-filter_complex', filtro(segmentos, { alto }),
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', calidad, '-crf', '22',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart',
    salida,
  ])

  if (codigo !== 0) {
    throw new Error(ultimoMotivo() || `ffmpeg terminó con código ${codigo}`)
  }

  let datos
  try {
    datos = await ff.readFile(salida)
  } catch {
    throw new Error(ultimoMotivo() || 'ffmpeg no dejó ningún archivo de salida')
  }
  if (!datos?.length) throw new Error(ultimoMotivo() || 'El archivo generado salió vacío')
  await ff.deleteFile(entrada).catch(() => {})
  await ff.deleteFile(salida).catch(() => {})

  return new Blob([datos.buffer], { type: 'video/mp4' })
}

/** Para enseñarle al usuario qué dijo ffmpeg cuando algo sale mal. */
export function registro() {
  return bitacora.slice(-40).join('\n')
}

export function guardar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
