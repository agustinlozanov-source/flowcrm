/* Catálogo de medidas y dimensiones.
 *
 * Una tarjeta de analítica es el cruce de una MEDIDA (qué contás o sumás) con
 * una DIMENSIÓN (contra qué lo abrís), en un período. De dos listas salen
 * cientos de tarjetas sin programar ninguna en particular.
 *
 * Cada medida declara sobre qué entidad se calcula, en qué unidad se expresa,
 * qué formas de verla tienen sentido y cuántos casos necesita para ser
 * confiable. Ese último dato es el que permite avisar cuando un porcentaje
 * está calculado sobre cuatro casos y no significa nada.
 */

export const UNIDADES = {
  cantidad:   { formato: v => Math.round(v).toLocaleString('es-MX') },
  dinero:     { formato: v => `$${Math.round(v).toLocaleString('es-MX')}` },
  porcentaje: { formato: v => `${Math.round(v)}%` },
  dias:       { formato: v => (v == null ? '—' : `${v.toFixed(1)} d`) },
  puntos:     { formato: v => Math.round(v).toString() },
}

// Formas de ver un resultado. Cuál aplica lo decide el cruce, no el usuario:
// un porcentaje en una torta miente, y un total acumulado por día también.
export const FORMAS = {
  numero:  { label: 'Número' },
  barras:  { label: 'Barras' },
  linea:   { label: 'Línea' },
  torta:   { label: 'Torta' },
  tabla:   { label: 'Tabla' },
  embudo:  { label: 'Embudo' },
}

const dia = ts => ts?.toDate?.() || (ts ? new Date(ts) : null)
const tieneCita = (lead, citas) => citas.some(c => c.leadId === lead.id)
const asistio = (lead, citas) => citas.some(c => c.leadId === lead.id && c.status === 'completed')
const compro = lead => (lead.opportunityStats?.won || 0) > 0

/* ── MEDIDAS ─────────────────────────────────────────────────────────
 * base: sobre qué colección se cuenta. Importa porque "tipo de cita" no es
 * una dimensión válida para una medida que cuenta leads.
 * minimo: cuántos casos hacen falta para que el número sea estable. Los
 * porcentajes necesitan muchos más que los conteos, porque un caso de más
 * mueve el resultado entero.
 */
export const MEDIDAS = {
  leads: {
    label: 'Leads', base: 'leads', unidad: 'cantidad', minimo: 1,
    calcula: ls => ls.length,
    descripcion: 'Cuántos contactos entraron.',
  },
  conversaciones: {
    label: 'Conversaciones', base: 'leads', unidad: 'cantidad', minimo: 1,
    calcula: ls => ls.filter(l => l.lastMessageAt).length,
    descripcion: 'Cuántos llegaron a escribir, no solo a existir.',
  },
  dinero_ganado: {
    label: 'Ganado', base: 'leads', unidad: 'dinero', minimo: 1,
    calcula: ls => ls.reduce((s, l) => s + (l.opportunityStats?.valueWon || 0), 0),
    descripcion: 'Suma de las oportunidades cerradas como ganadas.',
  },
  dinero_real: {
    label: 'Real abierto', base: 'leads', unidad: 'dinero', minimo: 1,
    calcula: ls => ls.reduce((s, l) => s + (l.opportunityStats?.valueReal || 0), 0),
    descripcion: 'Las oportunidades de entrada que siguen abiertas.',
  },
  dinero_potencial: {
    label: 'Potencial abierto', base: 'leads', unidad: 'dinero', minimo: 1,
    calcula: ls => ls.reduce((s, l) => s + (l.opportunityStats?.valuePotencial || 0), 0),
    descripcion: 'Lo que se abrió a partir del problema del lead y no se cerró.',
  },
  ticket_promedio: {
    label: 'Ticket promedio', base: 'leads', unidad: 'dinero', minimo: 10,
    calcula: ls => {
      const ganadas = ls.reduce((s, l) => s + (l.opportunityStats?.won || 0), 0)
      if (!ganadas) return 0
      return ls.reduce((s, l) => s + (l.opportunityStats?.valueWon || 0), 0) / ganadas
    },
    descripcion: 'Cuánto vale en promedio cada oportunidad ganada.',
  },
  score_promedio: {
    label: 'Score promedio', base: 'leads', unidad: 'puntos', minimo: 10,
    calcula: ls => {
      const con = ls.filter(l => (l.score || 0) > 0)
      return con.length ? con.reduce((s, l) => s + l.score, 0) / con.length : 0
    },
    descripcion: 'Qué tan calificados llegan, en promedio.',
  },
  tasa_agenda: {
    label: 'Tasa de agenda', base: 'leads', unidad: 'porcentaje', minimo: 30,
    necesita: 'citas',
    calcula: (ls, ctx) => ls.length ? (ls.filter(l => tieneCita(l, ctx.citas)).length / ls.length) * 100 : 0,
    descripcion: 'De los que escribieron, cuántos terminaron agendando.',
  },
  tasa_asistencia: {
    label: 'Tasa de asistencia', base: 'citas', unidad: 'porcentaje', minimo: 30,
    calcula: cs => {
      const resueltas = cs.filter(c => ['completed', 'no_show'].includes(c.status))
      if (!resueltas.length) return 0
      return (resueltas.filter(c => c.status === 'completed').length / resueltas.length) * 100
    },
    descripcion: 'De las citas que ya pasaron, a cuántas se presentó el lead.',
  },
  tasa_cierre: {
    label: 'Tasa de cierre', base: 'leads', unidad: 'porcentaje', minimo: 30,
    calcula: ls => ls.length ? (ls.filter(compro).length / ls.length) * 100 : 0,
    descripcion: 'De los que entraron, cuántos compraron algo.',
  },
  citas: {
    label: 'Citas', base: 'citas', unidad: 'cantidad', minimo: 1,
    calcula: cs => cs.length,
    descripcion: 'Cuántas citas se agendaron.',
  },
  citas_asistidas: {
    label: 'Asistencias', base: 'citas', unidad: 'cantidad', minimo: 1,
    calcula: cs => cs.filter(c => c.status === 'completed').length,
    descripcion: 'Cuántas citas terminaron con el lead presente.',
  },
  citas_ausencia: {
    label: 'Ausencias', base: 'citas', unidad: 'cantidad', minimo: 1,
    calcula: cs => cs.filter(c => c.status === 'no_show').length,
    descripcion: 'Cuántas veces el lead no se presentó.',
  },
  dias_a_cita: {
    label: 'Días hasta la cita', base: 'leads', unidad: 'dias', minimo: 10,
    necesita: 'citas',
    calcula: (ls, ctx) => {
      const tiempos = []
      for (const l of ls) {
        const desde = dia(l.createdAt)
        const cita = ctx.citas
          .filter(c => c.leadId === l.id)
          .map(c => dia(c.scheduledAt))
          .filter(Boolean)
          .sort((a, b) => a - b)[0]
        if (desde && cita && cita > desde) tiempos.push((cita - desde) / 864e5)
      }
      return tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null
    },
    descripcion: 'Cuánto tarda alguien desde que llega hasta que tiene cita.',
  },
}

