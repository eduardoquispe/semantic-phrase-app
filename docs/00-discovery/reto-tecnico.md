# Reto Tecnico - Fullstack AI

## Detalle del reto
Construir una aplicacion web tipo lista de frases (similar a un todo list) donde el usuario pueda registrar oraciones cortas.

La solucion debe permitir que un usuario:

- Agregar una frase desde una interfaz simple.
- Visualizar las frases previamente guardadas.
- Presionar un boton de validacion antes de guardar para detectar si la nueva frase es muy parecida a una existente.
- Recibir una alerta cuando la frase sea potencialmente duplicada y decidir si confirma o cancela el guardado.

La validacion de similitud no debe ser solo por coincidencia exacta de texto. Debe usar IA para comparar significado semantico entre frases.

## Alcance obligatorio
- Frontend (React o Vue): formulario para nueva frase, listado de frases, estado de validacion, mensajes de error y confirmacion.
- Backend (Node.js + JavaScript/TypeScript): API REST para registrar frases y validar similitud antes de persistir.
- Base de datos SQL: persistencia de frases y metadatos de validacion (score de similitud, fecha, estado).

## Requisito clave de IA
Integrar al menos un modelo de Hugging Face para validar si una frase nueva es similar a frases ya almacenadas.

Implementacion esperada:
- Generar embeddings de frases existentes y de la nueva frase.
- Calcular similitud (por ejemplo coseno) contra frases guardadas.
- Definir un umbral configurable para decidir si existe posible duplicado.
- Retornar al frontend el resultado de validacion con la frase mas parecida encontrada y su puntaje.

## Requisitos tecnicos minimos
- Node.js, JavaScript o TypeScript, SQL (PostgreSQL o MySQL).
- API REST documentada y con validaciones.
- Manejo claro de errores y estructura consistente de respuestas.
- Uso de Git/GitHub y variables de entorno.
- Arquitectura limpia y separacion por capas (UI, negocio, datos, integracion IA).

## Entregables
- Repositorio con frontend + backend.
- Script SQL o migraciones.
- README con instalacion, ejecucion y variables de entorno.
- Explicacion breve de arquitectura y decisiones tecnicas.
- Evidencia de integracion con Hugging Face (codigo + ejemplo de validacion de frases similares).

## Se valorara especialmente
- Buenas practicas de desarrollo (estructura, legibilidad, manejo de errores, validaciones).
- Versionamiento consistente en Git (historial de commits claro y atomico).
- Testing (unitario y/o integracion) para el flujo de validacion semantica y guardado.
- Uso de Spec-Driven Development: definir comportamiento esperado antes de implementar (contratos de API, casos de aceptacion, escenarios borde).
