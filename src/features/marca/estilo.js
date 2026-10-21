/* El aspecto de los subtítulos.
 *
 * Vive en la pieza y se dibuja igual en el visor que en el video final: lo
 * que ves es lo que sale. Un .srt no lleva nada de esto —es texto pelado— así
 * que el estilo solo viaja si generamos el video nosotros.
 */

export const FUENTES = {
  display: { nombre: 'Jakarta',  css: '"Plus Jakarta Sans", sans-serif', peso: 800 },
  texto:   { nombre: 'Inter',    css: 'Inter, system-ui, sans-serif',    peso: 700 },
  impacto: { nombre: 'Impacto',  css: 'Haettenschweiler, "Arial Narrow", Impact, sans-serif', peso: 400 },
  serif:   { nombre: 'Serif',    css: 'Georgia, "Times New Roman", serif', peso: 700 },
}

export const RESALTADOS = {
  ninguno: 'Sin resaltar',
  color:   'Palabra en color',
  fondo:   'Palabra con fondo',
}

export const POR_DEFECTO = {
  fuente: 'display',
  // En porcentaje del ancho del video, no en píxeles: así se ve igual en el
  // visor pequeño que en el archivo final.
  tamano: 6,
  color: '#ffffff',
  fondo: 'caja',          // caja | ninguno
  colorFondo: '#000000',
  opacidadFondo: 0.7,
  posicion: 'abajo',      // abajo | centro
  mayusculas: false,
  contorno: true,
  resaltado: 'color',
  colorResaltado: '#ffd60a',
}

/** Los estilos listos para aplicar al contenedor y a la palabra que suena. */
export function aCss(estilo, anchoDelVideo) {
  const e = { ...POR_DEFECTO, ...(estilo || {}) }
  const f = FUENTES[e.fuente] || FUENTES.display
  const px = Math.max(10, (anchoDelVideo || 260) * (e.tamano / 100))

  const caja = {
    fontFamily: f.css,
    fontWeight: f.peso,
    fontSize: `${px}px`,
    lineHeight: 1.25,
    color: e.color,
    textTransform: e.mayusculas ? 'uppercase' : 'none',
    // El contorno despega el texto de cualquier fondo; sin él, sobre una
    // camisa clara el subtítulo desaparece.
    textShadow: e.contorno
      ? `0 0 ${Math.round(px / 6)}px rgba(0,0,0,0.95), 0 ${Math.round(px / 14)}px ${Math.round(px / 7)}px rgba(0,0,0,0.8)`
      : 'none',
    ...(e.fondo === 'caja'
      ? {
          background: hexConAlfa(e.colorFondo, e.opacidadFondo),
          padding: `${Math.round(px * 0.14)}px ${Math.round(px * 0.34)}px`,
          borderRadius: `${Math.round(px * 0.18)}px`,
        }
      : {}),
  }

  const resaltada =
    e.resaltado === 'color'
      ? { color: e.colorResaltado }
      : e.resaltado === 'fondo'
        ? {
            background: e.colorResaltado,
            color: '#0a0a0a',
            borderRadius: `${Math.round(px * 0.12)}px`,
            padding: `0 ${Math.round(px * 0.12)}px`,
          }
        : {}

  return { caja, resaltada, resalta: e.resaltado !== 'ninguno', posicion: e.posicion }
}

function hexConAlfa(hex, alfa) {
  const n = String(hex || '#000000').replace('#', '')
  const r = parseInt(n.slice(0, 2), 16) || 0
  const g = parseInt(n.slice(2, 4), 16) || 0
  const b = parseInt(n.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alfa ?? 1})`
}
