const oppositeActions = [
  [["abre"], ["cierra"]],
  [["activa"], ["desactiva"]],
  [["enciende"], ["apaga"]],
  [["sube", "aumenta"], ["baja", "reduce"]],
  [["publica"], ["retira"]],
  [["confirma"], ["cancela", "anula"]]
];

const oppositeStates = [
  ["abierto", "cerrado"], ["abierta", "cerrada"],
  ["encendido", "apagado"], ["encendida", "apagada"],
  ["permitido", "prohibido"], ["permitida", "prohibida"],
  ["aprobado", "rechazado"], ["aprobada", "rechazada"],
  ["activo", "inactivo"], ["activa", "inactiva"]
];

const stopWords = new Set([
  "a", "al", "de", "del", "el", "la", "las", "los", "un", "una", "unos", "unas",
  "y", "o", "en", "por", "para", "con", "que", "se", "su", "sus", "mi", "mis",
  "tu", "tus", "es", "esta", "estan", "fue", "ya", "todavia", "no", "nunca", "sin"
]);
const negations = new Set(["no", "nunca", "sin"]);

export function tokenizeSpanish(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .match(/\p{L}+/gu) ?? [];
}

function contentOverlap(left, right) {
  const content = (tokens) => new Set(tokens.filter((token) => !stopWords.has(token)));
  const a = content(left);
  const b = content(right);
  if (a.size === 0 || b.size === 0) return 0;
  const common = [...a].filter((token) => b.has(token)).length;
  return common / Math.min(a.size, b.size);
}

export function relationGuard(textA, textB) {
  const left = tokenizeSpanish(textA);
  const right = tokenizeSpanish(textB);
  if (oppositeActions.some(([first, second]) =>
    (first.includes(left[0]) && second.includes(right[0])) ||
    (second.includes(left[0]) && first.includes(right[0]))
  ) && contentOverlap(left.slice(1), right.slice(1)) >= 0.6) return "opposite_action";

  const overlap = contentOverlap(left, right);
  if (overlap < 0.6) return null;
  const leftNegated = left.some((token) => negations.has(token));
  const rightNegated = right.some((token) => negations.has(token));
  if (leftNegated !== rightNegated) return "negation_mismatch";

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (oppositeStates.some(([first, second]) =>
    (leftSet.has(first) && rightSet.has(second)) ||
    (leftSet.has(second) && rightSet.has(first))
  )) return "opposite_state";
  return null;
}

export function applyRelationGuard(scoredPairs) {
  return scoredPairs.map((pair) => {
    const guardReason = relationGuard(pair.textA, pair.textB);
    return {
      ...pair,
      embeddingScore: pair.score,
      score: guardReason ? -1 : pair.score,
      guardReason
    };
  });
}
