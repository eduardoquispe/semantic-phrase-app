# Experimento 1 — Embeddings en Node.js

Este directorio contiene código experimental aislado para validar la ejecución local de cuatro modelos multilingües mediante Transformers.js y ONNX.

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
