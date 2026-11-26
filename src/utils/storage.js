import { defaultPresets, validatePreset } from "../data/presets.js";
import { createSession } from "../engine/kinematics.js";

export const STORAGE_KEY = "bearingTrackerProNext.v1";
export function persist(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
export function load() {
  const fallback = () => ({
    presets: structuredClone(defaultPresets),
    session: createSession(defaultPresets),
    calibrations: [],
    language: "de",
  });
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || raw.version !== 1) return fallback();
    return validateArchive(raw, true);
  } catch {
    return fallback();
  }
}
export function validateArchive(raw, resumed = false) {
  if (
    raw?.version !== 1 ||
    !Array.isArray(raw.presets) ||
    raw.presets.length < 1 ||
    raw.presets.length > 100 ||
    raw.presets.some(
      (p) =>
        validatePreset(p).length ||
        typeof p.id !== "string" ||
        !/^[\w-]+$/.test(p.id),
    )
  )
    throw new Error("Invalid presets");
  if (new Set(raw.presets.map((p) => p.id)).size !== raw.presets.length)
    throw new Error("Duplicate presets");
  const s = raw.session;
  if (
    !s ||
    !raw.presets.some((p) => p.id === s.selectedPresetId) ||
    !["manual", "ocr", "finger"].includes(s.mode) ||
    !["cw", "ccw"].includes(s.direction) ||
    !["A", "B", "C"].includes(s.referenceBlade) ||
    !["unreferenced", "synced", "uncertain"].includes(s.sync)
  )
    throw new Error("Invalid session");
  for (const key of [
    "rotorAngle",
    "rotorTravel",
    "rotorDistance",
    "manualRpm",
    "jogRpm",
  ])
    if (!Number.isFinite(s[key])) throw new Error("Invalid angle");
  if (s.manualRpm < 0 || s.manualRpm > 30 || s.jogRpm < 0.02 || s.jogRpm > 1)
    throw new Error("Invalid RPM");
  for (const p of raw.presets) {
    const row = s.rows?.[p.id];
    if (
      !row ||
      !["angle", "travel", "inspectionAngle"].every((k) =>
        Number.isFinite(row[k]),
      ) ||
      typeof row.marked !== "boolean"
    )
      throw new Error("Invalid row");
  }
  if (
    !Array.isArray(s.events) ||
    s.events.length > 5000 ||
    !Array.isArray(raw.calibrations) ||
    raw.calibrations.length > 5000
  )
    throw new Error("Invalid records");
  const validRecord = (record) =>
    record &&
    typeof record.id === "string" &&
    Number.isFinite(Date.parse(record.timestamp)) &&
    raw.presets.some((p) => p.id === record.presetId);
  for (const event of s.events) {
    if (
      !validRecord(event) ||
      ![event.rotorAngle, event.rollerAngle].every(Number.isFinite) ||
      typeof event.presetLabel !== "string" ||
      !["manual", "ocr", "finger"].includes(event.mode) ||
      !["synced", "uncertain", "unreferenced"].includes(event.sync) ||
      !["rotor", "generator"].includes(event.viewingDirection) ||
      !["cw", "ccw"].includes(event.direction)
    )
      throw new Error("Invalid event");
  }
  for (const c of raw.calibrations)
    if (
      !validRecord(c) ||
      ![
        c.factor,
        c.rotorDelta,
        c.rollerDelta,
        c.uncertainty,
        c.factorUncertainty,
        c.rotorStart,
        c.rollerStart,
      ].every(Number.isFinite) ||
      c.factor <= 0 ||
      c.factor >= 1 ||
      c.uncertainty < 0 ||
      c.factorUncertainty < 0 ||
      typeof c.notes !== "string" ||
      typeof c.turbine !== "string" ||
      !["cw", "ccw"].includes(c.direction) ||
      !["rotor", "generator"].includes(c.viewingDirection)
    )
      throw new Error("Invalid calibration");
  return {
    presets: raw.presets,
    calibrations: raw.calibrations,
    language: raw.language === "en" ? "en" : "de",
    session: {
      ...s,
      coast: null,
      outerRunning: false,
      cageRunning: false,
      jogDirection: 0,
      calibrationAnchor: null,
      sync: resumed && s.sync === "synced" ? "uncertain" : s.sync,
    },
  };
}

export function downloadJson(data, filename) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
