/* Subtítulos a partir de la transcripción, ya con los cortes aplicados.
 *
 * La transcripción viene palabra por palabra; un subtítulo no es eso. Hay que
 * agrupar en líneas que quepan en pantalla y se lean sin correr, y partir
 * donde la frase respira, no cada siete palabras a ciegas.
 *
 * Y los tiempos son los del montaje, no los del crudo. Con los del crudo se
 * irían desfasando cada vez más según avanza el video: es el error clásico.
 */
import { segmentosConservados } from './exportar'
import { aTiempoDeMontaje } from './mezcla'

// Lo que cabe cómodo en pantalla vertical sin tapar media cara.
const LARGO_MAXIMO = 42
// Por debajo de esto no da tiempo a leer; por encima, el subtítulo se queda
// colgado en pantalla cuando ya nadie lo mira.
const MINIMO = 0.9
const MAXIMO = 5

const CIERRA_FRASE = /[.?!…]$/
const RESPIRA = /[,;:]$/

export function construir(palabras = [], cortes = [], duracion = 0) {
  const segmentos = segmentosConservados(cortes, duracion)
  const fuera = (cortes || []).filter(c => c.activo !== false)

  // Las palabras que sobreviven al corte, ya con su tiempo del montaje.
  const vivas = []
  for (const p of palabras) {
    const cortada = fuera.some(c => p.inicio < c.fin && p.fin > c.inicio)
    if (cortada) continue
    vivas.push({
      texto: p.texto,
      desde: aTiempoDeMontaje(segmentos, p.inicio),
      hasta: aTiempoDeMontaje(segmentos, p.fin),
    })
  }
  if (!vivas.length) return []

  const lineas = []
  let actual = null

  const cerrar = () => {
    if (!actual) return
    // Un subtítulo que dura un parpadeo no se lee; se le da aire.
    if (actual.hasta - actual.desde < MINIMO) actual.hasta = actual.desde + MINIMO
    lineas.push(actual)
    actual = null
  }

  for (const p of vivas) {
    if (!actual) {
      actual = { desde: p.desde, hasta: p.hasta, texto: p.texto }
      continue
    }

    const largo = actual.texto.length + 1 + p.texto.length
    const dura = p.hasta - actual.desde
    // Un salto grande entre palabras es un cambio de idea: ahí se parte.
    const salto = p.desde - actual.hasta > 0.6

    if (largo > LARGO_MAXIMO || dura > MAXIMO || salto) {
      cerrar()
      actual = { desde: p.desde, hasta: p.hasta, texto: p.texto }
      continue
    }

    actual.texto += ` ${p.texto}`
    actual.hasta = p.hasta

    // Si la frase ya cerró y la línea tiene cuerpo, mejor cortar aquí que
    // arrastrar el principio de la siguiente.
    if (CIERRA_FRASE.test(p.texto) && actual.texto.length > LARGO_MAXIMO * 0.5) cerrar()
    else if (RESPIRA.test(p.texto) && actual.texto.length > LARGO_MAXIMO * 0.75) cerrar()
  }
  cerrar()

  // Que no se pisen: un subtítulo termina cuando empieza el siguiente.
  for (let i = 0; i < lineas.length - 1; i++) {
    if (lineas[i].hasta > lineas[i + 1].desde) lineas[i].hasta = lineas[i + 1].desde - 0.02
  }

  return lineas.map((l, i) => ({ id: `t${i}`, ...l }))
}

const reloj = (s) => {
  const ms = Math.round((s % 1) * 1000)
  const t = Math.floor(s)
  return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

/** A SRT, que es lo que entiende Premiere, Instagram y todo lo demás. */
export function aSRT(subtitulos = []) {
  return subtitulos
    .map((l, i) => `${i + 1}\n${reloj(l.desde)} --> ${reloj(l.hasta)}\n${l.texto}\n`)
    .join('\n')
}
