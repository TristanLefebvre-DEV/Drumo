import type { DrumPiece } from "../core/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrumKitId =
  | "rock" | "metal" | "jazz" | "funk"
  | "electronic" | "lofi" | "studio" | "vintage"
  | "pop" | "hiphop" | "acoustic" | "reggae" | "punk" | "trap";

export interface DrumKitMixer {
  kickVolume: number;
  snareVolume: number;
  hihatVolume: number;
  cymbalVolume: number;
  tomVolume: number;
  roomAmount: number;
}

export interface DrumKitPlaybackStyle {
  velocityCurve: "linear" | "exponential" | "compressed" | "expanded";
  humanizeAmount: number;
  compression: number;
}

/** Tone.js synthesis parameters that define the sonic character of a kit. */
export interface SynthKitParams {
  kick: {
    pitchDecay: number;
    octaves: number;
    decayTime: number;
    note: string;
    velMult: number;
  };
  snare: {
    noiseRatio: number;
    noiseDecay: number;
    bodyDecay: number;
    bodyNote: string;
    bodyOctaves: number;
    velMult: number;
  };
  hihatClosed: {
    freq: number;
    decay: number;
    harmonicity: number;
    modIdx: number;
    resonance: number;
    octaves: number;
    velMult: number;
  };
  hihatOpen: {
    freq: number;
    decay: number;
    harmonicity: number;
    modIdx: number;
    resonance: number;
    octaves: number;
    velMult: number;
  };
  hihatPedal: {
    freq: number;
    decay: number;
    harmonicity: number;
    modIdx: number;
    resonance: number;
    octaves: number;
    velMult: number;
  };
  ride: {
    freq: number;
    decay: number;
    harmonicity: number;
    modIdx: number;
    resonance: number;
    octaves: number;
    velMult: number;
  };
  crash: {
    freq: number;
    decay: number;
    harmonicity: number;
    modIdx: number;
    resonance: number;
    octaves: number;
    velMult: number;
  };
  splash: {
    freq: number;
    decay: number;
    harmonicity: number;
    modIdx: number;
    resonance: number;
    octaves: number;
    velMult: number;
  };
  tomHigh: { note: string; decayTime: number; pitchDecay: number; octaves: number; velMult: number };
  tomMid:  { note: string; decayTime: number; pitchDecay: number; octaves: number; velMult: number };
  tomLow:  { note: string; decayTime: number; pitchDecay: number; octaves: number; velMult: number };
}

export interface DrumKit {
  id: DrumKitId;
  name: string;
  description: string;
  color: string;
  accentColor: string;
  emoji: string;

  mixer: DrumKitMixer;
  playbackStyle: DrumKitPlaybackStyle;
  synthParams: SynthKitParams;

  /** Future: .wav sample paths under /src/drumkits/<id>/ */
  samplePaths?: Partial<Record<DrumPiece, string>>;
}

// ─── Mixer defaults per piece ─────────────────────────────────────────────────

/** Map DrumPiece → which mixer channel controls its volume */
export const PIECE_TO_MIXER_CHANNEL: Record<DrumPiece, keyof DrumKitMixer> = {
  kick:        "kickVolume",
  snare:       "snareVolume",
  snareRim:    "snareVolume",
  hihatClosed: "hihatVolume",
  hihatOpen:   "hihatVolume",
  hihatPedal:  "hihatVolume",
  crash:       "cymbalVolume",
  ride:        "cymbalVolume",
  splash:      "cymbalVolume",
  otherCymbal: "cymbalVolume",
  tomHigh:     "tomVolume",
  tomMid:      "tomVolume",
  tomLow:      "tomVolume",
};

// ─── Preset library ───────────────────────────────────────────────────────────

