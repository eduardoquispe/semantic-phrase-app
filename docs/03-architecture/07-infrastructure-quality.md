# Bloque 07 — Entorno Local, Testing y Calidad

Cambio incompatible (2026-10-22): `validationId` sustituye a `validationToken`, sin alias.
Se devuelve el UUID v4 aleatorio de la validación persistida, sin firma ni JWT.
Los JWT anteriores dejan de formar parte del contrato; las filas existentes pueden
referenciarse por su UUID. No hay migración ni secreto de firma requerido.
El registro queda fuera de F002: deberá buscar por `validationId`, comprobar
vigencia (`now >= expiresAt` implica expiración), texto, confirmación y estado no
consumido, y consumir la validación atómicamente con el guardado de la frase.
TTL configurable inicialmente de 15 minutos; respuesta y fila comparten expiración.


**Proyecto:** Semantic Phrase App  
**Estado:** Aprobado — B07-D01 a B07-D12, con ajustes posteriores expresamente confirmados  
**Fecha:** 21 de octubre de 2026  
**Ruta objetivo:** `docs/03-architecture/07-infrastructure-quality.md`  
**Alcance:** diseño documental para un reto técnico Fullstack AI ejecutado exclusivamente en local. Este documento no implementa ni inicializa proyectos.

## 1. Visión general y decisiones heredadas

El entregable contiene dos aplicaciones **independientes**, alojadas bajo `apps/`: un frontend React y un backend NestJS. Cada una dispone de su propio `package.json`, `pnpm-lock.yaml`, dependencias, scripts, configuración, pruebas y flujo Spec Kit. **No se utiliza pnpm workspaces, Turborepo ni otro orquestador.** La carpeta superior agrupa ambos proyectos y la documentación para entregar el reto.

Se conservan las decisiones funcionales y arquitectónicas de los bloques anteriores:

- **B01:** React, NestJS, REST síncrono, backend hexagonal, frontend Screaming Architecture y confirmación humana ante posibles duplicados. **Se sustituye exclusivamente B01-D02**: la organización aprobada originalmente como monorepo con pnpm workspaces pasa a dos proyectos independientes bajo `apps/`.
- **B02:** `PhrasesModule`, DDD ligero, agregados `Phrase` y `PhraseValidation`, puertos, casos de uso `ValidatePhraseUseCase`, `CreatePhraseUseCase` y `ListPhrasesUseCase`; Jest en backend.
- **B03:** organización de React por funcionalidades; Vitest, React Testing Library y MSW; tests colocalizados; TanStack Query, Axios, React Hook Form/Zod y demás decisiones frontend ya aprobadas.
- **B04:** MiniLM de Hugging Face ejecutado localmente mediante LangChain y ONNX q8; embeddings de 384 dimensiones, mean pooling y normalización L2; umbral inicial configurable `0.8538613695045911`, sin garantía de exactitud perfecta ni modelo adicional.
- **B05:** PostgreSQL + pgvector, Drizzle ORM y migraciones Drizzle Kit; comparación textual y Top-1 vectorial exacto, validaciones temporales y registro/consumo atómico.
- **B06:** API REST v1, Problem Details, filtro global de excepciones, referencia UUID temporal de validación HITL (no autenticación de usuarios), CORS local, Swagger local, rate limiting y configuración de seguridad aprobada.

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
│       ├── test/                 # Reservado para pruebas adicionales futuras
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

Esta estructura es **conceptual**: archivos de configuración adicionales (`tsconfig.json`, ESLint, Prettier, `.env`, Drizzle) se crearán durante la implementación. No existe `package.json`, `pnpm-lock.yaml` ni `pnpm-workspace.yaml` en la raíz. La independencia es de instalación y ejecución, no implica repositorios Git separados obligatorios. Los nombres antiguos `apps/web` y `apps/api` presentes en B01–B06 se corresponden, para la implementación, con `apps/frontend` y `apps/backend`, respectivamente. Las referencias del contrato REST no cambian.

## 3. Ejecución y configuración local

