/**
 * Rudiment Detector
 *
 * Analyses snare/tom hit sequences to identify classic drum rudiments.
 *
 * Detected rudiments:
 *   single-stroke-roll  –  R L R L … evenly spaced
 *   double-stroke-roll  –  R R L L … paired hits
 *   paradiddle          –  R L R R L R L L …
 *   flam                –  two hits < 40 ms apart
 *   drag                –  two grace notes + main hit
 *
 * Implementation uses a sliding-window pattern matcher on the ordered hit
 * sequence.  No ML model required; the pattern is deterministic and works
 * offline with zero model files.
 */

import type { DrumHit } from "../core/types";
import type { RudimentResult, RudimentType } from "./types";

// Grace note threshold: two hits < FLAM_THRESHOLD ticks apart = flam
const FLAM_THRESHOLD_TICKS = 60;   // ~30 ms at 120 BPM, ppq 480
const DRAG_THRESHOLD_TICKS  = 100; // ~50 ms

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract snare/tom hits sorted by tick (the "hand" voices). */
const handHits = (hits: DrumHit[]): DrumHit[] =>
  hits
    .filter((h) =>
      h.piece === "snare" ||
      h.piece === "snareRim" ||
      h.piece === "tomHigh" ||
      h.piece === "tomMid" ||
      h.piece === "tomLow"
    )
    .sort((a, b) => a.tick - b.tick);

/** Compute inter-onset intervals between consecutive hits. */
const intervals = (seq: DrumHit[]): number[] =>
  seq.slice(1).map((h, i) => h.tick - seq[i].tick);

/** Standard deviation of an array. */
const stdDev = (arr: number[]): number => {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
};

// ─── Rudiment detectors ────────────────────────────────────────────────────────

/** Flam: two hits very close together, second louder. */
const detectFlams = (seq: DrumHit[], ppq: number): RudimentResult[] => {
  const results: RudimentResult[] = [];
  const threshold = Math.round(FLAM_THRESHOLD_TICKS * ppq / 480);
  for (let i = 0; i < seq.length - 1; i++) {
    const gap = seq[i + 1].tick - seq[i].tick;
    if (gap > 0 && gap <= threshold) {
      const confidence = 1 - gap / threshold;
      results.push({
        type: "flam",
        confidence: Math.min(0.98, 0.7 + confidence * 0.28),
        startTick: seq[i].tick,
        endTick:   seq[i + 1].tick,
      });
      i++; // Skip the grace note
    }
  }
  return results;
};

/** Drag: two quick grace notes followed by main hit. */
const detectDrags = (seq: DrumHit[], ppq: number): RudimentResult[] => {
  const results: RudimentResult[] = [];
  const threshold = Math.round(DRAG_THRESHOLD_TICKS * ppq / 480);
  for (let i = 0; i < seq.length - 2; i++) {
    const g1 = seq[i + 1].tick - seq[i].tick;
    const g2 = seq[i + 2].tick - seq[i + 1].tick;
    const mainVel = seq[i + 2].velocity;
    const graceVel = (seq[i].velocity + seq[i + 1].velocity) / 2;
    if (g1 <= threshold && g2 <= threshold && mainVel > graceVel * 1.2) {
      results.push({
        type: "drag",
        confidence: 0.82,
        startTick: seq[i].tick,
        endTick:   seq[i + 2].tick,
      });
      i += 2;
    }
  }
  return results;
};

/** Single-stroke roll: alternating evenly spaced hits (min 4). */
const detectSingleStroke = (seq: DrumHit[], ppq: number): RudimentResult[] => {
  const results: RudimentResult[] = [];
  const minHits = 4;
  const maxJitter = ppq * 0.15; // 15% timing jitter allowed

  let i = 0;
  while (i <= seq.length - minHits) {
    // Collect a run of evenly spaced hits
    const runStart = i;
    const baseInterval = seq[i + 1].tick - seq[i].tick;
    if (baseInterval < 5) { i++; continue; }
    let j = i + 1;
    while (j < seq.length - 1) {
      const iv = seq[j + 1].tick - seq[j].tick;
      if (Math.abs(iv - baseInterval) > maxJitter) break;
      j++;
    }
    const runLength = j - runStart + 1;
    if (runLength >= minHits) {
      const runIntervals = intervals(seq.slice(runStart, j + 1));
      const sd = stdDev(runIntervals);
      const confidence = Math.min(0.97, 0.6 + (runLength / 12) * 0.3 - (sd / baseInterval) * 0.2);
      results.push({
        type: "single-stroke-roll",
        confidence,
        startTick: seq[runStart].tick,
        endTick:   seq[j].tick,
      });
      i = j + 1;
    } else {
      i++;
    }
  }
  return results;
};

