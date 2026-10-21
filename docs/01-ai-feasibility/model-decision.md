# Evaluación y decisión de modelo para el MVP

| Campo | Valor |
|---|---|
| Fecha de la evaluación | 2026-10-20 y 2026-10-21 |
| Decisión | Usar MiniLM con inferencia local en Node.js para el reto técnico |
| Artefacto ejecutado | `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, conversión ONNX de `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Configuración | CPU, `@huggingface/transformers` 3.8.1, pesos `q8`, *mean pooling*, normalización L2, 384 dimensiones |
| Umbral inicial del MVP | `0.8538613695045911`, configurable; es el probado en el flujo completo, con 8 falsos negativos de 10 positivos |
| Alcance | Selección práctica para implementar un MVP; no certificación de calidad de producción |

## 1. Pregunta y criterio de decisión

El [reto técnico](../00-discovery/reto-tecnico.md) pide detectar posibles duplicados por significado con al menos un modelo de Hugging Face, antes de guardar una frase. Se compararon modelos que pueden ejecutarse localmente para escoger uno que haga viable el flujo completo sin depender de una API de inferencia de pago ni de un servicio Python adicional.

La elección considera, en este orden, que el modelo produzca embeddings correctos en Node.js, que permita recuperar y advertir en el flujo con PostgreSQL, y que su memoria, latencia y complejidad sean razonables para una aplicación pequeña. Se registran también los errores semánticos: ningún resultado observado permite prometer una detección confiable de todos los duplicados.

El 75 % de aciertos (15/20) fue una **meta interna de la exploración**. Se aplicó al calificar los experimentos históricos; después, DEC-022 del [Product Brief](../00-discovery/product-brief.md) dejó de tratarlo como condición de entrega. Los resultados no se recalculan ni se describen como aprobados por ese cambio.

## 2. Procedimiento y datos

El procedimiento se resume en el [plan de ejecución](experiment-plan.md). Los pasos efectivamente realizados fueron:

1. **Viabilidad en Node.js:** MiniLM, E5, DistilUSE y BGE-M3 generaron embeddings con Transformers.js y ONNX en CPU. Se verificaron dimensión, finitud, norma L2, repetibilidad y simetría del coseno. Se midieron carga desde caché, primera inferencia, ocho inferencias calientes, un lote de seis, memoria RSS y descarga inicial. DistilUSE requirió aplicar su proyección Dense para obtener sus 512 dimensiones correctas.
2. **Pares etiquetados:** se compararon frases similares y no similares en español. La versión 2 separó 40 pares de calibración y 20 de holdout, equilibrados. Los umbrales se fijaron con calibración y se aplicaron al holdout sin modificarlos. Se ejecutó después un tercer holdout de pares para MiniLM y BGE-M3, también sin búsqueda en PostgreSQL. Estos ensayos muestran errores semánticos, pero una pareja aislada no prueba que se encuentre la frase correcta entre varias almacenadas.
3. **Flujo completo:** se evaluaron MiniLM y BGE-M3 con [40 validaciones de calibración](../../experiments/semantic-similarity/data/flow/calibration.json) y [20 de holdout](../../experiments/semantic-similarity/data/flow/holdout.json), mitad con alerta esperada y mitad sin ella. Cada caso insertó tres frases activas en PostgreSQL, generó los embeddings del modelo, buscó la candidata más cercana con pgvector y aplicó el umbral del modelo. Los umbrales, el orden de desempate y los hashes de los conjuntos se fijaron antes de leer las decisiones del holdout. Calibración y holdout no comparten frases ni familias.
4. **Costo y fallos:** se compararon los tiempos y la memoria observados. MiniLM cargó y produjo un vector finito con la red deshabilitada y la caché preparada; una caché vacía o incompleta produjo error. Las pruebas de fallos propagaron errores simulados de inferencia, búsqueda y timeout sin devolver una validación exitosa.

La etiqueta positiva significa «conviene advertir de un posible duplicado para revisión humana». Incluye paráfrasis y cambios pequeños de detalle cuando se mantiene la acción y el asunto. Las acciones opuestas, negaciones que invierten el hecho e intenciones diferentes son negativas. Las etiquetas de la prueba del flujo constan como `labeled` y fueron redactadas para el experimento; no tienen revisión humana independiente.

**Métricas:** accuracy = decisiones correctas / total; precisión = alertas correctas / alertas emitidas; recall = alertas correctas / casos que debían alertarse. F1 combina precisión y recall con igual peso; F2 da más peso al recall. FP es una alerta indebida y FN un duplicado potencial sin alerta. El error de recuperación cuenta por separado los casos en que la primera frase hallada no es la candidata pertinente. El p95 es el tiempo por debajo del cual quedaron al menos el 95 % de las observaciones de la muestra.

## 3. Viabilidad y costo local

