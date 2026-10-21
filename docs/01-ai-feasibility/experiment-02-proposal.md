# Propuesta del Experimento 2 — Calidad semántica y calibración

| Campo | Valor |
|---|---|
| Proyecto | Semantic Phrase Validator |
| Fase | 02 — AI Feasibility |
| Experimento | 02 — Calidad semántica y calibración |
| Estado | Protocolo ejecutado; holdout final rechazó al único candidato |
| Fecha de propuesta | 2026-10-20 |
| Fecha de aprobación del protocolo | 2026-10-20 |
| Enmienda de calidad | 2026-10-20: mínimo 75 % por DEC-019 |
| Plan de referencia | `docs/01-ai-feasibility/experiment-plan.md` |
| Entrada técnica | `docs/01-ai-feasibility/experiment-01-results.md` |

## 1. Decisión y alcance

El protocolo se aprobó para construir y revisar el conjunto etiquetado, calibrar un umbral independiente para cada modelo y ejecutar una única evaluación final sobre el holdout. DEC-019 cambió posteriormente el mínimo de accuracy a 75 %.

La calibración identificó un único candidato, MiniLM, con umbral `0.6772555477949693`. Sus resultados se registran en `docs/01-ai-feasibility/experiment-02-calibration-results.md`. El holdout se ejecutó una sola vez y obtuvo 50 % de accuracy, por lo que se rechazó la combinación. Los resultados finales se registran en `docs/01-ai-feasibility/experiment-02-results.md`; el holdout no debe utilizarse para reajustar el umbral ni las etiquetas.

## 2. Objetivo y preguntas

El experimento determinará:

1. Qué modelo separa mejor frases que deberían activar una advertencia de posible duplicado de frases que no deberían activarla.
2. Qué umbral necesita cada modelo, sin asumir que sus escalas de similitud son comparables.
3. Si la combinación de modelo y umbral alcanza al menos 75 % de accuracy sobre 20 pares de holdout equilibrados.
4. Qué falsos positivos y falsos negativos produce cada alternativa y si son aceptables para el flujo Human-in-the-Loop.
5. Si una mejora de calidad de DistilUSE o BGE-M3 justifica su mayor costo operacional observado en el Experimento 1.

## 3. Definición de la etiqueta

La unidad evaluada será un par de frases cortas en español.

- `similar`: ambas frases expresan esencialmente la misma intención o proposición y sería razonable advertir al usuario que podría estar registrando un duplicado.
- `not_similar`: las frases no son intercambiables como registro, aunque compartan tema, vocabulario o estructura.

La etiqueta representa el comportamiento deseado del producto, no solamente cercanía lingüística. Una relación temática no basta para marcar un par como `similar`.

Reglas de etiquetado:

- Un cambio de redacción, orden, tiempo verbal no esencial o sinónimo puede conservar la etiqueta `similar`.
- Negaciones, cantidades, personas, lugares, objetos o intenciones distintas se etiquetarán `not_similar` cuando cambien el hecho registrado.
- Casos genuinamente ambiguos se marcarán para discusión y no ingresarán al conjunto congelado hasta alcanzar acuerdo.
- Pares idénticos después de normalizar mayúsculas y espacios quedarán fuera; el producto los resuelve con lógica textual determinista.
- No se corregirán acentos ni puntuación para forzar una coincidencia textual. Esas variaciones podrán formar parte de la evaluación semántica.

## 4. Diseño del conjunto

Se crearán 60 pares equilibrados y revisables:

| Partición | `similar` | `not_similar` | Total | Uso |
|---|---:|---:|---:|---|
| Calibración | 20 | 20 | 40 | Examinar puntajes y seleccionar el umbral de cada modelo |
| Holdout | 10 | 10 | 20 | Evaluación final, una sola vez |
| **Total** | **30** | **30** | **60** | No se utilizará para entrenamiento |

Cada registro tendrá como mínimo:

- Identificador estable.
- Partición (`calibration` o `holdout`).
- Etiqueta (`similar` o `not_similar`).
- Dos textos en español.
- Categoría principal del caso.
- Justificación breve de la etiqueta para revisión humana.

El conjunto cubrirá, en ambas particiones y sin duplicar familias semánticas entre ellas:

