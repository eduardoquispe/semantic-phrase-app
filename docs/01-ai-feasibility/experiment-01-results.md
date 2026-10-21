# Resultados del Experimento 1 — Viabilidad de embeddings en Node.js

| Campo | Valor |
|---|---|
| Proyecto | Semantic Phrase Validator |
| Fase | 02 — AI Feasibility |
| Experimento | 01 — Viabilidad de embeddings en Node.js |
| Fecha de ejecución | 2026-10-20 (America/Lima) |
| Estado | Criterio técnico cumplido, con observaciones metodológicas |
| Plan de referencia | `docs/01-ai-feasibility/experiment-plan.md` |
| Reporte principal | `experiments/semantic-similarity/results/experiment-01-1792548111607.json` |

## 1. Resumen ejecutivo

Los cuatro candidatos produjeron embeddings finitos, normalizados, deterministas y con la dimensión esperada mediante ejecución local en Node.js, sin depender de Python. Por tanto, el Experimento 1 cumple su criterio de paso técnico.

MiniLM y E5 ofrecieron las menores latencias calientes y un costo operativo parecido. DistilUSE utilizó menos memoria, pero su proyección final de 768 a 512 dimensiones incrementó la latencia. BGE-M3 fue claramente el candidato más costoso en almacenamiento, memoria y tiempo, por lo que necesitaría demostrar una mejora material de calidad en el Experimento 2 para justificar ese costo.

Este experimento no permite escoger un modelo ni un umbral. Los puntajes de similitud de un solo par no miden calidad y no deben compararse directamente entre modelos.

## 2. Entorno y configuración

- Node.js `v22.12.0`.
- macOS Darwin `arm64`.
- Inferencia en CPU con `@huggingface/transformers` `3.8.1` y ONNX.
- Pesos cuantizados `q8`; embeddings resultantes en `float32` y normalizados con L2.
- Ocho iteraciones calientes en la corrida principal.
- Cada modelo se ejecutó en un proceso independiente.
- Caché local en `experiments/semantic-similarity/.cache/huggingface/`.

El modelo exacto del procesador y la memoria física total del equipo no quedaron registrados por el benchmark. Esta información deberá incorporarse antes de usar las cifras como referencia operacional definitiva.

## 3. Corrección detectada durante la ejecución

La primera implementación de DistilUSE devolvía 768 dimensiones y, aun así, el orquestador la marcaba como exitosa. Esa salida correspondía al encoder DistilBERT sin la capa final del modelo Sentence Transformers.

Se corrigió el experimento para:

1. Aplicar mean pooling sin normalización previa.
2. Aplicar la capa Dense oficial `768 → 512`, con activación `tanh`.
3. Normalizar el vector proyectado con L2.
4. Marcar la ejecución como fallida si no cumple dimensión, finitud, norma, determinismo o simetría.

La capa Dense está fijada a la revisión `bfe45d0732ca50787611c0fe107ba278c7f3f889` del repositorio fuente de DistilUSE.

## 4. Validación funcional

| Modelo | Dimensión esperada | Dimensión obtenida | Valores finitos | Norma L2 | Diferencia entre repeticiones | Diferencia de simetría | Resultado |
|---|---:|---:|---|---:|---:|---:|---|
| MiniLM | 384 | 384 | Sí | 1.000000 | 0 | 0 | Passed |
| E5 | 384 | 384 | Sí | 1.000000 | 0 | 0 | Passed |
| DistilUSE | 512 | 512 | Sí | 1.000000 | 0 | 0 | Passed |
| BGE-M3 | 1024 | 1024 | Sí | 1.000000 | 0 | 0 | Passed |

Todos los candidatos cumplen la condición esencial: generar embeddings consistentes desde Node.js sin Python.

## 5. Comparación operacional

### 5.1 Ejecución caliente con artefactos en caché

| Modelo | Carga del modelo | Primera inferencia | Mediana caliente | p95 caliente | Lote de 6 | Tiempo por frase en lote | Δ RSS al cargar | RSS pico |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| MiniLM | 394.418 ms | **7.443 ms** | **2.846 ms** | **6.070 ms** | 14.094 ms | 2.349 ms | 589.7 MiB | 690.6 MiB |
| E5 | 357.591 ms | 9.799 ms | 3.770 ms | 7.651 ms | **13.284 ms** | **2.214 ms** | 588.5 MiB | 684.0 MiB |
| DistilUSE | **139.921 ms** | 17.528 ms | 13.569 ms | 15.869 ms | 74.543 ms | 12.424 ms | **409.8 MiB** | **510.1 MiB** |
| BGE-M3 | 615.758 ms | 28.610 ms | 18.762 ms | 20.698 ms | 84.239 ms | 14.040 ms | 1,710.1 MiB | 1,806.6 MiB |

La negrita identifica el mejor valor observado por columna cuando la comparación es favorable.

Interpretación:

