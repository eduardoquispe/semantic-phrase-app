import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { models } from "./model-config.mjs";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(sourceDirectory, "..");
const quick = process.argv.includes("--quick");

function executeModel(modelKey) {
  return new Promise((resolve) => {
    const argumentsList = [
      "--expose-gc",
      path.join(sourceDirectory, "benchmark-model.mjs"),
      "--model",
      modelKey,
      "--dtype",
      "q8"
    ];
    if (quick) argumentsList.push("--quick");

    const child = spawn(process.execPath, argumentsList, {
      cwd: experimentRoot,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("close", (code) => {
      const resultLine = stdout.split("\n").find((line) => line.startsWith("RESULT_JSON:"));
      if (resultLine) {
        const result = JSON.parse(resultLine.slice("RESULT_JSON:".length));
        const passed = code === 0 && result.validation?.passed === true;
        resolve({
          status: passed ? "passed" : "failed",
          result,
          ...(!passed && {
            error: result.validation?.failures?.join("; ") || `El proceso terminó con código ${code}`
          })
        });
      } else {
        resolve({
          status: "failed",
          error: stderr.trim() || `El proceso terminó con código ${code}`
        });
      }
    });
  });
}

async function run() {
  const results = {};
  for (const modelKey of Object.keys(models)) {
    console.log(`\n=== ${modelKey} ===`);
    results[modelKey] = await executeModel(modelKey);
  }

  const report = {
    schemaVersion: 1,
    experiment: "01-node-embedding-feasibility",
    timestamp: new Date().toISOString(),
    quick,
    results
  };
  const resultsDirectory = path.join(experimentRoot, "results");
  await mkdir(resultsDirectory, { recursive: true });
  const outputPath = path.join(resultsDirectory, `experiment-01-${Date.now()}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nResultados guardados en ${outputPath}`);

  if (Object.values(results).some(({ status }) => status !== "passed")) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
