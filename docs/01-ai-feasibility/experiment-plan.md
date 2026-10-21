# Plan de ejecución — MVP Semantic Phrase Validator

| Campo | Valor |
|---|---|
| Alcance | Reto técnico: aplicación de frases con validación semántica antes de guardar |
| Estado | Selección de modelo cerrada; continuar con la aplicación |
| Modelo elegido | MiniLM local en Node.js; ver [justificación](model-decision.md) |
| Fecha | 2026-10-21 |

## Objetivo

Entregar una aplicación React o Vue, API REST en Node.js y PostgreSQL que permita escribir, validar, guardar, listar y eliminar frases cortas. La validación compara una frase nueva con las guardadas mediante embeddings de Hugging Face y avisa de posibles duplicados. El usuario decide si guarda una frase advertida.

## Evaluación realizada para elegir el modelo

Se ejecutaron estos pasos antes de tomar la decisión. Los conjuntos, scripts y pruebas permanecen en [`experiments/semantic-similarity/`](../../experiments/semantic-similarity/README.md); las cifras y la interpretación están en el [reporte de decisión](model-decision.md).

1. **Comprobar viabilidad local.** Ejecutar MiniLM, E5, DistilUSE y BGE-M3 desde Node.js con Transformers.js, ONNX, CPU y pesos `q8`. Verificar dimensión, valores finitos, norma L2 y estabilidad entre repeticiones. Medir carga desde caché, primera inferencia, ocho inferencias calientes, lote de seis, memoria RSS y tamaño descargado. Cada modelo corre en un proceso separado.
2. **Medir calidad semántica en pares.** Usar frases en español etiquetadas como posible duplicado o no duplicado, con calibración separada del holdout. Generar embeddings, calcular coseno y escoger para cada modelo un umbral solo con calibración. Evaluar los umbrales congelados una vez sobre 20 pares nuevos. Registrar aciertos, precisión, recall, F1, falsos positivos y falsos negativos. Esta prueba mide similitud entre dos frases; no prueba todavía la recuperación desde una lista.
3. **Probar el flujo con PostgreSQL y pgvector.** Usar 40 casos de calibración y 20 de holdout, equilibrados entre alerta y ausencia de alerta. Cada caso tiene una frase nueva y tres frases activas. Generar e insertar embeddings propios de MiniLM y BGE-M3; buscar la candidata más cercana por coseno y aplicar un umbral calibrado para cada modelo. Congelar umbrales y hashes de los conjuntos antes del holdout. Medir decisiones correctas, errores al recuperar la candidata esperada, falsos positivos, falsos negativos y tiempo de validación. Los casos del holdout no se utilizan para ajustar el umbral.
4. **Comparar costo y fallos.** Contrastar latencia y memoria de los candidatos con la calidad observada. Con MiniLM, comprobar carga desde caché sin red, rechazo de caché vacía o incompleta y propagación de fallos simulados de inferencia y base de datos. Distinguir las pruebas simuladas de las verificaciones que requerirán la aplicación final.
5. **Seleccionar para el MVP.** Priorizar funcionamiento local, costo de integración y resultados del flujo completo. El 75 % fue el objetivo interno usado para leer las pruebas; no es una condición impuesta por el reto ni una garantía estadística. Registrar resultados desfavorables y límites sin repetir holdouts para convertirlos en aprobados.

Para interpretar las métricas: **accuracy** es la proporción de decisiones correctas; **precisión** mide cuántas alertas emitidas correspondían a casos positivos; **recall** mide cuántos positivos recibieron alerta; un **falso positivo** alerta sin corresponder y un **falso negativo** deja pasar un caso que debía alertarse. Un **error de recuperación** significa que la primera candidata no era la frase pertinente, aunque la decisión de alerta se contabiliza por separado.

Los umbrales de pares y del flujo se calibraron con datos y tareas diferentes. La base de datos no altera la escala de la similitud coseno; la diferencia surge al seleccionar la mayor coincidencia entre varias frases y optimizar sobre otro conjunto. Por eso el umbral de pares queda como evidencia diagnóstica y el valor inicial del MVP procede de la prueba del flujo.

## Decisiones cerradas

- Usar `Xenova/paraphrase-multilingual-MiniLM-L12-v2` en Node.js, con pesos ONNX `q8`, *mean pooling*, normalización L2 y vectores de 384 dimensiones. Preparar la caché del modelo durante la instalación.
- Usar `0.8538613695045911` como **umbral inicial configurable**: es el valor con el que se probó el flujo completo de MiniLM. Su resultado de 12/20 y sus ocho falsos negativos se documentan en la [decisión de modelo](model-decision.md); el valor sirve para arrancar el MVP, no acredita una detección confiable.
- Usar PostgreSQL con pgvector y búsqueda exacta para el volumen del MVP. Mantener una coincidencia textual normalizada separada de la similitud semántica.
- Mantener botones separados **Validar** y **Guardar**. Validar solo consulta; guardar requiere un resultado vigente. Si hay advertencia, el usuario confirma con **Guardar de todos modos** o cancela.
- Registrar la configuración del modelo junto con los embeddings para evitar comparar vectores incompatibles.
- Tratar el 75 % de aciertos como meta orientativa de la exploración, no como condición de entrega. La [decisión de modelo](model-decision.md) muestra los resultados reales y sus errores.

## Trabajo pendiente para entregar el MVP

1. **Backend y datos:** crear migraciones para frases, embeddings y metadata de validación; implementar API para validar, guardar, listar y eliminar. Guardar la frase y su metadata en una transacción. Rechazar un guardado si la validación falló, caducó o corresponde a otro texto.
2. **Frontend:** construir formulario, lista y estados de carga, advertencia y error. Conservar el texto ante fallos, permitir reintentar e invalidar el resultado si se edita la frase.
3. **Configuración:** exponer el umbral inicial de MiniLM (`0.8538613695045911`) como parámetro configurable y documentar su limitación. Definir un tiempo máximo de validación. Ninguno de los dos debe permitir guardar cuando el resultado sea desconocido.
4. **Comprobación final:** probar los flujos de validar, guardar, confirmar coincidencia, eliminar y reintentar tras un error. Comprobar con PostgreSQL real que un fallo al guardar no deja datos parciales. Medir una validación desde la API de la aplicación y documentar instalación, variables de entorno y una demostración reproducible.

## Fuera de esta entrega

Comparar más modelos, crear nuevos conjuntos de evaluación, reentrenar, añadir servicios de inferencia, índices vectoriales aproximados o garantías de producción multiusuario. Si luego se ajusta el umbral o el método, los conjuntos ya examinados sirven para diagnóstico, no para afirmar una mejora independiente.
