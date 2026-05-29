/**
 * Groove Embedding
 *
 * Converts a GrooveDNA into a TF.js 1D tensor (110-dim embedding) and
 * computes cosine-similarity scores against hand-crafted style prototypes.
 *
 * The prototypes encode idealized versions of each genre's characteristic
 * patterns.  When a real TF.js model is supplied via modelLoader, the
 * learned embedding supersedes these heuristic prototypes.
 *
 * Output: StyleSimilarityResult[] sorted by score descending.
 */

import * as tf from "@tensorflow/tfjs";
import { dnaToVector, type GrooveDNA } from "./grooveDNA";
import type { GrooveStyle } from "./types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StyleSimilarityResult {
  style:      GrooveStyle;
  score:      number;      // 0–1 cosine similarity
  label:      string;      // human-readable e.g. "Groove similaire à Rock"
  confidence: "high" | "medium" | "low";
}

// ─── Style prototype vectors ──────────────────────────────────────────────────
// Layout (110 dims):
//   [0-15]  kick  [16-31] snare [32-47] hihat [48-63] ride
//   [64-79] crash [80-95] toms
//   [96] bpmNorm [97] density [98] swingRatio [99] syncopation
//   [100] kickDom [101] snarePresence [102] cymbalDensity [103] tomUsage
//   [104] dynRange [105] ghostRatio [106] accentRatio
//   [107] kickBeat1 [108] snareBeat234 [109] polyrhythm

const grid = (steps: number[]): number[] => {
  const g = new Array(16).fill(0);
  for (const s of steps) g[s] = 0.8;
  return g;
};

const proto = (
  kick: number[], snare: number[], hihat: number[], ride: number[], crash: number[], toms: number[],
  globals: [number, number, number, number, number, number, number, number, number, number, number, number, number, number]
): number[] => [...kick, ...snare, ...hihat, ...ride, ...crash, ...toms, ...globals];

// Globals layout: bpmNorm, density, swing, sync, kickDom, snarePres, cymbalDens, tomUsage,
//                 dynRange, ghostRatio, accentRatio, kickBeat1, snareBeat234, polyrhythm

const STYLE_PROTOTYPES: Record<GrooveStyle, number[]> = {
  rock: proto(
    grid([0, 8]),           // kick: beats 1,3
    grid([4, 12]),          // snare: beats 2,4
    grid([0,2,4,6,8,10,12,14]), // hihat: 8th notes
    new Array(16).fill(0),  // ride: none
    [0.05,0,0,0, 0,0,0,0, 0,0,0,0, 0.05,0,0,0], // crash: downbeats
    new Array(16).fill(0),  // toms: none
    [0.65, 0.5, 0.5, 0.15, 0.30, 0.22, 0.50, 0.05, 0.55, 0.05, 0.08, 1, 1, 0.1]
  ),
  metal: proto(
    grid([0,2,4,6,8,10,12,14]), // kick: 8th notes or faster
    grid([4,12]),           // snare: 2,4
    new Array(16).fill(0.6),// hihat: 16th notes dense
    new Array(16).fill(0),
    [0.1,0,0,0,0,0,0,0,0,0,0,0,0.1,0,0,0],
    new Array(16).fill(0),
    [0.9, 0.75, 0.5, 0.20, 0.38, 0.22, 0.40, 0.08, 0.70, 0.03, 0.12, 1, 1, 0.2]
  ),
  "blast-beat": proto(
    new Array(16).fill(0.7),// kick: every 16th
    new Array(16).fill(0.7),// snare: every 16th
    new Array(16).fill(0.7),// hihat: every 16th
    new Array(16).fill(0),
    new Array(16).fill(0),
    new Array(16).fill(0),
    [1.0, 1.0, 0.5, 0.5, 0.33, 0.33, 0.33, 0.00, 0.60, 0.01, 0.05, 1, 1, 0.4]
  ),
  funk: proto(
    grid([0,3,7,10]),       // kick: syncopated
    grid([4,7,12]),         // snare: backbeat + ghost
    new Array(16).fill(0.5),// hihat: 16th dense
    new Array(16).fill(0),
    new Array(16).fill(0),
    new Array(16).fill(0),
    [0.6, 0.65, 0.5, 0.50, 0.20, 0.25, 0.52, 0.03, 0.70, 0.20, 0.15, 1, 1, 0.2]
  ),
  jazz: proto(
    grid([0,14]),           // kick: sparse
    new Array(16).fill(0.1),// snare: rim shots, sparse
    new Array(16).fill(0),  // hihat: foot on 2,4
    grid([0,2,4,6,8,10,12,14]), // ride: swing 8ths
    new Array(16).fill(0),
    new Array(16).fill(0),
    [0.4, 0.35, 0.62, 0.30, 0.12, 0.12, 0.58, 0.05, 0.65, 0.15, 0.10, 0, 0, 0.3]
  ),
  shuffle: proto(
    grid([0,8]),
    grid([4,12]),
    grid([0,2,4,6,8,10,12,14]),
    new Array(16).fill(0),
    new Array(16).fill(0),
    new Array(16).fill(0),
    [0.5, 0.45, 0.65, 0.10, 0.28, 0.22, 0.48, 0.03, 0.55, 0.08, 0.08, 1, 1, 0.1]
  ),
  halftime: proto(
    grid([0,6]),            // kick: beat 1 + offbeat
    grid([8]),              // snare: only beat 3
    grid([0,2,4,6,8,10,12,14]),
    new Array(16).fill(0),
    new Array(16).fill(0),
    new Array(16).fill(0),
    [0.55, 0.40, 0.5, 0.15, 0.28, 0.14, 0.52, 0.03, 0.55, 0.05, 0.07, 1, 0.3, 0.1]
  ),
  unknown: new Array(110).fill(0.1),
};

