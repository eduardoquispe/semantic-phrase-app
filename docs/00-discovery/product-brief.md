# Product Brief — Semantic Phrase Validator

| Campo | Valor |
|---|---|
| Proyecto | Semantic Phrase Validator |
| Documento | Product Brief |
| Versión | 1.1.0 |
| Estado | Approved |
| Metodología | AI-First / Human-in-the-Loop |
| Fuente oficial | `docs/00-discovery/reto-tecnico.md` |
| Última actualización | 2026-10-21 |

---

## 1. Product Overview

### 1.1 Problema

Los usuarios necesitan registrar frases cortas y evitar duplicados que pueden expresar la misma idea con palabras diferentes. Una comparación textual exacta no es suficiente para identificar equivalencias de significado.

### 1.2 Visión

Proporcionar una aplicación web simple que use IA para detectar posibles duplicados semánticos antes de guardar una frase y mantenga a la persona como responsable de la decisión final cuando exista una coincidencia.

### 1.3 Objetivos

- Registrar, listar y eliminar frases cortas en español.
- Detectar coincidencias textuales normalizadas y similitudes semánticas antes de persistir.
- Comunicar de forma comprensible la frase coincidente y su puntaje.
- Permitir que el usuario confirme o cancele el guardado ante una posible coincidencia.
- Conservar evidencia del resultado de validación asociado a cada frase guardada.
- Demostrar una integración funcional y evaluable con un modelo de embeddings de Hugging Face.

### 1.4 Criterios de éxito

| ID | Criterio | Verificación | Estado | Trazabilidad |
|---|---|---|---|---|
| SC-001 | El usuario puede validar, guardar, listar y eliminar frases | Pruebas de aceptación | CONFIRMED | Reto: Detalle y alcance obligatorio |
| SC-002 | Una coincidencia potencial nunca se persiste sin decisión humana explícita | Pruebas de aceptación | CONFIRMED | Reto: Detalle del reto |
| SC-003 | El MVP integra un modelo de Hugging Face, evalúa el flujo semántico en español y comunica sus errores observados | Demostración funcional y resultados reproducibles | CONFIRMED | DEC-022 |
| SC-004 | Toda frase guardada conserva la metadata de la validación que autorizó su persistencia | Pruebas de integración y consulta SQL | CONFIRMED | Reto: Alcance obligatorio; DEC-008 |
| SC-005 | La validación responde en hasta 5 segundos en condiciones normales | Medición de rendimiento | CONFIRMED | DEC-011 |
| SC-006 | Los fallos de IA o persistencia no producen guardados parciales y no eliminan el texto ingresado | Pruebas de error | CONFIRMED | DEC-002 |

---

## 2. Target Users & Actors

| Actor | Descripción | Necesidad principal | Estado |
|---|---|---|---|
| Usuario final | Persona que utiliza la aplicación demostrativa sin autenticarse | Registrar frases y decidir ante posibles duplicados | CONFIRMED |
| Sistema de validación semántica | Capacidad basada en un modelo de Hugging Face | Generar representaciones semánticas y puntajes comparables | CONFIRMED |
| Evaluador del reto | Persona que instala, ejecuta y revisa la solución | Comprobar el flujo funcional, la integración de IA y la calidad técnica | CONFIRMED |

El MVP utiliza una lista compartida. No existen cuentas, roles, propiedad individual ni privacidad entre usuarios. Por tratarse de una demostración, cualquier usuario puede visualizar o eliminar cualquier frase.

---

## 3. Product Scope

### 3.1 In Scope — CONFIRMED

- Ingreso de frases de una sola línea en español.
- Validación estructural de la entrada.
- Botones separados **Validar** y **Guardar**; validar no persiste la frase.
- Detección determinista de coincidencias textuales normalizadas.
- Validación semántica mediante embeddings de un modelo de Hugging Face.
- Cálculo de similitud y aplicación de un umbral configurable.
- Guardado mediante una acción explícita después de una validación vigente.
- Advertencia y decisión humana cuando existe coincidencia textual o semántica.
- Listado compartido ordenado desde la frase más reciente.
- Eliminación permanente con confirmación.
- Persistencia SQL de frases y metadata de validación.
- API REST documentada, respuestas consistentes y manejo claro de errores.
- Indicadores de carga, éxito, advertencia y error.
- Datos de demostración opcionales y documentados.
- Pruebas automatizadas del núcleo del backend.

### 3.2 Out of Scope — CONFIRMED

