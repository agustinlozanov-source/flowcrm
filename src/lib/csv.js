/* El dialecto CSV de la casa — el mismo para leer y para escribir.
 *
 * Vivía duplicado: el exportador tenía su escape y el importador de
 * actividades su partidor, cada uno con su idea de qué es una columna. De ahí
 * salía que lo que la app exporta no se pueda volver a importar. Un solo
 * archivo para las dos direcciones es lo que mantiene esa promesa.
 */

/** Escapa un valor para CSV. Sin esto, un nombre con coma parte la fila y una
 *  nota con comillas rompe el archivo entero. */
export function celda(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Minúsculas, sin acentos y sin espacios de sobra. Para comparar encabezados
 *  y nombres escritos por personas distintas. */
export const normalizar = t =>
  String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/* Un CSV de verdad trae comas dentro de las comillas y comillas escapadas
   dobles. Partir por comas a secas corre las columnas en cuanto alguien
   escribe «Le mandé la propuesta, quedó de revisarla». */
export function partirCSV(texto) {
  const filas = []
  let fila = [], campo = '', dentro = false
  // El BOM que pone Excel al guardar se cuela en el primer encabezado y lo
  // vuelve irreconocible. Fuera antes de empezar.
  const t = String(texto || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (dentro) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++ }
        else dentro = false
      } else campo += c
    } else if (c === '"') dentro = true
    else if (c === ',' || c === ';') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else campo += c
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila) }
  return filas.filter(f => f.some(x => String(x).trim() !== ''))
}

/** Arma un CSV con BOM, que es lo que hace que Excel abra los acentos bien en
 *  vez de mostrar "Mart√≠nez". Sin él el archivo es correcto pero se ve roto. */
export function armarCSV(encabezados, filas) {
  const cabecera = encabezados.map(celda).join(',')
  const cuerpo = filas.map(f => f.map(celda).join(',')).join('\n')
  return '﻿' + cabecera + '\n' + cuerpo
}

/** Dispara la descarga de un texto ya armado. */
export function descargarTexto(nombreArchivo, texto) {
  const blob = new Blob([texto], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
