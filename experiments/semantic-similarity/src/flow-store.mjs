import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeForExactMatch } from "./evaluation-core.mjs";
import { validatePhraseText, vectorLiteral } from "./flow-prototype.mjs";

const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../sql/flow-prototype.sql");

export function createFlowStore(db) {
  return {
    async init() {
      await db.query(await readFile(schemaPath, "utf8"));
    },
    async addPhrase(input) {
      const text = validatePhraseText(input);
      const result = await db.query(
        "INSERT INTO prototype_phrases (text, normalized_text) VALUES ($1, $2) RETURNING id, text",
        [text, normalizeForExactMatch(text)]
      );
      return result.rows[0];
    },
    async deactivatePhrase(id) {
      const result = await db.query(
        "UPDATE prototype_phrases SET active = false, deleted_at = now() WHERE id = $1 AND active RETURNING id",
        [id]
      );
      return result.rowCount === 1;
    },
    async unindexedPhrases(model) {
      const result = await db.query(`
        SELECT p.id, p.text FROM prototype_phrases p
        WHERE p.active AND NOT EXISTS (
          SELECT 1 FROM prototype_phrase_embeddings e
          WHERE e.phrase_id = p.id AND e.model_key = $1 AND e.model_version = $2
        ) ORDER BY p.id`, [model.key, model.version]);
      return result.rows;
    },
    async saveEmbeddings(phrases, vectors, model) {
      if (phrases.length !== vectors.length) throw new Error("Falta un embedding para una frase");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        for (let index = 0; index < phrases.length; index += 1) {
          await client.query(`
            INSERT INTO prototype_phrase_embeddings
              (phrase_id, model_key, model_version, dimensions, embedding)
            VALUES ($1, $2, $3, $4, $5::vector)
            ON CONFLICT (phrase_id, model_key, model_version) DO NOTHING`,
          [phrases[index].id, model.key, model.version, model.dimensions,
            vectorLiteral(vectors[index], model.dimensions)]);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async findCorpusMatch(normalizedText, model) {
      const result = await db.query(`
        SELECT
          (SELECT count(*)::integer FROM prototype_phrases WHERE active) AS active_count,
          (SELECT count(*)::integer FROM prototype_phrases p WHERE p.active AND NOT EXISTS (
            SELECT 1 FROM prototype_phrase_embeddings e
            WHERE e.phrase_id = p.id AND e.model_key = $2 AND e.model_version = $3
          )) AS unindexed_count,
          (SELECT row_to_json(match) FROM (
            SELECT id::text AS id, text FROM prototype_phrases
            WHERE active AND normalized_text = $1 ORDER BY id LIMIT 1
          ) match) AS exact`, [normalizedText, model.key, model.version]);
      const row = result.rows[0];
      if (Number(row.unindexed_count) > 0 && !row.exact) {
        throw new Error(`${row.unindexed_count} frases activas no tienen embedding de ${model.key}; ejecuta index`);
      }
      return { activeCount: Number(row.active_count), exact: row.exact };
    },
    async findNearest(vector, model) {
      const result = await db.query(`
        SELECT p.id, p.text, 1 - (e.embedding <=> $1::vector) AS score
        FROM prototype_phrase_embeddings e
        JOIN prototype_phrases p ON p.id = e.phrase_id
        WHERE p.active AND e.model_key = $2 AND e.model_version = $3
          AND e.dimensions = $4
        ORDER BY e.embedding <=> $1::vector, p.id
        LIMIT 1`, [vector, model.key, model.version, model.dimensions]);
      if (!result.rows[0]) return null;
      const row = result.rows[0];
      return { id: row.id, text: row.text, score: Number(row.score) };
    }
  };
}
