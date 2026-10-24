# Experimentos de similitud semántica

Este directorio contiene código experimental aislado para validar la ejecución local y la calidad de cuatro modelos multilingües mediante Transformers.js y ONNX.

No contiene código del backend o frontend del producto.

## Modelos

- `minilm`: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- `e5`: `intfloat/multilingual-e5-small`
- `distiluse`: `sentence-transformers/distiluse-base-multilingual-cased-v2`
- `bge_m3`: `BAAI/bge-m3`

Las variantes `Xenova/*` se utilizan como artefactos ONNX compatibles con Transformers.js. El identificador del modelo fuente y el del artefacto de ejecución se registran por separado.

## Ejecución

Requisitos: Node.js 22 o posterior y conexión a internet durante la primera descarga.

```bash
npm install
npm run models
npm run benchmark
```

Para una comprobación rápida con menos iteraciones calientes:

```bash
npm run benchmark:quick
```

Los pesos se almacenan en `.cache/huggingface/` y los resultados JSON en `results/`. Ambos se excluyen de Git.

## Experimento 5 — Fallos y ejecución sin red

Con MiniLM ya descargado en la caché, la sonda prueba tres condiciones: caché vacía, caché incompleta y carga local sin red. Deshabilita explícitamente el acceso remoto; los dos primeros casos deben fallar y el tercero producir un embedding finito de 384 dimensiones.

```bash
npm run failure:offline
npm test
```

La [decisión de modelo](../../docs/01-ai-feasibility/model-decision.md) resume la evidencia útil para el MVP, incluidas las pruebas con PostgreSQL real.

## Alcance de las métricas

- Tiempo de carga del pipeline.
- Primera inferencia después de cargarlo.
- Latencias calientes por frase.
- Inferencia en un lote de seis frases.
- RSS y máximo RSS del proceso.
- Tamaño de la caché.
- Dimensión, finitud y norma del embedding.
- Diferencia entre inferencias repetidas.
- Simetría de la similitud coseno.

La primera ejecución puede incluir descarga. Las siguientes reutilizan la caché y permiten observar la carga caliente desde disco. No se comparan calidad, umbrales ni pgvector en este experimento.

## Decisiones metodológicas

- Se utiliza `q8` para la primera prueba de viabilidad en CPU. El embedding resultante continúa representándose como `float32` y se normaliza con L2.
- MiniLM, E5 y DistilUSE usan mean pooling.
- DistilUSE aplica además su capa Dense oficial de 768 a 512 dimensiones con activación `tanh`, antes de normalizar.
- BGE-M3 usa CLS pooling.
- E5 antepone `query: ` a ambos textos porque la tarea es similitud simétrica.
- Cada modelo corre en un proceso separado para aislar mejor memoria y fallos.

## Evaluaciones anteriores de pares

Los conjuntos y evaluadores de pares permanecen en `data/` y `src/`. Sus holdouts ya fueron consultados y no se reutilizarán para afirmar una mejora. La [decisión de modelo](../../docs/01-ai-feasibility/model-decision.md) registra los resultados necesarios para elegir MiniLM en el MVP; la comparación de más modelos queda fuera de esta entrega.

## Prototipo del flujo con PostgreSQL y pgvector

El prototipo en `src/flow-prototype.mjs` y `src/flow-store.mjs` prueba el recorrido de validación por modelo. Requiere PostgreSQL con la extensión pgvector. El esquema aislado se encuentra en `sql/flow-prototype.sql`; las tablas `prototype_*` no son el esquema final de la aplicación.

Para levantar una base local de prueba con Docker:

```bash
docker compose -f compose.flow.yml up -d --wait
export DATABASE_URL=postgres://flow:flow@localhost:55432/semantic_flow_test
npm run flow -- init
npm run flow -- add --text "Olvidé mi contraseña y necesito entrar"
npm run flow -- add --text "Mañana lloverá en Lima"
npm run flow -- index --model minilm
npm run flow -- index --model bge_m3
npm run flow -- validate --model minilm --threshold 0.70 --text "Necesito recuperar el acceso"
npm run flow -- validate --model bge_m3 --threshold 0.70 --text "Necesito recuperar el acceso"
```

