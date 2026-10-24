# Semantic Phrase App

Aplicación tipo lista de frases donde el usuario registra oraciones cortas y, antes
de guardarlas, valida si son semánticamente parecidas a una ya existente usando un
modelo de Hugging Face. Ver el enunciado original en
[`docs/00-discovery/reto-tecnico.md`](docs/00-discovery/reto-tecnico.md).

## Arquitectura

- **Frontend:** React + Vite + TypeScript (`apps/frontend`), organizado por
  funcionalidad (Screaming Architecture).
- **Backend:** NestJS + TypeScript (`apps/backend`), arquitectura hexagonal
  (`domain` / `application` / `infrastructure`).
- **Base de datos:** PostgreSQL + `pgvector`, migraciones con Drizzle (ORM).
- **IA:** embeddings de Hugging Face servidos por **Text Embeddings Inference
  (TEI)** y consumidos desde el backend vía LangChain; similitud por distancia
  coseno en PostgreSQL/pgvector.
- **Human-in-the-loop:** si una frase nueva es muy parecida a una existente, el
  backend pide confirmación antes de guardarla.

### Diagrama BigPicture

```mermaid
flowchart LR
    U[Usuario] --> FE["Frontend React\n:5173"]
    FE <-->|REST /api/v1| BE["Backend NestJS\n:3000"]
    BE <-->|coincidencia exacta +\nsimilitud coseno Top-1| PG[("PostgreSQL + pgvector\n:5432")]
    BE <-->|embeddings HTTP| TEI["HF Text Embeddings Inference\n:8080"]
```

### Diagrama de secuencia (caso principal)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant TEI as Embeddings (TEI)
    participant DB as PostgreSQL + pgvector
    U->>FE: 1. Escribe la frase y pulsa Validar
    FE->>BE: 2. Solicita validar la frase
    BE->>TEI: 3. Genera el embedding
    TEI-->>BE: Vector
    BE->>DB: 4. Busca la frase más parecida
    DB-->>BE: Frase similar + score
    BE->>DB: 5. Guarda la validación temporal
    BE-->>FE: 6. Resultado + score + referencia
    alt Usuario cancela
        U->>FE: 7. Cancela
        Note over FE,DB: No se guarda la frase, la validación expira
    else Usuario confirma (o no había duplicado)
        U->>FE: 7. Confirma
        FE->>BE: 8. Solicita guardar con la referencia
        BE->>DB: 8. Verifica la validación, inserta la frase y la marca como consumida
        BE-->>FE: 9. Frase guardada
    end
