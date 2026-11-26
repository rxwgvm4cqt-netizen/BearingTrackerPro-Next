import RotorDial from "../components/RotorDial.jsx";
import KPIBox from "../components/KPIBox.jsx";
import { activeFactor, normalizeAngle } from "../engine/kinematics.js";

function Fingerprint() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="M5 17C5 2 27 2 27 17M9 21v-5c0-10 14-10 14 0v8M13 25V15c0-5 6-5 6 0v12M5 21v-3m22 3v-3M16 17v12"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function TrackingPage({
  session,
  preset,
  presets,
  rpm,
  onMode,
  onChange,
  onSelect,
  onDelta,
  onInterrupt,
  onStart,
  onStop,
  onReset,
  onDefect,
  onPause,
  t,
}) {
  const row = session.rows[preset.id];
  const view = preset.viewingDirection === "generator" ? -1 : 1;
  const factor = activeFactor(preset);
  const running = session.outerRunning || session.cageRunning;
  return (
    <div className="page page--tracking">
      <header className="tracking-header">
        <div>
          <span className="eyebrow">
            Manual Rotor Sync / Bearing kinematics
          </span>
          <h1>Bearing Tracker Pro · Next</h1>
        </div>
        <span className={`sync-badge sync-${session.sync}`}>
          {t(session.sync)}
        </span>
      </header>
      <div className="mode-switch" aria-label={t("mode")}>
        {["finger", "manual", "ocr"].map((mode) => (
          <button
            type="button"
            key={mode}
            className={`control-button ${session.mode === mode ? "is-active" : ""}`}
            aria-pressed={session.mode === mode}
            onClick={() => onMode(mode)}
          >
            {mode === "finger" && <Fingerprint />}
            {t(mode)}
          </button>
        ))}
      </div>
      <section className="tracking-workspace">
      <section className="tracking-metrics" aria-label={t("trackingMetrics")}>
        {[
          [
            "rotorAngle",
            `${normalizeAngle(session.rotorAngle * view).toFixed(2)}°`,
          ],
          ["rollerAngle", `${normalizeAngle(row.angle * view).toFixed(2)}°`],
          ["rotorTurns", ((session.rotorTravel * view) / 360).toFixed(4)],
          ["rollerTurns", ((row.travel * view) / 360).toFixed(4)],
        ].map(([key, value]) => (
          <KPIBox
            compact
            key={key}
            label={t(key)}
            value={value}
            meta={t("theoretical")}
          />
        ))}
      </section>
        <div className="tracking-visual-column">
          <RotorDial
            session={session}
            preset={preset}
            row={row}
            enabled={session.mode === "finger" && factor !== null}
            onDelta={onDelta}
            onInterrupt={onInterrupt}
            t={t}
          />
          <p className="dial-help">
            {session.mode === "finger"
              ? t("fingerHint")
              : session.coast
                ? t("coastingHint")
                : running
                ? t("live")
                : t("startPaused")}
          </p>
        </div>
        <section className="tracking-main-actions">
          <button
            className="primary-action-button primary-action-button--start"
            disabled={session.mode === "finger" || factor === null || !!session.coast}
            onClick={() => onStart("outer")}
          >
            {t("startOuter")}
          </button>
          <button
            className="primary-action-button primary-action-button--start"
            disabled={session.mode === "finger" || factor === null || !!session.coast}
            onClick={() => onStart("cage")}
          >
            {t("startRoller")}
          </button>
          <button
            className="primary-action-button primary-action-button--warning"
            onClick={onStop}
          >
            {t("stopApp")}
            {session.coast && <small style={{ display: "block" }}>{t("coasting")}</small>}
          </button>
        </section>
        <aside className="tracking-side-panel">
          <label className="field">
            <span>{t("row")}</span>
            <select
              value={preset.id}
              onChange={(e) => onSelect(e.target.value)}
            >
              {presets.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="factor-readout">
            <span>{t("activeFactor")}</span>
            <strong>{factor?.toFixed(6) ?? "—"}</strong>
            <small>
              {factor === null
                ? t("missingFactor")
                : t(
                    preset.factorMode === "calibrated"
                      ? preset.quality.calibratedFactor
                      : preset.factorMode === "manual"
                        ? preset.quality.manualFactor
                        : "ESTIMATED",
                  )}
            </small>
          </div>
          {session.mode === "manual" && (
            <label className="field">
              <span>{t("manual")}</span>
              <input
                name="manualRpm"
                disabled={!!session.coast}
                type="number"
                min="0"
                max="30"
                step="any"
                value={session.manualRpm}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value >= 0 && value <= 30)
                    onChange({ manualRpm: value });
                }}
              />
            </label>
          )}
          {session.mode === "ocr" && (
            <p className="notice">
              {rpm === null ? t("ocrUnavailable") : `${rpm.toFixed(2)} RPM`}
            </p>
          )}
          <label className="field">
            <span>{t("direction")}</span>
            <select
              disabled={!!session.coast}
              value={session.direction}
              onChange={(e) => onChange({ direction: e.target.value })}
            >
              <option value="cw">{t("cw")}</option>
              <option value="ccw">{t("ccw")}</option>
            </select>
          </label>
          <button
            className="action-button action-button--danger"
            onClick={onDefect}
          >
            {t("markDefect")}
          </button>
          <p className="muted">{row.marked ? t("marked") : t("noDefect")}</p>
          <div className="motion-controls">
            <button
              className="control-button control-button--combined"
              disabled={session.mode === "finger" || factor === null || !!session.coast}
              onClick={() => (running ? onPause() : onStart("both"))}
            >
              {t("combined")}
            </button>
            <button className="control-button" onClick={onReset}>
              {t("reset")}
            </button>
            <button className="control-button" onClick={onInterrupt}>
              {t("markUncertain")}
            </button>
          </div>

        </aside>
      </section>


    </div>
  );
}
