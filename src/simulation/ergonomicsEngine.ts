/**
 * Ergonomics Engine
 *
 * High-level ergonomic analysis of a drumming pattern:
 *   - overall ergonomic score (0–100, 100 = perfect)
 *   - fatigue model (identifies repetitive-strain patterns)
 *   - humanization hints (timing + velocity adjustments based on body physics)
 *   - per-limb workload breakdown
 *
 * Builds on top of MovementPlanner — does NOT re-invent physics.
 */

import type { DrumHit } from "../core/types";
import type { Limb } from "../analysis/ergonomicRules";
import type { LimbMap } from "../analysis/limbAnalyzer";
import { buildMovementMap, movementToHumanization, type HumanizationHint, type MovementInfo } from "./movementPlanner";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LimbWorkload {
  limb:          Limb;
  hitCount:      number;
  totalDistance: number;
  avgDistance:   number;
  hardMoveCount: number;  // moves rated "hard" or "impossible"
  fatigueScore:  number;  // 0–100
}

export interface ErgonomicsResult {
  overallScore:      number;              // 0–100 (100 = great ergonomics)
  fatigueScore:      number;              // 0–100 (100 = very fatigued)
  limbWorkloads:     Record<Limb, LimbWorkload>;
  humanizationHints: HumanizationHint[];
  movementMap:       Map<string, MovementInfo>;
  summary:           string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Consecutive hard moves before fatigue starts building
const FATIGUE_BURST_THRESHOLD = 6;

const LIMBS: readonly Limb[] = ["RH", "LH", "RF", "LF"];

// ─── Workload per limb ────────────────────────────────────────────────────────

const computeWorkload = (limb: Limb, movMap: Map<string, MovementInfo>): LimbWorkload => {
  let total      = 0;
  let count      = 0;
  let hardCount  = 0;
  let burst      = 0;
  let maxBurst   = 0;

  for (const mov of movMap.values()) {
    if (mov.limb !== limb) continue;
    count++;
    total += mov.distance;

    const isHard = mov.feasibility === "hard" || mov.feasibility === "impossible";
    if (isHard) {
      hardCount++;
      burst++;
      maxBurst = Math.max(maxBurst, burst);
    } else {
      burst = 0;
    }
  }

  const fatigueScore = Math.min(100, Math.round((maxBurst / FATIGUE_BURST_THRESHOLD) * 100));

  return {
    limb,
    hitCount:      count,
    totalDistance: total,
    avgDistance:   count > 0 ? total / count : 0,
    hardMoveCount: hardCount,
    fatigueScore,
  };
};

// ─── Summary text ─────────────────────────────────────────────────────────────

const buildSummary = (score: number, fatigue: number, workloads: Record<Limb, LimbWorkload>): string => {
  if (score >= 80 && fatigue <= 20) return "Excellent — mouvements naturels et efficaces.";
  if (score >= 60 && fatigue <= 40) return "Bon — quelques transitions exigeantes mais jouables.";

  const mostTired = LIMBS.reduce((a, b) =>
    workloads[a].fatigueScore > workloads[b].fatigueScore ? a : b
  );
  if (fatigue >= 70) return `Fatigue élevée — ${mostTired} sous forte charge. Envisager une redistribution.`;
  if (score < 40)    return "Pattern difficile — vérifier le sticking et les transitions.";
  return "Ergonomie modérée — des améliorations sont possibles.";
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const analyzeErgonomics = (
  hits:    DrumHit[],
  limbMap: LimbMap,
  _ppq:    number,
  _bpm:    number
): ErgonomicsResult => {
  const movMap  = buildMovementMap(hits, limbMap);
  const hints   = movementToHumanization(movMap);

  const workloads = {} as Record<Limb, LimbWorkload>;
  for (const limb of LIMBS) {
    workloads[limb] = computeWorkload(limb, movMap);
  }

  // Overall ergonomics: penalise high average distance + hard moves
  const allMoves = [...movMap.values()];
  const avgDist  = allMoves.length > 0
    ? allMoves.reduce((s, m) => s + m.distance, 0) / allMoves.length
    : 0;
  const hardRatio = allMoves.length > 0
    ? allMoves.filter((m) => m.feasibility === "hard" || m.feasibility === "impossible").length / allMoves.length
    : 0;

  const overallScore  = Math.max(0, Math.round(100 - avgDist * 5 - hardRatio * 40));
  const fatigueScore  = Math.max(0, ...LIMBS.map((l) => workloads[l].fatigueScore));
  const summary       = buildSummary(overallScore, fatigueScore, workloads);

  return { overallScore, fatigueScore, limbWorkloads: workloads, humanizationHints: hints, movementMap: movMap, summary };
};
