// Mantiene los custom claims del token alineados con users/{uid}.
//
// Las reglas de Firestore comparan contra request.auth.token.orgId, así que un
// token sin ese claim —o con uno viejo— deja al usuario sin acceso a su propia
// organización. Esto se ejecuta al iniciar sesión y solo hace trabajo cuando hay
// diferencia, así que en la práctica corre una vez por usuario.

/**
 * @param {import('firebase/auth').User} firebaseUser
 * @param {{orgId?: string|null, role?: string}} userData  documento users/{uid}
 * @returns {Promise<boolean>} true si el token se refrescó
 */
export async function syncAuthClaims(firebaseUser, userData) {
  try {
    const esperado = {
      orgId: userData?.orgId || null,
      superadmin: userData?.role === 'superadmin',
    }

    const { claims } = await firebaseUser.getIdTokenResult()
    const actual = {
      orgId: claims.orgId || null,
      superadmin: claims.superadmin === true,
    }

    if (actual.orgId === esperado.orgId && actual.superadmin === esperado.superadmin) {
      return false
    }

    const idToken = await firebaseUser.getIdToken()
    const res = await fetch('/.netlify/functions/sync-auth-claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    })
    if (!res.ok) return false

    // Los claims solo entran al token al refrescarlo. Sin esto, las lecturas
    // que vienen después siguen usando el token viejo y las reglas las rechazan.
    await firebaseUser.getIdToken(true)
    console.info('[authClaims] token actualizado:', esperado)
    return true
  } catch (e) {
    console.warn('[authClaims] no se pudieron sincronizar:', e.message)
    return false
  }
}
