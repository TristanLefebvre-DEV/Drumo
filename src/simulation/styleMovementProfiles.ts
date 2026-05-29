/**
 * Style Movement Profiles
 *
 * Describes how a drummer's body MOVES differently in each style.
 * Influences:
 *   - speed and aggression of movements
 *   - wrist tension (affects velocity curve)
 *   - foot activity level
 *   - how wide/compact the playing zone is
 *   - the "feel" label displayed in the visualizer
 */

import type { DrumStyle } from "../analysis/styleProfiles";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StyleMovementProfile {
  id:               DrumStyle;
  name:             string;
  /** 1.0 = normal. >1 = faster, more aggressive. <1 = slower, deliberate. */
  speedMultiplier:  number;
  /** 0 = relaxed Moeller/wrist. 1 = tight, full-arm strokes. */
  wristTension:     number;
  /** 0 = minimal feet. 1 = constant double-bass. */
  footActivity:     number;
  /** 0 = compact. 1 = expansive wide-range movements. */
  reachTendency:    number;
  /** Visual label for the dominant movement cycle. */
  cyclePattern:     string;
  /** Which instrument anchors movement (visualizer highlight). */
  primaryVoice:     DrumStyle extends string ? string : never;
  /** Short qualitative description for UI. */
  movementFeel:     string;
  /** Accent factor: how much louder accents are vs. ghost notes. */
  dynamicContrast:  number;   // 1.0–3.0
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export const STYLE_MOVEMENT_PROFILES: Record<DrumStyle, StyleMovementProfile> = {
  jazz: {
    id:               "jazz",
    name:             "Jazz",
    speedMultiplier:  0.80,
    wristTension:     0.15,
    footActivity:     0.12,
    reachTendency:    0.65,
    cyclePattern:     "Ride → Snare(brush) → Ride → HH(pedal)",
    primaryVoice:     "ride",
    movementFeel:     "Fluide et large — poignets souples, bras ouverts, centre de gravité sur le ride",
    dynamicContrast:  2.2,
  },
  funk: {
    id:               "funk",
    name:             "Funk",
    speedMultiplier:  0.90,
    wristTension:     0.35,
    footActivity:     0.48,
    reachTendency:    0.35,
    cyclePattern:     "HH → Ghost(SN) → HH → Kick(sync) → SN",
    primaryVoice:     "hihatClosed",
    movementFeel:     "Compact et précis — mains proches du centre, ghost notes omniprésents",
    dynamicContrast:  2.8,
  },
  rock: {
    id:               "rock",
    name:             "Rock",
    speedMultiplier:  1.00,
    wristTension:     0.60,
    footActivity:     0.42,
    reachTendency:    0.50,
    cyclePattern:     "HH → SN → HH → BD",
    primaryVoice:     "hihatClosed",
    movementFeel:     "Direct et puissant — frappes marquées, emphasis sur snare et kick",
    dynamicContrast:  1.8,
  },
  metal: {
    id:               "metal",
    name:             "Metal",
    speedMultiplier:  1.30,
    wristTension:     0.80,
    footActivity:     0.90,
    reachTendency:    0.70,
    cyclePattern:     "HH(16th dense) → Double BD → SN → Crash",
    primaryVoice:     "hihatClosed",
    movementFeel:     "Agressif et explosif — tension maximale, double pédale constante, crashes fréquents",
    dynamicContrast:  1.4,
  },
  electronic: {
    id:               "electronic",
    name:             "Electronic",
    speedMultiplier:  1.00,
    wristTension:     0.25,
    footActivity:     0.50,
    reachTendency:    0.28,
    cyclePattern:     "BD(quantisé) → SN → HH",
    primaryVoice:     "kick",
    movementFeel:     "Précis et mécanique — minimal, centré, dynamique uniforme",
    dynamicContrast:  1.2,
  },
  custom: {
    id:               "custom",
    name:             "Personnalisé",
    speedMultiplier:  1.00,
    wristTension:     0.50,
    footActivity:     0.40,
    reachTendency:    0.50,
    cyclePattern:     "Variable",
    primaryVoice:     "snare",
    movementFeel:     "Style libre",
    dynamicContrast:  1.8,
  },
};

export const ALL_MOVEMENT_PROFILES = Object.values(STYLE_MOVEMENT_PROFILES);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a humanization velocity factor [0.6–1.15] for a single hit,
 * based on style profile + hit type (ghost / accent / normal).
 */
export const styleVelocityFactor = (
  profile: StyleMovementProfile,
  isAccent: boolean,
  isGhost:  boolean
): number => {
  if (isGhost)  return 0.55 + (1 - profile.wristTension) * 0.25;
  if (isAccent) return 0.90 + profile.wristTension * 0.15;
  return 0.72 + (1 - profile.wristTension) * 0.22;
};

/** Returns the style that most closely matches an arbitrary movement speed multiplier. */
export const matchStyleBySpeed = (speedMultiplier: number): DrumStyle => {
  let best: DrumStyle = "rock";
  let minDiff = Infinity;
  for (const p of ALL_MOVEMENT_PROFILES) {
    const diff = Math.abs(p.speedMultiplier - speedMultiplier);
    if (diff < minDiff) { minDiff = diff; best = p.id; }
  }
  return best;
};
