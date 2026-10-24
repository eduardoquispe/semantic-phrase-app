# Bloque 05 — Arquitectura de Persistencia

Cambio incompatible (2026-10-22): `validationId` sustituye a `validationToken`, sin alias.
Se devuelve el UUID v4 aleatorio de la validación persistida, sin firma ni JWT.
Los JWT anteriores dejan de formar parte del contrato; las filas existentes pueden
referenciarse por su UUID. No hay migración ni secreto de firma requerido.
El registro queda fuera de F002: deberá buscar por `validationId`, comprobar
vigencia (`now >= expiresAt` implica expiración), texto, confirmación y estado no
consumido, y consumir la validación atómicamente con el guardado de la frase.
TTL configurable inicialmente de 15 minutos; respuesta y fila comparten expiración.


**Proyecto:** Semantic Phrase App  
**Estado:** Aprobado — decisiones B05-D01 a B05-D23  
**Fecha:** 21 de octubre de 2026  
**Ruta objetivo:** `docs/03-architecture/05-data-architecture.md`  
**Alcance:** Diseño documental de persistencia; **no** constituye implementación, migración ejecutada ni inicialización de PostgreSQL.

## 1. Visión general

El MVP utiliza **PostgreSQL + extensión pgvector** para almacenar frases, embeddings y validaciones temporales. La API **NestJS/TypeScript** accede a los datos mediante **Drizzle ORM** y tres adaptadores de infraestructura que implementan los puertos aprobados del módulo `PhrasesModule`. Se mantienen dos Aggregate Roots independientes: `Phrase` y `PhraseValidation`.

La validación semántica se produce **antes** del registro definitivo: se genera un embedding MiniLM de 384 dimensiones, se busca primero igualdad textual normalizada y, si no existe, la coincidencia vectorial **Top-1 exacta**. El resultado se guarda temporalmente en `phrase_validations` y se devuelve el UUID persistido. `CreatePhraseUseCase` verifica la referencia y la confirmación HITL cuando corresponda, y el adaptador de registro consume la validación y crea la frase **en una misma transacción**, sin volver a ejecutar el modelo.

**Principios de alcance:** simplicidad del MVP; integridad de la operación de guardado; SQL y Drizzle restringidos a infraestructura; sin HNSW/IVFFlat, workers, colas, tablas de embeddings separadas, repositorios genéricos ni Unit of Work personalizado.

## 2. Fuentes y compatibilidad con bloques anteriores

| Fuente | Restricciones heredadas |
|---|---|
| `docs/03-architecture/01-system-overview.md` | Monolito modular; pnpm workspaces; NestJS REST síncrono; backend hexagonal; frontend React por funcionalidades; HITL. |
| `docs/03-architecture/02-backend-architecture.md` | `Phrase` y `PhraseValidation` como Aggregate Roots independientes; tres casos de uso; `PhraseRepositoryPort`, `PhraseValidationRepositoryPort` y `PhraseRegistrationPort`; referencia UUID y registro atómico; Jest. |
| `docs/03-architecture/04-ai-architecture.md` | MiniLM `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, ONNX `q8`, 384 dimensiones, mean pooling, L2; coseno; Top-1 exacto; umbral inicial `0.8538613695045911`; un solo modelo activo y versionado compatible. |
| Evaluación proporcionada anteriormente, **“Evaluación y decisión de modelo para el MVP”** | Línea base de evaluación de MiniLM y viabilidad del flujo PostgreSQL/pgvector; no supone garantía de detección semántica perfecta. |

**Limitación documental:** no se pudo verificar una copia con la ruta exacta `docs/00-discovery/product-brief.md` ni `docs/01-ai-feasibility/model-evaluation.md`. La evaluación original sí está disponible bajo otro nombre. No se atribuyen a esos dos archivos reglas adicionales no comprobadas. El contrato REST exacto, la forma de la referencia y los límites textuales se definirán donde corresponda, sin inventarlos aquí.

## 3. Tecnologías y decisiones de infraestructura

| Componente | Elección | Justificación |
|---|---|---|
| Base relacional | PostgreSQL | Transacciones ACID, restricciones, índices convencionales. |
| Extensión | pgvector | Columna `vector(384)` y operador de distancia coseno `<=>`. |
| Acceso TypeScript | Drizzle ORM | Tipado, consultas SQL transparentes y transacciones. |
| Migraciones | Drizzle Kit + SQL personalizado | Historial reproducible; habilitar la extensión y otros DDL particulares. |
| Driver | `pg` / `pg.Pool` | Una instancia compartida por los adaptadores, sin conexiones por solicitud. |
| Identidad | UUID v4 | Claves primarias independientes de la base. |
| Pruebas MVP | Jest unitario | No se incorpora base de pruebas ni Testcontainers inicialmente. |

La conexión es una responsabilidad técnica compartida. **No** se crea un `DatabaseModule` global por defecto; `PhrasesModule` compone los adaptadores mediante DI. El pool debe cerrarse al finalizar la aplicación y sus credenciales se suministrarán por configuración de entorno.

## 4. Modelo de datos y diagrama ER

Hay **dos tablas**, sin FK entre ellas. Los nombres del esquema son físicos y no obligan al dominio a usar entidades anémicas ni tipos de Drizzle.

```mermaid
erDiagram
    phrases {
        uuid id PK
        text text
        text normalized_text
        vector384 embedding
        varchar model_id
        varchar model_version
        timestamptz created_at
        smallint status "1=activa, 2=eliminada"
        timestamptz deleted_at "nullable; fecha de eliminación"
    }
    phrase_validations {
        uuid id PK
        text text
        text normalized_text
        vector384 embedding
        varchar model_id
        varchar model_version
        double similarity_score "nullable"
        uuid matched_phrase_id "nullable; referencia informativa"
        boolean requires_confirmation
        timestamptz expires_at
        timestamptz consumed_at "nullable"
        timestamptz created_at
    }
