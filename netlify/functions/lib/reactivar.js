/* Un descartado que vuelve a escribir regresa al embudo, donde estaba.
 *
 * Sin esto el descarte automático sería una trampa: el agente da de baja al
 * que se calló —que está bien— pero si esa persona reaparece al mes nadie se
 * entera, porque su tarjeta ya no está en el tablero. El mensaje llega al
 * inbox y ahí se queda.
 *
 * Vive aquí, y no dentro de un webhook, porque los mensajes entran por dos
 * puertas: las cuentas conectadas por Zernio y las que hablan directo con
 * Meta. La regla tiene que ser la misma por las dos, o el descarte automático
 * significa cosas distintas según por dónde llegó el lead.
 */
const admin = require('firebase-admin')

/** Devuelve true si reactivó, false si no había nada que hacer. */
async function reactivarSiVolvio(db, orgId, lead) {
  if (!lead?.discarded) return false

  /* `blacklist` nunca se reactiva: pidió no ser contactado, y volver a
     escribir no es permiso para volver a venderle. Las demás razones del
     catálogo admiten retomarse y por eso regresan solas. */
  if (lead.discardCategory === 'blacklist') return false

  try {
    const ref = db.collection('organizations').doc(orgId).collection('leads').doc(lead.id)

    /* Los contadores de rescate se ponen en cero: la conversación empieza de
       nuevo y arrastrar los intentos viejos la descartaría de inmediato. */
    await ref.update({
      discarded: false,
      reactivadoAt: admin.firestore.FieldValue.serverTimestamp(),
      descartadoAntesEl: lead.discardedAt || null,
      systemStage: lead.systemStageAntes || null,
      rescates: 0,
      ultimoRescateAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    await ref.collection('interactions').add({
      type: 'reactivate',
      content: `Volvió a escribir — reactivado desde «${lead.discardCategory || 'descartado'}»`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'agente',
    })

    console.log(`[reactivar] lead ${lead.id} de ${orgId} — escribió estando descartado`)
    return true
  } catch (e) {
    /* Que falle la reactivación no puede tumbar la recepción del mensaje:
       perder el mensaje es peor que dejar la tarjeta fuera del tablero. */
    console.error('[reactivar]', e.message)
    return false
  }
}

module.exports = { reactivarSiVolvio }