- **Frontend:** proceso Node.js con Vite en `http://localhost:5173`.
- **Backend:** proceso Node.js con NestJS en `http://localhost:3000`; prefijo REST `/api/v1`; Swagger UI `/api/docs`.
- **IA:** MiniLM se ejecuta dentro del proceso backend, sin contenedor, Python ni servidor de inferencia adicional.
- **Base de datos:** PostgreSQL y extensión pgvector mediante un único servicio Docker Compose.

Orden de puesta en marcha previsto: instalar dependencias en cada aplicación; preparar variables locales; iniciar PostgreSQL con Compose; aplicar migraciones Drizzle desde backend; iniciar backend y frontend en terminales independientes; comprobar listado, validación y confirmación HITL. Las versiones exactas de Node.js, pnpm, PostgreSQL y la imagen pgvector deben fijarse y comprobarse durante la implementación, no inventarse en esta especificación.

## 4. Docker Compose y PostgreSQL + pgvector

- Un solo servicio PostgreSQL con soporte pgvector y un **volumen Docker persistente**.
- Compose vive en la **raíz del repositorio**, como infraestructura local común. El backend conserva sus propias variables de conexión y migraciones; el frontend no utiliza directamente PostgreSQL.
- Detener o recrear el servicio no debe borrar los datos almacenados en el volumen; la eliminación del volumen es una operación deliberada y documentada.
- Esquema gestionado mediante **Drizzle Kit** y SQL complementario cuando haga falta activar `vector` u otro DDL aprobado en B05.
- **Sin seed automático**, base adicional de testing, Testcontainers, colas, workers ni infraestructura complementaria.
- La conexión y las migraciones solo se ejecutan cuando el usuario invoca sus comandos; el frontend nunca se conecta directamente a PostgreSQL.

## 5. Variables de entorno y scripts

Cada aplicación tendrá su `.env.example` versionado y `.env` local ignorado por Git. La raíz dispondrá también de `.env.example` para las variables utilizadas por `compose.yaml` y de un `.env` local no versionado, si se necesita. La configuración se valida de manera tipada al iniciar; reutilizar Zod cuando corresponda y evitar frameworks extra de configuración.

| Ámbito | Configuración y responsabilidades |
|---|---|
| `apps/frontend` | Solo configuración pública, por ejemplo `VITE_API_BASE_URL`; nunca secretos ni credenciales |
| `apps/backend` | Conexión a PostgreSQL, modelo/configuración de IA, umbral, puerto, CORS, TTL y rate limit |
| Docker Compose (raíz) | Variables locales en `.env` raíz para credenciales y configuración de PostgreSQL, sin versionar valores sensibles |


Preservar `PORT`, `CORS_ORIGINS`, `PHRASE_VALIDATION_TTL_MINUTES`, `RATE_LIMIT_TTL_MS`, `RATE_LIMIT_MAX` y `AI_SIMILARITY_THRESHOLD` cuando proceda. No se requiere secreto de firma.

**Scripts:** cada proyecto controla sus scripts en su propio `package.json`.

| Aplicación | Scripts previstos |
|---|---|
| Frontend | `dev`, `test`, `lint`, `format:check`, `typecheck`, `check` y scripts de build pertinentes |
| Backend | `dev`, `test`, `lint`, `format:check`, `typecheck`, `check`, migraciones Drizzle; operaciones Compose desde la raíz, documentadas en el README principal |

Cada `pnpm check` encadena **ESLint → Prettier en modo comprobación → TypeScript → pruebas unitarias** y devuelve error al fallar una etapa. No modifica código, no levanta Docker ni ejecuta inferencia real. No hay scripts pnpm centralizados en el directorio raíz; Docker Compose se invoca desde allí. Los comandos y versiones exactos se verificarán cuando existan los proyectos.

## 6. Estrategia de testing

Las **únicas pruebas automatizadas inicialmente obligatorias son las unitarias relevantes**. Sin objetivo mínimo de cobertura y sin snapshots masivos.

### Backend — Jest

