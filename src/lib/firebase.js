import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyD-LPZYAMP8FS3IuoH5pzpG3jP659leKes",
  authDomain: "flowcrm-5cf0a.firebaseapp.com",
  projectId: "flowcrm-5cf0a",
  storageBucket: "flowcrm-5cf0a.firebasestorage.app",
  messagingSenderId: "293326243390",
  appId: "1:293326243390:web:24bcf0cea7b796319e336f"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
// Usar memoria en vez de IndexedDB para evitar cache corruption → loading infinito
export const db = initializeFirestore(app, { localCache: memoryLocalCache() })
export const storage = getStorage(app)
export default app
