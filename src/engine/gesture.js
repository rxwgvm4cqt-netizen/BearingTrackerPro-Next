import { pointerDelta } from "./kinematics.js";

// Input-only state. No React, clock or bearing parameters are involved.
export function createDialGesture() {
  let current = null;
  return {
    begin(id, angle, button = 0) {
      if (current || angle === null || button !== 0) return false;
      current = { id, angle };
      return true;
    },
    move(id, angle) {
      if (current?.id !== id) return { delta: 0, uncertain: false };
      const previous = current.angle;
      current.angle = angle;
      if (angle === null) return { delta: 0, uncertain: previous !== null };
      if (previous === null) return { delta: 0, uncertain: false };
      const delta = pointerDelta(previous, angle);
      // A very large per-event jump is ambiguous; do not silently integrate it.
      if (Math.abs(delta) > 120) return { delta: 0, uncertain: true };
      return { delta, uncertain: false };
    },
    end(id) {
      if (current?.id !== id) return false;
      current = null;
      return true;
    },
  };
}