Los cuatro candidatos iniciales produjeron vectores finitos, normalizados y de la dimensión esperada. Esta tabla corresponde a una corrida local en macOS `arm64`, Node.js `v22.12.0`, CPU, `q8`; cada modelo se midió en un proceso independiente. La latencia caliente procede de solo ocho repeticiones.

| Modelo | Dimensión | Mediana caliente | p95 caliente | RSS pico | Descarga observada |
|---|---:|---:|---:|---:|---:|
| MiniLM | 384 | 2,85 ms | 6,07 ms | 690,6 MiB | 129,1 MiB |
| E5-small | 384 | 3,77 ms | 7,65 ms | 684,0 MiB | 129,1 MiB |
| DistilUSE | 512 | 13,57 ms | 15,87 ms | 510,1 MiB | 133,3 MiB |
| BGE-M3 | 1024 | 18,76 ms | 20,70 ms | 1 806,6 MiB | 559,6 MiB |

La carga desde caché tardó 394,4 ms para MiniLM y 615,8 ms para BGE-M3. La primera inferencia después de cargar tardó 7,44 ms y 28,61 ms, respectivamente. La primera descarga mezcló red e inicialización, por lo que no se usa como latencia normal de la aplicación. No se registraron el modelo exacto de CPU ni la memoria física del equipo.

MiniLM también generó un embedding válido con el acceso remoto deshabilitado y la caché preparada. Si la caché estaba vacía o incompleta, la carga falló.

## 4. Calidad semántica de pares

Los [pares v2 de calibración](../../experiments/semantic-similarity/data/v2/pairs.calibration.json) y [holdout](../../experiments/semantic-similarity/data/v2/pairs.holdout.json) contienen 40 y 20 casos, respectivamente. Las cifras siguientes usan los umbrales congelados antes del holdout. TP y TN son aciertos positivos y negativos.

| Modelo | Umbral | Calibración | Holdout | TP | TN | FP | FN | Precisión | Recall | F1 | F2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| MiniLM | 0,676399 | 31/40 (77,5 %) | 13/20 (65 %) | 7 | 6 | 4 | 3 | 63,6 % | 70 % | 66,7 % | 68,6 % |
| BGE-M3 | 0,777859 | 33/40 (82,5 %) | 13/20 (65 %) | 8 | 5 | 5 | 2 | 61,5 % | 80 % | 69,6 % | 75,5 % |

MiniLM y BGE-M3 empataron en aciertos del holdout v2. Compartieron falsos negativos en paráfrasis con vocabulario diferente y falsos positivos ante acciones opuestas. E5 y DistilUSE no superaron la meta histórica de calibración. Sus mejores puntos diagnósticos por F2 en los 40 pares v2 fueron:

| Modelo | Umbral diagnóstico | Aciertos | TP | TN | FP | FN | Máxima accuracy al recorrer umbrales | Holdout v2 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| E5-small | 0,892426 | 23/40 (57,5 %) | 20 | 3 | 17 | 0 | 65 % | No evaluado |
| DistilUSE | 0,448537 | 22/40 (55 %) | 20 | 2 | 18 | 0 | 62,5 % | No evaluado |

La máxima accuracy corresponde a otros cortes de umbral y no a las matrices de confusión mostradas. Granite y MPNet se exploraron después, sin una evaluación comparable del flujo completo. MPNet obtuvo 12/20 en un holdout de pares ya consultado por otros modelos, por lo que ese resultado es exploratorio.

Antes de v2 se evaluó una primera definición de similitud. La definición de «posible duplicado» se amplió antes de crear y puntuar v2; por ello los resultados de ambas versiones no son mediciones comparables de una misma prueba.

| Conjunto de pares | Modelo | Umbral | Aciertos | TP | TN | FP | FN |
|---|---|---:|---:|---:|---:|---:|---:|
| Holdout v1, definición inicial | MiniLM | 0,677256 | 10/20 (50 %) | 7 | 3 | 7 | 3 |
| Holdout v3, definición ampliada | MiniLM | 0,676399 | 8/20 (40 %) | 6 | 2 | 8 | 4 |
| Holdout v3, definición ampliada | BGE-M3 | 0,777859 | 10/20 (50 %) | 8 | 2 | 8 | 2 |

Los archivos v2 tienen SHA-256 `a6bf440a333347447727261c2754c1ab47c31a6fbcdbcfd2ec0792f1659901ff` (calibración) y `be474e2c5320a6aa2ecd934fddb1ad5a04b4f3b35727c8eb6eb1ae401d24a585` (holdout). Los umbrales exactos reutilizados en v3 figuran en la [configuración congelada](../../experiments/semantic-similarity/data/v3/holdout-freeze.json).

