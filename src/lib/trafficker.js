/* Trafficker — publicar a las redes de la organización y saber qué trajo cada
 * post.
 *
 * Este archivo es el modelo y no toca ni la red ni Firestore, para poder
 * probarlo con node sin levantar nada.
 *
 * La idea de fondo cabe en una línea: el post no trae los leads pegados, los
 * trae la liga. Si el post no lleva una liga que nosotros armamos, nadie puede
 * saber de dónde vino quien escribió, por bueno que sea el módulo. Por eso el
 * código de trazabilidad se genera ANTES de publicar y viaja dentro de la liga.
 */

/* ── Código de trazabilidad ─────────────────────────────────────────── */

/* Sin I, L, O, 0 ni 1: el código va a terminar leído en voz alta por teléfono
 * y escrito a mano por alguien que lo copia de una pantalla. Un cero que se
 * lee como O rompe la atribución sin avisar. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LARGO = 5

export function generarCodigo() {
  let c = ''
  for (let i = 0; i < LARGO; i++) {
    c += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]
  }
  return c
}

/* Busca códigos dentro de un texto suelto.
 *
 * Devuelve TODOS los candidatos y no uno: quien recibe esto tiene que
 * contrastarlos contra los códigos que existen de verdad. Un texto normal
 * puede contener por casualidad cinco letras del alfabeto de arriba, y dar
 * por buena la primera coincidencia atribuiría leads a un post al azar. */
export function codigosEnTexto(texto) {
  const re = new RegExp(`\\b[${ALFABETO}]{${LARGO}}\\b`, 'g')
  return [...new Set(String(texto || '').toUpperCase().match(re) || [])]
}

/* El código entre corchetes, que es como lo escribe el módulo.
 *
 * Separado de la lectura suelta de arriba porque una palabra española normal
 * de cinco letras —«saber», «sobre», «antes»— cae entera dentro del alfabeto,
 * y buscarlas todas en la base por cada mensaje que entra sale caro para nada.
 * Los corchetes son el camino normal; lo suelto es el rescate para cuando
 * alguien borró parte del texto antes de mandarlo. */
export function codigoEntreCorchetes(texto) {
  const m = String(texto || '').toUpperCase().match(new RegExp(`\\[([${ALFABETO}]{${LARGO}})\\]`))
  return m ? m[1] : null
}

/* ── Plataformas ────────────────────────────────────────────────────── */

export const PLATAFORMAS = [
  {
    id: 'facebook',
    nombre: 'Facebook',
    formatos: [
      { id: 'feed', nombre: 'Publicación' },
      { id: 'reel', nombre: 'Reel', exigeVideo: true },
      { id: 'story', nombre: 'Historia', exigeMedia: true },
    ],
    topeTexto: 63206,
    exigeMedia: false,
    ligaClicable: true,
    // Facebook penaliza la liga en el cuerpo del post. El primer comentario
    // sale igual de rápido y no le baja el alcance.
    aceptaPrimerComentario: true,
  },
  {
    id: 'instagram',
    nombre: 'Instagram',
    /* Instagram solo deja declarar la historia. Entre publicación y Reel
     * decide él por el archivo: video da Reel, imagen da feed. Ofrecer un
     * botón de «Reel» sería prometer algo que la API no acepta. */
    formatos: [
      { id: 'auto', nombre: 'Publicación o Reel', pista: 'Instagram elige según el archivo: video sale como Reel.' },
      { id: 'story', nombre: 'Historia', exigeMedia: true },
    ],
    topeTexto: 2200,
    /* Instagram no hace clicable una URL en el pie de foto: sale como texto
     * plano que nadie puede tocar. Pegarla igual deja el post más feo y sin
     * una sola visita de más. */
    ligaClicable: false,
    // Instagram no publica texto solo. Decirlo aquí evita subir el archivo,
    // esperar, y enterarse del rechazo al final.
    exigeMedia: true,
    aceptaPrimerComentario: true,
  },
]

export const plataforma = (id) => PLATAFORMAS.find(p => p.id === id) || null

/* ── Destinos: dónde cae quien le da clic ───────────────────────────── */

