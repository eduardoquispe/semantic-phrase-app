# Plan de experimentación — AI Feasibility

| Campo | Valor |
|---|---|
| Proyecto | Semantic Phrase Validator |
| Fase | 02 — AI Feasibility |
| Documento | Plan de experimentación |
| Estado | Aprobado para iniciar el Experimento 1 |
| Metodología | AI-First / Human-in-the-Loop |
| Fecha | 2026-10-20 |

## 1. Contexto y fuentes

Este plan deriva de los requisitos aprobados en:

- `docs/00-discovery/product-brief.md`
- `docs/00-discovery/reto-tecnico.md`

> Nota: la referencia inicial a `docs/00-discovery/reto-original.md` no corresponde a un archivo existente en el repositorio. Se utiliza `docs/00-discovery/reto-tecnico.md`, que además figura como fuente oficial en el Product Brief.

No se asumirán resultados, umbrales ni selecciones tecnológicas antes de ejecutar y analizar los experimentos correspondientes.

## 2. Hipótesis que debemos validar

La fase debe producir evidencia para responder:

1. ¿Puede Node.js generar embeddings reproducibles para frases cortas en español?
2. ¿Qué modelo separa mejor duplicados semánticos de frases solamente relacionadas?
3. ¿Qué umbral ofrece un equilibrio aceptable entre falsos positivos y falsos negativos?
4. ¿Los resultados calculados en JavaScript coinciden con PostgreSQL y pgvector?
5. ¿La inferencia y la búsqueda cumplen el objetivo normal de cinco segundos?
6. ¿El consumo de memoria, el tamaño del modelo y el tiempo de arranque son razonables para el MVP?
7. ¿Conviene ejecutar la inferencia localmente en Node.js o consumir un servicio externo?

La exactitud mínima vigente es 75 % sobre al menos 20 pares equilibrados, conforme a `SC-003` y `DEC-019` del Product Brief. Sin embargo, 20 pares no son suficientes para seleccionar de manera confiable un umbral.

## 3. Modelos candidatos iniciales

Se compararán inicialmente cuatro modelos, sin seleccionar todavía un ganador:

