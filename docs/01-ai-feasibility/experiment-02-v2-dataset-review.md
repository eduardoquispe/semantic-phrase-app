# Revisión del conjunto v2 — Posibles duplicados

| Campo | Valor |
|---|---|
| Estado | Textos, etiquetas y justificaciones aprobados por el usuario el 2026-10-20 |
| Criterio | Product Brief, DEC-020 |
| Protocolo | `docs/01-ai-feasibility/experiment-02-v2-proposal.md` |
| Dataset | `experiments/semantic-similarity/data/v2/` |

## Resumen

| Partición | Similares | No similares | Total | SHA-256 |
|---|---:|---:|---:|---|
| calibration | 20 | 20 | 40 | `a6bf440a333347447727261c2754c1ab47c31a6fbcdbcfd2ec0792f1659901ff` |
| holdout | 10 | 10 | 20 | `be474e2c5320a6aa2ecd934fddb1ad5a04b4f3b35727c8eb6eb1ae401d24a585` |

La etiqueta `similar` significa **mostrar advertencia para revisión humana**, no afirmar que ambas frases son idénticas. Las variaciones de un dato pequeño conservan la etiqueta cuando se mantiene la acción y el asunto. Las acciones opuestas, negaciones que invierten el hecho y solicitudes distintas son `not_similar`.

Los pares son nuevos y no repiten frases exactas del conjunto anterior. El holdout v2 se puntuó una sola vez después de congelar los umbrales de calibración; el resultado está en `experiment-02-v2-results.md`.

## Calibración v2

