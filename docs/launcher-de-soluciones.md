# El launcher de soluciones

**Versión 2 · 5 de noviembre de 2026**
Estructura previa a la reunión de socios de hoy a las 4.

> **Qué es, dicho en una línea.** Una landing de presentación de las soluciones
> —logo, qué resuelve, qué impacto deja, qué cuesta— donde cada herramienta se
> cotiza sola y donde se puede armar un paquete ahí mismo. **No abre las apps.**
> Lo que se contrata ahí se manda después al ecosistema que le toca, y eso es
> otro tema.

---

## 0. Qué es este documento

El inventario completo de lo que hay para ofertar, qué dolor ataja cada pieza,
cómo se agrupan en capas y cómo se cotizan combinadas. Se escribe antes de
construir para que no se escape nada.

Todo lo que aquí dice **«ya existe»** está verificado en el código, con ruta y
archivo. Lo que falta decidir está en la **sección 11** y no se rellenó: se
marcó.

---

## 1. Lo primero: el launcher ya existe

Está en `coaching-system`, en la ruta `/launcher`, y no es una maqueta.

| Pieza | Dónde | Qué hace |
|---|---|---|
| El launcher | `src/app/launcher/page.tsx` | Saluda por nombre, lee la organización activa y pinta las tarjetas |
| El registro de herramientas | `src/lib/tools.ts` | Las cuatro herramientas con slug, ruta, color, logo y un renglón de descripción |
| Las tarjetas | `src/components/launcher/LauncherClient.tsx` | Logo por herramienta, modo claro y oscuro, candado «No incluida», «Próximamente» |
| El control de acceso | `src/lib/entitlements.ts` | Tabla `org_herramientas` en Supabase: qué contrató cada organización |
| La compuerta | `src/lib/supabase/middleware.ts` | Si la organización no tiene la app, rebota al launcher con `?bloqueada=` |
| La administración | `/scalex/admin/accesos` | Activar y desactivar herramientas por cliente |

**Y las cuatro herramientas tienen app real, con rutas vivas.** Esto es el
inventario verificado, no la intención:

- **SCANx** — `/scanx`: diagnósticos, DX21 (7 pilares × 3 lentes: Diseño,
  Despliegue, Desempeño), perfil, mercado, financials, equipo, verificación,
  resultados. Con IA en `api/scanx/ia` para micro-insights, narrativa ejecutiva
  y plan de acción por horizonte.
- **SCALEx** — `/scalex`: ADN, OPSP, Rituales, Reflejo (PIE · MAPE · PRISMA),
  Vector, Flujo y Costeo, Ritmo (Pulso y Semanal), Presentación, Clientes,
  Perfil, y su propio admin con consultores y pipeline.
- **TEAMx** — `/dashboard`: empleados, evaluaciones, sesiones, equipo,
  gladiadores, áreas de oportunidad, reportes ejecutivos, copiloto, y el admin
  de competencias, categorías y escalas.
- **BOARDx** — `/boardx`: consejo, reuniones con acta, acuerdos, scorecard,
  métricas, directorio, despacho, canal.

Lo que **no** tiene es cara comercial. Hoy cada herramienta se explica con un
renglón, escrito para alguien que ya compró:

> «TEAMx — Gestión de equipos al máximo rendimiento en ciclos de 14 semanas.»

Eso sirve para entrar a trabajar. No sirve para enganchar un dolor.

### Son dos pantallas distintas y conviene no confundirlas

| | El launcher que ya existe | La landing que falta |
|---|---|---|
| **Para quién** | El cliente que ya compró | El prospecto, y la sala del taller |
| **Qué muestra** | Lo contratado, con candado en el resto | Todo, con su impacto y su precio |
| **Qué pregunta** | «¿A dónde entro?» | «¿Qué me duele, qué lo resuelve y cuánto cuesta?» |
| **Qué incluye** | 4 herramientas de SCALEx | Las 6, más los servicios humanos |
| **Qué hace al final** | Abre la app | Arma el paquete y lo cotiza |

