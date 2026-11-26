import { useRef } from "react";
import { normalizeAngle, pointerAngle } from "../engine/kinematics.js";
import { createDialGesture } from "../engine/gesture.js";

const point = (radius, angle) => ({
  x: 200 + radius * Math.sin((angle * Math.PI) / 180),
  y: 200 - radius * Math.cos((angle * Math.PI) / 180),
});

export default function RotorDial({
  session,
  row,
  preset,
  enabled,
  onDelta,
  onInterrupt,
  t,
}) {
  const svgRef = useRef(null);
  const drag = useRef(createDialGesture());
  const viewSign = preset.viewingDirection === "generator" ? -1 : 1;
  const displayed = (angle) => angle * viewSign;
  const getAngle = (event) =>
    pointerAngle(
      event.clientX,
      event.clientY,
      svgRef.current.getBoundingClientRect(),
    );
  const start = (event) => {
    if (!enabled) return;
    const angle = getAngle(event);
    if (!drag.current.begin(event.pointerId, angle, event.button)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    if (!enabled) return;
    event.preventDefault();
    const angle = getAngle(event);
    const movement = drag.current.move(event.pointerId, angle);
    if (movement.uncertain) onInterrupt();
    if (movement.delta !== 0) onDelta(movement.delta * viewSign);
  };
  const finish = (event, interrupted = false) => {
    if (!drag.current.end(event.pointerId)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (interrupted) onInterrupt();
  };
  const rollerCount =
    preset.rollerCount && preset.rollerCount <= 100 ? preset.rollerCount : 32;
  const roller = point(130, displayed(row.angle));
  const inspection = point(176, displayed(row.inspectionAngle));
  return (
    <section
      className={`bearing-visualization rotor-dial ${enabled ? "rotor-dial--active" : ""}`}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 400 400"
        role="img"
        aria-label={t("bearingVisualization")}
        className={enabled ? "touch-enabled" : ""}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={(event) => finish(event, true)}
        data-testid="rotor-dial"
      >
        <title>{t("fingerHint")}</title>
        <defs>
          <radialGradient id="dialGlow">
            <stop stopColor="#17242e" />
            <stop offset="1" stopColor="#070c11" />
          </radialGradient>
          <radialGradient id="dialRoller">
            <stop stopColor="#fff9bb" />
            <stop offset=".5" stopColor="#ffd343" />
            <stop offset="1" stopColor="#a76b09" />
          </radialGradient>
        </defs>
        <rect width="400" height="400" rx="18" fill="url(#dialGlow)" />
        <circle
          cx="200"
          cy="200"
          r="168"
          className="bearing-ring bearing-ring--outer"
        />
        <circle
          cx="200"
          cy="200"
          r="103"
          className="bearing-ring bearing-ring--inner"
        />
        <circle cx="200" cy="200" r="130" className="bearing-pitch" />
        <g
          transform={`rotate(${displayed(session.rotorAngle)} 200 200)`}
          className="outer-rotation-ticks"
        >
          {Array.from({ length: 24 }, (_, i) => {
            const a = point(156, i * 15),
              b = point(174, i * 15);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </g>
        {Array.from({ length: rollerCount }, (_, i) => {
          const p = point(130, displayed(row.travel + (i * 360) / rollerCount));
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={rollerCount > 60 ? 3 : 6.5}
              fill="url(#dialRoller)"
              stroke="#ffe49a"
              strokeWidth=".7"
            />
          );
        })}
        <g className="rotor-assembly">
          {["A", "B", "C"].map((blade, i) => {
            const angle = displayed(session.rotorAngle + i * 120);
            return (
              <g
                key={blade}
                transform={`rotate(${angle} 200 200)`}
                className="rotor-blade"
              >
                <path d="M200 200 C190 166 185 109 194 39 Q200 22 207 39 C215 109 209 168 200 200Z" />
                <path
                  d="M200 200 L200 25"
                  stroke="transparent"
                  strokeWidth="44"
                  fill="none"
                  className="blade-touch-handle"
                />
                <circle cx="200" cy="27" r="17" />
                <text x="200" y="33" transform={`rotate(${-angle} 200 27)`}>
                  {blade}
                </text>
              </g>
            );
          })}
        </g>
        <circle cx="200" cy="200" r="43" className="bearing-hub" />
        <text x="200" y="197" className="bearing-center-label">
          {normalizeAngle(displayed(session.rotorAngle)).toFixed(1)}°
        </text>
        <text x="200" y="214" className="bearing-center-sub">
          {preset.row.toUpperCase()}
        </text>
        <g className="listen-marker">
          <circle cx={inspection.x} cy={inspection.y} r="8" />
          <circle
            cx={inspection.x}
            cy={inspection.y}
            r="13"
            fill="none"
            stroke="#29d17d"
            strokeWidth="1.5"
          />
        </g>
        {row.marked && (
          <g
            data-testid="defect-marker"
            opacity={session.sync === "synced" ? 1 : 0.5}
          >
            <circle
              cx={roller.x}
              cy={roller.y}
              r="10"
              fill="#ff3045"
              stroke="#ffb5bd"
              strokeWidth="2"
            />
            <circle
              cx={roller.x}
              cy={roller.y}
              r="15"
              fill="none"
              stroke="#ff3045"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>
      <div className="dial-caption">
        <span>
          {preset.rollerCount === null
            ? t("symbolic")
            : `${preset.rollerCount} · ${t("simplified")}`}
        </span>
        <span>{t(preset.viewingDirection)}</span>
      </div>
    </section>
  );
}
