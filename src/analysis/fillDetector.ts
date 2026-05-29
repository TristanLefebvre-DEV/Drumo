/**
 * Fill Detector
 *
 * Analyses drum hits measure by measure and classifies each measure as:
 *   groove      – consistent kick/snare/hihat backbone
 *   fill        – tom-heavy, hihat-absent, density spike
 *   break       – very sparse or silent
 *   transition  – mixed, between groove and fill
 *
 * Algorithm is intentionally robust to human timing variation and ghost notes
 * so it works correctly on un-quantized MIDI files.
 *
 * Pipeline:
 *   hits[] → per-measure stats → relative scoring → smooth → classify
 */

import type { DrumHit, ParsedDrumProject } from "../core/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MeasureType = "groove" | "fill" | "break" | "transition";

export interface MeasureStats {
  index:         number;
  noteCount:     number;
  density:       number;   // notes per beat
  kickCount:     number;
  snareCount:    number;
  tomCount:      number;
  hihatCount:    number;
  cymbalCount:   number;
  ghostCount:    number;
  avgVelocity:   number;
  uniquePieces:  number;
  tomRatio:      number;   // toms / total
  hihatRatio:    number;   // hihat / total
  type:          MeasureType;
  confidence:    number;   // 0–1
}

// ─── Per-measure stats ────────────────────────────────────────────────────────

const computeMeasureStats = (
  hits:    DrumHit[],
  index:   number,
  _ppq:    number,
  beats:   number
): MeasureStats => {
  const kick   = hits.filter((h) => h.piece === "kick");
  const snare  = hits.filter((h) => h.piece === "snare" || h.piece === "snareRim");
  const toms   = hits.filter((h) => h.piece === "tomHigh" || h.piece === "tomMid" || h.piece === "tomLow");
  const hihat  = hits.filter((h) => h.piece === "hihatClosed" || h.piece === "hihatOpen" || h.piece === "hihatPedal");
  const cymbal = hits.filter((h) => h.piece === "crash" || h.piece === "ride" || h.piece === "splash" || h.piece === "otherCymbal");
  const ghost  = hits.filter((h) => h.isGhost);

  const total = hits.length;
  const avgVel = total > 0
    ? hits.reduce((s, h) => s + h.velocity, 0) / total
    : 0;
  const pieces = new Set(hits.map((h) => h.piece));

  return {
    index,
    noteCount:   total,
    density:     total / Math.max(1, beats),
    kickCount:   kick.length,
    snareCount:  snare.length,
    tomCount:    toms.length,
    hihatCount:  hihat.length,
    cymbalCount: cymbal.length,
    ghostCount:  ghost.length,
    avgVelocity: avgVel,
    uniquePieces: pieces.size,
    tomRatio:    total > 0 ? toms.length / total : 0,
    hihatRatio:  total > 0 ? hihat.length / total : 0,
    type:        "groove",  // placeholder — filled below
    confidence:  0,
  };
};

// ─── Median helper ────────────────────────────────────────────────────────────

const median = (vals: number[]): number => {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

// ─── Classification ───────────────────────────────────────────────────────────

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

const classifyMeasure = (
  stats: MeasureStats,
  refDensity:  number,
  refHihat:    number,
  refTom:      number,
  _refKick:    number,
  _refSnare:   number
): { type: MeasureType; confidence: number } => {
  const total = stats.noteCount;

  // Break: very sparse
  if (total === 0) return { type: "break", confidence: 1.0 };
  const breakScore = sigmoid((refDensity * 0.3 - stats.density) * 3);
  if (breakScore > 0.80) return { type: "break", confidence: breakScore };

  // Fill signals:
  //   1. Tom presence above baseline
  //   2. Hihat absence vs baseline
  //   3. Density spike vs baseline
  const tomSignal    = refTom > 0.5 ? stats.tomCount / refTom - 1 : stats.tomCount * 1.5;
  const hihatSignal  = refHihat > 0.5 ? 1 - stats.hihatCount / refHihat : 0;
  const densSignal   = refDensity > 0.01 ? stats.density / refDensity - 1 : 0;

  const fillScore = sigmoid(tomSignal * 1.8 + hihatSignal * 1.4 + densSignal * 0.8 - 1);

  // Groove signals:
  //   kick + snare + hihat all present, near baseline density
  const hasBackbone  = stats.kickCount >= 1 && stats.snareCount >= 1 && stats.hihatCount >= 2;
  const nearBaseline = Math.abs(stats.density - refDensity) / Math.max(refDensity, 0.01) < 0.4;
  const grooveScore  = sigmoid((hasBackbone ? 1 : 0) * 1.5 + (nearBaseline ? 1 : 0) * 1.5 - 1.5);

  if (fillScore > 0.65 && fillScore > grooveScore * 1.2) {
    return { type: "fill", confidence: fillScore };
  }
  if (grooveScore > 0.55) {
    return { type: "groove", confidence: grooveScore };
  }

  // Transition: partial groove characteristics or isolated different measure
  return { type: "transition", confidence: Math.max(0.5, 1 - Math.max(fillScore, grooveScore)) };
};

// ─── Smoothing ────────────────────────────────────────────────────────────────

/** Convert isolated (1-measure) fills/breaks surrounded by groove to transitions. */
const smoothTypes = (stats: MeasureStats[]): void => {
  for (let i = 1; i < stats.length - 1; i++) {
    const prev = stats[i - 1].type;
    const curr = stats[i].type;
    const next = stats[i + 1].type;
    if ((curr === "fill" || curr === "break") && prev === "groove" && next === "groove") {
      stats[i].type       = "transition";
      stats[i].confidence = Math.max(0.5, stats[i].confidence * 0.6);
    }
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const detectFills = (project: ParsedDrumProject): MeasureStats[] => {
  const { hits, ppq, timeSignature } = project;
  if (hits.length === 0) return [];

  const ticksPerMeasure = ppq * timeSignature.numerator;
  const beats           = timeSignature.numerator;
  const maxTick         = hits.reduce((m, h) => Math.max(m, h.tick), 0);
  const totalMeasures   = Math.max(1, Math.ceil(maxTick / ticksPerMeasure));

  // Bucket hits into measures
  const buckets: DrumHit[][] = Array.from({ length: totalMeasures }, () => []);
  for (const hit of hits) {
    const mi = Math.min(totalMeasures - 1, Math.floor(hit.tick / ticksPerMeasure));
    buckets[mi].push(hit);
  }

  // Compute per-measure stats
  const allStats = buckets.map((mHits, i) => computeMeasureStats(mHits, i, ppq, beats));

  // Reference groove values (use median across all measures with hits)
  const nonEmpty = allStats.filter((s) => s.noteCount > 0);
  const refDensity = median(nonEmpty.map((s) => s.density));
  const refHihat   = median(nonEmpty.map((s) => s.hihatCount));
  const refTom     = median(nonEmpty.map((s) => s.tomCount));
  // Classify
  for (const stats of allStats) {
    const { type, confidence } = classifyMeasure(stats, refDensity, refHihat, refTom, 0, 0);
    stats.type       = type;
    stats.confidence = confidence;
  }

  smoothTypes(allStats);
  return allStats;
};
