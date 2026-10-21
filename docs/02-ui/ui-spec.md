# Especificación UI/UX — Semantic Phrase Validator

| Campo | Valor |
|---|---|
| Fase | 03 — UI/UX Design |
| Estado | Aprobado para la maqueta visual estática |
| Fecha | 2026-10-21 |
| Método | AI-First + Human-in-the-Loop (HITL) |
| Maqueta aprobada | [`prototypes/ui/index.html`](../../prototypes/ui/index.html) |
| Fuentes de producto | [`product-brief.md`](../00-discovery/product-brief.md) y [`model-decision.md`](../01-ai-feasibility/model-decision.md) |

> Esta especificación registra la maqueta existente. Los ejemplos de la sección «Estados para revisar» son independientes: no representan una pantalla que muestre todos esos estados a la vez durante el uso real. Los controles de `index.html` no ejecutan acciones.

## 1. Propósito y alcance

La interfaz permite a una persona escribir una frase corta en español, comprobar si podría repetir una idea ya guardada y decidir si la guarda. El flujo exige **Validar** antes de **Guardar**. Ante una coincidencia, la decisión explícita es **Guardar de todos modos** o **Cancelar**. La lista es compartida y presenta primero las frases más recientes.

La maqueta cubre registro, validación, revisión de coincidencias, listado y confirmación visual de eliminación. No incorpora autenticación, edición, búsqueda, filtros, paginación, configuración del umbral ni lógica funcional. La implementación del MVP deberá conservar las reglas y restricciones del Product Brief; este documento define su presentación y comportamiento visible.

## 2. Dirección visual aprobada

Interfaz sobria y clara, con el contenido y la decisión humana como centro. El verde identifica el flujo ordinario, el ámbar reserva atención para posibles coincidencias y el rojo señala errores o eliminación. El texto evita afirmar que el modelo identifica duplicados con certeza: habla de **posibles coincidencias** y explica que el puntaje indica similitud.

| Elemento | Especificación de la maqueta |
|---|---|
| Tipografía | DM Sans, pesos 400–700; respaldo sans-serif. Titulares semibold, encabezados de sección bold, frases destacadas con tamaño y peso superiores al texto auxiliar. |
| Fondo y texto | Fondo `#F7F8F5`; superficies blancas; texto principal `#17302D`; texto secundario entre `#52635C` y `#65766E`. |
| Marca y acción ordinaria | Verde `#1F6656`; fondo de éxito `#EAF3EE`; foco suave `#D8ECE5`. |
| Advertencia | Fondo `#FFF7E7`, acción `#694D0C`, distintivo `#F5E7C9`. |
| Error y eliminación | Acción `#A43E38`; fondo de error `#FCEDEC`. |
| Contenedores | Tarjetas blancas con borde `#DCE5DF`, esquinas redondeadas y separación amplia. Las filas se separan con `#E8EEE9`. |
| Controles | Campos y botones de al menos 44 px de altura en los ejemplos; estados deshabilitados en gris verdoso y foco visible. |

Las fechas, frases, contador y porcentaje de la maqueta son **datos ilustrativos**. El «91 %» ejemplifica cómo se muestra un puntaje semántico; no expresa el rendimiento medido del modelo ni una garantía de acierto. La coincidencia textual se distingue expresamente como comparación determinista con puntaje de 100 %, sin atribuirla a la IA.

## 3. Estructura y adaptación responsive

1. **Cabecera:** nombre «Frases» e indicación «Lista compartida · Español».
2. **Introducción:** título «Cada idea, una frase.» y explicación breve del flujo HITL.
3. **Área principal:** tarjeta «Nueva frase» con campo, ayuda, contador, acciones y resultado de validación; tarjeta «Frases guardadas» con total, filas, fecha, acción Eliminar y aviso de lista compartida.
4. **Estados para revisar:** galería de ejemplos de los estados del flujo, separada visualmente del área principal.
5. **Pie:** identifica la página como maqueta estática con datos ilustrativos.

En pantallas pequeñas, las dos tarjetas principales y los ejemplos se apilan; desde el ancho `lg` de Tailwind, cada grupo usa dos columnas. El contenido general tiene un ancho máximo de 1440 px. Las acciones del formulario se apilan en móvil y se disponen en fila desde `sm`. Los textos de frases pueden ocupar varias líneas. La lista de frases tiene desplazamiento vertical propio cuando supera su altura máxima.

## 4. Componentes y reglas de interacción