// ─── Cosine similarity ────────────────────────────────────────────────────────

const cosineSim = (a: tf.Tensor1D, b: tf.Tensor1D): number => {
  return tf.tidy(() => {
    const dot   = a.dot(b).dataSync()[0];
    const normA = a.norm().dataSync()[0];
    const normB = b.norm().dataSync()[0];
    return normA < 1e-6 || normB < 1e-6 ? 0 : Math.max(0, Math.min(1, dot / (normA * normB)));
  });
};

// ─── Public API ───────────────────────────────────────────────────────────────

const STYLE_LABELS: Record<GrooveStyle, string> = {
  rock:        "Rock",
  metal:       "Metal",
  "blast-beat": "Blast Beat",
  funk:        "Funk",
  jazz:        "Jazz",
  shuffle:     "Shuffle",
  halftime:    "Halftime",
  unknown:     "Inconnu",
};

/**
 * Compute similarity scores between a GrooveDNA and all known style prototypes.
 * Returns results sorted by score descending.
 */
export const computeStyleSimilarities = (dna: GrooveDNA): StyleSimilarityResult[] => {
  const vec     = dnaToVector(dna);
  const tensor  = tf.tensor1d(vec);
  const results: StyleSimilarityResult[] = [];

  for (const [style, protoVec] of Object.entries(STYLE_PROTOTYPES)) {
    if (style === "unknown") continue;
    const protoTensor = tf.tensor1d(protoVec);
    const score       = cosineSim(tensor, protoTensor);
    protoTensor.dispose();

    const label =
      score > 0.8 ? `Groove très proche de ${STYLE_LABELS[style as GrooveStyle]}` :
      score > 0.65 ? `Groove similaire à ${STYLE_LABELS[style as GrooveStyle]}` :
      score > 0.50 ? `Éléments de ${STYLE_LABELS[style as GrooveStyle]}` :
                     STYLE_LABELS[style as GrooveStyle];

    results.push({
      style: style as GrooveStyle,
      score: parseFloat(score.toFixed(3)),
      label,
      confidence: score > 0.75 ? "high" : score > 0.55 ? "medium" : "low",
    });
  }

  tensor.dispose();
  return results.sort((a, b) => b.score - a.score);
};

/** Return the top matching style. */
export const topStyleMatch = (dna: GrooveDNA): StyleSimilarityResult => {
  const results = computeStyleSimilarities(dna);
  return results[0] ?? { style: "unknown", score: 0, label: "Inconnu", confidence: "low" };
};
