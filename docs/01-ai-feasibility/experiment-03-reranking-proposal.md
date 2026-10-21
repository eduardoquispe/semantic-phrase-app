# Experimento 3 — Recuperación y reranking de posibles duplicados

| Campo | Valor |
|---|---|
| Etapa | AI Feasibility |
| Estado | Propuesta; sin dataset nuevo aprobado ni evaluación final |
| Motivo | Los embeddings solos obtuvieron 65 % en el holdout v2 |
| Criterio de producto | DEC-020: advertir sobre posibles duplicados, con decisión humana |

## Hipótesis

Una búsqueda por embeddings seguida de un modelo que evalúe cada par puede distinguir mejor las paráfrasis, las negaciones y las intenciones diferentes. Es una hipótesis por medir; los holdouts v1 y v2 ya fueron consumidos y no acreditan esta combinación.

## Flujo candidato

1. La comparación textual normalizada mantiene su prioridad y su puntaje determinista de 100 %.
2. Si no hay coincidencia textual, el modelo de embeddings calcula la similitud entre la frase nueva y las frases activas, y recupera los `k` mejores candidatos. `k` y cualquier umbral de recuperación se eligen solo en calibración.
3. Un segundo modelo evalúa cada par `(frase nueva, candidata)` según DEC-020. Se compararán un reranker especializado y un LLM juez con salida estructurada; el prompt y los ejemplos few-shot del juez se fijarán antes del holdout.
4. Se presenta una sola candidata: la mejor que supere el umbral del reranker o reciba una decisión positiva del juez, según la variante evaluada. Si ninguna lo supera, se habilita Guardar tras la validación. Se conservan el puntaje de embeddings y el resultado de la segunda etapa con nombres distintos; no se presenta un juicio generado como porcentaje calibrado de duplicado.
5. Si falla cualquier etapa necesaria, se conserva el texto y se permite reintentar, sin habilitar el guardado.

Las reglas léxicas del prototipo `relation-guard.mjs` no forman parte de esta configuración. Si se quisieran combinar, constituirían una variante adicional que se debe congelar y evaluar por separado.

## Modelos candidatos

