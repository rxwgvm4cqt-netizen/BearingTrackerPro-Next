import test from "node:test";
import assert from "node:assert/strict";
import {
  activeFactor,
  advanceAngles,
  calibrationFactor,
  createSession,
  integrateRpm,
  normalizeAngle,
  pointerAngle,
  pointerDelta,
  rotationToTarget,
  theoreticalFactor,
} from "../src/engine/kinematics.js";
import { defaultPresets, validatePreset } from "../src/data/presets.js";
import { getStableRpmValue, parseRpmFromText } from "../src/utils/ocrRpm.js";
import {
  load,
  persist,
  STORAGE_KEY,
  validateArchive,
} from "../src/utils/storage.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const presets = () => structuredClone(defaultPresets);
for (const [rotor, roller] of [
  [0, 0],
  [45, 22.8645],
  [90, 45.729],
  [180, 91.458],
  [360, 182.916],
  [720, 365.832],
  [1080, 548.748],
  [3600, 1829.16],
  [-90, -45.729],
  [-360, -182.916],
  [-720, -365.832],
]) {
  test(`k=0.5081: ${rotor}° → ${roller}°`, () => {
    const p = presets(),
      s = createSession(p),
      n = advanceAngles(s, rotor, p);
    near(n.rows[p[0].id].angle - 300, roller);
    near(n.rotorTravel, rotor);
  });
}
test("D10 formula with provisional geometry and rotating outer ring", () =>
  near(
    theoreticalFactor(100, 4290, 46),
    0.5 * (1 + (100 / 4290) * Math.cos((46 * Math.PI) / 180)),
  ));
