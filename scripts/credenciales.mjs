/* Deja la credencial de Firebase como un archivo dentro del paquete de las
 * funciones, en vez de como variable de entorno.
 *
 * Lambda solo admite 4 KB en total de variables de entorno, y las reparte a
 * TODAS las funciones por igual. La clave privada de Firebase son unos 1.700
 * caracteres: ella sola se come casi la mitad del presupuesto, y por eso el
 * despliegue reventaba al añadir una clave más.
 *
 * Así la variable se queda solo en el alcance de compilación, se escribe aquí
 * y el empaquetador la mete dentro del código de la función. No queda servida
 * en el sitio: vive dentro del paquete, que es como se hace siempre en Lambda.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const destino = join(raiz, 'netlify', 'functions', 'lib', 'credenciales.json')
mkdirSync(dirname(destino), { recursive: true })

const cred = {
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
}

// Siempre se escribe, aunque venga vacío: si el archivo falta, el empaquetado
// de las funciones falla al no encontrarlo.
writeFileSync(destino, JSON.stringify(cred))
console.log(cred.privateKey
  ? '[firebase] credencial escrita en el paquete de funciones'
  : '[firebase] sin credencial en el entorno; las funciones usarán las variables')