export const DESTINOS = [
  {
    id: 'whatsapp',
    nombre: 'WhatsApp',
    detalle: 'Abre una conversación con el mensaje ya escrito. El código viaja en ese texto.',
    pide: 'numero',
  },
  {
    id: 'messenger',
    nombre: 'Messenger',
    detalle: 'Abre el chat de la página. Meta nos devuelve el código en el evento de referral.',
    pide: 'pagina',
  },
  {
    id: 'landing',
    nombre: 'Una página web',
    detalle: 'Le agrega el código a la URL. Sirve si la página ya manda sus formularios al CRM.',
    pide: 'url',
  },
  {
    id: 'ninguno',
    nombre: 'Sin liga',
    detalle: 'El post sale igual, pero sus leads no se van a poder contar.',
    pide: null,
  },
]

export const TEXTO_POR_OMISION = 'Hola, quiero información'

/** El mensaje que le queda precargado a quien abre WhatsApp desde el post. */
export function textoDeWhatsapp(saludo, codigo) {
  const base = String(saludo || '').trim() || TEXTO_POR_OMISION
  return `${base} [${codigo}]`
}

/* Arma la liga que lleva el código adentro.
 *
 * Devuelve null cuando no hay forma de armarla —destino sin liga, o sin el
 * dato que pide—, para que la pantalla pueda avisar en vez de publicar un
 * post con una liga rota. */
export function ligaDeDestino({ destino, codigo, numero, paginaId, url, saludo }) {
  if (!codigo) return null

  if (destino === 'whatsapp') {
    const limpio = String(numero || '').replace(/\D/g, '')
    if (!limpio) return null
    return `https://wa.me/${limpio}?text=${encodeURIComponent(textoDeWhatsapp(saludo, codigo))}`
  }

  if (destino === 'messenger') {
    const pag = String(paginaId || '').trim()
    if (!pag) return null
    return `https://m.me/${encodeURIComponent(pag)}?ref=${codigo}`
  }

  if (destino === 'landing') {
    const cruda = String(url || '').trim()
    if (!cruda) return null
    /* Se respeta lo que la URL ya traiga. Pegar "?ref=" a ciegas sobre una
     * dirección que ya tiene query la rompe, y el post sale con una liga que
     * no abre. */
    const conEsquema = /^https?:\/\//i.test(cruda) ? cruda : `https://${cruda}`
    try {
      const u = new URL(conEsquema)
      u.searchParams.set('ref', codigo)
      return u.toString()
    } catch {
      return null
    }
  }

  return null
}

/* ── Validación, antes de gastar el post ────────────────────────────── */

/* Qué le falta al borrador. Lista de frases, en el orden en que conviene
 * arreglarlas. Vacía quiere decir que se puede publicar. */
export function problemasDelPost(borrador = {}) {
  const p = []
  const elegidas = borrador.destinos || []

  if (!elegidas.length) p.push('Elige al menos una red donde publicar.')

  const hayMedia = (borrador.media || []).length > 0
  const hayVideo = (borrador.media || []).some(m => m.tipo === 'video')
  const texto = String(borrador.contenido || '').trim()

  for (const d of elegidas) {
    const plat = plataforma(d.plataforma)
    if (!plat) continue
    if (!d.cuentaId) {
      p.push(`${plat.nombre} no tiene una cuenta conectada para publicar.`)
      continue
    }
    if (plat.exigeMedia && !hayMedia) {
      p.push(`${plat.nombre} no publica texto solo: sube una imagen o un video.`)
    }
    const formato = plat.formatos.find(f => f.id === (d.formato || 'feed'))
    if (formato?.exigeVideo && !hayVideo) {
      p.push(`Un ${formato.nombre.toLowerCase()} de ${plat.nombre} necesita un video.`)
    }
    if (formato?.exigeMedia && !hayMedia) {
      p.push(`Una ${formato.nombre.toLowerCase()} de ${plat.nombre} necesita una imagen o un video.`)
    }
    if (texto.length > plat.topeTexto) {
      p.push(`El texto se pasa del tope de ${plat.nombre} por ${texto.length - plat.topeTexto} caracteres.`)
    }
  }

  if (!texto && !hayMedia) p.push('El post está vacío.')

  const dest = DESTINOS.find(x => x.id === borrador.destino)
  if (dest?.pide && !ligaDeDestino({ ...borrador, codigo: borrador.codigo || 'XXXXX' })) {
    const falta = { numero: 'el número de WhatsApp', pagina: 'el id de la página', url: 'la dirección de la página' }
    p.push(`Falta ${falta[dest.pide]} para poder armar la liga.`)
  }

  if (borrador.cuando === 'despues' && !borrador.programadoPara) {
    p.push('Dile cuándo quieres que salga.')
  }

  return p
}

