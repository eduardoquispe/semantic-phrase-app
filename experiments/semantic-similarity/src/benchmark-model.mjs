import { performance } from "node:perf_hooks";
import { readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { env, pipeline } from "@huggingface/transformers";
import { applyDenseProjection, loadDenseProjection } from "./dense-projection.mjs";
import { getModel, models } from "./model-config.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheRoot = path.join(experimentRoot, ".cache", "huggingface");

const samples = [
  "El usuario olvidó su contraseña y necesita recuperar el acceso.",
  "Necesito restablecer mi clave para entrar nuevamente.",
  "Mañana lloverá durante toda la tarde.",
  "El pedido contiene tres productos.",
  "El pedido no contiene tres productos.",
  "¿Cómo puedo cancelar la compra realizada ayer?"
];

function parseArguments(argv) {
  const options = { model: null, dtype: "q8", iterations: 8, quick: false, list: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--model") options.model = argv[++index];
    else if (value === "--dtype") options.dtype = argv[++index];
    else if (value === "--iterations") options.iterations = Number(argv[++index]);
    else if (value === "--quick") options.quick = true;
    else if (value === "--list") options.list = true;
    else throw new Error(`Argumento desconocido: ${value}`);
  }
  if (!Number.isInteger(options.iterations) || options.iterations < 1) {
    throw new Error("--iterations debe ser un entero positivo");
  }
  return options;
}

async function directorySize(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      total += entry.isDirectory() ? await directorySize(entryPath) : (await stat(entryPath)).size;
    }
    return total;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

function vectorFromTensor(tensor) {
  const dimensions = tensor.dims.at(-1);
  return Float32Array.from(tensor.data.slice(0, dimensions));
}

function norm(vector) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function cosine(left, right) {
  if (left.length !== right.length) throw new Error("Los vectores tienen dimensiones diferentes");
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function maxAbsoluteDifference(left, right) {
  let maximum = 0;
  for (let index = 0; index < left.length; index += 1) {
    maximum = Math.max(maximum, Math.abs(left[index] - right[index]));
  }
  return maximum;
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  if (options.list) {
    console.log(JSON.stringify(Object.values(models), null, 2));
    return;
  }
  if (!options.model) throw new Error("Falta --model");

  const model = getModel(options.model);
  env.cacheDir = cacheRoot;
  env.allowLocalModels = false;

  const preparedSamples = samples.map((text) => `${model.prefix}${text}`);
  const cacheBytesBefore = await directorySize(cacheRoot);
  const memoryBefore = process.memoryUsage();

  const loadStartedAt = performance.now();
  const extractor = await pipeline("feature-extraction", model.runtimeModel, {
    device: "cpu",
    dtype: options.dtype
  });
  const denseProjection = model.projection
    ? await loadDenseProjection(model.projection, cacheRoot)
    : null;
  const loadMs = performance.now() - loadStartedAt;
  const memoryAfterLoad = process.memoryUsage();

  const embeddingOptions = { pooling: model.pooling, normalize: denseProjection === null };
  const embed = async (input) => {
    const output = await extractor(input, embeddingOptions);
    return denseProjection ? applyDenseProjection(output, denseProjection) : output;
  };
  const firstStartedAt = performance.now();
  const firstOutput = await embed(preparedSamples[0]);
  const firstInferenceMs = performance.now() - firstStartedAt;
  const firstVector = vectorFromTensor(firstOutput);

  const iterations = options.quick ? 2 : options.iterations;
  const warmLatencies = [];
  let repeatedVector;
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    const output = await embed(preparedSamples[0]);
    warmLatencies.push(performance.now() - startedAt);
    repeatedVector = vectorFromTensor(output);
  }

  const pairOutput = await embed(preparedSamples.slice(0, 2));
  const pairData = pairOutput.data;
  const dimensions = pairOutput.dims.at(-1);
  const left = Float32Array.from(pairData.slice(0, dimensions));
  const right = Float32Array.from(pairData.slice(dimensions, dimensions * 2));

  const batchStartedAt = performance.now();
  const batchOutput = await embed(preparedSamples);
  const batchMs = performance.now() - batchStartedAt;
  const allFinite = batchOutput.data.every(Number.isFinite);

  await extractor.dispose();
  if (global.gc) global.gc();

  const memoryAfterInference = process.memoryUsage();
  const cacheBytesAfter = await directorySize(cacheRoot);
  const actualDimensions = firstVector.length;
  const normalizedVectorNorm = round(norm(firstVector), 6);
  const deterministicMaxAbsoluteDifference = round(maxAbsoluteDifference(firstVector, repeatedVector), 9);
  const cosineSymmetryDifference = round(Math.abs(cosine(left, right) - cosine(right, left)), 9);
  const validationFailures = [];
  if (actualDimensions !== model.expectedDimensions) {
    validationFailures.push(
      `dimensión esperada ${model.expectedDimensions}, obtenida ${actualDimensions}`
    );
  }
  if (!allFinite) validationFailures.push("el lote contiene valores no finitos");
  if (Math.abs(normalizedVectorNorm - 1) > 0.00001) {
    validationFailures.push(`norma esperada 1, obtenida ${normalizedVectorNorm}`);
  }
  if (deterministicMaxAbsoluteDifference > 0.000001) {
    validationFailures.push(
      `diferencia entre ejecuciones ${deterministicMaxAbsoluteDifference} > 0.000001`
    );
  }
  if (cosineSymmetryDifference > 0.000000001) {
    validationFailures.push(`diferencia de simetría ${cosineSymmetryDifference} > 1e-9`);
  }
  const result = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      cpuExecution: true
    },
    model: {
      ...model,
      dtype: options.dtype,
      outputDimensions: actualDimensions,
      dimensionsMatchExpectation: actualDimensions === model.expectedDimensions
    },
    validity: {
      allValuesFinite: allFinite,
      normalizedVectorNorm,
      deterministicMaxAbsoluteDifference,
      pairCosineForward: round(cosine(left, right), 6),
      pairCosineReverse: round(cosine(right, left), 6),
      cosineSymmetryDifference
    },
    validation: {
      passed: validationFailures.length === 0,
      failures: validationFailures
    },
    timingMs: {
      modelLoad: round(loadMs),
      firstInference: round(firstInferenceMs),
      warmMedian: round(percentile(warmLatencies, 0.5)),
      warmP95: round(percentile(warmLatencies, 0.95)),
      warmMin: round(Math.min(...warmLatencies)),
      warmMax: round(Math.max(...warmLatencies)),
      batchOfSix: round(batchMs),
      batchPerPhrase: round(batchMs / preparedSamples.length),
      warmIterations: iterations
    },
    memoryBytes: {
      rssBefore: memoryBefore.rss,
      rssAfterLoad: memoryAfterLoad.rss,
      rssAfterInferenceAndDispose: memoryAfterInference.rss,
      rssLoadDelta: memoryAfterLoad.rss - memoryBefore.rss,
      peakRssReportedByProcess: process.resourceUsage().maxRSS * 1024
    },
    cacheBytes: {
      before: cacheBytesBefore,
      after: cacheBytesAfter,
      downloadedDuringRun: Math.max(0, cacheBytesAfter - cacheBytesBefore)
    }
  };

  console.log(`RESULT_JSON:${JSON.stringify(result)}`);
  if (!result.validation.passed) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