**La landing no enlaza a las apps.** Ahí se presenta, se cotiza y se cierra.
El acceso al ecosistema pasa después, por el camino que corresponda a lo
contratado.

Comparten una sola cosa, y es la importante: **la ficha de cada herramienta**.
Si vive en un solo lugar, las dos pantallas leen de ahí y nunca se
contradicen.

---

## 2. Por qué este entregable ya estaba comprometido

El aparato comercial del 2 de noviembre dejó pendiente un entregable con
nombre propio:

> «**El listado con precio.** Entregable de las dos semanas: todas las
> herramientas y microherramientas con precio, porque sin precio regalar algo
> no vale nada en la negociación.»

Y fijó los dos números que se confunden siempre:

- **Precio de lista** — lo que vale para el cliente. El que se dice en voz alta.
- **Costo de entrega** — lo que cuesta producirlo. El que se descuenta de la bolsa.

El launcher comercial es ese listado con cara. El cotizador es lo que vuelve la
combinación una decisión de dirección en vez de una improvisación del cerrador.

También quedó decidido ese día, y aplica directo aquí:

> Las herramientas **quedan fuera de la bolsa de descuentos**. Las abre y las
> cierra dirección por ventanas, con aviso previo y fecha de cierre anunciada.
> «Regalar un descuento cuesta margen; regalar BOARDx cuesta entrega y además
> enseña al mercado a esperarlo.»

**Consecuencia para el cotizador:** la escalera de combinación es un precio de
producto, no un descuento del vendedor. Vive en el launcher, a la vista, igual
para todos.

---

## 3. El inventario

### Las seis herramientas

| Herramienta | Qué hace | El dolor que ataja | Dónde vive |
|---|---|---|---|
| **SCANx** | Autodiagnóstico: radiografía, tipo de empresa y 3 prioridades para escalar | «Sé que algo no está bien y no sé por dónde empezar» | `coaching-system` `/scanx` |
| **DX49** | Diagnóstico de madurez operativa de un área, tarea por tarea, contra los registros de sus propios sistemas | «Voy a comprar herramienta o automatizar y no sé si el problema es de proceso» | `flowhubcrmlanding/dx49.html` · metodología, sin app |
| **SCALEx** | La metodología completa: estrategia, procesos, ritmo y finanzas | «Tengo plan y no baja a la operación; cada trimestre empezamos de cero» | `coaching-system` `/scalex` |
| **TEAMx** | Gestión de equipos al máximo rendimiento, en ciclos de 14 semanas, con parámetros configurables | «Mi gente no rinde y no sé si es la persona, el puesto o que nadie la dirige» | `coaching-system` `/dashboard` |
| **BOARDx** | Consejo técnico trimestral: mesa, scorecard, acuerdos con trazabilidad y acta | «El consejo se reúne, se acuerda, y al trimestre siguiente nadie sabe qué pasó con eso» | `coaching-system` `/boardx` |
| **FlowHub CRM** | El CRM con agente que califica, hace handoff y deja el seguimiento por escrito | «Entran leads y se enfrían; no sé qué pasó con cada uno ni quién lo tenía» | `flowcrm` · producción |

### Las microherramientas que se pueden independizar

Ya estaban listadas el 2 de noviembre: **One Page Strategic Plan** y el **flujo
de costos por operación**. Las dos ya tienen pantalla dentro de SCALEx
(`/scalex/opsp` y `/scalex/flujo/costeo`), así que independizarlas es un
empaque, no un desarrollo.

Candidatas por el mismo criterio: **Reflejo** (PIE · MAPE · PRISMA), **Ritmo**
(Pulso y Semanal) y **Rituales**. Cada una resuelve un dolor que se dice en una
frase, y eso es lo que hace vendible una pieza suelta.

### Los servicios humanos

El launcher no solo lleva software. Esto también se oferta y ya tiene precio:

| Servicio | Precio | IVA |
|---|---|---|
| Consultoría por hora | $3,000 MXN/h | + IVA |
| Taller abierto (por persona, según paquete) | $5,900 – $11,900 MXN | incluido |
| In Company | ~$53,600 MXN | + IVA |
| Alto Rendimiento In Company (día y medio) | $68,440 MXN | incluido |
| Diseño de sistemas | USD 15,000 – 20,000 | + IVA |
| Marca Personal | sin precio | — |

