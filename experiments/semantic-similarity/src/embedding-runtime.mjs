import { fileURLToPath } from "node:url";
import path from "node:path";
import { env, pipeline } from "@huggingface/transformers";
import { applyDenseProjection, loadDenseProjection } from "./dense-projection.mjs";
import { getModel } from "./model-config.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheRoot = path.join(experimentRoot, ".cache", "huggingface");

export async function createEmbedder(modelKey, dtype = "q8", { offline = false, cacheDir = cacheRoot } = {}) {
  const model = getModel(modelKey);
  env.cacheDir = cacheDir;
  env.allowLocalModels = offline;
  env.allowRemoteModels = !offline;
  const extractor = await pipeline("feature-extraction", model.runtimeModel, {
    device: "cpu",
    dtype,
    local_files_only: offline
  });
  let projection;
  try {
    projection = model.projection
      ? await loadDenseProjection(model.projection, cacheDir, { offline })
      : null;
  } catch (error) {
    await extractor.dispose();
    throw error;
  }
  const embeddingOptions = { pooling: model.pooling, normalize: projection === null };

  return {
    model,
    dtype,
    async embedTexts(texts) {
      const prepared = texts.map((text) => `${model.prefix}${text}`);
      const raw = await extractor(prepared, embeddingOptions);
      const output = projection ? applyDenseProjection(raw, projection) : raw;
      const dimensions = output.dims.at(-1);
      if (output.data.length !== texts.length * dimensions) {
        throw new Error("La forma del lote de embeddings no coincide con sus textos");
      }
      return texts.map((_, index) =>
        Float32Array.from(output.data.slice(index * dimensions, (index + 1) * dimensions))
      );
    },
    async dispose() {
      await extractor.dispose();
    }
  };
}
