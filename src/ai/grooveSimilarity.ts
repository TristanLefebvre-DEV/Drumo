/**
 * Groove Similarity & Human Feel Analysis
 *
 * Two responsibilities:
 *
 * 1. analyzeHumanFeel(hits, ppq, bpm)
 *    Quantifies the "human-ness" of a performance:
 *      - timingVariance  : micro-timing deviation from grid
 *      - dynamicRange    : velocity spread
 *      - swingRatio      : degree of swing/shuffle
 *      - humanness       : composite 0–1 score
 *
 * 2. compareGrooves(frameA, frameB)
 *    Computes cosine similarity between two GrooveFrames using TF.js tensors.
 *    Returns a SimilarityResult with per-voice scores.
 */

import * as tf from "@tensorflow/tfjs";
import type { DrumHit } from "../core/types";
import type { GrooveFrame, HumanFeelAnalysis, SimilarityResult } from "./types";

// ─── Human Feel ───────────────────────────────────────────────────────────────

/**
 * Measure timing deviation of hits relative to the nearest 16th-note grid.
 * Returns a 0–1 value: 0 = perfect grid, 1 = very loose.
 */
const timingVarianceScore = (hits: DrumHit[], ppq: number): number => {
  if (hits.length === 0) return 0;
  const stepTicks = ppq / 4; // 16th note
  const offsets = hits.map((h) => {
    const nearest = Math.round(h.tick / stepTicks) * stepTicks;
    return Math.abs(h.tick - nearest) / stepTicks; // normalized 0–0.5
  });
  const mean = offsets.reduce((s, v) => s + v, 0) / offsets.length;
  return Math.min(1, mean * 4); // scale so 0.25 offset → score 1
};

/** Velocity dynamic range: max − min, normalized. */
const dynamicRangeScore = (hits: DrumHit[]): number => {
  if (hits.length < 2) return 0;
  const vels = hits.map((h) => h.velocity);
  return Math.max(0, Math.min(1, Math.max(...vels) - Math.min(...vels)));
};

/**
 * Estimate swing ratio from hihat timing.
 * Compare positions of 8th-note off-beats relative to their expected position.
 * 0.5 = straight, 0.67 = full triplet swing.
 */
const estimateSwingRatio = (hits: DrumHit[], ppq: number, _bpm: number): number => {
  const hihatHits = hits
    .filter((h) => h.piece === "hihatClosed" || h.piece === "hihatOpen")
    .sort((a, b) => a.tick - b.tick);
  if (hihatHits.length < 4) return 0.5;

  const barTicks = ppq * 4;
  const stepTicks = ppq / 2; // 8th note

  let swingSum = 0; let count = 0;
  for (const hit of hihatHits) {
    const barTick = hit.tick % barTicks;
    const nearestEighth = Math.round(barTick / stepTicks) * stepTicks;
    // Off-beats only (odd 8th notes)
    if (Math.round(nearestEighth / stepTicks) % 2 !== 0) continue;
    const offset = barTick - nearestEighth;
    if (Math.abs(offset) > stepTicks * 0.4) continue;
    // Fraction of 8th note = where between the 8th and next it landed
    swingSum += 0.5 + (offset / stepTicks) * 0.5;
    count++;
  }
  return count > 1 ? Math.min(0.75, Math.max(0.5, swingSum / count)) : 0.5;
};

/** Composite human feel score. */
const humanness = (timing: number, dynamic: number, swing: number): number =>
  // All three contribute: tight groove is more human than robotic zero-variance
  Math.min(1, timing * 0.5 + dynamic * 0.3 + (Math.abs(swing - 0.5) / 0.25) * 0.2);

export const analyzeHumanFeel = (
  hits: DrumHit[],
  ppq: number,
  bpm: number
): HumanFeelAnalysis => {
  if (hits.length === 0) {
    return { humanness: 0, swingRatio: 0.5, dynamicRange: 0, timingVariance: 0 };
  }
  const timing  = timingVarianceScore(hits, ppq);
  const dynamic = dynamicRangeScore(hits);
  const swing   = estimateSwingRatio(hits, ppq, bpm);
  return {
    humanness:      parseFloat(humanness(timing, dynamic, swing).toFixed(3)),
    swingRatio:     parseFloat(swing.toFixed(3)),
    dynamicRange:   parseFloat(dynamic.toFixed(3)),
    timingVariance: parseFloat(timing.toFixed(3)),
  };
};

// ─── Groove Similarity ────────────────────────────────────────────────────────

/**
 * Cosine similarity between two 1D tensors.
 * Returns a scalar 0–1 (1 = identical direction).
 */
const cosineSim = (a: tf.Tensor1D, b: tf.Tensor1D): number => {
  const dot   = a.dot(b).dataSync()[0];
  const normA = a.norm().dataSync()[0];
  const normB = b.norm().dataSync()[0];
  if (normA < 1e-6 || normB < 1e-6) return 0;
  return Math.min(1, Math.max(0, dot / (normA * normB)));
};

/**
 * Compare two GrooveFrames.
 * Each voice is compared independently, then combined into an overall score.
 */
export const compareGrooves = (a: GrooveFrame, b: GrooveFrame): SimilarityResult => {
  return tf.tidy(() => {
    const aKick  = tf.tensor1d(a.kick);
    const bKick  = tf.tensor1d(b.kick);
    const aSnare = tf.tensor1d(a.snare);
    const bSnare = tf.tensor1d(b.snare);
    const aHihat = tf.tensor1d(a.hihat);
    const bHihat = tf.tensor1d(b.hihat);

    const kickSim  = cosineSim(aKick,  bKick);
    const snareSim = cosineSim(aSnare, bSnare);
    const hihatSim = cosineSim(aHihat, bHihat);

    // Weighted: kick and snare define groove identity more than hihat
    const overall = kickSim * 0.4 + snareSim * 0.4 + hihatSim * 0.2;

    return {
      score:           parseFloat(overall.toFixed(3)),
      kickSimilarity:  parseFloat(kickSim.toFixed(3)),
      snareSimilarity: parseFloat(snareSim.toFixed(3)),
      hihatSimilarity: parseFloat(hihatSim.toFixed(3)),
    } satisfies SimilarityResult;
  });
};
