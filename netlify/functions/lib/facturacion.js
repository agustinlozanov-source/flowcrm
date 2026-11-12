/* Timbrado de CFDI, detrás de un adaptador.
 *
 * Hoy el proveedor es Facturapi, elegido porque permite varios RFC emisores
 * sin costo adicional —FlowHub tiene distribuidores, y cada uno sería un
 * emisor— y porque guarda el CSD de su lado: el .cer, el .key y su contraseña
 * no pueden vivir en un repositorio público ni en las variables de Netlify,
 * que además topan en 4KB.
 *
 * Nadie más en el sistema sabe que es Facturapi. Cambiar de proveedor es
 * reescribir este archivo, igual que con el escáner de referencias.
 */

const BASE = 'https://www.facturapi.io/v2'

function llave() {
  const k = process.env.FACTURAPI_KEY
  if (!k) throw new Error('Falta FACTURAPI_KEY. Sin ella no se puede timbrar.')
  return k
}

/** true cuando la llave es de pruebas: no gasta timbres ni tiene valor fiscal. */
function esPrueba() {
  return String(process.env.FACTURAPI_KEY || '').startsWith('sk_test')
}

async function pedir(ruta, opciones = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${llave()}`,
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    },
  })

  if (opciones.binario) {
    if (!res.ok) throw new Error(`No se pudo descargar: HTTP ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  const cuerpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    /* El mensaje del proveedor tal cual, no uno genérico. Dice exactamente
     * qué campo está mal —"el régimen no corresponde al RFC"— y esa frase es
     * lo que le permite a quien captura arreglarlo. */
    const e = new Error(cuerpo.message || `HTTP ${res.status}`)
    e.detalles = cuerpo.errors || null
    e.estado = res.status
    throw e
  }
  return cuerpo
}

/* Clave del catálogo del SAT para lo que vendemos. 81161700 es servicios de
 * sistemas de información, que es lo que una suscripción a un CRM es. */
const CLAVE_SERVICIO = process.env.FACTURAPI_CLAVE_SERVICIO || '81161700'

/* La unidad por omisión. E48 es «unidad de servicio», que es lo que se vende
 * cuando lo que se factura es trabajo y no piezas. */
const CLAVE_UNIDAD = 'E48'

/**
 * Emite y timbra una factura.
 *
 * Tiene dos entradas a propósito, y no son la misma:
 *
 * - `concepto` — una sola línea, con el IVA ya dentro del precio. Es por
 *   donde entra el cobro de Stripe, donde el importe de la factura TIENE que
 *   coincidir al centavo con el cargo que se hizo.
 * - `conceptos` — varias líneas, cada una con su clave del SAT, su cantidad y
 *   su propio trato del IVA. Es por donde entra la facturación manual, que
 *   cobra cosas que no son suscripciones al CRM.
 *
 * La clave del SAT va POR LÍNEA y no fija para todo: una consultoría, una
 * capacitación y una licencia de software son tres claves distintas, y
 * timbrarlas todas como «servicios de sistemas de información» es declarar
 * mal. Cuando no viene, se usa la del CRM.
 *
 * @param fiscal   RFC, razón social, régimen, CP y uso de CFDI del receptor.
 */
