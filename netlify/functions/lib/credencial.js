/* La credencial de Firebase, en un solo sitio.
 *
 * Diecisiete funciones la construían cada una por su cuenta leyendo las
 * variables de entorno. Eso dejó de valer: Lambda solo admite 4 KB de
 * variables para TODAS las funciones juntas, y la clave privada se comía casi
 * la mitad del presupuesto, así que el despliegue reventaba al añadir una
 * clave más.
 *
 * Ahora la escribe el build en un archivo que el empaquetador mete dentro del
 * código. El entorno sigue valiendo como respaldo, para que migrar de uno a
 * otro no deje un hueco en el que nada arranca.
 */
const delPaquete = require('./credenciales.json')

function credencial() {
  const privateKey = delPaquete.privateKey || process.env.FIREBASE_PRIVATE_KEY || ''
  return {
    projectId: delPaquete.projectId || process.env.FIREBASE_PROJECT_ID,
    clientEmail: delPaquete.clientEmail || process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  }
}

/** ¿Hay con qué arrancar? Lo usan las funciones que lo comprueban antes. */
function hayCredencial() {
  return Boolean(delPaquete.privateKey || process.env.FIREBASE_PRIVATE_KEY)
}

module.exports = { credencial, hayCredencial }
