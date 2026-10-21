import { minimumAccuracy } from "./quality-criteria.mjs";

export function normalizeForExactMatch(text) {
  return text.trim().replace(/\s+/gu, " ").toLocaleLowerCase("es");
}

export function cosineSimilarity(left, right) {
  if (left.length !== right.length || left.length === 0) {
    throw new Error("Los vectores deben tener la misma dimensión y no estar vacíos");
  }

  let dot = 0;
  let leftSquaredNorm = 0;
  let rightSquaredNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftSquaredNorm += left[index] ** 2;
    rightSquaredNorm += right[index] ** 2;
  }

  const denominator = Math.sqrt(leftSquaredNorm) * Math.sqrt(rightSquaredNorm);
  if (!Number.isFinite(denominator) || denominator === 0) {
    throw new Error("No se puede calcular coseno para un vector inválido o de norma cero");
  }
  return dot / denominator;
}

export function classify(score, threshold) {
  return score >= threshold ? "similar" : "not_similar";
}

function safeDivide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function calculateMetrics(scoredPairs, threshold) {
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  const predictions = scoredPairs.map((pair) => {
    const prediction = classify(pair.score, threshold);
    if (pair.label === "similar" && prediction === "similar") truePositive += 1;
    else if (pair.label === "not_similar" && prediction === "not_similar") trueNegative += 1;
    else if (pair.label === "not_similar") falsePositive += 1;
    else falseNegative += 1;
    return { ...pair, prediction, correct: prediction === pair.label };
  });

  const total = scoredPairs.length;
  const precision = safeDivide(truePositive, truePositive + falsePositive);
  const recall = safeDivide(truePositive, truePositive + falseNegative);
  const f1 = safeDivide(2 * precision * recall, precision + recall);
  const betaSquared = 4;
  const f2 = safeDivide((1 + betaSquared) * precision * recall, betaSquared * precision + recall);

  return {
    threshold,
    accuracy: safeDivide(truePositive + trueNegative, total),
    precision,
    recall,
    f1,
    f2,
    confusionMatrix: { truePositive, trueNegative, falsePositive, falseNegative },
    predictions
  };
}

export function generateThresholdCandidates(scores) {
  if (scores.length === 0 || scores.some((score) => !Number.isFinite(score))) {
    throw new Error("Los puntajes deben ser una lista no vacía de números finitos");
  }

  const unique = [...new Set(scores)].sort((left, right) => left - right);
  const candidates = [unique[0]];
  for (let index = 0; index < unique.length - 1; index += 1) {
    candidates.push((unique[index] + unique[index + 1]) / 2);
  }
  candidates.push(unique.at(-1) + 1e-9);
  return candidates;
}

const comparisonFields = ["f2", "recall", "precision", "accuracy", "threshold"];

function compareCandidates(left, right) {
  for (const field of comparisonFields) {
    const difference = left[field] - right[field];
    if (Math.abs(difference) > 1e-12) return difference;
  }
  return 0;
}

export function selectThreshold(scoredPairs, minimumRequiredAccuracy = minimumAccuracy) {
  const evaluations = generateThresholdCandidates(scoredPairs.map(({ score }) => score))
    .map((threshold) => calculateMetrics(scoredPairs, threshold));
  const eligible = evaluations.filter(({ accuracy }) => accuracy + 1e-12 >= minimumRequiredAccuracy);
  const pool = eligible.length > 0 ? eligible : evaluations;
  const selected = pool.reduce((best, candidate) =>
    best === null || compareCandidates(candidate, best) > 0 ? candidate : best, null);

  return {
    eligible: eligible.length > 0,
    minimumAccuracy: minimumRequiredAccuracy,
    selected,
    evaluations
  };
}

function quantile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function scoreDistribution(scoredPairs, label) {
  const values = scoredPairs
    .filter((pair) => pair.label === label)
    .map((pair) => pair.score)
    .sort((left, right) => left - right);
  return {
    count: values.length,
    minimum: values[0] ?? null,
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    q3: quantile(values, 0.75),
    maximum: values.at(-1) ?? null
  };
}

export function thresholdSensitivity(scoredPairs, selectedThreshold) {
  const candidates = generateThresholdCandidates(scoredPairs.map(({ score }) => score));
  const selectedIndex = candidates.findIndex(
    (candidate) => Math.abs(candidate - selectedThreshold) <= 1e-12
  );
  const thresholds = new Set([selectedThreshold - 0.01, selectedThreshold, selectedThreshold + 0.01]);
  if (selectedIndex > 0) thresholds.add(candidates[selectedIndex - 1]);
  if (selectedIndex >= 0 && selectedIndex < candidates.length - 1) {
    thresholds.add(candidates[selectedIndex + 1]);
  }
  return [...thresholds]
    .sort((left, right) => left - right)
    .map((threshold) => calculateMetrics(scoredPairs, threshold));
}
