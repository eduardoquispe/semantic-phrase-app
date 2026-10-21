# Resultados finales — Experimento 2

| Campo | Valor |
|---|---|
| Proyecto | Semantic Phrase Validator |
| Experimento | 02 — Calidad semántica y calibración |
| Etapa | Holdout final, ejecutado una vez |
| Fecha de ejecución | 2026-10-20 (America/Lima) |
| Estado | No aprobado: ningún modelo y umbral alcanza el mínimo vigente |
| Criterio de aceptación | Al menos 75 % de accuracy en 20 pares equilibrados (15 aciertos), según DEC-019 |
| Manifiesto congelado | `experiments/semantic-similarity/results/experiment-02-calibration-1792554852198.json` |
| Resultado JSON | `experiments/semantic-similarity/results/experiment-02-holdout-1792554957505.json` |

## 1. Resultado ejecutivo

MiniLM fue el único modelo elegible en calibración, con umbral `0.6772555477949693` y 75 % de accuracy (30/40). Se aplicó ese mismo umbral, sin reajuste, al holdout aprobado de 20 pares: acertó 10/20 (**50 %**). El resultado quedó 25 puntos porcentuales por debajo del mínimo y necesitaba cinco aciertos más para alcanzarlo. La combinación se rechaza para el MVP.

La apertura del holdout fue la única evaluación final de esta versión del conjunto. E5, DistilUSE y BGE-M3 no se evaluaron en él porque no superaron el filtro de calibración. El cambio de 80 % a 75 % se hizo después de observar la calibración y antes de abrir el holdout; esta secuencia consta en el protocolo enmendado y en el manifiesto.

## 2. Integridad y configuración

| Partición | Pares | SHA-256 |
|---|---:|---|
| Calibración | 40 | `04d2deb5c9d167c1af661cf49359166f1c6d0180adc230fb537fa066fbf6c3b5` |
| Holdout | 20 | `33040270a036572a6b3bc10163b1b51cbe19dc1136956ed21724509b1b2f6397` |

Ambas particiones conservaron los hashes del manifiesto y el estado `approved`. Se evaluó `Xenova/paraphrase-multilingual-MiniLM-L12-v2` con pesos `q8`, mean pooling, normalización L2 y similitud coseno. La regla clasifica como `similar` un puntaje mayor o igual al umbral congelado. El reporte final registra `minimumHoldoutAccuracy: 0.75` y `accepted: false`.

## 3. Métricas finales

| Modelo | Umbral | Accuracy | Precision | Recall | F1 | F2 | TP | TN | FP | FN | Aceptado |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| MiniLM | 0.677256 | **50.0 %** | 50.0 % | 70.0 % | 58.3 % | 64.8 % | 7 | 3 | 7 | 3 | No |

La caída de 75 % en calibración a 50 % en holdout muestra que la selección no generalizó a estos 20 pares independientes. El tamaño del holdout no permite estimar con precisión el rendimiento en producción; sí basta para constatar que no alcanzó el criterio acordado en esta evaluación.

## 4. Errores observados

Los tres falsos negativos fueron paráfrasis clasificadas como distintas:

| ID | Categoría | Caso resumido | Puntaje |
|---|---|---|---:|
| `hold-s-01` | Paráfrasis | Llanta pinchada / rueda de bicicleta desinflada por perforación | 0.599259 |
| `hold-s-04` | Bajo solapamiento léxico | Planta que necesita agua / maceta que hay que regar | 0.365256 |
| `hold-s-06` | Paráfrasis | Refrigerador con ruido extraño / nevera con sonido inusual | 0.451633 |

Los siete falsos positivos fueron frases distintas que activaron una advertencia:

| ID | Categoría | Diferencia decisiva | Puntaje |
|---|---|---|---:|
| `hold-n-01` | Negación | Ascensor funcionando / no funcionando | 0.867394 |
| `hold-n-03` | Cambio de entidad | Ganó Perú / ganó Chile | 0.959516 |
| `hold-n-04` | Acciones opuestas | Activar / desactivar micrófono | 0.857732 |
| `hold-n-05` | Misma temática, intención distinta | Buscar entradas / buscar cómo llegar | 0.811510 |
| `hold-n-06` | Negación | Congelador bien cerrado / no bien cerrado | 0.889267 |
| `hold-n-07` | Cambio de cantidad | Autobús a las seis / a las nueve | 0.838300 |
| `hold-n-08` | Cambio de entidad | Lucía tiene la llave / Miguel tiene la llave | 0.712306 |

Los falsos negativos permitirían ofrecer **Guardar** para posibles duplicados; el usuario todavía tendría que pulsarlo. Los falsos positivos obligarían a resolver advertencias para registros diferentes. En esta muestra, el solapamiento de vocabulario dio puntajes altos a negaciones, cambios de entidad y acciones opuestas, mientras que algunas paráfrasis recibieron puntajes bajos.

## 5. Decisión y continuación

- No se acepta MiniLM con el umbral probado como solución de calidad para el MVP.
- El umbral `0.6772555477949693` permanece registrado como candidato **evaluado y rechazado**; no debe elevarse a configuración de producción.
- El holdout de esta versión quedó consumido. Sus errores pueden orientar una nueva hipótesis, pero no deben utilizarse para ajustar el umbral y volver a declararlo evaluación independiente.
- Una nueva alternativa deberá definirse en un protocolo actualizado, calibrarse con datos apropiados y validarse una sola vez contra un **nuevo holdout** antes de reclamar el cumplimiento de `SC-003` y `AFR-009`. La propuesta basada en la definición ampliada de posible duplicado está en `experiment-02-v2-proposal.md`.

Las rutas `results/*.json` se excluyen de Git en este proyecto; este documento conserva las métricas y decisiones principales en un artefacto versionable.
