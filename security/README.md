# Reglas de seguridad — Company Profile Builder

## ⚠️ Léelo antes de tocar la consola

`firestore-company-profiles.rules` es un **fragmento**, no las reglas completas.
`storage-company-profiles.rules` sí es el archivo entero y ya trae integradas
las reglas que había en producción (quedaron anotadas ahí por si hay que
revertir).

Las reglas que están hoy en producción viven en la consola de Firebase y **no
están versionadas en este repo**. Si copias uno de estos archivos y lo pegas
como el contenido completo de tus reglas, borras las de todo lo demás —
`leads`, `pipelines`, `orgs`, `implementations`, todo — y rompes la app.

Para Firestore, lo que hay que hacer es **insertar el bloque `match` dentro del
`match /databases/{database}/documents { … }` que ya tienes**, junto a los demás,
y agregar las funciones auxiliares si no existen ya con otro nombre.

Un detalle que es fácil pasar por alto: **en las reglas de Firebase los permisos
se suman.** Si queda un `match` amplio cubriendo las mismas rutas, cualquier
bloque restrictivo que se agregue debajo no hace nada — el amplio sigue
concediendo acceso. Por eso en Storage hubo que acotar el catch-all
`{allPaths=**}` a `organizations/` en vez de solo agregar un bloque nuevo.

Antes de publicar, usa el **Rules Playground** de la consola para comprobar que
las reglas existentes siguen pasando.

## Qué asumen estas reglas

Que el cliente del formulario entra con el custom token que emite
[`profile-session.js`](../netlify/functions/profile-session.js), el cual lleva un
claim `profileId`. Las reglas anclan cada sesión a ese claim: un cliente solo
alcanza su propio documento y su propia carpeta.

Eso significa que **las reglas y la function tienen que desplegarse juntas.** Si
publicas las reglas antes de que la function esté en producción, el formulario
deja de funcionar para todos; si publicas la function y no las reglas, la
colección sigue abierta como está hoy.

## Estado actual, para que dimensiones

Verificado el 1 de septiembre de 2026 desde el navegador, sin autenticación,
usando solo la API key pública que va en el bundle:

- Se puede **leer la colección `company_profiles` completa**, incluidos los
  `accessPassword` de todos los clientes.
- Se pueden **crear y borrar documentos** por REST.

Esto no es exclusivo de esta colección: es el estado general de la base.
Estos fragmentos solo cierran la parte nueva. El resto merece la misma revisión.

## Una limitación que conviene tener presente

Las reglas de Storage **no pueden leer Firestore**, así que no hay forma de
comprobar ahí si quien pide un archivo es superadmin. El panel del superadmin
abre los archivos con la URL que devuelve `getDownloadURL()`, que lleva un token
de descarga y funciona sin autenticación.

O sea: **quien tenga esa URL puede abrir el archivo.** Para el caso de uso
actual —el equipo abriendo material que el cliente les mandó— es aceptable, pero
no es lo mismo que control de acceso. Si en algún momento eso importa, hay que
servir los archivos a través de una function que valide y haga streaming.
