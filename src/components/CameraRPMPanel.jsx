import { memo, useEffect, useRef, useState } from "react";
import { captureFrameForOCR } from "../utils/captureFrame.js";
import { PSM, createWorker } from "tesseract.js";
import {
  getRpmCandidatesFromText,
  createRpmConfirmation,
  nextOcrDelay,
  OCR_MAX_AGE_MS,
  parseRpmFromText,
} from "../utils/ocrRpm";

const CAMERA_STATUS = {
  BLOCKED: "blocked",
  ERROR: "error",
  LIVE: "live",
  MOCK: "mock",
};

const OCR_WHITELIST = "0123456789.,RPM rpm";

const OCR_STATUS = {
  ERROR: "error",
  OFF: "off",
  RECOGNIZED: "recognized",
  RUNNING: "running",
};

function getDeviceLabel(device, index, t) {
  return device.label || `${t("cameraSelect")} ${index + 1}`;
}

function getPreferredDeviceId(devices) {
  const externalDevice = devices.find((device) =>
    /usb|external|uvc/i.test(device.label),
  );

  if (externalDevice) {
    return externalDevice.deviceId;
  }

  const rearDevice = devices.find((device) =>
    /back|rear|environment|hinten|rueck|rück/i.test(device.label),
  );

  return rearDevice?.deviceId || devices[0]?.deviceId || "";
}

function getVideoConstraints(deviceId) {
  if (deviceId) {
    return {
      deviceId: { exact: deviceId },
      height: { ideal: 720 },
      width: { ideal: 1280 },
    };
  }

  return {
    facingMode: { ideal: "environment" },
    height: { ideal: 720 },
    width: { ideal: 1280 },
  };
}