async function emitir({
  fiscal, concepto, conceptos, email,
  formaPago = '04', metodoPago = 'PUE',
  moneda = 'MXN', tipoCambio = null, serie = null,
}) {
  const faltan = ['rfc', 'razonSocial', 'regimen', 'cp'].filter(k => !fiscal?.[k])
  if (faltan.length) {
    throw new Error(`Faltan datos fiscales del cliente: ${faltan.join(', ')}`)
  }

  let items
  if (Array.isArray(conceptos) && conceptos.length) {
    items = conceptos.map(c => {
      const precio = Number(c.precio)
      if (!c.descripcion?.trim()) throw new Error('Hay un concepto sin descripción')
      if (!Number.isFinite(precio) || precio <= 0) {
        throw new Error(`El concepto «${c.descripcion}» no tiene un precio válido`)
      }
      return {
        quantity: Number(c.cantidad) > 0 ? Number(c.cantidad) : 1,
        product: {
          description: c.descripcion.trim(),
          product_key: c.claveSat || CLAVE_SERVICIO,
          unit_key: c.claveUnidad || CLAVE_UNIDAD,
          price: precio,
          /* Por omisión el IVA va POR FUERA, al revés que en el camino de
           * Stripe. En una cotización mexicana el precio se pacta «más IVA»,
           * así que asumir lo contrario le quitaría el 16 % al cobro sin que
           * nadie lo note hasta el cierre de mes. */
          tax_included: c.ivaIncluido === true,
        },
      }
    })
  } else {
    items = [{
      quantity: 1,
      product: {
        description: concepto.descripcion,
        product_key: CLAVE_SERVICIO,
        price: concepto.total,
        /* El precio YA trae el IVA dentro.
         *
         * Stripe le cobró exactamente $5,500, así que la factura tiene que
         * sumar $5,500. Con tax_included en false, Facturapi le agregaría
         * el IVA encima y la factura no cuadraría con el cargo — que es
         * justo lo que el SAT y el contador del cliente van a comparar. */
        tax_included: true,
      },
    }]
  }

  return pedir('/invoices', {
    method: 'POST',
    body: JSON.stringify({
      customer: {
        legal_name: fiscal.razonSocial,
        tax_id: fiscal.rfc,
        tax_system: fiscal.regimen,
        address: { zip: String(fiscal.cp) },
        ...(email ? { email } : {}),
      },
      items,
      use: fiscal.usoCfdi || 'G03',
      payment_form: formaPago,
      payment_method: metodoPago,
      ...(moneda && moneda !== 'MXN' ? { currency: moneda } : {}),
      /* El tipo de cambio solo viaja con moneda extranjera. Mandarlo en una
       * factura en pesos la rechaza el propio validador. */
      ...(moneda && moneda !== 'MXN' && tipoCambio ? { exchange: Number(tipoCambio) } : {}),
      ...(serie ? { series: serie } : {}),
    }),
  })
}

/* Lo que va a salir, antes de que salga.
 *
 * Timbrar es irreversible: cancelar un CFDI real exige que el receptor
 * acepte, así que la única oportunidad de ver el total es antes. Esto calcula
 * lo mismo que va a calcular el SAT, con la misma regla de IVA por línea. */
function previsualizar({ conceptos = [], tasaIva = 0.16 }) {
  let subtotal = 0
  let iva = 0
  for (const c of conceptos) {
    const precio = Number(c.precio) || 0
    const cantidad = Number(c.cantidad) > 0 ? Number(c.cantidad) : 1
    const bruto = precio * cantidad
    if (c.ivaIncluido === true) {
      const base = bruto / (1 + tasaIva)
      subtotal += base
      iva += bruto - base
    } else {
      subtotal += bruto
      iva += bruto * tasaIva
    }
  }
  const r = n => Math.round(n * 100) / 100
  return { subtotal: r(subtotal), iva: r(iva), total: r(subtotal + iva) }
}

/* Busca en los catálogos del SAT que publica el proveedor.
 *
 * `ruta` es 'products' o 'units'. Devuelve [{ clave, nombre }].
 *
 * El nombre del campo cambia según el catálogo y según la versión de la API,
 * así que se leen varios en orden en vez de confiar en uno: si mañana
 * renombran `key` a `code`, esto sigue devolviendo algo en lugar de una lista
 * de «undefined» que se vería como resultados válidos. */
async function buscarCatalogo(ruta, texto) {
  const cuerpo = await pedir(`/catalogs/${ruta}?q=${encodeURIComponent(texto)}&limit=25`)
  const filas = Array.isArray(cuerpo) ? cuerpo : (cuerpo?.data || [])
  return filas
    .map(f => ({
      clave: String(f.key ?? f.code ?? f.id ?? '').trim(),
      nombre: String(f.description ?? f.name ?? f.label ?? '').trim(),
    }))
    .filter(f => f.clave)
}

/** Se la manda al cliente por correo, con su PDF y su XML adjuntos. */
async function enviarPorCorreo(facturaId, email) {
  return pedir(`/invoices/${facturaId}/email`, {
    method: 'POST',
    body: JSON.stringify(email ? { email } : {}),
  })
}

/** formato: 'pdf' | 'xml' */
async function descargar(facturaId, formato = 'pdf') {
  return pedir(`/invoices/${facturaId}/${formato}`, { binario: true })
}

/* Cancelar.
 *
 * Desde 2022 el SAT exige un motivo, y el 01 —"comprobante emitido con
 * errores con relación"— obliga a indicar cuál lo sustituye. El 02 es el que
 * sirve para una cancelación simple.
 */
async function cancelar(facturaId, { motivo = '02', sustituye = null } = {}) {
  const p = new URLSearchParams({ motive: motivo })
  if (sustituye) p.set('substitution', sustituye)
  return pedir(`/invoices/${facturaId}?${p}`, { method: 'DELETE' })
}

module.exports = {
  emitir, previsualizar, enviarPorCorreo, descargar, cancelar, esPrueba,
  buscarCatalogo, CLAVE_SERVICIO, CLAVE_UNIDAD,
}