**Regla de IVA, ya decidida:** todo va **+ IVA** salvo la mensualidad del CRM y
el taller abierto. Los compradores de lo demás son empresas y acreditan el IVA.

### Los precios que ya existen

| Pieza | Precio de lista | Fuente |
|---|---|---|
| DX49 | $35,000 MXN + IVA | Aparato comercial, 2 nov |
| FlowHub CRM — mensualidad | $4,000 a $22,500 MXN/mes, IVA incluido | Aparato comercial |
| FlowHub CRM — onboarding | $30,000 MXN + IVA | Aparato comercial |
| SCANx | **gratis** | El código ya lo entrega gratis siempre |
| SCALEx | **pendiente** | — |
| TEAMx | **pendiente** | — |
| BOARDx | **pendiente** | — |

Cuatro de seis piezas tienen precio. **Las tres que faltan son justo las de
SCALEx**, y cada una necesita dos números —implementación y mensualidad—, así
que son seis huecos. El tablero completo está en la sección 7 y es el primer
punto de la sección 11.

---

## 4. Las dos cosas que hay que separar antes de vender

### SCANx y DX49 son dos diagnósticos distintos

Es el riesgo más grande del catálogo: dos productos que se llaman diagnóstico y
se venden a la misma persona. Si la sala no entiende la frontera, el equipo los
va a vender como alternativas y uno va a canibalizar al otro.

| | SCANx | DX49 |
|---|---|---|
| **Qué mide** | La empresa completa: 7 pilares × 3 lentes | Un área, tarea por tarea |
| **Quién lo levanta** | El dueño, solo, en pantalla | Nosotros, con entrevistas, observación y los registros de sus sistemas |
| **Qué entrega** | Tipo de empresa, score de madurez, 3 prioridades | La especificación de la solución: qué ordenar, qué medir, qué automatizar y en qué orden |
| **Qué tan profundo** | Amplio y rápido | Acotado y sin huecos |
| **Precio** | Gratis | $35,000 MXN |
| **Para qué sirve en la venta** | Abrir la conversación y calificar | Justificar la inversión que viene después |

La frase que los ordena: **SCANx dice en qué pilar está el problema; DX49 dice
qué hacer exactamente en el área donde se manifiesta.** Uno abre, el otro
especifica. Se venden en ese orden y se pueden vender los dos al mismo cliente.

### SCALEx y FlowHub son dos marcas y dos entidades

El launcher que existe dice «Tus herramientas · SCALEx» en el título, y las
cuatro herramientas que lista son de SCALEx. DX49 y FlowHub CRM son de FlowHub,
otra marca, otro dominio y otra facturación.

Esto hay que decidirlo antes de construir, porque cambia el diseño, el dominio
y quién factura cada combinación. Está en la sección 11.

---

## 5. Las capas

El orden es por **el momento del dolor**, no por precio. Es lo que permite que
el launcher conteste «qué me duele» en vez de «cuánto quiero gastar».

| Capa | Qué resuelve | Piezas |
|---|---|---|
| **0 · La puerta** | «No sé por dónde empezar» | SCANx |
| **1 · El diagnóstico** | «No sé si el problema es de proceso o de herramienta» | DX49 |
| **2 · La estrategia** | «Tengo plan y no baja» | SCALEx, OPSP suelto |
| **3 · La ejecución** | «Mi gente no rinde» | TEAMx, Reflejo, Ritmo |
| **4 · El gobierno** | «El consejo acuerda y nada se cumple» | BOARDx |
| **5 · La operación comercial** | «Entran leads y se enfrían» | FlowHub CRM |
| **Transversal · Las personas** | «Necesito que alguien lo haga conmigo» | Consultoría, talleres, In Company, Marca Personal, diseño de sistemas |

**La capa 0 es gratis a propósito.** Es la compuerta de apertura del embudo, y
ya está construida así en el código.

---

## 6. El impacto de cada solución

