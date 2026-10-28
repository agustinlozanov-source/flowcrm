# Marca Personal

Un origen de venta que antes no existía.

---

## 1. De dónde nace

Nació de una necesidad propia: organizar varias marcas personales dentro de una
misma empresa, sin abrir una cuenta de FlowHub por cada una. Ese es el caso del
*grow operator* — alguien que asesora a varios creadores a la vez.

Pero el caso que lo vuelve un módulo y no una herramienta interna es otro:

**Dentro de cualquier empresa grande ya hay gente construyendo su marca
personal.** Creadores de contenido, vendedores con audiencia, directivos que
publican. Lo hacen por su cuenta, en su tiempo, y la empresa no se entera ni se
beneficia.

La empresa puede proponerle a esa persona algo que antes no tenía forma de
existir:

> *Oye, ¿te gustaría que le demos impulso? Te damos tu propio embudo, medimos lo
> que tu marca trae, y si de ahí salen referencias para nuestros productos, se
> comisiona.*

**Para la persona no cambia nada: su marca sigue siendo suya.** Para la empresa
es una forma de medir y darle propósito comercial a algo que ya estaba pasando.

Eso es lo nuevo. La marca personal como **origen de venta**, al lado de la
publicidad, el inbound y la prospección. No existía como categoría medible, y
hoy sí.

Y escala hacia los dos lados: una persona puede tener dos, tres o cuatro
marcas; y una empresa puede contratar a alguien *como* marca personal, darle su
embudo y dejar el acuerdo transparente desde el primer día.

---

## 2. Para quién es

**Sí:**

- Empresas con talento interno que ya publica y quiere impulso.
- Empresas que contratan creadores como canal de adquisición.
- *Grow operators* que llevan varias marcas de clientes distintos.

**No:**

- No es un gestor de redes sociales. No compite con Hootsuite ni con Metricool.
- No es para la cuenta corporativa de la empresa. Esa es publicidad de marca,
  no marca personal, y vive en el embudo general.

---

## 3. Qué hace

Cada marca es una unidad con su propio dueño, su cuenta de Instagram conectada,
su embudo, y su configuración.

- **Conectar la cuenta** de Instagram y vigilar que el token no caduque.
- **Publicar** desde el CRM: imagen sencilla o carrusel de hasta diez, con el
  orden decidido antes de subir.
- **Medir el rendimiento** de lo publicado: alcance, vistas, comentarios.
- **Atribuir leads a publicaciones.** Cuando alguien comenta y se convierte en
  lead, queda escrito de qué publicación vino. Esa es la pieza que convierte el
  módulo en un origen de venta y no en un panel de vanidad.
- **Responder comentarios** con una palabra clave y una respuesta automática,
  pública y privada.
- **Su propia agenda:** franja horaria, días de atención, duración de la cita,
  respiro entre citas. Lo que no declara lo hereda de la organización.
- **Su propio catálogo:** productos que existen solo para su embudo.

---

## 4. Qué no hace

- **No toca el embudo de la empresa.** Ni sus etapas, ni sus políticas, ni sus
  pautas. El aislamiento no es una preferencia de diseño: es la condición para
  que una persona acepte conectar su marca.
- **No mide lo que Instagram no deja medir.** Hay métricas que la API
  simplemente no entrega, y el módulo las muestra como `—` en vez de
  inventarlas.
- **No publica en otras redes** todavía. Solo Instagram.
- **No reparte comisiones.** Deja la atribución escrita, que es lo que hace
  posible calcularlas, pero el cálculo y el pago no están.
- **No tiene todavía su vista de negocio.** Ver cuánto ingreso trajo la táctica
  de marca personal en total, o cuántos embudos hay abiertos, es la pieza que
  falta — ver la sección 7.

---

## 5. Cómo se conecta

| Con | Cómo |
| --- | --- |
| **Pipeline** | Cada marca apunta a un embudo. Sin embudo, los mensajes de esa cuenta no saben a dónde ir. |
| **Agente IA** | El agente que atiende ese embudo usa el conocimiento, el scoring, los productos y la agenda de ese embudo. |
| **Inbox** | Los mensajes de Instagram de esa cuenta entran al inbox como cualquier otro canal. |
| **Catálogo** | Un producto puede pertenecer al embudo de la marca, y entonces no lo ve ningún otro agente. |

**Lo que no debe tocar:** la configuración de la organización, el catálogo
general, los embudos que no son suyos.

---

## 6. Para desarrolladores

### Dónde vive

| | |
| --- | --- |
| Pantalla | `src/pages/MarcaPersonal.jsx` |
| Hook | `src/hooks/useBrands.js` |
| Publicar | `src/features/marca/Publicar.jsx` |
| Webhook de Instagram | `netlify/functions/instagram-webhook.js` |
| Publicación | `netlify/functions/instagram-publicar.js` |

### Modelo de datos

Las marcas viven en `organizations/{orgId}/marcas/{marcaId}`, con
`nombre`, `handle`, `nicho`, `ownerUserId`, `pipelineId` y el estado de la
conexión.

Las publicaciones viven bajo la marca, en `publicaciones/{mediaId}`, con el
contador `leads` que se incrementa en la atribución.

### Lo que hereda de la organización

Tres cosas siguen hoy el mismo patrón, y conviene que las siguientes también:

**Un campo opcional que marca al dueño. Si está, es propio; si no está, se
hereda.**

- **Conocimiento:** `agent_files` con `pipelineId`. Sin él, es común.
- **Productos:** `products` con `pipelineId`. Sin él, es del catálogo general.
- **Agenda:** `settings/agent` → `agendaPorEmbudo[pipelineId]`, campo por campo.

### Reglas que no se pueden romper

1. **Lo de una marca no se filtra a otra.** Un producto de un embudo no lo ve
   el agente de otro. Nunca.
2. **La herencia es campo por campo, no todo o nada.** Una marca que solo
   cambia el horario no tiene que repetir el respiro ni la duración.
3. **Al borrar la clave de una herencia hay que escribir `null`, no quitarla.**
   El guardado usa `merge`, que fusiona mapas anidados: una clave quitada
   reaparece desde la base.
4. **Una métrica que Instagram no da se muestra como `—`.** No se estima, no se
   deduce de otra, no se deja en cero.

---

## 7. Decisiones abiertas

**¿Una marca puede tener más de un embudo?**

Hoy el vínculo es `marca.pipelineId`: la marca apunta a su embudo, y por lo
tanto tiene exactamente uno. Si la respuesta es sí, el dueño tiene que ser al
revés —`marcaId` encima de cada cosa— y `marca.pipelineId` se jubila.

Esta decide si lo que se construya después se sostiene o hay que rehacerlo.

**Todo lo de la marca debería crearse desde dentro de la marca.**

Crear un embudo desde la ficha no es lo mismo que crearlo en la organización y
asignarlo después: en el primero nace sabiendo para qué es. Hoy la creación de
embudos, productos y configuración vive fuera, y eso rompe la premisa del
módulo.

**Falta la vista de negocio.**

Cuánto ingreso trajo la táctica de marca personal en total, cuántos embudos
están abiertos, qué productos se venden por este origen. Suma de varias marcas,
no de una. Y es una vista estadística: los leads se quedan en el embudo de su
marca, la pantalla los agrega.

**Faltan las comisiones.** La atribución ya queda escrita; el cálculo y el pago
no existen.
