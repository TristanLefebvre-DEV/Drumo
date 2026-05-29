/**
 * Difficulty Analyzer
 *
 * Computes a 0–100 difficulty score from five independent sub-scores,
 * then maps to a human-readable level.
 *
 * Sub-scores:
 *   bpm          – faster tempo = harder
 *   density      – more notes per measure = harder
 *   independence – kick / snare / hihat independence
 *   speed        – shortest inter-onset interval
 *   complexity   – variety of rhythmic subdivisions used
 */

import * as tf from "@tensorflow/tfjs";
import type { DrumHit, TimeSignature } from "../core/types";
import type { DifficultyBreakdown, DifficultyLevel, DifficultyResult } from "./types";

// ─── Sub-score calculations ────────────────────────────────────────────────────

/** BPM score: 60 BPM → 0 pt,  240+ BPM → 100 pt. */
const bpmScore = (bpm: number): number =>
  Math.min(100, Math.max(0, ((bpm - 60) / 180) * 100));

/** Note density: notes per measure.  Cap at 32 (= 32nd-note density). */
const densityScore = (hits: DrumHit[], ppq: number, sig: TimeSignature): number => {
  if (hits.length === 0) return 0;
  const maxTick = hits.reduce((m, h) => Math.max(m, h.tick), 0);
  const ticksPerMeasure = ppq * sig.numerator;
  const measures = Math.max(1, Math.ceil(maxTick / ticksPerMeasure));
  const notesPerMeasure = hits.length / measures;
  return Math.min(100, (notesPerMeasure / (sig.numerator * 4)) * 100);
};

/**
 * Independence score: how often kick, snare, and hihat fire simultaneously.
 * More simultaneous voices = more independence needed = harder.
 */
const independenceScore = (hits: DrumHit[], ppq: number): number => {
  if (hits.length === 0) return 0;
  const bucketSize = Math.round(ppq / 8); // 32nd-note bucket

  type VoiceSet = { kick: boolean; snare: boolean; hihat: boolean };
  const buckets = new Map<number, VoiceSet>();

  for (const hit of hits) {
    const bucket = Math.round(hit.tick / bucketSize);
    if (!buckets.has(bucket)) buckets.set(bucket, { kick: false, snare: false, hihat: false });
    const b = buckets.get(bucket)!;
    if (hit.piece === "kick")                                             b.kick = true;
    else if (hit.piece === "snare" || hit.piece === "snareRim")           b.snare = true;
    else if (hit.piece.startsWith("hihat") || hit.piece.startsWith("tom") || hit.piece.endsWith("Cymbal") || hit.piece === "crash" || hit.piece === "ride") b.hihat = true;
  }

  let tripleCount = 0; let dualCount = 0;
  for (const v of buckets.values()) {
    const active = (v.kick ? 1 : 0) + (v.snare ? 1 : 0) + (v.hihat ? 1 : 0);
    if (active === 3) tripleCount++;
    else if (active === 2) dualCount++;
  }
  const total = Math.max(1, buckets.size);
  return Math.min(100, ((tripleCount * 1.5 + dualCount * 0.8) / total) * 200);
};

/**
 * Speed score: based on the minimum inter-onset interval.
 * A 64th note at 180 BPM ≈ 41 ms → score = 100.
 */
const speedScore = (hits: DrumHit[], ppq: number, bpm: number): number => {
  if (hits.length < 2) return 0;
  const sorted = [...hits].sort((a, b) => a.tick - b.tick);
  const msPerTick = 60000 / (bpm * ppq);
  let minGapMs = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i].tick - sorted[i - 1].tick) * msPerTick;
    if (gap > 0) minGapMs = Math.min(minGapMs, gap);
  }
  if (!isFinite(minGapMs)) return 0;
  // 200 ms (8th at 150 BPM) → 0,   40 ms (64th at 150 BPM) → 100
  return Math.min(100, Math.max(0, ((200 - minGapMs) / 160) * 100));
};

/**
 * Complexity score: variety of subdivision grid values used.
 * Counts how many distinct grid levels appear (quarter, 8th, 16th, 32nd, triplets).
 */
const complexityScore = (hits: DrumHit[], ppq: number): number => {
  if (hits.length === 0) return 0;
  const grids = [ppq, ppq / 2, ppq / 4, ppq / 6, ppq / 8, ppq / 12]; // Q, 8, 16, 8T, 32, 16T
  const tolerance = ppq * 0.04;
  const usedGrids = new Set<number>();

  for (const hit of hits) {
    for (let gi = 0; gi < grids.length; gi++) {
      const g = grids[gi];
      if (Math.abs(hit.tick % g) < tolerance || Math.abs(hit.tick % g - g) < tolerance) {
        usedGrids.add(gi);
      }
    }
  }

  return Math.min(100, (usedGrids.size / grids.length) * 130);
};

// ─── Composite score + level ──────────────────────────────────────────────────

const WEIGHTS = {
  bpm: 0.15,
  density: 0.25,
  independence: 0.25,
  speed: 0.20,
  complexity: 0.15,
};

const scoreToLevel = (score: number): DifficultyLevel => {
  if (score < 30) return "Beginner";
  if (score < 55) return "Intermediate";
  if (score < 78) return "Advanced";
  return "Expert";
};

// ─── TF.js tensor helper (used when we add a trained model later) ─────────────

export const buildDifficultyTensor = (breakdown: DifficultyBreakdown): tf.Tensor1D =>
  tf.tensor1d([
    breakdown.bpmScore / 100,
    breakdown.densityScore / 100,
    breakdown.independenceScore / 100,
    breakdown.speedScore / 100,
    breakdown.complexityScore / 100,
  ]);

// ─── Public API ───────────────────────────────────────────────────────────────

export const analyzeDifficulty = (
  hits: DrumHit[],
  ppq: number,
  bpm: number,
  sig: TimeSignature
): DifficultyResult => {
  if (hits.length === 0) {
    return {
      level: "Beginner",
      score: 0,
      breakdown: { bpmScore: 0, densityScore: 0, independenceScore: 0, speedScore: 0, complexityScore: 0 },
    };
  }

  const breakdown: DifficultyBreakdown = {
    bpmScore:          Math.round(bpmScore(bpm)),
    densityScore:      Math.round(densityScore(hits, ppq, sig)),
    independenceScore: Math.round(independenceScore(hits, ppq)),
    speedScore:        Math.round(speedScore(hits, ppq, bpm)),
    complexityScore:   Math.round(complexityScore(hits, ppq)),
  };

  const composite = Math.round(
    breakdown.bpmScore          * WEIGHTS.bpm +
    breakdown.densityScore      * WEIGHTS.density +
    breakdown.independenceScore * WEIGHTS.independence +
    breakdown.speedScore        * WEIGHTS.speed +
    breakdown.complexityScore   * WEIGHTS.complexity
  );

  return {
    level: scoreToLevel(composite),
    score: Math.min(100, composite),
    breakdown,
  };
};

export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  Beginner:     "text-green-400",
  Intermediate: "text-blue-400",
  Advanced:     "text-amber-400",
  Expert:       "text-red-400",
};

export const DIFFICULTY_BG: Record<DifficultyLevel, string> = {
  Beginner:     "bg-green-500/20 border-green-500/40",
  Intermediate: "bg-blue-500/20 border-blue-500/40",
  Advanced:     "bg-amber-500/20 border-amber-500/40",
  Expert:       "bg-red-500/20 border-red-500/40",
};
