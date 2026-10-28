# Los módulos de FlowHub

Un documento por módulo. No es documentación de código: es por qué existe cada
cosa, qué resuelve, qué no resuelve, y qué no se puede romper.

Sirve para tres cosas distintas y por eso todos siguen la misma estructura:

- **Entrenar a alguien nuevo** sin que tenga que leer el código ni preguntarle
  a quien lo escribió.
- **Vender y explicar** el módulo a un cliente, con el problema real que
  resuelve en vez de una lista de funciones.
- **Programar sin romperlo**, porque la última sección dice qué reglas sostienen
  el módulo y qué pasa si se ignoran.

## Antes de construir: la plantilla de propuesta

Un módulo no empieza acá. Empieza en la **[plantilla de propuesta de módulo][p]**,
que es el filtro que obliga a llevar una idea a profundidad antes de escribir
una línea: el problema en palabras de quien lo sufre, qué se descartó y por
qué, qué número debería moverse, qué se puede fingir, y la decisión de
construirlo o no.

Vive en Claude Docs y no en este repo a propósito: ahí se comenta y se discute
en equipo. Lo de acá es lo que queda **después**, cuando el módulo existe y hay
que mantenerlo sin romperlo.

Propuestas escritas:

- [Gamificación][g] — Propuesta, todavía no se construye.

[p]: https://claude.ai/artifact/WhGY3csyCoYLKBauwsE7EH
[g]: https://claude.ai/artifact/Wp42HGHddJ31tWo3VAfemU

## La estructura

Todos llevan las mismas secciones, en el mismo orden:

1. **De dónde nace** — el problema real, con el caso concreto que lo originó.
2. **Para quién es** — y para quién no.
3. **Qué hace** — lo que el módulo sí resuelve hoy.
4. **Qué no hace** — los límites, dichos de frente.
5. **Cómo se conecta** — qué toca del resto del sistema y qué no debe tocar.
6. **Para desarrolladores** — modelo de datos, dónde vive el código, las reglas
   que no se pueden romper.
7. **Decisiones abiertas** — lo que todavía no está resuelto, para que nadie
   asuma que sí.

Un módulo sin la sección 4 está incompleto: lo que un módulo *no* hace es la
mitad de lo que hay que saber antes de prometerlo.

## Índice

- [Marca Personal](marca-personal.md)
