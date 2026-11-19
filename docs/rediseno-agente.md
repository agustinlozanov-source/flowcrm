# Rediseño del Agente IA

Ideas, no plan de obra. Nada de esto está construido.

---

## 1. Lo que hay hoy

`src/pages/Agent.jsx` son **2,455 líneas**, seis pestañas y unos
**25 controles**:

| Pestaña | Qué pide |
|---|---|
| Identidad | Nombre del agente (global y por embudo), instrucciones por embudo, de quién es la agenda, duración de la cita, intervalo, colchón, horarios de atención, puntos por agendar, conmutador de entrada, seguimiento, follow-up, delay de respuesta |
| Conocimiento | Documentos, instrucciones globales (solo lectura), instrucciones manuales |
| Productos | Qué productos habilita cada embudo |
| Scoring | Categorías con tope, subcategorías con tope, y cada señal con su peso — por embudo |
| Recursos | Archivos y enlaces, cada uno con «cuándo compartir» |
| Probar | Un chat de prueba que **exige guardar antes** |

---

## 2. El diagnóstico

### 2.1 Está organizado por dónde viven los datos, no por lo que la persona quiere hacer

«Identidad», «Conocimiento», «Scoring», «Recursos» son los nombres de nuestras
colecciones. Un dentista no piensa «voy a configurar mi scoring»: piensa
«quiero que conteste como contesta mi mejor recepcionista».

Esa traducción se la estamos cobrando al cliente, y la paga en cada pestaña.

### 2.2 Nada dice por dónde empezar ni cuándo terminaste

Seis pestañas sin orden y sin estado. Un agente al que le falta el catálogo no
puede cotizar, y uno sin regla de handoff no suelta nunca el lead — las dos
cosas son invisibles hasta que pasan en una conversación real.

### 2.3 El scoring es lo más difícil del producto y está puesto como un igual

Llenarlo a mano son cuatro a seis categorías, con sus subcategorías, con sus
señales, con pesos que tienen que sumar 100. Es una hoja de cálculo disfrazada
de pestaña, y está al mismo nivel que «ponle nombre a tu agente».

Lo arreglamos a medias con el panel de pegar Markdown. Eso ayuda a quien tiene
una IA al lado; no ayuda a quien no.

### 2.4 Probar está al final y pide guardar

El orden real de aprender algo es tocar → ver qué pasó → corregir. Hoy es
configurar → guardar → irse a otra pestaña → simular. Entre lo que cambiaste y
lo que viste hay tres clics y un guardado, y eso rompe el único bucle que de
verdad enseña.

### 2.5 Todo es por embudo, pero cada pestaña lo pregunta por su cuenta

Instrucciones, scoring, productos y hasta el nombre son por embudo, y cada
pestaña trae su propio selector. La persona tiene que acordarse de cuál está
editando, seis veces.

---

## 3. El reencuadre

**Entrenar a alguien no es llenarle un formulario.** Es contarle el negocio,
verlo trabajar y corregirlo.

Eso son tres momentos, y el producto hoy solo tiene bien el primero:

1. **Contárselo** — quién eres, qué vendes, cómo quieres que venda.
2. **Verlo trabajar** — hablar con él, equivocarse barato.
3. **Corregirlo** — decirle qué debió contestar, y que eso se quede.

El tercero no existe. Y es el que convierte una configuración en un agente que
mejora.

---

## 4. La propuesta: tres pantallas

Un selector de embudo **arriba, uno solo**. Todo lo de abajo es de ese embudo.

### 4.1 Preparar — un camino, no seis pestañas

Una sola página que se recorre hacia abajo, con siete pasos. Cada paso trae
una línea de para qué sirve y un ejemplo ya escrito que se puede borrar.

1. **Quién eres** — nombre del agente y el negocio en tres líneas.
2. **Qué vendes** — el catálogo. Ya existe.
3. **Qué quieres lograr** — agendar, cotizar, cobrar. Uno solo.
   *De aquí sale el handoff.*
4. **Cómo hablas** — tono, trato, largo, lo que nunca dice.
5. **Qué preguntas** — las preguntas de calificación, en orden.
   *De aquí sale el scoring.*
6. **Cuándo lo sueltas** — las señales que obligan a avisarle a una persona.
7. **Con qué te apoyas** — documentos y material para mandar.

Lo que hoy son ajustes sueltos —intervalo, colchón, delay, follow-up— se
pliega debajo de su paso, con un valor por omisión que funciona. Nadie
debería tener que elegir un colchón de agenda para arrancar.

### 4.2 Ensayar — corregir es entrenar

El chat de prueba, pero **sin guardar antes** y con un botón debajo de cada
respuesta del agente: **«así no».**

Le das clic, escribes qué debió contestar, y esa corrección se guarda como una
regla visible, en una lista que puedes leer, editar y borrar.

Esa lista **es** el entrenamiento. Es lo que hoy vive escondido dentro de un
campo de texto libre, y pasa a ser un objeto con el que se puede trabajar:
quince correcciones concretas se revisan; un párrafo de 600 palabras no.

Es también cómo se entrena a una persona nueva. Nadie le entrega un manual:
la escucha contestar y la corrige.

### 4.3 Revisar — el tráfico real entrena mejor que la imaginación

