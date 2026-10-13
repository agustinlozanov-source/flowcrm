/* Descarga de datos a CSV.
 *
 * La base es del cliente y tiene que poder llevársela. Se arma en el navegador
 * con lo que ya está cargado: no hace falta pasar por el servidor ni volver a
 * leer Firestore.
 */

/** Escapa un valor para CSV. Sin esto, un nombre con coma parte la fila y una
 *  nota con comillas rompe el archivo entero. */
function celda(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const fecha = (ts) => {
  const d = ts?.toDate?.() || (ts ? new Date(ts) : null)
  return d && !isNaN(d) ? d.toISOString().slice(0, 10) : ''
}

export function descargarCSV(nombre, columnas, filas) {
  const cabecera = columnas.map(c => celda(c.label)).join(',')
  const cuerpo = filas.map(f => columnas.map(c => celda(c.valor(f))).join(',')).join('\n')
  // El BOM es lo que hace que Excel abra los acentos bien en vez de mostrar
  // "Mart√≠nez". Sin él el archivo es correcto pero se ve roto.
  const blob = new Blob(['﻿' + cabecera + '\n' + cuerpo], { type: 'text/csv;charset=utf-8;' })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombre}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return filas.length
}

export const COLUMNAS_LEADS = [
  { label: 'Nombre',        valor: l => [l.name, l.lastName].filter(Boolean).join(' ') },
  { label: 'Teléfono',      valor: l => l.phone },
  { label: 'Email',         valor: l => l.email },
  { label: 'Empresa',       valor: l => l.company },
  { label: 'Dirección',     valor: l => l.address },
  { label: 'Origen',        valor: l => l.source },
  { label: 'Score',         valor: l => l.score ?? 0 },
  { label: 'Etapa',         valor: l => l.systemStage || 'calentamiento' },
  { label: 'Valor real',    valor: l => l.opportunityStats?.valueReal ?? l.value ?? 0 },
  { label: 'Valor potencial', valor: l => l.opportunityStats?.valuePotencial ?? 0 },
  { label: 'Ganado',        valor: l => l.opportunityStats?.valueWon ?? 0 },
  { label: 'Descartado',    valor: l => (l.discarded ? 'sí' : 'no') },
  { label: 'Motivo descarte', valor: l => l.discardCategory },
  { label: 'Creado',        valor: l => fecha(l.createdAt) },
  { label: 'Último mensaje', valor: l => fecha(l.lastMessageAt) },
]

export const COLUMNAS_PRODUCTOS = [
  { label: 'Nombre',      valor: p => p.name },
  { label: 'Descripción', valor: p => p.description },
  { label: 'Precio',      valor: p => p.price },
  { label: 'Moneda',      valor: p => p.currency || 'MXN' },
  { label: 'Categoría',   valor: p => p.category },
  { label: 'Resuelve',    valor: p => (p.problemTags || []).join(' · ') },
  { label: 'Duración días', valor: p => p.durationDays || '' },
]
