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
- **Base de datos:** PostgreSQL + `pgvector`, migraciones con Drizzle Kit.
- **IA:** embeddings de Hugging Face servidos por **Text Embeddings Inference
  (TEI)** y consumidos desde el backend vía LangChain; similitud por distancia
  coseno en PostgreSQL/pgvector.
- **Human-in-the-loop:** si una frase nueva es muy parecida a una existente, el
  backend pide confirmación antes de guardarla.

### Diagrama de componentes

```mermaid
flowchart LR
    U[Usuario] --> FE["Frontend React\n:5173"]
    FE <-->|REST /api/v1| BE["Backend NestJS\n:3000"]
    BE <-->|coincidencia exacta +\nsimilitud coseno Top-1| PG[("PostgreSQL + pgvector\n:5432")]
    BE <-->|embeddings HTTP| TEI["HF Text Embeddings Inference\n:8080"]
```

Este diagrama refleja el **código actual**. Los documentos de `docs/03-architecture/`
fueron revisados para coincidir con el código implementado; los de `docs/00-discovery/`
y `docs/01-ai-feasibility/` son registros históricos de decisión y llevan una nota
cuando el código difiere. Ante cualquier discrepancia, manda el código.

### Flujo de validación y guardado (caso principal)

1. El usuario escribe una frase nueva en el frontend y pulsa **Validar**.
2. El frontend llama a `POST /api/v1/phrase-validations` con el texto.
3. El backend genera el embedding de la frase llamando al servicio `embeddings`
   (TEI) a través del adaptador de LangChain.
4. El backend busca, en PostgreSQL/pgvector, la frase guardada más parecida
   (coincidencia textual exacta o similitud coseno Top-1) y calcula su score.
5. El backend responde con la frase más parecida (si existe), el `similarityScore`
   y si se requiere confirmación (`requiresConfirmation`); guarda una validación
   temporal identificada por `validationId` (con expiración).
6. Si hay posible duplicado, el frontend muestra la alerta con el score y la frase
   parecida; el usuario confirma o cancela el guardado.
7. Si el usuario confirma (o no había duplicado), el frontend llama a
   `POST /api/v1/phrases` con el `validationId` recibido y, cuando
   `requiresConfirmation` es `true`, con `confirmed: true` (sin él, 409
   `CONFIRMATION_REQUIRED`).
8. El backend comprueba la validación (existe, vigente, no consumida, mismo texto
   y modelo), inserta la frase reutilizando el embedding ya calculado (sin volver
   a llamar al modelo) y después marca la validación como consumida. Son dos
   escrituras secuenciales, sin transacción.

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

- Node.js y [pnpm](https://pnpm.io/).
- Docker Desktop (el servicio `embeddings` está fijado a `linux/arm64`; en otra
  arquitectura hay que ajustar la imagen/plataforma en `compose.yaml`).

## Instalación y ejecución

1. Clonar con submódulos (frontend y backend viven en repos aparte bajo `apps/`):

   ```sh
   git clone --recurse-submodules <url-del-repo>
   # si ya clonaste sin submódulos:
   git submodule update --init --recursive
   ```

2. Copiar las variables de entorno de ejemplo:

   ```sh
   cp .env.example .env
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.example apps/frontend/.env
   ```

3. Levantar PostgreSQL y el servicio de embeddings desde la raíz:

   ```sh
   docker compose up -d --wait
   ```

   La primera vez, `embeddings` descarga el modelo desde Hugging Face y puede
   tardar varios minutos (requiere Internet). Las siguientes veces arranca desde
   el volumen `embeddings_data`.

4. Backend (en una terminal):

   ```sh
   cd apps/backend
   pnpm install
   pnpm db:migrate
   pnpm start:dev
   ```

   Queda escuchando en `http://localhost:3000`, con prefijo `/api` (rutas reales
   `/api/v1/phrases` y `/api/v1/phrase-validations`).

5. Frontend (en otra terminal):

   ```sh
   cd apps/frontend
   pnpm install
   pnpm dev
   ```

   Queda disponible en `http://localhost:5173`.

6. Verificación manual: abrir el frontend, crear una frase, escribir una frase
   parecida y pulsar "Validar" para ver la alerta de posible duplicado, y confirmar
   o cancelar el guardado.

## Variables de entorno

| Ámbito                | Archivo                                                    | Contenido                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raíz / Docker Compose | [`.env.example`](.env.example)                             | Credenciales y puerto de PostgreSQL usados por `compose.yaml`                                                                                                                                                  |
| Backend               | [`apps/backend/.env.example`](apps/backend/.env.example)   | `DATABASE_URL`, `PORT`, `AI_EMBEDDINGS_URL`, `AI_MODEL`, `AI_EMBEDDING_VERSION`, `AI_EMBEDDING_DIMENSIONS` (384), `AI_INFERENCE_TIMEOUT_MS`, `AI_SIMILARITY_THRESHOLD` y `PHRASE_VALIDATION_TTL_MINUTES` |
| Frontend              | [`apps/frontend/.env.example`](apps/frontend/.env.example) | URL base de la API                                                                                                                                                                                             |

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
