/* El buscador del tablero.
 *
 * El de antes era `includes` a secas, y con nombres que llegan de Instagram
 * eso falla todo el tiempo: vienen con acentos, con mayúsculas raras, sin
 * apellido, o son un usuario y no un nombre. Escribir "agustin" no encontraba
 * a "Agustín", y "lozno" no encontraba nada.
 *
 * No se usa una librería a propósito. Esto corre en cada tecla sobre cientos
 * de tarjetas, y lo que hace falta cabe en treinta líneas.
 */

/* Sin acentos, sin mayúsculas, sin signos. "Agustín Lozano." y "agustin
 * lozano" tienen que ser lo mismo. */
export const normalizar = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@. ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const soloDigitos = (t) => String(t || '').replace(/\D/g, '')

/* Distancia de edición, con corte temprano.
 *
 * Si ya se pasó del máximo tolerado no hace falta terminar de calcular: se
 * devuelve el corte y el que llama descarta. Con cientos de tarjetas por cada
 * tecla, eso es la diferencia entre fluido y pegajoso. */
function distancia(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const fila = [i]
    let mejor = i
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      fila[j] = Math.min(prev[j] + 1, fila[j - 1] + 1, prev[j - 1] + costo)
      if (fila[j] < mejor) mejor = fila[j]
    }
    if (mejor > max) return max + 1
    prev = fila
  }
  return prev[b.length]
}

/* Cuánto error se le perdona a una palabra según su largo.
 *
 * A las cortas, ninguno: con dos letras de tolerancia "ana" coincide con
 * cualquier cosa y el buscador deja de servir. */
const tolerancia = (n) => (n <= 3 ? 0 : n <= 6 ? 1 : 2)

/* Una palabra del texto coincide si empieza igual o si está a un error de
 * distancia. El prefijo importa: quien escribe "loz" está escribiendo el
 * principio de un apellido, no una palabra completa. */
function palabraCoincide(palabra, termino) {
  if (palabra.startsWith(termino)) return true
  if (termino.length < 4) return false
  return distancia(palabra, termino, tolerancia(termino.length)) <= tolerancia(termino.length)
}

/* Todos los términos tienen que aparecer, en cualquier orden y en cualquier
 * campo. "lozano agustin" encuentra a "Agustín Lozano". */
export function coincide(lead, consulta) {
  const q = normalizar(consulta)
  if (!q) return true

  const digitos = soloDigitos(consulta)
  if (digitos.length >= 4 && soloDigitos(lead.phone).includes(digitos)) return true

  const texto = normalizar(
    [lead.name, lead.lastName, lead.company, lead.email, lead.phone]
      .filter(Boolean)
      .join(' ')
  )
  if (!texto) return false
  if (texto.includes(q)) return true

  const palabras = texto.split(' ')
  return q.split(' ').every(termino =>
    palabras.some(p => palabraCoincide(p, termino))
  )
}
