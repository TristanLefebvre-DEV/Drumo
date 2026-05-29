/**
 * Physical Drum Simulation Engine
 *
 * Deterministic biomechanical feasibility analysis.
 * No musical interpretation — strictly physical constraints.
 *
 * Outputs:
 *   playable          — false iff any "error" severity conflict exists
 *   limbLoad          — RH/LH/RF/LF utilization % (0–100)
 *   conflicts         — impossible or very hard patterns
 *   ergonomicWarnings — non-blocking suggestions
 */

import { analyzeLimbs, computeLimbStats, crossoverCount } from "../../analysis/limbAnalyzer";
import { detectImpossiblePatterns } from "../../analysis/impossiblePatternDetector";
import type { DrumHit } from "../../core/types";
import type { MidiDrumData, PhysicalAnalysis, LimbLoad, PhysicalConflict } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert MidiDrumHit to DrumHit (add missing fields for existing engine compatibility). */
const toFullHits = (data: MidiDrumData): DrumHit[] =>
  data.hits.map(h => ({
    id:            h.id,
    midi:          0,
    piece:         h.piece,
    tick:          h.tick,
    durationTicks: Math.round(data.ppq / 4),
    velocity:      h.velocity,
    isGhost:       h.isGhost,
    isAccent:      h.isAccent,
  }));

/** Theoretical max hits per limb per second at the given BPM. */
const maxHitsPerSecond = (bpm: number, isHand: boolean): number => {
  // Hand: ~16th at fastest typical BPM; foot: ~8th at typical BPM
  const baseTempo = isHand ? bpm * 4 / 60 : bpm * 2 / 60;
  return Math.max(1, baseTempo);
};

// ─── Limb load calculation ────────────────────────────────────────────────────

const computeLimbLoad = (hits: DrumHit[], bpm: number, ppq: number): LimbLoad => {
  if (hits.length === 0) return { RH: 0, LH: 0, RF: 0, LF: 0 };

  const limbMap    = analyzeLimbs(hits, ppq, bpm, "human");
  const stats      = computeLimbStats(limbMap);
  const totalSecs  = (hits.reduce((m, h) => Math.max(m, h.tick), 0) / ppq) * (60 / bpm);
  const safeSecs   = Math.max(1, totalSecs);

  const rhRate = stats.RH / safeSecs;
  const lhRate = stats.LH / safeSecs;
  const rfRate = stats.RF / safeSecs;
  const lfRate = stats.LF / safeSecs;

  const rhMax = maxHitsPerSecond(bpm, true);
  const lfMax = maxHitsPerSecond(bpm, false);

  return {
    RH: Math.min(100, Math.round((rhRate / rhMax) * 100)),
    LH: Math.min(100, Math.round((lhRate / rhMax) * 100)),
    RF: Math.min(100, Math.round((rfRate / lfMax) * 100)),
    LF: Math.min(100, Math.round((lfRate / lfMax) * 100)),
  };
};

// ─── Ergonomic warnings ───────────────────────────────────────────────────────

const buildErgonomicWarnings = (hits: DrumHit[], bpm: number, ppq: number): string[] => {
  const warnings: string[] = [];
  const limbMap = analyzeLimbs(hits, ppq, bpm, "human");
  const stats   = computeLimbStats(limbMap);
  const crosses = crossoverCount(limbMap);

  if (stats.LH > stats.RH * 1.4) {
    warnings.push("Main gauche très sollicitée — vérifier l'assignment des cymbales");
  }
  if (crosses > hits.length * 0.15) {
    warnings.push(`${crosses} croisements de bras détectés — peut fatiguer rapidement`);
  }
  const load = computeLimbLoad(hits, bpm, ppq);
  if (load.RF > 85) {
    warnings.push("Pied droit (caisse claire / charleston) chargé à plus de 85% — risque de crampe");
  }
  if (load.LF > 85) {
    warnings.push("Pied gauche (pédale charleston) chargé à plus de 85%");
  }
  if (load.RH > 90 || load.LH > 90) {
    const hand = load.RH > 90 ? "droite" : "gauche";
    warnings.push(`Main ${hand} proche de la saturation — envisager de redistribuer les frappes`);
  }
  return warnings;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const analyzePhysical = (data: MidiDrumData): PhysicalAnalysis => {
  const hits = toFullHits(data);

  if (hits.length === 0) {
    return {
      playable:          true,
      limbLoad:          { RH: 0, LH: 0, RF: 0, LF: 0 },
      conflicts:         [],
      ergonomicWarnings: [],
    };
  }

  const limbMap  = analyzeLimbs(hits, data.ppq, data.bpm, "human");
  const issues   = detectImpossiblePatterns(hits, data.ppq, data.bpm, limbMap);

  const conflicts: PhysicalConflict[] = issues.map(issue => ({
    tick:        issue.tick,
    description: issue.description,
    severity:    issue.severity,
    hitIds:      issue.hitIds,
  }));

  const playable = !conflicts.some(c => c.severity === "error");

  return {
    playable,
    limbLoad:          computeLimbLoad(hits, data.bpm, data.ppq),
    conflicts,
    ergonomicWarnings: buildErgonomicWarnings(hits, data.bpm, data.ppq),
  };
};
