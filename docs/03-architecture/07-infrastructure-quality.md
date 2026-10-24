# Bloque 07 — Entorno Local, Testing y Calidad

> **Revisado contra el código implementado (2026-10-24); ante discrepancia manda el código.**

Cambio incompatible (2026-10-22): `validationId` sustituye a `validationToken`, sin alias.
Se devuelve el UUID v4 aleatorio de la validación persistida, sin firma ni JWT.
Los JWT anteriores dejan de formar parte del contrato; las filas existentes pueden
referenciarse por su UUID. No hay migración ni secreto de firma requerido.
El registro (F003) busca por `validationId`, comprueba vigencia (`now >= expiresAt`
implica expiración), texto, modelo/versión, confirmación y estado no consumido, inserta
la frase y después marca la validación como consumida (en una única transacción).
TTL configurable (15 minutos por defecto); respuesta y fila comparten expiración.

**Proyecto:** Semantic Phrase App  
**Estado:** Aprobado — B07-D01 a B07-D12, con ajustes posteriores expresamente confirmados  
**Fecha:** 21 de octubre de 2026  
**Ruta objetivo:** `docs/03-architecture/07-infrastructure-quality.md`  
**Alcance:** entorno local, testing y calidad de un reto técnico Fullstack AI ejecutado exclusivamente en local. Describe el estado implementado en `apps/backend` y en `compose.yaml`.

## 1. Visión general y decisiones heredadas

El entregable contiene dos aplicaciones **independientes**, alojadas bajo `apps/`: un frontend React y un backend NestJS. Cada una vive en su **propio repositorio Git**, enlazado como submódulo (`.gitmodules`: `apps/frontend` y `apps/backend`), y dispone de su propio `package.json`, `pnpm-lock.yaml`, dependencias, scripts, configuración, pruebas y flujo Spec Kit. **No se utiliza pnpm workspaces, Turborepo ni otro orquestador.** La carpeta superior agrupa ambos proyectos y la documentación para entregar el reto.

Se conservan las decisiones funcionales y arquitectónicas de los bloques anteriores:

- **B01:** React, NestJS, REST síncrono, backend hexagonal, frontend Screaming Architecture y confirmación humana ante posibles duplicados. **Se sustituye exclusivamente B01-D02**: la organización aprobada originalmente como monorepo con pnpm workspaces pasa a dos proyectos independientes bajo `apps/`.
- **B02:** `PhrasesModule`, DDD ligero, agregados `Phrase` y `PhraseValidation`, puertos, casos de uso `ValidatePhraseUseCase`, `CreatePhraseUseCase`, `ListPhrasesUseCase` y `DeletePhraseUseCase`; Jest en backend.
- **B03:** organización de React por funcionalidades; Vitest, React Testing Library y MSW; tests colocalizados; TanStack Query, Axios, React Hook Form/Zod y demás decisiones frontend ya aprobadas.
- **B04 (revisado):** MiniLM `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` servido por un contenedor Text Embeddings Inference (TEI 1.9.4, float32, mean pooling) y consumido mediante LangChain `OpenAIEmbeddings`; 384 dimensiones; umbral configurable `0.8538613695045911` (calibrado con vectores Xenova q8), sin garantía de exactitud perfecta ni modelo adicional.
- **B05:** PostgreSQL + pgvector, Drizzle ORM y migraciones Drizzle Kit; comparación textual y Top-1 vectorial exacto, validaciones temporales; el registro inserta la frase y marca el consumo en una única transacción.
- **B06 (revisado):** API REST v1, Problem Details (`ProblemDetailsFilter` global + filtros por ruta), referencia UUID temporal de validación HITL (no autenticación de usuarios) y CORS local con origen fijo. No hay Swagger UI, rate limiting ni cabeceras de seguridad adicionales.

Los contratos, invariantes, DTO, endpoints, códigos HTTP y políticas de IA, persistencia y seguridad se mantienen en sus documentos de origen; este bloque no los redefine.

## 2. Organización de los proyectos