```

1. El usuario escribe una frase nueva en el frontend y pulsa **Validar**.
2. El frontend llama al backend (`POST /api/v1/phrase-validations`) con el texto.
3. El backend pide el embedding de la frase al servicio de embeddings (TEI), a
   través del adaptador de LangChain.
4. El backend busca en PostgreSQL/pgvector la frase guardada más parecida
   (coincidencia textual exacta o similitud coseno Top-1) y obtiene su score.
5. El backend guarda en PostgreSQL una validación temporal con el embedding y
   expiración, identificada por `validationId`.
6. El backend responde al frontend con la frase más parecida (si existe), el
   `similarityScore` y si requiere confirmación (`requiresConfirmation`).
7. Si hay posible duplicado, el frontend muestra la alerta con el score y la frase
   parecida; el usuario cancela (no se guarda nada y la validación expira) o
   confirma.
8. Si el usuario confirma (o no había duplicado), el frontend llama al backend
   (`POST /api/v1/phrases`) con el `validationId` y, cuando `requiresConfirmation`
   es `true`, con `confirmed: true` (sin él, 409 `CONFIRMATION_REQUIRED`). El
   backend verifica la validación (existe, vigente, no consumida, mismo texto y
   modelo), inserta la frase reutilizando el embedding ya calculado (sin volver a
   llamar al modelo) y marca la validación como consumida, todo en una única
   transacción.
9. El backend responde al frontend con la frase guardada.

### Mapa de `docs/`

| Archivo                                                                                                  | Para qué sirve                                                                                          |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`docs/00-discovery/reto-tecnico.md`](docs/00-discovery/reto-tecnico.md)                                 | Enunciado original del reto técnico                                                                     |
| [`docs/00-discovery/product-brief.md`](docs/00-discovery/product-brief.md)                               | Brief de producto: alcance, actores y criterios de éxito trazados al reto                               |
| [`docs/01-ai-feasibility/experiment-plan.md`](docs/01-ai-feasibility/experiment-plan.md)                 | Plan de experimentación para evaluar modelos de Hugging Face candidatos                                 |
| [`docs/01-ai-feasibility/model-decision.md`](docs/01-ai-feasibility/model-decision.md)                   | Comparación de modelos (MiniLM, E5-small, DistilUSE, BGE-M3) y justificación del modelo/umbral elegidos |
| [`docs/02-ui/ui-spec.md`](docs/02-ui/ui-spec.md)                                                         | Especificación de UI/UX: estados, componentes, accesibilidad                                            |
| [`docs/03-architecture/01-system-overview.md`](docs/03-architecture/01-system-overview.md)               | Visión general de la arquitectura aprobada (histórica; ver diagrama arriba para el estado actual)       |
| [`docs/03-architecture/02-backend-architecture.md`](docs/03-architecture/02-backend-architecture.md)     | Arquitectura hexagonal del backend NestJS, casos de uso y puertos                                       |
| [`docs/03-architecture/03-frontend-architecture.md`](docs/03-architecture/03-frontend-architecture.md)   | Arquitectura del frontend (Screaming Architecture, estado, testing)                                     |
| [`docs/03-architecture/04-ai-architecture.md`](docs/03-architecture/04-ai-architecture.md)               | Diseño de la integración de IA: adaptador, pipeline de embeddings, umbral                               |
| [`docs/03-architecture/05-data-architecture.md`](docs/03-architecture/05-data-architecture.md)           | Diseño de datos: esquema PostgreSQL/pgvector, queries de similitud, migraciones                         |
| [`docs/03-architecture/06-api-security.md`](docs/03-architecture/06-api-security.md)                     | Contrato REST, catálogo de errores (Problem Details), seguridad/CORS                                    |
| [`docs/03-architecture/07-infrastructure-quality.md`](docs/03-architecture/07-infrastructure-quality.md) | Entorno local, testing, calidad y los requisitos de entrega del reto                                    |
| [`docs/03-architecture/openapi.yaml`](docs/03-architecture/openapi.yaml)                                 | Contrato OpenAPI 3.1 de la API                                                                          |
| [`docs/templates/product-brief-template.md`](docs/templates/product-brief-template.md)                   | Plantilla usada para redactar el product brief                                                          |

### Spec-Driven Development

Además de `docs/03-architecture/` (decisiones a nivel de monorepo), cada aplicación
define su propio comportamiento esperado **antes de implementar**, con Spec Kit:

- **Backend** (`apps/backend/specs/`): [`001-list-phrases`](apps/backend/specs/001-list-phrases/spec.md), [`002-semantic-similarity-validation`](apps/backend/specs/002-semantic-similarity-validation/spec.md), [`003-register-phrases-hitl`](apps/backend/specs/003-register-phrases-hitl/spec.md), [`004-soft-delete-phrases`](apps/backend/specs/004-soft-delete-phrases/spec.md) — cada carpeta incluye `spec.md` (criterios de aceptación y casos borde), `plan.md`, `tasks.md`, `data-model.md` y contratos.
- **Frontend** (`apps/frontend/specs/`): [`001-main-phrase-list`](apps/frontend/specs/001-main-phrase-list/spec.md), [`002-list-phrases`](apps/frontend/specs/002-list-phrases/spec.md), [`003-validate-phrases`](apps/frontend/specs/003-validate-phrases/spec.md), [`004-create-phrases`](apps/frontend/specs/004-create-phrases/spec.md), [`005-delete-phrase`](apps/frontend/specs/005-delete-phrase/spec.md).

## Evaluación del modelo

Antes de integrar un modelo de Hugging Face en el backend se comparó su calidad y
costo en [`experiments/semantic-similarity/`](experiments/semantic-similarity) (script
de benchmarking + datasets de calibración/holdout). Se evaluaron MiniLM, E5-small,
DistilUSE y BGE-M3 en latencia, memoria, dimensiones y precisión de pares
etiquetados; el detalle y la justificación de la elección final (MiniLM 384d +
umbral `0.8538613695045911`) están en
[`docs/01-ai-feasibility/model-decision.md`](docs/01-ai-feasibility/model-decision.md).
Ese documento también deja explícito que la evaluación es evidencia técnica para el
contexto del proyecto, no una certificación de calidad en producción.

## Prerequisitos

- [Git](https://git-scm.com/downloads) (para clonar el repo y sus submódulos).
- [Node.js](https://nodejs.org/) 22.x y [pnpm](https://pnpm.io/) (`npm i -g pnpm`).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (el servicio
  `embeddings` está fijado a `linux/arm64`; en otra arquitectura hay que ajustar la
  imagen/plataforma en `compose.yaml`).

## Instalación y ejecución

Guía paso a paso para levantar todo el entorno desde cero (útil si es la primera
vez que lo haces).

1. **Clonar con submódulos** — frontend y backend viven en repos aparte bajo
   `apps/`, así que un `git clone` normal los deja vacíos:

   ```sh
   git clone --recurse-submodules <url-del-repo>
   # si ya clonaste sin submódulos:
   git submodule update --init --recursive
   ```

2. **Copiar las variables de entorno de ejemplo** — cada app (raíz, backend,
   frontend) tiene su propio `.env.example` con valores que ya funcionan en
   local; copiarlos a `.env` evita tener que configurar nada a mano (ver detalle
   en [Variables de entorno](#variables-de-entorno)):

   ```sh
   cp .env.example .env
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.example apps/frontend/.env
   ```

3. **Levantar PostgreSQL y el servicio de embeddings** desde la raíz — el
   backend los necesita arriba antes de arrancar:

   ```sh
   docker compose up -d --wait
   ```

   La primera vez, `embeddings` descarga el modelo desde Hugging Face y puede
   tardar varios minutos (requiere Internet). Las siguientes veces arranca desde
   el volumen `embeddings_data`.

   **Checkpoint** — confirma que ambos servicios están arriba antes de seguir:

   ```sh
   docker compose ps                  # postgres y embeddings: running / healthy
   curl http://127.0.0.1:8080/health  # debe responder 200
   ```

4. **Backend** — deja esta terminal corriendo (vas a necesitar una segunda para
   el frontend en el paso 5):

   ```sh
   cd apps/backend
   pnpm install
   pnpm db:migrate
   pnpm start:dev
   ```

   Debe mostrar `Nest application successfully started` y quedar escuchando en
   `http://localhost:3000`, con prefijo `/api` (rutas reales `/api/v1/phrases` y
   `/api/v1/phrase-validations`).