Pruebas `*.spec.ts` colocalizadas para reglas de dominio y casos de uso, empleando dobles de los puertos outbound. Escenarios prioritarios:

- Validación sin coincidencia y detección de posible duplicado según el umbral.
- Confirmación HITL requerida cuando corresponda y prohibición de guardar sin la confirmación válida.
- Referencia de validación vencido, inválido, consumido o reutilizado.
- Fallos de embeddings o persistencia no confundidos con ausencia de coincidencias.
- Reutilización del embedding validado al registrar, sin ejecutar nueva inferencia.
- Invariantes de `Phrase` y `PhraseValidation` y reglas de listado pertinentes.

Las pruebas unitarias no cargan MiniLM ni arrancan PostgreSQL. No se simula el comportamiento interno de infraestructura más allá del contrato necesario para ejercitar la lógica.

### Frontend — Vitest + React Testing Library + MSW

Tests cercanos a componentes y hooks que implementen comportamiento relevante: formulario, estados de carga y error, coincidencia, puntuación, advertencia HITL, confirmar/cancelar, expiración y prevención de doble envío. MSW simula la frontera HTTP, no el modelo de IA.

### Integración y E2E

No se implementan pruebas automatizadas de integración ni E2E inicialmente. Podrán introducirse después mediante una nueva decisión si aparece un riesgo real. El flujo de extremo a extremo, Drizzle/pgvector y MiniLM se comprobarán manualmente en el entorno local. No incorporar Testcontainers ni Playwright por defecto.

### Evaluación de IA

Se **conserva la evaluación experimental existente** de MiniLM como evidencia técnica. No se crea un script nuevo de benchmarking ni se incluye inferencia real en `pnpm check`. La evaluación previa no establece una meta obligatoria de accuracy; los cambios futuros de modelo, dimensiones o umbral deberán revalidar compatibilidad de embeddings y resultados antes de aplicarse.

## 7. Logging y manejo de errores

- Usar `Logger` nativo de NestJS en consola (`log`, `warn`, `error` y `debug` cuando se necesite).
- Reutilizar el **único** `GlobalExceptionFilter` definido en B06; mapea errores controlados y excepciones HTTP a Problem Details, sin cambiar el catálogo aprobado.
- Diferenciar resultados funcionales de similitud (incluida la alerta HITL) de fallos técnicos.
- Registrar contexto técnico suficiente sin volcar credenciales, stacks al cliente ni textos completos de frases innecesariamente.
- Sin Pino, rotación de archivos, OpenTelemetry ni proveedores de observabilidad.

## 8. Calidad y validaciones estáticas

- **ESLint:** reglas recomendadas y adecuadas a cada proyecto; detectar problemas y código no utilizado donde aplique.
- **Prettier:** formato consistente, verificado sin modificaciones mediante `format:check`.
- **TypeScript:** modo estricto (`strict: true`) con configuración propia de frontend y backend.
- Las reglas hexagonales y Screaming Architecture se documentan y revisan mediante SDD/Codex; sin plugins arquitectónicos especiales obligatorios.
- Las verificaciones son **locales y explícitas** (`pnpm check` por aplicación), sin CI/CD, GitHub Actions, Git hooks obligatorios, Husky ni lint-staged.

## 9. Spec Kit y Codex: flujo AI-First + HITL

Cada aplicación cuenta con su propia `.specify/` (incluida su Constitution) y `AGENTS.md`, de forma que pueda desarrollarse por separado:

- **Frontend:** reglas de React y Screaming Architecture; hooks, componentes, accesos HTTP, contratos tipados y tests colocalizados.
- **Backend:** reglas de NestJS, arquitectura hexagonal, DDD ligero, puertos, casos de uso, MiniLM/LangChain, Drizzle y Jest.
- **Documentación común:** los documentos B01–B07 y `openapi.yaml` son fuente de decisiones y contrato compartido, sin duplicar su contenido íntegro en las instrucciones de agentes.