- Paráfrasis con vocabulario distinto.
- Reordenamiento y variaciones gramaticales.
- Sinónimos y expresiones naturales en español.
- Bajo solapamiento léxico.
- Mismo tema con intención diferente.
- Negaciones y significados opuestos.
- Cambios de números o cantidades.
- Cambios de personas, lugares u otras entidades.
- Acentos y puntuación.
- *Hard negatives* con gran solapamiento de palabras.

### 4.1 Prevención de fuga entre particiones

Los pares se agruparán primero por familia semántica. Una familia completa pertenecerá a una sola partición, de modo que una paráfrasis o variación casi equivalente no aparezca en calibración y holdout al mismo tiempo.

Antes de generar embeddings se verificará automáticamente:

- Balance de clases y tamaños esperados.
- Identificadores únicos.
- Textos no vacíos, de una sola línea, con letras y de hasta 280 caracteres.
- Ausencia de coincidencias textuales normalizadas dentro de cada par.
- Ausencia de pares repetidos aunque se invierta su orden.
- Ausencia de una misma frase en ambas particiones.

La asignación de partición y las etiquetas se congelarán antes de puntuar modelos. Se registrará un hash SHA-256 de los archivos aprobados en el reporte.

## 5. Revisión humana y puertas de aprobación

El experimento tendrá dos puertas explícitas:

1. **Aprobación del protocolo:** autoriza implementar los validadores, el runner y una propuesta de 60 pares; no autoriza ejecutar el holdout.
2. **Aprobación de la verdad de referencia:** revisa textos, etiquetas, justificaciones y particiones. Después de esta aprobación se congelará el conjunto y podrá comenzar la calibración.

Si una etiqueta cambia después de puntuar un modelo, se invalidará la corrida afectada y se documentará una nueva versión del conjunto. No se cambiarán etiquetas basándose en si un modelo acertó o falló.

## 6. Configuración de los modelos

Se evaluarán los cuatro candidatos que superaron el Experimento 1:

| Clave | Artefacto ONNX | Dimensión | Preparación |
|---|---|---:|---|
| `minilm` | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | 384 | Mean pooling y normalización L2 |
| `e5` | `Xenova/multilingual-e5-small` | 384 | Prefijo `query: ` en ambos textos, mean pooling y normalización L2 |
| `distiluse` | `Xenova/distiluse-base-multilingual-cased-v2` | 512 | Mean pooling, proyección Dense oficial, `tanh` y normalización L2 |
| `bge_m3` | `Xenova/bge-m3` | 1024 | CLS pooling y normalización L2 |

Se mantendrán `@huggingface/transformers` 3.8.1, CPU y pesos `q8` para que la comparación de calidad use la misma configuración validada en el Experimento 1. El reporte guardará identificadores, revisiones disponibles, configuración de pooling, prefijos, proyección, normalización y versión del runtime.

## 7. Cálculo y calibración

Para cada modelo se generará una vez el embedding normalizado de cada texto y se calculará la similitud coseno del par. Un par se predecirá `similar` cuando su puntaje sea mayor o igual al umbral.

Los umbrales candidatos serán los puntos medios entre puntajes consecutivos observados en calibración, además de los límites necesarios para representar “todos positivos” y “todos negativos”. Este procedimiento evalúa todas las clasificaciones distintas posibles sin depender de un incremento decimal arbitrario.

La regla de selección original se aprobó antes de puntuar calibración con un mínimo de 80 %. Después de observar esos resultados, DEC-019 cambió únicamente el mínimo a 75 %; esta enmienda es posterior a la corrida inicial y queda registrada expresamente. La regla vigente se aplica por modelo, exclusivamente a los 40 pares de calibración:

1. Descartar umbrales con accuracy menor a 75 % en calibración.
2. Entre los restantes, maximizar F2 para dar más peso al recall de la clase `similar` sin ignorar precision.
3. En caso de empate, escoger mayor recall, luego mayor precision, luego mayor accuracy.
4. Si el empate persiste, escoger el umbral más alto para reducir advertencias innecesarias.

Si ningún umbral alcanza 75 % de accuracy en calibración, el modelo quedará marcado como no apto y se conservará únicamente su mejor F2 para diagnóstico; no se relajará el criterio después de observar el holdout.

Para el umbral elegido se reportará sensibilidad con los umbrales vecinos y con variaciones de `-0.01` y `+0.01`, sin utilizar esa observación para reajustarlo después del holdout.

## 8. Métricas y errores

