/* El rango de cada tarjeta.
 *
 * Hasta ahora el período lo fijaba la pantalla y recortaba todas las tarjetas
 * por igual. Eso rompe dos cosas:
 *
 *   1. Un cruce contra el tiempo queda sin sentido. "Citas por mes" con el
 *      período en "este mes" dibuja una sola barra.
 *   2. Un total deja de ser el total. "Citas por tipo" mostraba 7 cuando en la
 *      agenda hay 12, sin que nada en la tarjeta dijera que estaba mirando
 *      noviembre.
 *
 * Por eso el rango pasa a ser del cruce, no de la pantalla. La tarjeta que no
 * elige nada sigue heredando el de arriba, que es como se comportaba antes:
 * ningún tablero guardado cambia de número al desplegar esto.
 */

export const RANGOS = [
  { id: 'tablero', label: 'El del tablero', corto: null },
  { id: '7d',      label: 'Últimos 7 días',  corto: '7 días' },
  { id: '30d',     label: 'Últimos 30 días', corto: '30 días' },
  { id: 'mes',     label: 'Este mes',        corto: 'este mes' },
  { id: 'trim',    label: 'Este trimestre',  corto: 'este trimestre' },
  { id: 'anio',    label: 'Este año',        corto: 'este año' },
  { id: 'todo',    label: 'Todo el tiempo',  corto: 'todo el tiempo' },
]

const dias = n => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

/** Resuelve el rango de una tarjeta a { desde, hasta }.
 *
 *  `heredado` es el período de la pantalla, que se usa cuando la tarjeta no
 *  eligió el suyo. `todo` devuelve los dos extremos vacíos, y el motor ya sabe
 *  que eso significa no filtrar.
 */
export function resolverRango(id, heredado = {}) {
  const hoy = new Date()
  switch (id) {
    case '7d':   return { desde: dias(7), hasta: hoy }
    case '30d':  return { desde: dias(30), hasta: hoy }
    case 'mes':  return {
      desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1),
      hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999),
    }
    case 'trim': {
      const t = Math.floor(hoy.getMonth() / 3) * 3
      return {
        desde: new Date(hoy.getFullYear(), t, 1),
        hasta: new Date(hoy.getFullYear(), t + 3, 0, 23, 59, 59, 999),
      }
    }
    case 'anio': return {
      desde: new Date(hoy.getFullYear(), 0, 1),
      hasta: new Date(hoy.getFullYear(), 11, 31, 23, 59, 59, 999),
    }
    case 'todo': return { desde: null, hasta: null }
    default:     return heredado
  }
}

/** Lo que se escribe debajo del número para que nunca quede sin contexto.
 *
 *  Un número solo —"7"— se puede confundir con cualquier otro número del
 *  sistema. Con "este mes" al lado deja de poderse. */
export function etiquetaRango(id, heredado = {}) {
  const r = RANGOS.find(x => x.id === id)
  if (r && r.corto) return r.corto
  // Heredado: se describe el período real que bajó de la pantalla.
  const { desde, hasta } = heredado
  if (!desde && !hasta) return 'todo el tiempo'
  const f = d => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  if (desde && hasta) return `${f(desde)} — ${f(hasta)}`
  return desde ? `desde ${f(desde)}` : `hasta ${f(hasta)}`
}