`0.70` es solo un valor de ejemplo para probar el comando; **no es un umbral calibrado ni aprobado**. El comando exige un umbral explícito. `add` crea una frase activa, `index` genera los embeddings pendientes para un modelo y `deactivate --id N` la excluye de búsquedas futuras. Al añadir frases nuevas se debe volver a ejecutar `index` para cada modelo. La validación es de solo lectura y nunca guarda la frase nueva. El resultado incluye candidata, puntaje (`1 - distancia coseno`), método textual o semántico, alerta, versión de configuración del embedding, fecha y tiempos de comprobación del corpus, inferencia, búsqueda y total. Estos tiempos se miden después de cargar el modelo en el proceso; la carga inicial debe medirse aparte si se evalúa el arranque en frío.

La coincidencia textual normalizada tiene prioridad y puntaje 1; si no existe, pgvector ordena por distancia coseno exacta y desempata por `id` ascendente. Solo participan frases activas con embeddings de la versión y dimensión del modelo solicitado. Si falta algún embedding activo, la búsqueda semántica falla explícitamente para evitar un resultado incompleto. No se mezclan los vectores de 384 dimensiones de MiniLM con los de 1024 de BGE-M3. La versión registrada identifica modelo de ejecución, cuantización, pooling y normalización; al cambiar pesos o tokenizador se debe cambiar esa versión y reindexar.

Para comprobar el SQL contra la base aislada:

```bash
export PGVECTOR_TEST_URL=postgres://flow:flow@localhost:55432/semantic_flow_test
npm run test:flow-db
```

La prueba de integración vacía las tablas `prototype_*` de esa base y usa embeddings sintéticos para comprobar recuperación, separación de modelos, empates, coincidencia textual y exclusión de eliminadas. Las pruebas unitarias se ejecutan con `npm test`.

## Evaluación completa de frases nuevas

Los conjuntos nuevos están en `data/flow/calibration.json` (40 casos) y `data/flow/holdout.json` (20 casos). Cada registro contiene la frase nueva, tres frases activas identificadas, la alerta esperada, la clave de la frase pertinente si existe, una categoría y una justificación. Las familias y los textos de ambas particiones son disjuntos. Los casos negativos incluyen acciones opuestas, negaciones y otras intenciones. Las etiquetas fueron creadas para esta prueba y constan como `labeled`.

`src/evaluate-flow-dataset.mjs` vacía las tablas experimentales por caso, inserta exactamente las mismas frases activas para ambos modelos, genera e indexa sus embeddings por separado y llama a `createFlow.validate`. La calibración examina todos los cortes posibles entre puntajes y maximiza decisiones correctas; si hay empate, minimiza falsos positivos, luego falsos negativos y elige el umbral más alto. El manifiesto guarda hashes de ambos conjuntos y ambos umbrales. La fase holdout verifica el manifiesto, comprueba que no haya familias ni textos compartidos y solo permite crear un resultado final. No se reutilizan los holdouts históricos de pares.

Para una evaluación nueva, con una base local aislada y sin los archivos `results/flow-*.json` de esta corrida:

```bash
docker compose -f compose.flow.yml up -d --wait
export DATABASE_URL=postgres://flow:flow@localhost:55432/semantic_flow_test
npm run flow:calibrate
npm run flow:holdout
```

La corrida del 2026-10-21 ya consumió el holdout. Los resultados principales están en la [decisión de modelo](../../docs/01-ai-feasibility/model-decision.md); los JSON detallados están en `results/`, excluido de Git. Los tiempos reportados corresponden a `validate` con el modelo cargado y las frases activas ya indexadas; no incluyen carga inicial, inserción ni indexación.