```

**Sin línea de relación ER:** `matched_phrase_id` puede referenciar lógicamente el identificador de una frase existente en el momento de validación, pero **no** es FK. Tampoco existe FK entre la frase registrada y la validación consumida. Esto permite limpiar validaciones sin afectar frases definitivas; se acepta perder trazabilidad histórica de cuál validación produjo cada frase.

### 4.1. Tabla `phrases`

| Campo | Tipo PostgreSQL | Nulabilidad y restricciones | Responsabilidad |
|---|---|---|---|
| `id` | `UUID` | PK; `NOT NULL` | Identidad del agregado, UUID v4. |
| `text` | `TEXT` | `NOT NULL` | Texto original de la frase. |
| `normalized_text` | `TEXT` | `NOT NULL`; índice B-tree **no UNIQUE** | Clave de comparación textual sencilla. |
| `embedding` | `VECTOR(384)` | `NOT NULL` | Embedding definitivo generado en validación. |
| `model_id` | `VARCHAR(255)` | `NOT NULL` | Identificador del modelo. |
| `model_version` | `VARCHAR(150)` | `NOT NULL` | Identidad del espacio vectorial efectivo. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`; valor inicial de tiempo | Ordenación y auditoría mínima. |
| `status` | `SMALLINT` | `NOT NULL`; `DEFAULT 1`; `CHECK (status IN (1, 2))` | Estado de la frase: `1` = activa, `2` = eliminada (eliminación lógica), irreversible desde el MVP. |
| `deleted_at` | `TIMESTAMPTZ` | `NULL` permitido; inicialmente `NULL` | Fecha de eliminación; no nulo solo si `status = 2`. |

Una frase está **activa** si `status = 1`. Listado, coincidencia textual, Top-1 vectorial y conteo paginado consideran solo frases activas. La eliminación es un `UPDATE ... SET status = 2, deleted_at = NOW() WHERE id = :id AND status = 1`; no hay `DELETE` físico ni restauración.

No habrá `UNIQUE` en `text` o `normalized_text`: HITL puede permitir que una persona confirme un registro pese a una coincidencia. Reglas de longitud, texto vacío y detalles Unicode se aplican según contrato funcional/aplicación, sin agregar restricciones SQL no aprobadas.

### 4.2. Tabla `phrase_validations`

