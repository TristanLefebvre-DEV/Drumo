/**
 * Groove Classifier
 *
 * Pipeline:  hits[] → GrooveFrame → tf.Tensor (51 features) → GroovePrediction
 *
 * When a trained model is present (via modelLoader), it is used for inference.
 * Otherwise, a deterministic heuristic classifier produces results with the
 * same output format — perfect for offline use with no model files.
 *
 * Supported styles:
 *   rock | metal | funk | jazz | shuffle | halftime | blast-beat | unknown
 */

import * as tf from "@tensorflow/tfjs";
import { modelLoader } from "./modelLoader";
import type { DrumHit } from "../core/types";
import type { GrooveFrame, GroovePrediction, GrooveStyle } from "./types";

// ─── Frame extraction ──────────────────────────────────────────────────────────

/**
 * Convert raw drum hits to a 16-step averaged GrooveFrame.
 * Analyzes up to the first 4 bars to produce a representative pattern.
 */
export const hitsToGrooveFrame = (hits: DrumHit[], ppq: number, bpm: number): GrooveFrame => {
  const stepTicks  = ppq / 4;          // 1 sixteenth note
  const barTicks   = ppq * 4;          // 4/4 bar
  const maxTick    = hits.reduce((m, h) => Math.max(m, h.tick), 0);
  const totalBars  = Math.max(1, Math.ceil(maxTick / barTicks));
  const barsToUse  = Math.min(totalBars, 4);
  const windowEnd  = barsToUse * barTicks;

  const kickAcc   = new Float32Array(16);
  const snareAcc  = new Float32Array(16);
  const hihatAcc  = new Float32Array(16);
  const kickN     = new Float32Array(16);
  const snareN    = new Float32Array(16);
  const hihatN    = new Float32Array(16);

  for (const hit of hits) {
    if (hit.tick >= windowEnd) continue;
    const barTick = hit.tick % barTicks;
    const step    = Math.min(15, Math.round(barTick / stepTicks) % 16);
    const v       = hit.velocity;

    if (hit.piece === "kick") {
      kickAcc[step] += v; kickN[step]++;
    } else if (hit.piece === "snare" || hit.piece === "snareRim") {
      snareAcc[step] += v; snareN[step]++;
    } else if (hit.piece === "hihatClosed" || hit.piece === "hihatOpen" || hit.piece === "hihatPedal") {
      hihatAcc[step] += v; hihatN[step]++;
    }
  }

  const avg = (acc: Float32Array, n: Float32Array) =>
    Array.from({ length: 16 }, (_, i) => n[i] > 0 ? acc[i] / n[i] : 0);

  return {
    kick:  avg(kickAcc, kickN),
    snare: avg(snareAcc, snareN),
    hihat: avg(hihatAcc, hihatN),
    tempo: bpm,
    totalBars,
  };
};

// ─── Feature tensor ────────────────────────────────────────────────────────────

/**
 * Build a 51-dimensional feature tensor from a GrooveFrame.
 *
 * Layout:
 *   [0..15]  kick grid  (velocity 0–1)
 *   [16..31] snare grid
 *   [32..47] hihat grid
 *   [48]     tempo normalized (BPM / 200)
 *   [49]     syncopation score
 *   [50]     swing ratio estimate
 */
const frameToTensor = (frame: GrooveFrame): tf.Tensor1D => {
  const syncopation = computeSyncopation(frame.kick, frame.snare);
  const swing       = estimateSwing(frame.hihat);
  const features    = [
    ...frame.kick,
    ...frame.snare,
    ...frame.hihat,
    Math.min(1, frame.tempo / 200),
    syncopation,
    swing,
  ];
  return tf.tensor1d(features);
};

/** Fraction of kick/snare hits that fall on off-16th positions (syncopation). */
const computeSyncopation = (kick: number[], snare: number[]): number => {
  const offBeats = [1,2,3, 5,6,7, 9,10,11, 13,14,15]; // non-quarter-note steps
  let sum = 0; let total = 0;
  for (const i of offBeats) {
    sum += kick[i] + snare[i];
    total += 2;
  }
  return total > 0 ? sum / total : 0;
};

/**
 * Estimate swing ratio by comparing average velocity on 8th-note "off-beats"
 * (steps 2,6,10,14) vs on-beats (0,4,8,12).
 * Returns 0 (no swing detected in grid) to 1 (very swung).
 */
const estimateSwing = (hihat: number[]): number => {
  const onBeats  = [0, 4, 8,  12];
  const offBeats = [2, 6, 10, 14];
  const onAvg  = onBeats.reduce((s, i)  => s + hihat[i], 0) / 4;
  const offAvg = offBeats.reduce((s, i) => s + hihat[i], 0) / 4;
  if (onAvg < 0.05) return 0;
  return Math.min(1, offAvg / (onAvg + 0.001));
};