| Etapa | Candidato | Papel y condición |
|---|---|---|
| Recuperación | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Primera opción de costo operativo; ya se ejecutó en el experimento anterior. Su recall@k aún no se ha medido. |
| Recuperación | `BAAI/bge-m3` | Alternativa de mayor capacidad, ya ejecutada. Se conserva solo si mejora la recuperación lo suficiente para justificar memoria y latencia. |
| Reranking | `BAAI/bge-reranker-v2-m3` | Primer candidato multilingüe de pares. Existe un [artefacto ONNX para Transformers.js](https://huggingface.co/onnx-community/bge-reranker-v2-m3-ONNX); hay que verificar puntuación de pares, tiempo y memoria en Node.js. [Modelo original](https://huggingface.co/BAAI/bge-reranker-v2-m3). |
| Reranking con instrucción | `Qwen/Qwen3-Reranker-0.6B` | Candidato para expresar la regla específica del producto: mismo asunto y gestión aunque cambie un detalle, pero no acciones opuestas. Su [versión ONNX](https://huggingface.co/onnx-community/Qwen3-Reranker-0.6B-ONNX) indica Transformers.js v4, mientras el experimento actual usa v3.8.1; requiere una prueba de compatibilidad, memoria y latencia. Instrucción no equivale automáticamente a few-shot: añadir ejemplos al prompt sería otra variante congelada. [Modelo original](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B). |
| Baseline de ranking | `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1` | Comparación multilingüe más pequeña, entrenada para relevancia de recuperación. Debe comprobarse si su puntaje sirve para «posible duplicado», una tarea distinta, y si el artefacto ONNX funciona con el runtime actual. [Modelo](https://huggingface.co/cross-encoder/mmarco-mMiniLMv2-L12-H384-v1). |
| Diagnóstico de contradicción | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` | Modelo NLI multilingüe con [artefacto ONNX para Transformers.js](https://huggingface.co/onnx-community/multilingual-MiniLMv2-L6-mnli-xnli-ONNX). Puede ayudar a estudiar negaciones y acciones opuestas, pero una fecha distinta también puede ser una contradicción lógica y seguir siendo un posible duplicado según DEC-020. No se usa como clasificador directo sin calibración. |
| LLM juez | Modelo generativo por seleccionar | Recibirá criterios de DEC-020 y ejemplos congelados; responderá `posible_duplicado: sí/no` para cada par. Se medirá contra el reranker con el mismo top-k. Falta elegir modelo y modo local o servicio según costo, latencia y disponibilidad. |

La comparación principal será MiniLM y BGE-M3 como recuperadores, y un reranker especializado frente a un LLM juez como segunda etapa. BGE Reranker v2 M3 es el primer reranker a probar; Qwen3 Reranker 0.6B es una alternativa con instrucción si supera la prueba técnica. mMiniLM aporta una referencia de ranking más ligera y NLI un diagnóstico de contradicción. Ninguno está acreditado para este caso de uso: un puntaje de relevancia o inferencia lógica no es una probabilidad calibrada de duplicado.

## Datos y evaluación

Los pares v2 de calibración pueden servir para desarrollar la segunda etapa y comparar configuraciones. El holdout v2 solo sirve para diagnóstico histórico; no se vuelve a utilizar para seleccionar modelo, prompt, `k` o umbrales. Los 40 pares de calibración v2 tampoco miden recuperación top-k, porque cada ejemplo contiene únicamente dos frases.

Se preparará un conjunto nuevo de consultas. Cada consulta tendrá una frase nueva, un pequeño corpus de candidatas activas, la candidata o candidatas que merecen advertencia y casos sin duplicado. Incluirá variaciones de detalles, paráfrasis con poco vocabulario compartido, acciones opuestas, negaciones e intenciones distintas sobre el mismo tema. Las familias de casos y los textos no se repetirán entre calibración y holdout. Las etiquetas y particiones se revisarán antes de generar puntajes.

En calibración se medirán y elegirán, en este orden:

1. **Recuperación:** recall@k de candidatas que merecen advertencia y comportamiento de consultas sin duplicado. Si la candidata correcta no llega al top-k, el reranker no puede recuperarla.
2. **Segunda etapa:** calidad de clasificación por par y calidad de la candidata elegida dentro del top-k para reranker y LLM juez, con atención a falsos positivos de acciones opuestas e intenciones diferentes.
3. **Flujo completo:** accuracy por consulta, precision, recall y F2 de advertencias, y latencia total de la validación. Se comparará contra el baseline de embeddings sin reranker en el mismo conjunto.

Antes del holdout se congelarán el corpus, los textos, las etiquetas, los identificadores y revisiones de los modelos, `k`, el prompt y ejemplos del juez, los umbrales aplicables, el desempate y la selección del resultado. Un manifiesto registrará hashes y configuración. El holdout nuevo se ejecutará una sola vez, sin reajustes posteriores. Se exigirá al menos 75 % de accuracy sobre al menos 20 consultas equilibradas y se comprobará el objetivo normal de respuesta de 5 segundos. Un acierto marginal sobre una muestra pequeña se comunicará con su incertidumbre, sin presentarlo como garantía de producción.

## Ajuste pendiente del contrato de producto

El Product Brief vigente habla del «mayor puntaje semántico» y de una sola candidata. Con una segunda etapa, la candidata presentada seguirá siendo una sola, pero puede no ser la de mayor coseno: la decidirá el reranker o el LLM juez de la variante seleccionada. Antes de implementar el flujo de producto se deben actualizar BR-009, AFR-004/005 y AC-005 para definir qué puntaje se muestra y qué condición decide la advertencia. El requisito de usar embeddings de Hugging Face permanece.

## Próximo entregable

Preparar el dataset nuevo de consultas y corpus con etiquetas y justificaciones para revisión humana. Después de su aprobación, implementar el evaluador de recuperación y reranking, calibrar y congelar la configuración antes de abrir el holdout.
