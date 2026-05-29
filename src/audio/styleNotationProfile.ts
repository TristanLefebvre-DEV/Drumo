/**
 * StyleNotationProfile — how a drum kit style influences notation & playback display.
 *
 * The MIDI pattern never changes. These profiles adjust how the score
 * is rendered, quantized, and visualized based on the selected kit style.
 */

import type { DrumKitId } from "./drumKitManager";
import type { QuantizeGrid } from "../core/types";

export interface StyleNotationProfile {
  kitId: DrumKitId;

  /** Recommended quantize grid for this style */
  recommendedGrid: QuantizeGrid;

  /** How strictly to quantize (0=loose/preserve groove, 1=strict/snap to grid) */
  quantizationStrictness: number;

  /** Swing amount to add (0–0.25, matches QuantizeOptions.swing range) */
  swingAmount: number;

  /** Whether ride cymbal notation should be prioritized over hi-hat */
  ridePriority: boolean;

  /** Whether to highlight double kick patterns more prominently */
  doubleKickEmphasis: boolean;

  /** Ghost note display threshold — velocities below this are styled as ghosts */
  ghostNoteThreshold: number;

  /** Whether to use cross-stick notation for snare rim hits */
  useRimNotation: boolean;

  /** Stem direction preference: "up" / "down" / "auto" */
  stemDirection: "up" | "down" | "auto";

  /** Extra horizontal spacing multiplier (1.0 = normal) */
  spacingMultiplier: number;

  /** Human-readable tips shown in the UI */
  notationTips: string[];
}

export const STYLE_NOTATION_PROFILES: Record<DrumKitId, StyleNotationProfile> = {
  rock: {
    kitId: "rock",
    recommendedGrid: "1/8",
    quantizationStrictness: 0.75,
    swingAmount: 0.0,
    ridePriority: false,
    doubleKickEmphasis: false,
    ghostNoteThreshold: 0.38,
    useRimNotation: true,
    stemDirection: "auto",
    spacingMultiplier: 1.0,
    notationTips: [
      "Hi-hat en croches (1/8) — pattern classique rock",
      "Kick sur temps 1 et 3, snare sur 2 et 4",
      "Accents de crash sur les temps forts",
    ],
  },

  metal: {
    kitId: "metal",
    recommendedGrid: "1/16",
    quantizationStrictness: 0.95,
    swingAmount: 0.0,
    ridePriority: false,
    doubleKickEmphasis: true,
    ghostNoteThreshold: 0.30,
    useRimNotation: false,
    stemDirection: "down",
    spacingMultiplier: 0.88,
    notationTips: [
      "Double kick en doubles croches — quantize strict",
      "Hi-hat en 16th notes dense",
      "Toms avec fills complexes",
    ],
  },

  jazz: {
    kitId: "jazz",
    recommendedGrid: "1/8",
    quantizationStrictness: 0.35,
    swingAmount: 0.18,
    ridePriority: true,
    doubleKickEmphasis: false,
    ghostNoteThreshold: 0.45,
    useRimNotation: true,
    stemDirection: "auto",
    spacingMultiplier: 1.12,
    notationTips: [
      "Ride swing prioritaire — laisse le groove respirer",
      "Quantization loose pour garder le feel humain",
      "Hi-hat subtil, kick très léger",
    ],
  },

  funk: {
    kitId: "funk",
    recommendedGrid: "1/16",
    quantizationStrictness: 0.55,
    swingAmount: 0.08,
    ridePriority: false,
    doubleKickEmphasis: false,
    ghostNoteThreshold: 0.32,
    useRimNotation: true,
    stemDirection: "auto",
    spacingMultiplier: 1.05,
    notationTips: [
      "Ghost notes mis en avant — vélocité subtile",
      "Kick syncopé avec groove 16th",
      "Snare très dynamique (ghost → accent)",
    ],
  },

  electronic: {
    kitId: "electronic",
    recommendedGrid: "1/16",
    quantizationStrictness: 1.0,
    swingAmount: 0.0,
    ridePriority: false,
    doubleKickEmphasis: false,
    ghostNoteThreshold: 0.25,
    useRimNotation: false,
    stemDirection: "down",
    spacingMultiplier: 0.95,
    notationTips: [
      "Quantize parfait — pas de groove humain",
      "Vélocités uniformes pour look EDM",
      "Cymbales rares, kick/clap dominants",
    ],
  },

  lofi: {
    kitId: "lofi",
    recommendedGrid: "1/8",
    quantizationStrictness: 0.30,
    swingAmount: 0.12,
    ridePriority: false,
    doubleKickEmphasis: false,
    ghostNoteThreshold: 0.40,
    useRimNotation: true,
    stemDirection: "auto",
    spacingMultiplier: 1.08,
    notationTips: [
      "Feel relâché — imperfections volontaires",
      "Swing léger pour le groove bedroom",
      "Vélocités douces et variées",
    ],
  },

  studio: {
    kitId: "studio",
    recommendedGrid: "1/16",
    quantizationStrictness: 0.70,
    swingAmount: 0.0,
    ridePriority: false,
    doubleKickEmphasis: false,
    ghostNoteThreshold: 0.38,
    useRimNotation: true,
    stemDirection: "auto",
    spacingMultiplier: 1.0,
    notationTips: [
      "Son professionnel — équilibre précision / feel",
      "Notation standard — adapté à l'impression",
      "Tous les détails dynamiques préservés",
    ],
  },

  vintage: {
    kitId: "vintage",
    recommendedGrid: "1/8",
    quantizationStrictness: 0.45,
    swingAmount: 0.10,
    ridePriority: false,
    doubleKickEmphasis: false,
    ghostNoteThreshold: 0.42,
    useRimNotation: true,
    stemDirection: "auto",
    spacingMultiplier: 1.05,
    notationTips: [
      "Groove années 60-70 — swing naturel",
      "Légères imperfections de timing volontaires",
      "Son chaud, ambiance salle",
    ],
  },
};

export function getNotationProfile(kitId: DrumKitId): StyleNotationProfile {
  return STYLE_NOTATION_PROFILES[kitId];
}

/**
 * Convert a notation profile's quantization strictness to preserve-groove setting.
 * strictness=1.0 → preserveGroove=false, strictness=0.0 → preserveGroove=true
 */
export function profileToGrooveSetting(profile: StyleNotationProfile): { preserveGroove: boolean; swing: number } {
  return {
    preserveGroove: profile.quantizationStrictness < 0.7,
    swing: profile.swingAmount,
  };
}
