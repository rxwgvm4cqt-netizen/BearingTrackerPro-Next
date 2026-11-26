import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { defaultPresets } from "../src/data/presets.js";
import { createSession } from "../src/engine/kinematics.js";
import { translate } from "../src/i18n/next.js";
let App, Tracking, Preset, Analysis;
const noop = () => {};
const props = () => ({
  session: createSession(defaultPresets),
  presets: structuredClone(defaultPresets),
  preset: structuredClone(defaultPresets[0]),
  calibrations: [],
  t: (key) => translate("de", key),
  language: "de",
  onDelta: noop,
  onInterrupt: noop,
});
before(async () => {
  globalThis.localStorage = { getItem: () => null, setItem: noop };
  await build({
    configFile: false,
    plugins: [react()],
    logLevel: "silent",
    build: {
      ssr: true,
      outDir: ".test-runtime",
      rollupOptions: {
        input: {
          App: "src/App.jsx",
          Tracking: "src/pages/TrackingPage.jsx",
          Preset: "src/pages/BearingDataPage.jsx",
          Analysis: "src/pages/AnalysisPage.jsx",
        },
      },
    },
  });
  [App, Tracking, Preset, Analysis] = await Promise.all(
    ["App", "Tracking", "Preset", "Analysis"].map(
      async (name) => (await import(`../.test-runtime/${name}.js`)).default,
    ),
  );
});
test("initial application renders immediately without a login gate", () => {
  const html = renderToString(createElement(App));
  assert.ok(html.includes('data-testid="rotor-dial"'));
  assert.ok(html.includes("Finger Tracking"));
  assert.ok(html.includes("Presets bearbeiten"));
  assert.ok(!html.includes("login-form"));
  assert.ok(!html.includes("case-toolbar"));
  assert.ok(!html.includes("Fall speichern"));
  assert.ok(!html.includes("Backup exportieren"));
  assert.ok(!html.includes("Backup importieren"));
});
test("preset editor keeps editable numbers and save while hiding quality and sources", () => {
  const html = renderToString(createElement(Preset, props()));
  assert.ok(html.includes('name="rollerCount"'));
  assert.ok(html.includes('name="manualFactor"'));
  assert.ok(html.includes("Preset speichern"));
  assert.ok(!html.includes("readOnly"));
  assert.ok(!html.includes("Datenqualität"));
  assert.ok(!html.includes("Quelle / Nachweis"));
});
test("unknown roller count is explicitly symbolic and has no invented defect", () => {
  const html = renderToString(createElement(Tracking, props()));
  assert.ok(html.includes("Symbolische Rollen"));
  assert.ok(!html.includes('data-testid="defect-marker"'));
});
test("marked defect renders in the dial", () => {
  const p = props();
  p.session.rows[p.preset.id].marked = true;
  const html = renderToString(createElement(Tracking, p));
  assert.ok(html.includes('data-testid="defect-marker"'));
});
test("uncertain synchronization suppresses precise target movement", () => {
  const p = props();
  p.session.sync = "uncertain";
  p.session.rows[p.preset.id].marked = true;
  const html = renderToString(createElement(Analysis, p));
  assert.ok(html.includes("Keine gesicherte Zielposition"));
});
test("already reached target is shown without another revolution", () => {
  const p = props();
  p.session.sync = "synced";
  p.session.rows[p.preset.id].marked = true;
  const html = renderToString(createElement(Analysis, p));
  assert.ok(html.includes("Zielposition erreicht"));
});
test("English view and generator-side view render", () => {
  const p = props();
  p.preset.viewingDirection = "generator";
  p.t = (key) => translate("en", key);
  const html = renderToString(createElement(Tracking, p));
  assert.ok(html.includes("From generator side"));
  assert.ok(html.includes("Manual RPM"));
  assert.ok(html.includes("Symbolic rollers"));
});

test("references and known movement appear only on analysis", () => {
  assert.ok(!renderToString(createElement(Tracking, props())).includes("Referenzierung &amp; bekannte Bewegung"));
  assert.ok(renderToString(createElement(Analysis, props())).includes("Referenzierung &amp; bekannte Bewegung"));
});

test("tracking has compact values before the unchanged dial and no JOG controls", () => {
  const html = renderToString(createElement(Tracking, props()));
  assert.ok(html.includes("Defekt erkannt"));
  assert.ok(!html.includes("jog-speed-control"));
  assert.ok(!html.includes("jog-button"));
  assert.ok(!html.includes("Positionieren"));
  assert.ok(html.indexOf("tracking-metrics") < html.indexOf('data-testid="rotor-dial"'));
});
