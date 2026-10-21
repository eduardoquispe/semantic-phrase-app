# Propuesta de nueva evaluación — Experimento 2, versión 2

| Campo | Valor |
|---|---|
| Proyecto | Semantic Phrase Validator |
| Estado | Protocolo ejecutado; ambos candidatos rechazados en holdout v2 |
| Fecha | 2026-10-20 |
| Motivo | Nueva definición de posible duplicado (DEC-020) después del holdout fallido de la versión 1 |
| Referencia histórica | `docs/01-ai-feasibility/experiment-02-results.md` |
| Calibración propuesta | `experiments/semantic-similarity/data/v2/pairs.calibration.json` |
| Holdout nuevo propuesto | `experiments/semantic-similarity/data/v2/pairs.holdout.json` |

## 1. Cambio de comportamiento

La advertencia significa «esta frase **podría** duplicar una gestión o registro; revísala antes de guardar». No exige que todos los detalles de las dos frases sean idénticos. Si la acción y el asunto se mantienen, una diferencia pequeña de nombre, cantidad, fecha, hora o lugar puede representar una corrección del mismo registro y se etiqueta `similar`. El usuario conserva la decisión final de guardar o cancelar.

Se etiqueta `not_similar` cuando cambia la acción principal, se invierte el hecho mediante una negación o las frases plantean solicitudes de intención distinta. Compartir un tema por sí solo no basta. Así, «cita para el martes» y «cita para el jueves» pueden activar revisión, mientras que «confirmar la cita» y «cancelar la cita» no se tratan como la misma solicitud.

Esta definición amplía la clase `similar` respecto de la versión 1. No altera los hashes, etiquetas, resultados ni la conclusión del holdout ya abierto. Se registra como una nueva hipótesis de producto surgida **después** de ver el resultado fallido; por ello necesita datos nuevos y una validación final independiente.

## 2. Composición propuesta

| Partición | `similar` | `not_similar` | Total | Estado |
|---|---:|---:|---:|---|
| Calibración v2 | 20 | 20 | 40 | `approved` |
| Holdout v2 | 10 | 10 | 20 | `approved`, sin puntuar |

Los 60 pares son nuevos. Ninguna familia ni frase se comparte entre ambas particiones. Dentro de `similar` se mezclan variaciones de detalle con paráfrasis, sinónimos, reordenamientos y variaciones gramaticales. Dentro de `not_similar` permanecen acciones opuestas, negaciones y solicitudes del mismo tema con intención diferente. Se reducen los ejemplos que tratan un simple cambio de nombre, número o fecha como negativo, porque bajo DEC-020 esos casos requieren revisión.

| Tipo de caso | Calibración | Holdout |
|---|---:|---:|
| `similar`: variación de detalle | 9 | 4 |
| `similar`: otras paráfrasis y variaciones | 11 | 6 |
| `not_similar`: acción opuesta | 4 | 2 |
| `not_similar`: negación del hecho | 4 | 2 |
| `not_similar`: intención distinta | 12 | 6 |

El conjunto sigue equilibrado, pero un resultado alto podría reflejar la mezcla concreta de casos. Se revisarán también errores por categoría y el costo de advertencias innecesarias; no se aceptará una combinación solo por superar el porcentaje total.

## 3. Revisión humana requerida

Antes de generar embeddings o elegir un umbral, se deben revisar los textos, las etiquetas y las justificaciones de **ambos** archivos. En particular, confirmar que:

1. Cada par `detail_variation` realmente podría referirse a una corrección de la misma gestión y amerita advertencia.
2. Cada acción opuesta o negación cambia la intención o el hecho de forma suficiente para no advertir como posible duplicado.
3. Ningún par depende de contexto no escrito para justificar su etiqueta.
4. Los casos negativos siguen siendo representativos y no se han vuelto triviales solo para elevar la accuracy.

El usuario aprobó los 60 pares el 2026-10-20; ambos archivos pasaron a `approved` antes de generar puntajes. Si cambia una etiqueta o se sustituye un texto, se deberá invalidar la corrida, validar y congelar de nuevo el conjunto **antes** de puntuar modelos. No se elegirán cambios mirando qué pares acierta MiniLM.

## 4. Ejecución propuesta

El criterio de aceptación del Product Brief permanece en al menos 75 % de accuracy sobre un holdout equilibrado de 20 pares. Obtener más de 75 % requeriría al menos 16/20 aciertos; no se presupone que la nueva definición alcance ese resultado.

Tras aprobar la verdad de referencia se repetirá la calibración con la regla vigente de selección de umbral, usando exclusivamente los 40 pares v2. El umbral y la configuración del modelo se congelarán en un nuevo manifiesto antes de abrir el holdout v2 una sola vez. No se reutilizarán los puntajes de calibración ni el holdout de la versión 1 para seleccionar el nuevo umbral. Si la versión 2 falla, su holdout también quedará consumido.

El documento `docs/01-ai-feasibility/experiment-02-results.md` seguirá describiendo la versión 1. Se publicará un reporte separado para la versión 2, cualquiera sea el resultado.

La calibración v2 se ejecutó y sus resultados están en `docs/01-ai-feasibility/experiment-02-v2-calibration-results.md`. MiniLM y BGE-M3 superaron el filtro de 75 % en calibración. El holdout v2 se ejecutó una sola vez; ambos obtuvieron 65 % y fueron rechazados. El resultado final está en `docs/01-ai-feasibility/experiment-02-v2-results.md`.
