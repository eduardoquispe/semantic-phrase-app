# Resultados de calibración — Experimento 2

| Campo | Valor |
|---|---|
| Proyecto | Semantic Phrase Validator |
| Experimento | 02 — Calidad semántica y calibración |
| Etapa | Calibración |
| Fecha de ejecución | 2026-10-20 (America/Lima) |
| Estado al cerrar calibración | MiniLM elegible bajo DEC-019; holdout aún no abierto en esa etapa |
| Resultado posterior | `docs/01-ai-feasibility/experiment-02-results.md`: holdout ejecutado, MiniLM rechazado |
| Protocolo | `docs/01-ai-feasibility/experiment-02-proposal.md` |
| Dataset | 40 pares equilibrados y aprobados |
| Puntajes fuente | `experiments/semantic-similarity/results/experiment-02-calibration-1792549700487.json` |
| Manifiesto actualizado | `experiments/semantic-similarity/results/experiment-02-calibration-1792554852198.json` |
| Criterio vigente | Mínimo 75 % de accuracy (Product Brief, DEC-019) |

## 1. Resultado ejecutivo

La corrida original aplicó el protocolo aprobado con un mínimo de 80 % de accuracy y declaró no elegibles a los cuatro modelos. Después, el Product Brief cambió el mínimo a 75 % (DEC-019). Al volver a aplicar **la misma regla de selección** a los puntajes ya obtenidos, con el nuevo mínimo, MiniLM fue el único candidato elegible en calibración: obtuvo 75 % de accuracy (30/40) con umbral `0.677256`. Posteriormente se ejecutó el holdout de 20 pares; su resultado final se documenta por separado.

Este recálculo usa los puntajes de calibración guardados y no genera embeddings nuevos ni altera las etiquetas. El JSON fuente conserva correctamente el criterio histórico de 80 %, por lo que todavía registra `eligible: false` y `selectedThreshold: null` para MiniLM. El manifiesto actualizado registra el 75 %, el umbral candidato y los mismos hashes de las particiones. La evaluación posterior en holdout obtuvo 50 % y rechazó esta combinación para el MVP.

## 2. Integridad del conjunto congelado

| Partición | SHA-256 |
|---|---|
| Calibración | `04d2deb5c9d167c1af661cf49359166f1c6d0180adc230fb537fa066fbf6c3b5` |
| Holdout sin abrir | `33040270a036572a6b3bc10163b1b51cbe19dc1136956ed21724509b1b2f6397` |

Ambas particiones tenían estado `approved` antes de la ejecución. El holdout solo fue leído para calcular y congelar su hash; no se generaron embeddings ni puntajes para sus textos.

## 3. Resultados de calibración

Para MiniLM se muestra el umbral candidato obtenido al filtrar por accuracy ≥ 75 % y, entre los puntos elegibles, maximizar F2 con los desempates del protocolo. Para los otros modelos se conserva el mejor punto diagnóstico por F2, que no es un umbral candidato.

| Modelo | Umbral | Tipo | Accuracy | Precision | Recall | F1 | F2 | TP | TN | FP | FN | Elegible en calibración |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| MiniLM | 0.677256 | Candidato | **75.0 %** | **70.8 %** | 85.0 % | **77.3 %** | 81.7 % | 17 | 13 | 7 | 3 | **Sí** |
| E5 | 0.871966 | Diagnóstico | 50.0 % | 50.0 % | 100 % | 66.7 % | 83.3 % | 20 | 0 | 20 | 0 | No |
| DistilUSE | 0.418711 | Diagnóstico | 50.0 % | 50.0 % | 100 % | 66.7 % | 83.3 % | 20 | 0 | 20 | 0 | No |
| BGE-M3 | 0.724273 | Diagnóstico | 52.5 % | 51.3 % | 100 % | 67.8 % | 84.0 % | 20 | 1 | 19 | 0 | No |

El recall perfecto de los puntos diagnósticos no indica buena separación: resulta de umbrales bajos que clasifican casi todos los pares como similares. La precisión y la cantidad de falsos positivos muestran que esa conducta produciría demasiadas advertencias.

La máxima accuracy encontrada al barrer todos los umbrales fue 75 % para MiniLM, 55 % para E5, 50 % para DistilUSE y 65 % para BGE-M3. MiniLM cumple el nuevo mínimo exactamente, sin margen de acierto adicional en calibración. Los otros tres modelos siguen por debajo del 75 % incluso en su mejor umbral.

## 4. Distribución de puntajes

| Modelo | Similares: mínimo / mediana / máximo | No similares: mínimo / mediana / máximo |
|---|---|---|
| MiniLM | 0.593 / 0.799 / 0.952 | 0.460 / 0.646 / 0.889 |
| E5 | 0.872 / 0.923 / 0.981 | 0.932 / 0.955 / 0.977 |
| DistilUSE | 0.419 / 0.799 / 0.953 | 0.543 / 0.824 / 0.975 |
| BGE-M3 | 0.727 / 0.863 / 0.936 | 0.721 / 0.822 / 0.938 |

