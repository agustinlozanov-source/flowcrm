/* Los seis estados de color del board. Un solo color por tarjeta: el color
 * dice en qué punto está el contacto y, por lo tanto, en qué columna vive.
 *
 * Los umbrales son el default del briefing (B.2) y quedan sobrescribibles por
 * cliente — por eso viven acá y no repartidos en los componentes. */
export const MATURITY = {
  m1: { id: 'm1', label: 'Nuevo',          color: '#FF6B00', column: 'calentamiento', max: 25 },
  m2: { id: 'm2', label: 'Avanzando',      color: '#FFD60A', column: 'calentamiento', max: 50 },
  m3: { id: 'm3', label: 'Maduro',         color: '#A3E635', column: 'calentamiento', max: 75 },
  m4: { id: 'm4', label: 'Listo',          color: '#00A651', column: 'handoff',       max: 100 },
  c1: { id: 'c1', label: 'Cierre parcial', color: '#2E90FA', column: 'cierre' },
  c2: { id: 'c2', label: 'Cierre total',   color: '#9E77ED', column: 'cierre' },
}

export const WARMUP_LEVELS = [MATURITY.m1, MATURITY.m2, MATURITY.m3]

/** Nivel de madurez a partir del score. Solo aplica antes del cierre: una vez
 *  que hay oportunidades cerradas manda el conteo, no el score. */
export function maturityFromScore(score, thresholds = [25, 50, 75]) {
  const [a, b, c] = thresholds
  if (score <= a) return MATURITY.m1
  if (score <= b) return MATURITY.m2
  if (score <= c) return MATURITY.m3
  return MATURITY.m4
}

/** En Cierre definitivo el color no lo da el score sino si queda algo abierto. */
export function closingMaturity({ openOpportunities = 0 }) {
  return openOpportunities > 0 ? MATURITY.c1 : MATURITY.c2
}
