/* ¿Este comentario dispara la regla del post, y qué se le contesta?
 *
 * Gemela de la parte correspondiente de src/lib/trafficker.js, a propósito:
 * la pantalla es un módulo ESM y esto corre en CommonJS. La pantalla tiene
 * que poder decir «con este comentario sí dispara» antes de publicar, y el
 * servidor tiene que decidirlo igual cuando el comentario llegue de verdad.
 * Si una de las dos cambia sin la otra, el post promete algo que no cumple.
 *
 * Hay una prueba que compara las dos con los mismos casos.
 */

/* Sin acentos y sin mayúsculas: quien comenta escribe «informacion» tan
 * seguido como «INFORMACIÓN», y que la regla dependa de eso la vuelve
 * inservible justo el día que importa.
 *
 * La eñe se protege antes de descomponer: es otra letra, no una ene con
 * adorno, y perderla haría que «año» encontrara «ano». */
const normalizado = (t) =>
  String(t || '').toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ')
    .trim()

function comentarioDispara(regla, texto) {
  if (!regla?.activa) return false
  if (!String(regla.privado || '').trim() && !String(regla.publica || '').trim()) return false
  const palabra = normalizado(regla.palabra)
  if (!palabra) return true
  return normalizado(texto).includes(palabra)
}

function mensajePrivado(regla, liga) {
  const base = String(regla?.privado || '').trim()
  if (!base) return ''
  if (!liga || regla?.conLiga === false) return base
  return `${base}\n\n${liga}`
}

module.exports = { comentarioDispara, mensajePrivado }
