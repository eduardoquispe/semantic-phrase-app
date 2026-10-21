import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { assertApproved, hashContents, loadDataset, resolveDatasetDirectory, validateDatasetPair } from "./dataset.mjs";
import {
  scoreDistribution,
  selectThreshold,
  thresholdSensitivity
} from "./evaluation-core.mjs";
import { evaluateModel } from "./experiment-runner.mjs";
import { models } from "./model-config.mjs";
import { minimumAccuracy } from "./quality-criteria.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function scoredPairsFromReport(source, modelKey, calibration) {
  const scoredPairs = source.results?.[modelKey]?.metrics?.predictions;
  if (!Array.isArray(scoredPairs) || scoredPairs.length !== calibration.pairs.length) {
    throw new Error(`El reporte fuente no contiene los 40 puntajes de ${modelKey}`);
  }
  const byId = new Map(scoredPairs.map((pair) => [pair.id, pair]));
  if (byId.size !== scoredPairs.length) {
    throw new Error(`El reporte fuente contiene identificadores repetidos para ${modelKey}`);
  }
  return calibration.pairs.map((pair) => {
    const scored = byId.get(pair.id);
    if (
      !scored || scored.label !== pair.label ||
      scored.textA !== pair.textA || scored.textB !== pair.textB ||
      !Number.isFinite(scored.score)
    ) {
      throw new Error(`El puntaje fuente de ${modelKey}/${pair.id} no coincide con el dataset`);
    }
    return { ...pair, score: scored.score };
  });
}

async function run() {
  const args = process.argv.slice(2);
  let sourcePath = null;
  let directory = "data";
  let modelKey = null;
  for (let index = 0; index < args.length; index += 2) {
    if (!args[index + 1]) {
      throw new Error("Uso: node src/calibrate.mjs [--dataset-dir data/v2] [--model <clave>] [--from-report <reporte.json>]");
    }
    if (args[index] === "--from-report" && !sourcePath) sourcePath = path.resolve(args[index + 1]);
    else if (args[index] === "--dataset-dir" && directory === "data") directory = args[index + 1];
    else if (args[index] === "--model" && !modelKey) modelKey = args[index + 1];
    else throw new Error(`Argumento desconocido o repetido: ${args[index]}`);
  }
  if (modelKey && !Object.hasOwn(models, modelKey)) throw new Error(`Modelo desconocido: ${modelKey}`);
  const datasetDirectory = resolveDatasetDirectory(experimentRoot, directory);
  const calibrationPath = path.join(datasetDirectory, "pairs.calibration.json");
  const holdoutPath = path.join(datasetDirectory, "pairs.holdout.json");
  const calibration = await loadDataset(calibrationPath);
  const holdout = await loadDataset(holdoutPath);
  const errors = validateDatasetPair(calibration.dataset, holdout.dataset);
  if (errors.length > 0) throw new Error(`Conjunto inválido:\n${errors.join("\n")}`);
  assertApproved(calibration.dataset);
  assertApproved(holdout.dataset);
  const datasetHashes = {
    calibration: hashContents(calibration.contents),
    holdout: hashContents(holdout.contents)
  };
  const source = sourcePath ? JSON.parse(await readFile(sourcePath, "utf8")) : null;
  if (source && (
    source.experiment !== "02-semantic-quality-calibration" ||
    source.stage !== "calibration" ||
    source.datasetHashes?.calibration !== datasetHashes.calibration ||
    source.datasetHashes?.holdout !== datasetHashes.holdout
  )) {
    throw new Error("El reporte fuente no corresponde al experimento o al dataset congelado");
  }

  const results = {};
  for (const key of modelKey ? [modelKey] : ["minilm", "e5", "distiluse", "bge_m3"]) {
    console.log(`Calibrando ${key}...`);
    const evaluation = source
      ? {
          model: source.results?.[key]?.model,
          scoredPairs: scoredPairsFromReport(source, key, calibration.dataset)
        }
      : await evaluateModel(key, calibrationPath);
    if (!evaluation.model) throw new Error(`Falta la configuración del modelo ${key}`);
    const selection = selectThreshold(evaluation.scoredPairs, minimumAccuracy);
    const maximumAccuracy = Math.max(...selection.evaluations.map(({ accuracy }) => accuracy));
    results[key] = {
      model: evaluation.model,
      eligible: selection.eligible,
      maximumAccuracy,
      selectedThreshold: selection.eligible ? selection.selected.threshold : null,
      diagnosticThreshold: selection.eligible ? null : selection.selected.threshold,
      metrics: selection.selected,
      distributions: {
        similar: scoreDistribution(evaluation.scoredPairs, "similar"),
        notSimilar: scoreDistribution(evaluation.scoredPairs, "not_similar")
      },
      sensitivity: thresholdSensitivity(evaluation.scoredPairs, selection.selected.threshold)
    };
  }

  const report = {
    schemaVersion: 1,
    experiment: "02-semantic-quality-calibration",
    stage: "calibration",
    timestamp: new Date().toISOString(),
    datasetDirectory: path.relative(experimentRoot, datasetDirectory),
    datasetHashes,
    minimumCalibrationAccuracy: minimumAccuracy,
    ...(sourcePath ? { sourceCalibrationReport: path.relative(experimentRoot, sourcePath) } : {}),
    results
  };
  const resultsDirectory = path.join(experimentRoot, "results");
  await mkdir(resultsDirectory, { recursive: true });
  const outputPath = path.join(resultsDirectory, `experiment-02-calibration-${Date.now()}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Calibración guardada en ${outputPath}`);
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
