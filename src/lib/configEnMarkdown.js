/* Cargar y sacar la configuración del embudo y del scoring como Markdown.
 *
 * Llenar un scoring a mano son decenas de campos: categorías con su tope,
 * subcategorías con el suyo, y cada señal con su texto, su signo y su peso.
 * Hacerlo clic por clic es lento y, peor, es donde se cometen los errores que
 * nadie revisa — un tope que no suma 100, un rango de etapas que se pisa.
 *
 * En texto se escribe de corrido, se lee de un vistazo, se puede versionar y
 * se puede pedir escrito. Esa es toda la idea.
 *
 * Va en los dos sentidos a propósito. Solo cargar obligaría a escribir desde
 * cero cada vez; poder SACAR lo que ya existe permite copiarlo, cambiar tres
 * líneas y volver a pegarlo. Lo que sale tiene que poder volver a entrar sin
 * perder nada, y hay una prueba que lo comprueba.
 *
 * No toca la base ni la pantalla: solo texto adentro, datos afuera. Así se
 * puede probar entero sin levantar nada.
 */

/* ── Piezas comunes ─────────────────────────────────────────────────── */

const limpio = (t) => String(t ?? '').trim()

/* Las líneas, sin lo que no dice nada.
 *
 * Se quitan los cercos de código porque un Markdown copiado de un chat casi
 * siempre viene envuelto en ```, y pegarlo tal cual hacía fallar la primera
 * línea sin explicar por qué. */