| Componente | Presentación y comportamiento previsto para el MVP |
|---|---|
| Campo «Frase en español» | Una sola línea, etiqueta visible, indicación de longitud y contador. Acepta 1–280 caracteres tras quitar espacios externos y exige al menos una letra. Ante error, muestra mensaje junto al campo; conserva el texto. |
| **Validar** | Acción separada que inicia la comprobación y nunca guarda. Mientras se procesa, presenta «Validando…» y evita envíos duplicados. |
| **Guardar** | Deshabilitado antes de una validación vigente, durante la validación, después de modificar el texto o tras un fallo de validación. Se habilita tras «primera frase» o «sin posible coincidencia». |
| Resultado de coincidencia | Tarjeta ámbar con tipo, frase existente y puntaje. Presenta solo la candidata de mayor similitud. Una coincidencia textual indica 100 % y aclara que no intervino el modelo. |
| **Guardar de todos modos** y **Cancelar** | Sustituyen el guardado ordinario en una advertencia. Cancelar no persiste el intento, conserva el texto y exige volver a validar para otro intento de guardado. |
| Lista compartida | Filas con frase, fecha y hora de creación, y acción Eliminar identificable por frase. Orden de más reciente a más antigua; se actualiza tras guardar o eliminar. |
| Confirmación de eliminación | Antes de eliminar, identifica la frase y advierte que no podrá recuperarse desde la aplicación. Ofrece **Cancelar** y **Eliminar frase**. La galería muestra su contenido visual; la implementación deberá presentarlo como diálogo accesible. |

## 5. Estados visibles y mensajes

| Estado | Presentación | Acción disponible |
|---|---|---|
| Sin validar / texto modificado | Campo editable y ayuda; mensaje de nueva validación si cambió el texto. | **Validar** o **Validar de nuevo**; **Guardar** deshabilitado. |
| Validando | Mensaje «Validando frase…» y acciones deshabilitadas. | Esperar resultado; no repetir el envío. |
| Primera frase | Mensaje que explica que aún no hay frases con las que comparar. | **Guardar**. |
| Sin posible coincidencia | Mensaje de validación satisfactoria sin mostrar la candidata más cercana ni su puntaje. | **Guardar**. |
| Coincidencia textual | Advertencia ámbar, frase existente, «Coincidencia textual · 100 %» y aclaración de comparación textual. | **Guardar de todos modos** o **Cancelar**. |
| Coincidencia semántica | Advertencia ámbar, frase existente, puntaje semántico y explicación de que la persona decide. Es el ejemplo principal de la maqueta. | **Guardar de todos modos** o **Cancelar**. |
| Error de validación | Mensaje rojo, texto conservado y guardado bloqueado. | **Reintentar validación**. |
| Entrada inválida | Campo señalado y explicación concreta asociada a él. La maqueta ilustra una entrada compuesta solo por signos. | Corregir y validar. |
| Error al guardar | Mensaje rojo sin anunciar éxito; texto conservado. | **Reintentar guardado** según el estado de validación aplicable. |
| Frase guardada | Confirmación positiva; la frase aparece al inicio de la lista. | Ingresar otra frase o revisar la lista. |
| Lista vacía | Mensaje que invita a escribir, validar y guardar la primera frase. | Volver al formulario. |
| Confirmar eliminación | Resumen de la consecuencia irreversible en un diálogo. | **Cancelar** o **Eliminar frase**. |

La maqueta también presenta tres frases guardadas como ejemplo del listado. El sistema real debe iniciar sin frases salvo que se carguen datos de demostración de forma opcional y documentada.

## 6. Accesibilidad y lenguaje

- La página usa `lang="es"`, jerarquía de encabezados, regiones semánticas, etiquetas visibles y botones nativos.
- Los resultados informativos se representan con `role="status"`; los errores, con `role="alert"`. El error de entrada se vincula al campo con `aria-describedby` y `aria-invalid`.
- Los controles tienen foco visible y el botón Eliminar de cada fila incorpora el texto de la frase en su nombre accesible.
- El color acompaña al texto: éxito, advertencia y error siempre incluyen mensaje y acción comprensibles.
- En la implementación funcional, el diálogo de eliminación deberá gestionar foco, teclado y retorno del foco al elemento que lo abrió. La muestra estática usa `role="group"` porque solo exhibe la composición visual.
- Mantener el vocabulario «posible coincidencia» y «similitud» para evitar presentar la salida del modelo como certeza. No mostrar el umbral configurable en la interfaz del MVP.

## 7. Entrega y límites de la maqueta

`prototypes/ui/index.html` es un archivo HTML5 autónomo que carga Tailwind CSS Play CDN y DM Sans desde Google Fonts. Puede abrirse directamente en el navegador con conexión a internet. No requiere compilación ni dependencias locales. No hay JavaScript de producto, llamadas a API ni persistencia: los botones, mensajes y estados son muestras visuales.

La referencia de evaluación solicitada inicialmente como `docs/01-ai-feasibility/model-evaluation.md` no existe en el repositorio; la decisión y las limitaciones del modelo están documentadas en `docs/01-ai-feasibility/model-decision.md`. Allí se selecciona MiniLM para el MVP con umbral inicial configurable `0.8538613695045911`; en el holdout del flujo obtuvo 12/20 decisiones correctas y dejó sin alerta 8 de 10 casos positivos. Por eso la interfaz habla de posibles duplicados y mantiene la decisión de guardado en manos de la persona.