En el [tercer holdout de pares](../../experiments/semantic-similarity/data/v3/pairs.holdout.json) se conservaron los umbrales de calibración v2. Ambos modelos produjeron ocho falsos positivos sobre diez negativos; MiniLM no dominó todas las pruebas de calidad. Las etiquetas de este tercer conjunto tampoco tienen revisión humana independiente. Ninguno de estos holdouts de pares incluye recuperación desde PostgreSQL.

El `0.6763989282227754` de MiniLM se obtuvo calibrando **pares predefinidos**. Es un resultado diagnóstico de esa prueba, no la configuración del MVP.

## 5. Calidad del flujo con PostgreSQL

El evaluador [`src/evaluate-flow-dataset.mjs`](../../experiments/semantic-similarity/src/evaluate-flow-dataset.mjs) probó búsqueda exacta con pgvector y decisión de alerta. En calibración examinó posibles cortes entre puntajes y eligió el de más decisiones correctas; los empates favorecieron menos FP, luego menos FN y finalmente el umbral más alto. El holdout reutilizó los umbrales congelados. La coincidencia textual normalizada tuvo prioridad y la búsqueda semántica usó coseno.

| Fase y modelo | Umbral | Aciertos | TP | TN | FP | FN | Errores de recuperación | p95 de `validate` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Calibración MiniLM | 0,853861 | 22/40 (55 %) | 5 | 17 | 3 | 15 | 2 | 18,33 ms |
| Calibración BGE-M3 | 0,922539 | 20/40 (50 %) | 0 | 20 | 0 | 20 | 1 | 35,67 ms |
| **Holdout MiniLM** | **0,853861** | **12/20 (60 %)** | **2** | **10** | **0** | **8** | **0** | **7,81 ms** |
| Holdout BGE-M3 | 0,922539 | 10/20 (50 %) | 0 | 10 | 0 | 10 | 0 | 26,73 ms |

Los umbrales exactos congelados para este flujo fueron `0.8538613695045911` (MiniLM) y `0.9225392213103117` (BGE-M3); la tabla los redondea solo para lectura.

**Por qué MiniLM tiene dos umbrales:** ambos usan similitud coseno; PostgreSQL no cambia por sí mismo la escala del puntaje. Cambiaron el conjunto de calibración y la tarea: en pares se clasificó una comparación conocida, mientras que en el flujo se eligió primero la mayor similitud entre tres frases activas y luego se decidió si alertar. Al optimizar aciertos sobre esos datos diferentes salieron cortes diferentes. Para el MVP se usará **`0.8538613695045911` como valor inicial configurable**, porque es el único de los dos evaluado en el flujo que implementará la aplicación. Esa elección conserva su limitación medida: 8 de 10 positivos no recibieron alerta.

En los diez positivos del holdout ambos modelos recuperaron la frase pertinente como primera candidata. El problema principal fue **la decisión con el umbral**, no la recuperación: MiniLM advirtió en dos positivos y dejó pasar ocho; BGE-M3 no advirtió en ninguno. Los diez negativos no recibieron alerta con esos umbrales. Bajar un umbral usando este mismo holdout podría aumentar falsos positivos y no sería una evaluación independiente.

Los tiempos de `validate` incluyen consulta de corpus, embedding de la frase nueva y búsqueda con el modelo ya cargado y tres frases indexadas. No incluyen HTTP, carga inicial, inserción, indexación ni guardado; no son tiempos de la API final. En esta muestra, MiniLM fue aproximadamente 3,4 veces más rápido por p95 que BGE-M3.

## 6. Decisión y consecuencia para el MVP

**Se elige MiniLM para implementar el MVP.** Generó embeddings correctos en Node.js, funcionó sin red con caché preparada, obtuvo más aciertos que BGE-M3 en el flujo probado (12/20 frente a 10/20) y exigió menos tiempo, memoria y descarga. E5 y DistilUSE fueron técnicamente viables, pero no mostraron una ventaja de calidad que justifique seleccionarlos; BGE-M3 rindió mejor en algunos pares, aunque con mayor costo y sin mejorar el flujo completo.

La elección **no equivale a afirmar calidad suficiente para producción**. MiniLM quedó por debajo de la antigua meta del 75 % y dejó pasar ocho positivos del holdout del flujo con el umbral evaluado. Para no frenar el MVP, ese umbral probado se toma como **valor inicial configurable**; se elige por su trazabilidad en el flujo completo, no porque sea óptimo. El umbral menor de los ensayos de pares (`0.6763989282227754`) no se adopta como valor inicial porque esos resultados no incluyeron la búsqueda entre varias frases y el tercer holdout de pares produjo ocho falsos positivos de diez negativos. El MVP comunicará las alertas como posibles coincidencias y conservará la decisión de guardar en manos del usuario. La mejora del método o una nueva comparación de modelos se posponen hasta después de entregar el flujo funcional; requerirían datos nuevos para demostrar avance.
