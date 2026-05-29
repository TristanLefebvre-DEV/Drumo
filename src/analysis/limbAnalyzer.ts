/**
 * Limb Analyzer — public API
 *
 * Entry point for the Limb Analysis system.  Orchestrates:
 *   - stickingEngine  (assigns RH/LH/RF/LF to every hit)
 *   - ergonomicRules  (constants, colours, descriptions)
 *
 * Output is a plain Record<hitId, LimbAssignment> that can be stored in
 * Zustand without serialization issues.
 *
 * Usage:
 *   const map = analyzeLimbs(project.hits, project.ppq, project.tempoBpm, "human");
 *   map["abc123"].limb   // → "RH"
 *   map["abc123"].reason // → "Position naturelle"
 */

import { solveSticking, type LimbAssignment } from "./stickingEngine";
import type { DrumHit } from "../core/types";
import type { StickingMode } from "./ergonomicRules";

export type { LimbAssignment, StickingMode };
export type LimbMap = Record<string, LimbAssignment>;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse all hits and return a LimbMap.
 * Runs synchronously in < 5 ms for typical MIDI files (< 2000 hits).
 */
export const analyzeLimbs = (
  hits:  DrumHit[],
  ppq:   number,
  bpm:   number,
  mode:  StickingMode = "human"
): LimbMap => solveSticking(hits, ppq, bpm, mode);

/** Empty map for initial state / no project. */
export const EMPTY_LIMB_MAP: LimbMap = {};

// ─── Statistics helpers ────────────────────────────────────────────────────────

export interface LimbStats {
  RH: number; LH: number; RF: number; LF: number; total: number;
}

export const computeLimbStats = (map: LimbMap): LimbStats => {
  const stats: LimbStats = { RH: 0, LH: 0, RF: 0, LF: 0, total: 0 };
  for (const a of Object.values(map)) {
    stats[a.limb]++;
    stats.total++;
  }
  return stats;
};

export const crossoverCount = (map: LimbMap): number =>
  Object.values(map).filter((a) => a.isCrossover).length;

export const avgConfidence = (map: LimbMap): number => {
  const vals = Object.values(map);
  if (vals.length === 0) return 0;
  return vals.reduce((s, a) => s + a.confidence, 0) / vals.length;
};

// Re-export everything the UI needs from one place
export {
  LIMB_COLOR,
  LIMB_DESCRIPTION,
  type Limb,
  type InstrumentSide,
} from "./ergonomicRules";
