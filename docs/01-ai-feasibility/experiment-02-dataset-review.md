# Revisión del conjunto etiquetado — Experimento 2

| Campo | Valor |
|---|---|
| Proyecto | Semantic Phrase Validator |
| Experimento | 02 — Calidad semántica y calibración |
| Estado | Verdad de referencia aprobada |
| Fecha | 2026-10-20 |
| Fecha de aprobación | 2026-10-20 |
| Protocolo | `docs/01-ai-feasibility/experiment-02-proposal.md` |

## 1. Artefactos para revisión

- Calibración: `experiments/semantic-similarity/data/pairs.calibration.json`
- Holdout: `experiments/semantic-similarity/data/pairs.holdout.json`

Cada registro contiene identificador, familia semántica, categoría, etiqueta, ambos textos y la justificación humana. Los archivos fueron aprobados y quedaron habilitados para la calibración.

## 2. Resumen del conjunto

| Partición | Similares | No similares | Total | Estado |
|---|---:|---:|---:|---|
| Calibración | 20 | 20 | 40 | Aprobado |
| Holdout | 10 | 10 | 20 | Aprobado |
| **Total** | **30** | **30** | **60** | **Aprobado** |

Las 60 familias semánticas son distintas. Ninguna frase ni familia aparece en ambas particiones.

### Cobertura de casos similares

| Categoría | Calibración | Holdout | Total |
|---|---:|---:|---:|
| Paráfrasis | 4 | 2 | 6 |
| Reordenamiento | 3 | 2 | 5 |
| Sinónimos | 4 | 2 | 6 |
| Variación gramatical | 4 | 1 | 5 |
| Bajo solapamiento léxico | 4 | 2 | 6 |
| Acentos y puntuación | 1 | 1 | 2 |

### Cobertura de casos no similares

| Categoría | Calibración | Holdout | Total |
|---|---:|---:|---:|
| Negación | 4 | 2 | 6 |
| Cambio de número o cantidad | 4 | 2 | 6 |
| Cambio de entidad | 4 | 2 | 6 |
| *Hard negative* | 4 | 2 | 6 |
| Mismo tema, distinta intención | 4 | 2 | 6 |

## 3. Validación automática

El comando `npm run dataset:validate` confirma:

- 40 pares de calibración, equilibrados 20/20.
- 20 pares de holdout, equilibrados 10/10.
- Campos obligatorios e identificadores únicos.
- Textos válidos y de hasta 280 caracteres.
- Ausencia de coincidencias textuales normalizadas dentro de cada par.
- Ausencia de pares repetidos o invertidos.
- Ausencia de frases y familias compartidas entre particiones.

Los hashes definitivos se registrarán con la calibración para comprobar que ninguna partición cambie antes de evaluar el holdout.

## 4. Criterios de revisión humana

Para cada par se debe confirmar:

1. Que `similar` realmente amerita una advertencia de posible duplicado en el producto.
2. Que `not_similar` representa registros distintos aunque exista vocabulario o tema compartido.
3. Que la justificación coincide con los textos y no introduce contexto ausente.
4. Que el español resulta natural y comprensible.
5. Que no hay un caso ambiguo cuya etiqueta dependa de una interpretación no declarada.

Las etiquetas no deben modificarse después de observar puntajes de los modelos. Si algún caso es discutible, debe corregirse o reemplazarse antes de aprobar esta segunda puerta.

## 5. Siguiente decisión

La verdad de referencia fue aprobada el 2026-10-20. Esto permite:

1. Mantener ambos datasets en `"status": "approved"`.
2. Congelar sus hashes definitivos.
3. Ejecutar la calibración sobre los 40 pares.
4. Presentar los umbrales y resultados de calibración antes de abrir el holdout final.

Esta aprobación todavía no implica ejecutar el holdout.