Es el contenido de la landing. El dolor dice por qué llamar; **el impacto dice
qué cambia en la empresa**, y es lo que hace que un director firme.

Primer borrador, para corregir en la reunión. Los plazos son los que se pueden
sostener en voz alta, no los optimistas.

| Herramienta | Qué cambia en la empresa | Cuándo se nota | Qué se puede medir |
|---|---|---|---|
| **SCANx** | La dirección deja de discutir síntomas: sabe en qué pilar está el problema y cuáles son sus tres prioridades | La misma sesión | Score de madurez por pilar y la brecha dominante |
| **DX49** | Cada tarea del área tiene destino: se ordena, se mide o se automatiza — y en ese orden | Al cierre del levantamiento | Tareas levantadas, brechas por proceso, hoja de ruta con secuencia |
| **SCALEx** | El plan baja a rituales, indicadores y responsables; el trimestre arranca donde terminó el anterior | Un trimestre | Avance de OPSP, cumplimiento de ritmo, rocks cerrados |
| **TEAMx** | Se puede decir con evidencia si el problema es la persona, el puesto o que nadie la está dirigiendo | Un ciclo de 14 semanas | Evaluación por parámetro, evolución entre ciclos, sesiones sostenidas |
| **BOARDx** | Los acuerdos del consejo tienen dueño, fecha y acta; la sesión siguiente arranca con el seguimiento hecho | La primera sesión | Acuerdos cumplidos a tiempo, scorecard trimestral |
| **FlowHub CRM** | Ningún lead se enfría sin que alguien lo sepa, y el seguimiento queda por escrito | Semanas | Leads por origen, tasa de cierre, tiempo de respuesta, pipeline en vuelo |

---

## 7. El precio de cada herramienta

Dos números por herramienta, y los dos van a la vista en la landing:

- **Implementación** — pago único, al arrancar.
- **Mensualidad** — la recurrencia.

### La implementación no es una cuota de instalación

**Esto es lo que hay que explicar en la landing**, porque un número de cuatro
cifras sin explicación se lee como un impuesto de entrada. La implementación es
trabajo, y son cuatro cosas:

1. **El diagnóstico** — en qué estado está el área donde va a entrar la
   herramienta.
2. **La consultoría de la conversación** — cuál es el potencial real de la
   herramienta en esa empresa. Esta parte ya se está entregando mientras se
   vende, y hoy se regala.
3. **La personalización y el alcance** — qué se configura, hasta dónde llega y
   qué queda fuera, por escrito.
4. **El plan de adopción** — la curva de aprendizaje según el perfil del equipo
   que la va a usar. El mismo software con dos perfiles distintos necesita dos
   arranques distintos.

> Es la diferencia entre entregar un acceso y entregar una empresa operando con
> la herramienta. Y es por eso que arranca en **USD 1,700** y sube según el
> alcance.

**Nota sobre ese piso:** USD 1,700 y los $30,000 MXN del onboarding del CRM son
el mismo número al tipo de cambio de hoy. Conviene decidir si la landing cotiza
en pesos, en dólares o en los dos, porque si salen las dos cifras sin
convertirse se van a leer como dos precios distintos.

### El tablero de precios

| Herramienta | Implementación | Mensualidad | Estado |
|---|---|---|---|
| **SCANx** | — | — | Gratis. Es la puerta |
| **DX49** | $35,000 MXN + IVA | no aplica | Precio firme |
| **SCALEx** | **pendiente** | **pendiente** | — |
| **TEAMx** | **pendiente** | **pendiente** | — |
| **BOARDx** | **pendiente** | **pendiente** | — |
| **FlowHub CRM** | $30,000 MXN + IVA | $4,000 a $22,500 MXN/mes, IVA incluido | Precio firme |

Seis huecos. **Son el único bloqueo para construir el cotizador**, y con rangos
alcanza.

---

## 8. Las afinidades — qué combina con qué, y por qué

El paquete se arma por **lógica de secuencia**, y eso es lo que hay que decir en
cada combinación. Un combo que solo junta precios se siente como un descuento;
un combo que explica por qué esas dos van juntas se siente como un plan.

