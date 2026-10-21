import { performance } from "node:perf_hooks";
import { normalizeForExactMatch } from "./evaluation-core.mjs";

export const candidateModels = new Set(["minilm", "bge_m3"]);

export function validatePhraseText(value) {
  if (typeof value !== "string" || /[\r\n]/u.test(value)) {
    throw new Error("La frase debe ser texto de una línea");
  }
  const text = value.trim();
  if (text.length < 1 || text.length > 280 || !/\p{L}/u.test(text)) {
    throw new Error("La frase debe tener 1 a 280 caracteres y al menos una letra");
  }
  return text;
}

export function modelIdentity(embedder) {
  if (!candidateModels.has(embedder.model.key)) throw new Error("Modelo fuera del prototipo");
  const { model, dtype } = embedder;
  return {
    key: model.key,
    version: `${model.runtimeModel}|${dtype}|${model.pooling}|l2-v1`,
    dimensions: model.expectedDimensions,
    dtype
  };
}

export function vectorLiteral(vector, dimensions) {
  if (vector?.length !== dimensions || !Array.from(vector).every(Number.isFinite)) {
    throw new Error(`Embedding inválido: se esperaban ${dimensions} valores finitos`);
  }
  if (!Array.from(vector).some((value) => value !== 0)) {
    throw new Error("Embedding inválido: el vector no puede tener norma cero");
  }
  return `[${Array.from(vector).join(",")}]`;
}

export function createFlow({ store, embedder, threshold, now = () => new Date(), timer = () => performance.now() }) {
  if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
    throw new Error("El umbral debe ser un número entre -1 y 1");
  }
  const model = modelIdentity(embedder);

  return {
    async validate(input) {
      const text = validatePhraseText(input);
      const started = timer();
      const normalizedText = normalizeForExactMatch(text);
      const corpusStarted = timer();
      const corpus = await store.findCorpusMatch(normalizedText, model);
      const corpusMs = timer() - corpusStarted;
      let nearest = null;
      let method = "none";
      let embeddingMs = 0;
      let searchMs = 0;

      if (corpus.exact) {
        nearest = { id: corpus.exact.id, text: corpus.exact.text, score: 1 };
        method = "textual";
      } else if (corpus.activeCount > 0) {
        const embeddingStarted = timer();
        const [vector] = await embedder.embedTexts([text]);
        embeddingMs = timer() - embeddingStarted;
        const searchStarted = timer();
        nearest = await store.findNearest(vectorLiteral(vector, model.dimensions), model);
        searchMs = timer() - searchStarted;
        if (!nearest) throw new Error("La búsqueda no devolvió una frase activa indexada");
        if (!Number.isFinite(nearest.score)) throw new Error("La búsqueda devolvió un puntaje inválido");
        method = "semantic";
      }

      const alert = method === "textual" || (method === "semantic" && nearest.score >= threshold);
      return {
        text,
        model,
        threshold,
        status: method === "none" ? "no_phrases" : alert ? "alert" : "clear",
        method,
        alert,
        nearest,
        validatedAt: now().toISOString(),
        timingMs: { corpus: corpusMs, embedding: embeddingMs, search: searchMs, total: timer() - started }
      };
    }
  };
}