Las conversaciones de verdad, traídas del Inbox, con el mismo botón de «así
no». La diferencia con ensayar es que aquí las preguntas son las que los
clientes hacen de verdad, y no las que a uno se le ocurren.

Un filtro que vale la pena: **las que no cerraron**. Ahí está lo que hay que
corregir.

---

## 5. Las piezas que lo hacen posible

### 5.1 Contar el negocio hablando

**Deepgram ya está conectado** en `netlify/functions/lib/transcribir.js`.

«Cuéntame tu negocio» → tres minutos de audio → se transcribe → la IA redacta
los siete pasos → la persona revisa y corrige.

Para un dentista o un dueño de gimnasio, hablar tres minutos es diez veces más
rápido que escribir en veinticinco campos. Y lo que dice hablando es mejor que
lo que escribe: cuenta cómo vende de verdad, en lugar de redactar cómo cree
que debería sonar.

Es, con diferencia, el camino más corto de cero a configurado, y la pieza más
cara ya está pagada.

### 5.2 El scoring se deriva, no se llena

Dos preguntas en español:

> **¿Cómo te das cuenta de que alguien sí te va a comprar?**
> **¿Qué te hace perder el tiempo?**

De esas dos respuestas salen las categorías, las señales y los pesos. El
editor de hoy se queda detrás de un «ver el detalle», para quien lo quiera
ajustar.

Nadie debería construir veintiuna señales a mano para empezar a vender.

### 5.3 El estado del agente, en una línea

Arriba, siempre visible: **«Listo para atender»** o **«Le falta…»**, con las
comprobaciones que de verdad podemos hacer:

- Sin catálogo no puede cotizar
- Sin horarios no puede agendar
- Sin regla de handoff no suelta el lead nunca
- Con el scoring sin sumar 100, el lead no llega a las etapas de arriba
- Sin instrucciones, contesta como cualquier agente de cualquier negocio

### 5.4 Qué tan largo contesta

Medimos que el agente escribe a **27 ms por token**, y que el tamaño del
prompt casi no influye. O sea: lo que cuesta tiempo es lo que el agente
**responde**, no lo que le contamos.

Eso se puede poner en la pantalla como un control humano —breve, normal,
detallado— diciendo cuántos segundos tarda cada uno. Es un ajuste real, con un
número medido detrás, y hoy está escondido en un `max_tokens`.

### 5.5 La munición de Seguimiento

El hueco que quedó abierto cuando se fijó el modelo de ventas fue **qué hace
el agente en Seguimiento**: sostener la oferta y soltar munición cuando el
trato se dilata.

Los Recursos ya tienen un campo «cuándo compartir». Ahí está la respuesta a
medio construir: cada recurso con el momento que lo dispara, y el agente
sacándolos en orden a medida que el lead se enfría.

---

## 6. Lo que NO haría

**Plantillas por industria.** Ya se decidió el 30 de octubre: la matriz de
industrias es material de consultoría y de SEO, no una función del producto. El
sistema permite todo y nosotros recomendamos poco.

**Un asistente que bloquee.** Guiar sí, encerrar no. Quien ya sabe tiene que
poder saltar al paso cinco.

**Un «modo experto» aparte.** Mantener dos pantallas que hacen lo mismo es
pagar el rediseño dos veces, y la vieja se queda desactualizada.

**Que la IA escriba sola el prompt sin que nadie lo lea.** Que redacte y que
la persona apruebe. Un agente diciéndole cosas a los clientes de alguien, sin
que ese alguien haya leído lo que dice, es un problema esperando.

---

## 7. Qué se reusa

| Pieza | Estado |
|---|---|
| Transcripción con Deepgram | Ya está |
| Editor de scoring | Se conserva detrás de «ver el detalle» |
| Paneles de pegar Markdown | Ya están |
| Catálogo, recursos, documentos | Se mueven de lugar, no se reescriben |
| Chat de prueba | Se queda, sin la exigencia de guardar |
| Armado del system prompt | **No se toca.** Es el contrato con el agente |

---

## 8. Por dónde empezaría

1. **El selector de embudo, arriba y único.** Barato y se nota de inmediato.
2. **El estado del agente.** Hace visible lo que hoy se descubre fallando.
3. **Ensayar con «así no».** Es la idea central; lo demás puede esperar.
4. **Preparar como un camino.** El rediseño grande.
5. **Contarlo hablando.** Lo que más impresiona en una demo.
6. **El scoring derivado.** Lo más difícil de hacer bien, y lo haría al final,
   con correcciones reales ya acumuladas.

---

## 9. Lo que todavía no sé

- **Qué pasa con lo ya configurado.** Las cuentas que hoy tienen instrucciones
  escritas a mano no tienen correcciones. ¿La lista nace vacía y el texto
  viejo queda como «instrucciones heredadas»?
- **Si una corrección puede contradecir a otra.** Quince reglas escritas en
  días distintos se pelean. ¿Las detectamos, o es trabajo de quien revisa?
- **Si las correcciones son por embudo o del negocio.** Creo que por embudo,
  pero hay reglas de tono que son de la casa entera.
- **Cuánto texto aguanta antes de diluirse.** El prompt crece con cada
  corrección, y en algún punto el agente deja de obedecer todas.