5. **Frontend** — abre una **segunda terminal** (la del backend debe seguir
   corriendo) y en ella:

   ```sh
   cd apps/frontend
   pnpm install
   pnpm dev
   ```

   Queda disponible en `http://localhost:5173`.

6. **Verificación manual**: abrir el frontend, crear una frase, escribir una
   frase parecida y pulsar "Validar" para ver la alerta de posible duplicado, y
   confirmar o cancelar el guardado. Si algo no arranca, revisa
   [Troubleshooting](#docker-compose-detener-y-reiniciar) más abajo.

## Variables de entorno

Cada app tiene su propio `.env` (copiado del `.env.example` correspondiente en el
paso 2); estas tablas documentan esas variables, pero el archivo real a editar
vive en la carpeta de cada app, no en la raíz.

### Raíz / Docker Compose

Usadas por [`compose.yaml`](compose.yaml). Archivo real: [`.env.example`](.env.example) → `.env`.

| Variable            | Valor por defecto | Descripción                                      |
| ------------------- | ----------------- | ------------------------------------------------ |
| `POSTGRES_USER`     | `semantic`        | Usuario del contenedor de PostgreSQL             |
| `POSTGRES_PASSWORD` | `semantic`        | Contraseña del contenedor de PostgreSQL          |
| `POSTGRES_DB`       | `semantic_phrase` | Nombre de la base de datos                       |
| `POSTGRES_PORT`     | `5432`            | Puerto del host mapeado al `5432` del contenedor |

### Backend

Archivo real: [`apps/backend/.env.example`](apps/backend/.env.example) → `apps/backend/.env`. Detalle completo en [`apps/backend/README.md`](apps/backend/README.md#variables-de-entorno).

| Variable                        | Requerida | Valor de ejemplo / por defecto                                  | Descripción                                          |
| ------------------------------- | --------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`                  | Sí        | `postgresql://semantic:semantic@localhost:5432/semantic_phrase` | Conexión a PostgreSQL (también la usa `drizzle-kit`) |
| `PORT`                          | No        | `3000`                                                          | Puerto HTTP del backend                              |
| `AI_EMBEDDINGS_URL`             | Sí        | `http://127.0.0.1:8080`                                         | URL del servicio de embeddings (TEI)                 |
| `AI_MODEL`                      | Sí        | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`   | Modelo de Hugging Face usado                         |
| `AI_EMBEDDING_VERSION`          | Sí        | `tei-9674a558…764b3`                                            | Identidad del runtime/perfil del modelo              |
| `AI_EMBEDDING_DIMENSIONS`       | Sí        | `384`                                                           | Debe ser `384` o el backend no arranca               |
| `AI_INFERENCE_TIMEOUT_MS`       | Sí        | `5000`                                                          | Timeout de inferencia del modelo                     |
| `AI_SIMILARITY_THRESHOLD`       | Si        | `0.8538613695045911`                                            | Umbral coseno (inclusivo) para exigir confirmación   |
| `PHRASE_VALIDATION_TTL_MINUTES` | No        | `15`                                                            | Vigencia de una validación temporal                  |

### Frontend

Archivo real: [`apps/frontend/.env.example`](apps/frontend/.env.example) → `apps/frontend/.env`. Detalle completo en [`apps/frontend/README.md`](apps/frontend/README.md#variables-de-entorno).

| Variable            | Valor local                 | Descripción                                                     |
| ------------------- | --------------------------- | --------------------------------------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | Base URL que usa el cliente HTTP (Axios) para llamar al backend |

Si cambias las credenciales en el `.env` raíz, recuerda actualizar también
`DATABASE_URL` en `apps/backend/.env` para que sigan coincidiendo.

## Docker Compose: detener y reiniciar

```sh
docker compose stop        # detiene postgres y embeddings, conserva los volúmenes
docker compose up -d       # vuelve a levantarlos con los mismos datos
docker compose down -v     # ADVERTENCIA: borra también los volúmenes (datos y modelo descargado)
docker compose restart embeddings   # reinicia solo el servicio de embeddings
```

## Evidencia de integración con Hugging Face

El adaptador que llama al modelo de Hugging Face está en
[`apps/backend/src/modules/phrases/infrastructure/embeddings/huggin-face/hugging-face-embedding.adapter.ts`](apps/backend/src/modules/phrases/infrastructure/embeddings/huggin-face/hugging-face-embedding.adapter.ts).
Usa LangChain para llamar al servicio `embeddings` (Hugging Face Text Embeddings
Inference) definido en `compose.yaml`, que sirve el modelo
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384 dimensiones). El
umbral de similitud para considerar una frase como posible duplicado es
configurable vía `AI_SIMILARITY_THRESHOLD` (`apps/backend/.env`).

### Demo: flujo completo + logs del contenedor de Hugging Face y del backend

![Demo del flujo de validación semántica, con logs del contenedor de Hugging Face y del backend](https://i.ibb.co/XZwXj0GB/demo.gif)

### Código: generación de embeddings y búsqueda vectorial

| Generación de embeddings (`HuggingFaceEmbeddingAdapter`)                                                                | Búsqueda vectorial (repositorio Drizzle/pgvector)                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ![Función que genera embeddings llamando al modelo de Hugging Face](https://i.ibb.co/tpgPyhTb/convertir-embeddings.png) | ![Consulta de similitud coseno Top-1 contra pgvector](https://i.ibb.co/GZzDcvY/busqueda-vectorial.png) |

### UI: resultado de una validación semántica

![Frontend mostrando la alerta de posible duplicado con la frase más parecida y su score](https://i.ibb.co/qYjshBbH/frase-validada.png)

### Reproducir la validación

Con el stack levantado (pasos 1-5 de arriba):

```sh
# 1) Guardar una frase base: primero se valida (para obtener un validationId)
curl -s -X POST http://localhost:3000/api/v1/phrase-validations \
  -H 'Content-Type: application/json' \
  -d '{"text":"Me gusta mucho la programación"}'

# usar el validationId de la respuesta anterior para guardarla:
curl -s -X POST http://localhost:3000/api/v1/phrases \
  -H 'Content-Type: application/json' \
  -d '{"text":"Me gusta mucho la programación","validationId":"<validationId del paso anterior>"}'

# 2) Validar una frase semánticamente parecida (sin guardarla)
curl -s -X POST http://localhost:3000/api/v1/phrase-validations \
  -H 'Content-Type: application/json' \
  -d '{"text":"me encanta la programación"}'
```

Respuesta real capturada del segundo `POST /api/v1/phrase-validations` (score sin
inventar, generado por el modelo contra la frase guardada en el paso 1):

```json
{
  "data": {
    "validationId": "b88e10cb-d965-4eb7-ae15-4e95580b82d1",
    "expiresAt": "2026-10-24T14:35:12.000Z",
    "requiresConfirmation": true,
    "match": {
      "type": "vector",
      "phrase": {
        "id": "6a724a19-c268-4d2d-b103-21bcc2949ccc",
        "text": "Me gusta mucho la programación"
      },
      "similarityScore": 0.9507026389031854
    }
  }
}
```

## Tests

```sh
cd apps/backend && pnpm test         # unitarias (o pnpm test:cov)
cd apps/backend && pnpm test:e2e     # HTTP con puertos simulados (sin Postgres ni TEI)
cd apps/frontend && pnpm test
```

Tests que cubren puntualmente el flujo de validación semántica + guardado (HITL):

- Backend: [`validate-phrase.use-case.spec.ts`](apps/backend/src/modules/phrases/application/use-cases/validate-phrase.use-case.spec.ts) (reglas de similitud/umbral), [`phrase-validations.e2e-spec.ts`](apps/backend/test/phrase-validations.e2e-spec.ts) y [`phrase-registration.e2e-spec.ts`](apps/backend/test/phrase-registration.e2e-spec.ts) (validar → confirmar → guardar de punta a punta).
- Frontend: [`validate-phrase.hook.spec.tsx`](apps/frontend/src/features/phrases/hooks/validate-phrase.hook.spec.tsx), [`save-phrase.hook.spec.tsx`](apps/frontend/src/features/phrases/hooks/save-phrase.hook.spec.tsx) y [`phrase-validation-feedback.spec.tsx`](apps/frontend/src/features/phrases/components/phrase-validation-feedback/phrase-validation-feedback.spec.tsx) (estados de alerta, score, confirmar/cancelar).

## Troubleshooting

- **Puerto ocupado (`5432`, `8080`, `3000` o `5173`):** cambiar el puerto en el
  `.env` correspondiente (`POSTGRES_PORT` en la raíz —y `DATABASE_URL` del
  backend—, `PORT` en el backend) o liberar el proceso que lo esté usando. El
  `8080` de `embeddings` está fijo en `compose.yaml` (y debe coincidir con
  `AI_EMBEDDINGS_URL`). El backend solo permite CORS desde
  `http://localhost:5173`, así que cambiar el puerto de Vite exige tocar
  `src/configure-app.ts`.
- **`embeddings` tarda mucho en arrancar:** la primera descarga del modelo puede
  tardar varios minutos; revisar `docker compose logs -f embeddings` y esperar a
  que `/health` responda antes de levantar el backend.
- **El backend no arranca o no conecta a PostgreSQL / embeddings:** el backend
  ejecuta una inferencia de comprobación al iniciar y termina con error si el
  servicio `embeddings` no responde o si `AI_EMBEDDING_DIMENSIONS` no es `384`.
  Confirmar que `docker compose ps` muestra `embeddings` healthy y `postgres` en
  ejecución (solo `embeddings` define healthcheck) y que
  `DATABASE_URL`/`AI_EMBEDDINGS_URL` en `apps/backend/.env` coinciden con los
  puertos configurados en el `.env` raíz.