- Registro, inicio de sesión, autorización y propiedad privada de frases.
- Edición de frases.
- Estados propios de tareas, como pendiente o completada.
- Papelera, restauración o recuperación desde la interfaz.
- Búsqueda, filtros y paginación avanzada.
- Moderación de contenido o detección de datos personales.
- Detección automática de idioma y soporte multilingüe.
- Configuración del umbral desde la interfaz.
- Entrenamiento o fine-tuning del modelo.
- Historial de intentos cancelados o validaciones fallidas.
- Garantías de seguridad y aislamiento propias de un entorno productivo multiusuario.

### 3.3 Mejoras opcionales — PROPOSED

| Mejora | Condición |
|---|---|
| Autenticación con usuarios precargados y frases privadas | Posterior al MVP |
| Edición con revalidación completa | Posterior al MVP |
| Soporte multilingüe | Requiere evaluación por idioma |
| Moderación y protección de datos personales | Requiere reglas específicas |
| Pruebas end-to-end completas | Si el tiempo restante lo permite |

Ninguna mejora opcional forma parte de los criterios de aprobación del MVP.

---

## 4. Functional Requirements

| ID | Requisito | Prioridad | Estado | Trazabilidad |
|---|---|---|---|---|
| FR-001 | El sistema debe permitir ingresar una frase de una sola línea en español | Must | CONFIRMED | Reto: Detalle del reto; DEC-007 |
| FR-002 | El sistema debe rechazar frases vacías, formadas solo por espacios, sin letras o mayores de 280 caracteres después de eliminar espacios externos | Must | CONFIRMED | DEC-012 |
| FR-003 | El usuario debe disponer de botones separados **Validar** y **Guardar**; el primero comprueba similitud sin persistir y el segundo guarda después de validar | Must | CONFIRMED | Reto: validación antes de guardar; DEC-018 |
| FR-004 | El sistema debe mostrar un estado de validación en curso e impedir envíos duplicados mientras procesa la solicitud | Must | CONFIRMED | DEC-011 |
| FR-005 | El sistema debe detectar coincidencias textuales después de normalizar mayúsculas, minúsculas y espacios | Must | CONFIRMED | DEC-003 |
| FR-006 | Cuando no exista coincidencia textual, el sistema debe evaluar la similitud semántica contra las frases activas almacenadas | Must | CONFIRMED | Reto: Requisito clave de IA |
| FR-007 | Si no existen frases previas, el sistema debe considerar la validación satisfactoria y habilitar **Guardar**, sin persistir todavía | Must | CONFIRMED | Discovery: flujo sin datos |
| FR-008 | Si ninguna coincidencia alcanza el umbral, el sistema debe informar que no hay posible duplicado y habilitar **Guardar**; solo debe persistir al pulsarlo | Must | CONFIRMED | DEC-018 |
| FR-009 | Si existe una coincidencia textual o semántica, el sistema debe detener el guardado y mostrar una advertencia | Must | CONFIRMED | Reto: Detalle del reto; DEC-003 |
| FR-010 | La advertencia debe mostrar el tipo de coincidencia, la frase coincidente y el puntaje correspondiente | Must | CONFIRMED | Reto: Requisito clave de IA; DEC-003 |
| FR-011 | Ante una advertencia, el usuario debe poder **Guardar de todos modos** o **Cancelar** | Must | CONFIRMED | Reto: Detalle del reto |
| FR-012 | Si el usuario confirma, el sistema debe persistir la frase y registrar la decisión humana | Must | CONFIRMED | DEC-008 |
| FR-013 | Si el usuario cancela, el sistema no debe persistir la frase ni el intento de validación | Must | CONFIRMED | DEC-008 |
| FR-014 | Si cambia el texto después de cualquier validación, el resultado debe invalidarse y **Guardar** debe deshabilitarse hasta volver a validar | Must | CONFIRMED | Discovery: consistencia de validación |
| FR-015 | Si falla la validación semántica, el sistema debe conservar el texto, impedir el guardado y permitir reintentar | Must | CONFIRMED | DEC-002 |
| FR-016 | El sistema debe listar las frases activas desde la más reciente y mostrar texto, fecha de creación y acción Eliminar | Must | CONFIRMED | DEC-013 |
| FR-017 | El listado debe actualizarse después de guardar o eliminar una frase | Must | CONFIRMED | DEC-013 |
| FR-018 | La eliminación debe solicitar confirmación, retirar definitivamente la frase activa y excluirla de comparaciones futuras | Must | CONFIRMED | DEC-006, DEC-014 |
| FR-019 | La eliminación no debe destruir la evidencia histórica almacenada por validaciones anteriores de otras frases | Must | CONFIRMED | DEC-014 |
| FR-020 | La aplicación debe iniciar sin frases y ofrecer datos de ejemplo opcionales mediante instrucciones separadas | Should | CONFIRMED | DEC-015 |

---

## 5. User Flows

