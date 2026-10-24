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

/**
 * Emite y timbra una factura.
 *
 * @param fiscal   RFC, razón social, régimen, CP y uso de CFDI del receptor.
 * @param concepto Qué se le está cobrando y cuánto.
 */
async function emitir({ fiscal, concepto, email, formaPago = '04', metodoPago = 'PUE' }) {
  const faltan = ['rfc', 'razonSocial', 'regimen', 'cp'].filter(k => !fiscal?.[k])
  if (faltan.length) {
    throw new Error(`Faltan datos fiscales del cliente: ${faltan.join(', ')}`)
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
      items: [{
        quantity: 1,
        product: {
          description: concepto.descripcion,
          product_key: CLAVE_SERVICIO,
          price: concepto.total,
          /* El precio YA trae el IVA dentro.
           *
           * Stripe le cobró exactamente $5,500, así que la factura tiene que
           * sumar $5,500. Con tax_included en false, Facturadía le agregaría
           * el IVA encima y la factura no cuadraría con el cargo — que es
           * justo lo que el SAT y el contador del cliente van a comparar. */
          tax_included: true,
        },
      }],
      use: fiscal.usoCfdi || 'G03',
      payment_form: formaPago,
      payment_method: metodoPago,
    }),
  })
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

module.exports = { emitir, enviarPorCorreo, descargar, cancelar, esPrueba, CLAVE_SERVICIO }
