import { useState } from "react";
import { QUALITIES, numericFields, validatePreset } from "../data/presets.js";
import { activeFactor, theoreticalFactor } from "../engine/kinematics.js";

export default function BearingDataPage({
  preset,
  presets,
  onSelect,
  onSave,
  t,
}) {
  const [draft, setDraft] = useState(() => structuredClone(preset));
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(preset);
  const update = (key, value) => {
    setMessage("");
    setDraft((p) => ({ ...p, [key]: value }));
  };
  const numericChange = (key, text) => {
    const value = text === "" ? null : Number(text);
    setMessage("");
    setDraft((p) => ({
      ...p,
      [key]: value,
      quality: {
        ...p.quality,
        [key]:
          value === null
            ? "UNKNOWN"
            : p.quality[key] === "UNKNOWN"
              ? "ESTIMATED"
              : p.quality[key],
      },
    }));
  };
  const save = (event) => {
    event.preventDefault();
    const errors = validatePreset(draft);
    if (errors.length) {
      setMessage(`${t("invalid")} ${errors.map((k) => t(k)).join(", ")}`);
      return;
    }
    setMessage(onSave(draft) ? t("saved") : t("storageError"));
  };
  const theoretical = theoreticalFactor(
    draft.effectiveRollerDiameterMm,
    draft.pitchDiameterMm,
    draft.contactAngleDeg,
  );
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Bearing configuration</span>
          <h1>{t("bearingData")}</h1>
        </div>
        <label className="field">
          <span>{t("rowChange")}</span>
          <select
            value={preset.id}
            onChange={(e) => onSelect(e.target.value)}
            disabled={dirty}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <p className="notice">
        {t("unknownHint")} {t("presetHint")}
      </p>
      <form onSubmit={save} className="page" data-testid="preset-form">
        <section className="editor-grid">
          {["label", "manufacturer", "bearingType", "dataSource"].map((key) => (
            <label key={key} className="field">
              <span>{t(key === "dataSource" ? "source" : key)}</span>
              <input
                value={draft[key] ?? ""}
                onChange={(e) => update(key, e.target.value)}
              />
            </label>
          ))}
          {Object.entries({
            row: ["upwind", "downwind"],
            direction: ["cw", "ccw"],
            viewingDirection: ["rotor", "generator"],
            factorMode: ["manual", "theoretical", "calibrated"],
          }).map(([key, values]) => (
            <label key={key} className="field">
              <span>{t(key)}</span>
              <select
                value={draft[key]}
                onChange={(e) => update(key, e.target.value)}
              >
                {values.map((v) => (
                  <option key={v} value={v}>
                    {t(v)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
        <section className="parameter-grid">
          {Object.entries(numericFields).map(([key, [min, max, integer]]) => (
            <article className="parameter-card" key={key}>
              <label className="field">
                <span>{t(key)}</span>
                <input
                  name={key}
                  type="number"
                  step={integer ? 1 : "any"}
                  min={min}
                  max={max}
                  value={draft[key] ?? ""}
                  placeholder={t("unknown")}
                  onChange={(e) => numericChange(key, e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t("quality")}</span>
                <select
                  aria-label={`${t(key)} ${t("quality")}`}
                  value={draft.quality[key]}
                  onChange={(e) =>
                    update("quality", {
                      ...draft.quality,
                      [key]: e.target.value,
                    })
                  }
                >
                  {QUALITIES.map((q) => (
                    <option key={q} value={q}>
                      {t(q)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t("source")}</span>
                <input
                  aria-label={`${t(key)} ${t("source")}`}
                  value={draft.sources?.[key] ?? ""}
                  onChange={(e) =>
                    update("sources", {
                      ...draft.sources,
                      [key]: e.target.value,
                    })
                  }
                />
              </label>
            </article>
          ))}
        </section>
        <section className="status-grid">
          <div>
            <span>{t("theoretical")} k</span>
            <strong>
              {theoretical?.toFixed(6) ?? "—"} · {t("ESTIMATED")}
            </strong>
          </div>
          <div>
            <span>{t("activeFactor")}</span>
            <strong>{activeFactor(draft)?.toFixed(6) ?? "—"}</strong>
          </div>
        </section>
        <div className="editor-save">
          <span>{dirty ? t("unsaved") : t("saved")}</span>
          <button
            className="control-button control-button--combined"
            type="submit"
          >
            {t("savePreset")}
          </button>
          <button
            className="control-button"
            type="button"
            onClick={() => {
              setDraft(structuredClone(preset));
              setMessage("");
            }}
          >
            {t("discard")}
          </button>
          <output role="status">{message}</output>
        </div>
      </form>
    </div>
  );
}
