import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { assertApproved, hashContents, loadDataset, resolveDatasetDirectory, validateDatasetPair } from "./dataset.mjs";
import { calculateMetrics, scoreDistribution } from "./evaluation-core.mjs";
import { evaluateModel } from "./experiment-runner.mjs";
import { eligibleModelsForHoldout, minimumAccuracy } from "./quality-criteria.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArguments(argv) {
  const manifestIndex = argv.indexOf("--manifest");
  return {
    manifest: manifestIndex >= 0 ? argv[manifestIndex + 1] : null,
    confirmed: argv.includes("--confirm-final")
  };
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  if (!options.manifest || !options.confirmed) {
    throw new Error("Se requieren --manifest <calibración.json> y --confirm-final");
  }
  const manifest = JSON.parse(await readFile(path.resolve(options.manifest), "utf8"));
  const eligibleModels = eligibleModelsForHoldout(manifest);
  const datasetDirectory = resolveDatasetDirectory(experimentRoot, manifest.datasetDirectory ?? "data");
  const calibrationPath = path.join(datasetDirectory, "pairs.calibration.json");
  const holdoutPath = path.join(datasetDirectory, "pairs.holdout.json");

  const calibration = await loadDataset(calibrationPath);
  const holdout = await loadDataset(holdoutPath);
  const errors = validateDatasetPair(calibration.dataset, holdout.dataset);
  if (errors.length > 0) throw new Error(`Conjunto inválido:\n${errors.join("\n")}`);
  assertApproved(calibration.dataset);
  assertApproved(holdout.dataset);
  const currentHashes = {
    calibration: hashContents(calibration.contents),
    holdout: hashContents(holdout.contents)
  };
  if (
    currentHashes.calibration !== manifest.datasetHashes?.calibration ||
    currentHashes.holdout !== manifest.datasetHashes?.holdout
  ) {
    throw new Error("Los hashes del conjunto no coinciden con el manifiesto congelado");
  }

  const results = {};
  for (const [modelKey, calibrationResult] of eligibleModels) {
    console.log(`Evaluando holdout final para ${modelKey}...`);
    const evaluation = await evaluateModel(modelKey, holdoutPath);
    const metrics = calculateMetrics(evaluation.scoredPairs, calibrationResult.selectedThreshold);
    results[modelKey] = {
      model: evaluation.model,
      threshold: calibrationResult.selectedThreshold,
      accepted: metrics.accuracy + 1e-12 >= minimumAccuracy,
      metrics,
      distributions: {
        similar: scoreDistribution(evaluation.scoredPairs, "similar"),
        notSimilar: scoreDistribution(evaluation.scoredPairs, "not_similar")
      }
    };
  }

  const report = {
    schemaVersion: 1,
    experiment: "02-semantic-quality-calibration",
    stage: "holdout-final",
    timestamp: new Date().toISOString(),
    sourceCalibrationManifest: path.resolve(options.manifest),
    datasetDirectory: path.relative(experimentRoot, datasetDirectory),
    datasetHashes: currentHashes,
    minimumHoldoutAccuracy: minimumAccuracy,
    results
  };
  const outputPath = path.join(experimentRoot, "results", `experiment-02-holdout-${Date.now()}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Evaluación final guardada en ${outputPath}`);
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
