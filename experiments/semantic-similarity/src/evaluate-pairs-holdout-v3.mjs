import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { createEmbedder } from "./embedding-runtime.mjs";
import { calculateMetrics, cosineSimilarity, normalizeForExactMatch } from "./evaluation-core.mjs";
import { hashContents, loadDataset, validateDatasetPair } from "./dataset.mjs";
import { minimumAccuracy } from "./quality-criteria.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "results/pairs-holdout-v3.json");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

function assertNoOverlap(newPairs, priorPairs, description) {
  const families = new Set(priorPairs.map((pair) => pair.family));
  const texts = new Set(priorPairs.flatMap((pair) => [pair.textA, pair.textB]).map(normalizeForExactMatch));
  for (const pair of newPairs) {
    if (families.has(pair.family)) throw new Error(`Familia compartida con ${description}: ${pair.family}`);
    for (const text of [pair.textA, pair.textB]) {
      if (texts.has(normalizeForExactMatch(text))) throw new Error(`Texto compartido con ${description}: ${text}`);
    }
  }
}

async function evaluate(modelKey, pairs, expectedModel) {
  const started = performance.now();
  const embedder = await createEmbedder(modelKey);
  try {
    const model = { ...embedder.model, dtype: embedder.dtype };
    if (JSON.stringify(model) !== JSON.stringify(expectedModel)) throw new Error(`Modelo modificado: ${modelKey}`);
    const texts = [...new Set(pairs.flatMap((pair) => [pair.textA, pair.textB]))];
    const vectors = await embedder.embedTexts(texts);
    const byText = new Map(texts.map((text, index) => [text, vectors[index]]));
    const scoredPairs = pairs.map((pair) => ({
      ...pair,
      score: cosineSimilarity(byText.get(pair.textA), byText.get(pair.textB))
    }));
    return { model, scoredPairs, runtimeMs: performance.now() - started };
  } finally {
    await embedder.dispose();
  }
}

async function main() {
  const freeze = await readJson(path.join(root, "data/v3/holdout-freeze.json"));
  const source = await readJson(path.join(root, freeze.sourceCalibration));
  const calibration = await loadDataset(path.join(root, "data/v2/pairs.calibration.json"));
  const holdout = await loadDataset(path.join(root, "data/v3/pairs.holdout.json"));
  const prior = await loadDataset(path.join(root, "data/v2/pairs.holdout.json"));
  const errors = validateDatasetPair(calibration.dataset, holdout.dataset);
  if (errors.length) throw new Error(errors.join("\n"));
  if (holdout.dataset.status !== "labeled" || calibration.dataset.status !== "approved" ||
      source.stage !== "calibration" || source.datasetDirectory !== "data/v2" ||
      hashContents(calibration.contents) !== freeze.calibrationHash ||
      source.datasetHashes.calibration !== freeze.calibrationHash ||
      hashContents(holdout.contents) !== freeze.holdoutHash ||
      freeze.minimumCorrect !== 15 || minimumAccuracy !== 0.75 ||
      JSON.stringify(freeze.tieBreak) !== JSON.stringify(["correct", "f2", "recall", "falsePositives", "runtimeMs"])) {
    throw new Error("Protocolo congelado o dataset inválido");
  }
  assertNoOverlap(holdout.dataset.pairs, prior.dataset.pairs, "holdout v2");
  const results = {};
  for (const key of ["minilm", "bge_m3"]) {
    const candidate = source.results[key];
    if (!candidate?.eligible || candidate.selectedThreshold !== freeze.thresholds[key]) {
      throw new Error(`Umbral de ${key} modificado`);
    }
    const run = await evaluate(key, holdout.dataset.pairs, candidate.model);
    const metrics = calculateMetrics(run.scoredPairs, freeze.thresholds[key]);
    results[key] = { model: run.model, runtimeMs: run.runtimeMs,
      accepted: metrics.accuracy >= minimumAccuracy, metrics };
    console.log(`${key}: ${metrics.accuracy * 20}/20, F2=${metrics.f2.toFixed(3)}`);
  }
  const ranked = Object.entries(results).filter(([, result]) => result.accepted).sort((a, b) => {
    const left = a[1], right = b[1];
    return (right.metrics.accuracy - left.metrics.accuracy) ||
      (right.metrics.f2 - left.metrics.f2) ||
      (right.metrics.recall - left.metrics.recall) ||
      (left.metrics.confusionMatrix.falsePositive - right.metrics.confusionMatrix.falsePositive) ||
      (left.runtimeMs - right.runtimeMs);
  });
  const report = { schemaVersion: 1, stage: "pairs-holdout-v3", timestamp: new Date().toISOString(),
    freeze, status: holdout.dataset.status, selectedModel: ranked[0]?.[0] ?? null, results };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  console.log(`Reporte: ${output}; seleccionado: ${report.selectedModel ?? "ninguno"}`);
}

main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
