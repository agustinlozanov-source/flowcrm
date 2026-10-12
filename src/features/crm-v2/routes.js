/* A dónde lleva cada item de la sidebar. Vive aparte porque lo usan el marco
 * global (para navegar y para saber qué item está activo) y el shell de las
 * vistas de muestra. */
export const ROUTES = {
  pipeline: '/pipeline',
  conversaciones: '/inbox',
  reuniones: '/meetings',
  contactos: '/leads',
  catalogo: '/products',
  agente: '/agent',
  equipo: '/team',
  importar: '/import',
  reportes: '/analytics',
  contenido: '/content',
  landing: '/landing',
  referidos: '/referrals',
  metas: '/goals',
  ajustes: '/settings',
}

/* Las pantallas que ya tienen el diseño nuevo y por lo tanto saben vivir en
 * tema oscuro. El resto se dibuja sobre fondo claro aunque el marco esté
 * oscuro. La lista se achica a medida que avanza el rediseño. */
export const RUTAS_REDISENADAS = ['/pipeline']

export function esRediseñada(pathname) {
  return RUTAS_REDISENADAS.some(r => pathname === r || pathname.startsWith(r + '/'))
}