function CameraRPMPanel({ onOcrStop, onStableRpm, rpm, signal, t }) {
  const videoRef = useRef(null);
  const ocrCanvasRef = useRef(null);
  const ocrActiveRef = useRef(false);
  const ocrJobRunningRef = useRef(false);
  const confirmationRef = useRef(createRpmConfirmation());
  const ocrTimerRef = useRef(null);
  const ocrWorkerRef = useRef(null);
  const ocrWorkerPromiseRef = useRef(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const cameraGenerationRef = useRef(0);
  const stableCallbackRef = useRef(onStableRpm);
  const stopCallbackRef = useRef(onOcrStop);
  useEffect(() => {
    stableCallbackRef.current = onStableRpm;
    stopCallbackRef.current = onOcrStop;
  }, [onStableRpm, onOcrStop]);
  const stableOcrRpmRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraStatus, setCameraStatus] = useState(CAMERA_STATUS.MOCK);
  const [cameraError, setCameraError] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [deviceListMessage, setDeviceListMessage] = useState("");
  const [deviceListScanned, setDeviceListScanned] = useState(false);
  const [ocrActive, setOcrActive] = useState(false);
  const [ocrCandidates, setOcrCandidates] = useState([]);
  const [ocrError, setOcrError] = useState("");
  const [ocrDurationMs, setOcrDurationMs] = useState(null);
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrRpm, setOcrRpm] = useState(null);
  const [stableOcrRpm, setStableOcrRpm] = useState(null);
  const [ocrStatus, setOcrStatus] = useState(OCR_STATUS.OFF);
  const [ocrPlausibilityKey, setOcrPlausibility] = useState("ocrOff");
  const ocrPlausibility = t(ocrPlausibilityKey);
  const [videoDevices, setVideoDevices] = useState([]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const attachStream = async (stream, cameraGeneration) => {
    if (
      !mountedRef.current ||
      cameraGeneration !== cameraGenerationRef.current
    ) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    return true;
  };

  const collectVideoDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(
      (device) => device.kind === "videoinput",
    );
    setVideoDevices(videoInputs);
    setDeviceListScanned(true);
    setDeviceListMessage(
      videoInputs.length === 0 ? t("cameraDeviceListUnavailable") : "",
    );

    return videoInputs;
  };

  const requestCameraStream = (deviceId) =>
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: getVideoConstraints(deviceId),
    });

  const clearOcrTimer = () => {
    if (ocrTimerRef.current) {
      window.clearTimeout(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
  };

  const getOcrWorker = async (generation) => {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    if (!ocrWorkerPromiseRef.current) {
      const base = import.meta.env.BASE_URL;
      ocrWorkerPromiseRef.current = createWorker("eng", 1, {
        workerPath: `${base}ocr/worker.min.js`,
        corePath: `${base}ocr/core`,
        langPath: `${base}ocr/lang`,
        workerBlobURL: false,
      })
        .then(async (worker) => {
          if (!mountedRef.current || generationRef.current !== generation) {
            await worker.terminate();
            throw new Error("OCR cancelled");
          }
          await worker.setParameters({
            tessedit_char_whitelist: OCR_WHITELIST,
            tessedit_pageseg_mode: PSM.SINGLE_LINE,
          });
          if (!mountedRef.current || generationRef.current !== generation) {
            await worker.terminate();
            throw new Error("OCR cancelled");
          }
          ocrWorkerRef.current = worker;
          return worker;
        })
        .finally(() => {
          ocrWorkerPromiseRef.current = null;
        });
    }
    return ocrWorkerPromiseRef.current;
  };

  const terminateOcrWorker = async () => {
    if (!ocrWorkerRef.current) {
      return;
    }

    const worker = ocrWorkerRef.current;
    ocrWorkerRef.current = null;
    await worker.terminate();
  };

  const stopOcr = async ({ resetToMock = true } = {}) => {
    generationRef.current += 1;
    ocrActiveRef.current = false;
    setOcrActive(false);
    ocrJobRunningRef.current = false;
    clearOcrTimer();
    confirmationRef.current = createRpmConfirmation();
    stableOcrRpmRef.current = null;
    setOcrCandidates([]);
    setOcrDurationMs(null);
    setOcrRawText("");
    setOcrRpm(null);
    setStableOcrRpm(null);
    setOcrStatus(OCR_STATUS.OFF);
    setOcrPlausibility("ocrOff");

    if (resetToMock) {
      stopCallbackRef.current?.();
    }

    try {
      await terminateOcrWorker();
    } catch {
      setOcrError(t("ocrCannotStop"));
    }
  };

  const scheduleOcrPass = (durationMs = 0) => {
    clearOcrTimer();
    if (!ocrActiveRef.current || !mountedRef.current) return;
    ocrTimerRef.current = window.setTimeout(() => {
      ocrTimerRef.current = null;
      void runOcrPass();
    }, nextOcrDelay(durationMs));
  };

  async function runOcrPass() {
    if (
      !ocrActiveRef.current ||
      !streamRef.current ||
      ocrJobRunningRef.current
    ) {
      return;
    }

    const generation = generationRef.current;
    const startedAt = performance.now();
    ocrJobRunningRef.current = true;

    try {
      setOcrStatus((currentStatus) =>
        currentStatus === OCR_STATUS.RECOGNIZED
          ? OCR_STATUS.RECOGNIZED
          : OCR_STATUS.RUNNING,
      );
      const worker = await getOcrWorker(generation);
      if (
        !ocrActiveRef.current ||
        generation !== generationRef.current ||
        !mountedRef.current
      )
        return;
      const capturedAt = performance.now();
      const frame = captureFrameForOCR(
        videoRef.current,
        ocrCanvasRef.current,
        t,
      );
      const {
        data: { text },
      } = await worker.recognize(frame);
      if (
        !ocrActiveRef.current ||
        generation !== generationRef.current ||
        !mountedRef.current
      )
        return;
      const candidates = getRpmCandidatesFromText(text);
      const parsedRpm = parseRpmFromText(text);

      setOcrRawText(text.trim());
      setOcrCandidates(candidates.map((candidate) => candidate.value));
      setOcrRpm(parsedRpm);

      if (parsedRpm === null) {
        confirmationRef.current.push(null, capturedAt);
        setOcrStatus(OCR_STATUS.RUNNING);
        setOcrPlausibility("ocrUncertain");
      } else {
        const stableRpm = performance.now() - capturedAt <= OCR_MAX_AGE_MS
          ? confirmationRef.current.push(parsedRpm, capturedAt)
          : confirmationRef.current.push(null, capturedAt);

        if (stableRpm === null) {
          setOcrStatus(OCR_STATUS.RUNNING);
          setOcrPlausibility("ocrUncertain");
        } else {
          setOcrStatus(OCR_STATUS.RECOGNIZED);
          setOcrPlausibility("ocrStable");
          stableOcrRpmRef.current = stableRpm;
          setStableOcrRpm(stableRpm);
          setOcrRpm(stableRpm);
          stableCallbackRef.current?.(stableRpm, { timestamp: capturedAt });
        }
      }

      setOcrError("");
    } catch (error) {
      if (generation !== generationRef.current || !mountedRef.current) return;
      setOcrStatus(OCR_STATUS.ERROR);
      setOcrError(error?.message || t("ocrFailed"));
    } finally {
      if (generation === generationRef.current && mountedRef.current) {
        setOcrDurationMs(Math.round(performance.now() - startedAt));
        ocrJobRunningRef.current = false;
        scheduleOcrPass(performance.now() - startedAt);
      }
    }
  }

  const startDefaultCamera = async () => {
    stopCameraStream();
    const cameraGeneration = ++cameraGenerationRef.current;
    const stream = await requestCameraStream("");
    if (!(await attachStream(stream, cameraGeneration))) return;
    setCameraStatus(CAMERA_STATUS.LIVE);

    const devices = await collectVideoDevices();
    const streamDeviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
    setSelectedDeviceId(streamDeviceId || getPreferredDeviceId(devices));
  };

  const startSelectedCamera = async (deviceId) => {
    stopCameraStream();
    const cameraGeneration = ++cameraGenerationRef.current;
    const stream = await requestCameraStream(deviceId);
    if (!(await attachStream(stream, cameraGeneration))) return;
    setCameraStatus(CAMERA_STATUS.LIVE);
    await collectVideoDevices();
  };

  const refreshVideoDevices = async () => {
    setDeviceListMessage("");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus(CAMERA_STATUS.BLOCKED);
      setCameraError(t("cameraApiBlocked"));
      return;
    }

    let permissionStream = null;

    try {
      if (!streamRef.current) {
        permissionStream = await requestCameraStream("");
      }

      const devices = await collectVideoDevices();

      if (!selectedDeviceId && devices.length > 0) {
        setSelectedDeviceId(getPreferredDeviceId(devices));
      }
    } catch (error) {
      setCameraStatus(CAMERA_STATUS.ERROR);
      setCameraError(error?.message || t("cameraListLoadFailed"));
    } finally {
      permissionStream?.getTracks().forEach((track) => track.stop());
    }
  };

  const handleStartCamera = async () => {
    setCameraError("");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus(CAMERA_STATUS.BLOCKED);
      setCameraError(t("cameraApiBlocked"));
      return;
    }

    try {
      await startDefaultCamera();
    } catch (error) {
      stopCameraStream();
      setCameraStatus(CAMERA_STATUS.ERROR);
      setCameraError(error?.message || t("cameraNotAllowed"));
    }
  };

  const handleCameraChange = async (event) => {
    const nextDeviceId = event.target.value;
    setSelectedDeviceId(nextDeviceId);

    if (cameraStatus !== CAMERA_STATUS.LIVE) {
      return;
    }

    setCameraError("");
    await stopOcr();

    try {
      await startSelectedCamera(nextDeviceId);
    } catch (error) {
      stopCameraStream();
      setCameraStatus(CAMERA_STATUS.ERROR);
      setCameraError(error?.message || t("cameraNotAllowed"));
    }
  };

  const handleRefreshDevices = async () => {
    await refreshVideoDevices();
  };

  const handleStopCamera = () => {
    cameraGenerationRef.current += 1;
    void stopOcr();
    stopCameraStream();
    setCameraError("");
    setCameraStatus(CAMERA_STATUS.MOCK);
  };

  const handleStartOcr = async () => {
    if (cameraStatus !== CAMERA_STATUS.LIVE || !streamRef.current) {
      setOcrStatus(OCR_STATUS.ERROR);
      setOcrError(t("ocrNeedsCamera"));
      return;
    }

    if (ocrActiveRef.current) return;
    ocrActiveRef.current = true;
    setOcrActive(true);
    stableOcrRpmRef.current = null;
    confirmationRef.current = createRpmConfirmation();
    setOcrCandidates([]);
    setOcrDurationMs(null);
    setOcrError("");
    setOcrRawText("");
    setOcrRpm(null);
    setStableOcrRpm(null);
    setOcrPlausibility("ocrUncertain");
    setOcrStatus(OCR_STATUS.RUNNING);
    void runOcrPass();
  };

  const handleStopOcr = () => {
    void stopOcr();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      cameraGenerationRef.current += 1;
      ocrActiveRef.current = false;
      clearTimeout(ocrTimerRef.current);
      ocrTimerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const worker = ocrWorkerRef.current;
      ocrWorkerRef.current = null;
      void worker?.terminate().catch(() => {});
    };
  }, []);

  const ocrStatusLabel =
    ocrStatus === OCR_STATUS.RUNNING
      ? t("ocrUncertain")
      : ocrStatus === OCR_STATUS.RECOGNIZED
        ? t("ocrStable")
        : ocrStatus === OCR_STATUS.ERROR
          ? t("ocrError")
          : t("ocrOff");

  const statusLabel =
    cameraStatus === CAMERA_STATUS.LIVE
      ? t("cameraLive")
      : cameraStatus === CAMERA_STATUS.BLOCKED
        ? t("cameraBlocked")
        : cameraStatus === CAMERA_STATUS.ERROR
          ? t("cameraError")
          : t("cameraMockActive");

  return (
    <section className="camera-rpm-panel" aria-label={t("cameraRpm")}>
      <div className="camera-rpm-panel__preview">
        <video
          ref={videoRef}
          aria-label={t("cameraLive")}
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={ocrCanvasRef}
          aria-hidden="true"
          className="camera-rpm-panel__ocr-canvas"
        />
        <div className="camera-rpm-panel__ocr-roi" aria-hidden="true">
          <span>{t("ocrRoiLabel")}</span>
        </div>
        {cameraStatus !== CAMERA_STATUS.LIVE && (
          <span>{t("cameraPreview")}</span>
        )}
      </div>
      <div className="camera-rpm-panel__content">
        <div className="camera-rpm-panel__header">
          <div>
            <span className="eyebrow">{t("cameraRpm")}</span>
            <h2>{statusLabel}</h2>
          </div>
          <span
            className={`camera-rpm-panel__status camera-rpm-panel__status--${cameraStatus}`}
            aria-label={statusLabel}
          />
        </div>
        <strong>{rpm}</strong>
        <span className="camera-rpm-panel__hint" role="status">{t(signal ?? "ocrWaiting")}</span>
        <div className="camera-rpm-panel__actions">
          <button
            disabled={cameraStatus === CAMERA_STATUS.LIVE}
            type="button"
            onClick={handleStartCamera}
          >
            {t("cameraStart")}
          </button>
          <button
            disabled={cameraStatus !== CAMERA_STATUS.LIVE}
            type="button"
            onClick={handleStopCamera}
          >
            {t("cameraStop")}
          </button>
        </div>
        <div className="camera-rpm-panel__device-row">
          {videoDevices.length > 0 && (
            <label className="camera-rpm-panel__device-select">
              <span>{t("cameraSelect")}</span>
              <select value={selectedDeviceId} onChange={handleCameraChange}>
                {videoDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {getDeviceLabel(device, index, t)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={handleRefreshDevices}>
            {t("refreshCameras")}
          </button>
        </div>
        {deviceListScanned && (
          <span className="camera-rpm-panel__debug">
            {t("cameraDeviceCount")}: {videoDevices.length}
          </span>
        )}
        {deviceListMessage && (
          <span className="camera-rpm-panel__secure-hint">
            {deviceListMessage}
          </span>
        )}
        <div className="camera-rpm-panel__ocr-controls">
          <button
            disabled={
              cameraStatus !== CAMERA_STATUS.LIVE || ocrActive
            }
            type="button"
            onClick={handleStartOcr}
          >
            {t("ocrStart")}
          </button>
          <button
            disabled={!ocrActive}
            type="button"
            onClick={handleStopOcr}
          >
            {t("ocrStop")}
          </button>
        </div>
        <div className="camera-rpm-panel__ocr-readout">
          <span>{ocrStatusLabel}</span>
          <span>{ocrPlausibility}</span>
          <span>
            {t("ocrCandidate")} {ocrRpm === null ? "--" : ocrRpm.toFixed(2)}
          </span>
          <span>
            {t("ocrStable")}{" "}
            {stableOcrRpm === null ? "--" : stableOcrRpm.toFixed(2)}
          </span>
          <span>
            {t("ocrDuration")} {ocrDurationMs === null ? "--" : ocrDurationMs}{" "}
            ms
          </span>
          {ocrCandidates.length > 0 && (
            <small>
              {t("ocrCandidates")}:{" "}
              {ocrCandidates
                .slice(0, 4)
                .map((candidate) => candidate.toFixed(2))
                .join(", ")}
            </small>
          )}
          {ocrRawText && (
            <small>
              {t("ocrText")}: {ocrRawText.slice(0, 28)}
            </small>
          )}
        </div>
        {ocrError && (
          <span className="camera-rpm-panel__error">{ocrError}</span>
        )}
        <span className="camera-rpm-panel__hint">{t("ocrPrepared")}</span>
        <span className="camera-rpm-panel__secure-hint">
          {t("cameraNeedsSecureContext")}
        </span>
        {cameraError && (
          <span className="camera-rpm-panel__error">{cameraError}</span>
        )}
      </div>
    </section>
  );
}

// Rotor animation updates at frame rate; the camera panel only needs new OCR/UI props.
export default memo(CameraRPMPanel);