| Campo | Tipo PostgreSQL | Nulabilidad y restricciones | Responsabilidad |
|---|---|---|---|
| `id` | `UUID` | PK; `NOT NULL` | Identidad independiente de validación, UUID v4. |
| `text` | `TEXT` | `NOT NULL` | Frase original validada. |
| `normalized_text` | `TEXT` | `NOT NULL` | Texto normalizado durante la validación. |
| `embedding` | `VECTOR(384)` | `NOT NULL` | Vector temporal que se reutilizará al crear. |
| `model_id` | `VARCHAR(255)` | `NOT NULL` | Modelo empleado para esa validación. |
| `model_version` | `VARCHAR(150)` | `NOT NULL` | Versión efectiva del espacio vectorial. |
| `similarity_score` | `DOUBLE PRECISION` | `NULL` permitido | Coseno de Top-1 **solo si se calculó por búsqueda vectorial**. |
| `matched_phrase_id` | `UUID` | `NULL` permitido; sin FK | Coincidencia encontrada; referencia informativa. |
| `requires_confirmation` | `BOOLEAN` | `NOT NULL` | Resultado funcional calculado por aplicación. |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Validez lógica de la validación. |
| `consumed_at` | `TIMESTAMPTZ` | `NULL` permitido; inicialmente `NULL` | Momento de utilización para el guardado. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`; valor inicial de tiempo | Creación de validación. |

**Aclaración de `similarity_score`:** para una coincidencia textual exacta prioritaria **no se inventará** una puntuación de coseno. Puede haber `matched_phrase_id` informado y `similarity_score = NULL` cuando la coincidencia es textual. Por B05-D21 no se crea un `CHECK` que exija simultaneidad de ambos campos. El resultado de aplicación distingue `textual_exact`, `vector` y `none` conceptualmente; la representación exacta en HTTP corresponde al bloque API. No se añade una nueva columna para ese discriminador sin aprobación: en esta versión, cuando `matched_phrase_id` exista y `similarity_score` sea `NULL`, se interpreta como coincidencia textual; ambos `NULL` significan ausencia de candidata. La lógica de aplicación verifica la coherencia.

**Advertencia de consistencia temporal:** las frases se eliminan lógicamente (`phrases.status`), por lo que `matched_phrase_id` sigue resolviendo a una fila existente aunque la frase ya no esté activa. La evidencia histórica de validaciones previas no se altera.

### 4.3. Reglas de normalización textual

La aplicación produce `normalized_text` desde el texto original mediante función pura TypeScript: `trim`, minúsculas y compresión de secuencias de espacios; se mantienen tildes y puntuación. La misma transformación se utiliza en guardado y consulta. La semántica concreta de espacios Unicode y `toLowerCase` debe fijarse y testearse de manera uniforme; cambiar las reglas exige reevaluar y, si aplica, regenerar `normalized_text` de datos anteriores.

No se confunde esta operación con la normalización **L2** de embeddings. No se agrega un `UNIQUE`, trigger ni columna calculada de PostgreSQL.

## 5. Almacenamiento y compatibilidad de embeddings

- **MVP:** MiniLM, mean pooling, ONNX `q8`, CPU, normalización L2, **384** componentes; `VECTOR(384)` tanto en `phrases` como en `phrase_validations`.
- El adaptador Hugging Face/LangChain genera el vector y comprueba dimensión, valores finitos, norma L2 esperada y `model_id`/`model_version` antes de entregarlo.
- La versión representa el **espacio vectorial efectivo** (revisión/pesos, pooling, normalización y parámetros relevantes); el mismo número de dimensiones no garantiza compatibilidad.
- Los adaptadores de Drizzle **no normalizan nuevamente** el vector. PostgreSQL valida la dimensión física y `NOT NULL`; no se añaden `CHECK` de norma o de coherencia de resultados semánticos.
- Los registros de validación retienen el vector generado. Al registrarse una frase, se **copia ese mismo embedding** dentro de la transacción sin nueva inferencia.
- Los cambios de modelo son operaciones **manuales y coordinadas**, no una selección dinámica por solicitud. Una futura dimensión diferente exige evolución del esquema; no se mezclan vectores incompatibles en una misma búsqueda.

### Evolución manual de modelo

1. Evaluar el nuevo modelo y calibrar su umbral con datos apropiados.
2. Definir la nueva identidad `model_version`; decidir cómo adaptar `VECTOR(384)` si cambian dimensiones.
3. Regenerar manualmente embeddings definitivos, mediante una operación administrativa controlada cuando sea necesaria; conservar integridad y posibilidades de reversión.
4. Comprobar cobertura y compatibilidad de frases que participarán en la búsqueda; no habilitar consultas mixtas.
5. Activar coordinadamente modelo y umbral; suspender validaciones si no existe un conjunto compatible utilizable.
6. Evitar reusar validaciones temporales emitidas para la versión anterior: durante transición deben expirar o rechazarse según compatibilidad.

No se exige automatización de reindexado ni doble escritura de embeddings en el MVP.

## 6. Recuperación textual y consultas vectoriales

### 6.1. Orden de consulta

1. `ValidatePhraseUseCase` obtiene siempre el embedding válido de 384 dimensiones y metadatos.
2. Consulta igualdad sobre `normalized_text` usando el B-tree.
3. **Si hay coincidencia textual**, priorizar una candidata de forma determinista; no ejecutar consulta vectorial, devolver coincidencia textual y solicitar confirmación. No fabricar puntaje coseno.
4. **Si no hay igualdad textual**, consultar **Top-1 exacto** por coseno sobre frases con `model_version` (y modelo/espacio efectivo) compatible.
5. Ante ausencia de frases compatibles, devolver resultado válido sin candidata ni puntaje; ante error técnico, fallar de manera controlada, nunca reportar falsamente «no hay coincidencias».
6. El caso de uso aplica `AI_SIMILARITY_THRESHOLD = 0.8538613695045911` inicialmente **solo a la similitud vectorial**, y guarda la validación temporal.

Para múltiples coincidencias textuales iguales se elegirá una sola de forma estable (por ejemplo `created_at DESC, id DESC`). No implica unicidad ni bloqueo del registro.

### 6.2. SQL ilustrativo (no ejecutado)

**Coincidencia textual:**

```sql
SELECT id, text
FROM phrases
WHERE normalized_text = :normalized_text
  AND status = 1
