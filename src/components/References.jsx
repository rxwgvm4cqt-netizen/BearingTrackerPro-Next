import { useState } from "react";
export default function References({ session, preset, onChange, onReference, onKnownTurns, onConfirmSync, t }) {
  const row = session.rows[preset.id];
  const view = preset.viewingDirection === "generator" ? -1 : 1;
  const [refs, setRefs] = useState({
    rotor: String(session.rotorAngle * view),
    roller: String(row.angle * view),
    inspection: String(row.inspectionAngle * view),
    turns: "0",
  });
  const patch = (key, value) => setRefs((p) => ({ ...p, [key]: value }));
  return (
      <details className="data-group" open={session.sync === "unreferenced"}>
        <summary>{t("references")}</summary>
        <p className="muted">{t("referenceHint")}</p>
        <p className="muted">{t("angleConvention")}</p>
        <form
          className="editor-grid"
          onSubmit={(e) => {
            e.preventDefault();
            onReference({
              rotor: Number(refs.rotor) * view,
              roller: Number(refs.roller) * view,
              inspection: Number(refs.inspection) * view,
            });
          }}
        >
          {[
            ["rotor", "rotorStart"],
            ["roller", "rollerStart"],
            ["inspection", "inspection"],
          ].map(([key, label]) => (
            <label className="field" key={key}>
              <span>
                {t(label)}
                {key === "rotor" ? ` · ${session.referenceBlade}` : ""}
              </span>
              <input
                name={`reference-${key}`}
                required
                type="number"
                step="any"
                value={refs[key]}
                onChange={(e) => patch(key, e.target.value)}
              />
            </label>
          ))}
          <label className="field">
            <span>{t("referenceBlade")}</span>
            <select
              value={session.referenceBlade}
              onChange={(e) => onChange({ referenceBlade: e.target.value })}
            >
              {["A", "B", "C"].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <button
            className="control-button control-button--combined"
            type="submit"
          >
            {t("reference")}
          </button>
        </form>
        <form
          className="button-row"
          onSubmit={(e) => {
            e.preventDefault();
            onKnownTurns(Number(refs.turns) * view);
          }}
        >
          <label className="field">
            <span>{t("lostTurns")}</span>
            <input
              required
              type="number"
              step="any"
              value={refs.turns}
              onChange={(e) => patch("turns", e.target.value)}
            />
          </label>
          <button className="control-button" type="submit">
            {t("addTurns")}
          </button>
          <button
            className="control-button"
            type="button"
            onClick={onConfirmSync}
          >
            {t("confirmSync")}
          </button>
        </form>
      </details>
  );
}