export const DRUM_KIT_PRESETS: Record<DrumKitId, DrumKit> = {

  rock: {
    id: "rock", name: "Rock", emoji: "🎸",
    description: "Kick punchy, snare forte, room médium — le son classique",
    color: "#3b82f6", accentColor: "#60a5fa",
    mixer: { kickVolume: 0.90, snareVolume: 0.85, hihatVolume: 0.70, cymbalVolume: 0.72, tomVolume: 0.78, roomAmount: 0.4 },
    playbackStyle: { velocityCurve: "linear", humanizeAmount: 0.15, compression: 0.35 },
    synthParams: {
      kick: { pitchDecay: 0.10, octaves: 9, decayTime: 0.42, note: "C1", velMult: 1.0 },
      snare: { noiseRatio: 0.62, noiseDecay: 0.18, bodyDecay: 0.13, bodyNote: "D2", bodyOctaves: 3.5, velMult: 1.0 },
      hihatClosed: { freq: 420, decay: 0.058, harmonicity: 5.1, modIdx: 32, resonance: 4200, octaves: 1.5, velMult: 0.40 },
      hihatOpen:   { freq: 420, decay: 0.52,  harmonicity: 5.1, modIdx: 32, resonance: 4200, octaves: 1.5, velMult: 0.35 },
      hihatPedal:  { freq: 360, decay: 0.040, harmonicity: 4.5, modIdx: 28, resonance: 3600, octaves: 1.0, velMult: 0.30 },
      ride:        { freq: 360, decay: 0.90,  harmonicity: 3.2, modIdx: 20, resonance: 3100, octaves: 1.5, velMult: 0.34 },
      crash:       { freq: 290, decay: 1.95,  harmonicity: 3.1, modIdx: 11, resonance: 3000, octaves: 1.5, velMult: 0.34 },
      splash:      { freq: 400, decay: 0.40,  harmonicity: 3.5, modIdx: 26, resonance: 3200, octaves: 1.5, velMult: 0.30 },
      tomHigh: { note: "A3", decayTime: 0.22, pitchDecay: 0.055, octaves: 4.5, velMult: 1.0 },
      tomMid:  { note: "E3", decayTime: 0.30, pitchDecay: 0.055, octaves: 4.5, velMult: 1.0 },
      tomLow:  { note: "B2", decayTime: 0.38, pitchDecay: 0.055, octaves: 4.5, velMult: 1.0 },
    },
  },

  metal: {
    id: "metal", name: "Metal", emoji: "🤘",
    description: "Kick clicky, double bass dense, cymbales brillantes",
    color: "#ef4444", accentColor: "#f87171",
    mixer: { kickVolume: 1.0, snareVolume: 0.92, hihatVolume: 0.80, cymbalVolume: 0.88, tomVolume: 0.85, roomAmount: 0.25 },
    playbackStyle: { velocityCurve: "compressed", humanizeAmount: 0.08, compression: 0.75 },
    synthParams: {
      kick: { pitchDecay: 0.04, octaves: 6, decayTime: 0.22, note: "C1", velMult: 1.1 },
      snare: { noiseRatio: 0.70, noiseDecay: 0.12, bodyDecay: 0.08, bodyNote: "E2", bodyOctaves: 2.5, velMult: 1.05 },
      hihatClosed: { freq: 560, decay: 0.028, harmonicity: 6.2, modIdx: 40, resonance: 5200, octaves: 2.0, velMult: 0.52 },
      hihatOpen:   { freq: 560, decay: 0.38,  harmonicity: 6.2, modIdx: 40, resonance: 5200, octaves: 2.0, velMult: 0.45 },
      hihatPedal:  { freq: 440, decay: 0.022, harmonicity: 5.5, modIdx: 34, resonance: 4400, octaves: 1.5, velMult: 0.38 },
      ride:        { freq: 420, decay: 0.70,  harmonicity: 4.0, modIdx: 28, resonance: 3800, octaves: 2.0, velMult: 0.38 },
      crash:       { freq: 340, decay: 1.60,  harmonicity: 4.2, modIdx: 14, resonance: 3600, octaves: 2.0, velMult: 0.40 },
      splash:      { freq: 460, decay: 0.30,  harmonicity: 4.5, modIdx: 30, resonance: 3800, octaves: 2.0, velMult: 0.35 },
      tomHigh: { note: "B3", decayTime: 0.18, pitchDecay: 0.040, octaves: 5.0, velMult: 1.05 },
      tomMid:  { note: "F3", decayTime: 0.25, pitchDecay: 0.040, octaves: 5.0, velMult: 1.05 },
      tomLow:  { note: "C3", decayTime: 0.32, pitchDecay: 0.040, octaves: 5.0, velMult: 1.05 },
    },
  },

  jazz: {
    id: "jazz", name: "Jazz", emoji: "🎷",
    description: "Ride dominant, dynamique large, hi-hat subtil, kick très léger",
    color: "#f59e0b", accentColor: "#fbbf24",
    mixer: { kickVolume: 0.52, snareVolume: 0.50, hihatVolume: 0.42, cymbalVolume: 0.82, tomVolume: 0.58, roomAmount: 0.65 },
    playbackStyle: { velocityCurve: "expanded", humanizeAmount: 0.38, compression: 0.10 },
    synthParams: {
      kick: { pitchDecay: 0.06, octaves: 5.0, decayTime: 0.30, note: "D1", velMult: 0.75 },
      snare: { noiseRatio: 0.45, noiseDecay: 0.14, bodyDecay: 0.16, bodyNote: "C2", bodyOctaves: 2.8, velMult: 0.70 },
      hihatClosed: { freq: 380, decay: 0.042, harmonicity: 4.8, modIdx: 28, resonance: 3600, octaves: 1.2, velMult: 0.28 },
      hihatOpen:   { freq: 380, decay: 0.60,  harmonicity: 4.8, modIdx: 28, resonance: 3600, octaves: 1.2, velMult: 0.25 },
      hihatPedal:  { freq: 320, decay: 0.032, harmonicity: 4.0, modIdx: 24, resonance: 3000, octaves: 0.8, velMult: 0.22 },
      ride:        { freq: 340, decay: 1.20,  harmonicity: 3.0, modIdx: 18, resonance: 2800, octaves: 1.2, velMult: 0.42 },
      crash:       { freq: 260, decay: 2.20,  harmonicity: 2.8, modIdx: 9,  resonance: 2600, octaves: 1.2, velMult: 0.30 },
      splash:      { freq: 360, decay: 0.50,  harmonicity: 3.2, modIdx: 22, resonance: 2900, octaves: 1.2, velMult: 0.28 },
      tomHigh: { note: "G3", decayTime: 0.28, pitchDecay: 0.065, octaves: 3.8, velMult: 0.80 },
      tomMid:  { note: "D3", decayTime: 0.36, pitchDecay: 0.065, octaves: 3.8, velMult: 0.80 },
      tomLow:  { note: "A2", decayTime: 0.45, pitchDecay: 0.065, octaves: 3.8, velMult: 0.80 },
    },
  },

  funk: {
    id: "funk", name: "Funk", emoji: "🕺",
    description: "Ghost notes mis en avant, snare dynamique, groove 16th hi-hat",
    color: "#8b5cf6", accentColor: "#a78bfa",
    mixer: { kickVolume: 0.85, snareVolume: 0.88, hihatVolume: 0.68, cymbalVolume: 0.68, tomVolume: 0.72, roomAmount: 0.35 },
    playbackStyle: { velocityCurve: "expanded", humanizeAmount: 0.28, compression: 0.25 },
    synthParams: {
      kick: { pitchDecay: 0.07, octaves: 8, decayTime: 0.36, note: "C1", velMult: 0.95 },
      snare: { noiseRatio: 0.55, noiseDecay: 0.20, bodyDecay: 0.12, bodyNote: "D2", bodyOctaves: 3.2, velMult: 1.0 },
      hihatClosed: { freq: 400, decay: 0.040, harmonicity: 5.0, modIdx: 30, resonance: 3900, octaves: 1.4, velMult: 0.36 },
      hihatOpen:   { freq: 400, decay: 0.45,  harmonicity: 5.0, modIdx: 30, resonance: 3900, octaves: 1.4, velMult: 0.32 },
      hihatPedal:  { freq: 340, decay: 0.035, harmonicity: 4.3, modIdx: 26, resonance: 3300, octaves: 0.9, velMult: 0.28 },
      ride:        { freq: 350, decay: 0.85,  harmonicity: 3.1, modIdx: 20, resonance: 2900, octaves: 1.4, velMult: 0.33 },
      crash:       { freq: 280, decay: 1.80,  harmonicity: 3.0, modIdx: 11, resonance: 2800, octaves: 1.4, velMult: 0.32 },
      splash:      { freq: 390, decay: 0.35,  harmonicity: 3.4, modIdx: 25, resonance: 3100, octaves: 1.4, velMult: 0.28 },
      tomHigh: { note: "A3", decayTime: 0.20, pitchDecay: 0.050, octaves: 4.2, velMult: 0.95 },
      tomMid:  { note: "E3", decayTime: 0.28, pitchDecay: 0.050, octaves: 4.2, velMult: 0.95 },
      tomLow:  { note: "B2", decayTime: 0.36, pitchDecay: 0.050, octaves: 4.2, velMult: 0.95 },
    },
  },

  electronic: {
    id: "electronic", name: "Electronic", emoji: "🤖",
    description: "808 kick sub-basse, clap synthétique, hi-hat ultra court",
    color: "#22c55e", accentColor: "#4ade80",
    mixer: { kickVolume: 0.95, snareVolume: 0.82, hihatVolume: 0.60, cymbalVolume: 0.55, tomVolume: 0.65, roomAmount: 0.10 },
    playbackStyle: { velocityCurve: "compressed", humanizeAmount: 0.02, compression: 0.80 },
    synthParams: {
      kick: { pitchDecay: 0.48, octaves: 13, decayTime: 0.60, note: "C0", velMult: 1.05 },
      snare: { noiseRatio: 0.92, noiseDecay: 0.08, bodyDecay: 0.04, bodyNote: "E3", bodyOctaves: 1.5, velMult: 0.95 },
      hihatClosed: { freq: 600, decay: 0.016, harmonicity: 7.0, modIdx: 48, resonance: 5800, octaves: 2.5, velMult: 0.48 },
      hihatOpen:   { freq: 600, decay: 0.20,  harmonicity: 7.0, modIdx: 48, resonance: 5800, octaves: 2.5, velMult: 0.42 },
      hihatPedal:  { freq: 500, decay: 0.012, harmonicity: 6.5, modIdx: 42, resonance: 5200, octaves: 2.0, velMult: 0.36 },
      ride:        { freq: 480, decay: 0.50,  harmonicity: 5.0, modIdx: 35, resonance: 4600, octaves: 2.0, velMult: 0.30 },
      crash:       { freq: 380, decay: 1.20,  harmonicity: 5.2, modIdx: 18, resonance: 4400, octaves: 2.0, velMult: 0.30 },
      splash:      { freq: 520, decay: 0.22,  harmonicity: 5.5, modIdx: 38, resonance: 4800, octaves: 2.0, velMult: 0.28 },
      tomHigh: { note: "C4", decayTime: 0.15, pitchDecay: 0.035, octaves: 6.0, velMult: 0.90 },
      tomMid:  { note: "G3", decayTime: 0.22, pitchDecay: 0.035, octaves: 6.0, velMult: 0.90 },
      tomLow:  { note: "D3", decayTime: 0.30, pitchDecay: 0.035, octaves: 6.0, velMult: 0.90 },
    },
  },

  lofi: {
    id: "lofi", name: "Lo-Fi", emoji: "📼",
    description: "Sons étouffés, dynamique réduite, ambiance vintage bedroom",
    color: "#f97316", accentColor: "#fb923c",
    mixer: { kickVolume: 0.68, snareVolume: 0.62, hihatVolume: 0.50, cymbalVolume: 0.52, tomVolume: 0.58, roomAmount: 0.50 },
    playbackStyle: { velocityCurve: "expanded", humanizeAmount: 0.42, compression: 0.15 },
    synthParams: {
      kick: { pitchDecay: 0.05, octaves: 5.5, decayTime: 0.28, note: "D1", velMult: 0.78 },
      snare: { noiseRatio: 0.50, noiseDecay: 0.16, bodyDecay: 0.14, bodyNote: "C2", bodyOctaves: 2.5, velMult: 0.72 },
      hihatClosed: { freq: 360, decay: 0.048, harmonicity: 4.5, modIdx: 26, resonance: 3400, octaves: 1.0, velMult: 0.28 },
      hihatOpen:   { freq: 360, decay: 0.38,  harmonicity: 4.5, modIdx: 26, resonance: 3400, octaves: 1.0, velMult: 0.24 },
      hihatPedal:  { freq: 300, decay: 0.032, harmonicity: 3.8, modIdx: 22, resonance: 2800, octaves: 0.8, velMult: 0.20 },
      ride:        { freq: 320, decay: 0.80,  harmonicity: 2.8, modIdx: 16, resonance: 2600, octaves: 1.0, velMult: 0.28 },
      crash:       { freq: 250, decay: 1.60,  harmonicity: 2.6, modIdx: 8,  resonance: 2400, octaves: 1.0, velMult: 0.26 },
      splash:      { freq: 340, decay: 0.42,  harmonicity: 3.0, modIdx: 20, resonance: 2700, octaves: 1.0, velMult: 0.24 },
      tomHigh: { note: "G3", decayTime: 0.26, pitchDecay: 0.060, octaves: 3.5, velMult: 0.72 },
      tomMid:  { note: "D3", decayTime: 0.34, pitchDecay: 0.060, octaves: 3.5, velMult: 0.72 },
      tomLow:  { note: "A2", decayTime: 0.42, pitchDecay: 0.060, octaves: 3.5, velMult: 0.72 },
    },
  },

  studio: {
    id: "studio", name: "Studio", emoji: "🎙️",
    description: "Son professionnel clean, kick équilibré, mix transparent",
    color: "#06b6d4", accentColor: "#22d3ee",
    mixer: { kickVolume: 0.88, snareVolume: 0.82, hihatVolume: 0.65, cymbalVolume: 0.68, tomVolume: 0.76, roomAmount: 0.30 },
    playbackStyle: { velocityCurve: "linear", humanizeAmount: 0.12, compression: 0.40 },
    synthParams: {
      kick: { pitchDecay: 0.08, octaves: 8, decayTime: 0.38, note: "C1", velMult: 0.98 },
      snare: { noiseRatio: 0.58, noiseDecay: 0.18, bodyDecay: 0.12, bodyNote: "D2", bodyOctaves: 3.0, velMult: 0.95 },
      hihatClosed: { freq: 410, decay: 0.055, harmonicity: 5.1, modIdx: 32, resonance: 4000, octaves: 1.5, velMult: 0.38 },
      hihatOpen:   { freq: 410, decay: 0.48,  harmonicity: 5.1, modIdx: 32, resonance: 4000, octaves: 1.5, velMult: 0.33 },
      hihatPedal:  { freq: 340, decay: 0.038, harmonicity: 4.5, modIdx: 28, resonance: 3400, octaves: 1.0, velMult: 0.28 },
      ride:        { freq: 350, decay: 0.88,  harmonicity: 3.1, modIdx: 20, resonance: 3000, octaves: 1.5, velMult: 0.33 },
      crash:       { freq: 285, decay: 1.90,  harmonicity: 3.1, modIdx: 11, resonance: 3000, octaves: 1.5, velMult: 0.33 },
      splash:      { freq: 395, decay: 0.38,  harmonicity: 3.5, modIdx: 26, resonance: 3200, octaves: 1.5, velMult: 0.30 },
      tomHigh: { note: "A3", decayTime: 0.22, pitchDecay: 0.055, octaves: 4.5, velMult: 0.96 },
      tomMid:  { note: "E3", decayTime: 0.30, pitchDecay: 0.055, octaves: 4.5, velMult: 0.96 },
      tomLow:  { note: "B2", decayTime: 0.38, pitchDecay: 0.055, octaves: 4.5, velMult: 0.96 },
    },
  },

  vintage: {
    id: "vintage", name: "Vintage", emoji: "🎺",
    description: "Son chaud et analogique, caractère des années 60-70",
    color: "#a16207", accentColor: "#ca8a04",
    mixer: { kickVolume: 0.78, snareVolume: 0.75, hihatVolume: 0.60, cymbalVolume: 0.65, tomVolume: 0.70, roomAmount: 0.55 },
    playbackStyle: { velocityCurve: "expanded", humanizeAmount: 0.32, compression: 0.20 },
    synthParams: {
      kick: { pitchDecay: 0.09, octaves: 7, decayTime: 0.40, note: "D1", velMult: 0.88 },
      snare: { noiseRatio: 0.48, noiseDecay: 0.22, bodyDecay: 0.18, bodyNote: "C2", bodyOctaves: 3.2, velMult: 0.85 },
      hihatClosed: { freq: 370, decay: 0.052, harmonicity: 4.6, modIdx: 28, resonance: 3500, octaves: 1.2, velMult: 0.32 },
      hihatOpen:   { freq: 370, decay: 0.55,  harmonicity: 4.6, modIdx: 28, resonance: 3500, octaves: 1.2, velMult: 0.28 },
      hihatPedal:  { freq: 310, decay: 0.038, harmonicity: 3.9, modIdx: 24, resonance: 2900, octaves: 0.9, velMult: 0.24 },
      ride:        { freq: 330, decay: 0.95,  harmonicity: 2.9, modIdx: 18, resonance: 2700, octaves: 1.2, velMult: 0.35 },
      crash:       { freq: 265, decay: 2.10,  harmonicity: 2.7, modIdx: 10, resonance: 2500, octaves: 1.2, velMult: 0.32 },
      splash:      { freq: 355, decay: 0.45,  harmonicity: 3.1, modIdx: 22, resonance: 2800, octaves: 1.2, velMult: 0.28 },
      tomHigh: { note: "A3", decayTime: 0.25, pitchDecay: 0.062, octaves: 4.0, velMult: 0.85 },
      tomMid:  { note: "E3", decayTime: 0.34, pitchDecay: 0.062, octaves: 4.0, velMult: 0.85 },
      tomLow:  { note: "B2", decayTime: 0.42, pitchDecay: 0.062, octaves: 4.0, velMult: 0.85 },
    },
  },

  pop: {
    id: "pop", name: "Pop", emoji: "🎤",
    description: "Son poli et équilibré, snare craquante, kick bien défini — radio-ready",
    color: "#ec4899", accentColor: "#f472b6",
    mixer: { kickVolume: 0.86, snareVolume: 0.88, hihatVolume: 0.72, cymbalVolume: 0.70, tomVolume: 0.74, roomAmount: 0.28 },
    playbackStyle: { velocityCurve: "compressed", humanizeAmount: 0.10, compression: 0.55 },
    synthParams: {
      kick:        { pitchDecay: 0.09, octaves: 8.5, decayTime: 0.36, note: "C1", velMult: 0.98 },
      snare:       { noiseRatio: 0.60, noiseDecay: 0.16, bodyDecay: 0.10, bodyNote: "D2", bodyOctaves: 3.2, velMult: 1.0 },
      hihatClosed: { freq: 430, decay: 0.050, harmonicity: 5.2, modIdx: 33, resonance: 4100, octaves: 1.6, velMult: 0.42 },
      hihatOpen:   { freq: 430, decay: 0.46,  harmonicity: 5.2, modIdx: 33, resonance: 4100, octaves: 1.6, velMult: 0.36 },
      hihatPedal:  { freq: 360, decay: 0.036, harmonicity: 4.6, modIdx: 29, resonance: 3600, octaves: 1.1, velMult: 0.30 },
      ride:        { freq: 355, decay: 0.88,  harmonicity: 3.2, modIdx: 21, resonance: 3100, octaves: 1.6, velMult: 0.34 },
      crash:       { freq: 290, decay: 1.85,  harmonicity: 3.2, modIdx: 12, resonance: 3000, octaves: 1.6, velMult: 0.34 },
      splash:      { freq: 405, decay: 0.36,  harmonicity: 3.6, modIdx: 27, resonance: 3300, octaves: 1.6, velMult: 0.30 },
      tomHigh: { note: "A3", decayTime: 0.20, pitchDecay: 0.052, octaves: 4.6, velMult: 0.96 },
      tomMid:  { note: "E3", decayTime: 0.28, pitchDecay: 0.052, octaves: 4.6, velMult: 0.96 },
      tomLow:  { note: "B2", decayTime: 0.36, pitchDecay: 0.052, octaves: 4.6, velMult: 0.96 },
    },
  },

  hiphop: {
    id: "hiphop", name: "Hip-Hop", emoji: "🎧",
    description: "808 sub-basse profonde, snare claquante, hi-hat swing 16th",
    color: "#7c3aed", accentColor: "#8b5cf6",
    mixer: { kickVolume: 1.0, snareVolume: 0.90, hihatVolume: 0.65, cymbalVolume: 0.50, tomVolume: 0.62, roomAmount: 0.08 },
    playbackStyle: { velocityCurve: "expanded", humanizeAmount: 0.20, compression: 0.65 },
    synthParams: {
      kick:        { pitchDecay: 0.55, octaves: 14, decayTime: 0.70, note: "B-1", velMult: 1.08 },
      snare:       { noiseRatio: 0.80, noiseDecay: 0.11, bodyDecay: 0.06, bodyNote: "F2", bodyOctaves: 2.2, velMult: 1.02 },
      hihatClosed: { freq: 550, decay: 0.022, harmonicity: 6.8, modIdx: 44, resonance: 5400, octaves: 2.2, velMult: 0.44 },
      hihatOpen:   { freq: 550, decay: 0.28,  harmonicity: 6.8, modIdx: 44, resonance: 5400, octaves: 2.2, velMult: 0.38 },
      hihatPedal:  { freq: 460, decay: 0.016, harmonicity: 6.0, modIdx: 38, resonance: 4800, octaves: 1.8, velMult: 0.34 },
      ride:        { freq: 460, decay: 0.60,  harmonicity: 4.8, modIdx: 32, resonance: 4400, octaves: 2.2, velMult: 0.28 },
      crash:       { freq: 360, decay: 1.30,  harmonicity: 5.0, modIdx: 16, resonance: 4200, octaves: 2.2, velMult: 0.28 },
      splash:      { freq: 500, decay: 0.24,  harmonicity: 5.2, modIdx: 36, resonance: 4600, octaves: 2.2, velMult: 0.26 },
      tomHigh: { note: "C4", decayTime: 0.16, pitchDecay: 0.038, octaves: 6.5, velMult: 0.88 },
      tomMid:  { note: "G3", decayTime: 0.24, pitchDecay: 0.038, octaves: 6.5, velMult: 0.88 },
      tomLow:  { note: "C3", decayTime: 0.34, pitchDecay: 0.038, octaves: 6.5, velMult: 0.88 },
    },
  },

  acoustic: {
    id: "acoustic", name: "Acoustique", emoji: "🥁",
    description: "Batterie acoustique naturelle, prise en studio, sonorité chaleureuse et ouverte",
    color: "#92400e", accentColor: "#b45309",
    mixer: { kickVolume: 0.82, snareVolume: 0.78, hihatVolume: 0.58, cymbalVolume: 0.72, tomVolume: 0.80, roomAmount: 0.70 },
    playbackStyle: { velocityCurve: "expanded", humanizeAmount: 0.35, compression: 0.15 },
    synthParams: {
      kick:        { pitchDecay: 0.11, octaves: 7.5, decayTime: 0.44, note: "D1", velMult: 0.92 },
      snare:       { noiseRatio: 0.42, noiseDecay: 0.24, bodyDecay: 0.20, bodyNote: "C2", bodyOctaves: 3.5, velMult: 0.88 },
      hihatClosed: { freq: 370, decay: 0.055, harmonicity: 4.4, modIdx: 27, resonance: 3400, octaves: 1.1, velMult: 0.30 },
      hihatOpen:   { freq: 370, decay: 0.62,  harmonicity: 4.4, modIdx: 27, resonance: 3400, octaves: 1.1, velMult: 0.26 },
      hihatPedal:  { freq: 310, decay: 0.040, harmonicity: 3.7, modIdx: 23, resonance: 2800, octaves: 0.8, velMult: 0.22 },
      ride:        { freq: 330, decay: 1.10,  harmonicity: 2.8, modIdx: 17, resonance: 2600, octaves: 1.1, velMult: 0.38 },
      crash:       { freq: 262, decay: 2.40,  harmonicity: 2.6, modIdx: 8,  resonance: 2400, octaves: 1.1, velMult: 0.34 },
      splash:      { freq: 350, decay: 0.55,  harmonicity: 3.0, modIdx: 21, resonance: 2750, octaves: 1.1, velMult: 0.30 },
      tomHigh: { note: "B3", decayTime: 0.30, pitchDecay: 0.068, octaves: 4.2, velMult: 0.90 },
      tomMid:  { note: "F3", decayTime: 0.40, pitchDecay: 0.068, octaves: 4.2, velMult: 0.90 },
      tomLow:  { note: "B2", decayTime: 0.52, pitchDecay: 0.068, octaves: 4.2, velMult: 0.90 },
    },
  },

  reggae: {
    id: "reggae", name: "Reggae", emoji: "🌿",
    description: "Riddim hypnotique, kick léger, snare sur le 3, hi-hat ouvert caractéristique",
    color: "#16a34a", accentColor: "#22c55e",
    mixer: { kickVolume: 0.72, snareVolume: 0.68, hihatVolume: 0.60, cymbalVolume: 0.65, tomVolume: 0.65, roomAmount: 0.55 },
    playbackStyle: { velocityCurve: "expanded", humanizeAmount: 0.32, compression: 0.12 },
    synthParams: {
      kick:        { pitchDecay: 0.07, octaves: 6.0, decayTime: 0.32, note: "D1", velMult: 0.80 },
      snare:       { noiseRatio: 0.52, noiseDecay: 0.15, bodyDecay: 0.17, bodyNote: "C2", bodyOctaves: 2.9, velMult: 0.76 },
      hihatClosed: { freq: 365, decay: 0.044, harmonicity: 4.6, modIdx: 26, resonance: 3300, octaves: 1.0, velMult: 0.26 },
      hihatOpen:   { freq: 365, decay: 0.72,  harmonicity: 4.6, modIdx: 26, resonance: 3300, octaves: 1.0, velMult: 0.28 },
      hihatPedal:  { freq: 310, decay: 0.034, harmonicity: 3.9, modIdx: 22, resonance: 2850, octaves: 0.8, velMult: 0.22 },
      ride:        { freq: 335, decay: 0.95,  harmonicity: 2.9, modIdx: 18, resonance: 2700, octaves: 1.1, velMult: 0.32 },
      crash:       { freq: 255, decay: 2.00,  harmonicity: 2.7, modIdx: 9,  resonance: 2500, octaves: 1.1, velMult: 0.28 },
      splash:      { freq: 342, decay: 0.48,  harmonicity: 3.1, modIdx: 21, resonance: 2800, octaves: 1.0, velMult: 0.26 },
      tomHigh: { note: "G3", decayTime: 0.29, pitchDecay: 0.064, octaves: 3.9, velMult: 0.82 },
      tomMid:  { note: "D3", decayTime: 0.38, pitchDecay: 0.064, octaves: 3.9, velMult: 0.82 },
      tomLow:  { note: "A2", decayTime: 0.48, pitchDecay: 0.064, octaves: 3.9, velMult: 0.82 },
    },
  },

  punk: {
    id: "punk", name: "Punk", emoji: "⚡",
    description: "Brut, rapide, sans compromis — kick et snare claquants, hihat en 8ths enragés",
    color: "#dc2626", accentColor: "#ef4444",
    mixer: { kickVolume: 0.95, snareVolume: 0.96, hihatVolume: 0.84, cymbalVolume: 0.80, tomVolume: 0.80, roomAmount: 0.20 },
    playbackStyle: { velocityCurve: "linear", humanizeAmount: 0.06, compression: 0.50 },
    synthParams: {
      kick:        { pitchDecay: 0.06, octaves: 7.5, decayTime: 0.26, note: "C1", velMult: 1.05 },
      snare:       { noiseRatio: 0.68, noiseDecay: 0.14, bodyDecay: 0.09, bodyNote: "E2", bodyOctaves: 2.6, velMult: 1.05 },
      hihatClosed: { freq: 480, decay: 0.032, harmonicity: 5.8, modIdx: 37, resonance: 4800, octaves: 1.8, velMult: 0.50 },
      hihatOpen:   { freq: 480, decay: 0.34,  harmonicity: 5.8, modIdx: 37, resonance: 4800, octaves: 1.8, velMult: 0.44 },
      hihatPedal:  { freq: 400, decay: 0.024, harmonicity: 5.2, modIdx: 32, resonance: 4200, octaves: 1.4, velMult: 0.38 },
      ride:        { freq: 400, decay: 0.65,  harmonicity: 3.8, modIdx: 25, resonance: 3600, octaves: 1.8, velMult: 0.36 },
      crash:       { freq: 320, decay: 1.50,  harmonicity: 4.0, modIdx: 13, resonance: 3400, octaves: 1.8, velMult: 0.38 },
      splash:      { freq: 440, decay: 0.28,  harmonicity: 4.3, modIdx: 28, resonance: 3700, octaves: 1.8, velMult: 0.34 },
      tomHigh: { note: "B3", decayTime: 0.17, pitchDecay: 0.042, octaves: 5.2, velMult: 1.02 },
      tomMid:  { note: "F3", decayTime: 0.23, pitchDecay: 0.042, octaves: 5.2, velMult: 1.02 },
      tomLow:  { note: "C3", decayTime: 0.30, pitchDecay: 0.042, octaves: 5.2, velMult: 1.02 },
    },
  },

  trap: {
    id: "trap", name: "Trap", emoji: "🔫",
    description: "Hi-hat rapide en triolets, 808 extended, snare sèche — trap moderne",
    color: "#0f172a", accentColor: "#475569",
    mixer: { kickVolume: 0.98, snareVolume: 0.85, hihatVolume: 0.70, cymbalVolume: 0.48, tomVolume: 0.58, roomAmount: 0.05 },
    playbackStyle: { velocityCurve: "compressed", humanizeAmount: 0.05, compression: 0.85 },
    synthParams: {
      kick:        { pitchDecay: 0.65, octaves: 15, decayTime: 0.80, note: "A-1", velMult: 1.10 },
      snare:       { noiseRatio: 0.75, noiseDecay: 0.09, bodyDecay: 0.05, bodyNote: "G2", bodyOctaves: 1.8, velMult: 0.98 },
      hihatClosed: { freq: 620, decay: 0.012, harmonicity: 7.5, modIdx: 50, resonance: 6000, octaves: 2.8, velMult: 0.46 },
      hihatOpen:   { freq: 620, decay: 0.16,  harmonicity: 7.5, modIdx: 50, resonance: 6000, octaves: 2.8, velMult: 0.40 },
      hihatPedal:  { freq: 520, decay: 0.010, harmonicity: 6.8, modIdx: 44, resonance: 5400, octaves: 2.2, velMult: 0.36 },
      ride:        { freq: 500, decay: 0.42,  harmonicity: 5.5, modIdx: 38, resonance: 4900, octaves: 2.2, velMult: 0.26 },
      crash:       { freq: 400, decay: 1.10,  harmonicity: 5.5, modIdx: 19, resonance: 4600, octaves: 2.2, velMult: 0.26 },
      splash:      { freq: 540, decay: 0.18,  harmonicity: 5.8, modIdx: 40, resonance: 5000, octaves: 2.2, velMult: 0.24 },
      tomHigh: { note: "D4", decayTime: 0.13, pitchDecay: 0.032, octaves: 7.0, velMult: 0.86 },
      tomMid:  { note: "A3", decayTime: 0.20, pitchDecay: 0.032, octaves: 7.0, velMult: 0.86 },
      tomLow:  { note: "D3", decayTime: 0.28, pitchDecay: 0.032, octaves: 7.0, velMult: 0.86 },
    },
  },
};

