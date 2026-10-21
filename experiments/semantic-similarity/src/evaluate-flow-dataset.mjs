import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createEmbedder } from "./embedding-runtime.mjs";
import { createFlow, modelIdentity, validatePhraseText } from "./flow-prototype.mjs";
import { createFlowStore } from "./flow-store.mjs";
import { generateThresholdCandidates, normalizeForExactMatch } from "./evaluation-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data/flow");
const resultsDir = path.join(root, "results");
const modelKeys = ["minilm", "bge_m3"];
const tieRule = "Mayor número de decisiones correctas; luego menos falsos positivos; luego menos falsos negativos; finalmente umbral más alto";

const sha256 = (raw) => createHash("sha256").update(raw).digest("hex");
const exists = async (file) => access(file).then(() => true, () => false);

function validateCases(dataset, partition) {
  if (dataset.schemaVersion !== 1 || dataset.partition !== partition || dataset.status !== "labeled") {
    throw new Error(`Cabecera inválida para ${partition}`);
  }
  const expected = partition === "calibration" ? 40 : 20;
  if (dataset.cases?.length !== expected) throw new Error(`${partition}: se esperaban ${expected} casos`);
  const ids = new Set();
  const families = new Set();
  const counts = { true: 0, false: 0 };
  for (const item of dataset.cases) {
    if (!item.id || ids.has(item.id) || !item.family || families.has(item.family)) {
      throw new Error(`ID o familia duplicados en ${partition}: ${item.id}`);
    }
    ids.add(item.id);
    families.add(item.family);
    validatePhraseText(item.input);
    if (typeof item.expectedAlert !== "boolean" || !item.category || !item.rationale) {
      throw new Error(`Etiqueta incompleta: ${item.id}`);
    }
    counts[item.expectedAlert] += 1;
    if (!Array.isArray(item.active) || item.active.length < 3) throw new Error(`Corpus insuficiente: ${item.id}`);
    const keys = new Set();
    const texts = new Set();
    for (const [key, phrase] of item.active) {
      validatePhraseText(phrase);
      const normalized = normalizeForExactMatch(phrase);
      if (!key || keys.has(key) || texts.has(normalized) || normalized === normalizeForExactMatch(item.input)) {
        throw new Error(`Frase o clave duplicada en ${item.id}`);
      }
      keys.add(key);
      texts.add(normalized);
    }
    if (item.expectedAlert ? !keys.has(item.expectedMatch) : item.expectedMatch !== null) {
      throw new Error(`Recuperación esperada inválida: ${item.id}`);
    }
  }
  if (counts.true !== expected / 2 || counts.false !== expected / 2) {
    throw new Error(`${partition}: las decisiones no están equilibradas`);
  }
  return { ids, families };
}

function metrics(rows, threshold) {
  let correct = 0, fp = 0, fn = 0, retrievalErrors = 0;
  const cases = rows.map((row) => {
    const alert = row.method === "textual" || row.score >= threshold;
    const decisionCorrect = alert === row.expectedAlert;
    const retrievalCorrect = row.expectedMatch === null || row.retrievedKey === row.expectedMatch;
    if (decisionCorrect) correct += 1;
    else if (alert) fp += 1;
    else fn += 1;
    if (!retrievalCorrect) retrievalErrors += 1;
    return { ...row, alert, decisionCorrect, retrievalCorrect };
  });
  return { threshold, correct, falsePositives: fp, falseNegatives: fn, retrievalErrors, cases };
}

function calibrate(rows) {
  const candidates = generateThresholdCandidates(rows.map(({ score }) => score)).map((threshold) => metrics(rows, threshold));
  candidates.sort((a, b) => b.correct - a.correct || a.falsePositives - b.falsePositives ||
    a.falseNegatives - b.falseNegatives || b.threshold - a.threshold);
  return candidates[0];
}

async function evaluateModel(modelKey, cases, db, store, threshold) {
  const embedder = await createEmbedder(modelKey);
  const model = modelIdentity(embedder);
  const flow = createFlow({ store, embedder, threshold });
  const rows = [];
  try {
    for (const item of cases) {
      await db.query("TRUNCATE prototype_phrase_embeddings, prototype_phrases RESTART IDENTITY CASCADE");
      const phrases = [];
      const keyById = new Map();
      for (const [key, phrase] of item.active) {
        const saved = await store.addPhrase(phrase);
        phrases.push(saved);
        keyById.set(String(saved.id), key);
      }
      const vectors = await embedder.embedTexts(phrases.map(({ text }) => text));
      await store.saveEmbeddings(phrases, vectors, model);
      const result = await flow.validate(item.input);
      rows.push({
        id: item.id, family: item.family, category: item.category,
        expectedAlert: item.expectedAlert, expectedMatch: item.expectedMatch,
        retrievedKey: keyById.get(String(result.nearest?.id)) ?? null,
        retrievedText: result.nearest?.text ?? null, score: result.nearest?.score ?? null,
        method: result.method, timingMs: result.timingMs
      });
      console.log(`${modelKey} ${item.id}: ${rows.at(-1).retrievedKey} ${rows.at(-1).score?.toFixed(4)}`);
    }
  } finally {
    await embedder.dispose();
  }
  return { model, rows };
}