/* ── DIMENSIONES ─────────────────────────────────────────────────────
 * `aplica` dice sobre qué bases tiene sentido: el tipo de cita no es una
 * forma válida de abrir una medida que cuenta leads.
 */
export const DIMENSIONES = {
  ninguna: {
    label: 'Sin abrir', aplica: ['leads', 'citas'], cardinalidad: 'una',
    clave: () => 'total', etiqueta: () => 'Total',
  },
  canal: {
    label: 'Canal', aplica: ['leads'], cardinalidad: 'pocas',
    clave: l => l.lastMessageChannel || l.source || 'sin dato',
    etiqueta: k => ({ whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
                      facebook: 'Facebook', meta_ads: 'Meta Ads', web: 'Web', manual: 'Manual' }[k] || k),
  },
  etapa: {
    label: 'Etapa', aplica: ['leads'], cardinalidad: 'pocas',
    clave: l => {
      const s = l.systemStage
      if (!s || s === 'cold') return 'calentamiento'
      if (s === 'handoff') return 'handoff'
      return 'cierre'
    },
    etiqueta: k => ({ calentamiento: 'En calentamiento', handoff: 'Handoff', cierre: 'Cierre definitivo' }[k] || k),
  },
  vendedor: {
    label: 'Vendedor', aplica: ['leads'], cardinalidad: 'pocas',
    clave: l => l.assignedTo || 'agente',
    etiqueta: (k, ctx) => k === 'agente'
      ? 'Sin asignar (agente)'
      : (ctx?.miembros?.find(m => m.id === k)?.name || 'Desconocido'),
  },
  tipo_cita: {
    label: 'Tipo de cita', aplica: ['citas'], cardinalidad: 'pocas',
    clave: c => c.type || 'call',
    etiqueta: k => ({ call: 'Llamada', video: 'Videollamada', presencial: 'Presencial' }[k] || k),
  },
  motivo_descarte: {
    label: 'Motivo de descarte', aplica: ['leads'], cardinalidad: 'varias',
    clave: l => l.discardCategory || 'sin descartar',
  },
  dia: {
    label: 'Día', aplica: ['leads', 'citas'], cardinalidad: 'tiempo',
    clave: (x, _, campo) => {
      const d = dia(x[campo])
      return d ? d.toISOString().slice(0, 10) : 'sin fecha'
    },
    etiqueta: k => (k === 'sin fecha' ? k : k.slice(8) + '/' + k.slice(5, 7)),
  },
  mes: {
    label: 'Mes', aplica: ['leads', 'citas'], cardinalidad: 'tiempo',
    clave: (x, _, campo) => {
      const d = dia(x[campo])
      return d ? d.toISOString().slice(0, 7) : 'sin fecha'
    },
    etiqueta: k => k,
  },
}

/** Qué formas tienen sentido para un cruce. El resto ni se ofrece: evitar el
 *  gráfico equivocado es más valioso que ofrecer muchos. */
export function formasValidas(medidaId, dimensionId) {
  const m = MEDIDAS[medidaId]
  const d = DIMENSIONES[dimensionId]
  if (!m || !d) return ['numero']
  if (dimensionId === 'ninguna') return ['numero']
  if (d.cardinalidad === 'tiempo') {
    // Un porcentaje por día es ruido puro; mejor la línea que la barra.
    return m.unidad === 'porcentaje' ? ['linea', 'tabla'] : ['barras', 'linea', 'tabla']
  }
  // Una torta solo suma al 100% si la medida es una cantidad o dinero.
  const torta = ['cantidad', 'dinero'].includes(m.unidad) ? ['torta'] : []
  return ['barras', ...torta, 'tabla']
}

/** Dimensiones que se pueden cruzar con una medida dada. */
export function dimensionesPara(medidaId) {
  const base = MEDIDAS[medidaId]?.base
  return Object.entries(DIMENSIONES)
    .filter(([, d]) => d.aplica.includes(base))
    .map(([id, d]) => ({ id, ...d }))
}