export const ALL_DRUM_KITS = Object.values(DRUM_KIT_PRESETS);
export const DEFAULT_KIT_ID: DrumKitId = "studio";

// ─── Mixer per-piece volume resolver ─────────────────────────────────────────

/** Resolve the effective volume multiplier for a piece given the current mixer state. */
export function getMixerVolume(piece: DrumPiece, mixer: DrumKitMixer): number {
  const channel = PIECE_TO_MIXER_CHANNEL[piece];
  return mixer[channel] ?? 1.0;
}

/** Apply the kit's velocity curve to a raw velocity. */
export function applyVelocityCurve(
  velocity: number,
  curve: DrumKitPlaybackStyle["velocityCurve"]
): number {
  const v = Math.max(0, Math.min(1, velocity));
  switch (curve) {
    case "exponential": return v * v;
    case "compressed":  return 0.4 + v * 0.55;
    case "expanded":    return Math.pow(v, 0.6);
    case "linear":
    default:            return v;
  }
}

/** Apply humanization jitter to a velocity. */
export function applyHumanize(velocity: number, amount: number): number {
  if (amount <= 0) return velocity;
  const jitter = (Math.random() * 2 - 1) * amount * 0.12;
  return Math.max(0.02, Math.min(1.0, velocity + jitter));
}

