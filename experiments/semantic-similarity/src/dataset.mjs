import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeForExactMatch } from "./evaluation-core.mjs";

const allowedLabels = new Set(["similar", "not_similar"]);
const expectedPartitions = {
  calibration: { total: 40, similar: 20, not_similar: 20 },
  holdout: { total: 20, similar: 10, not_similar: 10 }
};

export function resolveDatasetDirectory(experimentRoot, directory = "data") {
  const dataRoot = path.join(experimentRoot, "data");
  const resolved = path.resolve(experimentRoot, directory);
  const relative = path.relative(dataRoot, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("El directorio del dataset debe estar dentro de data/");
  }
  return resolved;
}

export async function loadDataset(filePath) {
  const contents = await readFile(filePath, "utf8");
  return { dataset: JSON.parse(contents), contents };
}

export function hashContents(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function pairKey(pair) {
  return [normalizeForExactMatch(pair.textA), normalizeForExactMatch(pair.textB)]
    .sort()
    .join("\u0000");
}

function validateDataset(dataset, expectedPartition) {
  const errors = [];
  const expected = expectedPartitions[expectedPartition];
  if (dataset.schemaVersion !== 1) errors.push(`${expectedPartition}: schemaVersion debe ser 1`);
  if (dataset.partition !== expectedPartition) {
    errors.push(`${expectedPartition}: partition no coincide con el archivo`);
  }
  if (!Array.isArray(dataset.pairs)) {
    return [...errors, `${expectedPartition}: pairs debe ser un arreglo`];
  }
  if (dataset.pairs.length !== expected.total) {
    errors.push(`${expectedPartition}: se esperaban ${expected.total} pares`);
  }

  const ids = new Set();
  const pairs = new Set();
  const counts = { similar: 0, not_similar: 0 };
  for (const [index, pair] of dataset.pairs.entries()) {
    const location = `${expectedPartition}[${index}]`;
    for (const field of ["id", "family", "category", "label", "textA", "textB", "rationale"]) {
      if (typeof pair[field] !== "string" || pair[field].trim() === "") {
        errors.push(`${location}: ${field} debe ser texto no vacío`);
      }
    }
    if (ids.has(pair.id)) errors.push(`${location}: id repetido ${pair.id}`);
    ids.add(pair.id);
    if (!allowedLabels.has(pair.label)) errors.push(`${location}: label inválido ${pair.label}`);
    else counts[pair.label] += 1;

    for (const field of ["textA", "textB"]) {
      const text = pair[field];
      if (typeof text !== "string") continue;
      if (text.length > 280) errors.push(`${location}: ${field} supera 280 caracteres`);
      if (/\r|\n/u.test(text)) errors.push(`${location}: ${field} contiene saltos de línea`);
      if (!/\p{L}/u.test(text)) errors.push(`${location}: ${field} no contiene letras`);
    }
    if (typeof pair.textA === "string" && typeof pair.textB === "string") {
      if (normalizeForExactMatch(pair.textA) === normalizeForExactMatch(pair.textB)) {
        errors.push(`${location}: el par es una coincidencia textual normalizada`);
      }
      const key = pairKey(pair);
      if (pairs.has(key)) errors.push(`${location}: par repetido o invertido`);
      pairs.add(key);
    }
  }
  for (const label of allowedLabels) {
    if (counts[label] !== expected[label]) {
      errors.push(`${expectedPartition}: se esperaban ${expected[label]} casos ${label}`);
    }
  }
  return errors;
}

export function validateDatasetPair(calibration, holdout) {
  const errors = [
    ...validateDataset(calibration, "calibration"),
    ...validateDataset(holdout, "holdout")
  ];
  if (!Array.isArray(calibration.pairs) || !Array.isArray(holdout.pairs)) return errors;

  const calibrationFamilies = new Set(calibration.pairs.map(({ family }) => family));
  const calibrationTexts = new Set(
    calibration.pairs.flatMap(({ textA, textB }) => [textA, textB]).map(normalizeForExactMatch)
  );
  for (const pair of holdout.pairs) {
    if (calibrationFamilies.has(pair.family)) {
      errors.push(`holdout: la familia ${pair.family} también aparece en calibración`);
    }
    for (const text of [pair.textA, pair.textB]) {
      if (calibrationTexts.has(normalizeForExactMatch(text))) {
        errors.push(`holdout: una frase también aparece en calibración: ${text}`);
      }
    }
  }
  return errors;
}

export function assertApproved(dataset) {
  if (dataset.status !== "approved") {
    throw new Error(
      `La partición ${dataset.partition} todavía no tiene verdad de referencia aprobada`
    );
  }
}