### UF-001 — Guardar la primera frase

**Actor:** Usuario final  
**Precondición:** No existen frases activas.

1. El usuario ingresa una frase válida y pulsa **Validar**.
2. El sistema informa que está validando y deshabilita las acciones durante el proceso.
3. Determina que no existen frases previas, muestra el resultado y habilita **Guardar**, sin persistir.
4. El usuario pulsa **Guardar**.
5. El sistema persiste la frase con estado `SIN_FRASES_PREVIAS` y su metadata de validación.
6. Muestra confirmación de éxito y actualiza el listado.

### UF-002 — Guardar una frase sin coincidencia

**Actor:** Usuario final  
**Precondición:** Existen frases activas.

1. El usuario ingresa una frase válida y pulsa **Validar**.
2. El sistema descarta una coincidencia textual normalizada.
3. Calcula la similitud semántica contra las frases activas.
4. Ningún resultado alcanza el umbral configurado; informa que no hay posible duplicado y habilita **Guardar**, sin persistir.
5. El usuario pulsa **Guardar** con el mismo texto validado.
6. El sistema persiste la frase y su metadata con estado `SIN_COINCIDENCIA`, muestra éxito y actualiza el listado.

La interfaz no muestra la frase más cercana ni su puntaje cuando el umbral no ha sido alcanzado; estos datos pueden conservarse como evidencia interna al guardar.

### UF-003 — Resolver una coincidencia textual

1. El usuario ingresa una frase y pulsa **Validar**.
2. El sistema encuentra otra frase igual después de la normalización textual.
3. Muestra la advertencia, la frase coincidente y un puntaje textual de 100 %, sin persistir.
4. El usuario puede pulsar **Guardar de todos modos** para confirmar y guardar con estado `COINCIDENCIA_TEXTUAL_CONFIRMADA`.
5. Si pulsa **Cancelar**, no se persiste la frase ni el intento; se conserva el texto y se requiere volver a validar antes de otro intento de guardado.

### UF-004 — Resolver una coincidencia semántica

1. El usuario ingresa una frase y pulsa **Validar**.
2. El sistema calcula las similitudes semánticas.
3. La mayor similitud alcanza o supera el umbral configurado.
4. Muestra la advertencia, la frase coincidente y el puntaje semántico, sin persistir.
5. El usuario puede pulsar **Guardar de todos modos** para confirmar y guardar con estado `COINCIDENCIA_SEMANTICA_CONFIRMADA`.
6. Si pulsa **Cancelar**, no se persiste la frase ni el intento; se conserva el texto y se requiere volver a validar antes de otro intento de guardado.

**Guardar de todos modos** es la acción explícita de guardado ante una advertencia y sustituye a **Guardar** en ese estado. Nunca se habilita el guardado ordinario para omitir la confirmación.

### UF-005 — Fallo durante la validación o persistencia

1. El usuario pulsa **Validar**, **Guardar** o **Guardar de todos modos**, según el estado del flujo.
2. Ocurre un error de IA, red, API o base de datos.
3. El sistema no guarda parcial ni silenciosamente la frase.
4. La interfaz muestra un mensaje claro, conserva el texto y permite reintentar la acción fallida.
5. Si la validación no se completó o el texto cambió, el guardado permanece deshabilitado hasta completar una nueva validación.

### UF-006 — Eliminar una frase

1. El usuario selecciona **Eliminar** en una frase del listado.
2. El sistema solicita confirmación.
3. Si el usuario confirma, la frase deja de estar activa, desaparece del listado y se excluye de validaciones futuras.
4. Si cancela, no ocurre ningún cambio.

---

## 6. Business Rules

