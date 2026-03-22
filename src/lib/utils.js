/**
 * Normaliza el campo phone de un lead.
 * Soporta string y el formato objeto legacy { lada, number }
 */
export function normalizePhone(phone) {
  if (!phone) return ''
  if (typeof phone === 'object') {
    return `${phone.lada || ''}${phone.number || ''}`.trim()
  }
  return String(phone)
}
