CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS prototype_phrases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  text text NOT NULL,
  normalized_text text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT prototype_phrase_text_length CHECK (char_length(text) BETWEEN 1 AND 280)
);

CREATE INDEX IF NOT EXISTS prototype_phrases_active_text_idx
  ON prototype_phrases (normalized_text, id) WHERE active;

CREATE TABLE IF NOT EXISTS prototype_phrase_embeddings (
  phrase_id bigint NOT NULL REFERENCES prototype_phrases(id),
  model_key text NOT NULL,
  model_version text NOT NULL,
  dimensions integer NOT NULL,
  embedding vector NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phrase_id, model_key, model_version),
  CONSTRAINT prototype_embedding_dimensions CHECK (vector_dims(embedding) = dimensions)
);

CREATE INDEX IF NOT EXISTS prototype_embeddings_model_idx
  ON prototype_phrase_embeddings (model_key, model_version, phrase_id);