| Modelo | Dimensión esperada | Papel en la evaluación | Observaciones |
|---|---:|---|---|
| `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | 384 | Candidato principal ligero | Entrenado para similitud de oraciones, soporta 50 idiomas y usa licencia Apache-2.0. Existe una conversión ONNX disponible. |
| `intfloat/multilingual-e5-small` | 384 | Candidato competitivo | Multilingüe y compacto. Requiere respetar sus prefijos; para similitud simétrica recomienda `query:` en ambos textos. Sus puntajes necesitan calibración propia. |
| `sentence-transformers/distiluse-base-multilingual-cased-v2` | 512 | Línea base madura e intermedia | Está orientado a embeddings de oraciones, soporta más de 50 idiomas y permite comparar un modelo consolidado de costo medio. |
| `BAAI/bge-m3` | 1024 | Candidato de mayor capacidad | Soporta más de 100 idiomas y recuperación densa, sparse y multi-vector. En esta fase solo se evaluará su embedding denso normalizado; su mayor tamaño, memoria y latencia deben justificarse con resultados. |

Referencias:

- [Model card de paraphrase-multilingual-MiniLM-L12-v2](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2)
- [Model card de multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small)
- [Model card de distiluse-base-multilingual-cased-v2](https://huggingface.co/sentence-transformers/distiluse-base-multilingual-cased-v2)
- [Model card de BGE-M3](https://huggingface.co/BAAI/bge-m3)
- [Conversión ONNX de BGE-M3 para Transformers.js](https://huggingface.co/Xenova/bge-m3)

La línea base propuesta es inferencia local con `@huggingface/transformers` y ONNX. La librería soporta inferencia server-side en Node.js mediante `onnxruntime-node` y permite controlar el pooling y la normalización.

- [Inferencia server-side en Node.js](https://huggingface.co/docs/transformers.js/main/tutorials/node)
- [Backend ONNX de Transformers.js](https://huggingface.co/docs/transformers.js/api/backends/onnx)

La compatibilidad real de cada modelo, su revisión exacta, el pooling y la cuantización forman parte del primer experimento; no se consideran validados de antemano.

## 4. Conjunto de evaluación propuesto

Se prepararán 60 pares etiquetados:

- 30 similares.
- 30 no similares.
- 40 destinados a calibración.
- 20 reservados como holdout final, sin utilizarlos para seleccionar el umbral.

Los pares cubrirán:

- Paráfrasis con vocabulario distinto.
- Reordenamiento y variaciones gramaticales.
- Sinónimos y expresiones propias del español.
- Mismo tema, pero diferente intención.
- Negaciones y significados opuestos.
- Cambios de números, cantidades, personas o lugares.
- Frases ambiguas.
- Acentos y puntuación.
- Casos de bajo solapamiento léxico.
- *Hard negatives*: frases muy parecidas en palabras, pero diferentes en significado.

Las coincidencias idénticas después de normalizar mayúsculas y espacios se excluirán de la métrica semántica, porque el producto las resuelve mediante lógica determinista.

Las etiquetas humanas serán revisables. El conjunto será presentado para aprobar la verdad de referencia antes de utilizarlo para calibrar o comparar modelos.

## 5. Plan de experimentación

### 5.1 Experimento 1 — Viabilidad de embeddings en Node.js

**Objetivo:** verificar que cada candidato puede ejecutarse correctamente desde Node.js.

Mediciones:

- Carga y descarga efectiva del modelo.
- Dimensión y norma de los embeddings.
- Determinismo aproximado entre ejecuciones.
- Simetría de la similitud coseno.
- Tiempo de descarga y arranque en frío, reportados por separado.
- Latencia caliente por frase y por lote.
- Memoria RSS antes y después de cargar el modelo.
- Tamaño de los artefactos almacenados.
- Impacto de cuantización, si está disponible.
- Requisitos particulares de pooling, normalización y prefijos.

**Criterio de paso:** producir embeddings finitos y consistentes desde Node.js, sin depender de Python.

### 5.2 Experimento 2 — Calidad semántica y calibración

Para cada modelo:

1. Generar embeddings para el conjunto etiquetado.
2. Calcular similitud coseno.
3. Barrer umbrales sobre el conjunto de calibración.
4. Seleccionar umbrales candidatos sin consultar el holdout.
5. Evaluar una sola vez sobre el holdout.

Métricas:

- Accuracy.
- Precision, recall y F1 para la clase `similar`.
- Matriz de confusión.
- Falsos positivos y falsos negativos concretos.
- Distribución de puntajes por clase.
- Margen entre casos similares y no similares.
- Umbral elegido y sensibilidad a pequeñas variaciones.

Además del mínimo vigente de 75 % de accuracy, se priorizará el recall de duplicados: un falso negativo puede permitir guardar un duplicado si el usuario pulsa **Guardar** después de validar, mientras que un falso positivo activa la revisión HITL. No se maximizará recall sin límite, porque demasiadas advertencias degradarían la utilidad del sistema.

### 5.3 Experimento 3 — Persistencia y búsqueda con pgvector

Validaciones:

- Persistir embeddings usando la dimensión real del modelo.
- Recuperarlos sin corrupción apreciable.
- Comparar el coseno calculado en JavaScript con `1 - (embedding <=> query)`.
- Verificar que JavaScript y PostgreSQL devuelvan la misma candidata top-1.
- Filtrar correctamente las frases no activas.
- Resolver empates con un criterio determinista.
- Medir consultas exactas con corpus de 100, 1 000 y 10 000 vectores.

pgvector soporta distancia coseno y búsqueda exacta y aproximada. Los índices aproximados pueden sacrificar recall, por lo que no se asumirá HNSW para el MVP hasta demostrar que una búsqueda exacta resulta insuficiente.

- [Documentación oficial de pgvector](https://github.com/pgvector/pgvector/blob/master/README.md)

Si se prueba HNSW, se medirá explícitamente `recall@1` contra la búsqueda exacta.

### 5.4 Experimento 4 — Rendimiento operacional

Escenarios:

- Primera inferencia con el modelo descargado.
- Inferencias calientes secuenciales.
- Lotes de embeddings.
- Concurrencia controlada.
- Búsqueda pgvector por tamaño del corpus.
- Flujo completo: embedding más consulta.
- Frases cercanas al máximo de 280 caracteres.
- Entradas Unicode, acentos y puntuación.

Se reportarán mediana, p95, máximo, memoria pico y condiciones del equipo. El objetivo de cinco segundos se evaluará sobre el flujo caliente normal. El tiempo de descarga inicial quedará documentado como requisito de instalación o preparación.

### 5.5 Experimento 5 — Fallos y alternativas

Se comprobarán:

- Modelo ausente o descarga incompleta.
- Ejecución sin red después de haber cacheado el modelo.
- Embeddings inválidos.
- Timeout.
- PostgreSQL o pgvector no disponible.
- Incompatibilidad entre la dimensión almacenada y el modelo.
- Cambio de modelo o revisión.

Alternativas si la inferencia local no resulta viable:

1. Hugging Face Inference Endpoint o API.
2. Servicio aislado de inferencia en Python, manteniendo el backend principal en Node.js.
3. Modelo multilingüe más pequeño.
4. Búsqueda exacta sin índice vectorial para el volumen del MVP.
5. Estrategia híbrida textual más embeddings, manteniendo separados los resultados semánticos.

## 6. Criterios para seleccionar el modelo

La decisión no dependerá solamente del accuracy. Se considerarán:

- Calidad sobre el holdout.
- Recall y F1 de duplicados.
- Naturaleza de los errores.
- Latencia p95.
- Memoria pico.
- Tamaño y tiempo de arranque.
- Compatibilidad estable con Node.js.
- Complejidad de uso.
- Licencia y reproducibilidad.
- Dimensión y costo de persistencia.

Se fijarán el identificador y la revisión exacta del modelo. La metadata futura debería conservar, como mínimo, modelo, revisión, dimensión, estrategia de pooling y normalización, y versión del pipeline. Embeddings generados con configuraciones diferentes no deben mezclarse silenciosamente.

## 7. Riesgos principales

- Sobreajuste del umbral si se calibra y evalúa sobre los mismos 20 pares.
- Etiquetas humanas ambiguas.
- Puntajes no comparables entre modelos.
- Diferencias causadas por prefijos, pooling, normalización o cuantización.
- Confundir la primera descarga con la latencia normal.
- Consumo de memoria del runtime ONNX.
- Falsos negativos en negaciones, números y entidades.
- Acoplamiento del esquema `vector(n)` a un modelo determinado.
- Pérdida de recall al introducir índices aproximados prematuramente.
- Resultados dependientes del hardware y de la revisión del modelo.

## 8. Alcance aprobado para el primer experimento

Se aprueba comenzar con la siguiente configuración:

- Inferencia local en Node.js como línea base.
- Los cuatro modelos candidatos indicados.
- Conjunto de 60 pares en español, dividido en 40 para calibración y 20 para holdout.
- Embeddings `float32` normalizados.
- Sin PostgreSQL durante el Experimento 1.
- Sin seleccionar todavía un umbral o modelo ganador.
- Todo el código experimental quedará aislado en `experiments/semantic-similarity/`.

Los experimentos posteriores requieren una nueva propuesta y aprobación antes de su implementación.
