# Hacia la versión definitiva

Guía de trabajo para llevar FlowHub de la versión actual a la que sale al
mercado: rediseño completo, módulos terminados y la base en Supabase.

Escrita el 18 de noviembre de 2026.

---

## Lo que hay hoy

| | |
|---|---|
| Código del cliente | 57,435 líneas, 39 pantallas |
| Funciones de Netlify | 60, de las cuales 47 hablan con Firestore |
| Archivos del cliente que usan Firestore | 53 |
| Lecturas en tiempo real (`onSnapshot`) | 124 |
| Archivos que usan Storage | 11 |
| Colecciones distintas | ~45 |
| Servicios externos | Anthropic, OpenAI, Deepgram, Zernio, Meta, Instagram, WhatsApp, Stripe, Mercado Pago, Facturapi, Google Calendar, Resend, Telegram, y dos más |

Es una aplicación grande y viva, con clientes adentro. Eso define todo lo que
sigue.

---

## La decisión de fondo

**La mudanza a Supabase se hace sobre el modelo del 30 de octubre, no sobre las
colecciones de hoy.**

Ese modelo ya está escrito, en la rama `contactos-y-oportunidades`
(`docs/modelo-de-datos.md`): el contacto es la persona, la oportunidad es la
venta y vive en un embudo, la empresa existe solo cuando se vende a empresas.
Nunca se construyó, porque cambiarlo con clientes adentro rompía todo.

Ahora se va a romper todo de todas formas. Copiar las colecciones de Firestore
a tablas de Postgres una por una cargaría el error de origen —llamar `lead` a la
persona y colgarle el embudo, la etapa y el monto— a la base nueva, donde sería
más caro de arreglar que hoy.

---

## Las cinco reglas

1. **Producción no se toca.** La versión actual sigue atendiendo en Firebase
   hasta el día en que cada organización se mude.
2. **Nada se copia uno a uno.** Las tablas se diseñan desde el modelo, y cada
   pantalla se rehace con el sistema de diseño nuevo.
3. **Un módulo entra completo o no entra.** Lo que hoy está a medias se
   termina en la v2 o se deja fuera. Portarlo a medias es pagar dos veces.
4. **Se muda una organización a la vez,** empezando por la tuya.
5. **Cada fase termina con algo que se usa,** no con un documento.

---

## Las fases

### Fase 0 — Preparar

Un repositorio nuevo y vacío, `flowhub-v2`, con el actual clonado al lado como
referencia de solo lectura. Un proyecto de Supabase de pruebas y un sitio de
Netlify de pruebas.

Repo nuevo y no una copia del actual: con 57 mil líneas adentro, la tentación de
portar en vez de rehacer gana siempre. Empezar vacío obliga a que cada módulo
se gane su lugar (regla 3).

**Termina cuando** el repo nuevo despliega una pantalla con inicio de sesión de
Supabase.

### Fase 1 — Evaluar

Las 39 pantallas y las 60 funciones, una por una, con tres preguntas:

- ¿Alguien la usa?
- ¿Funciona?
- ¿Está completa?

De ahí sale una lista en tres columnas: **entra tal cual**, **se rehace**,
**se va.** Ya hay candidatos conocidos para la tercera: `Pipeline 3.jsx`, la
vista clásica del embudo, y el alta de distribuidor, que nunca creó cuentas.

**Termina cuando** la lista existe y está aprobada. Las fechas de todo lo que
sigue se calculan con ella, no antes.

### Fase 2 — El esquema

Las tablas de Postgres, escritas desde el modelo. La seguridad por organización
pasa a las políticas de Supabase (RLS), y con eso desaparecen las colecciones
que hoy siguen abiertas en las reglas de Firestore.

**Termina cuando** el esquema existe y una prueba automática demuestra que una
organización no puede leer nada de otra.

### Fase 3 — El sistema de diseño

En paralelo con la fase 2. La identidad definitiva —hoy el manual publicado y
la app no coinciden: el manual dice Fraunces y morado, la app usa Plus Jakarta
Sans y azul—, los colores, la tipografía y los componentes.

**Termina cuando** una pantalla real se arma solo con esos componentes, sin un
estilo suelto.

### Fase 4 — Reconstruir, módulo por módulo

En el orden de la cadena del lead, porque cada eslabón necesita el anterior:

1. Inicio de sesión, organizaciones y equipo
2. Contactos, oportunidades y embudo
3. Conversaciones, con Zernio
4. El agente
5. Agenda y reuniones
6. Lo demás, en el orden que dé la fase 1

Cada módulo sale rediseñado, sobre Supabase y probado, en una sola pasada.

**Termina cuando** tu propia organización trabaja un día entero en la v2 sin
abrir la versión vieja.

### Fase 5 — La mudanza

Un script que mueve una organización completa: sus datos de Firestore a
Postgres, sus archivos de Storage a Supabase Storage, y las URL reescritas.
Después, una verificación —mismos contactos, mismas conversaciones, mismos
montos— antes de cambiarla de casa.

**Termina cuando** todas las organizaciones están en la v2 y Firebase queda en
solo lectura, como respaldo, unos meses más.

---

## Las cinco trampas

Lo que no se ve al empezar y cuesta caro si aparece al final.

**1. Las contraseñas.** Pasar de Firebase Auth a Supabase Auth puede conservar
las contraseñas o puede obligar a que cada usuario las restablezca. Hay que
saberlo en la fase 0, con una prueba real. Si hay que restablecer, se avisa a
los clientes con tiempo, no el día del cambio.

**2. Las URL registradas afuera.** El webhook de Zernio es uno solo para toda la
cuenta, y lo mismo pasa con Stripe, Mercado Pago y Meta. Mientras convivan las
dos versiones, cada evento que llegue tiene que ir a la versión donde vive esa
organización. Sin ese repartidor, la mudanza por organización no es posible.
Los regresos de inicio de sesión con Google e Instagram también apuntan a un
dominio, y el de pruebas hay que darlo de alta en cada consola.

**3. El tiempo real.** Hay 124 lecturas en vivo. Supabase Realtime funciona de
otra manera, y no todo necesita estar en vivo. Hay que decidir qué sí
—Conversaciones y el tablero, seguro— y qué puede leerse al abrir la pantalla.

**4. Los archivos.** Las URL de Storage están guardadas adentro de los
documentos: recursos del agente, posts de Trafficker, kits de marca. Mover los
archivos sin reescribir esas URL deja todo apuntando a la casa vieja, y se
rompe el día que se apague.

**5. Las funciones.** 47 de 60 hablan con Firestore. Se reescriben con el
cliente de Supabase; adaptarlas línea por línea hereda sus vicios.

---

## Esta semana

1. Crear `flowhub-v2` vacío y el proyecto de Supabase de pruebas.
2. Probar la mudanza de un usuario de Firebase Auth a Supabase Auth, para
   cerrar la trampa 1 antes de que importe.
3. Empezar la fase 1 por las pantallas que más se usan.

La fase 1 es la que más conviene hacer conmigo: recorrer el código pantalla por
pantalla es justo el trabajo que se hace rápido de este lado.
