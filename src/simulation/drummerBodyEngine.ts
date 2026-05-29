/**
 * Drummer Body Engine
 *
 * Core of the Drummer Body Simulation system.
 * Understands the physical layout of a drum kit in 2D space and tracks
 * where each limb (RH, LH, RF, LF) is at any given MIDI tick.
 *
 * Coordinate system:
 *   x: -8 (far left) → +8 (far right)
 *   y: -5 (kick/low) → +5 (cymbals/high)
 *
 * NOT a physics engine — a lightweight spatial intelligence layer.
 */

import type { DrumHit, DrumPiece } from "../core/types";
import type { LimbMap } from "../analysis/limbAnalyzer";
import type { Limb } from "../analysis/ergonomicRules";

// ─── Spatial map ───────────────────────────────────────────────────────────────

export interface DrumPosition {
  x: number;
  y: number;
}

export const KIT_POSITIONS: Record<DrumPiece, DrumPosition> = {
  hihatClosed: { x: -4,  y:  2   },
  hihatOpen:   { x: -4,  y:  2   },
  hihatPedal:  { x: -3,  y: -3   },
  snare:       { x:  0,  y:  0   },
  snareRim:    { x:  0,  y:  0   },
  kick:        { x:  0,  y: -4   },
  tomHigh:     { x:  2,  y:  1.5 },
  tomMid:      { x:  4,  y:  1   },
  tomLow:      { x:  6,  y: -1   },
  ride:        { x:  5,  y:  3   },
  crash:       { x: -5,  y:  4   },
  splash:      { x:  6,  y:  4   },
  otherCymbal: { x:  6,  y:  4.5 },
};

/** Where each limb rests when not playing. */
export const LIMB_REST: Record<Limb, DrumPosition> = {
  RH: { x:  1,  y:  1   },
  LH: { x: -1,  y:  1   },
  RF: { x:  0,  y: -4   },
  LF: { x: -3,  y: -3   },
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SimLimbState {
  currentTarget: DrumPiece | null;
  x: number;
  y: number;
  /** Tick at which this limb is no longer occupied (after travel+rebound). */
  busyUntilTick: number;
}

export interface BodyFrame {
  tick:         number;
  limbs:        Record<Limb, SimLimbState>;
  activeHitIds: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const freshLimbs = (): Record<Limb, SimLimbState> => ({
  RH: { currentTarget: null, ...LIMB_REST.RH, busyUntilTick: 0 },
  LH: { currentTarget: null, ...LIMB_REST.LH, busyUntilTick: 0 },
  RF: { currentTarget: null, ...LIMB_REST.RF, busyUntilTick: 0 },
  LF: { currentTarget: null, ...LIMB_REST.LF, busyUntilTick: 0 },
});

const cloneLimbs = (src: Record<Limb, SimLimbState>): Record<Limb, SimLimbState> => ({
  RH: { ...src.RH },
  LH: { ...src.LH },
  RF: { ...src.RF },
  LF: { ...src.LF },
});

/** Euclidean distance between two kit positions. */
export const kitDistance = (a: DrumPosition, b: DrumPosition): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

// ─── Build timeline ────────────────────────────────────────────────────────────

/**
 * Pre-processes the full hit list into a sorted array of BodyFrames.
 * Each frame records the state of all 4 limbs immediately AFTER a hit event.
 * O(n log n) — fast enough for real-time use.
 */
export const buildBodyTimeline = (
  hits:    DrumHit[],
  limbMap: LimbMap,
  ppq:     number,
  bpm:     number
): BodyFrame[] => {
  if (hits.length === 0 || Object.keys(limbMap).length === 0) return [];

  const msPerTick = 60_000 / (bpm * ppq);
  const sorted    = [...hits].sort((a, b) => a.tick - b.tick);
  const frames: BodyFrame[] = [];
  const limbs = freshLimbs();

  // Group simultaneous hits (within 5 ticks) into chord events
  const events: DrumHit[][] = [];
  let group: DrumHit[] = [];
  for (const hit of sorted) {
    if (group.length === 0 || hit.tick - group[0].tick <= 5) {
      group.push(hit);
    } else {
      events.push(group);
      group = [hit];
    }
  }
  if (group.length > 0) events.push(group);

  for (const event of events) {
    const tick = event[0].tick;

    for (const hit of event) {
      const a = limbMap[hit.id];
      if (!a) continue;

      const limb = a.limb;
      const dest = KIT_POSITIONS[hit.piece];
      const from: DrumPosition = { x: limbs[limb].x, y: limbs[limb].y };

      // Travel time: ~12 ms/unit for hands, ~20 ms/unit for feet
      const isFoot    = limb === "RF" || limb === "LF";
      const dist      = kitDistance(from, dest);
      const travelMs  = dist * (isFoot ? 20 : 12);
      const reboundMs = 30;   // rebound time after strike

      limbs[limb] = {
        currentTarget:  hit.piece,
        x:              dest.x,
        y:              dest.y,
        busyUntilTick:  tick + (travelMs + reboundMs) / msPerTick,
      };
    }

    frames.push({
      tick,
      limbs: cloneLimbs(limbs),
      activeHitIds: event.map((h) => h.id),
    });
  }

  return frames;
};

// ─── Query ─────────────────────────────────────────────────────────────────────

/**
 * Binary search: returns the most recent BodyFrame at or before `tick`.
 * Returns null if tick precedes all frames.
 */
export const queryBodyAtTick = (frames: BodyFrame[], tick: number): BodyFrame | null => {
  if (frames.length === 0) return null;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].tick <= tick) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo].tick <= tick ? frames[lo] : null;
};

/** Spatial centre of the entire kit layout (useful for visualizer centering). */
export const KIT_CENTRE: DrumPosition = { x: 1, y: 0.5 };