| ID | Regla | Estado | Trazabilidad |
|---|---|---|---|
| BR-001 | Ninguna frase puede persistirse sin completar previamente una validación aplicable | CONFIRMED | Reto: API para validar antes de persistir |
| BR-002 | La decisión de guardar una posible coincidencia pertenece al usuario | CONFIRMED | Reto: enfoque HITL |
| BR-003 | Una frase sin coincidencias solo se guarda al pulsar **Guardar** después de una validación vigente | CONFIRMED | DEC-018 |
| BR-004 | Una coincidencia potencial nunca se guarda automáticamente | CONFIRMED | Reto: confirmación o cancelación |
| BR-005 | La normalización textual ignora espacios externos, espacios consecutivos y diferencias entre mayúsculas y minúsculas | CONFIRMED | DEC-003 |
| BR-006 | Los acentos y la puntuación permanecen significativos en la comparación textual | CONFIRMED | DEC-003 |
| BR-007 | Una coincidencia textual normalizada tiene puntaje textual de 100 % y debe identificarse como determinista, no como resultado de IA | CONFIRMED | DEC-008 |
| BR-008 | Para entradas sin coincidencia textual, la similitud de significado debe evaluarse mediante un modelo de embeddings de Hugging Face | CONFIRMED | Reto: Requisito clave de IA |
| BR-009 | Solo la coincidencia de mayor puntaje es la candidata presentada al usuario | CONFIRMED | Reto: frase más parecida encontrada |
| BR-010 | El umbral semántico debe ser configurable, pero no editable desde la interfaz del MVP | CONFIRMED | Reto: umbral configurable; DEC-004 |
| BR-011 | El valor inicial del umbral se define después de seleccionar y evaluar el modelo | CONFIRMED | DEC-004 |
| BR-012 | Solo se garantizan resultados semánticos para frases en español; no habrá detección automática de idioma | CONFIRMED | DEC-007 |
| BR-013 | Una entrada válida contiene de 1 a 280 caracteres después del recorte externo y al menos una letra | CONFIRMED | DEC-012 |
| BR-014 | Todas las frases guardadas deben conservar la metadata de la validación que autorizó su persistencia | CONFIRMED | DEC-008 |
| BR-015 | Las cancelaciones y los fallos de validación no generan registros persistidos | CONFIRMED | DEC-008 |
| BR-016 | Una frase eliminada no puede restaurarse desde el MVP ni participar en nuevas comparaciones | CONFIRMED | DEC-014 |
| BR-017 | La lista es compartida y cualquier usuario puede eliminar cualquier frase con confirmación | CONFIRMED | DEC-009 |

---

## 7. AI Functional Requirements

### 7.1 Comportamiento requerido

| ID | Requisito de IA | Estado | Trazabilidad |
|---|---|---|---|
| AFR-001 | Usar al menos un modelo de Hugging Face apto para producir embeddings de frases en español | CONFIRMED | Reto: Requisito clave de IA |
| AFR-002 | Generar una representación de la nueva frase y compararla con las frases activas almacenadas | CONFIRMED | Reto: Implementación esperada |
| AFR-003 | Calcular un puntaje de similitud, por ejemplo mediante similitud coseno | CONFIRMED | Reto: Implementación esperada |
| AFR-004 | Identificar la frase activa con mayor similitud | CONFIRMED | Reto: Implementación esperada |
| AFR-005 | Evaluar el mayor puntaje contra un umbral configurable | CONFIRMED | Reto: Implementación esperada |
| AFR-006 | Distinguir claramente los puntajes textuales deterministas de los puntajes semánticos del modelo | CONFIRMED | DEC-003, DEC-008 |
| AFR-007 | No habilitar un fallback de guardado sin validación cuando el modelo falle | CONFIRMED | DEC-002 |
| AFR-008 | Evaluar el flujo de búsqueda y umbral con al menos 20 validaciones etiquetadas en español, cada una con una frase nueva y frases activas almacenadas | CONFIRMED | DEC-021 |
| AFR-009 | Registrar aciertos, falsos positivos y falsos negativos del flujo; el 75 % es una meta orientativa, no un bloqueo del MVP | CONFIRMED | DEC-022 |

### 7.2 Resultado funcional de validación

La respuesta conceptual debe permitir conocer:

- Si existe una posible coincidencia.
- El tipo de resultado: textual, semántico, sin coincidencia o sin frases previas.
- La frase coincidente o candidata más cercana, cuando exista.
- El puntaje y el método que lo produjo, cuando aplique.
- El estado de la validación.
- La fecha y hora de validación.
- Si se requiere una decisión humana.

Esta descripción no constituye un contrato de API ni define el esquema SQL.

### 7.3 Evaluación y calibración

- El conjunto de evaluación debe estar equilibrado entre validaciones que requieren alerta y validaciones que no.
- Cada caso incluye una frase nueva, frases activas almacenadas y la decisión esperada; las etiquetas humanas actúan como referencia de verdad.
- Los casos se utilizan para evaluación y calibración, no para entrenamiento.
- Se elige MiniLM para implementar el MVP con inferencia local en Node.js: entre los modelos probados en el flujo completo obtuvo 12/20 decisiones correctas frente a 10/20 de BGE-M3, con menor tiempo y consumo de recursos. Es una elección práctica para este reto técnico, no una garantía de calidad general.
- El 75 % fue una meta interna de los experimentos, no un requisito del reto ni una condición definitiva para entregar el MVP. Los resultados y sus errores se mantienen visibles; no se presentan los 12/20 como cumplimiento de esa meta. Se prioriza completar el flujo funcional con el modelo disponible sin costo de API y ejecución local (DEC-022).
- En una evaluación nueva, `similar` significa que conviene advertir sobre un **posible** duplicado para revisión humana. Si se conserva la misma acción y el mismo asunto, un cambio de nombre, cantidad, fecha, hora o lugar puede seguir siendo `similar`; el usuario decide si guarda ambas frases. Las acciones opuestas, negaciones que invierten el hecho y solicitudes de intención distinta son `not_similar` (DEC-020).
- Una nueva evaluación independiente será necesaria si más adelante se afirma una mejora de calidad o se cambia el umbral; no bloquea la implementación del MVP. No se reetiquetan los holdouts ya evaluados para reclamar la meta anterior.
- El fine-tuning no forma parte del MVP.

