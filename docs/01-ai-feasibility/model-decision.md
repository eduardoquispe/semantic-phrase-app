# Evaluación y decisión de modelo para el MVP

> Documento histórico de la evaluación de modelos realizada para elegir el modelo de embeddings del MVP. Para el estado actual del runtime en producción, ver `docs/00-discovery/product-brief.md` y `docs/03-architecture/04-ai-architecture.md`.

| Campo | Valor |
|---|---|
| Fecha de la evaluación | 2026-10-20 y 2026-10-21 |
| Decisión | Usar MiniLM como modelo de embeddings para el MVP |
| Umbral inicial del MVP | `0.8538613695045911`, configurable |
| Alcance | Selección práctica para implementar un MVP; no es una certificación de calidad de producción |

## 1. Metodología de evaluación

El [reto técnico](../00-discovery/reto-tecnico.md) pide detectar posibles duplicados por significado con al menos un modelo de Hugging Face, antes de guardar una frase. Se compararon modelos que pueden ejecutarse localmente, con este criterio de selección, en orden de importancia: que generen embeddings correctos, que permitan recuperar y advertir dentro de un flujo con PostgreSQL, y que su memoria, latencia y complejidad sean razonables para una aplicación pequeña.

El 75 % de aciertos (15 de 20) fue una **meta interna de la exploración**, usada para leer los primeros resultados. Más adelante, la decisión DEC-022 del [Product Brief](../00-discovery/product-brief.md) dejó de tratarla como condición de entrega. Los resultados de este documento no se recalculan ni se describen como aprobados por ese cambio.

La evaluación se hizo en dos fases principales, cada una con un conjunto de **calibración** (para fijar un umbral de decisión) y uno de **holdout** (reservado, usado una sola vez, sin ajustar nada después de verlo):

