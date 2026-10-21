import process from "node:process";
import pg from "pg";
import { createEmbedder } from "./embedding-runtime.mjs";
import { createFlow, modelIdentity } from "./flow-prototype.mjs";
import { createFlowStore } from "./flow-store.mjs";

function parseArguments(argv) {
  const [command, ...argumentsList] = argv;
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const key = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!["--model", "--text", "--threshold", "--id"].includes(key) || value === undefined) {
      throw new Error(`Argumento inválido: ${key ?? "faltante"}`);
    }
    options[key.slice(2)] = value;
  }
  if (!["init", "add", "deactivate", "index", "validate"].includes(command)) {
    throw new Error("Uso: flow <init|add|deactivate|index|validate> [--model minilm|bge_m3] [--text frase] [--threshold número] [--id número]");
  }
  if (["add", "validate"].includes(command) && options.text === undefined) {
    throw new Error("Falta --text");
  }
  if (["index", "validate"].includes(command) && !["minilm", "bge_m3"].includes(options.model)) {
    throw new Error("--model debe ser minilm o bge_m3");
  }
  if (command === "validate" && options.threshold === undefined) {
    throw new Error("Falta --threshold; aún no hay un umbral calibrado");
  }
  if (command === "deactivate" && !/^[1-9]\d*$/u.test(options.id ?? "")) {
    throw new Error("--id debe ser un entero positivo");
  }
  return { command, options };
}

async function run() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const store = createFlowStore(db);
  try {
    if (command === "init") {
      await store.init();
      console.log(JSON.stringify({ initialized: true }));
    } else if (command === "add") {
      console.log(JSON.stringify(await store.addPhrase(options.text)));
    } else if (command === "deactivate") {
      console.log(JSON.stringify({ deactivated: await store.deactivatePhrase(options.id) }));
    } else {
      const embedder = await createEmbedder(options.model);
      try {
        if (command === "index") {
          const model = modelIdentity(embedder);
          const phrases = await store.unindexedPhrases(model);
          for (let index = 0; index < phrases.length; index += 16) {
            const batch = phrases.slice(index, index + 16);
            await store.saveEmbeddings(batch, await embedder.embedTexts(batch.map(({ text }) => text)), model);
          }
          console.log(JSON.stringify({ model, indexed: phrases.length }));
        } else {
          const threshold = Number(options.threshold);
          const flow = createFlow({ store, embedder, threshold });
          console.log(JSON.stringify(await flow.validate(options.text)));
        }
      } finally {
        await embedder.dispose();
      }
    }
  } finally {
    await db.end();
  }
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
