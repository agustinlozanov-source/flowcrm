/* Tableros predefinidos.
 *
 * No son solo comodidad: son la respuesta a "no sé qué debería estar mirando",
 * que es la pregunta real de casi todo el mundo frente a una pantalla vacía.
 * Cada uno contesta un puñado de preguntas concretas de un rol.
 */
const t = (medida, dimension, forma, ancho, titulo) => ({ medida, dimension, forma, ancho, titulo })

export const PRESETS = [
  {
    id: 'operacion',
    nombre: 'Operación diaria',
    para: 'Para quien atiende: qué entró, qué hay que trabajar y cómo viene la agenda.',
    filas: [
      { tarjetas: [
        t('leads', 'ninguna', 'numero', 1),
        t('conversaciones', 'ninguna', 'numero', 1),
        t('citas', 'ninguna', 'numero', 1),
        t('tasa_asistencia', 'ninguna', 'numero', 1),
      ] },
      { tarjetas: [
        t('leads', 'dia', 'barras', 2, 'Cómo viene la entrada'),
        t('leads', 'canal', 'torta', 2, 'De dónde llegan'),
      ] },
      { tipo: 'embudo', ancho: 4 },
    ],
  },
  {
    id: 'comercial',
    nombre: 'Comercial',
    para: 'Para quien mira el dinero: qué hay abierto, qué se cerró y cuánto vale cada cosa.',
    filas: [
      { tarjetas: [
        t('dinero_ganado', 'ninguna', 'numero', 1),
        t('dinero_real', 'ninguna', 'numero', 1),
        t('dinero_potencial', 'ninguna', 'numero', 1),
        t('ticket_promedio', 'ninguna', 'numero', 1),
      ] },
      { tarjetas: [
        t('dinero_ganado', 'canal', 'barras', 2, 'Qué canal deja dinero'),
        t('tasa_cierre', 'canal', 'barras', 2, 'Qué canal convierte'),
      ] },
      { tarjetas: [
        t('dinero_ganado', 'mes', 'linea', 4, 'Facturación mes a mes'),
      ] },
    ],
  },
  {
    id: 'equipo',
    nombre: 'Equipo',
    para: 'Para quien dirige: cómo reparte el trabajo y quién convierte mejor.',
    filas: [
      { tarjetas: [
        t('leads', 'vendedor', 'barras', 2, 'Carga de cada uno'),
        t('tasa_cierre', 'vendedor', 'barras', 2, 'Quién convierte mejor'),
      ] },
      { tarjetas: [
        t('dinero_ganado', 'vendedor', 'barras', 2, 'Cuánto cerró cada uno'),
        t('dias_a_cita', 'ninguna', 'numero', 1),
        t('score_promedio', 'ninguna', 'numero', 1),
      ] },
      { tipo: 'embudo', ancho: 4 },
    ],
  },
]

/** Tablero nuevo, vacío salvo por el embudo: arrancar de cero sin nada en
 *  pantalla es peor que arrancar con lo único que siempre sirve. */
export const EN_BLANCO = {
  id: 'propio',
  nombre: 'Mi tablero',
  para: 'Armado por vos.',
  filas: [{ tipo: 'embudo', ancho: 4 }],
}

/** Ids con los que se guardan: cada fila y tarjeta necesita uno estable para
 *  poder editarla o moverla sin confundirla con otra. */
export function conIds(tablero) {
  let n = 0
  const id = () => `x${Date.now().toString(36)}${(n++).toString(36)}`
  return {
    ...tablero,
    filas: tablero.filas.map(f => ({
      id: id(),
      ...f,
      tarjetas: (f.tarjetas || []).map(t2 => ({ id: id(), ...t2 })),
    })),
  }
}
