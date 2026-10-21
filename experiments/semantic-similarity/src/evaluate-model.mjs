import process from "node:process";
import { assertApproved, hashContents, loadDataset } from "./dataset.mjs";
import { createEmbedder } from "./embedding-runtime.mjs";
import { cosineSimilarity } from "./evaluation-core.mjs";

function parseArguments(argv) {
  const options = { model: null, dataset: null, dtype: "q8" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--model") options.model = argv[++index];
    else if (argument === "--dataset") options.dataset = argv[++index];
    else if (argument === "--dtype") options.dtype = argv[++index];
    else throw new Error(`Argumento desconocido: ${argument}`);
  }
  if (!options.model || !options.dataset) throw new Error("Se requieren --model y --dataset");
  return options;
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  const { dataset, contents } = await loadDataset(options.dataset);
  assertApproved(dataset);
  const uniqueTexts = [...new Set(dataset.pairs.flatMap(({ textA, textB }) => [textA, textB]))];
  const embedder = await createEmbedder(options.model, options.dtype);

  try {
    const vectors = await embedder.embedTexts(uniqueTexts);
    const embeddings = new Map(uniqueTexts.map((text, index) => [text, vectors[index]]));
    const scoredPairs = dataset.pairs.map((pair) => ({
      id: pair.id,
      family: pair.family,
      category: pair.category,
      label: pair.label,
      textA: pair.textA,
      textB: pair.textB,
      rationale: pair.rationale,
      score: cosineSimilarity(embeddings.get(pair.textA), embeddings.get(pair.textB))
    }));
    const result = {
      schemaVersion: 1,
      timestamp: new Date().toISOString(),
      partition: dataset.partition,
      datasetHash: hashContents(contents),
      model: { ...embedder.model, dtype: embedder.dtype },
      scoredPairs
    };
    console.log(`RESULT_JSON:${JSON.stringify(result)}`);
  } finally {
    await embedder.dispose();
  }
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