```text
semantic-phrase-app/
├── apps/
│   ├── frontend/
│   │   ├── src/                  # Screaming Architecture ya aprobada
│   │   ├── .specify/             # Configuración y constitution de Spec Kit
│   │   ├── AGENTS.md
│   │   ├── package.json
│   │   ├── pnpm-lock.yaml
│   │   ├── .env.example
│   │   └── README.md
│   └── backend/
│       ├── src/                  # PhrasesModule: domain/application/infrastructure
│       ├── test/                 # E2E (*.e2e-spec.ts), fixtures/ y jest-e2e.json
│       ├── drizzle/migrations/   # Migraciones Drizzle Kit
│       ├── specs/                # Spec Kit 001-004
│       ├── .specify/
│       ├── AGENTS.md
│       ├── package.json
│       ├── pnpm-lock.yaml
│       ├── .env.example
│       └── README.md
├── compose.yaml                 # Infraestructura local compartida
├── .env.example                 # Variables de Docker Compose
├── docs/
│   └── 03-architecture/
│       ├── 01-system-overview.md
│       ├── 02-backend-architecture.md
│       ├── 03-frontend-architecture.md
│       ├── 04-ai-architecture.md
│       ├── 05-data-architecture.md
│       ├── 06-api-security.md
│       ├── openapi.yaml
│       └── 07-infrastructure-quality.md
└── README.md
```

Esta estructura es un resumen: cada aplicación incluye además `tsconfig.json`, ESLint, Prettier, `.env` y, en el backend, `drizzle.config.ts`. No existe `package.json`, `pnpm-lock.yaml` ni `pnpm-workspace.yaml` en la raíz. Cada aplicación es un repositorio Git independiente (submódulo). Los nombres antiguos `apps/web` y `apps/api` presentes en B01–B06 se corresponden, para la implementación, con `apps/frontend` y `apps/backend`, respectivamente. Las referencias del contrato REST no cambian.

## 3. Ejecución y configuración local

- **Frontend:** proceso Node.js con Vite en `http://localhost:5173`.
- **Backend:** proceso Node.js con NestJS en `http://localhost:3000`; prefijo global `api` y rutas `v1/...` (`/api/v1/phrases`, `/api/v1/phrase-validations`). No hay Swagger UI.
- **IA:** servicio `embeddings` de Docker Compose (imagen `ghcr.io/huggingface/text-embeddings-inference:cpu-arm64-1.9.4`, `platform: linux/arm64`), publicado en `127.0.0.1:8080` con el volumen `embeddings_data` y un healthcheck. NestJS no carga ningún modelo: llama a `AI_EMBEDDINGS_URL`. El backend ejecuta una inferencia de prueba al arrancar y termina con error si el servicio no responde.
- **Base de datos:** servicio `postgres` (`pgvector/pgvector:pg17`) en Docker Compose, sin healthcheck.

Orden de puesta en marcha previsto: instalar dependencias en cada aplicación; preparar variables locales; iniciar PostgreSQL y el servicio de embeddings con Compose (`docker compose up -d --wait`); aplicar migraciones Drizzle desde backend; iniciar backend y frontend en terminales independientes; comprobar listado, validación y confirmación HITL. Las versiones exactas de Node.js, pnpm, PostgreSQL y la imagen pgvector deben fijarse y comprobarse durante la implementación, no inventarse en esta especificación.

## 4. Docker Compose y PostgreSQL + pgvector

- Dos servicios en `compose.yaml`: `postgres` (PostgreSQL + pgvector) y `embeddings` (TEI), cada uno con un **volumen Docker persistente** (datos de PostgreSQL y caché del modelo `embeddings_data`).
- Compose vive en la **raíz del repositorio**, como infraestructura local común. El backend conserva sus propias variables de conexión y migraciones; el frontend no utiliza directamente PostgreSQL.
- Detener o recrear el servicio no debe borrar los datos almacenados en el volumen; la eliminación del volumen es una operación deliberada y documentada.
- Esquema gestionado mediante **Drizzle Kit** y SQL complementario cuando haga falta activar `vector` u otro DDL aprobado en B05.
- **Sin seed automático**, base adicional de testing, Testcontainers, colas, workers ni infraestructura complementaria.
- La conexión y las migraciones solo se ejecutan cuando el usuario invoca sus comandos; el frontend nunca se conecta directamente a PostgreSQL.

