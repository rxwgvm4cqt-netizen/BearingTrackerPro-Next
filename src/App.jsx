import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import CameraRPMPanel from "./components/CameraRPMPanel.jsx";
import TrackingPage from "./pages/TrackingPage.jsx";
import AnalysisPage from "./pages/AnalysisPage.jsx";
import BearingDataPage from "./pages/BearingDataPage.jsx";
import {
  beginManualCoast,
  integrateManualCoast,
  activeFactor,
  advanceAngles,
  createSession,
  integrateRpm,
  normalizeAngle,
  pointerDelta,
} from "./engine/kinematics.js";
import {
  load,
  persist,
  validateArchive,
  downloadJson,
} from "./utils/storage.js";
import { translate } from "./i18n/next.js";
import { STATIC_LOGIN } from "./config/auth.js";
import "./styles/app.css";
import "./styles/next.css";

import { getOcrSignal, OCR_MAX_AGE_MS } from "./utils/ocrRpm.js";
export default function App() {
  const [data, setData] = useState(load);
  const dataRef = useRef(data);
  const [page, setPage] = useState("tracking");
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [offline, setOffline] = useState("offlineLoading");
  const [ocrRpm, setOcrRpm] = useState(null);
  const [ocrSignal, setOcrSignal] = useState("ocrWaiting");
  const rpmRef = useRef(null);
  const importRef = useRef(null);
  const { presets, session, language, calibrations } = data;
  const preset =
    presets.find((p) => p.id === session.selectedPresetId) ?? presets[0];
  const t = useCallback((key) => translate(language, key), [language]);
  const update = useCallback((updater) => {
    const next = updater(dataRef.current);
    dataRef.current = next;
    setData(next);
  }, []);
  const change = useCallback(
    (patch) => update((d) => ({ ...d, session: { ...d.session, ...patch } })),
    [update],
  );
  const stop = useCallback(
    () =>
      update((d) => ({
        ...d,
        session: {
          ...d.session,
          coast: null,
          outerRunning: false,
          cageRunning: false,
          jogDirection: 0,
          sync:
            (d.session.outerRunning ||
              d.session.cageRunning ||
              d.session.jogDirection !== 0) &&
            d.session.sync === "synced"
              ? "uncertain"
              : d.session.sync,
        },
      })),
    [update],
  );
  const stopWithCoast = () => update((d) => ({
    ...d, session: beginManualCoast(d.session),
  }));
  const interrupt = useCallback(
    () =>
      update((d) => ({
        ...d,
        session: {
          ...d.session,
          coast: null,
          outerRunning: false,
          cageRunning: false,
          jogDirection: 0,
          sync:
            d.session.sync === "unreferenced" ? "unreferenced" : "uncertain",
        },
      })),
    [update],
  );
  const archive = (d) => ({
    ...d,
    version: 1,
    exportedAt: new Date().toISOString(),
  });
  const saveCase = () => {
    const next = {
      ...dataRef.current,
      session: {
        ...dataRef.current.session,
        savedAt: new Date().toISOString(),
      },
    };
    if (persist(archive(next))) {
      update(() => next);
      setMessage(t("saved"));
    } else setMessage(t("storageError"));
  };
  const select = (id) => {
    const p = dataRef.current.presets.find((p) => p.id === id);
    if (!p) return;
    interrupt();
    change({
      selectedPresetId: id,
      direction: p.direction,
      calibrationAnchor: null,
    });
  };
  const savePreset = (draft) => {
    const d = dataRef.current,
      previous = d.presets.find((p) => p.id === draft.id);
    const next = {
      ...d,
      presets: d.presets.map((p) =>
        p.id === draft.id ? structuredClone(draft) : p,
      ),
      session: {
        ...d.session,
        ...(draft.id === d.session.selectedPresetId
          ? { direction: draft.direction }
          : {}),
        sync:
          previous.viewingDirection !== draft.viewingDirection ||
          previous.row !== draft.row
            ? "uncertain"
            : d.session.sync,
      },
    };
    if (!persist(archive(next))) return false;
    update(() => next);
    return true;
  };
  const setMode = (mode) => {
    if (mode === "ocr" && location.protocol === "file:") {
      setMessage(t("ocrNeedsServer"));
      return;
    }
    if (mode === dataRef.current.session.mode) return;
    rpmRef.current = null;
    setOcrRpm(null);
    change({
      mode,
      coast: null,
      outerRunning: false,
      cageRunning: false,
      jogDirection: 0,
      positioning: false,
    });
  };
  const stableRpm = useCallback((value, measurement) => {
    if (dataRef.current.session.mode !== "ocr") return;
    rpmRef.current = { value, timestamp: measurement?.timestamp ?? performance.now() };
    setOcrSignal(getOcrSignal(rpmRef.current, performance.now()).status);
    setOcrRpm(value);
  }, []);
  const stopOcr = useCallback(() => {
    rpmRef.current = null;
    setOcrRpm(null);
    if (dataRef.current.session.mode === "ocr") interrupt();
  }, [interrupt]);

  useEffect(() => {
    if (session.mode !== "ocr") return;
    const updateSignal = () => {
      const signal = getOcrSignal(rpmRef.current, performance.now());
      setOcrSignal(signal.status);
      if (signal.status === "ocrLost" || signal.status === "ocrWaiting") setOcrRpm(null);
    };
    const timer = setInterval(updateSignal, 250);
    return () => clearInterval(timer);
  }, [session.mode]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!persist({ ...dataRef.current, version: 1 }))
        setMessage(translate(dataRef.current.language, "storageError"));
    }, 2000);
    const hide = () => {
      if (document.hidden) {
        interrupt();
        persist({ ...dataRef.current, version: 1 });
      }
    };
    const unload = () => persist({ ...dataRef.current, version: 1 });
    const blur = () => {
      if (dataRef.current.session.jogDirection !== 0) interrupt();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", unload);
    window.addEventListener("blur", blur);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", unload);
      window.removeEventListener("blur", blur);
    };
  }, [interrupt]);

  useEffect(() => {
    if (
      locked ||
      session.mode === "finger" ||
      (!session.outerRunning &&
        !session.cageRunning &&
        session.jogDirection === 0)
    )
      return;
    let frame,
      last = performance.now();
    const animate = (now) => {
      const elapsed = now - last;
      last = now;
      if (elapsed > 1000) {
        interrupt();
        return;
      }
      update((d) => {
        const s = d.session,
          p = d.presets.find((p) => p.id === s.selectedPresetId),
          view = p.viewingDirection === "generator" ? -1 : 1;
        if (activeFactor(p) === null)
          return {
            ...d,
            session: {
              ...s,
              coast: null,
              outerRunning: false,
              cageRunning: false,
              jogDirection: 0,
              sync: "uncertain",
            },
          };
        if (s.mode === "manual" && s.coast)
          return { ...d, session: integrateManualCoast(s, elapsed, d.presets) };
        if (s.jogDirection !== 0)
          return {
            ...d,
            session: advanceAngles(
              s,
              (s.jogDirection * view * s.jogRpm * elapsed * 360) / 60000,
              d.presets,
            ),
          };
        const input = getOcrSignal(rpmRef.current, now);
        if (s.mode === "ocr" && (input.status === "ocrLost" || input.status === "ocrWaiting"))
          // Freeze integration while retaining the user's run intent. A fresh measured
          // value resumes it; Stop/mode change still clears that intent explicitly.
          return s.sync === "uncertain" ? d : { ...d, session: { ...s, sync: "uncertain" } };
        const rpm =
          s.mode === "manual" ? s.manualRpm : input.rpm;
        // Kinematic angles are stored in rotor-side coordinates; input direction is viewed.
        const canonical = {
          ...s,
          ...(s.mode === "ocr" && input.status === "ocrHeld" ? { sync: "uncertain" } : {}),
          direction:
            view === 1 ? s.direction : s.direction === "cw" ? "ccw" : "cw",
        };
        const advanced = integrateRpm(
          canonical,
          rpm,
          elapsed,
          d.presets,
          s.mode,
        );
        return { ...d, session: { ...advanced, direction: s.direction } };
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [
    locked,
    session.mode,
    session.outerRunning,
    session.cageRunning,
    session.jogDirection,
    interrupt,
    update,
  ]);

  useEffect(() => {
    if (location.protocol === "file:") {
      setTimeout(() => setOffline("offlineCore"), 0);
      return;
    }
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD) {
      setTimeout(() => setOffline("offlineFailed"), 0);
      return;
    }
    let disposed = false;
    const listener = (e) => {
      if (e.data?.type === "OFFLINE_READY" && !disposed)
        setOffline(e.data.ocr ? "offlineReady" : "offlineCore");
    };
    navigator.serviceWorker.addEventListener("message", listener);
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .then(async (registration) => {
        const ready = await navigator.serviceWorker.ready;
        (ready.active ?? registration.active)?.postMessage({ type: "STATUS" });
      })
      .catch(() => {
        if (!disposed) setOffline("offlineFailed");
      });
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("message", listener);
    };
  }, []);

  const start = (which) => {
    const s = dataRef.current.session;
    if (s.mode === "finger" || activeFactor(preset) === null) return;
    if (
      s.mode === "ocr" &&
      (!rpmRef.current ||
        performance.now() - rpmRef.current.timestamp > OCR_MAX_AGE_MS)
    ) {
      setMessage(t("ocrUnavailable"));
      return;
    }
    change({
      coast: null,
      outerRunning: which !== "cage" || s.outerRunning,
      cageRunning: which !== "outer" || s.cageRunning,
      jogDirection: 0,
      positioning: false,
      sync:
        which === "both"
          ? s.sync
          : s.sync === "unreferenced"
            ? "unreferenced"
            : "uncertain",
    });
  };
  const onDelta = (delta) =>
    update((d) => {
      if (d.session.mode !== "finger") return d;
      const p = d.presets.find((p) => p.id === d.session.selectedPresetId),
        view = p.viewingDirection === "generator" ? -1 : 1;
      return {
        ...d,
        session: advanceAngles(
          { ...d.session, direction: delta * view > 0 ? "cw" : "ccw" },
          delta,
          d.presets,
        ),
      };
    });
  const reference = ({ rotor, roller, inspection }) => {
    if (![rotor, roller, inspection].every(Number.isFinite)) return;
    update((d) => ({
      ...d,
      session: {
        ...d.session,
        rotorAngle:
          rotor - ["A", "B", "C"].indexOf(d.session.referenceBlade) * 120,
        coast: null,
        outerRunning: false,
        cageRunning: false,
        jogDirection: 0,
        sync: "synced",
        rows: {
          ...d.session.rows,
          [preset.id]: {
            ...d.session.rows[preset.id],
            angle: roller,
            inspectionAngle: inspection,
            marked: true,
          },
        },
      },
    }));
  };
  const defect = () =>
    update((d) => {
      const s = d.session,
        row = s.rows[preset.id],
        view = preset.viewingDirection === "generator" ? -1 : 1;
      const event = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        presetId: preset.id,
        presetLabel: preset.label,
        presetSnapshot: structuredClone(preset),
        rotorAngle: s.rotorAngle * view,
        rollerAngle: row.inspectionAngle * view,
        referenceBlade: s.referenceBlade,
        factor: activeFactor(preset),
        mode: s.mode,
        sync: s.sync,
        viewingDirection: preset.viewingDirection,
        direction: s.direction,
        quality:
          preset.factorMode === "manual"
            ? preset.quality.manualFactor
            : preset.factorMode === "calibrated"
              ? preset.quality.calibratedFactor
              : "ESTIMATED",
      };
      return {
        ...d,
        session: {
          ...s,
          rows: {
            ...s.rows,
            [preset.id]: {
              ...row,
              angle:
                row.angle +
                pointerDelta(
                  normalizeAngle(row.angle),
                  normalizeAngle(row.inspectionAngle),
                ),
              marked: true,
            },
          },
          events: [event, ...s.events].slice(0, 5000),
        },
      };
    });
  const calibration = (m) => {
    const next = {
      ...dataRef.current,
      calibrations: [m, ...dataRef.current.calibrations].slice(0, 5000),
    };
    if (!persist(archive(next))) return false;
    update(() => next);
    return true;
  };
  const applyCalibration = (m) => {
    if (!window.confirm(t("applyConfirm"))) return;
    const p = dataRef.current.presets.find((p) => p.id === m.presetId);
    if (
      savePreset({
        ...p,
        calibratedFactor: m.factor,
        factorMode: "calibrated",
        quality: { ...p.quality, calibratedFactor: "CALIBRATED" },
        sources: {
          ...p.sources,
          calibratedFactor: `${m.timestamp} · ${m.turbine} · measurement ${m.id}`,
        },
      })
    )
      setMessage(t("saved"));
    else setMessage(t("storageError"));
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Size");
      const next = validateArchive(JSON.parse(await file.text()), true);
      if (!window.confirm(t("importConfirm"))) return;
      if (!persist(archive(next))) {
        setMessage(t("storageError"));
        return;
      }
      update(() => next);
      setPage("tracking");
      setOcrRpm(null);
      rpmRef.current = null;
      setMessage(t("saved"));
    } catch {
      setMessage(t("importError"));
    }
  };
  if (locked)
    return (
      <LoginScreen
        t={t}
        onLogin={({ username, password }) => {
          const ok =
            username === STATIC_LOGIN.username &&
            password === STATIC_LOGIN.password;
          if (ok) setLocked(false);
          return ok;
        }}
      />
    );
  return (
    <AppShell
      activePage={page}
      language={language}
      onLogout={() => {
        interrupt();
        setLocked(true);
      }}
      onLanguageChange={(value) => update((d) => ({ ...d, language: value }))}
      onPageChange={(value) => {
        if (dataRef.current.session.jogDirection !== 0) stop();
        setMessage("");
        setPage(value);
      }}
      t={t}
    >
      {page !== "tracking" && (
      <div className="case-toolbar">
        <span className="offline-state">{t(offline)}</span>
        <button className="control-button" onClick={saveCase}>
          {t("saveCase")}
        </button>
        <button
          className="control-button"
          onClick={() =>
            downloadJson(
              archive(dataRef.current),
              `BearingTrackerPro-${new Date().toISOString().slice(0, 10)}.json`,
            )
          }
        >
          {t("export")}
        </button>
        <button
          className="control-button"
          onClick={() => importRef.current.click()}
        >
          {t("import")}
        </button>
        <input
          hidden
          ref={importRef}
          type="file"
          accept="application/json,.json"
          onChange={importFile}
        />
        <output role="status">{message}</output>
      </div>
      )}
      {page === "tracking" && message && <output role="status">{message}</output>}
      {session.mode === "ocr" && (
        <div className="camera-dock">
          <CameraRPMPanel
            rpm={ocrRpm === null ? "—" : ocrRpm.toFixed(2)}
            signal={ocrSignal}
            onStableRpm={stableRpm}
            onOcrStop={stopOcr}
            t={t}
          />
        </div>
      )}
      {page === "tracking" && (
        <TrackingPage
          key={preset.id}
          session={session}
          preset={preset}
          presets={presets}
          rpm={ocrRpm}
          onMode={setMode}
          onChange={change}
          onSelect={select}
          onDelta={onDelta}
          onInterrupt={interrupt}
          onStart={start}
          onStop={session.mode === "manual" ? stopWithCoast : stop}
          onPause={stop}
          onReset={() => {
            if (window.confirm(t("resetConfirm")))
              update((d) => ({
                ...d,
                session: {
                  ...createSession(d.presets),
                  selectedPresetId: preset.id,
                  direction: preset.direction,
                  mode: d.session.mode,
                  events: d.session.events,
                },
              }));
          }}
          onDefect={defect}
          t={t}
        />
      )}
      {page === "analysis" && (
        <AnalysisPage
          key={preset.id}
          session={session}
          preset={preset}
          onChange={change}
          onReference={reference}
          onKnownTurns={(turns) => {
            if (Number.isFinite(turns))
              update((d) => ({
                ...d,
                session: advanceAngles(
                  {
                    ...d.session,
                    coast: null,
                    outerRunning: false,
                    cageRunning: false,
                    jogDirection: 0,
                  },
                  turns * 360,
                  d.presets,
                ),
              }));
          }}
          onConfirmSync={() => change({ sync: "synced" })}
          calibrations={calibrations}
          onCalibration={calibration}
          onApplyCalibration={applyCalibration}
          onCaptureAnchor={() =>
            change({
              calibrationAnchor: {
                presetId: preset.id,
                rotorAngle: session.rotorAngle,
                viewingDirection: preset.viewingDirection,
                timestamp: new Date().toISOString(),
              },
            })
          }
          t={t}
          language={language}
        />
      )}
      {page === "bearingData" && (
        <BearingDataPage
          key={preset.id}
          preset={preset}
          presets={presets}
          onSelect={select}
          onSave={savePreset}
          t={t}
        />
      )}
      <p className="app-safety">{t("safety")}</p>
    </AppShell>
  );
}