/* ── Estados ────────────────────────────────────────────────────────── */

export const ESTADOS = {
  programado: { nombre: 'Programado', color: '#0066ff' },
  publicando: { nombre: 'Publicando', color: '#c47000' },
  publicado: { nombre: 'Publicado', color: '#00a846' },
  parcial: { nombre: 'Salió a medias', color: '#c47000' },
  fallido: { nombre: 'Falló', color: '#d92d20' },
  cancelado: { nombre: 'Cancelado', color: '#8e8e93' },
}

export const nombreEstado = (e) => ESTADOS[e]?.nombre || e

/* ── Campaña y táctica ──────────────────────────────────────────────── */

/* Viajan como tags del post en Zernio, que los sabe filtrar después
 * (`GET /v1/analytics?tags=`). Guardarlos solo de nuestro lado obligaría a
 * recorrer todos los posts para agrupar por campaña.
 *
 * El filtro de Zernio compara exacto y distingue mayúsculas, así que se
 * normalizan aquí una sola vez: «Black Friday» y «black friday» tienen que
 * caer en el mismo tag o la campaña queda partida en dos. */
export function tagsDePost({ campana, tactica, codigo }) {
  const limpiar = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40)
  const tags = []
  if (campana) tags.push(`campana:${limpiar(campana)}`)
  if (tactica) tags.push(`tactica:${limpiar(tactica)}`)
  if (codigo) tags.push(`codigo:${codigo}`)
  return tags.filter(Boolean)
}

/* ── Cuándo sale ────────────────────────────────────────────────────── */

/* Cuánto adelante se programa un post que el cliente pidió «ahora».
 *
 * Zernio puede publicar dentro de la misma petición con `publishNow`, pero un
 * video a Facebook tarda más que los 26 segundos que vive una función de
 * Netlify, y ahí se cae justo el contenido que más importa. Programarlo un
 * minuto adelante hace que publicar ya y programar para el jueves sean el
 * mismo camino, y que el estado real llegue por webhook en vez de depender de
 * que la petición sobreviva.
 *
 * Tiene que quedar en el futuro: Zernio publica síncrono cualquier fecha ya
 * pasada, que es justo lo que estamos evitando. */
export const MINUTOS_DE_GRACIA = 1

export function cuandoSale({ cuando, programadoPara }, ahora = new Date()) {
  if (cuando === 'despues' && programadoPara) {
    const d = new Date(programadoPara)
    if (!Number.isNaN(d.getTime()) && d > ahora) return d
  }
  return new Date(ahora.getTime() + MINUTOS_DE_GRACIA * 60_000)
}

/* ── Lo que Zernio entiende por formato ─────────────────────────────── */

/* Zernio solo acepta contentType para lo que se sale del feed: 'story' en las
 * dos redes y 'reel' únicamente en Facebook. Mandarle 'feed' o 'reel' a
 * Instagram lo rechaza, así que acá se devuelve null y el campo se omite. */
export function contentTypeDeFormato(plataformaId, formato) {
  if (formato === 'story') return 'story'
  if (formato === 'reel' && plataformaId === 'facebook') return 'reel'
  return null
}

/* ── Qué texto le toca a cada red ───────────────────────────────────── */

/* La liga se pega solo donde sirve de algo.
 *
 * En Facebook es clicable y se pega al final del texto, salvo que el post la
 * mande al primer comentario. En Instagram no: una URL en el pie de foto sale
 * como texto plano que nadie puede tocar, así que pegarla solo ensucia el
 * post. De ahí que Instagram reciba su propio texto.
 *
 * Que Instagram quede sin liga clicable tiene consecuencia: esos posts no van
 * a traer leads por este camino, y la pantalla tiene que decirlo en vez de
 * dejar que alguien se entere por un cero. */
export function textoParaRed(plataformaId, contenido, liga, ligaEnComentario) {
  const base = String(contenido || '')
  if (!liga || ligaEnComentario) return base
  if (!plataforma(plataformaId)?.ligaClicable) return base
  return base.trim() ? `${base}

${liga}` : liga
}

/** Las redes elegidas que no van a poder traer leads por la liga. */
export function redesSinLiga(destinos = [], liga) {
  if (!liga) return []
  return destinos
    .filter(d => !plataforma(d.plataforma)?.ligaClicable)
    .map(d => plataforma(d.plataforma).nombre)
}