Flujo recomendado: **decisión humana → especificación Spec Kit → plan → tareas → implementación con Codex → `pnpm check` local → revisión humana**. Los agentes no deben modificar contratos ni decisiones aprobadas de forma silenciosa. `AGENTS.md` contiene instrucciones operativas para Codex; la Constitution gobierna el flujo de Spec Kit cuando se usa, sin asumir que cualquier invocación informal del agente lee automáticamente toda la documentación.

## 10. README, evidencia y reproducibilidad

La entrega debe cumplir los cinco requisitos explícitos del reto:

1. **Frontend + backend:** ambos proyectos dentro de `apps/`, ejecutables de manera independiente.
2. **Migraciones SQL:** Drizzle Kit y SQL complementario para pgvector donde sea necesario.
3. **Instalación y ejecución:** `README.md` raíz como guía rápida y `README.md` propio en cada aplicación, con prerequisitos, versiones verificadas, configuración `.env.example`, Docker, migraciones, comandos y resolución básica de problemas.
4. **Arquitectura y decisiones:** explicación breve y enlaces a los documentos de `docs/03-architecture/` y `openapi.yaml`, sin exigir su lectura completa para probar el sistema.
5. **Evidencia Hugging Face:** mostrar dónde está el adaptador MiniLM y reproducir una validación real con frases, coincidencia más próxima y puntuación observada; no inventar scores.

El README principal articula el orden completo de puesta en marcha. Los README individuales evitan dependencia documental entre proyectos y explican sus comandos específicos. Documentar expresamente que `docker compose` se ejecuta desde la raíz, cómo detener Compose conservando datos, cómo reiniciar una base vacía si se desea y cómo acceder a Swagger local.

## 11. Exclusiones explícitas

Sin CI/CD, despliegue cloud, Kubernetes, microservicios, colas, Redis, agentes de observabilidad, orquestación de workspaces, empaquetado Docker del frontend/backend, proveedores de identidad, pruebas E2E obligatorias, Testcontainers, métricas de cobertura obligatorias ni scripts nuevos de evaluación de IA.

## 12. Registro de decisiones aprobadas

| ID | Elección final | Alcance / observación |
|---|---|---|
| B07-D01 | **A** | React y NestJS locales; PostgreSQL en Docker Compose |
| B07-D02 | **A** | Servicio PostgreSQL + pgvector con volumen persistente y sin seed automático; `compose.yaml` ubicado en la raíz por ajuste posterior confirmado |
| B07-D03 | **C** | `.env` independientes, `.env.example` y validación tipada al inicio |
| B07-D04 | **B, adaptada** | Inicialmente scripts independientes (A), luego se aprobó centralizar comandos para un workspace; tras descartar pnpm workspaces se mantienen scripts **por aplicación**, sin `package.json` raíz |
| B07-D05 | **A** | Pruebas unitarias para lógica y escenarios críticos |
| B07-D06 | **A** | Sin integración ni E2E automatizadas inicialmente |
| B07-D07 | **A** | Mantener la evaluación existente de IA; sin scripts nuevos |
| B07-D08 | **A** | Logger nativo de NestJS; filtro global de B06 |
| B07-D09 | **B, adaptada** | Calidad estática mínima; configuración **independiente** por aplicación tras separar proyectos |
| B07-D10 | **B, adaptada** | `pnpm check` **en cada aplicación**, no centralizado en la raíz |
| B07-D11 | **B** | Constitution, Spec Kit y AGENTS.md independientes por aplicación |
| B07-D12 | **B** | README principal y README de cada aplicación |

### Cambio transversal a bloques anteriores

**Se reemplaza B01-D02 únicamente en organización física y gestión de dependencias:** dos proyectos separados bajo `apps/frontend/` y `apps/backend/`, con locks y scripts independientes. Se conservan todos los acuerdos sobre arquitectura interna, API REST, IA, persistencia, seguridad, testing y HITL. La nueva estructura no constituye autorización para modificar otros contratos de B01–B06.

**Estado de entrega:** documentación solamente. No hay código de aplicación, proyecto inicializado, migraciones ejecutadas ni base levantada como consecuencia de este bloque.