function summarize(result) {
  const totals = result.cases.map(({ timingMs }) => timingMs.total).sort((a, b) => a - b);
  const sum = (key) => result.cases.reduce((total, row) => total + row.timingMs[key], 0);
  return {
    correct: result.correct, total: result.cases.length, retrievalErrors: result.retrievalErrors,
    falsePositives: result.falsePositives, falseNegatives: result.falseNegatives,
    timingMs: { total: sum("total"), mean: sum("total") / totals.length,
      p95: totals[Math.ceil(totals.length * 0.95) - 1],
      embedding: sum("embedding"), search: sum("search"), corpus: sum("corpus") }
  };
}

async function run() {
  const phase = process.argv[2];
  if (!["calibrate", "holdout"].includes(phase) || process.argv.length !== 3) {
    throw new Error("Uso: node src/evaluate-flow-dataset.mjs calibrate|holdout");
  }
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");
  await mkdir(resultsDir, { recursive: true });
  const calibrationFile = path.join(resultsDir, "flow-calibration.json");
  const holdoutFile = path.join(resultsDir, "flow-holdout.json");
  if (await exists(holdoutFile)) throw new Error("El holdout ya fue ejecutado; no se permite otra corrida");
  if (phase === "calibrate" && await exists(calibrationFile)) throw new Error("La calibración ya fue congelada");

  const calibrationRaw = await readFile(path.join(dataDir, "calibration.json"), "utf8");
  const calibration = JSON.parse(calibrationRaw);
  const calibrationMeta = validateCases(calibration, "calibration");
  const holdoutPath = path.join(dataDir, "holdout.json");
  const holdoutRaw = await readFile(holdoutPath, "utf8");
  const hashes = { calibration: sha256(calibrationRaw), holdout: sha256(holdoutRaw) };

  let cases = calibration.cases;
  let thresholds = null;
  if (phase === "holdout") {
    const frozen = JSON.parse(await readFile(calibrationFile, "utf8"));
    if (frozen.phase !== "calibrate" || JSON.stringify(frozen.datasetHashes) !== JSON.stringify(hashes) ||
      frozen.tieRule !== tieRule || modelKeys.some((key) => !Number.isFinite(frozen.thresholds?.[key]))) {
      throw new Error("Manifiesto de calibración inválido o dataset modificado");
    }
    const holdout = JSON.parse(holdoutRaw);
    const holdoutMeta = validateCases(holdout, "holdout");
    for (const family of holdoutMeta.families) {
      if (calibrationMeta.families.has(family)) throw new Error(`Familia compartida: ${family}`);
    }
    const calibrationTexts = new Set(calibration.cases.flatMap((item) =>
      [item.input, ...item.active.map(([, text]) => text)].map(normalizeForExactMatch)));
    for (const item of holdout.cases) {
      for (const phrase of [item.input, ...item.active.map(([, text]) => text)]) {
        if (calibrationTexts.has(normalizeForExactMatch(phrase))) throw new Error(`Texto compartido: ${phrase}`);
      }
    }
    cases = holdout.cases;
    thresholds = frozen.thresholds;
  }

  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const store = createFlowStore(db);
  const results = {};
  try {
    await store.init();
    for (const modelKey of modelKeys) {
      const evaluated = await evaluateModel(modelKey, cases, db, store, thresholds?.[modelKey] ?? 0);
      const scored = phase === "calibrate" ? calibrate(evaluated.rows) : metrics(evaluated.rows, thresholds[modelKey]);
      results[modelKey] = { model: evaluated.model, threshold: scored.threshold,
        summary: summarize(scored), cases: scored.cases };
    }
  } finally {
    await db.end();
  }
  const report = { schemaVersion: 1, phase, generatedAt: new Date().toISOString(), datasetHashes: hashes,
    tieRule, minimumHoldoutCorrect: 15,
    ...(phase === "calibrate" ? { thresholds: Object.fromEntries(modelKeys.map((key) => [key, results[key].threshold])) } : {}),
    results };
  const output = phase === "calibrate" ? calibrationFile : holdoutFile;
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  console.log(`Reporte: ${output}`);
  for (const [key, value] of Object.entries(results)) console.log(`${key}: ${JSON.stringify(value.summary)}; umbral=${value.threshold}`);
}

run().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