---

## 8. Non-Functional Requirements

| ID | Categoría | Requisito | Estado | Trazabilidad |
|---|---|---|---|---|
| NFR-001 | Usabilidad | La interfaz debe comunicar claramente los estados inicial, validando, éxito, advertencia y error | CONFIRMED | Reto: estado de validación y mensajes |
| NFR-002 | Rendimiento | Una validación debe responder en hasta 5 segundos en condiciones normales | CONFIRMED | DEC-011 |
| NFR-003 | Resiliencia | Ante fallos, el sistema debe conservar el texto y permitir reintentar sin crear datos parciales | CONFIRMED | DEC-002 |
| NFR-004 | Consistencia | Las respuestas de la API deben seguir una estructura consistente para éxitos y errores | CONFIRMED | Reto: requisitos técnicos mínimos |
| NFR-005 | Validación | Frontend y backend deben validar los datos de entrada; el backend conserva la autoridad final | CONFIRMED | Reto: API con validaciones |
| NFR-006 | Persistencia | Las frases y su metadata deben permanecer disponibles después de reiniciar la aplicación | CONFIRMED | Reto: base de datos SQL |
| NFR-007 | Mantenibilidad | La solución debe separar UI, negocio, datos e integración de IA | CONFIRMED | Reto: arquitectura limpia |
| NFR-008 | Documentación | La API REST, instalación, ejecución y variables de entorno deben documentarse | CONFIRMED | Reto: requisitos y entregables |
| NFR-009 | Configuración | Secretos, credenciales y parámetros variables deben administrarse mediante variables de entorno y no incluirse en el repositorio | CONFIRMED | Reto: variables de entorno |
| NFR-010 | Testing | El núcleo del backend debe tener pruebas automatizadas para los flujos críticos acordados | CONFIRMED | Reto: se valorará testing; DEC-016 |
| NFR-011 | Idioma | Interfaz, mensajes, datos de prueba y evaluación garantizada deben estar en español | CONFIRMED | DEC-007 |
| NFR-012 | Seguridad | La aplicación debe dejar explícito que la lista es compartida y que el MVP no ofrece aislamiento de datos entre usuarios | CONFIRMED | DEC-009 |
| NFR-013 | Observabilidad UX | Durante una validación no se deben permitir solicitudes duplicadas desde la misma interacción | CONFIRMED | DEC-011 |
| NFR-014 | Compatibilidad técnica | La implementación debe respetar Node.js con JavaScript o TypeScript, frontend React o Vue y PostgreSQL o MySQL | CONFIRMED | Reto: requisitos técnicos mínimos |

El tiempo máximo de espera técnico antes de declarar timeout se definirá en arquitectura.

---

## 9. Acceptance Criteria

### AC-001 — Validación de entrada

**Given** que el usuario ingresa una cadena vacía, solo espacios, una entrada sin letras, varias líneas o más de 280 caracteres,  
**When** pulsa **Validar**,\
**Then** el sistema rechaza la entrada, explica la causa y no inicia la validación semántica ni persiste datos.

### AC-002 — Primera frase

**Given** que no existen frases activas y el usuario ingresa una frase válida,  
**When** pulsa **Validar**,\
**Then** el sistema informa que no hay frases previas y habilita **Guardar** sin persistir; al pulsar **Guardar**, registra `SIN_FRASES_PREVIAS` y muestra la frase en el listado.

### AC-003 — Guardado sin coincidencia

**Given** que existen frases activas y ninguna coincidencia textual o semántica alcanza la condición de alerta,  
**When** el usuario pulsa **Validar**,\
**Then** el sistema informa que no hay posible duplicado y habilita **Guardar** sin persistir; al pulsar **Guardar**, registra `SIN_COINCIDENCIA` y muestra éxito sin exponer la candidata más cercana.

### AC-004 — Coincidencia textual normalizada

**Given** que existe una frase que solo difiere por mayúsculas o espacios,  
**When** el usuario valida la nueva frase,  
**Then** el sistema no la guarda todavía y muestra una advertencia textual, la frase coincidente y un puntaje textual de 100 %.

