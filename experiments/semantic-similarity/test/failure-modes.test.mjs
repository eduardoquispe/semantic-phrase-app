import assert from "node:assert/strict";
import test from "node:test";
import { createFlow, modelIdentity, vectorLiteral } from "../src/flow-prototype.mjs";
import { createFlowStore } from "../src/flow-store.mjs";

function embedder(vector = Float32Array.from([1, 0]), runtimeModel = "Xenova/minilm") {
  return {
    model: { key: "minilm", runtimeModel, pooling: "mean", expectedDimensions: 2 },
    dtype: "q8",
    async embedTexts() { return [vector]; }
  };
}

function store(overrides = {}) {
  const calls = [];
  return {
    calls,
    async findCorpusMatch() { calls.push("corpus"); return { exact: null, activeCount: 1 }; },
    async findNearest() { calls.push("nearest"); return { id: "1", text: "Frase", score: 0.9 }; },
    ...overrides
  };
}

test("fallos de base, inferencia y timeout abortan la validación sin devolver permiso de guardar", async () => {
  for (const [name, setup] of [
    ["postgres", { store: store({ async findCorpusMatch() { throw new Error("ECONNREFUSED"); } }) }],
    ["inferencia", { embedder: { ...embedder(), async embedTexts() { throw new Error("modelo incompleto"); } } }],
    ["timeout", { embedder: { ...embedder(), async embedTexts() { throw new Error("timeout"); } } }],
    ["pgvector", { store: store({ async findNearest() { throw new Error("extension vector unavailable"); } }) }]
  ]) {
    const result = createFlow({ store: setup.store ?? store(), embedder: setup.embedder ?? embedder(), threshold: 0.7 });
    await assert.rejects(result.validate("Una frase nueva"), /ECONNREFUSED|modelo incompleto|timeout|extension vector unavailable/, name);
  }
});

test("embeddings inválidos se rechazan antes de buscar y guardar", async () => {
  for (const vector of [Float32Array.from([NaN, 0]), Float32Array.from([Infinity, 0]),
    Float32Array.from([0, 0]), Float32Array.from([1])]) {
    const database = store();
    await assert.rejects(createFlow({ store: database, embedder: embedder(vector), threshold: 0.7 })
      .validate("Una frase nueva"), /Embedding inválido/);
    assert.deepEqual(database.calls, ["corpus"]);
  }
});

test("la identidad separa modelos, pero no distingue revisiones del mismo identificador", () => {
  const initial = modelIdentity(embedder());
  const changedModel = modelIdentity(embedder(Float32Array.from([1, 0]), "Xenova/minilm-v2"));
  assert.notEqual(initial.version, changedModel.version);
  assert.equal(initial.dimensions, changedModel.dimensions);
  assert.equal(initial.version, modelIdentity(embedder()).version);
});

test("una dimensión errónea y un fallo de escritura revierten el lote de indexación", async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql.trim().split(/\s+/u)[0]);
      if (sql.includes("INSERT INTO")) throw new Error("dimension mismatch");
    },
    release() { statements.push("RELEASE"); }
  };
  const database = { async connect() { return client; } };
  const flowStore = createFlowStore(database);
  assert.throws(() => vectorLiteral([1], 2), /Embedding inválido/);
  await assert.rejects(flowStore.saveEmbeddings([{ id: "1" }], [Float32Array.from([1, 0])], modelIdentity(embedder())), /dimension mismatch/);
  assert.deepEqual(statements, ["BEGIN", "INSERT", "ROLLBACK", "RELEASE"]);
});