| ID | Etiqueta | Categoría | Frase A | Frase B | Justificación |
|---|---|---|---|---|---|
| v2-cal-s-01 | similar | detail_variation | La consulta de pediatría quedó para el martes. | La consulta de pediatría quedó para el jueves. | Es la misma clase de cita; el día puede ser una corrección que conviene revisar. |
| v2-cal-s-02 | similar | detail_variation | Envía el memorando de ventas a Daniela. | Envía el memorando de ventas a Patricia. | La solicitud de enviar el mismo memorando conserva la acción y cambia el destinatario. |
| v2-cal-s-03 | similar | detail_variation | Necesito comprar cuatro cuadernos para la oficina. | Necesito comprar cinco cuadernos para la oficina. | La orden es casi la misma y solo varía la cantidad solicitada. |
| v2-cal-s-04 | similar | detail_variation | El paquete de la tienda llegará el lunes. | El paquete de la tienda llegará el miércoles. | Se refiere a la misma entrega posible con una fecha distinta. |
| v2-cal-s-05 | similar | detail_variation | Reserva una habitación para el viaje a Lima. | Reserva una habitación para el viaje a Trujillo. | La solicitud de reserva conserva la intención y cambia un detalle del destino. |
| v2-cal-s-06 | similar | detail_variation | Transfiere 250 soles al proveedor del evento. | Transfiere 280 soles al proveedor del evento. | La transferencia solicitada conserva el destinatario y difiere en el importe. |
| v2-cal-s-07 | similar | paraphrase | Olvidé el código de acceso de mi cuenta. | No recuerdo la clave para entrar a mi perfil. | Ambas frases piden resolver la pérdida de acceso a la misma clase de cuenta. |
| v2-cal-s-08 | similar | synonym | Quiero saber dónde está mi envío. | Necesito consultar la ubicación actual de mi paquete. | Ambas solicitan conocer el estado del envío. |
| v2-cal-s-09 | similar | paraphrase | Debo arreglar el freno de mi bicicleta. | El freno de la bici necesita reparación. | Describen la misma reparación pendiente. |
| v2-cal-s-10 | similar | reordering | Hay que entregar el reporte diario al supervisor. | Al supervisor hay que entregarle el informe de cada día. | El entregable y la persona receptora se mantienen. |
| v2-cal-s-11 | similar | grammar_variation | Solicité el permiso para estacionar. | Tengo solicitada la autorización de estacionamiento. | Describen la misma gestión de permiso. |
| v2-cal-s-12 | similar | accent_punctuation | ¿Cuál es la dirección del café? | Cual es la direccion del cafe | La ausencia de tildes y signos no cambia la consulta. |
| v2-cal-s-13 | similar | low_lexical_overlap | El aire acondicionado dejó de enfriar la habitación. | Hace calor en el cuarto porque el climatizador no funciona. | Ambas describen una falla de climatización en la habitación. |
| v2-cal-s-14 | similar | synonym | Tengo que revisar el documento del proyecto. | Debo repasar el archivo del trabajo. | La tarea principal es revisar el mismo tipo de documento. |
| v2-cal-s-15 | similar | paraphrase | La impresora se quedó sin tinta negra. | Hay que cambiar el cartucho negro de la impresora. | Ambas aluden al mismo problema de tinta. |
| v2-cal-s-16 | similar | detail_variation | La reunión con soporte empieza a las nueve. | La reunión con soporte empieza a las diez. | Puede ser una actualización de la hora de la misma reunión. |
| v2-cal-s-17 | similar | detail_variation | Llama a la clienta Valeria por el contrato. | Llama a la clienta Camila por el contrato. | La gestión del contrato y la acción coinciden; cambia el nombre de contacto. |
| v2-cal-s-18 | similar | detail_variation | La capacitación será en la sala A. | La capacitación será en la sala B. | La capacitación parece la misma y la sala podría haberse corregido. |
| v2-cal-s-19 | similar | reordering | Recuérdame pagar el recibo de agua mañana. | Mañana avísame que debo cancelar la cuenta del agua. | Ambas solicitan el mismo recordatorio de pago. |
| v2-cal-s-20 | similar | synonym | Quiero cancelar mi suscripción a la revista. | Deseo dar de baja la membresía de la publicación. | Ambas solicitan finalizar la suscripción. |
| v2-cal-n-01 | not_similar | opposite_action | Abre la ventana del salón. | Cierra la ventana del salón. | Las instrucciones sobre la ventana son contrarias. |
| v2-cal-n-02 | not_similar | opposite_action | Publica el archivo del informe. | Retira el archivo del informe publicado. | Publicar y retirar el archivo son acciones opuestas. |
| v2-cal-n-03 | not_similar | opposite_action | Activa la alarma del edificio. | Desactiva la alarma del edificio. | Las acciones solicitadas invierten el estado de la alarma. |
| v2-cal-n-04 | not_similar | opposite_action | Confirma la reserva del restaurante. | Cancela la reserva del restaurante. | Confirmar y cancelar la reserva son objetivos contrarios. |
| v2-cal-n-05 | not_similar | negation | El pedido ya fue enviado. | El pedido todavía no fue enviado. | Las frases afirman estados incompatibles del envío. |
| v2-cal-n-06 | not_similar | negation | La factura está pagada. | La factura no está pagada. | La negación invierte el estado de pago. |
| v2-cal-n-07 | not_similar | negation | La puerta del almacén está cerrada. | La puerta del almacén no está cerrada. | Se describen estados contrarios de la puerta. |
| v2-cal-n-08 | not_similar | negation | El presupuesto fue aprobado. | El presupuesto no fue aprobado. | La aprobación y su negación comunican hechos opuestos. |
| v2-cal-n-09 | not_similar | different_intent | Consulta el saldo de la tarjeta. | Bloquea la tarjeta porque se perdió. | Consultar un saldo y bloquear una tarjeta son gestiones diferentes. |
| v2-cal-n-10 | not_similar | different_intent | Inscríbeme en el curso de fotografía. | Envíame el temario del curso de fotografía. | Una frase solicita inscripción y la otra solo información. |
| v2-cal-n-11 | not_similar | different_intent | Reserva una mesa en el restaurante. | Consulta el horario del restaurante. | Reservar y consultar horarios son tareas distintas. |
| v2-cal-n-12 | not_similar | different_intent | Rastrea el envío de mi paquete. | Solicita una devolución del paquete. | Seguir el envío y tramitar una devolución tienen fines distintos. |
| v2-cal-n-13 | not_similar | different_intent | Descarga mi boleta de pago. | Corrige mi cuenta bancaria para el pago. | Se trata de operaciones diferentes relacionadas con la nómina. |
| v2-cal-n-14 | not_similar | different_intent | Envíame la agenda de la reunión. | Cancela la sala reservada para la reunión. | Solicitar una agenda y cancelar una sala no son la misma gestión. |
| v2-cal-n-15 | not_similar | different_intent | Muéstrame el estado de mi vuelo. | Compra equipaje adicional para mi vuelo. | Consultar un estado y comprar equipaje son solicitudes distintas. |
| v2-cal-n-16 | not_similar | different_intent | Pide una cotización para pintar la casa. | Programa la inspección eléctrica de la casa. | Comparten lugar, pero el trabajo solicitado cambia. |
| v2-cal-n-17 | not_similar | different_intent | Limpia el teclado de la computadora. | Compra un teclado nuevo para la computadora. | Limpiar el teclado y comprar uno nuevo son gestiones distintas. |
| v2-cal-n-18 | not_similar | different_intent | Firma el contrato de alquiler. | Consulta cuándo termina el contrato de alquiler. | Firmar y consultar la fecha de fin del contrato son tareas distintas. |
| v2-cal-n-19 | not_similar | different_intent | Repara el horno de la cocina. | Compra una bandeja nueva para el horno de la cocina. | Reparar el horno y comprar un accesorio son encargos diferentes. |
| v2-cal-n-20 | not_similar | different_intent | Lleva al perro al veterinario. | Compra alimento para el perro. | La atención veterinaria y la compra de comida son tareas diferentes. |