ORDER BY created_at DESC, id DESC
LIMIT 1;
```

**Top-1 exacto por distancia coseno:**

```sql
SELECT id,
       text,
       1 - (embedding <=> :query_vector::vector) AS similarity
FROM phrases
WHERE status = 1
  AND model_version = :active_model_version
  AND model_id = :active_model_id
ORDER BY embedding <=> :query_vector::vector ASC,
         id ASC
LIMIT 1;
```

`<=>` es **distancia coseno**; `1 - distancia` devuelve **similitud coseno**, no probabilidad. Se debe pasar un vector válido como parámetro enlazado y serializarlo según Drizzle/pgvector. Los marcadores `:...` expresan intenciones, **no** son sintaxis lista para ejecutar con `pg` sin enlazado de parámetros. El desempate por `id` garantiza comportamiento estable, aunque el orden exacto en igualdad de distancia no cambia el criterio Top-1.

El filtro de versión y modelo evita comparar espacios incompatibles, sin que esto sustituya la verificación de compatibilidad durante despliegue. Para este MVP se permite una búsqueda exacta lineal en el subconjunto compatible.

### 6.3. Listado paginado

```sql
SELECT id, text, created_at
FROM phrases
WHERE status = 1
ORDER BY created_at DESC, id DESC
LIMIT :limit OFFSET :offset;
```

El `total` de la paginación cuenta solo frases con `status = 1`.

Tamaño inicial **20**; `LIMIT/OFFSET`, con valores validados/no negativos. No seleccionar `embedding` en el listado. La respuesta paginada no debe asumir estabilidad absoluta entre páginas cuando hay inserciones concurrentes (trade-off aceptado por el MVP).

## 7. Índices y rendimiento

| Tabla | Índice | Propósito | Estado |
|---|---|---|---|
| `phrases` | PK B-tree sobre `id` | Identidad | Obligatorio. |
| `phrases` | B-tree sobre `normalized_text` | Igualdad textual | Aprobado. |
| `phrases` | B-tree sobre `model_version` (o combinado con `model_id`) | Filtrado eventual | **Condicional** a selectividad/planes; no acelerará por sí solo la distancia coseno. |
| `phrases` | B-tree compuesto `(created_at DESC, id DESC)` | Listado/paginación | Candidato sencillo; medir antes de introducir un índice redundante. |
| `phrases` | B-tree sobre `status` (o parcial `WHERE status = 1`) | Filtrar frases activas | Opcional; medir antes de añadirlo. |
| `phrase_validations` | PK B-tree sobre `id` | Lookup y consumo condicional | Obligatorio. |
| `phrase_validations` | B-tree sobre `expires_at` | Limpieza manual futura | Opcional, si el volumen lo justifica. |

No se crearán **HNSW ni IVFFlat**, porque el contrato exige Top-1 exacto. Estos índices soportan recuperación aproximada; requieren una revisión explícita de B04-D06 antes de usarlos. La consulta exacta se evaluará más adelante con `EXPLAIN (ANALYZE, BUFFERS)` al disponer de datos representativos. Evitar agregar todos los índices candidatos sin comprobar su utilidad.

## 8. Puertos hexagonales, adaptadores y mappers

```mermaid
flowchart TB
    V[ValidatePhraseUseCase] --> PR[PhraseRepositoryPort]
    V --> VR[PhraseValidationRepositoryPort]
    C[CreatePhraseUseCase] --> RR[PhraseRegistrationPort]
    L[ListPhrasesUseCase] --> PR
    PR -.implementado por.-> DR[DrizzlePhraseRepository]
    VR -.implementado por.-> DV[DrizzlePhraseValidationRepository]
    RR -.implementado por.-> DT[DrizzlePhraseRegistrationAdapter]
    DR --> D[Drizzle + pg.Pool compartido]
    DV --> D
    DT --> D
    D --> DB[(PostgreSQL + pgvector)]
