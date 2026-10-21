# Resultados de calibración — Experimento 2, versión 2

| Campo | Valor |
|---|---|
| Proyecto | Semantic Phrase Validator |
| Criterio de etiqueta | Posible duplicado para revisión humana (DEC-020) |
| Estado al cerrar calibración | Dos modelos elegibles; holdout v2 aún sin abrir en esa etapa |
| Resultado posterior | `docs/01-ai-feasibility/experiment-02-v2-results.md`: ambos rechazados en holdout |
| Fecha de ejecución | 2026-10-20 (America/Lima) |
| Conjunto | `experiments/semantic-similarity/data/v2/` (40 pares de calibración, 20 de holdout) |
| Manifiesto | `experiments/semantic-similarity/results/experiment-02-calibration-1792555544459.json` |
| Mínimo vigente | 75 % de accuracy |

## 1. Resultado ejecutivo

La nueva calibración se ejecutó después de aprobar los 60 pares v2. MiniLM alcanzó **77.5 %** (31/40) y BGE-M3 **82.5 %** (33/40); ambos fueron elegibles para una evaluación final independiente. E5 y DistilUSE no alcanzaron el mínimo ni al recorrer todos sus umbrales. El holdout v2 se ejecutó después con los umbrales congelados y rechazó a ambos candidatos; su reporte final está documentado por separado.

Los puntajes se calcularon desde cero sobre la calibración v2, sin reutilizar los de la versión anterior. La nueva definición de `similar` incluye posibles duplicados con cambios de detalles; el resultado de 50 % del holdout anterior sigue siendo válido para el criterio anterior y no se reemplaza con esta calibración.

## 2. Integridad del conjunto

| Partición | Pares | SHA-256 | Estado |
|---|---:|---|---|
| Calibración v2 | 40 (20/20) | `a6bf440a333347447727261c2754c1ab47c31a6fbcdbcfd2ec0792f1659901ff` | `approved` |
| Holdout v2 | 20 (10/10) | `be474e2c5320a6aa2ecd934fddb1ad5a04b4f3b35727c8eb6eb1ae401d24a585` | `approved`, sin puntuar |

Las particiones no comparten frases ni familias. El manifiesto registra `datasetDirectory: "data/v2"`; el runner final usará ese directorio y verificará ambos hashes antes de evaluar. Los textos del holdout se leyeron para validar estructura y hash, pero no se generaron embeddings ni predicciones para ellos.

## 3. Umbrales y métricas de calibración

| Modelo | Umbral | Tipo | Accuracy | Precision | Recall | F1 | F2 | TP | TN | FP | FN | Elegible |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| MiniLM | `0.6763989282227754` | Candidato | 77.5 % | 73.9 % | 85.0 % | 79.1 % | 82.5 % | 17 | 14 | 6 | 3 | Sí |
| E5 | `0.8924257254934552` | Diagnóstico | 57.5 % | 54.1 % | 100 % | 70.2 % | 85.5 % | 20 | 3 | 17 | 0 | No |
| DistilUSE | `0.4485371826752097` | Diagnóstico | 55.0 % | 52.6 % | 100 % | 69.0 % | 84.7 % | 20 | 2 | 18 | 0 | No |
| BGE-M3 | `0.777858735884295` | Candidato | **82.5 %** | **76.0 %** | **95.0 %** | **84.4 %** | **90.5 %** | 19 | 14 | 6 | 1 | Sí |

La máxima accuracy encontrada para los modelos no elegibles fue 65.0 % en E5 y 62.5 % en DistilUSE. Sus puntos diagnósticos priorizan F2 y por eso su accuracy en la tabla puede ser menor que ese máximo. Ambos modelos elegibles conservan su umbral exacto en el manifiesto; la visualización redondeada de un puntaje no debe usarse para ejecutar el holdout.

## 4. Errores y sensibilidad

MiniLM produjo 3 falsos negativos y 6 falsos positivos. Entre los falsos negativos están una paráfrasis de recuperación de acceso (`v2-cal-s-07`), una variación de nombre de contacto (`v2-cal-s-17`) y un recordatorio de pago expresado de otra forma (`v2-cal-s-19`). Entre los falsos positivos predominan acciones opuestas, una negación y dos solicitudes del mismo tema con intención diferente.

BGE-M3 produjo 1 falso negativo (`v2-cal-s-13`, falla del aire acondicionado expresada con poco vocabulario compartido) y 6 falsos positivos: tres acciones opuestas (`v2-cal-n-01`, `02`, `04`), dos negaciones (`v2-cal-n-06`, `07`) y una intención distinta (`v2-cal-n-10`). El patrón mantiene un riesgo de advertencias innecesarias cuando las frases comparten muchas palabras pero cambian de acción o estado.

| Modelo | Umbral seleccionado | Accuracy | Umbral vecino inferior | Accuracy | Umbral vecino superior | Accuracy |
|---|---:|---:|---:|---:|---:|---:|
| MiniLM | 0.676399 | 77.5 % | 0.668824 | 75.0 % | 0.679378 | 75.0 % |
| BGE-M3 | 0.777859 | 82.5 % | 0.769010 | 80.0 % | 0.783198 | 80.0 % |

La diferencia de dos aciertos entre BGE-M3 y MiniLM en 40 pares no demuestra superioridad general. BGE-M3 ofrece mejor recall y accuracy en esta calibración; el holdout aún debe comprobar si cualquiera de los dos mantiene al menos 75 %.

## 5. Decisión

- Se congelan para el holdout v2 los umbrales exactos de MiniLM (`0.6763989282227754`) y BGE-M3 (`0.777858735884295`).
- E5 y DistilUSE permanecen fuera de la evaluación final de esta versión.
- No se selecciona un modelo para el MVP ni se declara cumplido `SC-003` con estos resultados de calibración.
- El holdout v2 se ejecutó una sola vez para los **dos** candidatos con el mismo manifiesto. No se cambiaron etiquetas, textos, modelos ni umbrales después de observarlo; ambos obtuvieron 65 % y fueron rechazados.

El manifiesto JSON está en `results/`, directorio excluido de Git. Este documento conserva los hashes, métricas y umbrales principales en un archivo versionable.