## 5. Variables de entorno y scripts

Cada aplicación tiene su `.env.example` versionado y `.env` local ignorado por Git. La raíz dispone también de `.env.example` para las variables utilizadas por `compose.yaml`. En el backend **no hay esquema de validación** (ni Zod): solo se comprueban `DATABASE_URL`, `AI_EMBEDDING_DIMENSIONS` (debe ser 384), `AI_MODEL` y `AI_EMBEDDING_VERSION`; `AI_EMBEDDINGS_URL` y `AI_INFERENCE_TIMEOUT_MS` no se validan.

| Ámbito                | Configuración y responsabilidades                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend`       | Solo configuración pública, por ejemplo `VITE_API_BASE_URL`; nunca secretos ni credenciales                                                                                                       |
| `apps/backend`        | `DATABASE_URL`, `PORT`, `AI_EMBEDDINGS_URL`, `AI_MODEL`, `AI_EMBEDDING_VERSION`, `AI_EMBEDDING_DIMENSIONS`, `AI_INFERENCE_TIMEOUT_MS`, `AI_SIMILARITY_THRESHOLD`, `PHRASE_VALIDATION_TTL_MINUTES` |
| Docker Compose (raíz) | Variables locales en `.env` raíz para credenciales y configuración de PostgreSQL, sin versionar valores sensibles                                                                                 |

No existen `CORS_ORIGINS` ni `RATE_LIMIT_*` (el origen CORS está fijo en `configureApp`). No se requiere secreto de firma.

**Scripts:** cada proyecto controla sus scripts en su propio `package.json`. Los del backend son:

| Aplicación | Scripts                                                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend   | Ver `apps/frontend/package.json` (fuera del alcance de este documento)                                                                                                                                                                         |
| Backend    | `build`, `start`, `start:dev`, `start:debug`, `start:prod`, `lint` (ejecuta ESLint con `--fix`, modifica archivos), `format` (Prettier con escritura), `test`, `test:watch`, `test:cov`, `test:debug`, `test:e2e`, `db:generate`, `db:migrate` |

No existen `dev`, `format:check`, `typecheck` ni `check` en el backend. La verificación local es `pnpm run build && pnpm test && pnpm run test:e2e`. No hay scripts pnpm en la raíz; Docker Compose se invoca desde allí.

## 6. Estrategia de testing

El backend tiene pruebas unitarias y e2e automatizadas. Sin objetivo mínimo de cobertura y sin snapshots masivos.

### Backend — Jest

Pruebas `*.spec.ts` colocalizadas (28 suites) para dominio, casos de uso, controladores, filtros, mappers, repositorios Drizzle (con cliente simulado) y el adaptador de embeddings (con `fetch` simulado), más 4 suites `test/*.e2e-spec.ts` con Supertest. Escenarios cubiertos:

- Validación sin coincidencia y detección de posible duplicado según el umbral.
- Confirmación HITL requerida cuando corresponda y prohibición de guardar sin la confirmación válida.
- Referencia de validación vencido, inválido, consumido o reutilizado.
- Fallos de embeddings o persistencia no confundidos con ausencia de coincidencias.
- Reutilización del embedding validado al registrar, sin ejecutar nueva inferencia.
- Invariantes de `Phrase` y `PhraseValidation` y reglas de listado pertinentes.

Ninguna prueba automatizada carga MiniLM, llama a TEI real ni arranca PostgreSQL: los e2e levantan `AppModule` con `configureApp` pero sustituyen repositorios, `EmbeddingGeneratorPort` y `ConfigurationPort`.

### Frontend — Vitest + React Testing Library + MSW

Tests cercanos a componentes y hooks que implementen comportamiento relevante: formulario, estados de carga y error, coincidencia, puntuación, advertencia HITL, confirmar/cancelar, expiración y prevención de doble envío. MSW simula la frontera HTTP, no el modelo de IA.

### Integración y E2E

Los e2e del backend (`pnpm run test:e2e`, `test/jest-e2e.json`) cubren el contrato HTTP con puertos simulados. No hay pruebas de integración contra PostgreSQL/pgvector ni TEI reales; esas comprobaciones son manuales en el entorno local. No se usan Testcontainers ni Playwright.

### Evaluación de IA

Se **conserva la evaluación experimental existente** de MiniLM como evidencia técnica. No se crea un script nuevo de benchmarking ni se incluye inferencia real en las pruebas del backend (la evaluación vive en `experiments/semantic-similarity/`). La evaluación previa no establece una meta obligatoria de accuracy; los cambios futuros de modelo, dimensiones o umbral deberán revalidar compatibilidad de embeddings y resultados antes de aplicarse.

## 7. Logging y manejo de errores

- Usar `Logger` nativo de NestJS en consola (`log`, `warn`, `error` y `debug` cuando se necesite).
- `ProblemDetailsFilter` (global) y los filtros específicos por ruta (B06) mapean errores controlados y excepciones HTTP a Problem Details.
- Diferenciar resultados funcionales de similitud (incluida la alerta HITL) de fallos técnicos.
- Se evita volcar credenciales y stacks al cliente. **Salvedad:** `DrizzlePhraseRepository` registra a nivel LOG el texto normalizado y el texto de la frase coincidente, y el adaptador de embeddings registra duración y los primeros componentes del vector; no se evitan los textos de frases en logs.
- Sin Pino, rotación de archivos, OpenTelemetry ni proveedores de observabilidad.

## 8. Calidad y validaciones estáticas

- **ESLint:** reglas recomendadas y adecuadas a cada proyecto; detectar problemas y código no utilizado donde aplique.
- **Prettier:** formato consistente (`pnpm run format` escribe; ESLint además comprueba Prettier). No existe `format:check`.
- **TypeScript:** configuración propia por aplicación. El `tsconfig.json` del backend **no** activa `strict`: solo `strictNullChecks`, con `noImplicitAny` y `strictPropertyInitialization` desactivados.
- Las reglas hexagonales y Screaming Architecture se documentan y revisan mediante SDD/Codex; sin plugins arquitectónicos especiales obligatorios.
- Las verificaciones son **locales y explícitas** (en el backend, `build`, `test`, `test:e2e` y `lint`), sin CI/CD, GitHub Actions, Git hooks obligatorios, Husky ni lint-staged.

## 9. Spec Kit y Codex: flujo AI-First + HITL

Cada aplicación cuenta con su propia `.specify/` (incluida su Constitution) y `AGENTS.md`, de forma que pueda desarrollarse por separado:

- **Frontend:** reglas de React y Screaming Architecture; hooks, componentes, accesos HTTP, contratos tipados y tests colocalizados.
- **Backend:** reglas de NestJS, arquitectura hexagonal, DDD ligero, puertos, casos de uso, TEI/LangChain, Drizzle y Jest.
- **Documentación común:** los documentos B01–B07 y `openapi.yaml` son fuente de decisiones y contrato compartido, sin duplicar su contenido íntegro en las instrucciones de agentes.

Flujo recomendado: **decisión humana → especificación Spec Kit → plan → tareas → implementación con Codex → verificación local (`build`, `test`, `test:e2e`) → revisión humana**. Los agentes no deben modificar contratos ni decisiones aprobadas de forma silenciosa. `AGENTS.md` contiene instrucciones operativas para Codex; la Constitution gobierna el flujo de Spec Kit cuando se usa, sin asumir que cualquier invocación informal del agente lee automáticamente toda la documentación.

## 10. README, evidencia y reproducibilidad

La entrega debe cumplir los cinco requisitos explícitos del reto:

1. **Frontend + backend:** ambos proyectos dentro de `apps/`, ejecutables de manera independiente.
2. **Migraciones SQL:** Drizzle Kit y SQL complementario para pgvector donde sea necesario.
3. **Instalación y ejecución:** `README.md` raíz como guía rápida y `README.md` propio en cada aplicación, con prerequisitos, versiones verificadas, configuración `.env.example`, Docker, migraciones, comandos y resolución básica de problemas.
4. **Arquitectura y decisiones:** explicación breve y enlaces a los documentos de `docs/03-architecture/` y `openapi.yaml`, sin exigir su lectura completa para probar el sistema.
5. **Evidencia Hugging Face:** mostrar dónde está el adaptador de embeddings (`HuggingFaceEmbeddingAdapter`) y reproducir una validación real con frases, coincidencia más próxima y puntuación observada; no inventar scores.

El README principal articula el orden completo de puesta en marcha. Los README individuales evitan dependencia documental entre proyectos y explican sus comandos específicos. Documentar expresamente que `docker compose` se ejecuta desde la raíz, cómo detener Compose conservando datos, cómo reiniciar una base vacía si se desea (`docker compose down -v` también borra el modelo descargado).

## 11. Exclusiones explícitas

Sin CI/CD, despliegue cloud, Kubernetes, microservicios, colas, Redis, agentes de observabilidad, orquestación de workspaces, empaquetado Docker del frontend/backend, proveedores de identidad, Testcontainers, métricas de cobertura obligatorias ni scripts nuevos de evaluación de IA.

## 12. Registro de decisiones aprobadas

| ID      | Elección final  | Alcance / observación                                                                                                                                                                            |
| ------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B07-D01 | **A**           | React y NestJS locales; PostgreSQL en Docker Compose                                                                                                                                             |
| B07-D02 | **A**           | Servicio PostgreSQL + pgvector con volumen persistente y sin seed automático; `compose.yaml` ubicado en la raíz por ajuste posterior confirmado                                                  |
| B07-D03 | **C, parcial**  | `.env` independientes y `.env.example`; la validación tipada al inicio **no** está implementada                                                                                                  |
| B07-D04 | **B, adaptada** | Inicialmente scripts independientes (A), luego se aprobó centralizar comandos para un workspace; tras descartar pnpm workspaces se mantienen scripts **por aplicación**, sin `package.json` raíz |
| B07-D05 | **A**           | Pruebas unitarias para lógica y escenarios críticos                                                                                                                                              |
| B07-D06 | **Revisada**    | Hay e2e con Supertest en el backend (puertos simulados); sin integración contra PostgreSQL/TEI reales                                                                                            |
| B07-D07 | **A**           | Mantener la evaluación existente de IA; sin scripts nuevos                                                                                                                                       |
| B07-D08 | **A**           | Logger nativo de NestJS; `ProblemDetailsFilter` y filtros por ruta                                                                                                                               |
| B07-D09 | **B, adaptada** | Calidad estática mínima; configuración **independiente** por aplicación tras separar proyectos                                                                                                   |
| B07-D10 | **Revisada**    | No existe `pnpm check`; cada aplicación se verifica con sus propios scripts                                                                                                                      |
| B07-D11 | **B**           | Constitution, Spec Kit y AGENTS.md independientes por aplicación                                                                                                                                 |
| B07-D12 | **B**           | README principal y README de cada aplicación                                                                                                                                                     |

### Cambio transversal a bloques anteriores

**Se reemplaza B01-D02 únicamente en organización física y gestión de dependencias:** dos proyectos separados bajo `apps/frontend/` y `apps/backend/`, con locks y scripts independientes. Se conservan todos los acuerdos sobre arquitectura interna, API REST, IA, persistencia, seguridad, testing y HITL. La nueva estructura no constituye autorización para modificar otros contratos de B01–B06.

**Estado de entrega:** backend y frontend implementados como repositorios independientes; `compose.yaml` levanta PostgreSQL/pgvector y TEI. No hay `Dockerfile` del backend ni CI/CD (el `.dockerignore` del backend es un resto sin uso).
