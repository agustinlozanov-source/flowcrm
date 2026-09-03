# Reglas de seguridad — Company Profile Builder

## ⚠️ Léelo antes de tocar la consola

Los archivos de esta carpeta son **archivos completos**, listos para pegar en la
consola:

- `firestore.rules` — **lo que está publicado hoy**. Cierra el acceso anónimo a
  `users` y `organizations`, y `company_profiles` por completo.
- `firestore-aislamiento.rules` — **el siguiente paso, sin publicar**. Agrega el
  aislamiento entre organizaciones vía custom claims. Requiere que
  `sync-auth-claims` esté desplegado y que la gente haya iniciado sesión al menos
  una vez con ese código; publicarlo antes deja a todos fuera.
- `storage-company-profiles.rules` — reglas de Storage, con las anteriores
  anotadas arriba por si hace falta revertir.

Un detalle que es fácil pasar por alto: **en las reglas de Firebase los permisos
se suman.** Si queda un `match` amplio cubriendo las mismas rutas, cualquier
bloque restrictivo que se agregue debajo no hace nada — el amplio sigue
concediendo acceso. Por eso en ambos casos hubo que acotar el catch-all, no solo
agregar un bloque nuevo.

Antes de publicar Firestore, usa el **Rules Playground**: simula una lectura de
`/company_profiles/loquesea` autenticado con el uid del superadmin y confirma
que da *allow*. Si diera *deny*, es que ese documento en `users/{uid}` no tiene
`role: 'superadmin'` y se perdería el acceso al panel.

## Qué asumen estas reglas

Que el cliente del formulario entra con el custom token que emite
[`profile-session.js`](../netlify/functions/profile-session.js), el cual lleva un
claim `profileId`. Las reglas anclan cada sesión a ese claim: un cliente solo
alcanza su propio documento y su propia carpeta.

Eso significa que **las reglas y la function tienen que desplegarse juntas.** Si
publicas las reglas antes de que la function esté en producción, el formulario
deja de funcionar para todos; si publicas la function y no las reglas, la
colección sigue abierta como está hoy.

## ⚠️ Lo que queda pendiente, y pesa más que todo lo anterior

Las reglas de Firestore que había en producción eran, literalmente:

    match /{document=**} { allow read, write: if true; }

La base entera abierta a cualquiera, sin autenticación, para leer y escribir.
Comprobado el 1 de septiembre de 2026 desde el navegador con solo la API key
pública que va en el bundle: se leyó `company_profiles` completa —códigos de
acceso incluidos— y se borró un documento por REST.

El archivo de Firestore de esta carpeta **solo cierra `company_profiles`**. Las
otras 18 colecciones siguen igual de abiertas, y ahí están los leads, los
contactos y los datos de clientes reales.

Se dejó así a propósito: cambiar los permisos de 19 colecciones en el mismo paso
que se desbloquea un módulo nuevo deja a alguien sin acceso a su pipeline sin
que nadie se entere. Pero es una pasada pendiente, y es la más importante de
todas las que quedan.

## Una limitación que conviene tener presente

Las reglas de Storage **no pueden leer Firestore**, así que no hay forma de
comprobar ahí si quien pide un archivo es superadmin. El panel del superadmin
abre los archivos con la URL que devuelve `getDownloadURL()`, que lleva un token
de descarga y funciona sin autenticación.

O sea: **quien tenga esa URL puede abrir el archivo.** Para el caso de uso
actual —el equipo abriendo material que el cliente les mandó— es aceptable, pero
no es lo mismo que control de acceso. Si en algún momento eso importa, hay que
servir los archivos a través de una function que valide y haga streaming.