// ─── DrumKitManager singleton ─────────────────────────────────────────────────

type KitChangeListener = (kit: DrumKit) => void;
type MixerChangeListener = (mixer: DrumKitMixer) => void;

export class DrumKitManager {
  private _activeKit: DrumKit;
  private _mixer: DrumKitMixer;
  private _kitListeners = new Set<KitChangeListener>();
  private _mixerListeners = new Set<MixerChangeListener>();

  constructor() {
    this._activeKit = DRUM_KIT_PRESETS[DEFAULT_KIT_ID];
    this._mixer = { ...this._activeKit.mixer };
  }

  get activeKit(): DrumKit {
    return this._activeKit;
  }

  get mixer(): DrumKitMixer {
    return this._mixer;
  }

  setKit(id: DrumKitId): void {
    const kit = DRUM_KIT_PRESETS[id];
    if (!kit || kit.id === this._activeKit.id) return;
    this._activeKit = kit;
    this._mixer = { ...kit.mixer };
    for (const cb of this._kitListeners) cb(kit);
    for (const cb of this._mixerListeners) cb(this._mixer);
  }

  patchMixer(patch: Partial<DrumKitMixer>): void {
    this._mixer = { ...this._mixer, ...patch };
    for (const cb of this._mixerListeners) cb(this._mixer);
  }

  resetMixerToKitDefaults(): void {
    this._mixer = { ...this._activeKit.mixer };
    for (const cb of this._mixerListeners) cb(this._mixer);
  }

  onKitChange(cb: KitChangeListener): () => void {
    this._kitListeners.add(cb);
    return () => this._kitListeners.delete(cb);
  }

  onMixerChange(cb: MixerChangeListener): () => void {
    this._mixerListeners.add(cb);
    return () => this._mixerListeners.delete(cb);
  }

  /** Effective velocity for a hit, applying kit curve + humanize + mixer volume. */
  processVelocity(rawVelocity: number, piece: DrumPiece): number {
    const { velocityCurve, humanizeAmount } = this._activeKit.playbackStyle;
    const mixerVol = getMixerVolume(piece, this._mixer);
    const curved = applyVelocityCurve(rawVelocity, velocityCurve);
    const humanized = applyHumanize(curved, humanizeAmount);
    return Math.max(0, Math.min(1, humanized * mixerVol));
  }
}

export const drumKitManager = new DrumKitManager();
