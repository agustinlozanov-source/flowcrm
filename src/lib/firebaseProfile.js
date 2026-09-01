// Instancia secundaria de Firebase para el Company Profile Builder (/perfil).
//
// El cliente final entra con un custom token emitido por profile-session. Si esa
// sesión usara la instancia principal, sobrescribiría la sesión de quien ya
// estuviera dentro de la app o del superadmin en el mismo navegador — algo muy
// probable mientras el equipo prueba el formulario. Una app secundaria mantiene
// las dos sesiones separadas.

import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, getFirestore, memoryLocalCache } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { firebaseConfig } from '@/lib/firebase'

const APP_NAME = 'profile-portal'

const app = getApps().find(a => a.name === APP_NAME) || initializeApp(firebaseConfig, APP_NAME)

export const profileAuth = getAuth(app)

// initializeFirestore truena si la instancia ya existe (p. ej. tras un HMR).
export const profileDb = (() => {
  try {
    return initializeFirestore(app, { localCache: memoryLocalCache() })
  } catch {
    return getFirestore(app)
  }
})()

export const profileStorage = getStorage(app)

export default app