### AC-005 — Coincidencia semántica

**Given** que una frase activa obtiene el mayor puntaje semántico y este alcanza o supera el umbral,  
**When** el usuario pulsa **Validar**,\
**Then** el sistema no persiste todavía la frase y muestra la coincidencia y su puntaje semántico.

### AC-006 — Confirmación de coincidencia

**Given** que se muestra una advertencia textual o semántica,  
**When** el usuario selecciona **Guardar de todos modos**,  
**Then** el sistema persiste la frase, la decisión humana y la metadata completa de validación.

### AC-007 — Cancelación de coincidencia

**Given** que se muestra una advertencia,  
**When** el usuario cancela,  
**Then** el sistema no persiste la frase ni el intento de validación.

### AC-008 — Cambio posterior a la validación

**Given** que existe un resultado de validación vigente,\
**When** el usuario modifica el texto,  
**Then** el resultado previo queda invalidado, **Guardar** y **Guardar de todos modos** quedan deshabilitados y se exige volver a validar el texto modificado.

### AC-009 — Fallo de IA

**Given** que el servicio o modelo de IA no puede completar la validación,  
**When** el usuario pulsa **Validar**,\
**Then** el sistema no persiste la frase, conserva el texto, muestra un error claro y permite reintentar.

### AC-010 — Listado

**Given** que existen frases activas,  
**When** el usuario abre o actualiza la aplicación,  
**Then** ve las frases ordenadas desde la más reciente, con texto, fecha y acción Eliminar.

### AC-011 — Eliminación confirmada

**Given** que el usuario solicita eliminar una frase,  
**When** confirma la acción,  
**Then** la frase desaparece del listado, no puede restaurarse desde la aplicación y deja de participar en validaciones futuras.

### AC-012 — Eliminación cancelada

**Given** que el usuario solicita eliminar una frase,  
**When** cancela la confirmación,  
**Then** la frase y el listado permanecen sin cambios.

### AC-013 — Error de persistencia

**Given** que la base de datos falla durante un guardado o eliminación,  
**When** el sistema recibe el fallo,  
**Then** evita un estado parcial, informa el error y mantiene una interfaz coherente con los datos efectivamente persistidos.

### AC-014 — Calidad documentada del modelo

**Given** un conjunto de al menos 20 validaciones completas en español, equilibradas entre casos con y sin alerta,
**When** se ejecutan la búsqueda en PostgreSQL y la comparación con el umbral configurado,
**Then** se registran los aciertos, falsos positivos, falsos negativos y límites observados, sin exigir un porcentaje fijo para entregar el MVP.

### AC-015 — Metadata de validación

**Given** cualquier frase guardada,  
**When** se consulta su registro de validación,  
**Then** se dispone de identificador, estado, método, fecha, puntaje cuando aplique, referencia o evidencia de la candidata cuando exista y decisión humana cuando corresponda.

### AC-016 — Guardado sin validación vigente

**Given** que la frase todavía no fue validada, su validación falló o su texto cambió,\
**When** el usuario intenta guardar,\
**Then** **Guardar** permanece deshabilitado y el backend rechaza el guardado sin una validación aplicable.

### AC-017 — Validar no persiste

**Given** una frase válida con o sin coincidencias,\
**When** el usuario pulsa únicamente **Validar**,\
**Then** el sistema presenta el resultado sin persistir la frase ni su metadata; la persistencia requiere una acción posterior de guardado.

---

## 10. Edge Cases & Error Scenarios

