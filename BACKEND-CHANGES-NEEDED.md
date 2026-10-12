# Cambios de backend necesarios para el rediseño del pipeline

Documento vivo. Nada de esto se implementa sin aprobación explícita —
el rediseño es UI pura hasta la Fase 3.

## Detectado en Fase 1 (componentes aislados)

### 1. Métricas agregadas por columna
`<PipelineColumn />` muestra tres métricas en el header: cantidad de deals,
valor total y edad promedio de la etapa.

- **Cantidad y valor** se pueden calcular en el cliente sumando los leads que
  ya se leen de Firestore. No hace falta backend.
- **Edad promedio** necesita saber cuándo entró cada lead a su etapa actual.
  Hoy el lead tiene `updatedAt`, que se pisa con cualquier cambio, así que no
  sirve para medir antigüedad en la etapa. Haría falta un campo tipo
  `stageEnteredAt`, escrito cuando `updateLeadScoreAndStage` mueve de etapa.

### 2. Marca de "rotting" (borde rojo)
La tarjeta se marca cuando el deal lleva más de un umbral sin actividad.
Depende del mismo dato que el punto anterior más un umbral configurable por
pipeline. Sin `stageEnteredAt` solo se puede aproximar con `lastMessageAt`.

### 3. Tendencia del score (flecha ↑/↓)
El chip compara el score contra el de la semana anterior. Hoy solo se guarda
el score actual en el lead; no hay histórico. Haría falta o una subcolección
de snapshots semanales, o un campo `scoreLastWeek` que un job actualice.

### 4. Métricas del InsightsBar
Las cinco métricas superiores (agendadas esta semana, tasa de conversión,
tiempo promedio de cierre, valor ponderado, ganados 30d) son agregados sobre
el histórico de leads. Conviene resolverlas en una función de Netlify y no en
el cliente, porque implican recorrer muchos documentos.

## Pendiente de decidir (ver preguntas abiertas en el PR de Fase 1)
- Qué hacer con pipelines de más de 7 columnas pre-handoff.
- Si se permite drag directo entre pre-handoff y post-handoff.
- Si el score se congela al pasar a post-handoff.
