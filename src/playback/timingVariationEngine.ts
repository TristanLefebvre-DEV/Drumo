/**
 * Timing Variation Engine
 *
 * Computes per-hit timing offsets and velocity scales using DETERMINISTIC
 * algorithms — no Math.random().
 *
 * "Human feel" comes from:
 *   1. Instrument pocket position (style-specific lag/rush)
 *   2. Beat subdivision influence (upbeats can rush, downbeats anchor)
 *   3. Accent anticipation / ghost drag (physics of hitting harder/softer)
 *   4. Micro-variation via a hash of the hit's tick + piece (stable per hit)
 *   5. Gradual fatigue drift (slight timing drift as measures progress)
 *   6. Swing (8th-note grid swing / shuffle)
 *
 * The same MIDI file always produces the same humanized output —
 * reproducible and predictable, like a real drummer's consistent tendencies.
 */

import type { DrumHit } from "../core/types";
import type { PocketProfile, PocketMap } from "./groovePocketEngine";
import { getPocketMs } from "./groovePocketEngine";

// ─── Deterministic hash ───────────────────────────────────────────────────────

/**
 * Maps a hit to a stable value in [−1, 1] using integer arithmetic only.
 * The `seed` parameter lets us get different values from the same hit for
 * timing vs velocity variation.
 */
export const hitHash = (hit: DrumHit, seed = 0): number => {
  const pieceVal = hit.piece.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const h        = (((hit.tick + seed * 1000) * 2654435761 + pieceVal * 1234567891) >>> 0);
  return (h / 2147483648) - 1;  // range [−1, 1]
};

// ─── Beat position influence ──────────────────────────────────────────────────

/**
 * Computes a small timing modifier based on WHERE in the beat a note falls.
 * Notes exactly ON the beat get 0.  Notes in the middle of the beat (upbeats)
 * can get a slight rush or drag.
 *
 * beatPos: 0.0 = downbeat, 0.5 = upbeat ("and"), 0.25/"0.75 = e/a subdivisions.
 */
const beatPositionInfluenceMs = (beatPos: number, maxMs: number): number =>
  // sin wave: 0 at beat (0/1), peak at 0.5 upbeat
  Math.sin(beatPos * Math.PI) * maxMs;

// ─── Swing ────────────────────────────────────────────────────────────────────

/**
 * Computes the swing offset in ms for a hit.
 * Swing only applies to 8th-note "and" positions.
 *
 * swingAmount: 0 = straight, 1 = full triplet feel (67%)
 * At full swing, the "and" is delayed by ppq/6 ticks (= 1/6 of a beat).
 */
export const computeSwingOffsetMs = (
  hit:         DrumHit,
  ppq:         number,
  bpm:         number,
  swingAmount: number   // 0–1
): number => {
  if (swingAmount < 0.01) return 0;

  const tickInBeat   = hit.tick % ppq;
  const halfBeat     = ppq / 2;
  const tolerance    = ppq * 0.1;   // 10% tolerance for quantized hits

  const isAndPos = Math.abs(tickInBeat - halfBeat) < tolerance;
  if (!isAndPos) return 0;

  // Delay the "and" by up to 1/6 of a beat (= ppq/6 ticks → converted to ms)
  const swingTicks  = (ppq / 6) * swingAmount;
  const msPerTick   = 60000 / (bpm * ppq);
  return swingTicks * msPerTick;
};

// ─── Main timing computation ──────────────────────────────────────────────────

export interface TimingContext {
  ppq:         number;
  bpm:         number;
  numerator:   number;   // time signature beats per measure
}

/**
 * Returns the total timing offset in ms for a hit.
 * Positive = played LATE (behind the beat).
 * Negative = played EARLY (ahead of the beat).
 *
 * amount:    0–1 (the main humanize slider)
 * swingAmt:  0–1 (swing slider)
 */
export const computeTimingOffsetMs = (
  hit:      DrumHit,
  pocket:   PocketMap,
  profile:  PocketProfile,
  ctx:      TimingContext,
  amount:   number,
  swingAmt: number
): number => {
  const { ppq, bpm, numerator } = ctx;

  // 1. Base pocket (instrument characteristic offset)
  const basePocket  = getPocketMs(pocket, hit.piece) * amount;

  // 2. Beat position influence (upbeats are looser)
  const beatPos     = (hit.tick % ppq) / ppq;
  const beatInfl    = beatPositionInfluenceMs(beatPos, 1.5 * amount);

  // 3. Accent anticipation / ghost drag
  const articulationOffset = hit.isAccent
    ? -profile.accentAnticMs * amount          // accents arrive early (hit harder = rush)
    : hit.isGhost
    ? +profile.ghostDragMs  * amount           // ghosts arrive slightly late (lazy)
    : 0;

  // 4. Micro-variation (deterministic, based on hit hash)
  const micro       = hitHash(hit, 0) * profile.microVariance * amount;

  // 5. Gradual fatigue drift (measures pass → timing drifts slightly)
  const measureIdx  = Math.floor(hit.tick / (ppq * numerator));
  const fatigue     = Math.min(measureIdx * profile.fatigueMs, 8) * amount;

  // 6. Swing offset (8th-note and-positions only)
  const swing       = computeSwingOffsetMs(hit, ppq, bpm, swingAmt);

  return basePocket + beatInfl + articulationOffset + micro + fatigue + swing;
};

// ─── Velocity computation ─────────────────────────────────────────────────────

/**
 * Returns a velocity multiplier for a hit (applied after kit curve processor).
 *
 * velAmount: 0–1 (velocity sub-slider, separate from timing)
 */
export const computeVelocityScale = (
  hit:       DrumHit,
  ppq:       number,
  numerator: number,
  velAmount: number
): number => {
  if (velAmount < 0.01) return 1.0;

  const beatPos     = (hit.tick % ppq) / ppq;

  // Beat 1 of every measure gets a subtle accent boost
  const tickInMeasure = hit.tick % (ppq * numerator);
  const isBeat1 = tickInMeasure < ppq * 0.08;
  const beat1Boost = isBeat1 ? 0.04 * velAmount : 0;

  // Accent/ghost influence
  const artFactor = hit.isAccent
    ? 1.0 + 0.07 * velAmount
    : hit.isGhost
    ? 1.0 - 0.14 * velAmount
    : 1.0;

  // Beat position: upbeats slightly softer
  const beatPosFactor = 1.0 - Math.sin(beatPos * Math.PI) * 0.04 * velAmount;

  // Deterministic micro-variation
  const microVel  = hitHash(hit, 1) * 0.05 * velAmount;  // ±5% max

  return Math.max(0.1, artFactor * beatPosFactor * (1.0 + beat1Boost + microVel));
};

// ─── ms → ticks conversion ───────────────────────────────────────────────────

export const msToTicks = (ms: number, ppq: number, bpm: number): number =>
  ms * ppq * bpm / 60000;
