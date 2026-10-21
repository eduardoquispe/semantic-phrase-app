import { fileURLToPath } from "node:url";
import path from "node:path";
import { hashContents, loadDataset, resolveDatasetDirectory, validateDatasetPair } from "./dataset.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function run() {
  const args = process.argv.slice(2);
  if (args.length > 0 && (args.length !== 2 || args[0] !== "--dataset-dir" || !args[1])) {
    throw new Error("Uso: node src/validate-dataset.mjs [--dataset-dir data/v2]");
  }
  const datasetDirectory = resolveDatasetDirectory(experimentRoot, args[1]);
  const calibrationPath = path.join(datasetDirectory, "pairs.calibration.json");
  const holdoutPath = path.join(datasetDirectory, "pairs.holdout.json");
  const calibration = await loadDataset(calibrationPath);
  const holdout = await loadDataset(holdoutPath);
  const errors = validateDatasetPair(calibration.dataset, holdout.dataset);
  const summary = {
    datasetDirectory: path.relative(experimentRoot, datasetDirectory),
    valid: errors.length === 0,
    statuses: {
      calibration: calibration.dataset.status,
      holdout: holdout.dataset.status
    },
    hashes: {
      calibration: hashContents(calibration.contents),
      holdout: hashContents(holdout.contents)
    },
    counts: {
      calibration: calibration.dataset.pairs?.length ?? 0,
      holdout: holdout.dataset.pairs?.length ?? 0
    },
    errors
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.valid) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
