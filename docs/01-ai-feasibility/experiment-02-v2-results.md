# Resultados finales — Experimento 2, versión 2

| Campo | Valor |
|---|---|
| Proyecto | Semantic Phrase Validator |
| Definición evaluada | Posible duplicado para revisión humana (DEC-020) |
| Etapa | Holdout v2 ejecutado una vez |
| Fecha de ejecución | 2026-10-20 (America/Lima) |
| Estado | No aprobado: ningún candidato alcanzó 75 % |
| Manifiesto congelado | `experiments/semantic-similarity/results/experiment-02-calibration-1792555544459.json` |
| Resultado JSON | `experiments/semantic-similarity/results/experiment-02-holdout-1792555624880.json` |

## 1. Resultado ejecutivo

Con la nueva definición de posible duplicado, MiniLM alcanzó 77.5 % y BGE-M3 82.5 % en calibración. Se aplicaron sus umbrales congelados al holdout v2 aprobado de 20 pares, sin ajustes posteriores. **Ambos acertaron 13/20 (65 %)** y quedaron por debajo del mínimo vigente de 75 % (15/20). Para superar 75 % habrían necesitado al menos 16/20.

La modificación de etiquetas y composición se definió antes de puntuar la versión 2 y se probó con un holdout nuevo. Por ello este resultado no reemplaza el 50 % obtenido por MiniLM en el holdout de la versión 1: son evaluaciones de definiciones y datos distintos. Ninguna combinación probada puede declararse aceptada para el MVP.

## 2. Integridad y configuración

| Partición | Pares | SHA-256 |
|---|---:|---|
| Calibración v2 | 40 | `a6bf440a333347447727261c2754c1ab47c31a6fbcdbcfd2ec0792f1659901ff` |
| Holdout v2 | 20 | `be474e2c5320a6aa2ecd934fddb1ad5a04b4f3b35727c8eb6eb1ae401d24a585` |

Los hashes coincidieron con el manifiesto y ambos archivos estaban `approved`. El runner utilizó `datasetDirectory: "data/v2"` y evaluó una sola vez los dos modelos elegibles. No se cambiaron textos, etiquetas, configuración ni umbrales entre calibración y holdout.

## 3. Métricas finales

| Modelo | Umbral congelado | Accuracy | Precision | Recall | F1 | F2 | TP | TN | FP | FN | Aceptado |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| MiniLM | `0.6763989282227754` | **65.0 %** | 63.6 % | 70.0 % | 66.7 % | 68.6 % | 7 | 6 | 4 | 3 | No |
| BGE-M3 | `0.777858735884295` | **65.0 %** | 61.5 % | 80.0 % | 69.6 % | 75.5 % | 8 | 5 | 5 | 2 | No |

MiniLM bajó 12.5 puntos porcentuales respecto de su calibración; BGE-M3, 17.5 puntos. Cada error representa cinco puntos porcentuales en este holdout pequeño. El resultado demuestra incumplimiento del criterio acordado en esta muestra, sin permitir una estimación precisa del desempeño futuro.

## 4. Errores observados

Los falsos negativos compartidos fueron `v2-hol-s-06` (corte de luz / falta de suministro eléctrico) y `v2-hol-s-08` (filtración de techo / gotera). MiniLM también dejó pasar `v2-hol-s-05` (contraseña perdida / recuperación de acceso). Son paráfrasis cuyo vocabulario difiere.

Ambos modelos generaron advertencias erróneas en `v2-hol-n-01` (subir / bajar la temperatura), `v2-hol-n-02` (encender / apagar la cámara), `v2-hol-n-09` (enviar / archivar una carta) y `v2-hol-n-10` (regar / podar un árbol). BGE-M3 también marcó `v2-hol-n-03` (llegó / no llegó un depósito). Las parejas conservan muchas palabras, pero cambian la acción o invierten el hecho.

Las variaciones pequeñas de nombre, cantidad, fecha y lugar del holdout v2 se clasificaron correctamente con los dos modelos. Aun así, siguen existiendo errores suficientes en otras clases como para impedir la aceptación.

## 5. Decisión

- Se rechazan ambos modelos con sus umbrales evaluados para el criterio de calidad del MVP.
- El holdout v2 queda consumido. No se modificarán sus etiquetas ni se reajustarán umbrales para convertir este resultado en un aprobado.
- El siguiente experimento debe abordar explícitamente el significado de acciones opuestas y negaciones, además de paráfrasis con poco vocabulario compartido; puede estudiar reglas deterministas o un clasificador de pares junto a embeddings.
- Toda alternativa nueva necesita calibración y un **tercer holdout independiente**, con su protocolo y etiquetas aprobados antes de puntuarlos.

Las rutas `results/*.json` se excluyen de Git; este reporte conserva las métricas y decisiones principales en un archivo versionable.
