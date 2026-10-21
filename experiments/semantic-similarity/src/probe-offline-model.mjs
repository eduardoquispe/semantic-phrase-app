import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEmbedder } from "./embedding-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cached = path.join(root, ".cache/huggingface");
const modelPath = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

async function load(cacheDir) {
  const embedder = await createEmbedder("minilm", "q8", { offline: true, cacheDir });
  try {
    const [vector] = await embedder.embedTexts(["Olvidé mi contraseña"]);
    assert.equal(vector.length, 384);
    assert.ok(Array.from(vector).every(Number.isFinite));
    return { dimensions: vector.length, finite: true };
  } finally {
    await embedder.dispose();
  }
}

async function expectFailure(cacheDir, label) {
  try {
    await load(cacheDir);
    throw new Error(`${label}: se cargó un modelo que debía estar ausente o incompleto`);
  } catch (error) {
    if (error.message.startsWith(`${label}:`)) throw error;
    return { status: "rejected", reason: error.message };
  }
}

const temporary = await mkdtemp(path.join(os.tmpdir(), "semantic-offline-"));
try {
  const missing = await expectFailure(path.join(temporary, "missing"), "missing");
  const partialCache = path.join(temporary, "partial");
  const partialModel = path.join(partialCache, modelPath);
  await mkdir(partialModel, { recursive: true });
  await copyFile(path.join(cached, modelPath, "config.json"), path.join(partialModel, "config.json"));
  const partial = await expectFailure(partialCache, "partial");
  const cachedOffline = await load(cached);
  console.log(JSON.stringify({ missing, partial, cachedOffline }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
