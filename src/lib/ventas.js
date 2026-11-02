/* De dónde salen las ventas. Una sola consulta para todo el sistema.
 *
 * Antes cada pantalla contaba a su manera. Las metas leían **leads** con fecha
 * de cierre; el portal iba a leer **oportunidades**. Dos fuentes dan dos
 * números y nadie sabe a cuál creerle.
 *
 * Y la fuente vieja estaba mal para este modelo por dos razones concretas: la
 * fecha de cierre del lead es la del **primer** cierre, así que un contacto que
 * compró en octubre y volvió a comprar en noviembre cargaba todo a octubre; y
 * el lead no sabe a qué precio se cerró, así que no veía el descuento.
 *
 * La venta es la oportunidad ganada, con su precio de cierre y su mes.
 *
 * ── Sobre la forma de la consulta ──────────────────────────────────
 * Las oportunidades viven anidadas en cada lead, así que juntarlas pide una
 * consulta de grupo, y eso pide un índice compuesto. Por eso **todas** las
 * lecturas usan la misma forma —`orgId` igual y `closedMonth` dentro de una
 * lista— aunque para un solo mes sobre: con dos formas harían falta dos
 * índices, y el segundo se descubre el día que falla en producción.
 */
import { collectionGroup, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/** El mes en que cae una fecha, visto desde México (UTC−6).
 *
 *  A las 7 de la tarde del día 30 el UTC ya es del mes siguiente. Sin esto,
 *  las ventas de la última tarde del mes caen en el periodo equivocado. */
export function mesMexico(d = new Date()) {
  const mx = new Date(d.getTime() - 6 * 60 * 60 * 1000)
  return mx.getUTCFullYear() + '-' + String(mx.getUTCMonth() + 1).padStart(2, '0')
}

/** Los meses de un trimestre, en la forma que guarda el cierre. */
export function mesesDelTrimestre(indicesDeMes = [], anio) {
  return indicesDeMes.map(m => anio + '-' + String(m + 1).padStart(2, '0'))
}

const consulta = (orgId, meses) => query(
  collectionGroup(db, 'opportunities'),
  where('orgId', '==', orgId),
  /* `in` acepta hasta 30 valores y usa el mismo índice que una igualdad, así
     que un trimestre entero entra en una sola consulta. */
  where('closedMonth', 'in', meses.slice(0, 30)),
)

/* El estado y el embudo se filtran acá y no en la consulta a propósito: cada
   campo más en el `where` es otro índice que mantener, y a este volumen
   filtrar en memoria no se nota. */
const limpiar = (docs, pipelineId) => docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(o => o.status === 'ganada')
  .filter(o => !pipelineId || o.pipelineId === pipelineId)

/** Lo que vale una venta: lo que se cobró, no lo que costaba.
 *  Las ganadas de antes del registro de cierre caen a su monto original. */
export const montoDeVenta = o => Number(o.closePrice != null ? o.closePrice : o.value) || 0

/** Una lectura puntual. Para pantallas que no necesitan tiempo real. */
export async function leerVentas(orgId, meses, { pipelineId = null } = {}) {
  if (!orgId || !meses?.length) return []
  const snap = await getDocs(consulta(orgId, meses))
  return limpiar(snap.docs, pipelineId)
}

/** En vivo. Devuelve la función para darse de baja. */
export function escucharVentas(orgId, meses, cb, onError, { pipelineId = null } = {}) {
  if (!orgId || !meses?.length) { cb([]); return () => {} }
  return onSnapshot(
    consulta(orgId, meses),
    snap => cb(limpiar(snap.docs, pipelineId)),
    err => {
      /* La primera vez, el índice no existe y Firestore manda el enlace para
         crearlo dentro del mensaje. Se pasa entero en vez de tragárselo. */
      console.error('[ventas]', err)
      onError?.(err)
    },
  )
}

/** Los totales de un conjunto de ventas. La misma cuenta en todos lados. */
export function totalizar(ventas = []) {
  const venta = ventas.reduce((s, o) => s + montoDeVenta(o), 0)
  const lista = ventas.reduce((s, o) => s + (Number(o.listPrice) || Number(o.value) || 0), 0)
  const descuentos = ventas.reduce((s, o) => s + (Number(o.discountAmount) || 0), 0)
  const cortesias = ventas.reduce((s, o) => s + (Number(o.courtesiesValue) || 0), 0)
  return {
    cierres: ventas.length,
    venta,
    lista,
    descuentos,
    cortesias,
    /* Lo cedido cuenta las cortesías: cerrar regalando una herramienta cuesta
       igual que cerrar con descuento. */
    cedido: descuentos + cortesias,
    cedidoPct: lista > 0 ? (descuentos + cortesias) / lista : 0,
  }
}
