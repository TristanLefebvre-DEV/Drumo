/**
 * Ergonomic Rules
 *
 * Physical model of a standard right-handed drum kit:
 *
 *   Far-left          Left     Centre    Right-near   Right-far
 *   crash(L)  ←  hi-hat    snare    ride/crash(R)   —
 *                           kick(RF)
 *                hihatPedal(LF)
 *                           hi-tom   mid-tom   floor-tom
 *
 * These rules define:
 *   - The natural limb for each instrument (NATURAL_LIMB)
 *   - Whether alternation is possible (CAN_ALTERNATE)
 *   - The physical side of the kit (INSTRUMENT_SIDE)
 *   - What constitutes a crossover (arms crossing each other)
 */

import type { DrumPiece } from "../core/types";

export type Limb = "RH" | "LH" | "RF" | "LF";

/** Physical position of each instrument on a standard right-handed kit. */
export type InstrumentSide = "far-left" | "left" | "center" | "right" | "far-right";

export const INSTRUMENT_SIDE: Record<DrumPiece, InstrumentSide> = {
  crash:       "far-left",   // left-side crash (e.g. 16")
  hihatClosed: "left",       // hi-hat on the left
  hihatOpen:   "left",
  hihatPedal:  "left",       // pedal = left foot (positioned left)
  snare:       "center",
  snareRim:    "center",
  kick:        "center",
  tomHigh:     "center",     // rack tom 1 — near centre
  tomMid:      "right",      // rack tom 2 — right of centre
  tomLow:      "far-right",  // floor tom — far right
  ride:        "right",      // ride cymbal — right side
  splash:      "right",      // splash — typically right
  otherCymbal: "right",
};

const SIDE_RANK: Record<InstrumentSide, number> = {
  "far-left": 0, left: 1, center: 2, right: 3, "far-right": 4,
};

/** Numeric distance between two instruments (0 = same position, 4 = max). */
export const physicalDistance = (a: DrumPiece, b: DrumPiece): number =>
  Math.abs(SIDE_RANK[INSTRUMENT_SIDE[a]] - SIDE_RANK[INSTRUMENT_SIDE[b]]);

// ─── Natural limb assignments (standard right-handed setup) ───────────────────

export const NATURAL_LIMB: Record<DrumPiece, Limb> = {
  kick:        "RF",   // right foot — pedal
  hihatPedal:  "LF",   // left foot — pedal
  hihatClosed: "RH",   // right hand crosses over to left side (standard crossover)
  hihatOpen:   "RH",
  snare:       "LH",   // left hand on snare
  snareRim:    "LH",
  tomHigh:     "RH",   // right hand leads into rack tom from hi-hat
  tomMid:      "LH",   // left hand continues across from snare
  tomLow:      "RH",   // right hand on floor tom
  crash:       "LH",   // left-side crash → left hand
  ride:        "RH",   // right hand on ride
  splash:      "RH",   // splash — right hand (often near ride)
  otherCymbal: "RH",
};

/** Alternate limb when natural is unavailable or alternation is required. */
export const ALTERNATE_LIMB: Partial<Record<DrumPiece, Limb>> = {
  hihatClosed: "LH",   // open-handed style
  hihatOpen:   "LH",
  snare:       "RH",   // right hand if left is on hi-hat
  snareRim:    "RH",
  crash:       "RH",   // right-side crash
  tomHigh:     "LH",
  tomMid:      "RH",
  tomLow:      "LH",
  splash:      "LH",
  otherCymbal: "LH",
};

/** Whether this instrument can realistically be played by either hand. */
export const CAN_ALTERNATE: Record<DrumPiece, boolean> = {
  kick:        false,
  hihatPedal:  false,
  ride:        false,   // almost always right hand
  hihatClosed: true,
  hihatOpen:   true,
  snare:       true,
  snareRim:    true,
  tomHigh:     true,
  tomMid:      true,
  tomLow:      true,
  crash:       true,
  splash:      true,
  otherCymbal: true,
};

/** True for pedal instruments (feet only). */
export const IS_FOOT: Record<DrumPiece, boolean> = {
  kick: true, hihatPedal: true,
  hihatClosed: false, hihatOpen: false, snare: false, snareRim: false,
  tomHigh: false, tomMid: false, tomLow: false,
  crash: false, ride: false, splash: false, otherCymbal: false,
};

/**
 * A crossover occurs when:
 *   RH plays a left-side instrument (right arm crosses over left arm), or
 *   LH plays a right-side instrument.
 * The most common is RH on hi-hat while LH is on snare.
 */
export const isCrossover = (limb: Limb, piece: DrumPiece): boolean => {
  const side = INSTRUMENT_SIDE[piece];
  if (limb === "RH") return side === "far-left" || side === "left";
  if (limb === "LH") return side === "far-right" || side === "right";
  return false;
};

// ─── Mode-based thresholds ────────────────────────────────────────────────────

export type StickingMode = "strict" | "human" | "advanced";

/**
 * Threshold (ms) below which consecutive hits on the same instrument
 * trigger mandatory alternation.
 */
export const ALTERNATION_THRESHOLD_MS: Record<StickingMode, number> = {
  strict:   120,   // tight — forces alternation at 8th notes ~100 BPM+
  human:    240,   // natural — alternates at 16th notes
  advanced: 480,   // relaxed — allows repeated strokes at moderate speed
};

/** Pedagogical explanation text for each limb. */
export const LIMB_DESCRIPTION: Record<Limb, string> = {
  RH: "Main droite",
  LH: "Main gauche",
  RF: "Pied droit",
  LF: "Pied gauche",
};

/** Tailwind/CSS colour tokens per limb. */
export const LIMB_COLOR: Record<Limb, { bg: string; text: string; hex: string }> = {
  RH: { bg: "bg-blue-500/80",   text: "text-blue-300",   hex: "#3b82f6" },
  LH: { bg: "bg-green-500/80",  text: "text-green-300",  hex: "#22c55e" },
  RF: { bg: "bg-orange-500/80", text: "text-orange-300", hex: "#f97316" },
  LF: { bg: "bg-red-500/80",    text: "text-red-300",    hex: "#ef4444" },
};
