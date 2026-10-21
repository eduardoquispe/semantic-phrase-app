import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { cosineSimilarity } from "../src/evaluation-core.mjs";
import { createFlow, modelIdentity, vectorLiteral } from "../src/flow-prototype.mjs";
import { createFlowStore } from "../src/flow-store.mjs";

const url = process.env.PGVECTOR_TEST_URL;
const safeTestDatabase = url && new URL(url).pathname === "/semantic_flow_test";

function axis(dimensions, position) {
  const vector = new Float32Array(dimensions);
  vector[position] = 1;
  return vector;
}

function fakeEmbedder(key, queryVector) {
  const dimensions = key === "minilm" ? 384 : 1024;
  return {
    model: { key, runtimeModel: `test/${key}`, pooling: key === "minilm" ? "mean" : "cls", expectedDimensions: dimensions },
    dtype: "q8",
    async embedTexts() { return [queryVector]; }
  };
}

test("pgvector recupera solo frases activas del modelo y resuelve empates por id", {
  skip: !safeTestDatabase && "Configura PGVECTOR_TEST_URL con la base semantic_flow_test"
}, async () => {
  const db = new pg.Pool({ connectionString: url });
  const store = createFlowStore(db);
  try {
    await store.init();
    await db.query("TRUNCATE prototype_phrase_embeddings, prototype_phrases RESTART IDENTITY CASCADE");
    const first = await store.addPhrase("Restablecer mi contraseña");
    const second = await store.addPhrase("Lloverá mañana");
    const third = await store.addPhrase("Recuperar el acceso");
    const mini = fakeEmbedder("minilm", axis(384, 0));
    const bge = fakeEmbedder("bge_m3", axis(1024, 0));

    await assert.rejects(
      createFlow({ store, embedder: mini, threshold: 0.7 }).validate("Necesito acceso"),
      /no tienen embedding/
    );

    await store.saveEmbeddings([first, second, third],
      [axis(384, 0), axis(384, 1), axis(384, 0)], modelIdentity(mini));
    await store.saveEmbeddings([first, second, third],
      [axis(1024, 1), axis(1024, 0), axis(1024, 0)], modelIdentity(bge));

    const miniResult = await createFlow({ store, embedder: mini, threshold: 0.7 })
      .validate("Necesito acceso");
    const bgeResult = await createFlow({ store, embedder: bge, threshold: 0.7 })
      .validate("Necesito acceso");
    assert.equal(miniResult.nearest.id, first.id);
    assert.equal(bgeResult.nearest.id, second.id);
    assert.equal(miniResult.nearest.score, cosineSimilarity(axis(384, 0), axis(384, 0)));
    assert.equal(bgeResult.nearest.score, cosineSimilarity(axis(1024, 0), axis(1024, 0)));
    const angled = new Float32Array(384);
    angled[0] = 0.6;
    angled[1] = 0.8;
    const pgCosine = await db.query(
      "SELECT 1 - ($1::vector <=> $2::vector) AS score",
      [vectorLiteral(axis(384, 0), 384), vectorLiteral(angled, 384)]
    );
    assert.ok(Math.abs(Number(pgCosine.rows[0].score) - cosineSimilarity(axis(384, 0), angled)) < 1e-6);

    const exact = await createFlow({ store, embedder: mini, threshold: 0.7 })
      .validate("  RESTABLECER  MI CONTRASEÑA ");
    assert.equal(exact.method, "textual");
    assert.equal(exact.nearest.id, first.id);

    await store.deactivatePhrase(first.id);
    const afterDeletion = await createFlow({ store, embedder: mini, threshold: 0.7 })
      .validate("Restablecer mi contraseña");
    assert.equal(afterDeletion.method, "semantic");
    assert.equal(afterDeletion.nearest.id, third.id);
    assert.equal((await createFlow({ store, embedder: bge, threshold: 0.7 })
      .validate("Necesito acceso")).nearest.id, second.id);
  } finally {
    await db.end();
  }
});