| Combinación | Por qué va junta | Qué pasa si falta una |
|---|---|---|
| **SCANx + cualquiera** | SCANx define cuál de las otras cinco toca | Se compra por intuición |
| **DX49 + FlowHub CRM** | DX49 dice qué ordenar antes de automatizar; el CRM es donde se automatiza | Automatizar una operación desordenada acelera el desorden |
| **SCALEx + TEAMx** | SCALEx fija el rumbo; TEAMx es cómo baja a cada persona | Plan que no baja, o equipo rindiendo hacia ningún lado |
| **SCALEx + BOARDx** | El consejo revisa contra el plan | Un consejo que revisa contra opiniones |
| **TEAMx + BOARDx** | El scorecard del consejo se alimenta del desempeño real del equipo | El consejo evalúa gente de oídas |
| **FlowHub CRM + TEAMx** | El equipo comercial medido sobre el pipeline | Se evalúa percepción, no actividad |

**La excepción honesta:** BOARDx solo tiene sentido si hay consejo. En una
empresa sin consejo se vende como la mesa trimestral de dirección, o no se
vende.

---

## 9. Los paquetes y el mezclador

Dos caminos en la misma pantalla. Los paquetes con nombre son los recomendados
—los que ya traen lógica de secuencia— y el mezclador atiende a quien quiera
armar el suyo.

### Los paquetes con nombre — propuesta

| Paquete | Qué lleva | La promesa |
|---|---|---|
| **Arranque** | SCANx + DX49 | Saber qué pasa antes de invertir |
| **Dirección** | SCALEx + TEAMx | El plan que sí baja a la gente |
| **Gobierno** | SCALEx + TEAMx + BOARDx | Estrategia, equipo y consejo en el mismo tablero |
| **Comercial** | DX49 + FlowHub CRM | Ordenar la operación y después automatizar la venta |
| **Ecosistema** | Las seis | La empresa completa en un solo sistema |

### El mezclador libre

Marcas las que quieras y abajo aparecen tres cosas: el total por separado, el
total combinado, y **una sola cifra con lo que te ahorras por llevarlas
juntas**. Más el código de la combinación, para poderlo decir en voz alta y
capturarlo al cerrar.

| Piezas | Descuento | Código |
|---|---|---|
| 2 | 10% | `MIX2` |
| 3 | 15% | `MIX3` |
| 4 | 20% | `MIX4` |
| 5 o más | 25% | `MIXFULL` |

### La advertencia que hay que dar en la reunión

Una escalera así, aplicada sobre la mensualidad, erosiona la recurrencia para
siempre: el descuento se paga todos los meses del resto de la relación.

**Lo sano es que el porcentaje muerda la implementación y las piezas de un solo
pago, y que la mensualidad quede intacta.** El cliente ve el mismo ahorro en el
primer cheque, que es donde decide, y la base recurrente no se toca.

Y hay un argumento de fondo: la implementación es la parte donde el costo
marginal de la cuarta herramienta **sí baja de verdad** —el diagnóstico ya está
hecho, la conversación ya se tuvo, el equipo ya se conoce—. Así que ese
descuento está respaldado por un ahorro real, y no por ganas de cerrar.

### Lo que el cotizador alimenta

El registro de cierre del CRM ya está especificado para recibir esto: precio de
lista, descuento, **código**, cortesías con su precio de lista, precio de cierre
y forma de pago. El código que arma la landing es el que se captura al cerrar.
Así se puede medir, al trimestre, si una combinación **vendió más** o solo
**adelantó la curva** — las dos son válidas y se miden aparte.

---

## 10. El taller de enero

El launcher es la pieza que hace que el taller no termine cuando termina.

**Cómo baila el know-how.** Cada módulo del taller aterriza en una capa, y cada
capa tiene su herramienta. Al final del módulo no se vende: se nombra la pieza
que resuelve lo que acaban de entender que les falta. El taller enseña el
método; el launcher es dónde el método vive después.

