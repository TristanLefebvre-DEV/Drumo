/**
 * Limb Tracker
 *
 * Converts the pre-built BodyFrame timeline into smooth, queryable limb
 * positions for any given MIDI tick — including interpolation between frames
 * and fade-back to rest position.
 *
 * Designed for direct consumption by the visualizer (canvas rAF loop).
 */

import type { Limb } from "../analysis/ergonomicRules";
import type { DrumPosition } from "./drummerBodyEngine";
import { LIMB_REST, queryBodyAtTick, kitDistance, type BodyFrame } from "./drummerBodyEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LimbSnapshot {
  x:        number;
  y:        number;
  isActive: boolean;     // true = within rebound window of a hit
  isBusy:   boolean;     // true = still traveling / occupied
}

export type LimbSnapshots = Record<Limb, LimbSnapshot>;

const LIMBS: readonly Limb[] = ["RH", "LH", "RF", "LF"];

// ─── Main query ───────────────────────────────────────────────────────────────

/**
 * Returns the 4-limb snapshot for rendering at `tick`.
 *
 * When no body timeline exists (empty or no project), returns limbs at rest.
 * isActive is true for ≤ 12 ticks around a hit — drives glow animation.
 */
export const getLimbSnapshots = (frames: BodyFrame[], tick: number): LimbSnapshots => {
  const result = {} as LimbSnapshots;

  if (frames.length === 0) {
    for (const limb of LIMBS) {
      result[limb] = { ...LIMB_REST[limb], isActive: false, isBusy: false };
    }
    return result;
  }

  const frame = queryBodyAtTick(frames, tick);

  for (const limb of LIMBS) {
    if (!frame) {
      result[limb] = { ...LIMB_REST[limb], isActive: false, isBusy: false };
      continue;
    }

    const state    = frame.limbs[limb];
    const isActive = Math.abs(frame.tick - tick) <= 12;
    const isBusy   = state.busyUntilTick > tick;

    result[limb] = { x: state.x, y: state.y, isActive, isBusy };
  }

  return result;
};

// ─── Motion arc ───────────────────────────────────────────────────────────────

/**
 * Returns the arc midpoint for animating a stick/foot trajectory.
 * `lift` controls how much the arc bows upward in kit-space y.
 */
export const arcMidpoint = (
  from: DrumPosition,
  to:   DrumPosition,
  lift  = 1.2
): DrumPosition => ({
  x: (from.x + to.x) / 2,
  y: (from.y + to.y) / 2 + lift,
});

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface LimbActivityStats {
  totalDistance:  number;   // sum of all inter-hit distances per limb
  avgDistance:    number;   // average per-hit distance
  maxDistance:    number;   // longest single movement
  hitCount:       number;
}

/** Compute aggregate movement statistics for a single limb's frames. */
export const computeLimbActivity = (frames: BodyFrame[], limb: Limb): LimbActivityStats => {
  let total  = 0;
  let max    = 0;
  let prev: DrumPosition | null = null;

  for (const f of frames) {
    const s = f.limbs[limb];
    if (!s.currentTarget) continue;

    const cur: DrumPosition = { x: s.x, y: s.y };
    if (prev) {
      const d = kitDistance(prev, cur);
      total += d;
      if (d > max) max = d;
    }
    prev = cur;
  }

  const hitCount = frames.filter((f) => f.limbs[limb].currentTarget !== null).length;

  return {
    totalDistance: total,
    avgDistance:   hitCount > 1 ? total / (hitCount - 1) : 0,
    maxDistance:   max,
    hitCount,
  };
};