## Holdout v2

| ID | Etiqueta | Categoría | Frase A | Frase B | Justificación |
|---|---|---|---|---|---|
| v2-hol-s-01 | similar | detail_variation | Confirma la cita dental de Mariana para el viernes. | Confirma la cita dental de Lucía para el viernes. | La misma gestión y horario podrían referirse a un registro con nombre corregido. |
| v2-hol-s-02 | similar | detail_variation | La garantía de la laptop vence en junio. | La garantía de la laptop vence en julio. | Puede tratarse del mismo aviso de vencimiento con mes actualizado. |
| v2-hol-s-03 | similar | detail_variation | Registra seis cajas de material en el inventario. | Registra siete cajas de material en el inventario. | La operación de inventario se conserva y cambia la cantidad. |
| v2-hol-s-04 | similar | detail_variation | Retira el paquete en la sucursal de Surco. | Retira el paquete en la sucursal de Barranco. | La gestión de retiro parece la misma con una sucursal distinta. |
| v2-hol-s-05 | similar | paraphrase | No puedo acceder porque perdí mi contraseña. | Necesito recuperar la clave para entrar a mi cuenta. | Ambas frases describen la misma necesidad de recuperar el acceso. |
| v2-hol-s-06 | similar | synonym | Se cortó la luz en mi departamento. | Mi vivienda está sin suministro eléctrico. | Ambas informan una interrupción eléctrica. |
| v2-hol-s-07 | similar | reordering | Envíame por correo el comprobante del impuesto. | El comprobante del impuesto mándamelo al correo. | La solicitud y el documento coinciden. |
| v2-hol-s-08 | similar | low_lexical_overlap | Hay una filtración de agua en el techo. | Gotea desde arriba cuando llueve dentro de la casa. | Ambas describen una posible gotera del techo. |
| v2-hol-s-09 | similar | accent_punctuation | ¿A qué hora sale el tren? | A que hora sale el tren | Solo cambian acentos y signos de la misma pregunta. |
| v2-hol-s-10 | similar | grammar_variation | Ya recibí el pedido de la librería. | El pedido de la librería ya me fue entregado. | Ambas confirman la recepción del mismo tipo de pedido. |
| v2-hol-n-01 | not_similar | opposite_action | Sube la temperatura del termostato. | Baja la temperatura del termostato. | Las acciones sobre el termostato son contrarias. |
| v2-hol-n-02 | not_similar | opposite_action | Enciende la cámara durante la llamada. | Apaga la cámara durante la llamada. | Encender y apagar la cámara son órdenes opuestas. |
| v2-hol-n-03 | not_similar | negation | El depósito llegó a mi cuenta. | El depósito no llegó a mi cuenta. | La negación cambia el hecho comunicado. |
| v2-hol-n-04 | not_similar | negation | La conferencia fue cancelada. | La conferencia no fue cancelada. | Las frases afirman situaciones incompatibles. |
| v2-hol-n-05 | not_similar | different_intent | Compra una entrada para el concierto. | Busca la dirección del recinto del concierto. | Comprar acceso y averiguar una dirección son gestiones distintas. |
| v2-hol-n-06 | not_similar | different_intent | Matricula al niño en la escuela. | Consulta el calendario de la escuela. | La matrícula y la consulta de calendario tienen fines diferentes. |
| v2-hol-n-07 | not_similar | different_intent | Cambia la reserva del hotel. | Solicita una factura del hotel. | Modificar una reserva y pedir una factura son operaciones distintas. |
| v2-hol-n-08 | not_similar | different_intent | Repara la pantalla del teléfono. | Contrata un plan de datos para el teléfono. | Una frase trata de reparación y la otra de servicio móvil. |
| v2-hol-n-09 | not_similar | different_intent | Envía la carta al contador. | Archiva la carta que envió el contador. | Enviar una carta y archivar otra son gestiones diferentes. |
| v2-hol-n-10 | not_similar | different_intent | Riega el árbol del patio. | Poda el árbol del patio. | Regar y podar el árbol son acciones diferentes. |

## Aprobación

El usuario aprobó las 60 etiquetas y justificaciones el 2026-10-20. Ambos JSON tienen estado `approved`. Cualquier corrección posterior invalida la calibración y requiere nuevos hashes y revisión. El holdout v2 ya fue evaluado y no puede reutilizarse como evaluación independiente.
