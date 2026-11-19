/* En qué embudos contesta el agente, y con qué guion.
 *
 * Hasta noviembre de 2026 el agente contestaba en cualquier embudo, y si el
 * embudo no tenía instrucciones tomaba «la primera que no esté vacía», que es
 * la de otro negocio. Así el embudo de una marca personal sin configurar
 * contestaba con el guion de la clínica.
 *
 * Las reglas:
 *   1. Un embudo apagado a mano no contesta.
 *   2. Con un solo embudo en la organización, contesta siempre: no hay guion
 *      ajeno que tomar prestado y así trabajaban todas las cuentas de un
 *      solo negocio.
 *   3. Con varios, contesta solo el embudo que tiene algo propio: sus
 *      instrucciones, sus documentos, o las instrucciones generales.
 *   4. Nunca contesta con las instrucciones de otro embudo.
 *
 * Sin embudo (el lead está esperando a que el conmutador lo coloque) no se
 * decide aquí: manda el conmutador.
 */

const lleno = (t) => typeof t === 'string' && t.trim().length > 0

/** null si el agente contesta; si no, el motivo ('apagado' | 'sin_instrucciones'). */
function porQueNoContesta({ instrucciones, pipelineId, totalEmbudos, apagadoEn, tieneDocumentos }) {
  if (!pipelineId) return null
  if (apagadoEn && apagadoEn[pipelineId] === true) return 'apagado'
  if (totalEmbudos <= 1) return null

  // Texto suelto: es el formato viejo, o el guion de un distribuidor. Vale
  // para todos los embudos, como siempre valió.
  if (typeof instrucciones === 'string') return lleno(instrucciones) || tieneDocumentos ? null : 'sin_instrucciones'

  const mapa = instrucciones && typeof instrucciones === 'object' ? instrucciones : {}
  if (lleno(mapa[pipelineId]) || lleno(mapa.__default__) || tieneDocumentos) return null
  return 'sin_instrucciones'
}

/** Las instrucciones con las que contesta este embudo. Nunca las de otro,
 *  salvo que la organización tenga uno solo. */
function instruccionesDelEmbudo({ instrucciones, pipelineId, totalEmbudos, conmutador }) {
  if (typeof instrucciones === 'string') return instrucciones
  const mapa = instrucciones && typeof instrucciones === 'object' ? instrucciones : {}
  if (!pipelineId) return (conmutador && conmutador.instrucciones) || mapa.__default__ || ''
  if (lleno(mapa[pipelineId])) return mapa[pipelineId]
  if (lleno(mapa.__default__)) return mapa.__default__
  // Con un solo embudo, lo que haya escrito es suyo aunque esté guardado con
  // el id de un embudo que ya no existe.
  if (totalEmbudos <= 1) return Object.values(mapa).find(lleno) || ''
  return ''
}

module.exports = { porQueNoContesta, instruccionesDelEmbudo }