test("invalid geometry is unknown", () => {
  for (const v of [
    [null, 4290, 46],
    [100, 0, 46],
    [100, 50, 46],
    [100, 4290, 90],
    [100, 4290, -2],
  ])
    assert.equal(theoreticalFactor(...v), null);
});
test("both directions across zero", () => {
  assert.equal(pointerDelta(359, 0), 1);
  assert.equal(pointerDelta(0, 359), -1);
  assert.equal(pointerDelta(179, -179), 2);
});
test("multiple continuous turns, reversal and slow movement", () => {
  const p = presets();
  let s = createSession(p);
  for (let i = 0; i < 10000; i++) s = advanceAngles(s, 0.1, p);
  near(s.rotorTravel, 1000);
  s = advanceAngles(s, -720, p);
  near(s.rotorTravel, 280);
  near(s.rows[p[0].id].travel, 280 * 0.5081);
});
test("normalization is for display only", () => {
  assert.equal(normalizeAngle(-720.5), 359.5);
  const p = presets(),
    n = advanceAngles(createSession(p), 3600, p);
  assert.equal(n.rotorAngle, 3600);
  near(n.rows[p[0].id].angle, 2129.16);
});
test("factors can change without rewriting positions", () => {
  const p = presets();
  let s = advanceAngles(createSession(p), 360, p);
  const before = s.rows[p[0].id].angle;
  p[0].manualFactor = 0.6;
  assert.equal(s.rows[p[0].id].angle, before);
  s = advanceAngles(s, 90, p);
  near(s.rows[p[0].id].angle - before, 54);
});
test("independent rows and unknown roller count", () => {
  const p = presets();
  p[1].manualFactor = 0.6;
  const s = advanceAngles(createSession(p), 360, p);
  assert.equal(p[0].rollerCount, null);
  near(s.rows[p[0].id].travel, 182.916);
  near(s.rows[p[1].id].travel, 216);
});
test("unknown factor never invents movement", () => {
  const p = presets(),
    s = advanceAngles(createSession(p), 360, p);
  assert.equal(activeFactor(p[3]), null);
  assert.equal(s.rows.custom.angle, 300);
});
test("finger mode ignores all RPM integration", () => {
  const p = presets(),
    s = { ...createSession(p), outerRunning: true, cageRunning: true };
  assert.equal(integrateRpm(s, 10, 60000, p, "manual"), s);
  assert.equal(integrateRpm(s, 10, 60000, p, "ocr"), s);
});
test("only the selected RPM input can advance state", () => {
  const p = presets(),
    s = {
      ...createSession(p),
      mode: "manual",
      direction: "cw",
      outerRunning: true,
      cageRunning: true,
    };
  assert.equal(integrateRpm(s, 1, 60000, p, "ocr"), s);
  near(integrateRpm(s, 1, 60000, p, "manual").rotorAngle, 360);
});
test("RPM resumes after zero and respects reverse direction", () => {
  const p = presets();
  let s = {
    ...createSession(p),
    mode: "manual",
    direction: "ccw",
    outerRunning: true,
    cageRunning: true,
  };
  s = integrateRpm(s, 1, 60000, p, "manual");
  s = integrateRpm(s, 0, 60000, p, "manual");
  s = integrateRpm(s, 1, 60000, p, "manual");
  near(s.rotorAngle, -720);
});
test("partial start/stop does not reset tracked positions", () => {
  const p = presets(),
    s = {
      ...advanceAngles(createSession(p), 90, p),
      mode: "manual",
      direction: "cw",
      outerRunning: true,
      cageRunning: false,
    };
  const n = integrateRpm(s, 1, 60000, p, "manual");
  near(n.rotorAngle, 450);
  assert.equal(n.rows[p[0].id].angle, s.rows[p[0].id].angle);
});
test("target position zero is reached without a full extra turn", () => {
  const target = rotationToTarget(660, 300, 0.5081, "cw");
  assert.equal(target.atTarget, true);
  assert.equal(target.rotorDelta, 0);
  assert.equal(rotationToTarget(300, 300, 0.5081, "ccw").rotorDelta, 0);
});
test("target direction and wrap", () => {
  near(rotationToTarget(350, 10, 0.5, "cw").rotorDelta, 40);
  near(rotationToTarget(350, 10, 0.5, "ccw").rotorDelta, -680);
  assert.equal(rotationToTarget(0, 0, null), null);
});
test("independent calibration, zero and implausibility checks", () => {
  near(calibrationFactor(720, 365.832), 0.5081);
  near(calibrationFactor(-720, -365.832), 0.5081);
  for (const args of [
    [0, 0],
    [10, -5],
    [10, 20],
    [0.1, 0.05],
    [2, 1, 3],
    [10, 5, -1],
  ])
    assert.equal(calibrationFactor(...args), null);
});
test("pointer mapping uses element bounds and central dead zone", () => {
  const r = { left: 100, top: 50, width: 400, height: 400 };
  near(pointerAngle(300, 50, r), 0);
  near(pointerAngle(500, 250, r), 90);
  assert.equal(pointerAngle(300, 250, r), null);
});
test("all shipped presets validate without confirmed roller counts", () => {
  for (const p of presets()) assert.deepEqual(validatePreset(p), []);
  assert.equal(defaultPresets[0].quality.pitchDiameterMm, "ESTIMATED");
});
test("invalid values and false quality for null are rejected", () => {
  const p = presets()[0];
  p.rollerCount = 12.5;
  assert.ok(validatePreset(p).includes("rollerCount"));
  p.rollerCount = null;
  p.quality.rollerCount = "DOCUMENTED";
  assert.ok(validatePreset(p).includes("quality.rollerCount"));
});
test("calibrated factor has explicit precedence only when selected", () => {
  const p = presets()[0];
  p.calibratedFactor = 0.55;
  assert.equal(activeFactor(p), 0.5081);
  p.factorMode = "calibrated";
  assert.equal(activeFactor(p), 0.55);
});
test("OCR must agree with the newest sample", () => {
  assert.equal(getStableRpmValue([10, 10, 0]), null);
  assert.equal(getStableRpmValue([10, 0, 0]), 0);
  near(getStableRpmValue([10, 10.1]), 10.05);
  assert.equal(parseRpmFromText("9,87 rpm"), 9.87);
});
test("archive roundtrip preserves unwrapped angles and stops on resume", () => {
  const p = presets(),
    s = advanceAngles(
      { ...createSession(p), sync: "synced", outerRunning: true },
      3600,
      p,
    );
  const result = validateArchive(
    { version: 1, presets: p, session: s, calibrations: [], language: "en" },
    true,
  );
  assert.equal(result.session.outerRunning, false);
  assert.equal(result.session.rotorAngle, 3600);
  assert.equal(result.session.sync, "uncertain");
});
test("archive rejects incomplete or implausible state", () => {
  const p = presets(),
    session = createSession(p);
  assert.throws(() =>
    validateArchive({
      version: 1,
      presets: p,
      session: { ...session, rotorAngle: null },
      calibrations: [],
    }),
  );
  assert.throws(() =>
    validateArchive({
      version: 1,
      presets: p,
      session: { ...session, manualRpm: 100 },
      calibrations: [],
    }),
  );
  assert.throws(() =>
    validateArchive({
      version: 1,
      presets: p,
      session,
      calibrations: [{ factor: Infinity }],
    }),
  );
});
test("storage failure and corrupt storage are handled", () => {
  globalThis.localStorage = {
    getItem: () => "{broken",
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.equal(load().session.mode, "finger");
  assert.equal(persist({}), false);
});
test("persistent settings are isolated from original storage keys", () => {
  const map = new Map([["bearingTrackerProLoggedIn", "true"]]);
  globalThis.localStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
  const d = load();
  assert.equal(persist({ ...d, version: 1 }), true);
  assert.equal(map.get("bearingTrackerProLoggedIn"), "true");
  assert.ok(map.has(STORAGE_KEY));
  assert.equal(load().presets.length, 4);
});
