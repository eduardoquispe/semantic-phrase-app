# Servicios locales

## MiniLM: embeddings por HTTP

El servicio `embeddings` ejecuta Hugging Face Text Embeddings Inference (TEI)
en CPU ARM64, para Docker Desktop en Apple Silicon. No requiere GPU ni API key.
El backend todavía no está conectado a este servicio.

```sh
docker compose up -d --wait --wait-timeout 1200 embeddings
docker compose ps embeddings
docker compose logs -f embeddings
```

El primer arranque descarga el modelo público desde Hugging Face y requiere
Internet. Los archivos quedan en el volumen `embeddings_data`, que se reutiliza
al reiniciar o recrear el contenedor. El arranque espera a que `/health` responda;
la descarga inicial puede tardar varios minutos según la conexión.

Configuración fijada en `compose.yaml`:

- Imagen: `ghcr.io/huggingface/text-embeddings-inference:cpu-arm64-1.9`.
- Modelo: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
- Revisión: `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`.
- Inferencia CPU `float32`, mean pooling y salida normalizada de 384 dimensiones.
- Dirección local: `http://127.0.0.1:8080`, accesible solo desde esta máquina.

### Probar la API

```sh
curl --fail-with-body http://127.0.0.1:8080/health

curl --fail-with-body http://127.0.0.1:8080/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"model":"sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2","input":["Quiero aprender programación","Me gustaría aprender a programar"],"encoding_format":"float"}'
```

La respuesta compatible con OpenAI contiene un vector por texto en
`data[i].embedding`: cada vector debe tener 384 números finitos y norma L2
aproximadamente igual a 1.

Para la futura integración con LangChain desde el backend ejecutado en el host,
la URL base será `http://127.0.0.1:8080/v1`. Un backend en la misma red de Compose
podrá utilizar `http://embeddings:80/v1`. El nombre de modelo servido es el
indicado en la petición anterior. Si el cliente exige una API key, puede usar
un valor ficticio como `local`: este servicio local no configura autenticación.

### Reiniciar y detener

```sh
docker compose restart embeddings
docker compose stop embeddings
```

Estos comandos conservan la caché y no modifican PostgreSQL. Para levantar
también PostgreSQL, ejecutar `docker compose up -d`.

### Compatibilidad con el backend actual

El backend sigue usando su implementación local con Transformers.js y pesos
ONNX `q8`. TEI usa otro runtime y pesos `float32`: que ambos generen 384 valores
no garantiza vectores intercambiables. Antes de integrar el servicio se deberá
validar la calidad de búsqueda, definir su identidad de embeddings y determinar
si corresponde regenerar los vectores existentes.

Referencias: [TEI y Docker](https://huggingface.co/docs/text-embeddings-inference/quick_tour),
[imágenes y arquitecturas](https://huggingface.co/docs/text-embeddings-inference/supported_models),
[modelo](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2).
