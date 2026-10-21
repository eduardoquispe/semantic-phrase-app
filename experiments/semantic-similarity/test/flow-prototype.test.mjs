import assert from "node:assert/strict";
import test from "node:test";
import { createFlow, validatePhraseText, vectorLiteral } from "../src/flow-prototype.mjs";

function harness({ exact = null, activeCount = 1, nearest = { id: "1", text: "frase", score: 0.8 }, threshold = 0.75 } = {}) {
  const calls = [];
  const store = {
    async findCorpusMatch(normalized, model) {
      calls.push(["corpus", normalized, model.key]);
      return { exact, activeCount };
    },
    async findNearest(vector, model) {
      calls.push(["nearest", vector, model.key]);
      return nearest;
    }
  };
  const embedder = {
    model: { key: "minilm", runtimeModel: "Xenova/minilm", pooling: "mean", expectedDimensions: 2 },
    dtype: "q8",
    async embedTexts(texts) {
      calls.push(["embed", texts]);
      return [Float32Array.from([1, 0])];
    }
  };
  return { calls, flow: createFlow({ store, embedder, threshold }) };
}

test("coincidencia textual normalizada tiene prioridad y alerta sin inferencia", async () => {
  const { calls, flow } = harness({ exact: { id: "7", text: "Hola mundo" } });
  const result = await flow.validate("  HOLA   MUNDO  ");
  assert.equal(result.method, "textual");
  assert.equal(result.nearest.score, 1);
  assert.equal(result.alert, true);
  assert.deepEqual(calls.map(([operation]) => operation), ["corpus"]);
  assert.equal(calls[0][1], "hola mundo");
});

test("sin frases no infiere ni alerta", async () => {
  const { calls, flow } = harness({ activeCount: 0 });
  const result = await flow.validate("Una frase nueva");
  assert.equal(result.status, "no_phrases");
  assert.equal(result.nearest, null);
  assert.deepEqual(calls.map(([operation]) => operation), ["corpus"]);
});

test("la candidata semántica se compara con el umbral inclusivo", async () => {
  const { calls, flow } = harness({ nearest: { id: "3", text: "Otra frase", score: 0.75 } });
  const result = await flow.validate("Una frase nueva");
  assert.equal(result.status, "alert");
  assert.equal(result.nearest.id, "3");
  assert.deepEqual(calls.map(([operation]) => operation), ["corpus", "embed", "nearest"]);
  assert.equal(calls[2][1], "[1,0]");
  assert.ok(result.timingMs.total >= 0);
});

test("puntaje menor al umbral no alerta, pero conserva candidata y score", async () => {
  const { flow } = harness({ nearest: { id: "4", text: "Otra frase", score: 0.74 } });
  const result = await flow.validate("Una frase nueva");
  assert.equal(result.status, "clear");
  assert.equal(result.alert, false);
  assert.equal(result.nearest.score, 0.74);
});

test("fallos de inferencia y búsqueda se propagan", async () => {
  const { flow } = harness({ nearest: null });
  await assert.rejects(flow.validate("Una frase nueva"), /no devolvió/);
  assert.throws(() => vectorLiteral([1, Number.NaN], 2), /inválido/);
  assert.throws(() => vectorLiteral([0, 0], 2), /norma cero/);
  assert.throws(() => validatePhraseText("!!!"), /al menos una letra/);
  assert.throws(() => validatePhraseText("una\nfrase"), /una línea/);
});
