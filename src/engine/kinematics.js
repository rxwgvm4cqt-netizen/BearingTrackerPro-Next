// Angles: 0° at 12 o'clock, clockwise positive. Never normalize stored angles.
export const normalizeAngle = (angle) => ((angle % 360) + 360) % 360;

export function pointerDelta(previous, next) {
  return normalizeAngle(next - previous + 180) - 180;
}

export function pointerAngle(clientX, clientY, rect, deadZone = 0.12) {
  const x = clientX - rect.left - rect.width / 2;
  const y = clientY - rect.top - rect.height / 2;
  if (Math.hypot(x, y) < Math.min(rect.width, rect.height) * deadZone)
    return null;
  return (Math.atan2(x, -y) * 180) / Math.PI;
}

export function theoreticalFactor(d, pitch, contactAngle) {
  if (
    ![d, pitch, contactAngle].every(Number.isFinite) ||
    d <= 0 ||
    pitch <= d ||
    contactAngle < 0 ||
    contactAngle >= 90
  )
    return null;
  return 0.5 * (1 + (d / pitch) * Math.cos((contactAngle * Math.PI) / 180));
}

export function activeFactor(preset) {
  const mode = preset.factorMode;
  const value =
    mode === "calibrated"
      ? preset.calibratedFactor
      : mode === "theoretical"
        ? theoreticalFactor(
            preset.effectiveRollerDiameterMm,
            preset.pitchDiameterMm,
            preset.contactAngleDeg,
          )
        : preset.manualFactor;
  return Number.isFinite(value) && value > 0 && value < 1 ? value : null;
}

export function createSession(presets) {
  return {
    version: 1,
    mode: "finger",
    selectedPresetId: presets[0].id,
    rotorAngle: 0,
    rotorTravel: 0,
    rotorDistance: 0,
    sync: "unreferenced",
    outerRunning: false,
    cageRunning: false,
    positioning: false,
    jogDirection: 0,
    manualRpm: 0.2,
    jogRpm: 0.2,
    direction: "ccw",
    referenceBlade: "A",
    turbine: "",
    rows: Object.fromEntries(
      presets.map((p) => [
        p.id,
        { angle: 300, travel: 0, marked: false, inspectionAngle: 300 },
      ]),
    ),
    events: [],
    calibrationAnchor: null,
    savedAt: null,
  };
}

export function advanceAngles(
  state,
  rotorDelta,
  presets,
  { outer = true, cage = true } = {},
) {
  if (!Number.isFinite(rotorDelta)) return state;
  const rows = { ...state.rows };
  if (cage)
    for (const preset of presets) {
      const factor = activeFactor(preset);
      const row = rows[preset.id];
      if (row && factor !== null)
        rows[preset.id] = {
          ...row,
          angle: row.angle + rotorDelta * factor,
          travel: row.travel + rotorDelta * factor,
        };
    }
  return {
    ...state,
    rotorAngle: state.rotorAngle + (outer ? rotorDelta : 0),
    rotorTravel: state.rotorTravel + (outer ? rotorDelta : 0),
    rotorDistance: state.rotorDistance + (outer ? Math.abs(rotorDelta) : 0),
    rows,
  };
}

export function rotationToTarget(
  rollerAngle,
  target,
  factor,
  direction = "cw",
  tolerance = 1e-7,
) {
  if (
    ![rollerAngle, target, factor].every(Number.isFinite) ||
    factor <= 0 ||
    factor >= 1
  )
    return null;
  const clockwise = normalizeAngle(target - rollerAngle);
  const atTarget = Math.min(clockwise, 360 - clockwise) <= tolerance;
  const remaining = atTarget
    ? 0
    : direction === "cw"
      ? clockwise
      : clockwise - 360;
  return {
    rollerDelta: remaining,
    rotorDelta: remaining / factor,
    revolutions: remaining / factor / 360,
    atTarget,
  };
}

export function calibrationFactor(rotorDelta, rollerDelta, uncertaintyDeg = 0) {
  if (
    ![rotorDelta, rollerDelta, uncertaintyDeg].every(Number.isFinite) ||
    Math.abs(rotorDelta) < 1 ||
    uncertaintyDeg < 0 ||
    Math.abs(rotorDelta) <= uncertaintyDeg
  )
    return null;
  const factor = rollerDelta / rotorDelta;
  return factor > 0 && factor < 1 ? factor : null;
}

export function integrateRpm(state, rpm, elapsedMs, presets, source) {
  if (
    source !== state.mode ||
    state.mode === "finger" ||
    !Number.isFinite(rpm) ||
    rpm < 0 ||
    rpm > 30 ||
    elapsedMs < 0
  )
    return state;
  const sign = state.direction === "cw" ? 1 : -1;
  return advanceAngles(
    state,
    ((rpm * elapsedMs * 360) / 60000) * sign,
    presets,
    { outer: state.outerRunning, cage: state.cageRunning },
  );
}
