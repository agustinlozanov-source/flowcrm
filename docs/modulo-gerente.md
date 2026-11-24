# Módulo Gerente

El gerente de ventas virtual. Cada mañana revisa el embudo, reparte acciones con
nombre y apellido, y al día siguiente comprueba con los datos qué se hizo. Lo que
no se hizo se acumula y queda a la vista.

Diseño de la pantalla: https://claude.ai/artifact/RAcMAb99AonnE6JQLssPZo

## Decisiones tomadas (24 nov 2026)

- **Pantalla principal.** «Hoy» es la pantalla de inicio cuando el módulo está
  encendido.
- **Incluido en los planes, pero con interruptor** desde Superadmin (`addon`
  `gerente`), igual que el Scorecard. Sirve para negociar.
- **Cada consejo es una actividad del lead** (`activities`, `origen: 'gerente'`).
  Aparece donde el equipo ya trabaja.
- **Reporte de dirección por Resend**, a la hora que elija la organización en
  Configuración (mañana o fin del día). Lo recibe quien la organización marque
  como dirección.
- **La base no asignada es una tarea en sí misma.** Asignar es una acción. Además,
  lo urgente de un lead sin dueño se tiene que hacer igual: aparece bajo «Sin
  responsable», en rojo, y se acumula.
- **Las tareas pesan.** Una acción no hecha no desaparece: al día siguiente sigue
  ahí con su antigüedad («Arrastra 5 días»), y cuenta contra la persona.
- **El embudo se lee por etapa.** Lo atorado en Calentamiento es calidad del lead
  (atracción) y no cuenta contra el equipo. En Handoff y Cierre la responsabilidad
  es del equipo.

## Principio: reglas primero, el modelo después

Los consejos salen de reglas sobre los datos, no del modelo. Así cada uno se puede
explicar («por qué me lo pide») y verificar al día siguiente. El modelo solo
redacta el consejo del proceso y la introducción del reporte.

## Catálogo de consejos

| # | Consejo | Se dispara cuando | Va a | Cuenta como hecho cuando |
|---|---|---|---|---|
| 1 | Asignar responsable | Lead en Handoff o Cierre sin `assignedTo` | Dirección / quien reparte | El lead tiene `assignedTo` |
| 2 | Contestar | El último mensaje es del lead y lleva más de N horas sin respuesta (agente apagado o lead en manos de una persona) | Responsable, o «Sin responsable» | Hay mensaje saliente después |
| 3 | Atender el Handoff | Pasó a Handoff hace más de 24 h y ninguna persona escribió ni registró actividad | Responsable | Mensaje humano o actividad hecha |
| 4 | Confirmar cita | Cita mañana sin confirmar | Quien agenda | La cita está confirmada |
| 5 | Marcar asistencia | Cita pasada sin marcar | Quien agenda | La cita tiene asistencia |
| 6 | Rescatar a quien faltó | No asistió y nadie lo buscó después | Responsable | Actividad o mensaje posterior |
| 7 | Cerrar a quien asistió | Asistió y no hay oportunidad ganada | Responsable | Llamada registrada u oportunidad movida |
| 8 | Propuesta fría | Oportunidad abierta sin seguimiento en 5 días | Responsable | Actividad o mensaje posterior |
| 9 | Completar la venta | Ganó una oportunidad y otras del mismo lead siguen abiertas | Responsable | Las otras se ganan o se pierden |
| 10 | Ofrecer cita | Score sobre el umbral del embudo y sin cita | Responsable | Cita creada |
| 11 | Escribir o descartar | Más de 7 días en la etapa sin mensaje ni actividad | Responsable | Mensaje enviado o lead descartado |
| 12 | Actividad vencida | Actividad pendiente con fecha pasada | Su dueño | La actividad se marca hecha |
| 13 | Poner monto | Oportunidad sin monto | Responsable | La oportunidad tiene monto |
| 14 | Actualizar oportunidad | Oportunidad sin cambios en 14 días | Responsable | La oportunidad cambia |

Del 1 al 11 la mayoría ya existe en el Scorecard como «bolsas de rescate» y
chequeos de calidad (`netlify/functions/lib/scorecard/calculo.js`). El Gerente las
reusa con la fecha de hoy.

**Nunca se pide** lo que el equipo no puede resolver: insistirle a quien escribió
una vez en Calentamiento y no volvió. Eso va a la lectura del embudo como calidad
del lead.

## Cómo se verifica

Cada acción termina en uno de tres estados al revisarse la mañana siguiente:

- **Hecha**: el dato cambió como pide la columna de arriba.
- **No hecha**: el dato sigue igual. Se queda, suma un día de antigüedad y cuenta
  en lo que arrastra la persona.
- **Ya no aplica**: el lead se descartó, se movió de etapa o cambió de responsable
  por otro camino.

El botón de la pantalla registra la acción (la llamada, la asistencia, el monto).
Marcar una palomita sin cambiar el dato no basta.

## La pantalla

1. **Termómetro**: pendientes hoy, arrastradas (y la más vieja), cumplimiento de
   ayer, leads sin responsable, dinero en juego en Cierre.
2. **Tablero del equipo**: una tarjeta por persona, con «Sin responsable» primero.
   Avance de hoy, lo que arrastra, y los últimos 7 días. El borde se pone rojo con
   dos o más arrastradas.
3. **Dónde se atora**: cada etapa con sus atorados y quién lo resuelve
   (atracción o equipo). El cuello se marca.
4. **Acciones**, en tres vistas: por persona, por antigüedad, por etapa. Filtro por
   persona.
5. **Columna de consejos**: el consejo del proceso, la lectura del embudo, la deuda
   de la base y cómo se cuenta una acción.

Cada vendedor ve solo lo suyo. Dirección ve todo.

## El reporte de dirección

Corto y con nombres:

1. Cómo cumplió cada persona ayer, con lo que quedó sin hacer.
2. Lo que toca hoy, resumido.
3. Lo que arrastra el equipo y desde cuándo.
4. El consejo del proceso.

## Construcción

- Tarea programada diaria por organización, a primera hora en su zona: primero
  verifica lo de ayer y después genera lo de hoy. Guarda en
  `organizations/{orgId}/gerente/{fecha}` y crea las actividades.
- El reporte sale de una segunda tarea, a la hora configurada por la organización.
- Reglas en funciones puras (como `scorecard/calculo.js`), para que pasen tal cual
  a la v2.

## Pendiente de definir

- Umbral de horas para «Contestar» (propuesta: 2 horas en horario de atención).
- Quién recibe el reporte además de dirección: ¿cada vendedor su lista?
- Si una acción no hecha varios días escala sola a dirección (propuesta: a los 3
  días aparece con nombre en el reporte).