```

| Adaptador | Tablas | Operaciones pertinentes |
|---|---|---|
| `DrizzlePhraseRepository` | `phrases` | Coincidencia textual, Top-1 exacta compatible, listado paginado. |
| `DrizzlePhraseValidationRepository` | `phrase_validations` | Crear validación temporal, recuperar validación cuando aplique. |
| `DrizzlePhraseRegistrationAdapter` | Ambas | Consumir condicionalmente validación e insertar frase dentro de **una transacción**. |

Los puertos son **clases abstractas TypeScript** definidas en aplicación y utilizadas como referencias de DI NestJS; ningún puerto expone Drizzle, SQL o `pg`. Los adaptadores son especializados por **responsabilidad**, no por obligación «una tabla = un repositorio». No se implementa un `UnitOfWork` ni un coordinador transaccional genérico.

`PhrasePersistenceMapper` y `PhraseValidationPersistenceMapper` traducen registros de Drizzle a entidades y viceversa **cuando se necesita reconstruir un Aggregate Root**. Para respuestas de consulta como `{id, text, similarity}` o proyecciones de lista, se pueden devolver resultados tipados de aplicación sin construir entidades completas. No se crea mapper genérico. Las conversiones de fechas, nulabilidad y vector deben ser explícitas cuando cambien de representación.

### Estructura de referencia (no es creación de archivos)

```text
apps/api/
├── src/
│   ├── modules/
│   │   └── phrases/
│   │       ├── domain/
│   │       ├── application/
│   │       │   └── ports/outbound/
│   │       └── infrastructure/outbound/persistence/
│   │           ├── schema/
│   │           │   ├── phrases.schema.ts
│   │           │   └── phrase-validations.schema.ts
│   │           ├── repositories/
│   │           │   ├── drizzle-phrase.repository.ts
│   │           │   ├── drizzle-phrase-validation.repository.ts
│   │           │   └── drizzle-phrase-registration.adapter.ts
│   │           └── mappers/
│   └── shared/infrastructure/database/
│       └── drizzle.provider.ts
├── drizzle/migrations/
└── drizzle.config.ts
```

La configuración Drizzle Kit debe descubrir los esquemas de `PhrasesModule` y almacenar el historial de migraciones en un directorio compartido del backend. Solo se materializan archivos que la implementación requiera.

## 9. Transacciones, concurrencia y estado HITL

### 9.1. Semántica de consumo

Una validación está **pendiente y vigente** si `consumed_at IS NULL AND expires_at > NOW()`; está **consumida** si `consumed_at IS NOT NULL`, y **expirada sin consumo** si no está consumida y pasó su fecha de expiración. No existe columna `status`.

`PHRASE_VALIDATION_TTL_MINUTES=15` es el valor inicial configurable. La aplicación calcula `expires_at` al validar y la referencia UUID debe respetar esa misma expiración. No se requiere scheduler para invalidarla: expiración **lógica**.

### 9.2. Transacción de registro

`CreatePhraseUseCase` busca por validationId y comprueba asociación de la referencia, texto autorizado, versión, vigencia y confirmación HITL cuando aplique; la infraestructura garantiza que el **consumo y la inserción sean atómicos**.

Dentro de **una transacción Drizzle** con aislamiento predeterminado PostgreSQL `READ COMMITTED`:

1. Intentar `UPDATE phrase_validations SET consumed_at = ... WHERE id = ... AND consumed_at IS NULL AND expires_at > NOW()` con `RETURNING` de datos necesarios, incluida la frase y el embedding almacenados.
2. Verificar que se actualizó **exactamente una fila**; cero filas indica validación ausente, expirada o consumida, y conduce a reversión y tratamiento funcional controlado.
3. Comprobar la concordancia de texto/modelo/versión y las condiciones pertinentes antes del `INSERT`; si no concuerdan, lanzar error y revertir toda la transacción. Las verificaciones previas del caso de uso no sustituyen la lectura efectiva de la validación dentro de la operación atómica.
4. Insertar en `phrases` texto y embedding tomados de la validación aprobada, sin segunda inferencia.
5. `COMMIT` solo si todo termina correctamente; ante fallo, `ROLLBACK` del `UPDATE` y del `INSERT`.

```mermaid
sequenceDiagram
    participant UC as CreatePhraseUseCase
    participant P as PhraseRegistrationPort
    participant A as DrizzlePhraseRegistrationAdapter
    participant DB as PostgreSQL
    UC->>P: Registrar con validación autorizada
    P->>A: Ejecutar operación atómica
    A->>DB: BEGIN
    A->>DB: UPDATE condicional ... RETURNING
    alt Actualizó exactamente una fila y datos coherentes
        DB-->>A: Validación y embedding guardado
        A->>DB: INSERT INTO phrases
        A->>DB: COMMIT
        A-->>UC: Frase registrada
    else Consumida, expirada, ausente o error
        A->>DB: ROLLBACK
        A-->>UC: Error controlado
    end
