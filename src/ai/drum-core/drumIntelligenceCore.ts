/**
 * Drum Intelligence Core (DIC) — central brain orchestrator
 *
 * Single entry point that every pipeline stage reads from:
 *
 *   parseDrumMidi()
 *       ↓
 *   runDrumIntelligenceCore()   ← this file
 *       ↓ DrumCoreOutput
 *   quantizeHits()              reads .quantization.recommendedGrid / .preserveMicroTiming
 *   buildRhythm()
 *   staffRenderer               reads .notation.subdivision
 *   physical display            reads .physical.*
 *   difficulty display          reads .difficulty.*
 *   optimizationEngine          reads .optimization.versions
 *
 * Principles:
 *   - Deterministic: same input → same output every time
 *   - No ML: all heuristics, runs in < 20 ms for any typical MIDI file
 *   - Non-destructive: never mutates the ParsedDrumProject
 *   - Coherence: all downstream modules receive consistent, mutually compatible guidance
 */

import type { ParsedDrumProject, QuantizeGrid, DrumPiece } from "../../core/types";
import type { DrumCoreOutput, MidiDrumData } from "./types";
import { analyzeGroove }         from "./grooveEngine";
import { analyzePhysical }       from "./physicalEngine";
import { analyzeDifficultyCore } from "./difficultyEngine";
import { optimizePattern }       from "./optimizationEngine";

// ─── Conversion helpers ───────────────────────────────────────────────────────

const toMidiDrumData = (project: ParsedDrumProject): MidiDrumData => {
  const maxTick = project.hits.reduce((m, h) => Math.max(m, h.tick), 0);
  return {
    ppq:        project.ppq,
    bpm:        project.tempoBpm,
    totalTicks: maxTick + project.ppq * 4,
    hits:       project.hits.map(h => ({
      id:       h.id,
      piece:    h.piece,
      tick:     h.tick,
      velocity: h.velocity,
      isGhost:  h.isGhost,
      isAccent: h.isAccent,
    })),
  };
};

const subdivToGrid = (subdiv: string): QuantizeGrid => {
  const map: Record<string, QuantizeGrid> = {
    "1/4": "1/4", "1/8": "1/8", "8T": "8T",
    "1/16": "1/16", "16T": "16T", "1/32": "1/32",
  };
  return map[subdiv] ?? "1/16";
};

// ─── Quantization guidance ────────────────────────────────────────────────────

/**
 * Styles where groove micro-timing is musically significant and must be
 * kept even after quantization (soft tolerance = 15% of step).
 */
const GROOVE_PRESERVE_STYLES = new Set([
  "jazz", "funk", "shuffle", "lofi", "fusion", "latin",
]);

const stylePreservesMicro = (style: string, swing: number): boolean =>
  swing > 0.53 || GROOVE_PRESERVE_STYLES.has(style);

/**
 * Per-hit correction map.
 *
 * Rules (in priority order):
 *   1. Ghost notes → "preserve" (intentionally off-grid softness)
 *   2. Hi-hat off-beats in a swing context → "preserve" (swing offset IS the feel)
 *   3. Hits very close to grid (< 5% of step) → "snap" (clear typo-level deviation)
 *   4. Everything else → "adjust" (soft-snap with tolerance)
 */
const buildCorrectionMap = (
  data:      MidiDrumData,
  ppq:       number,
  dominant:  string,
  swingRatio: number
): Record<string, "snap" | "preserve" | "adjust"> => {
  const gridMults: Record<string, number> = {
    "1/4": 1, "1/8": 0.5, "8T": 1/3, "1/16": 0.25, "16T": 1/6, "1/32": 0.125,
  };
  const step    = ppq * (gridMults[dominant] ?? 0.25);
  const isSwing = swingRatio > 0.53;
  const map: Record<string, "snap" | "preserve" | "adjust"> = {};

  for (const hit of data.hits) {
    if (hit.isGhost) {
      map[hit.id] = "preserve";
      continue;
    }

    if (isSwing && (hit.piece === "hihatClosed" || hit.piece === "hihatOpen")) {
      const pairLen  = step * 2;
      const posInPair = hit.tick % pairLen;
      const isOffBeat = posInPair > step * 0.7 && posInPair < step * 1.4;
      if (isOffBeat) { map[hit.id] = "preserve"; continue; }
    }

    const snapErr = Math.abs(hit.tick - Math.round(hit.tick / step) * step) / step;
    map[hit.id] = snapErr < 0.05 ? "snap" : "adjust";
  }
  return map;
};

