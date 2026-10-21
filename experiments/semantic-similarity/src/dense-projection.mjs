import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

function tensorElementCount(shape) {
  return shape.reduce((total, dimension) => total * dimension, 1);
}

function readFloat32Tensor(file, metadata, tensorName, dataStart) {
  const tensor = metadata[tensorName];
  if (!tensor) throw new Error(`No se encontró el tensor ${tensorName}`);
  if (tensor.dtype !== "F32") {
    throw new Error(`El tensor ${tensorName} usa ${tensor.dtype}; se esperaba F32`);
  }

  const [start, end] = tensor.data_offsets;
  const expectedBytes = tensorElementCount(tensor.shape) * Float32Array.BYTES_PER_ELEMENT;
  if (end - start !== expectedBytes || dataStart + end > file.byteLength) {
    throw new Error(`Offsets inválidos para el tensor ${tensorName}`);
  }

  const values = new Float32Array(
    file.buffer,
    file.byteOffset + dataStart + start,
    expectedBytes / Float32Array.BYTES_PER_ELEMENT
  );
  return { shape: tensor.shape, values: Float32Array.from(values) };
}

function parseSafeTensors(file) {
  if (file.byteLength < 8) throw new Error("Archivo safetensors incompleto");

  const headerLength = Number(file.readBigUInt64LE(0));
  const dataStart = 8 + headerLength;
  if (!Number.isSafeInteger(headerLength) || dataStart > file.byteLength) {
    throw new Error("Cabecera safetensors inválida");
  }

  const metadata = JSON.parse(file.subarray(8, dataStart).toString("utf8"));
  return {
    weight: readFloat32Tensor(file, metadata, "linear.weight", dataStart),
    bias: readFloat32Tensor(file, metadata, "linear.bias", dataStart)
  };
}

async function downloadProjection(projection, destination) {
  const url = new URL(
    `${projection.repository}/resolve/${projection.revision}/${projection.file}`,
    "https://huggingface.co/"
  );
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la proyección (${response.status} ${response.statusText})`);
  }

  const temporaryPath = `${destination}.${process.pid}.tmp`;
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(temporaryPath, new Uint8Array(await response.arrayBuffer()));
  await rename(temporaryPath, destination);
}

export async function loadDenseProjection(projection, cacheRoot) {
  const destination = path.join(
    cacheRoot,
    projection.repository,
    projection.revision,
    projection.file
  );

  let file;
  try {
    file = await readFile(destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await downloadProjection(projection, destination);
    file = await readFile(destination);
  }

  const { weight, bias } = parseSafeTensors(file);
  const [outputDimensions, inputDimensions] = weight.shape;
  if (
    inputDimensions !== projection.inputDimensions ||
    outputDimensions !== projection.outputDimensions ||
    bias.shape.length !== 1 ||
    bias.shape[0] !== outputDimensions
  ) {
    throw new Error(
      `Dimensiones inválidas en la proyección: weight=[${weight.shape}], bias=[${bias.shape}]`
    );
  }
  if (projection.activation !== "tanh") {
    throw new Error(`Activación no soportada: ${projection.activation}`);
  }

  return {
    inputDimensions,
    outputDimensions,
    weight: weight.values,
    bias: bias.values
  };
}

export function applyDenseProjection(tensor, projection) {
  const inputDimensions = tensor.dims.at(-1);
  if (inputDimensions !== projection.inputDimensions) {
    throw new Error(
      `La proyección esperaba ${projection.inputDimensions} dimensiones y recibió ${inputDimensions}`
    );
  }

  const rows = tensor.data.length / inputDimensions;
  if (!Number.isInteger(rows)) throw new Error("Forma inválida del tensor de entrada");

  const output = new Float32Array(rows * projection.outputDimensions);
  for (let row = 0; row < rows; row += 1) {
    const inputOffset = row * inputDimensions;
    const outputOffset = row * projection.outputDimensions;
    for (let outputIndex = 0; outputIndex < projection.outputDimensions; outputIndex += 1) {
      let value = projection.bias[outputIndex];
      const weightOffset = outputIndex * inputDimensions;
      for (let inputIndex = 0; inputIndex < inputDimensions; inputIndex += 1) {
        value += tensor.data[inputOffset + inputIndex] * projection.weight[weightOffset + inputIndex];
      }
      output[outputOffset + outputIndex] = Math.tanh(value);
    }

    let squaredNorm = 0;
    for (let index = 0; index < projection.outputDimensions; index += 1) {
      squaredNorm += output[outputOffset + index] ** 2;
    }
    const vectorNorm = Math.sqrt(squaredNorm);
    if (!Number.isFinite(vectorNorm) || vectorNorm === 0) {
      throw new Error("La proyección produjo un vector no normalizable");
    }
    for (let index = 0; index < projection.outputDimensions; index += 1) {
      output[outputOffset + index] /= vectorNorm;
    }
  }

  return {
    data: output,
    dims: [...tensor.dims.slice(0, -1), projection.outputDimensions]
  };
}