/** Double-stroke roll: paired hits (R R L L …). */
const detectDoubleStroke = (seq: DrumHit[], ppq: number): RudimentResult[] => {
  const results: RudimentResult[] = [];
  const maxGraceGap = ppq * 0.3;
  const minPairs = 2;
  let i = 0;

  while (i <= seq.length - minPairs * 2) {
    // Detect a "pair": two hits close together
    const pairGap = seq[i + 1].tick - seq[i].tick;
    if (pairGap > maxGraceGap) { i++; continue; }

    let pairs = 1;
    let j = i + 2;
    while (j + 1 < seq.length) {
      const nextPairGap = seq[j + 1].tick - seq[j].tick;
      const betweenPairs = seq[j].tick - seq[i + 2 * (pairs - 1) + 1].tick;
      if (nextPairGap > maxGraceGap || Math.abs(betweenPairs - pairGap) > maxGraceGap) break;
      pairs++;
      j += 2;
    }
    if (pairs >= minPairs) {
      results.push({
        type: "double-stroke-roll",
        confidence: Math.min(0.95, 0.65 + pairs * 0.06),
        startTick: seq[i].tick,
        endTick:   seq[j - 1]?.tick ?? seq[i + pairs * 2 - 1].tick,
      });
      i = j;
    } else {
      i++;
    }
  }
  return results;
};

/**
 * Paradiddle: RLRR or LRLL repeating.
 * We look at velocity alternation pattern as a proxy for sticking.
 */
const detectParadiddle = (seq: DrumHit[], _ppq: number): RudimentResult[] => {
  const results: RudimentResult[] = [];
  if (seq.length < 8) return results;
  const baseInterval = intervals(seq.slice(0, 8)).reduce((s, v) => s + v, 0) / 7;
  const maxJitter = baseInterval * 0.2;
  let i = 0;

  while (i <= seq.length - 8) {
    // Check 8-note window for RLRR LRLL velocity signature
    // R = louder, L = softer (approximate)
    const chunk = seq.slice(i, i + 8);
    const chunkIntervals = intervals(chunk);
    const avgIv = chunkIntervals.reduce((s, v) => s + v, 0) / chunkIntervals.length;
    const sd = stdDev(chunkIntervals);
    if (sd > maxJitter || Math.abs(avgIv - baseInterval) > baseInterval * 0.3) { i++; continue; }

    // Velocity pattern: expect alternating with double accent (positions 2,6)
    const vels = chunk.map((h) => h.velocity);
    const accentAt = [2, 3, 6, 7];
    const accentScore = accentAt.reduce((s, p) => s + vels[p], 0) / 4;
    const nonAccentScore = [0,1,4,5].reduce((s, p) => s + vels[p], 0) / 4;
    if (accentScore > nonAccentScore * 1.05) {
      results.push({
        type: "paradiddle",
        confidence: Math.min(0.92, 0.6 + (accentScore - nonAccentScore) * 0.5),
        startTick: chunk[0].tick,
        endTick:   chunk[7].tick,
      });
      i += 8;
    } else {
      i++;
    }
  }
  return results;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect drum rudiments in a hit sequence.
 * Returns all detected occurrences with confidence scores.
 */
export const detectRudiments = (hits: DrumHit[], ppq: number): RudimentResult[] => {
  const seq = handHits(hits);
  if (seq.length < 3) return [];

  const all: RudimentResult[] = [
    ...detectFlams(seq, ppq),
    ...detectDrags(seq, ppq),
    ...detectDoubleStroke(seq, ppq),
    ...detectSingleStroke(seq, ppq),
    ...detectParadiddle(seq, ppq),
  ];

  // Sort by tick, return top 20 (display cap)
  return all
    .sort((a, b) => a.startTick - b.startTick)
    .slice(0, 20);
};

/** Human-readable label for a rudiment type. */
export const rudimentLabel: Record<RudimentType, string> = {
  "single-stroke-roll": "Single Stroke Roll",
  "double-stroke-roll": "Double Stroke Roll",
  "paradiddle":          "Paradiddle",
  "flam":                "Flam",
  "drag":                "Drag",
  "none":                "—",
};