Existe un solapamiento amplio en los cuatro modelos. En E5 y DistilUSE, la mediana de los casos `not_similar` incluso supera la mediana de los casos `similar`.

## 5. Patrón de errores

Los negativos de calibración fueron diseñados para representar riesgos reales del producto: negaciones, cambios de cantidades o entidades, acciones opuestas y frases del mismo tema con distinta intención.

Con el umbral candidato de `0.677256`, MiniLM produjo 7 falsos positivos entre los 20 negativos y 3 falsos negativos entre los 20 similares. Los falsos positivos incluyen:

- “El café está caliente” frente a “El café no está caliente”.
- Cusco frente a Arequipa.
- Segundo piso frente a séptimo piso.
- Ventana abierta frente a ventana cerrada.
- Horno encendido frente a horno todavía no encendido.
- Renovar una membresía frente a cancelarla.
- Fechas 12 y 21 de mayo.

Los falsos negativos fueron `cal-s-14` (auto sin combustible / necesidad de ir a una gasolinera), `cal-s-16` (bombilla quemada / luz que no enciende) y `cal-s-19` (cerradura atascada / llave que no gira).

El patrón indica una limitación de los embeddings de oración evaluados: el alto solapamiento léxico puede dominar cambios pequeños pero críticos para el significado. Elevar el umbral reduce advertencias erróneas, pero deja pasar algunas paráfrasis. En el flujo vigente, esto permitiría al usuario guardar un posible duplicado tras pulsar **Guardar**; no existe guardado automático.

## 6. Sensibilidad de MiniLM

| Umbral | Accuracy | Precision | Recall | F1 | FP | FN |
|---:|---:|---:|---:|---:|---:|---:|
| 0.667256 | 70.0 % | 65.4 % | 85 % | 73.9 % | 9 | 3 |
| 0.671924 | 72.5 % | 68.0 % | 85 % | 75.6 % | 8 | 3 |
| **0.677256** | **75.0 %** | **70.8 %** | **85 %** | **77.3 %** | **7** | **3** |
| 0.685736 | 72.5 % | 69.6 % | 80 % | 74.4 % | 7 | 4 |
| 0.687256 | 72.5 % | 69.6 % | 80 % | 74.4 % | 7 | 4 |

Los umbrales vecinos y las variaciones de ±0.01 quedan por debajo del mínimo vigente. Por tanto, la elección es sensible a cambios pequeños del umbral sobre este conjunto.

## 7. Decisión

- MiniLM es el único candidato elegible **en calibración** bajo el mínimo vigente de 75 %, con umbral candidato `0.6772555477949693`.
- E5, DistilUSE y BGE-M3 no son elegibles bajo esta configuración.
- La elegibilidad en calibración no seleccionó un modelo ganador ni fijó un umbral de producción.
- El holdout se ejecutó después de congelar el umbral; MiniLM no alcanzó el mínimo final. Véase `experiment-02-results.md`.
- El manifiesto histórico con mínimo de 80 % sigue como evidencia y el runner lo rechaza. El nuevo manifiesto registra el 75 % vigente y MiniLM como único candidato elegible.

El protocolo, la implementación de la regla de selección y el manifiesto registraron el 75 % vigente y el umbral candidato congelado. El manifiesto se generó con `npm run calibrate -- --from-report results/experiment-02-calibration-1792549700487.json` desde `experiments/semantic-similarity/`, sin repetir inferencias. La evaluación final se ejecutó una sola vez sobre los 20 pares aprobados, sin reajustar el umbral.

## 8. Opciones para una nueva iteración

El holdout ya se abrió y la combinación fue rechazada. Sus errores pueden orientar una nueva hipótesis; la siguiente validación independiente necesitará un conjunto final nuevo.

Las opciones para una nueva iteración serían:

1. Mantener MiniLM como embedding base y añadir reglas deterministas separadas para negaciones, números y entidades críticas.
2. Evaluar un modelo de *reranking* o clasificación de pares que reciba ambos textos conjuntamente, conservando embeddings para recuperación de candidatas.
3. Probar candidatos específicamente entrenados para similitud semántica textual y español, con un nuevo protocolo prerregistrado.
4. Ampliar la calibración con más familias independientes si se desea estimar mejor cada categoría; esto requeriría una versión nueva del dataset y documentación de los cambios.

Si se elige una iteración nueva, su protocolo debe definirse antes de generar nuevos puntajes. El holdout ya abierto puede conservarse como evidencia diagnóstica, pero no reutilizarse para acreditar la calidad final.
