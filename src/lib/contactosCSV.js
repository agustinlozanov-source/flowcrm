/* El CSV de contactos — la plantilla, la lectura y el motivo de cada renglón
 * que se queda fuera.
 *
 * Aparte de la pantalla a propósito: esto es lo que decide en silencio si un
 * archivo entero entra o no, y así se puede probar sin abrir el navegador.
 */
import { partirCSV, normalizar, armarCSV, descargarTexto } from './csv'
import { normalizePhone } from './utils'

/* La plantilla es el espejo de la exportación: mismas columnas, mismos
 * nombres, mismo orden. No lo era —la plantilla pedía `name,company,email,
 * phone` y la exportación entregaba `Nombre,Teléfono,Email,Empresa`—, así que
 * bajar la base del cliente y volver a subirla daba «0 contactos encontrados»
 * sin un solo error a la vista. Y no había columna para el apellido, que es lo
 * que el alta manual pide al lado del nombre.
 *
 * Si se agrega un campo al contacto, se agrega en los dos lados: aquí y en
 * COLUMNAS_LEADS de lib/exportar.
 */
export const COLUMNAS_CONTACTO = ['Nombre', 'Apellido', 'Teléfono', 'Email', 'Empresa', 'Dirección', 'Origen', 'Valor']

const EJEMPLOS_CONTACTO = [
  ['Juan', 'Pérez', '+525512345678', 'juan@empresa.com', 'Empresa SA', 'Av. Reforma 222, CDMX', 'Meta Ads', '5000'],
  ['María', 'García', '+525598765432', 'maria@startup.com', 'Startup MX', '', 'Instagram', '2500'],
]

const soloDigitos = t => String(t || '').replace(/\D/g, '')

/** Dónde cae cada columna, por el nombre del encabezado. Tolerante a propósito:
 *  el archivo puede venir de la exportación, de la plantilla o del sistema
 *  anterior, y nadie va a renombrar encabezados a mano. */
function mapearColumnasContacto(encabezado) {
  const idx = {}
  encabezado.forEach((h, i) => {
    const n = normalizar(h)
    if (/apellido|last/.test(n) && idx.apellido == null) idx.apellido = i
    else if (/nombre|contacto|name|cliente/.test(n) && idx.nombre == null) idx.nombre = i
    else if (/telefono|celular|whats|movil|phone|tel\b/.test(n) && idx.telefono == null) idx.telefono = i
    else if (/email|correo|mail/.test(n) && idx.email == null) idx.email = i
    else if (/empresa|compania|company|negocio|organizacion/.test(n) && idx.empresa == null) idx.empresa = i
    else if (/direccion|domicilio|address|ubicacion/.test(n) && idx.direccion == null) idx.direccion = i
    else if (/origen|source|canal|medio/.test(n) && idx.origen == null) idx.origen = i
    else if (/valor|monto|importe|value|precio/.test(n) && idx.valor == null) idx.valor = i
  })
  return idx
}

/** El origen contra los que la pantalla sabe dibujar. Un «Face» mal escrito
 *  entra como manual en vez de quedarse sin icono y sin filtro. */
function origenDe(texto, origenes) {
  const n = normalizar(texto)
  if (!n) return 'manual'
  const clave = Object.keys(origenes).find(k => normalizar(k) === n)
  if (clave) return clave
  const porEtiqueta = Object.entries(origenes).find(([, label]) => normalizar(label) === n)
  return porEtiqueta ? porEtiqueta[0] : 'manual'
}

/* Excel exporta «$5,000.00» y la gente escribe «5 000». Lo que no es dígito
   ni punto estorba. */
const valorDe = t => Number(String(t || '').replace(/[^\d.]/g, '')) || 0

/** Se conserva el «+» porque es lo que distingue un número con lada de uno
 *  sin ella; el resto, dígitos. */
function telefonoDe(texto) {
  const s = String(texto || '').trim()
  const d = soloDigitos(s)
  if (!d) return ''
  return s.startsWith('+') ? `+${d}` : d
}

/** Lee el CSV y separa lo que entra de lo que no, con el motivo.
 *
 *  Los duplicados se detectan contra los contactos que ya existen —por los
 *  últimos diez dígitos del teléfono y por el email— y también dentro del
 *  propio archivo. Importar dos veces la misma base era, hasta ahora, cargar
 *  todo otra vez. */
export function leerContactosCSV(texto, { existentes = [], origenes = {} } = {}) {
  const filas = partirCSV(texto)
  if (filas.length < 2) return { listas: [], sueltas: [], sinColumnas: filas.length === 1 }

  const idx = mapearColumnasContacto(filas[0])
  if (idx.nombre == null && idx.telefono == null) return { listas: [], sueltas: [], sinColumnas: true }

  const porTelefono = new Map()
  const porEmail = new Map()
  existentes.forEach(l => {
    const d = soloDigitos(normalizePhone(l.phone))
    if (d.length >= 10) porTelefono.set(d.slice(-10), l)
    if (l.email) porEmail.set(normalizar(l.email), l)
  })

  const listas = [], sueltas = []
  const telVistos = new Set(), mailVistos = new Set()

  filas.slice(1).forEach((f, i) => {
    const renglon = i + 2
    const en = k => (idx[k] == null ? '' : String(f[idx[k]] ?? '').trim())

    const nombre = en('nombre')
    const phone = telefonoDe(en('telefono'))
    const email = en('email')
    const etiqueta = nombre || phone || email || '(vacío)'

    if (!nombre && !phone) {
      sueltas.push({ renglon, nombre: etiqueta, motivo: 'Sin nombre ni teléfono' })
      return
    }

    const d = soloDigitos(phone)
    const claveTel = d.length >= 10 ? d.slice(-10) : ''
    const claveMail = email ? normalizar(email) : ''

    /* El teléfono y el email se marcan como vistos aunque el renglón se vaya
       fuera. Si no, un renglón descartado por duplicado deja su email libre y
       el siguiente que lo traiga entra como si fuera nuevo. */
    const marcar = () => {
      if (claveTel) telVistos.add(claveTel)
      if (claveMail) mailVistos.add(claveMail)
    }

    if (claveTel && porTelefono.has(claveTel)) {
      marcar(); sueltas.push({ renglon, nombre: etiqueta, motivo: 'Ya existe con ese teléfono' }); return
    }
    if (claveMail && porEmail.has(claveMail)) {
      marcar(); sueltas.push({ renglon, nombre: etiqueta, motivo: 'Ya existe con ese email' }); return
    }
    if ((claveTel && telVistos.has(claveTel)) || (claveMail && mailVistos.has(claveMail))) {
      sueltas.push({ renglon, nombre: etiqueta, motivo: 'Repetido en el archivo' }); return
    }
    marcar()

    listas.push({
      name: nombre || phone,
      lastName: en('apellido'),
      company: en('empresa'),
      email,
      phone,
      address: en('direccion'),
      source: origenDe(en('origen'), origenes),
      value: valorDe(en('valor')),
    })
  })

  return { listas, sueltas, sinColumnas: false }
}

export function descargarPlantillaContactos() {
  descargarTexto('plantilla-contactos.csv', armarCSV(COLUMNAS_CONTACTO, EJEMPLOS_CONTACTO))
}