| ID | Escenario | Comportamiento esperado | Estado |
|---|---|---|---|
| EC-001 | Entrada vacía o solo espacios | Rechazar sin consultar el modelo | CONFIRMED |
| EC-002 | Entrada sin letras, como `!!!` o solo emojis | Rechazar como frase inválida | CONFIRMED |
| EC-003 | Entrada mayor de 280 caracteres o con saltos de línea | Rechazar e informar el límite | CONFIRMED |
| EC-004 | Diferencias solo en mayúsculas o espacios | Advertir coincidencia textual de 100 % | CONFIRMED |
| EC-005 | Diferencias en acentos o puntuación | No considerar coincidencia textual automática; continuar con evaluación semántica | CONFIRMED |
| EC-006 | Base sin frases | Validar sin persistir y habilitar **Guardar**; registrar `SIN_FRASES_PREVIAS` al guardar | CONFIRMED |
| EC-007 | Varias coincidencias sobre el umbral | Presentar la de mayor puntaje | CONFIRMED |
| EC-008 | Empate en el mayor puntaje | Aplicar un criterio determinista que se definirá en arquitectura y presentar una sola candidata | PENDING |
| EC-009 | Texto modificado después de validar | Invalidar el resultado, deshabilitar **Guardar** y exigir una nueva validación | CONFIRMED |
| EC-010 | Doble clic o envío repetido durante validación o guardado | Procesar una sola interacción y deshabilitar las acciones mientras se procesa | CONFIRMED |
| EC-011 | Modelo, proveedor o red no disponible | No guardar, conservar texto y permitir reintentar | CONFIRMED |
| EC-012 | Fallo de base de datos al guardar | No mostrar éxito ni dejar datos parciales | CONFIRMED |
| EC-013 | Fallo de base de datos al listar | Mostrar error claro y permitir reintentar | CONFIRMED |
| EC-014 | Fallo de base de datos al eliminar | Mantener el elemento visible si no se confirmó la persistencia del borrado | CONFIRMED |
| EC-015 | Eliminación de una frase usada como evidencia histórica | Excluirla de futuras comparaciones y conservar la evidencia histórica de otras validaciones | CONFIRMED |
| EC-016 | Frase en otro idioma | No se garantiza la calidad del resultado; la interfaz comunica que el alcance es español | CONFIRMED |
| EC-017 | Dos guardados simultáneos de contenido similar | Definir la estrategia de consistencia en arquitectura; nunca omitir deliberadamente el flujo HITL | PENDING |

---

## 11. Decisions Log

| ID | Decisión | Justificación | Estado |
|---|---|---|---|
| DEC-001 | Acción combinada de validación y guardado, reemplazada por botones separados en DEC-018 | Decisión original de Discovery sustituida por instrucción explícita del usuario | SUPERSEDED |
| DEC-002 | Bloquear el guardado ante un fallo de IA, conservar el texto y permitir reintentar | La validación es obligatoria y no debe degradarse silenciosamente | CONFIRMED |
| DEC-003 | Tratar coincidencias textuales y semánticas mediante advertencia y confirmación; calcular la textual con lógica determinista | Mantiene un flujo HITL uniforme y distingue los métodos | CONFIRMED |
| DEC-004 | Calibrar el umbral después de seleccionar y evaluar el modelo | Los puntajes no son directamente equivalentes entre modelos | CONFIRMED |
| DEC-005 | Excluir autenticación del MVP y usar una lista compartida | Prioriza el objetivo principal del reto | CONFIRMED |
| DEC-006 | Incluir eliminación permanente con confirmación y excluir edición | Aporta gestión básica con menor complejidad que editar y revalidar | CONFIRMED |
| DEC-007 | Limitar el MVP a español sin detección automática de idioma | Acota la evaluación y evita introducir otro clasificador | CONFIRMED |
| DEC-008 | Persistir metadata para toda frase guardada y no registrar intentos cancelados o fallidos | Cumple la trazabilidad exigida sin crear auditoría innecesaria | CONFIRMED |
| DEC-009 | Permitir que cualquier usuario elimine cualquier frase en el entorno demostrativo | No existe identidad ni propiedad en este MVP | CONFIRMED |
| DEC-010 | Criterio original de calidad sustituido por un mínimo de 75 % en DEC-019 | Actualización explícita del usuario; se conserva la evaluación reproducible | SUPERSEDED |
| DEC-011 | Mostrar carga, evitar envíos duplicados y fijar un objetivo normal de 5 segundos | Hace observable y medible la experiencia de IA | CONFIRMED |
| DEC-012 | Admitir frases de una línea, de 1 a 280 caracteres y con al menos una letra | Define de forma verificable el concepto de frase corta | CONFIRMED |
| DEC-013 | Mostrar un listado simple, más reciente primero, sin metadata técnica visible | Reduce ruido sin perder trazabilidad interna | CONFIRMED |
| DEC-014 | Excluir frases eliminadas de comparaciones futuras y conservar evidencia histórica | Evita resultados obsoletos sin destruir el historial de otras validaciones | CONFIRMED |
| DEC-015 | Iniciar con una base vacía y ofrecer datos de demostración opcionales | Separa la experiencia normal de la evidencia preparada | CONFIRMED |
| DEC-016 | Exigir pruebas automatizadas para el núcleo del backend | El testing es un criterio valorado y protege el flujo crítico | CONFIRMED |
| DEC-017 | Mantener la metadata conceptual independiente de su diseño SQL o JSON | Evita anticipar decisiones de arquitectura en Discovery | CONFIRMED |
| DEC-018 | Separar **Validar** y **Guardar**; validar nunca persiste y guardar exige una validación vigente; ante coincidencia se usa **Guardar de todos modos** o **Cancelar** | Instrucción explícita del usuario para alinear el flujo con la validación previa al guardado del reto; sustituye DEC-001 | CONFIRMED |
| DEC-019 | Exigir al menos 75 % de acierto sobre un mínimo de 20 pares equilibrados en español | Criterio anterior sustituido por la evaluación del flujo completo en DEC-021 | SUPERSEDED |
| DEC-020 | Advertir sobre posibles duplicados aunque cambie un detalle de nombre, cantidad, fecha, hora o lugar si se conserva la acción y el asunto; tratar acciones opuestas, negaciones y distintas intenciones como registros diferentes | El usuario aclaró que estas variaciones pequeñas pueden merecer revisión humana; se mantiene la decisión explícita antes de guardar | CONFIRMED |
| DEC-021 | Evaluar la búsqueda en PostgreSQL y el umbral sobre al menos 20 validaciones completas, con mínimo de 75 % de decisiones correctas | Criterio histórico de evaluación; su mínimo obligatorio se sustituye por DEC-022 | SUPERSEDED |
| DEC-022 | Elegir MiniLM para el MVP con inferencia local y tratar el 75 % como meta orientativa, sin bloquear la implementación | El reto pide una integración semántica funcional, no un porcentaje; MiniLM ofrece el mejor balance observado entre calidad del flujo, tiempo y recursos para un modelo sin costo de API | CONFIRMED |