**Lo que se llevan todos, sin pagar más:** un acceso al launcher con su SCANx
hecho. Eso convierte la salida del taller en una cuenta abierta con un
diagnóstico dentro, y el seguimiento deja de ser una llamada en frío.

**El upsell es la combinación, y por eso la escalera tiene que estar a la
vista.** Un CEO que entendió que le duelen tres cosas no quiere tres
cotizaciones. Quiere ver las tres juntas con un número abajo.

---

## 11. Lo que falta decidir — para la reunión de las 4

1. **Implementación y mensualidad de SCALEx, TEAMx y BOARDx.** Seis números, y
   es el bloqueo duro: sin ellos el cotizador no se puede construir. Si hoy solo
   salen rangos, sirven rangos.
2. **Costo de entrega de cada herramienta.** El número interno. Es el que decide
   hasta dónde puede bajar la escalera sin vender abajo del costo.
3. **¿La landing cotiza en pesos, en dólares o en los dos?** Hoy conviven
   $35,000 MXN, $30,000 MXN y USD 1,700 — y los dos últimos son el mismo
   número.
4. **¿Los paquetes con nombre llevan precio propio o se calculan con la
   escalera?** Precio propio comunica mejor y amarra el margen; calculado es una
   sola mecánica y no hay que mantener dos listas.
5. **¿Una landing o dos?** ¿FlowHub CRM y DX49 entran a la landing de SCALEx, o
   la landing es una marca por encima de las dos?
6. **El nombre del conjunto**, si la respuesta anterior es «por encima».
7. **¿La landing es pública o con acceso?** Público indexa y sirve de
   vitrina; con acceso se puede personalizar por prospecto y medir quién entró.
8. **La escalera:** los porcentajes, y si muerde la mensualidad o solo los pagos
   únicos (ver la advertencia de la sección 9). Y los nombres de los paquetes.
9. **¿SCANx se queda gratis?** El código ya lo entrega gratis siempre. Confirmar
   que es la decisión y no un default.
10. **El taller de enero:** fecha, ciudad, a quién y cuántos. De eso depende qué
   piezas tienen que estar listas y cuáles pueden ir como «Próximamente».
11. **Quién factura una combinación mixta** (SCALEx + FlowHub). Son dos entidades.

---

## 12. Qué hay que construir, en orden

**Para el día de la presentación, solo lo primero y lo segundo.**

1. **La ficha de cada herramienta, en un solo archivo.** Logo, nombre, dolor,
   impacto, qué incluye, qué se lleva, implementación, mensualidad, capa y
   afinidades. Es el dato que alimenta la landing hoy y el launcher después.
2. **La landing con el mezclador y el cotizador.** Seis fichas que se abren al
   clic, los paquetes con nombre, la selección libre con la escalera y el
   código, y la sección que explica qué es la implementación.
3. El formulario de salida: qué se hace con un paquete armado. Enlace de pago,
   solicitud de cotización formal, o contacto directo.
4. Después de la presentación: enganchar el código del cotizador con el registro
   de cierre del CRM.
5. **Cerrar el hueco de la compuerta en el launcher que ya existe.** `APPS` solo
   conoce `scalex` y `teamx`, así que `appDeRuta('/boardx')` devuelve `null`: la
   tarjeta de BOARDx muestra el candado «No incluida», y la URL `/boardx` abre
   igual para cualquiera que haya entrado. Si BOARDx se va a cobrar, esto se
   cierra antes de darle acceso a nadie de fuera.

---

## 13. Lo que no va a estar para enero

Se declara ahora para que nadie lo prometa en la sala:

- **DX49 no tiene app.** Es una metodología con una landing. El diagnóstico se
  entrega a mano. En la landing entra con su ficha y su precio como cualquier
  otra, y eso alcanza — la landing no abre nada.
- **FlowHub CRM vive en otro stack y otro dominio.** Para la landing da igual,
  porque ahí solo se presenta y se cotiza. Importa después, cuando haya que
  mandar al cliente al ecosistema que le toca.
- **Marca Personal no tiene precio.**
- **Las microherramientas sueltas** (OPSP, flujo de costos) necesitan empaque y
  precio propios antes de poder ofertarse por separado.