Para calibración y holdout se reportarán por separado:

- Accuracy.
- Precision, recall, F1 y F2 para `similar`.
- Verdaderos positivos, verdaderos negativos, falsos positivos y falsos negativos.
- Matriz de confusión.
- Puntajes individuales, predicción y justificación del caso.
- Distribución de puntajes por clase: mínimo, mediana, máximo y cuartiles.
- Margen entre clases y sensibilidad local del umbral.

Los falsos negativos recibirán atención prioritaria porque pueden permitir guardar un duplicado si el usuario pulsa **Guardar** después de validar. Los falsos positivos también se revisarán, ya que generan fricción y pueden volver habitual ignorar las advertencias.

## 9. Uso protegido del holdout

Antes de abrir el holdout se dejarán congelados en un manifiesto:

- Hash y versión del conjunto etiquetado.
- Configuración exacta de cada modelo.
- Umbral seleccionado para cada modelo.
- Resultados completos de calibración.
- Código y versión utilizados.

Luego se ejecutará una sola evaluación de los modelos elegibles en calibración sobre los mismos 20 pares. El holdout no se usará para cambiar umbrales, etiquetas, pooling, prefijos ni otra configuración. Cualquier iteración posterior requerirá un nuevo holdout.

## 10. Criterios de aceptación y selección

Una combinación de modelo y umbral será aceptable si:

- Alcanza al menos 75 % de accuracy en el holdout equilibrado, cumpliendo `AFR-009` y `AC-014`.
- No presenta fallos técnicos ni embeddings inválidos.
- Sus errores concretos no revelan un riesgo sistemático incompatible con el flujo del producto.

Entre las combinaciones aceptables se priorizarán, en orden:

1. Recall de `similar`.
2. F1 de `similar`.
3. Accuracy.
4. Precision de `similar`.
5. Menor costo operacional medido en el Experimento 1 cuando las diferencias de calidad no sean materiales.

El tamaño del holdout permite verificar el criterio mínimo, pero no sustenta diferencias estadísticas finas entre modelos. Una diferencia de un solo caso equivale a cinco puntos porcentuales; por eso el reporte mostrará resultados por caso y evitará declarar superioridad concluyente ante empates o diferencias pequeñas.

## 11. Artefactos propuestos

Tras aprobar este protocolo se implementarán dentro de `experiments/semantic-similarity/`:

- `data/pairs.calibration.json`
- `data/pairs.holdout.json`
- `src/validate-dataset.mjs`
- `src/evaluate-model.mjs`
- `src/calibrate.mjs`
- `src/evaluate-holdout.mjs`
- Pruebas unitarias para normalización, coseno, métricas, generación de umbrales y desempates.
- Reportes JSON reproducibles en `results/`.

El resultado final quedó registrado en `docs/01-ai-feasibility/experiment-02-results.md`, con las métricas y los errores observados. La combinación evaluada no alcanzó el criterio de aceptación.

## 12. Fuera de alcance

- Entrenamiento o fine-tuning.
- PostgreSQL y pgvector, reservados para el Experimento 3.
- Índices aproximados.
- Pruebas de concurrencia o del flujo completo.
- Ajustar el umbral con datos del holdout.
- Convertir el resultado experimental directamente en código de producción.

## 13. Riesgos residuales

- Sesgo o desacuerdo humano en las etiquetas.
- Cobertura limitada por el tamaño de la muestra.
- Optimismo al seleccionar entre varios modelos sobre un único holdout pequeño.
- Dependencia de la cuantización y de revisiones ONNX aún no fijadas por commit en todos los candidatos.
- Diferencias entre el lenguaje del conjunto experimental y las frases reales del producto.

Estos riesgos se mitigarán conservando justificaciones revisables, congelando los datos antes de medir, publicando todos los errores y evitando conclusiones más precisas que la evidencia disponible.

## 14. Aprobación requerida

El protocolo fue aprobado el 2026-10-20. Posteriormente, DEC-019 sustituyó el mínimo de 80 % por 75 % sin cambiar la partición, las etiquetas ni la regla de selección de umbral. El usuario pidió alinear el protocolo y los runners con esta enmienda antes de evaluar el holdout. La aprobación original habilitó la implementación de los artefactos de la sección 11 y la revisión de los 60 pares; el holdout se ejecutó una sola vez y sus resultados constan en `experiment-02-results.md`.