```

PostgreSQL sincroniza actualizaciones concurrentes de la misma fila. En `READ COMMITTED`, la segunda petición comprueba nuevamente la condición después de esperar el bloqueo de la primera y no puede consumir exitosamente esa validación si ya tiene `consumed_at`. No hace falta `SELECT FOR UPDATE` adicional ni `SERIALIZABLE` por defecto. Esta garantía cubre **una validación por registro**, no impide que dos validaciones **distintas** registren frases semejantes, comportamiento coherente con HITL.

### 9.3. Retención

Registros expirados y consumidos pueden permanecer físicamente. Se realizará **limpieza manual** cuando sea necesario, sin cron, workers o eliminación oportunista durante peticiones. La retención exacta se determinará operativamente; la eliminación no afectará frases definitivas por ausencia de FK.

## 10. Migraciones y evolución del esquema

Se usan migraciones versionadas en Git, generadas por Drizzle Kit y complementadas con SQL personalizado. Secuencia conceptual:

1. Migración habilita `CREATE EXTENSION IF NOT EXISTS vector` (antes de utilizar `vector(384)`). La cuenta ejecutora debe disponer de los privilegios correspondientes.
2. Generación de tablas, PK, `NOT NULL` y columnas `VECTOR(384)`.
3. Índice B-tree sobre `phrases.normalized_text` y otros índices convencionales justificados.
4. Revisión manual del SQL y del orden de dependencias antes de aplicar migraciones mediante Drizzle Kit.
5. Migraciones ejecutadas **explícitamente**, no dentro del arranque de NestJS.

`drizzle-kit generate` crea cambios a partir del esquema; `drizzle-kit generate --custom` permite SQL manual sujeto al historial de migraciones; `drizzle-kit migrate` aplica las pendientes. El orden exacto de archivos de extensión y tablas debe verificarse al generar el historial real.

Cambios de esquema, modelo o normalización se revisarán como migraciones explícitas. Se evitará usar `drizzle-kit push` como mecanismo ordinario para entornos versionados. No se gestionarán múltiples modelos dinámicos ni migraciones automáticas de embeddings en el MVP.

## 11. Manejo de errores

Por B05-D15, se hace **traducción selectiva** en infraestructura, sin jerarquías SQL extensas.

| Situación | Manejo |
|---|---|
| Conexión PostgreSQL fallida, SQL inesperado, error de driver | Registrar detalle técnico de forma segura; emitir error técnico controlado, sin exponer SQL o credenciales. |
| Restricción física de esquema vulnerada | Convertir a error controlado apropiado, sin filtrar excepciones crudas. |
| `UPDATE` afecta cero filas | Resultado de consumo imposible / conflicto funcional; no disfrazarlo como indisponibilidad de BD. |
| Validación expirada o consumida | Error de aplicación; operación atómica no registra frase. |
| Incompatibilidad de `model_version` | Rechazar; nunca efectuar búsqueda entre espacios incompatibles o guardar usando una validación de modelo incorrecto. |
| Falla de inserción después de consumir | `ROLLBACK` integral; validación sigue disponible según sus condiciones temporales. |
| Coincidencia textual o semántica | Resultado **funcional**; requiere HITL cuando corresponda, no error técnico. |

`GlobalExceptionFilter` de NestJS, establecido en el Bloque 02, transforma errores controlados a HTTP. Códigos de estado y DTO exactos serán parte del contrato API, no de este diseño físico.

## 12. Estrategia de pruebas y comprobación

**Decisión B05-D16:** solo **pruebas unitarias Jest** automatizadas inicialmente. No se crea base adicional, Testcontainers ni pipeline de integración DB en el MVP.

| Área | Pruebas unitarias sugeridas |
|---|---|
| Dominio | Identidad, invariantes, expiración, consumo. |
| `ValidatePhraseUseCase` | Prioridad textual, comparación con umbral, ausencia de candidata, incompatibilidad de versión, fallos controlados. |
| `CreatePhraseUseCase` | Firma/confirmación, reutilización del embedding, sin inferencia repetida, rechazo de validación vencida o consumida. |
| Mappers | Reconstrucción de entidades, `NULL`, fechas y metadatos. |
| Lógica aislable de adaptadores | Manejo de resultado sin filas y clasificación selectiva de errores, sin pretender validar SQL real mediante mocks. |

**Riesgo aceptado:** las pruebas unitarias no demuestran que el DDL, pgvector, el plan Top-1 o el `UPDATE` condicional operen correctamente sobre PostgreSQL. Antes de considerar terminado el reto se requiere una **comprobación manual real y no destructiva** de: extensión activa, migraciones, guardado y lectura de vector 384, recuperación coseno conocida, prioridad textual, ausencia de candidata, reversión de transacción y dos solicitudes concurrentes consumiendo la misma validación. No se confunde esta comprobación con cobertura automatizada de integración. La equivalencia entre la salida LangChain y el pipeline Transformers.js evaluado continúa siendo un **riesgo de integración del Bloque 04**, no se afirma verificada aquí.

## 13. Diagramas de secuencia de validación

```mermaid
sequenceDiagram
    actor User as Usuario
    participant FE as React
    participant UC as ValidatePhraseUseCase
    participant AI as EmbeddingGeneratorPort
    participant PR as PhraseRepositoryPort
    participant VR as PhraseValidationRepositoryPort
    User->>FE: Solicita validar frase
    FE->>UC: Texto de frase
    UC->>AI: generate(text)
    AI-->>UC: Embedding 384d + modelo/version
    UC->>PR: Buscar normalized_text
    alt Coincidencia textual
        PR-->>UC: Frase coincidente, sin coseno fabricado
    else Sin igualdad
        UC->>PR: Buscar Top-1 coseno compatible
        PR-->>UC: Mejor candidata + score / ninguna
    end
    UC->>UC: Determinar alerta HITL
    UC->>VR: Guardar validación y embedding temporal
    VR-->>UC: id y expiración
    UC-->>FE: Resultado + referencia UUID
    FE-->>User: Mostrar coincidencia y confirmación si aplica