// ─── Notation voice-split hints ───────────────────────────────────────────────

const CYMBAL_PIECES: DrumPiece[] = [
  "hihatClosed", "hihatOpen", "hihatPedal",
  "crash", "ride", "splash", "otherCymbal",
];

/**
 * Maximum VexFlow duration code for the cymbal voice.
 * Matches voiceSplitter.ts logic: min(subdivStep × 2, beatTicks).
 */
const cymbalMaxDur = (dominant: string): string => {
  if (dominant === "1/32") return "16";
  if (dominant === "1/16") return "8";
  if (dominant === "1/8")  return "q";
  return "h";
};

// ─── Insights ────────────────────────────────────────────────────────────────

const buildInsights = (out: Omit<DrumCoreOutput, "insights">): string[] => {
  const ins: string[] = [];

  ins.push(`Style : ${out.groove.style} — cohésion groove ${out.groove.strength}/100`);

  if (out.groove.swing > 0.55) {
    ins.push(`Swing ${(out.groove.swing * 100).toFixed(0)}% — micro-timing hi-hat préservé`);
  }

  if (!out.physical.playable) {
    const n = out.physical.conflicts.length;
    ins.push(`⚠ ${n} conflit${n > 1 ? "s" : ""} physique${n > 1 ? "s" : ""} — pattern difficile ou injouable`);
  }

  const heavy = Object.entries(out.physical.limbLoad)
    .filter(([, v]) => v > 80)
    .map(([limb, v]) => `${limb} ${v}%`);
  if (heavy.length > 0) {
    ins.push(`Membres surchargés : ${heavy.join(", ")}`);
  }

  ins.push(`Difficulté : ${out.difficulty.level} (${out.difficulty.score}/100)`);
  ins.push(`Grille recommandée : ${out.quantization.recommendedGrid}${out.quantization.preserveMicroTiming ? " (groove-aware)" : " (strict)"}`);

  return ins;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the Drum Intelligence Core on a parsed project.
 *
 * Call once per project load. The returned DrumCoreOutput should be stored
 * in the app state and passed to every downstream module.
 *
 * @param project  The fully parsed drum project (never mutated).
 * @returns        DrumCoreOutput — unified guidance for all pipeline stages.
 */
export const runDrumIntelligenceCore = (project: ParsedDrumProject): DrumCoreOutput => {
  const data = toMidiDrumData(project);

  const groove     = analyzeGroove(data);
  const physical   = analyzePhysical(data);
  const difficulty = analyzeDifficultyCore(data);
  const optimized  = optimizePattern(data, groove, physical);

  const dominant       = groove.subdivisionMap.dominant;
  const correctionMap  = buildCorrectionMap(data, project.ppq, dominant, groove.swingRatio);
  const keepMicro      = stylePreservesMicro(groove.detectedStyle, groove.swingRatio);

  const partialOut: Omit<DrumCoreOutput, "insights"> = {
    groove: {
      style:    groove.detectedStyle,
      swing:    groove.swingRatio,
      strength: groove.grooveScore,
    },
    quantization: {
      recommendedGrid:     subdivToGrid(dominant),
      preserveMicroTiming: keepMicro,
      correctionMap,
    },
    physical: {
      playable:  physical.playable,
      limbLoad:  physical.limbLoad as unknown as Record<string, number>,
      conflicts: physical.conflicts.map(c => c.description),
    },
    difficulty: {
      score: difficulty.difficultyScore,
      level: difficulty.difficultyLevel,
    },
    notation: {
      subdivision: dominant,
      voiceSplitHints: {
        cymbalPieces: CYMBAL_PIECES,
        maxCymbalDur: cymbalMaxDur(dominant),
      },
    },
    optimization: {
      versions: optimized,
    },
  };

  return { ...partialOut, insights: buildInsights(partialOut) };
};
