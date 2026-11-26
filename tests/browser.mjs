import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { translate } from "../src/i18n/next.js";
const t = (key) => translate("de", key);
const url = process.env.BTP_TEST_URL ?? "http://127.0.0.1:4174/";
const storageKey = "bearingTrackerProNext.v1";
const browser = await chromium.launch({ headless: true });
const failures = [];
await mkdir("test-results", { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1180, height: 820 },
  });
  await context.addInitScript(() => {
    // Synthetic camera only: this suite never accesses a physical camera.
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        const draw = () => {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, 1280, 720);
          ctx.fillStyle = "#000";
          ctx.font = "80px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("9.87 RPM", 640, 360);
        };
        draw();
        const timer = setInterval(draw, 100);
        const stream = canvas.captureStream(10);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(timer);
            stop();
          };
        }
        return stream;
      },
    });
    Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
      configurable: true,
      value: async () => [
        {
          kind: "videoinput",
          deviceId: "synthetic",
          label: "Synthetic camera",
        },
      ],
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(e.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByTestId("rotor-dial").waitFor();
  for (const key of ["saveCase", "export", "import"]) {
    assert.equal(await page.getByRole("button", { name: t(key), exact: true }).count(), 0);
  }
  await page.getByRole("button", { name: t("analysis"), exact: true }).click();
  for (const key of ["saveCase", "export", "import"]) {
    assert.equal(await page.getByRole("button", { name: t(key), exact: true }).count(), 1);
  }
  await page
    .getByText(t("offlineReady"), { exact: true })
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: t("tracking"), exact: true }).click();
  console.log("PASS: tracking has no case toolbar; save and backup remain on analysis; complete offline package");
  const metricBox = await page.locator(".tracking-metrics").boundingBox();
  const rotorBox = await page.getByTestId("rotor-dial").boundingBox();
  assert.ok(metricBox.x + metricBox.width <= rotorBox.x);
  assert.equal(await page.locator(".jog-button, .jog-speed-control").count(), 0);
  assert.ok((await page.locator(".factor-readout").boundingBox()).height < 60);
  console.log("PASS: compact values left of rotor, compact factor, no JOG controls");

  const button = (name) => page.getByRole("button", { name, exact: true });
  const value = async (label) =>
    page
      .locator(".kpi-box")
      .filter({ has: page.locator(".kpi-box__label", { hasText: label }) })
      .first()
      .locator(".kpi-box__value")
      .innerText();
  const readState = () =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  await button(t("analysis")).click();
  await button(t("reference")).click();
  await button(t("tracking")).click();
  const dial = page.getByTestId("rotor-dial");
  await dial.scrollIntoViewIfNeeded();
  const box = await dial.boundingBox();
  await page.screenshot({ path: "test-results/input-ready.png", fullPage: true });
  console.log("Dial viewport", box);
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2,
    r = box.width * 0.36;
  const position = (angle) => ({
    x: cx + Math.sin((angle * Math.PI) / 180) * r,
    y: cy - Math.cos((angle * Math.PI) / 180) * r,
  });
  await page.mouse.move(position(0).x, position(0).y);
  await page.mouse.down();
  for (let angle = 10; angle <= 720; angle += 10) {
    const p = position(angle);
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
  assert.equal(await value(t("rotorTurns")), "2.0000");
  assert.equal(await value(t("rollerTurns")), "1.0162");
  await page.screenshot({
    path: "test-results/ipad-landscape.png",
    fullPage: true,
  });
  console.log("PASS: two full finger turns with k=0.5081");
  await page.mouse.move(position(120).x, position(120).y);
  await page.mouse.down();
  await page.mouse.up();
  assert.equal(await value(t("rotorTurns")), "2.0000");
  await button(t("manual")).click();
  assert.equal(await value(t("rotorTurns")), "2.0000");
  await page.locator("input[name=manualRpm]").fill("0");
  await button(t("combined")).click();
  await page.waitForTimeout(150);
  assert.equal(await value(t("rotorTurns")), "2.0000");
  await page.locator("input[name=manualRpm]").fill("1");
  await page.waitForTimeout(250);
  await page.locator("input[name=manualRpm]").fill("0");
  const moving = parseFloat(await value(t("rotorTurns")));
  assert.ok(moving > 2);
  await page.waitForTimeout(150);
  assert.equal(parseFloat(await value(t("rotorTurns"))), moving);
  await page.locator("input[name=manualRpm]").fill("1");
  await page.waitForTimeout(200);
  assert.ok(parseFloat(await value(t("rotorTurns"))) > moving);
  await button(t("combined")).click();
  await page.locator("input[name=manualRpm]").fill("30");
  await button(t("combined")).click();
  await page.waitForTimeout(100);
  await button(t("stopApp")).click();
  const coastStart = parseFloat(await value(t("rotorTurns")));
  await page.getByText(t("coasting"), { exact: true }).waitFor();
  await page.waitForTimeout(250);
  await button(t("stopApp")).click();
  await page.getByText(t("coasting"), { exact: true }).waitFor({ state: "hidden", timeout: 15000 });
  const coastEnd = parseFloat(await value(t("rotorTurns")));
  assert.ok(Math.abs(Math.abs(coastEnd - coastStart) - 2.5) < 0.02);
  await page.waitForTimeout(150);
  assert.equal(parseFloat(await value(t("rotorTurns"))), coastEnd);
  console.log("PASS: manual turbine stop slows over 2.5 turns; repeat stop preserves braking distance");
  await button(t("analysis")).click();
  await button(t("saveCase")).click();
  const before = (await readState()).session;
  console.log(
    "PASS: mode switch, 0 RPM, resume and pause without position resets",
  );
  await button(t("bearingData")).click();
  await page.locator("input[name=manualFactor]").fill("0.6");
  await page.locator("input[name=rollerCount]").fill("");
  await button(t("savePreset")).click();
  const saved = await readState();
  assert.equal(saved.presets[0].manualFactor, 0.6);
  assert.equal(saved.presets[0].rollerCount, null);
  assert.equal(saved.session.rotorAngle, before.rotorAngle);
  assert.equal(
    saved.session.rows["d10-upwind"].angle,
    before.rows["d10-upwind"].angle,
  );
  console.log("PASS: editable preset + save + unknown count + no angle jump");
  await button(t("analysis")).click();
  await page.locator("input[name=rotorDelta]").fill("720");
  await page.locator("input[name=rollerDelta]").fill("365.832");
  await page.locator("input[name=notes]").fill("CI synthetic calibration");
  await button(t("saveCalibration")).click();
  assert.equal((await readState()).calibrations.length, 1);
  page.once("dialog", (dialog) => dialog.accept());
  await button(t("applyCalibration")).click();
  const applied = await readState();
  assert.equal(applied.presets[0].factorMode, "calibrated");
  assert.ok(Math.abs(applied.presets[0].calibratedFactor - 0.5081) < 1e-12);
  assert.equal(
    applied.session.rows["d10-upwind"].angle,
    before.rows["d10-upwind"].angle,
  );
  const downloadPromise = page.waitForEvent("download");
  await button(t("export")).click();
  const downloaded = await downloadPromise;
  const backup = JSON.parse(await readFile(await downloaded.path(), "utf8"));
  assert.equal(backup.version, 1);
  console.log(
    "PASS: calibration save/apply + snapshot persistence + backup export",
  );
  await button(t("tracking")).click();
  await button(t("ocr")).click();
  await button(t("cameraStart")).click();
  await button(t("ocrStart")).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".camera-rpm-panel strong")?.textContent ===
      "9.87",
    null,
    { timeout: 30000 },
  );
  await button(t("combined")).click();
  await page.waitForTimeout(200);
  await button(t("analysis")).click();
  await page.waitForTimeout(2000);
  assert.equal(
    await page.locator(".camera-rpm-panel strong").innerText(),
    "9.87",
  );
  assert.equal((await readState()).session.mode, "ocr");
  console.log("PASS: browser OCR with synthetic camera, including page switch");
  await button(t("saveCase")).click();
  await page.screenshot({ path: "test-results/analysis.png", fullPage: true });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("rotor-dial").waitFor();
  assert.ok(await page.getByText(t("uncertain"), { exact: true }).count());
  await button(t("cameraStart")).click();
  await button(t("ocrStart")).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".camera-rpm-panel strong")?.textContent ===
      "9.87",
    null,
    { timeout: 30000 },
  );
  console.log("PASS: offline reload and offline OCR from local cache");
  await context.close();
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const phonePage = await phone.newPage();
  await phonePage.goto(url, { waitUntil: "networkidle" });
  assert.ok(await phonePage.getByTestId("rotor-dial").isVisible());
  const overflow = await phonePage.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  assert.equal(overflow, false);
  await phonePage.screenshot({
    path: "test-results/iphone.png",
    fullPage: true,
  });
  await phone.close();
  assert.deepEqual(failures, []);
  console.log("PASS: phone layout, no horizontal overflow or runtime errors");
} finally {
  await browser.close();
}