- **Fase 1 — Pares de frases:** mide si el modelo distingue frases similares de frases distintas, comparando una pareja a la vez.
- **Fase 2 — Flujo completo con PostgreSQL:** mide si el modelo, integrado con la base de datos (usando [pgvector](https://github.com/pgvector/pgvector), una extensión de PostgreSQL para buscar por similitud de vectores), encuentra la frase correcta entre varias guardadas y decide bien cuándo alertar. Esta prueba es más exigente porque el modelo tiene que elegir primero la candidata más parecida y luego decidir si avisa.

Antes de estas dos fases se verificó que los cuatro modelos candidatos pudieran ejecutarse y producir vectores válidos (ver sección 2), y después de ellas se compararon costo y manejo de fallos de forma más ligera (caché, tiempos y errores simulados).

**Métricas usadas**, explicadas en términos simples:

- **Accuracy (exactitud):** proporción de decisiones correctas sobre el total de casos evaluados.
- **Precisión:** de las alertas que el modelo emitió, cuántas eran realmente un duplicado.
- **Recall (sensibilidad):** de los duplicados que debían alertarse, cuántos el modelo efectivamente detectó.
- **F1:** combina precisión y recall en un solo número, dándoles el mismo peso.

Un **falso positivo** es una alerta que no correspondía a un duplicado; un **falso negativo** es un duplicado real que no generó alerta. En este dominio, un falso negativo es el error más costoso para el usuario (un duplicado que pasa sin aviso).

## 2. Modelos comparados y viabilidad

Se compararon cuatro modelos multilingües que pueden ejecutarse en CPU:

- **MiniLM** (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`): el más liviano, 384 dimensiones.
- **E5-small** (`intfloat/multilingual-e5-small`): también liviano, 384 dimensiones.
- **DistilUSE** (`sentence-transformers/distiluse-base-multilingual-cased-v2`): 512 dimensiones.
- **BGE-M3** (`BAAI/bge-m3`): el más pesado, 1024 dimensiones.

Los cuatro produjeron vectores válidos (sin valores inválidos, con la dimensión esperada). La siguiente tabla resume el costo de cada uno, medido en una corrida local (macOS, CPU, un modelo por proceso, ocho repeticiones para la latencia):

| Modelo | Dimensión | Latencia mediana | Latencia p95 | Memoria pico | Descarga |
|---|---:|---:|---:|---:|---:|
| MiniLM | 384 | 2,85 ms | 6,07 ms | 690,6 MiB | 129,1 MiB |
| E5-small | 384 | 3,77 ms | 7,65 ms | 684,0 MiB | 129,1 MiB |
| DistilUSE | 512 | 13,57 ms | 15,87 ms | 510,1 MiB | 133,3 MiB |
| BGE-M3 | 1024 | 18,76 ms | 20,70 ms | 1 806,6 MiB | 559,6 MiB |

(El "p95" es el tiempo por debajo del cual estuvo el 95 % de las mediciones; sirve para ver el peor caso típico, no solo el promedio.)

MiniLM fue, de lejos, el más liviano y rápido; BGE-M3 fue el más costoso en memoria y descarga. MiniLM también generó un embedding válido con el acceso a internet deshabilitado (una vez con la caché del modelo ya preparada), lo que confirma que puede operar sin depender de red en cada arranque.

## 3. Fase 1 — Resultados por pares de frases

Se usó un conjunto de 40 pares de calibración y 20 de holdout, en español, balanceados entre pares similares y no similares. El umbral de cada modelo se fijó únicamente con el conjunto de calibración y se aplicó una sola vez al holdout, sin ajustarlo después.

| Modelo | Umbral | Accuracy (holdout) | Precisión | Recall | F1 |
|---|---:|---:|---:|---:|---:|
| MiniLM | 0,676399 | 65 % (13/20) | 63,6 % | 70 % | 66,7 % |
| BGE-M3 | 0,777859 | 65 % (13/20) | 61,5 % | 80 % | 69,6 % |

(En calibración, MiniLM acertó 31/40 y BGE-M3 33/40.)

MiniLM y BGE-M3 empataron en accuracy de holdout; BGE-M3 tuvo algo más de recall a cambio de más falsos positivos. E5-small y DistilUSE también se probaron en este mismo conjunto, pero no alcanzaron el mínimo interno de 75 % de accuracy en calibración (ver sección 1), así que el pipeline no los promovió a holdout. Sus mejores resultados en calibración, con un umbral solo diagnóstico (no de producción):

| Modelo | Umbral diagnóstico | Accuracy (calibración) | Precisión | Recall | F1 |
|---|---:|---:|---:|---:|---:|
| E5-small | 0,892426 | 57,5 % | 54,1 % | 100 % | 70,2 % |
| DistilUSE | 0,448537 | 55 % | 52,6 % | 100 % | 69 % |

Por eso no tienen fila en la tabla de holdout ni se llevaron a la fase 2.

## 4. Fase 2 — Resultados del flujo completo con PostgreSQL

Esta fase simula el caso real: por cada uno de 40 casos de calibración y 20 de holdout, se insertan tres frases "activas" en PostgreSQL, se genera el embedding de una frase nueva, se busca la candidata más parecida con pgvector y se aplica el umbral del modelo para decidir si alertar. La mitad de los casos de cada conjunto debía generar alerta y la otra mitad no. Calibración y holdout no comparten frases, y el umbral de cada modelo se fijó antes de leer los resultados del holdout.

Resultados sobre los 20 casos de holdout (10 con alerta esperada, 10 sin ella):

| Modelo | Umbral | TP | TN | FP | FN | Accuracy | Precisión | Recall | F1 | p95 de `validate()` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| MiniLM | 0,853861 | 2 | 10 | 0 | 8 | 60 % (12/20) | 100 % | 20 % | 33,3 % | 7,81 ms |
| BGE-M3 | 0,922539 | 0 | 10 | 0 | 10 | 50 % (10/20) | — (0 alertas) | 0 % | — | 26,73 ms |

(En calibración, MiniLM acertó 22/40 (55 %) y BGE-M3 20/40 (50 %).)

En los 10 casos positivos del holdout, ambos modelos recuperaron la frase correcta como primera candidata: el problema no fue la búsqueda, sino el umbral de decisión. MiniLM alertó en 2 de los 10 positivos y dejó pasar 8; BGE-M3 no alertó en ninguno. Ningún modelo generó falsos positivos. MiniLM fue, además, unas 3,4 veces más rápido que BGE-M3 en esta prueba (`validate()` incluye buscar la frase, generar su embedding y comparar contra las tres frases activas ya indexadas; no incluye el recorrido HTTP completo de la API).

BGE-M3 no alertó en ningún positivo no porque fallara la ejecución (recuperó bien los 10), sino porque su score de similitud en esos 10 casos fue 0,67–0,88, siempre por debajo de su propio umbral calibrado (0,922539). Con 0 alertas, precisión (TP/(TP+FP)) queda indefinida (0/0, por eso "—") y F1 también; recall sí se calcula (0/10 = 0 %) porque no depende de FP.

## 5. Decisión final

**Se elige MiniLM para implementar el MVP**, con el umbral inicial configurable **`0.8538613695045911`** (el evaluado en la fase 2).

Razones:

- Generó embeddings válidos y es, de lejos, el más liviano y rápido de los cuatro candidatos.
- Igualó o superó a BGE-M3 en el flujo completo con PostgreSQL (12/20 frente a 10/20 en el holdout), con una fracción del costo en tiempo y memoria.
- E5-small y DistilUSE no mostraron ventaja de calidad sobre MiniLM en la fase 1 y no se probaron en el flujo completo por ese motivo.

Esta elección **no equivale a afirmar que el modelo tiene calidad suficiente para producción**. MiniLM quedó por debajo de la antigua meta del 75 % y, en el holdout del flujo, dejó pasar 8 de 10 duplicados reales (recall de 20 %). El umbral más bajo obtenido en la fase 1 (`0.6763989282227754`) no se adopta como valor inicial porque esa prueba no incluyó buscar entre varias frases, que es el caso real de uso. El MVP comunica las alertas como "posibles coincidencias" y deja la decisión final de guardar en manos del usuario.

## 6. Limitaciones y trabajo futuro

- Los conjuntos de datos son pequeños (20-40 casos por fase) y las etiquetas fueron redactadas para el experimento, sin revisión humana independiente.
- En el holdout de fase 2, los scores de BGE-M3 para positivos (0,67-0,88) y negativos (0,68-0,86) se solapan: bajar su umbral no lo arregla limpiamente, solo cambiaría falsos negativos por falsos positivos. MiniLM separó mejor en este holdout porque sus 2 verdaderos positivos más altos quedaron por casualidad por encima de todos sus negativos, no por una ventaja estructural del modelo.
- La meta histórica de 75 % de accuracy ya no es una condición de entrega; no se repitieron pruebas para intentar alcanzarla.
- Una vez consultado, un conjunto de holdout no debe reutilizarse para afirmar una mejora independiente: ajustar el umbral con los mismos datos ya vistos dejaría de ser una evaluación válida.
- Queda pendiente, fuera de esta entrega, comparar más modelos, construir nuevos conjuntos de evaluación o revalidar el umbral con una muestra más grande antes de considerar el sistema listo para producción.
