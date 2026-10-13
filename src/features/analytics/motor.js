/* Motor de cruces.
 *
 * Toma una medida, una dimensión y un período, y devuelve filas listas para
 * dibujar. No sabe nada de gráficos: devuelve números y etiquetas.
 *
 * Devuelve también cuántos casos hay detrás de cada resultado, que es lo que
 * permite advertir cuando un porcentaje está calculado sobre nada.
 */
import { MEDIDAS, DIMENSIONES, UNIDADES } from './catalogo'

const fecha = ts => ts?.toDate?.() || (ts ? new Date(ts) : null)

// Por qué campo se filtra el período según la entidad: un lead entra cuando se
// crea, una cita cuenta cuando ocurre.
const CAMPO_FECHA = { leads: 'createdAt', citas: 'scheduledAt' }

function enPeriodo(x, campo, desde, hasta) {
  if (!desde && !hasta) return true
  const d = fecha(x[campo])
  if (!d) return false
  if (desde && d < desde) return false
  if (hasta && d > hasta) return false
  return true
}

/**
 * @param datos  { leads, citas, miembros }
 * @param medidaId / dimensionId  ids del catálogo
 * @param periodo { desde, hasta } — Date o null
 * @returns { filas, total, casos, unidad, aviso }
 */
export function calcular(datos, medidaId, dimensionId, periodo = {}) {
  const medida = MEDIDAS[medidaId]
  const dimension = DIMENSIONES[dimensionId] || DIMENSIONES.ninguna
  if (!medida) return { filas: [], total: 0, casos: 0, unidad: 'cantidad' }

  const campo = CAMPO_FECHA[medida.base]
  const universo = (medida.base === 'citas' ? datos.citas : datos.leads) || []
  const base = universo.filter(x => enPeriodo(x, campo, periodo.desde, periodo.hasta))

  // El contexto lleva lo que una medida necesita de otra colección. Las citas
  // NO se recortan por período acá: si un lead de marzo agendó en abril, la
  // cita existe igual y la tasa de agenda tiene que verla.
  const ctx = { citas: datos.citas || [], miembros: datos.miembros || [] }

  const grupos = new Map()
  for (const x of base) {
    const clave = dimension.clave(x, ctx, campo)
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(x)
  }

  const filas = [...grupos.entries()]
    .map(([clave, items]) => ({
      clave,
      label: dimension.etiqueta ? dimension.etiqueta(clave, ctx) : clave,
      valor: medida.calcula(items, ctx) ?? 0,
      casos: items.length,
    }))
    .sort((a, b) => (dimension.cardinalidad === 'tiempo'
      ? String(a.clave).localeCompare(String(b.clave))
      : b.valor - a.valor))

  return {
    filas,
    total: medida.calcula(base, ctx) ?? 0,
    casos: base.length,
    unidad: medida.unidad,
    formato: UNIDADES[medida.unidad].formato,
    aviso: advertencia(medida, base.length),
  }
}

/** Qué tan confiable es lo que se está mostrando.
 *
 *  No es decoración: un porcentaje sobre seis casos se mueve 17 puntos con un
 *  caso más, y quien lo mira toma decisiones como si fuera un dato firme. */
export function advertencia(medida, casos) {
  if (!casos) {
    return { nivel: 'vacio', texto: 'No hay datos en el período elegido.' }
  }
  if (medida.minimo && casos < medida.minimo) {
    const falta = medida.minimo - casos
    return {
      nivel: 'flojo',
      texto: medida.unidad === 'porcentaje'
        ? `Calculado sobre ${casos} caso${casos === 1 ? '' : 's'}. Con menos de ${medida.minimo} el porcentaje se mueve demasiado con cada caso nuevo; faltan ${falta}.`
        : `Solo ${casos} caso${casos === 1 ? '' : 's'} en el período. El número es correcto pero todavía no dice una tendencia.`,
    }
  }
  return null
}

/* ── Embudo del proceso ──────────────────────────────────────────────
 * Los cinco escalones reales del negocio, en orden. Cada uno se mide sobre
 * los que pasaron el anterior, que es lo que hace que el embudo diga dónde se
 * cae la gente y no solo cuántos quedan al final.
 */
export const ESCALONES = [
  { id: 'entraron',   label: 'Entraron',        pasa: () => true },
  { id: 'escribieron', label: 'Escribieron',    pasa: l => !!l.lastMessageAt },
  { id: 'calificados', label: 'Calificados',    pasa: l => (l.score || 0) > 0 },
  { id: 'agendaron',  label: 'Agendaron',       pasa: (l, ctx) => ctx.citas.some(c => c.leadId === l.id) },
  { id: 'asistieron', label: 'Asistieron',      pasa: (l, ctx) => ctx.citas.some(c => c.leadId === l.id && c.status === 'completed') },
  { id: 'compraron',  label: 'Compraron',       pasa: l => (l.opportunityStats?.won || 0) > 0 },
]

export function embudo(datos, periodo = {}) {
  const ctx = { citas: datos.citas || [] }
  const base = (datos.leads || []).filter(l => enPeriodo(l, 'createdAt', periodo.desde, periodo.hasta))

  let anterior = base
  return ESCALONES.map((e, i) => {
    const quedan = i === 0 ? base : anterior.filter(l => e.pasa(l, ctx))
    const fila = {
      id: e.id,
      label: e.label,
      cantidad: quedan.length,
      // Contra el escalón anterior: ahí se ve en qué paso se cae la gente.
      pasoAnterior: anterior.length ? Math.round((quedan.length / anterior.length) * 100) : 0,
      // Contra el total: la conversión acumulada de punta a punta.
      desdeElInicio: base.length ? Math.round((quedan.length / base.length) * 100) : 0,
      perdidos: anterior.length - quedan.length,
    }
    anterior = quedan
    return fila
  })
}
