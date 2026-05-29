/**
 * Style Profiles
 *
 * Reference kit balance profiles for common drumming styles.
 * Each profile defines the expected proportion of each voice category
 * and key characteristics to guide the KitBalanceAnalyzer.
 *
 * Values are 0–100 representing "typical presence" for that style.
 */

export type DrumStyle = "rock" | "jazz" | "metal" | "funk" | "electronic" | "custom";

export interface StyleProfile {
  id:              DrumStyle;
  name:            string;
  description:     string;
  kickDominance:   number;   // 0–100
  snarePresence:   number;
  cymbalDensity:   number;
  tomUsage:        number;
  ghostNoteRatio:  number;
  accentRatio:     number;
  dynamicRange:    number;
  swingCharacter:  number;   // 0=straight, 100=full swing
  bpmRange:        [number, number];  // typical BPM range
  color:           string;   // hex for UI display
  traits:          string[]; // key characteristics
}

export const STYLE_PROFILES: Record<DrumStyle, StyleProfile> = {
  rock: {
    id: "rock", name: "Rock", color: "#3b82f6",
    description: "Groove direct, kick/snare marqué, hi-hat 8ths constants",
    kickDominance: 60, snarePresence: 70, cymbalDensity: 75, tomUsage: 30,
    ghostNoteRatio: 8, accentRatio: 12, dynamicRange: 65, swingCharacter: 0,
    bpmRange: [90, 160],
    traits: ["Kick sur 1 et 3", "Snare sur 2 et 4", "Hi-hat en 8th notes", "Accents de crash sur temps forts"],
  },
  jazz: {
    id: "jazz", name: "Jazz", color: "#f59e0b",
    description: "Swing prononcé, ride dominant, kick très léger",
    kickDominance: 20, snarePresence: 25, cymbalDensity: 90, tomUsage: 10,
    ghostNoteRatio: 20, accentRatio: 15, dynamicRange: 75, swingCharacter: 80,
    bpmRange: [80, 280],
    traits: ["Ride ou HH swing", "Kick très léger", "Dynamique subtile", "Ghost notes abondants"],
  },
  metal: {
    id: "metal", name: "Metal", color: "#ef4444",
    description: "Double kick intense, densité maximale, hi-hat 16ths",
    kickDominance: 85, snarePresence: 70, cymbalDensity: 80, tomUsage: 45,
    ghostNoteRatio: 3, accentRatio: 20, dynamicRange: 55, swingCharacter: 0,
    bpmRange: [120, 260],
    traits: ["Double kick", "Hi-hat 16th dense", "Crash fréquents", "Fills de toms complexes"],
  },
  funk: {
    id: "funk", name: "Funk", color: "#8b5cf6",
    description: "Syncopation kick, ghost notes snare, groove groove groove",
    kickDominance: 55, snarePresence: 70, cymbalDensity: 72, tomUsage: 20,
    ghostNoteRatio: 28, accentRatio: 18, dynamicRange: 78, swingCharacter: 25,
    bpmRange: [80, 130],
    traits: ["Kick syncopé", "Ghost notes abondants", "Snare dynamique", "Groove 16th hi-hat"],
  },
  electronic: {
    id: "electronic", name: "Electronic", color: "#22c55e",
    description: "Kick quantizé, rythme mécanique, cymbales rares",
    kickDominance: 90, snarePresence: 80, cymbalDensity: 35, tomUsage: 15,
    ghostNoteRatio: 2, accentRatio: 10, dynamicRange: 30, swingCharacter: 0,
    bpmRange: [110, 180],
    traits: ["Kick parfaitement quantizé", "Peu de cymbales", "Dynamique uniforme", "Pattern répétitif"],
  },
  custom: {
    id: "custom", name: "Personnalisé", color: "#6b7280",
    description: "Style personnalisé",
    kickDominance: 50, snarePresence: 50, cymbalDensity: 50, tomUsage: 25,
    ghostNoteRatio: 10, accentRatio: 10, dynamicRange: 50, swingCharacter: 10,
    bpmRange: [60, 240],
    traits: [],
  },
};

export const ALL_STYLES = Object.values(STYLE_PROFILES);
