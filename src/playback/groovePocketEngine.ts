/**
 * Groove Pocket Engine
 *
 * Defines the natural timing "pocket" of each instrument in each drumming
 * style — i.e., how many milliseconds behind or ahead of the grid beat
 * a real drummer naturally places each instrument.
 *
 * These are NOT random values.  They're derived from the characteristic feel
 * of each style (backed by groove analysis research):
 *
 *   Jazz:   kick/snare "behind the beat" (−10 to −14 ms)
 *   Punk:   everything "ahead" (+5 to +8 ms) — rushing excitement
 *   Funk:   kick on the grid, snare slightly ahead, hi-hat slightly behind
 *   Rock:   moderately behind (−3 to −6 ms)
 *   Metal:  nearly grid-tight, slight rush on hi-hat
 *
 * Units: milliseconds.  Negative = late, Positive = early.
 */

import type { DrumPiece } from "../core/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PocketMap = Record<DrumPiece, number>;

export interface PocketProfile {
  pocketMs:       PocketMap;   // base timing offset per instrument (ms)
  microVariance:  number;      // max stochastic micro-variation (ms)
  fatigueMs:      number;      // drift added per measure (accumulates, ms)
  accentAnticMs:  number;      // how many ms earlier accents arrive
  ghostDragMs:    number;      // how many ms later ghost notes arrive
}

// ─── Pocket maps ──────────────────────────────────────────────────────────────

// Jazz: behind the beat — ride/hihat lag, snare especially behind
const JAZZ_POCKET: PocketMap = {
  kick:        -11, snare: -9, snareRim: -8,
  hihatClosed: -7,  hihatOpen: -7, hihatPedal: -5,
  tomHigh:     -8,  tomMid: -8, tomLow: -7,
  crash:       -3,  ride: -13, splash: -5, otherCymbal: -7,
};

// Funk: kick on time, snare pushes slightly, hi-hat lags a touch
const FUNK_POCKET: PocketMap = {
  kick:          0, snare: +3, snareRim: +2,
  hihatClosed:  -3, hihatOpen: -4, hihatPedal: 0,
  tomHigh:      -1, tomMid: -1, tomLow: 0,
  crash:        -1, ride: -2, splash: -1, otherCymbal: -1,
};

// Rock: comfortable behind, snare most behind
const ROCK_POCKET: PocketMap = {
  kick:         -4, snare: -6, snareRim: -5,
  hihatClosed:  -3, hihatOpen: -3, hihatPedal: -2,
  tomHigh:      -3, tomMid: -3, tomLow: -2,
  crash:        -1, ride: -3, splash: -2, otherCymbal: -2,
};

// Metal: tight, hi-hat slightly ahead (double-bass machine precision)
const METAL_POCKET: PocketMap = {
  kick:         +1, snare: -1, snareRim: -1,
  hihatClosed:  +2, hihatOpen: +1, hihatPedal: 0,
  tomHigh:      -1, tomMid: -1, tomLow: -1,
  crash:         0, ride: +1, splash: 0, otherCymbal: 0,
};

// Neutral: minimal offsets (studio tight)
const STUDIO_POCKET: PocketMap = {
  kick:         -2, snare: -3, snareRim: -2,
  hihatClosed:  -2, hihatOpen: -2, hihatPedal: -1,
  tomHigh:      -2, tomMid: -2, tomLow: -1,
  crash:        -1, ride: -2, splash: -1, otherCymbal: -1,
};

// ─── Style → pocket ───────────────────────────────────────────────────────────

export const POCKET_PROFILES: Record<string, PocketProfile> = {
  "tight-studio": {
    pocketMs:      STUDIO_POCKET,
    microVariance: 1.5,
    fatigueMs:     0.0,
    accentAnticMs: 0.5,
    ghostDragMs:   0.8,
  },
  "loose-jazz": {
    pocketMs:      JAZZ_POCKET,
    microVariance: 4.5,
    fatigueMs:     0.08,
    accentAnticMs: 2.0,
    ghostDragMs:   3.0,
  },
  "aggressive-metal": {
    pocketMs:      METAL_POCKET,
    microVariance: 0.8,
    fatigueMs:     0.0,
    accentAnticMs: 0.3,
    ghostDragMs:   0.5,
  },
  "funk-pocket": {
    pocketMs:      FUNK_POCKET,
    microVariance: 3.0,
    fatigueMs:     0.04,
    accentAnticMs: 1.5,
    ghostDragMs:   2.5,
  },
  "vintage-human": {
    pocketMs:      scalePocket(ROCK_POCKET, 1.6),
    microVariance: 6.0,
    fatigueMs:     0.12,
    accentAnticMs: 2.5,
    ghostDragMs:   4.0,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scalePocket(pocket: PocketMap, factor: number): PocketMap {
  return Object.fromEntries(
    Object.entries(pocket).map(([k, v]) => [k, v * factor])
  ) as PocketMap;
}

/** Scale all offsets by a humanize amount factor (0–1). */
export const scaledPocket = (profile: PocketProfile, amount: number): PocketMap =>
  scalePocket(profile.pocketMs, amount);

/** Get pocket offset for a specific piece (ms). */
export const getPocketMs = (
  pocket: PocketMap,
  piece: DrumPiece
): number => pocket[piece] ?? 0;

// Expose scaled versions for display in the UI (pocket visualization)
export const DISPLAY_PIECES: DrumPiece[] = [
  "kick", "snare", "hihatClosed", "ride", "crash", "tomLow",
];
