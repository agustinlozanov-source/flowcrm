# El portal del equipo

**Brief · 2 de noviembre de 2026**
Qué traer del portal de distribuidores y cómo reapuntarlo al equipo comercial.

---

## La idea en una línea

El portal de distribuidores ya es un portal de compensación. Tiene scorecard,
ventas, cobros, bonos y niveles — todo con datos falsos. **Reapuntarlo cuesta
mucho menos que diseñarlo**, y lo que salga sirve igual para el equipo de hoy y
para cualquier distribuidor de mañana, porque es el mismo modo de operar.

Rutas actuales: `/portal-distribuidor`, `/distribuidores`, `/unirse`,
`/distribuidor-login`. Archivo principal: `src/pages/PortalDistribuidorPage.jsx`
(1,145 líneas).

---

## Lo que ya existe y en qué se convierte

| Hoy | Se convierte en | Trabajo |
|---|---|---|
| **Dashboard** · 4 KPIs del trimestre | Meta del mes, cumplimiento, bono proyectado, fecha de cobro | Cambiar fuente y etiquetas |
| **Scorecard Q2** · puntos y niveles | La escala del bono: 80 · 90 · 100 · 110 · 120 · 130 | Reusar la barra de progreso |
| **Mis ventas** · tabla con comisión | Lo mismo, más descuento, código y cortesías | Depende del registro de cierre |
| **Prospectos** · lista y etapa | El buffer: calificados en vuelo contra los que hacen falta | Conectar al embudo real |
| **Cobros** · por cobrar y fechas | Bono y comisiones: devengado, pagado y cuándo | Cambiar fuente |
| **Documentos** · contrato y fiscal | Qué factura tiene que emitir cada quien este mes | Reescribir |
| **Academia** · lecciones de venta | El entrenamiento institucional de cierre | Reescribir contenido |
| **Tienda** · merch | **La bolsa de herramientas** | Reescribir entero |

### La conversión que más vale

**La Tienda se vuelve la bolsa.** Hoy vende hoodies y termos. Debería listar
cada herramienta y microherramienta con su **precio de lista**, decir **cuáles
están abiertas esta semana** y cuáles piden autorización.

Eso convierte el búnker de ofertas de una regla que hay que recordar en una
pantalla que se consulta a media negociación. Y resuelve solo el problema de
que sin precio, regalar algo no vale nada.

---

## Lo que hay que borrar

Vocabulario de multinivel, que no aplica a un equipo comercial:

- **«genealogía»** — hay una lección de la Academia llamada *«Cómo usar tu genealogía para cerrar»*
- **«cliente raíz»**, **«raíz nueva»** — en la actividad reciente y en los prospectos
- **Puntos trimestrales individuales** y los niveles Asociado · Senior · Elite

Los niveles se van porque **el bono es de equipo y se reparte en partes
iguales**. Lo que sustituye a «subir de nivel» es el cumplimiento del mes, que
es colectivo.

---

## Lo que falta construir

| Pieza | Dónde | Por qué |
|---|---|---|
| **Registro de cierre** | CRM, al marcar ganada | Precio de lista, descuento, código, cortesías, forma de pago |
| **Consumo de la bolsa** | Portal | Cuánto del promedio tolerado llevamos gastado en el periodo |
| **Acuerdos** | Portal | Qué se acordó, quién, cuándo, con qué evidencia |

### El orden importa, y es una sola dependencia

**El portal no puede mostrar números reales hasta que exista el registro de
cierre.** Hoy la oportunidad guarda un solo monto —el de lista— y al marcarla
ganada ese mismo número entra a `valueWon`. Así que una venta con 20% de
descuento se reporta completa.

Si el portal se conecta antes de eso, muestra cifras infladas con toda
confianza, que es peor que no mostrarlas.

**Primero el registro de cierre. Después el portal.**

---

## Las pantallas, por persona

El portal es el mismo para todos; lo que cambia es qué pesa en cada vista.

**Para los tres y el equipo** — el número del mes, el cumplimiento, la bolsa
del bono y mi parte, y la fecha de cobro.

**Para Mario** — el buffer. Calificados en vuelo contra los que hacen falta
para los 8 cierres. Por origen, que es lo que dice de qué alimentarlo.

**Para Román** — cierres del mes contra 8, y el seguimiento de lo que está en
la fase de seguimiento sin moverse.

**Para Agustín** — todo lo anterior junto, más el consumo de la bolsa y qué
compuertas están abiertas.

---

## De dónde sale cada número

| Número | Fuente |
|---|---|
| Venta nueva del mes | Oportunidades ganadas, al **precio de cierre** |
| Cumplimiento | Venta ÷ $750,000 |
| Bolsa del bono | $75,000 × factor de la escala |
| Mi parte | Bolsa ÷ número de partes |
| Comisiones | 6% / 6% / 3% sobre la venta |
| Buffer | Leads calificados vivos en el embudo CRM |
| Consumo de la bolsa | Descuentos y cortesías del registro de cierre |

Todo sale de datos que el CRM ya tiene o va a tener. **Nada se captura dos
veces**, que es la condición para que alguien lo use.

---

## Por qué esto se vende después

El portal resuelve algo que casi ningún equipo comercial tiene: **cada persona
sabe en tiempo real cuánto lleva ganado y cuándo lo cobra, sin preguntarle a
nadie.**

Y lo hace sin un administrador de ventas capturando. El dato viene de la venta
cargada, que ya se carga de todos modos.

Si funciona para este equipo, funciona igual para cualquiera que quiera
distribuir Flow Hub con su propia gente. **Nosotros somos el caso cero:** lo que
falle, falla con nuestro dinero. Lo que se entregue a un distribuidor ya estará
probado.

Ver [[aparato-comercial.md]].
