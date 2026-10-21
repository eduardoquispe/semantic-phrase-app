export const models = {
  minilm: {
    key: "minilm",
    sourceModel: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    runtimeModel: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    expectedDimensions: 384,
    pooling: "mean",
    prefix: "",
    notes: "Modelo multilingüe ligero orientado a paráfrasis."
  },
  e5: {
    key: "e5",
    sourceModel: "intfloat/multilingual-e5-small",
    runtimeModel: "Xenova/multilingual-e5-small",
    expectedDimensions: 384,
    pooling: "mean",
    prefix: "query: ",
    notes: "Para similitud simétrica, la model card recomienda el prefijo query en ambos textos."
  },
  distiluse: {
    key: "distiluse",
    sourceModel: "sentence-transformers/distiluse-base-multilingual-cased-v2",
    runtimeModel: "Xenova/distiluse-base-multilingual-cased-v2",
    expectedDimensions: 512,
    pooling: "mean",
    prefix: "",
    projection: {
      repository: "sentence-transformers/distiluse-base-multilingual-cased-v2",
      revision: "bfe45d0732ca50787611c0fe107ba278c7f3f889",
      file: "2_Dense/model.safetensors",
      inputDimensions: 768,
      outputDimensions: 512,
      activation: "tanh"
    },
    notes: "Baseline multilingüe maduro con proyección Sentence Transformers a 512 dimensiones."
  },
  bge_m3: {
    key: "bge_m3",
    sourceModel: "BAAI/bge-m3",
    runtimeModel: "Xenova/bge-m3",
    expectedDimensions: 1024,
    pooling: "cls",
    prefix: "",
    notes: "Se evalúa solo el embedding denso normalizado; BGE-M3 usa pooling CLS."
  },
  granite_97m_r2: {
    key: "granite_97m_r2",
    sourceModel: "ibm-granite/granite-embedding-97m-multilingual-r2",
    runtimeModel: "onnx-community/granite-embedding-97m-multilingual-r2-ONNX",
    expectedDimensions: 384,
    pooling: "cls",
    prefix: "",
    notes: "Granite Embedding 97M Multilingual R2 con pooling CLS y normalización L2."
  },
  mpnet_multilingual: {
    key: "mpnet_multilingual",
    sourceModel: "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
    runtimeModel: "Xenova/paraphrase-multilingual-mpnet-base-v2",
    expectedDimensions: 768,
    pooling: "mean",
    prefix: "",
    notes: "Modelo multilingüe de paráfrasis con mean pooling y normalización L2."
  }
};

export function getModel(key) {
  const model = models[key];
  if (!model) {
    throw new Error(`Modelo desconocido: ${key}. Opciones: ${Object.keys(models).join(", ")}`);
  }
  return model;
}