```

## 14. Registro de decisiones aprobadas y trade-offs

| ID | Decisión confirmada | Trade-off / límite |
|---|---|---|
| B05-D01 | Drizzle ORM y Drizzle Kit | Buen tipado; requiere revisar SQL de migraciones. |
| B05-D02 | Dos tablas con embedding integrado | Simplicidad; cambio de dimensiones implica migración. |
| B05-D03 | UUID v4 para ambos agregados | Identidades autónomas; índices más amplios que enteros. |
| B05-D04 | `text` y `normalized_text` | Consultas rápidas; requiere sincronización lógica en aplicación. |
| B05-D05 | Normalización TypeScript simple | Testeable; escrituras directas externas podrían omitirla. |
| B05-D06 | `expires_at` y `consumed_at`, sin `status` | Sin estados redundantes; condición temporal en consultas. |
| B05-D07 | Sin FK entre tablas de agregados | Limpieza independiente; menor trazabilidad histórica. |
| B05-D08 | `VECTOR(384)` + `model_id` y `model_version` | Garantiza dimensión, no equivalencia semántica. |
| B05-D09 | Top-1 exacto; índices convencionales; sin ANN | Recuperación exacta; coste crece con volumen. |
| B05-D10 | Transacción Drizzle + `UPDATE` condicional | Atomicidad por validación; no impide duplicados de validaciones distintas. |
| B05-D11 | Limpieza manual | Sin scheduler; requiere mantenimiento eventual. |
| B05-D12 | Tres adaptadores especializados | Separación de responsabilidades con pocos componentes. |
| B05-D13 | Mappers por agregado solo cuando aporten valor | Sin mapper genérico; algo de código específico. |
| B05-D14 | Drizzle Kit generado + SQL personalizado versionado | Reproducibilidad; revisar orden de migraciones. |
| B05-D15 | Traducción selectiva de errores | Mantiene aislamiento sin taxonomía excesiva. |
| B05-D16 | Jest unitario solamente, por ahora | Sin garantía automática de SQL/pgvector. |
| B05-D17 | Schemas en `PhrasesModule` y conexión técnica compartida | Organización por negocio; configuración Drizzle debe incluir schemas. |
| B05-D18 | Un `pg.Pool` compartido | Reutilización; gestionar cierre del pool. |
| B05-D19 | TTL 15 minutos configurable por ENV | Referencia y persistencia deben tener expiración consistente. |
| B05-D20 | Validez vectorial en IA + dimensión en BD | Evita lógica duplicada; no valida norma L2 en BD. |
| B05-D21 | Coherencia de similitud solo en aplicación | SQL simple; sin `CHECK` semánticos. |
| B05-D22 | Prioridad textual exacta normalizada | Evita consulta vectorial innecesaria; no fabricar coseno. |
| B05-D23 | Paginación `LIMIT/OFFSET`, 20 por página | Sencillez; menos óptima a gran escala. |

## 15. Pendientes delimitados y criterios de cierre

Este documento **cierra el diseño del Bloque 05** sin anticipar implementación. Siguen pendientes del bloque API o de la ejecución del proyecto: contratos HTTP, formato UUID de la referencia, reglas definitivas de entrada, naming preciso de identificadores de versión de modelo, ajuste de configuración de conexiones, tiempos/retención de limpieza manual, verificación de wrapper de IA y comprobaciones manuales sobre PostgreSQL real. No son autorización para alterar silenciosamente decisiones B01–B05.

**Criterio de aceptación:** el diseño mantiene dos tablas, la búsqueda Top-1 exacta, el almacenamiento 384d/versionado, el flujo HITL, tres adaptadores y el guardado transaccional; sin índice ANN, infraestructura adicional ni ejecución de código.

## Referencias técnicas

- pgvector, documentación oficial: https://github.com/pgvector/pgvector — `vector`, `<=>`, exact nearest-neighbor y opciones ANN.
- Drizzle Kit, migraciones generadas: https://orm.drizzle.team/docs/drizzle-kit-generate
- Drizzle Kit, migraciones personalizadas: https://orm.drizzle.team/docs/kit-custom-migrations

---

**Este archivo es exclusivamente documentación. No se ha inicializado PostgreSQL, aplicado migraciones, instalado dependencias ni implementado código de aplicación.**
