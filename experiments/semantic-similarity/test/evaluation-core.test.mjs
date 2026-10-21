import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMetrics,
  cosineSimilarity,
  generateThresholdCandidates,
  normalizeForExactMatch,
  selectThreshold
} from "../src/evaluation-core.mjs";
import { eligibleModelsForHoldout, minimumAccuracy } from "../src/quality-criteria.mjs";

test("normaliza mayúsculas y espacios sin eliminar acentos", () => {
  assert.equal(normalizeForExactMatch("  HOLA   Árbol  "), "hola árbol");
  assert.notEqual(normalizeForExactMatch("dirección"), normalizeForExactMatch("direccion"));
});

test("calcula similitud coseno", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
});

test("genera todos los cortes de clasificación, incluidos extremos", () => {
  const thresholds = generateThresholdCandidates([0.2, 0.8, 0.5, 0.5]);
  assert.deepEqual(thresholds.slice(0, -1), [0.2, 0.35, 0.65]);
  assert.ok(thresholds.at(-1) > 0.8);
});

test("calcula matriz y métricas para la clase similar", () => {
  const result = calculateMetrics([
    { id: "1", label: "similar", score: 0.9 },
    { id: "2", label: "similar", score: 0.4 },
    { id: "3", label: "not_similar", score: 0.8 },
    { id: "4", label: "not_similar", score: 0.2 }
  ], 0.5);
  assert.deepEqual(result.confusionMatrix, {
    truePositive: 1,
    trueNegative: 1,
    falsePositive: 1,
    falseNegative: 1
  });
  assert.equal(result.accuracy, 0.5);
  assert.equal(result.precision, 0.5);
  assert.equal(result.recall, 0.5);
  assert.equal(result.f1, 0.5);
});

test("selecciona un umbral elegible con separación perfecta", () => {
  const scoredPairs = [
    { id: "s", label: "similar", score: 0.9 },
    { id: "n", label: "not_similar", score: 0.1 }
  ];
  const result = selectThreshold(scoredPairs, 0.8);
  assert.equal(result.eligible, true);
  assert.equal(result.selected.accuracy, 1);
  assert.equal(result.selected.threshold, 0.5);
});

test("prioriza recall cuando dos umbrales empatan en F2", () => {
  const scoredPairs = [
    { id: "1", label: "similar", score: 0.1 },
    { id: "2", label: "not_similar", score: 0.2 },
    { id: "3", label: "not_similar", score: 0.3 },
    { id: "4", label: "not_similar", score: 0.4 },
    { id: "5", label: "not_similar", score: 0.5 },
    { id: "6", label: "not_similar", score: 0.6 },
    { id: "7", label: "not_similar", score: 0.7 },
    { id: "8", label: "similar", score: 0.8 },
    { id: "9", label: "similar", score: 0.9 }
  ];
  const result = selectThreshold(scoredPairs, 0);
  assert.equal(result.selected.threshold, 0.1);
  assert.equal(result.selected.recall, 1);
});

test("marca como no elegible cuando ningún umbral alcanza la accuracy mínima", () => {
  const scoredPairs = [
    { id: "s1", label: "similar", score: 0.1 },
    { id: "s2", label: "similar", score: 0.2 },
    { id: "n1", label: "not_similar", score: 0.8 },
    { id: "n2", label: "not_similar", score: 0.9 }
  ];
  const result = selectThreshold(scoredPairs, 0.8);
  assert.equal(result.eligible, false);
  assert.ok(result.selected.f2 > 0);
});

test("el mínimo vigente acepta 75 % y rechaza el manifiesto histórico de 80 %", () => {
  const scoredPairs = [
    { label: "similar", score: 0.9 },
    { label: "similar", score: 0.3 },
    { label: "not_similar", score: 0.7 },
    { label: "not_similar", score: 0.1 }
  ];
  const selected = selectThreshold(scoredPairs);
  assert.equal(minimumAccuracy, 0.75);
  assert.equal(selected.eligible, true);
  assert.equal(selected.selected.accuracy, 0.75);
  const manifest = {
    experiment: "02-semantic-quality-calibration",
    stage: "calibration",
    minimumCalibrationAccuracy: 0.8,
    results: { minilm: {
      eligible: true,
      selectedThreshold: selected.selected.threshold,
      metrics: selected.selected
    } }
  };
  assert.throws(() => eligibleModelsForHoldout(manifest), /75 %/);
  manifest.minimumCalibrationAccuracy = minimumAccuracy;
  assert.equal(eligibleModelsForHoldout(manifest)[0][0], "minilm");
});