---

## 12. Open Questions

| ID | Pregunta | Tratamiento recomendado | Estado | Fase responsable |
|---|---|---|---|---|
| Q-001 | ¿Qué modelo de embeddings de Hugging Face se usará en el MVP? | [MiniLM con inferencia local en Node.js](../01-ai-feasibility/model-decision.md) (DEC-022) | RESOLVED | AI Feasibility |
| Q-002 | ¿Cuál es el valor inicial del umbral? | `0.8538613695045911` para MiniLM, configurable; [resultado y límites](../01-ai-feasibility/model-decision.md) | RESOLVED | AI Feasibility |
| Q-003 | ¿La inferencia se consume como servicio o se ejecuta localmente? | Local en Node.js para el MVP (DEC-022) | RESOLVED | Arquitectura |
| Q-004 | ¿Cuál será el tiempo máximo antes de declarar timeout? | Definirlo a partir del modo de inferencia y mantener el objetivo normal de 5 segundos | PENDING | Arquitectura |
| Q-005 | ¿Cómo se representan frases y metadata en SQL y qué información complementaria usaría JSON? | Mantener como campos estructurados los datos principales y evaluar JSON solo para detalles variables | PENDING | Arquitectura |
| Q-006 | ¿Cuáles son los contratos concretos de la API REST? | Derivarlos de los flujos y criterios aprobados | PENDING | Arquitectura / SDD |
| Q-007 | ¿Cómo se resuelven empates exactos entre candidatas semánticas? | Usar un criterio determinista y documentado | PENDING | Arquitectura / SDD |
| Q-008 | ¿Qué garantía de consistencia se aplicará a solicitudes concurrentes similares? | Definirla sin cambiar el flujo HITL aprobado | PENDING | Arquitectura / SDD |

Las preguntas abiertas son técnicas y no bloquean la aprobación del alcance de producto. No autorizan cambios en el comportamiento confirmado.

---

## 13. Discovery Approval

### Checklist de revisión

- [x] Problema, visión y objetivos revisados
- [x] Usuarios y actores confirmados
- [x] Alcance y exclusiones confirmados
- [x] Requisitos funcionales y reglas de negocio acordados
- [x] Flujos HITL validados
- [x] Requisitos de IA y meta orientativa de calidad acordados
- [x] Requisitos no funcionales revisados
- [x] Criterios de aceptación y escenarios borde definidos
- [x] Decisiones confirmadas registradas
- [x] Pendientes técnicos identificados y asignados a fases posteriores

| Campo | Valor |
|---|---|
| Estado de aprobación | APPROVED |
| Aprobado por | Product Owner |
| Fecha de aprobación | 2026-10-20 |
| Autorización | Aprobación explícita otorgada durante la sesión de Product Discovery; cambios posteriores registrados en DEC-018 a DEC-022 por instrucciones explícitas del usuario |

---

## 14. Next Steps

1. Seguir el [plan de ejecución del MVP](../01-ai-feasibility/experiment-plan.md) con MiniLM local y un umbral inicial configurable.
2. Implementar el flujo de validar, decidir y guardar; completar lista, eliminación, manejo de errores y pruebas del backend con PostgreSQL.
3. Entregar README de instalación, variables de entorno, API documentada y una demostración reproducible de la integración de IA.

Cualquier cambio posterior a un requisito `CONFIRMED` debe registrarse como una nueva decisión y reflejarse en los artefactos derivados.