- MiniLM fue el más rápido en inferencia individual caliente.
- E5 fue ligeramente mejor procesando el lote de seis frases.
- MiniLM y E5 tuvieron un consumo de memoria prácticamente equivalente en esta ejecución.
- DistilUSE tuvo la menor memoria observada, pero la proyección Dense ejecutada en JavaScript elevó su latencia.
- BGE-M3 utilizó aproximadamente 2.6 veces el RSS pico de MiniLM y tuvo la mayor latencia.
- Incluso el p95 más alto observado, 20.698 ms para BGE-M3, queda muy por debajo del objetivo de cinco segundos. Esto valida solamente la inferencia caliente aislada, no el flujo completo con API y base de datos.

### 5.2 Descarga inicial y almacenamiento

| Modelo | Descarga observada | Tiempo inicial observado | Observación |
|---|---:|---:|---|
| MiniLM | 129.1 MiB | 5,958.457 ms | Incluye descarga y construcción del pipeline. |
| E5 | 129.1 MiB | 5,276.215 ms | Incluye descarga y construcción del pipeline. |
| DistilUSE | 133.3 MiB | 6,292.942 ms para el encoder base | La capa Dense de 1.5 MiB se incorporó después; no existe una medición fría corregida y directamente comparable. |
| BGE-M3 | 559.6 MiB | 21,142.456 ms | Incluye descarga y construcción del pipeline. |

El caché conjunto ocupó 951.2 MiB. BGE-M3 representó cerca del 59 % del total descargado.

Los tiempos de esta sección no separan tiempo de red y tiempo de inicialización. Sirven como evidencia de preparación inicial en este equipo y conexión, pero no como benchmark puro de arranque en frío.

## 6. Comparación por criterio

| Criterio | MiniLM | E5 | DistilUSE | BGE-M3 |
|---|---|---|---|---|
| Compatibilidad con Node.js | Cumple | Cumple | Cumple con proyección explícita | Cumple |
| Dimensión de almacenamiento | Baja, 384 | Baja, 384 | Media, 512 | Alta, 1024 |
| Latencia caliente | Mejor observada | Muy cercana a MiniLM | Intermedia | Mayor |
| Memoria | Intermedia | Intermedia | Menor observada | Muy alta |
| Tamaño descargado | Bajo | Bajo | Bajo | Muy alto |
| Complejidad de integración | Baja | Baja; exige prefijo | Mayor; exige proyección | Baja, con costo operacional alto |
| Calidad semántica | No evaluada | No evaluada | No evaluada | No evaluada |

## 7. Respuestas que aporta el experimento

1. **¿Puede Node.js generar embeddings reproducibles para frases cortas en español?** Sí. Los cuatro candidatos generaron vectores finitos, normalizados y deterministas.
2. **¿Cumplen la inferencia aislada y caliente el objetivo normal de cinco segundos?** Sí, con amplio margen en este equipo. Todavía falta medir el flujo completo.
3. **¿Son razonables los costos para el MVP?** MiniLM, E5 y DistilUSE son candidatos operativamente viables para continuar. BGE-M3 es viable técnicamente, pero su costo necesita justificación por calidad.
4. **¿Conviene inferencia local o un servicio externo?** La inferencia local es suficientemente viable para continuar como línea base. La decisión definitiva requiere calidad, concurrencia y pruebas de fallos.

## 8. Preguntas que permanecen abiertas

Este experimento no responde:

- Qué modelo separa mejor duplicados semánticos de frases relacionadas.
- Qué umbral debe utilizarse.
- Si se alcanza al menos 80 % de accuracy sobre el holdout.
- Cuáles son los falsos positivos y falsos negativos relevantes.
- Si JavaScript y pgvector producen resultados equivalentes.
- Cuál es la latencia del flujo completo o bajo concurrencia.

## 9. Limitaciones y acciones pendientes

- El p95 procede de solo ocho iteraciones y debe considerarse exploratorio.
- La descarga y la inicialización no se midieron por separado.
- No existe una corrida fría corregida de DistilUSE comparable con los otros modelos.
- No se registraron modelo de CPU, memoria física ni estado de carga del equipo.
- Las revisiones exactas de los artefactos ONNX `Xenova/*` todavía no están fijadas en la configuración; solo está fijada la proyección de DistilUSE.
- Las cifras corresponden a una sola máquina y no representan todavía el entorno futuro de despliegue.

Estas limitaciones no invalidan la viabilidad técnica, pero deben resolverse antes de convertir las mediciones operacionales en compromisos del producto.

## 10. Decisión

**El Experimento 1 queda aprobado respecto de su criterio de paso:** los cuatro modelos producen embeddings finitos y consistentes localmente desde Node.js, sin Python.

Los cuatro candidatos pueden pasar al Experimento 2 para que la calidad determine si el mayor costo de alguno está justificado. No se selecciona todavía un ganador ni un umbral.

De acuerdo con el plan aprobado, el siguiente paso requiere presentar y aprobar la propuesta concreta del Experimento 2 antes de implementar el conjunto etiquetado, la calibración o el holdout.
