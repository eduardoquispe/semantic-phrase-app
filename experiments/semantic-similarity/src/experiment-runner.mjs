import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const experimentRoot = path.resolve(sourceDirectory, "..");

export function evaluateModel(modelKey, datasetPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join(sourceDirectory, "evaluate-model.mjs"),
      "--model",
      modelKey,
      "--dataset",
      datasetPath,
      "--dtype",
      "q8"
    ], {
      cwd: experimentRoot,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      const resultLine = stdout.split("\n").find((line) => line.startsWith("RESULT_JSON:"));
      if (code !== 0 || !resultLine) {
        reject(new Error(stderr.trim() || `La evaluación de ${modelKey} terminó con código ${code}`));
        return;
      }
      resolve(JSON.parse(resultLine.slice("RESULT_JSON:".length)));
    });
  });
}
