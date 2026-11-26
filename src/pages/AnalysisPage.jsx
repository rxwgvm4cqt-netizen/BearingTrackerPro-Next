import References from "../components/References.jsx";
import { useState } from "react";
import {
  activeFactor,
  calibrationFactor,
  normalizeAngle,
  rotationToTarget,
  theoreticalFactor,
} from "../engine/kinematics.js";
import KPIBox from "../components/KPIBox.jsx";

export default function AnalysisPage({
  session,
  preset,
  calibrations,
  onChange,
  onReference,
  onKnownTurns,
  onConfirmSync,
  onCalibration,
  onApplyCalibration,
  onCaptureAnchor,
  t,
  language,
}) {
  const row = session.rows[preset.id];
  const view = preset.viewingDirection === "generator" ? -1 : 1;
  const factor = activeFactor(preset);
  const direction =
    (session.direction === "cw" ? 1 : -1) * view > 0 ? "cw" : "ccw";
  const target = rotationToTarget(
    row.angle,
    row.inspectionAngle,
    factor,
    direction,
  );
  const trustworthy = session.sync === "synced" && row.marked;
  const [form, setForm] = useState({
    rotorStart: String(session.rotorAngle * view),
    rollerStart: String(row.angle * view),
    rotorDelta: "",
    rollerDelta: "",
    uncertainty: "1",
    notes: "",
    turbine: session.turbine,
  });
  const [message, setMessage] = useState("");
  const patch = (key, value) => setForm((s) => ({ ...s, [key]: value }));
  const measurements = calibrations.filter((c) => c.presetId === preset.id);
  const theory = theoreticalFactor(
    preset.effectiveRollerDiameterMm,
    preset.pitchDiameterMm,
    preset.contactAngleDeg,
  );
  const save = (event) => {
    event.preventDefault();
    const delta = Number(form.rotorDelta),
      roller = Number(form.rollerDelta),
      uncertainty = Number(form.uncertainty);
    const k = calibrationFactor(delta, roller, uncertainty);
    if (
      !k ||
      form.rotorDelta.trim() === "" ||
      form.rollerDelta.trim() === "" ||
      form.uncertainty.trim() === "" ||
      ![Number(form.rotorStart), Number(form.rollerStart)].every(
        Number.isFinite,
      )
    ) {
      setMessage(t("invalidCalibration"));
      return;
    }
    const measurement = {
      id: crypto.randomUUID(),
      presetId: preset.id,
      bearingType: preset.bearingType,
      row: preset.row,
      turbine: form.turbine,
      timestamp: new Date().toISOString(),
      rotorStart: Number(form.rotorStart),
      rollerStart: Number(form.rollerStart),
      rotorDelta: delta,
      rollerDelta: roller,
      factor: k,
      direction: delta > 0 ? "cw" : "ccw",
      viewingDirection: preset.viewingDirection,
      uncertainty,
      notes: form.notes,
      factorUncertainty:
        (uncertainty + Math.abs(k) * uncertainty) / Math.abs(delta),
      theoreticalFactor: theory,
    };
    setMessage(onCalibration(measurement) ? t("saved") : t("storageError"));
  };
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{preset.label}</span>
          <h1>{t("find")}</h1>
        </div>
        <span className={`sync-badge sync-${session.sync}`}>
          {t(session.sync)}
        </span>
      </header>
      <References session={session} preset={preset} onChange={onChange} onReference={onReference} onKnownTurns={onKnownTurns} onConfirmSync={onConfirmSync} t={t} />
      <section className="kpi-grid">
        {[
          [
            "rotorAngle",
            `${normalizeAngle(session.rotorAngle * view).toFixed(2)}°`,
          ],
          ["rollerAngle", `${normalizeAngle(row.angle * view).toFixed(2)}°`],
          ["rotorTurns", ((session.rotorTravel * view) / 360).toFixed(4)],
          ["rollerTurns", ((row.travel * view) / 360).toFixed(4)],
          [
            "inspection",
            `${normalizeAngle(row.inspectionAngle * view).toFixed(2)}°`,
          ],
          [
            "remainingRoller",
            trustworthy && target
              ? `${(target.rollerDelta * view).toFixed(2)}°`
              : "—",
          ],
          [
            "requiredRotor",
            trustworthy && target
              ? `${(target.rotorDelta * view).toFixed(2)}°`
              : "—",
          ],
          [
            "requiredTurns",
            trustworthy && target
              ? (target.revolutions * view).toFixed(5)
              : "—",
          ],
        ].map(([key, value]) => (
          <KPIBox
            key={key}
            label={t(key)}
            value={value}
            meta={t("theoretical")}
          />
        ))}
      </section>
      <p className="notice">
        {trustworthy && target?.atTarget
          ? t("atTarget")
          : !trustworthy
            ? t("uncertainTarget")
            : t("safety")}
      </p>
      <section className="status-grid">
        {[
          ["row", t(preset.row)],
          ["direction", t(session.direction)],
          ["mode", t(session.mode)],
          ["viewingDirection", t(preset.viewingDirection)],
          ["activeFactor", factor?.toFixed(6) ?? "—"],
          [
            "quality",
            t(
              preset.factorMode === "calibrated"
                ? preset.quality.calibratedFactor
                : preset.factorMode === "manual"
                  ? preset.quality.manualFactor
                  : "ESTIMATED",
            ),
          ],
        ].map(([key, value]) => (
          <div key={key}>
            <span>{t(key)}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section className="data-group">
        <h2>{t("calibration")}</h2>
        <p className="muted">{t("calibrationHint")}</p>
        <div className="button-row">
          <button
            className="control-button"
            onClick={() => {
              onCaptureAnchor();
              setForm((p) => ({
                ...p,
                rotorStart: String(session.rotorAngle * view),
                rollerStart: String(row.angle * view),
              }));
            }}
          >
            {t("recordAnchor")}
          </button>
          <button
            className="control-button"
            disabled={
              !session.calibrationAnchor ||
              session.calibrationAnchor.presetId !== preset.id ||
              session.calibrationAnchor.viewingDirection !==
                preset.viewingDirection
            }
            onClick={() =>
              patch(
                "rotorDelta",
                String(
                  (session.rotorAngle - session.calibrationAnchor.rotorAngle) *
                    view,
                ),
              )
            }
          >
            {t("useTrackedDelta")}
          </button>
        </div>
        <form onSubmit={save} className="editor-grid">
          {[
            "turbine",
            "rotorStart",
            "rollerStart",
            "rotorDelta",
            "rollerDelta",
            "uncertainty",
            "notes",
          ].map((key) => (
            <label className="field" key={key}>
              <span>
                {t(
                  key === "rotorStart"
                    ? "calibrationRotorStart"
                    : key === "rollerStart"
                      ? "calibrationRollerStart"
                      : key,
                )}
              </span>
              <input
                name={key}
                required={key !== "notes" && key !== "turbine"}
                type={["notes", "turbine"].includes(key) ? "text" : "number"}
                step="any"
                min={key === "uncertainty" ? 0 : undefined}
                value={form[key]}
                onChange={(e) => patch(key, e.target.value)}
              />
            </label>
          ))}
          <button
            className="control-button control-button--combined"
            type="submit"
          >
            {t("saveCalibration")}
          </button>
          <output role="status">{message}</output>
        </form>
      </section>
      <section className="data-group">
        <h2>{t("measurements")}</h2>
        <p>
          {t("spread")}:{" "}
          {measurements.length > 1
            ? (
                Math.max(...measurements.map((m) => m.factor)) -
                Math.min(...measurements.map((m) => m.factor))
              ).toFixed(6)
            : "—"}
        </p>
        {measurements.length === 0 ? (
          <p className="muted">{t("empty")}</p>
        ) : (
          measurements.map((m) => (
            <article className="measurement" key={m.id}>
              <strong>
                {new Date(m.timestamp).toLocaleString(language)} ·{" "}
                {m.turbine || "—"}
              </strong>
              <span>
                k = {m.factor.toFixed(6)} ±{" "}
                {m.factorUncertainty?.toFixed(6) ?? "—"}
              </span>
              <span>
                {m.rotorDelta}° → {m.rollerDelta}° · {t(m.direction)} ·{" "}
                {t(m.viewingDirection)}
              </span>
              <span>
                {t("deviation")}:{" "}
                {m.theoreticalFactor
                  ? `${((m.factor / m.theoreticalFactor - 1) * 100).toFixed(2)}%`
                  : "—"}
              </span>
              <span>{m.notes}</span>
              <button
                className="control-button"
                onClick={() => onApplyCalibration(m)}
              >
                {t("applyCalibration")}
              </button>
            </article>
          ))
        )}
      </section>
      <section className="data-group">
        <h2>{t("events")}</h2>
        {session.events.length === 0 ? (
          <p className="muted">{t("empty")}</p>
        ) : (
          session.events.map((e) => (
            <article className="measurement" key={e.id}>
              <strong>
                {new Date(e.timestamp).toLocaleString(language)} ·{" "}
                {e.presetLabel}
              </strong>
              <span>
                {t("rotorAngle")}: {Number(e.rotorAngle).toFixed(2)}° ·{" "}
                {t("rollerAngle")}: {Number(e.rollerAngle).toFixed(2)}°
              </span>
              <span>
                {t("historyAngle")}:{" "}
                {normalizeAngle(e.rollerAngle - e.rotorAngle).toFixed(2)}° · k{" "}
                {e.factor ?? "—"} · {t(e.mode)} · {t(e.sync)}
              </span>
              <span>
                {t(e.viewingDirection)} · {t(e.direction)} · {t(e.quality)}
              </span>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
