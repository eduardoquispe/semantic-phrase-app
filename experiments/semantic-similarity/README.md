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

## Experimento 2 — Calidad y calibración

La propuesta metodológica está en `docs/01-ai-feasibility/experiment-02-proposal.md`. Los datos se separan en 40 pares de calibración y 20 de holdout. Mientras su campo `status` sea `pending_ground_truth_approval`, los comandos que generan embeddings se detendrán antes de cargar un modelo.

Validar estructura, balance y separación de los datos:

```bash
npm run dataset:validate
npm test
```

Después de la aprobación humana de textos, etiquetas y particiones, ambos archivos deben cambiar a `"status": "approved"`. Solo entonces puede ejecutarse la calibración:

```bash
npm run calibrate
```

El mínimo vigente es 75 % de accuracy en calibración y en holdout. Para recalcular la selección con puntajes ya guardados, sin volver a inferir ni puntuar el holdout, use:

```bash
npm run calibrate -- --from-report results/experiment-02-calibration-<timestamp>.json
```

El nuevo manifiesto conserva los hashes de ambas particiones y la ruta del reporte fuente. Los manifiestos creados con el mínimo histórico de 80 % se mantienen como evidencia, pero el runner final los rechaza.

El comando produce un manifiesto en `results/` con los hashes de ambas particiones y los umbrales congelados. La evaluación final requiere ese archivo y una confirmación deliberada:

```bash
npm run holdout -- --manifest results/experiment-02-calibration-<timestamp>.json --confirm-final
```

El holdout no debe ejecutarse más de una vez ni utilizarse para reajustar umbrales, etiquetas o configuración. Si se necesita iterar después de abrirlo, se debe crear un holdout nuevo.

El holdout de este conjunto se ejecutó el 2026-10-20 con el manifiesto `results/experiment-02-calibration-1792554852198.json`. El resultado está en `results/experiment-02-holdout-1792554957505.json` y su resumen versionable en `docs/01-ai-feasibility/experiment-02-results.md`. No vuelva a ejecutar `npm run holdout` sobre esta partición.

## Conjunto v2 evaluado

`data/v2/` contiene 40 pares de calibración y 20 de holdout basados en DEC-020. El usuario aprobó sus etiquetas y justificaciones antes de la calibración. Puede validar su estructura sin ejecutar modelos:

```bash
npm run dataset:validate -- --dataset-dir data/v2
```

Ambos archivos tienen estado `"approved"`. La calibración nueva se ejecutó con:

```bash
npm run calibrate -- --dataset-dir data/v2
```

El manifiesto `results/experiment-02-calibration-1792555544459.json` incluye `datasetDirectory: "data/v2"`. MiniLM y BGE-M3 fueron elegibles en calibración. El holdout v2 se ejecutó una sola vez el 2026-10-20: ambos obtuvieron 65 % y fueron rechazados. El resultado JSON está en `results/experiment-02-holdout-1792555624880.json` y el reporte versionable en `docs/01-ai-feasibility/experiment-02-v2-results.md`. No vuelva a ejecutar `npm run holdout` con ese manifiesto.
