import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createWorker, PSM } from "tesseract.js";
import { parseRpmFromText } from "../src/utils/ocrRpm.js";
test("bundled language data recognizes an RPM sample without network access", async () => {
  const worker = await createWorker("eng", 1, {
    langPath: resolve("public/ocr/lang"),
    gzip: true,
    cacheMethod: "none",
  });
  try {
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789.,RPM rpm",
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
    });
    const { data } = await worker.recognize("tests/fixtures/rpm.png");
    assert.equal(parseRpmFromText(data.text), 9.87);
  } finally {
    await worker.terminate();
  }
});