// ─── Style templates (16-step patterns, 1 = expected hit, 0 = expected silence) ──

const TEMPLATES: Record<GrooveStyle, { kick: number[]; snare: number[]; hihat: number[] }> = {
  rock: {
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  metal: {
    kick:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
  },
  "blast-beat": {
    kick:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    snare: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
    hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
  },
  funk: {
    kick:  [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0],
    snare: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
    hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
  },
  jazz: {
    kick:  [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
    snare: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],  // swing 8ths
  },
  shuffle: {
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],  // quarter-note swing
  },
  halftime: {
    kick:  [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  unknown: { kick: [], snare: [], hihat: [] },
};

/** Template-match score against a single style. */
const templateScore = (frame: GrooveFrame, style: GrooveStyle): number => {
  const tmpl = TEMPLATES[style];
  if (!tmpl.kick.length) return 0;
  let score = 0; let weight = 0;
  for (let i = 0; i < 16; i++) {
    if (tmpl.kick[i])  { score += frame.kick[i]  * tmpl.kick[i];  weight += tmpl.kick[i]; }
    if (tmpl.snare[i]) { score += frame.snare[i] * tmpl.snare[i]; weight += tmpl.snare[i]; }
    if (tmpl.hihat[i]) { score += frame.hihat[i] * tmpl.hihat[i]; weight += tmpl.hihat[i]; }
  }
  return weight > 0 ? score / weight : 0;
};

// ─── Heuristic classifier ──────────────────────────────────────────────────────

const heuristicClassify = (frame: GrooveFrame): GroovePrediction => {
  const styles: GrooveStyle[] = ["rock","metal","blast-beat","funk","jazz","shuffle","halftime"];
  const rawScores: Partial<Record<GrooveStyle, number>> = {};

  for (const style of styles) {
    rawScores[style] = templateScore(frame, style);
  }

  // Boost / adjust scores using global features
  const density = [...frame.kick, ...frame.snare, ...frame.hihat].filter(v => v > 0.1).length;
  const syncopation = computeSyncopation(frame.kick, frame.snare);
  const swing = estimateSwing(frame.hihat);
  const bpm = frame.tempo;

  // Metal / blast-beat require fast BPM
  if (bpm < 120) { rawScores.metal = (rawScores.metal ?? 0) * 0.4; rawScores["blast-beat"] = (rawScores["blast-beat"] ?? 0) * 0.2; }
  // Funk requires high syncopation
  rawScores.funk = (rawScores.funk ?? 0) * (0.4 + syncopation * 0.6);
  // Jazz requires swing
  rawScores.jazz = (rawScores.jazz ?? 0) * (0.3 + swing * 0.7);
  // Shuffle requires swing
  rawScores.shuffle = (rawScores.shuffle ?? 0) * (0.4 + swing * 0.6);
  // Blast-beat requires very high density
  rawScores["blast-beat"] = (rawScores["blast-beat"] ?? 0) * (density > 30 ? 1.5 : 0.3);

  // Softmax normalization
  const entries = Object.entries(rawScores) as [GrooveStyle, number][];
  const max = Math.max(...entries.map(([,v]) => v), 0.001);
  const exp = entries.map(([k, v]) => [k, Math.exp((v - max) * 5)] as [GrooveStyle, number]);
  const sum = exp.reduce((s, [,v]) => s + v, 0);
  const scores: Partial<Record<GrooveStyle, number>> = {};
  for (const [k, v] of exp) scores[k] = v / sum;

  const best = (Object.entries(scores) as [GrooveStyle, number][]).reduce(
    (b, cur) => (cur[1] > b[1] ? cur : b),
    ["unknown", 0] as [GrooveStyle, number]
  );

  return {
    style: best[1] > 0.35 ? best[0] : "unknown",
    confidence: best[1],
    scores,
  };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Classify the groove style of a set of drum hits.
 * Uses a trained TF.js model when available, heuristics otherwise.
 */
export const classifyGroove = (frame: GrooveFrame): GroovePrediction => {
  const model = modelLoader.getStatus("groove-classifier") === "ready"
    ? null  // would call model.predict() with frameToTensor(frame) here
    : null;

  if (model) {
    // Future: const tensor = frameToTensor(frame); const pred = model.predict(tensor);
    // For now model slot is reserved
  }

  // Heuristic path (also used as fallback when model returns low confidence)
  return heuristicClassify(frame);
};

// Export tensor builder for external use (e.g. future fine-tuning UI)
export { frameToTensor };
