import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const tesseract = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(require.resolve("tesseract.js-core/package.json"));
const target = "public/ocr";
await mkdir(target, { recursive: true });
await rm(join(target, "core"), { recursive: true, force: true });
await mkdir(join(target, "core"));
// OEM.LSTM_ONLY; the .wasm.js variants embed their own WASM bytes.
for (const file of [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
])
  await copyFile(join(core, file), join(target, "core", file));
await copyFile(
  join(tesseract, "dist/worker.min.js"),
  join(target, "worker.min.js"),
);
await copyFile(
  join(tesseract, "LICENSE.md"),
  join(target, "TESSERACT-LICENSE"),
);
await copyFile(join(core, "LICENSE"), join(target, "CORE-LICENSE"));
await stat(join(target, "lang/eng.traineddata.gz"));
console.log("Local OCR worker, embedded WASM and language data ready");
