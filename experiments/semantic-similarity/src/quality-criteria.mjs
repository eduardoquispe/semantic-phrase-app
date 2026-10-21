export const minimumAccuracy = 0.75;

export function eligibleModelsForHoldout(manifest) {
  if (manifest.experiment !== "02-semantic-quality-calibration" || manifest.stage !== "calibration") {
    throw new Error("El manifiesto no es de calibración del Experimento 2");
  }
  if (manifest.minimumCalibrationAccuracy !== minimumAccuracy) {
    throw new Error(`El manifiesto debe usar el mínimo vigente de ${minimumAccuracy * 100} %`);
  }
  const eligible = Object.entries(manifest.results ?? {}).filter(([, result]) =>
    result.eligible === true &&
    Number.isFinite(result.selectedThreshold) &&
    result.metrics?.threshold === result.selectedThreshold &&
    result.metrics.accuracy + 1e-12 >= minimumAccuracy
  );
  if (eligible.length === 0) {
    throw new Error("El manifiesto no contiene modelos elegibles; el holdout debe permanecer cerrado");
  }
  return eligible;
}
