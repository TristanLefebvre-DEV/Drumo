/**
 * Movement Planner
 *
 * Computes detailed movement information for every hit:
 * how far the limb travels, how long it takes, and how that affects timing
 * and velocity.
 *
 * Output is a Map<hitId, MovementInfo> — suitable for playability detection
 * and humanization pipelines.
 */

import type { DrumHit } from "../core/types";
import type { Limb } from "../analysis/ergonomicRules";
import type { LimbMap } from "../analysis/limbAnalyzer";
import { KIT_POSITIONS, LIMB_REST, kitDistance, type DrumPosition } from "./drummerBodyEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MovementFeasibility = "easy" | "medium" | "hard" | "impossible";

export interface MovementInfo {
  hitId:           string;
  limb:            Limb;
  from:            DrumPosition;
  to:              DrumPosition;
  distance:        number;         // kit-space units
  travelMs:        number;         // estimated movement time in ms
  timingDelayMs:   number;         // humanization: how late this hit arrives
  velocityFactor:  number;         // 1.0 = normal, >1 = momentum adds force
  feasibility:     MovementFeasibility;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HAND_MS_PER_UNIT = 12;   // ms per kit distance unit for hands
const FOOT_MS_PER_UNIT = 20;   // feet move slower (less precise)

const DIST_MEDIUM   = 3.5;
const DIST_HARD     = 6.5;
const DIST_IMPOSSIBLE = 9.5;

// ─── Core computation ─────────────────────────────────────────────────────────

export const computeMovement = (
  limb: Limb,
  from: DrumPosition,
  to:   DrumPosition
): Omit<MovementInfo, "hitId" | "limb"> => {
  const isFoot    = limb === "RF" || limb === "LF";
  const distance  = kitDistance(from, to);
  const travelMs  = distance * (isFoot ? FOOT_MS_PER_UNIT : HAND_MS_PER_UNIT);

  // Long movements arrive slightly late (human inertia) and hit harder (momentum)
  const timingDelayMs  = distance > DIST_MEDIUM ? Math.min((distance - DIST_MEDIUM) * 3.5, 22) : 0;
  const velocityFactor = distance > DIST_HARD ? 1.12 : distance > DIST_MEDIUM ? 1.04 : 0.96;

  const feasibility: MovementFeasibility =
    distance >= DIST_IMPOSSIBLE ? "impossible" :
    distance >= DIST_HARD       ? "hard"       :
    distance >= DIST_MEDIUM     ? "medium"     : "easy";

  return { from, to, distance, travelMs, timingDelayMs, velocityFactor, feasibility };
};

// ─── Full movement map ────────────────────────────────────────────────────────

/**
 * Builds a movement map for all hits in the project.
 * Each entry describes the movement from the limb's PREVIOUS position to
 * the current target.
 */
export const buildMovementMap = (
  hits:    DrumHit[],
  limbMap: LimbMap
): Map<string, MovementInfo> => {
  const result     = new Map<string, MovementInfo>();
  const lastByLimb = new Map<Limb, DrumHit>();

  const sorted = [...hits].sort((a, b) => a.tick - b.tick);

  for (const hit of sorted) {
    const a = limbMap[hit.id];
    if (!a) continue;

    const limb = a.limb;
    const prev = lastByLimb.get(limb);
    const from = prev ? KIT_POSITIONS[prev.piece] : LIMB_REST[limb];
    const to   = KIT_POSITIONS[hit.piece];

    result.set(hit.id, {
      hitId: hit.id,
      limb,
      ...computeMovement(limb, from, to),
    });

    lastByLimb.set(limb, hit);
  }

  return result;
};

// ─── Timing influence ─────────────────────────────────────────────────────────

export interface HumanizationHint {
  hitId:          string;
  timingOffsetMs: number;
  velocityScale:  number;
  reason:         string;
}

/**
 * Converts a movement map into humanization hints.
 * Only produces hints for hits where movement meaningfully affects timing/velocity.
 */
export const movementToHumanization = (movMap: Map<string, MovementInfo>): HumanizationHint[] => {
  const hints: HumanizationHint[] = [];

  for (const [id, mov] of movMap) {
    const hasDelay    = mov.timingDelayMs > 1;
    const hasVelocity = Math.abs(mov.velocityFactor - 1.0) > 0.02;
    if (!hasDelay && !hasVelocity) continue;

    hints.push({
      hitId:          id,
      timingOffsetMs: mov.timingDelayMs,
      velocityScale:  mov.velocityFactor,
      reason:
        mov.feasibility === "hard"     ? "Long déplacement — impact physique" :
        mov.feasibility === "medium"   ? "Déplacement modéré" :
        mov.distance < 1               ? "Position proche — soft attack" :
        "Micro-déplacement",
    });
  }

  return hints;
};