function lineasDe(md) {
  return String(md || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(l => !/^\s*```/.test(l))
}

/* Un número al final de un título: «Necesidad · 30», «Necesidad (30)»,
 * «Necesidad — 30». Se aceptan los tres separadores porque son los tres que
 * alguien escribe sin pensarlo, y rechazar dos de ellos solo enseña a pelear
 * con el formato. */
function tituloYTope(texto) {
  const m = limpio(texto).match(/^(.*?)\s*(?:[·—–\-]|\()\s*(\d{1,3})\s*\)?$/)
  if (!m) return { titulo: limpio(texto), tope: null }
  return { titulo: limpio(m[1]), tope: Number(m[2]) }
}

/* ── El embudo ──────────────────────────────────────────────────────── */

export const PROPOSITOS = ['adquisicion', 'retencion', 'distribucion']
export const FASES = ['calentamiento', 'handoff', 'cierre']

/* Las fases escritas como las escribe una persona. El acento y la mayúscula
 * no pueden ser la diferencia entre que cargue y que no. */
const FASE_POR_NOMBRE = {
  calentamiento: 'calentamiento', calientamiento: 'calentamiento', calentar: 'calentamiento',
  handoff: 'handoff', 'hand off': 'handoff', 'hand-off': 'handoff', entrega: 'handoff',
  cierre: 'cierre', cerrar: 'cierre', venta: 'cierre',
}

const PROPOSITO_POR_NOMBRE = {
  adquisicion: 'adquisicion', adquisición: 'adquisicion', venta: 'adquisicion', ventas: 'adquisicion',
  retencion: 'retencion', retención: 'retencion',
  distribucion: 'distribucion', distribución: 'distribucion', distribuidores: 'distribucion',
}

const sinAcentos = (t) =>
  String(t || '').toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ')

/* Lee el embudo entero desde Markdown.
 *
 * Formato:
 *
 *   # Clientes nuevos
 *   Propósito: adquisición
 *   Descripción: a quién atiende este embudo
 *
 *   ## Etapas
 *   - Nuevo · calentamiento · 0-20
 *   - Contactado · calentamiento · 21-40
 *   - Cierre · cierre · 81-100
 *
 * Devuelve siempre `problemas`, aunque haya leído algo: cargar a medias sin
 * avisar es peor que no cargar, porque el embudo queda distinto de lo que
 * dice el texto y nadie lo sabe. */
export function leerEmbudo(md) {
  const lineas = lineasDe(md)
  const r = { nombre: '', purpose: null, descripcion: '', etapas: [] }
  const problemas = []
  let enEtapas = false

  for (const cruda of lineas) {
    const l = limpio(cruda)
    if (!l) continue

    if (/^#\s+/.test(l)) { r.nombre = limpio(l.replace(/^#\s+/, '')); enEtapas = false; continue }

    if (/^##\s+/.test(l)) {
      enEtapas = /etapa/i.test(sinAcentos(l))
      continue
    }

    if (!enEtapas) {
      const prop = l.match(/^(?:prop[oó]sito|proposito)\s*:\s*(.+)$/i)
      if (prop) {
        const clave = sinAcentos(prop[1])
        r.purpose = PROPOSITO_POR_NOMBRE[clave] || PROPOSITO_POR_NOMBRE[limpio(prop[1]).toLowerCase()] || null
        if (!r.purpose) problemas.push(`No reconozco el propósito «${limpio(prop[1])}». Tiene que ser adquisición, retención o distribución.`)
        continue
      }
      const desc = l.match(/^(?:descripci[oó]n|para qui[eé]n)\s*:\s*(.+)$/i)
      if (desc) { r.descripcion = limpio(desc[1]); continue }
      continue
    }

    /* Una etapa: «- Nuevo · calentamiento · 0-20 · #0066ff».
     * El color y la fase pueden faltar; el rango no, porque sin él el agente
     * no sabe a qué etapa mover al lead. */
    const item = l.match(/^[-*]\s+(.+)$/)
    if (!item) continue

    const partes = item[1].split(/\s*[·|]\s*/).map(limpio).filter(Boolean)
    const etapa = { name: partes[0] || '', fase: 'calentamiento', scoreMin: null, scoreMax: null, color: null }

    for (const p of partes.slice(1)) {
      const rango = p.match(/^(\d{1,3})\s*[-–—a]\s*(\d{1,3})$/)
      if (rango) { etapa.scoreMin = Number(rango[1]); etapa.scoreMax = Number(rango[2]); continue }
      if (/^#[0-9a-f]{3,8}$/i.test(p)) { etapa.color = p; continue }
      const fase = FASE_POR_NOMBRE[sinAcentos(p)]
      if (fase) { etapa.fase = fase; continue }
      problemas.push(`En la etapa «${etapa.name}» no entiendo «${p}».`)
    }

    if (!etapa.name) { problemas.push('Hay una etapa sin nombre.'); continue }
    if (etapa.scoreMin == null) {
      problemas.push(`La etapa «${etapa.name}» no trae rango de score. Sin él, el agente no sabe cuándo mover un lead ahí.`)
    }
    r.etapas.push(etapa)
  }

  if (!r.nombre) problemas.push('Falta el nombre del embudo, que va en la primera línea con un #.')
  if (!r.etapas.length) problemas.push('No encontré etapas. Van debajo de un «## Etapas», una por línea con un guión.')

  problemas.push(...problemasDeRangos(r.etapas))
  return { ...r, problemas }
}

/* Los rangos tienen que repartirse el 0-100 sin pisarse ni dejar huecos.
 *
 * Dos etapas que cubren el mismo número hacen que el lead caiga en una u otra
 * según el orden en que se evalúen, y un hueco deja scores que no mueven a
 * ningún lado. Las dos fallan en silencio: el embudo simplemente deja de
 * moverse y nadie sabe por qué. */
export function problemasDeRangos(etapas = []) {
  const p = []
  const conRango = etapas.filter(e => e.scoreMin != null && e.scoreMax != null)
  if (!conRango.length) return p

  for (const e of conRango) {
    if (e.scoreMin > e.scoreMax) p.push(`La etapa «${e.name}» tiene el rango al revés: ${e.scoreMin}-${e.scoreMax}.`)
    if (e.scoreMin < 0 || e.scoreMax > 100) p.push(`La etapa «${e.name}» se sale del 0-100.`)
  }

  const ordenadas = [...conRango].sort((a, b) => a.scoreMin - b.scoreMin)
  for (let i = 1; i < ordenadas.length; i++) {
    const antes = ordenadas[i - 1], ahora = ordenadas[i]
    if (ahora.scoreMin <= antes.scoreMax) {
      p.push(`«${antes.name}» y «${ahora.name}» se pisan entre ${ahora.scoreMin} y ${antes.scoreMax}.`)
    } else if (ahora.scoreMin > antes.scoreMax + 1) {
      p.push(`Queda un hueco entre ${antes.scoreMax + 1} y ${ahora.scoreMin - 1}: un lead con ese score no se mueve a ningún lado.`)
    }
  }
  if (ordenadas[0].scoreMin > 0) p.push(`Nada cubre del 0 al ${ordenadas[0].scoreMin - 1}.`)
  const ultimo = ordenadas[ordenadas.length - 1]
  if (ultimo.scoreMax < 100) p.push(`Nada cubre del ${ultimo.scoreMax + 1} al 100.`)

  return p
}

/** El embudo de vuelta a Markdown, para copiarlo, cambiarlo y volver a pegarlo. */
export function escribirEmbudo({ nombre, purpose, descripcion, etapas = [] }) {
  const l = [`# ${limpio(nombre)}`]
  if (purpose) l.push(`Propósito: ${purpose}`)
  if (limpio(descripcion)) l.push(`Descripción: ${limpio(descripcion)}`)
  l.push('', '## Etapas')
  for (const e of etapas) {
    const partes = [e.name, e.fase || 'calentamiento']
    if (e.scoreMin != null && e.scoreMax != null) partes.push(`${e.scoreMin}-${e.scoreMax}`)
    if (e.color) partes.push(e.color)
    l.push(`- ${partes.join(' · ')}`)
  }
  return l.join('\n')
}

/* ── El scoring ─────────────────────────────────────────────────────── */

/* Formato:
 *
 *   ## Necesidad · 30
 *   ¿Tiene un problema real que resolver?
 *
 *   ### Urgencia · 15
 *   +5 Tiene fecha límite explícita
 *   -5 Es un deseo futuro sin presión de tiempo
 *
 * El signo del peso es el que decide si la señal suma o resta. Escribirlo
 * delante del texto lo hace evidente al leer la lista de corrido, que es
 * justo cuando se detecta que algo quedó al revés.
 */
export function leerScoring(md) {
  const lineas = lineasDe(md)
  const categorias = []
  const problemas = []
  let cat = null, sub = null

  const id = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`

  for (const cruda of lineas) {
    const l = limpio(cruda)
    if (!l) continue

    if (/^###\s+/.test(l)) {
      if (!cat) { problemas.push(`La subcategoría «${limpio(l.replace(/^###\s+/, ''))}» aparece antes de cualquier categoría.`); continue }
      const { titulo, tope } = tituloYTope(l.replace(/^###\s+/, ''))
      sub = { id: id('sub'), label: titulo, tope: tope ?? 10, signals: [] }
      cat.subcategories.push(sub)
      continue
    }

    if (/^##\s+/.test(l)) {
      const { titulo, tope } = tituloYTope(l.replace(/^##\s+/, ''))
      cat = { id: id('cat'), label: titulo, color: '#0066ff', desc: '', tope: tope ?? 25, subcategories: [] }
      categorias.push(cat)
      sub = null
      continue
    }

    if (/^#\s+/.test(l)) continue   // el título del documento, si lo trae

    /* Una señal: «+5 texto», «- -5 texto», «• +10 texto». El guión de lista
     * es opcional porque se escribe de las dos formas. */
    const señal = l.match(/^(?:[-*•]\s+)?([+-]\s*\d{1,3})\s+(.+)$/)
    if (señal) {
      if (!sub) { problemas.push(`La señal «${limpio(señal[2])}» aparece antes de cualquier subcategoría.`); continue }
      const peso = Number(señal[1].replace(/\s+/g, ''))
      sub.signals.push({
        id: id('sig'),
        text: limpio(señal[2]),
        type: peso >= 0 ? 'up' : 'down',
        weight: peso,
      })
      continue
    }

    // Texto suelto debajo de una categoría: su descripción.
    if (cat && !sub && !cat.desc) { cat.desc = l; continue }
  }

  if (!categorias.length) {
    problemas.push('No encontré categorías. Van con «## Nombre · tope», y las subcategorías con «###».')
  }
  problemas.push(...problemasDeScoring(categorias))
  return { categorias, problemas }
}

/* El tope de las categorías tiene que sumar 100, que es la escala del score.
 *
 * Si suma menos, el lead nunca puede llegar a las etapas de arriba por bien
 * que califique. Si suma más, llega antes de merecerlo. En los dos casos el
 * embudo miente sin fallar. */
export function problemasDeScoring(categorias = []) {
  const p = []
  const total = categorias.reduce((s, c) => s + (Number(c.tope) || 0), 0)
  if (categorias.length && total !== 100) {
    p.push(`Los topes suman ${total} y tienen que sumar 100. ${total < 100
      ? 'Así, un lead no puede llegar al tope por bien que califique.'
      : 'Así, llega al tope antes de merecerlo.'}`)
  }

  for (const c of categorias) {
    if (!c.label) p.push('Hay una categoría sin nombre.')
    if (!c.subcategories.length) p.push(`La categoría «${c.label}» no tiene subcategorías.`)
    const suben = c.subcategories.reduce((s, x) => s + (Number(x.tope) || 0), 0)
    if (suben > c.tope) {
      p.push(`En «${c.label}» las subcategorías suman ${suben}, más que el tope de la categoría (${c.tope}).`)
    }
    for (const s of c.subcategories) {
      if (!s.signals.length) p.push(`La subcategoría «${s.label}» de «${c.label}» no tiene señales.`)
      const suma = s.signals.filter(g => g.weight > 0).reduce((a, g) => a + g.weight, 0)
      if (suma < s.tope) {
        p.push(`En «${s.label}» las señales positivas suman ${suma} y el tope es ${s.tope}: ese tope no se alcanza nunca.`)
      }
    }
  }
  return p
}

/** El scoring de vuelta a Markdown. */
export function escribirScoring(categorias = []) {
  const l = []
  for (const c of categorias) {
    l.push(`## ${c.label} · ${c.tope ?? 25}`)
    if (limpio(c.desc)) l.push(c.desc)
    for (const s of c.subcategories || []) {
      l.push('', `### ${s.label} · ${s.tope ?? 10}`)
      for (const g of s.signals || []) {
        const peso = Number(g.weight) || 0
        l.push(`${peso >= 0 ? '+' : ''}${peso} ${g.text}`)
      }
    }
    l.push('')
  }
  return l.join('\n').trim()
}
