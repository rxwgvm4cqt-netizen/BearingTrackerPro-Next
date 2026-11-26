import { activeFactor } from "../engine/kinematics.js";

export const QUALITIES = ["DOCUMENTED", "ESTIMATED", "CALIBRATED", "UNKNOWN"];
export const numericFields = {
  rollerCount: [1, 1000, true],
  rollerDiameterMm: [0.001, 10000],
  effectiveRollerDiameterMm: [0.001, 10000],
  rollerLengthMm: [0.001, 10000],
  outerDiameterMm: [0.001, 100000],
  pitchDiameterMm: [0.001, 100000],
  contactAngleDeg: [0, 89.999],
  clearanceMinMm: [0, 100],
  clearanceMaxMm: [0, 100],
  manualFactor: [0.000001, 0.999999],
  calibratedFactor: [0.000001, 0.999999],
};
const source =
  "Arbeitspaket 26.11.2026; Originalzeichnung in dieser Version noch nicht hochauflösend unabhängig verifiziert.";
const base = {
  label: "D10",
  manufacturer: "Thyssenkrupp rothe erde",
  bearingType: "Tapered roller bearing (unverified)",
  rows: 2,
  rollerCount: null,
  rollerDiameterMm: 100,
  effectiveRollerDiameterMm: 100,
  rollerLengthMm: 182,
  outerDiameterMm: 4852,
  pitchDiameterMm: 4290,
  contactAngleDeg: 46,
  clearanceMinMm: 0.17,
  clearanceMaxMm: 0.22,
  manualFactor: 0.5081,
  calibratedFactor: null,
  factorMode: "manual",
  direction: "ccw",
  viewingDirection: "rotor",
  dataSource: source,
  quality: Object.fromEntries(
    Object.keys(numericFields).map((k) => [
      k,
      k === "rollerCount" || k === "calibratedFactor" ? "UNKNOWN" : "ESTIMATED",
    ]),
  ),
  sources: Object.fromEntries(
    Object.keys(numericFields).map((k) => [k, source]),
  ),
};
export const defaultPresets = [
  {
    ...structuredClone(base),
    id: "d10-upwind",
    row: "upwind",
    label: "D10 · Upwind",
  },
  {
    ...structuredClone(base),
    id: "d10-downwind",
    row: "downwind",
    label: "D10 · Downwind",
  },
  {
    ...structuredClone(base),
    id: "d8",
    row: "upwind",
    label: "D8 · Legacy (unverified)",
    bearingType: "Cylindrical roller bearing (unverified)",
    rollerCount: 168,
    rollerDiameterMm: 80,
    effectiveRollerDiameterMm: 80,
    rollerLengthMm: null,
    outerDiameterMm: 2600,
    pitchDiameterMm: 2160,
    contactAngleDeg: 0,
    factorMode: "theoretical",
    quality: {
      ...base.quality,
      rollerCount: "ESTIMATED",
      rollerLengthMm: "UNKNOWN",
    },
    dataSource: "Legacy D8 demo; unverified",
  },
  {
    ...structuredClone(base),
    id: "custom",
    row: "upwind",
    label: "Custom",
    manufacturer: "",
    bearingType: "",
    ...Object.fromEntries(Object.keys(numericFields).map((k) => [k, null])),
    quality: Object.fromEntries(
      Object.keys(numericFields).map((k) => [k, "UNKNOWN"]),
    ),
    dataSource: "",
    sources: {},
  },
];

export function validatePreset(p) {
  const errors = [];
  if (!p.label?.trim()) errors.push("label");
  for (const [key, [min, max, integer]] of Object.entries(numericFields)) {
    const value = p[key];
    if (
      value !== null &&
      (!Number.isFinite(value) ||
        value < min ||
        value > max ||
        (integer && !Number.isInteger(value)))
    )
      errors.push(key);
    if (!QUALITIES.includes(p.quality?.[key])) errors.push(`quality.${key}`);
    if (value === null && p.quality?.[key] !== "UNKNOWN")
      errors.push(`quality.${key}`);
  }
  if (
    p.effectiveRollerDiameterMm !== null &&
    p.pitchDiameterMm !== null &&
    p.effectiveRollerDiameterMm >= p.pitchDiameterMm
  )
    errors.push("pitchDiameterMm");
  if (
    p.clearanceMinMm !== null &&
    p.clearanceMaxMm !== null &&
    p.clearanceMinMm > p.clearanceMaxMm
  )
    errors.push("clearanceMaxMm");
  if (
    !["cw", "ccw"].includes(p.direction) ||
    !["rotor", "generator"].includes(p.viewingDirection) ||
    !["upwind", "downwind"].includes(p.row) ||
    !["manual", "theoretical", "calibrated"].includes(p.factorMode)
  )
    errors.push("configuration");
  if (p.factorMode === "calibrated" && activeFactor(p) === null)
    errors.push("calibratedFactor");
  return [...new Set(errors)];
}
