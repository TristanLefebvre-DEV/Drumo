import * as Tone from "tone";
import type { DrumPiece } from "../core/types";

export interface DrumVoice {
  /**
   * Trigger this voice.
   * @param velocity 0–1
   * @param time     AudioContext time for precise scheduling.
   *                 Defaults to Tone.now() + 6ms lookahead for preview use.
   */
  trigger: (velocity?: number, time?: number) => void;
  dispose: () => void;
}

// ─── Shared preview output ────────────────────────────────────────────────────

let previewGain: Tone.Gain | null = null;

export const getPreviewGain = (): Tone.Gain => {
  if (!previewGain) previewGain = new Tone.Gain(0.85).toDestination();
  return previewGain;
};

export const setPreviewVolume = (v: number): void => {
  if (previewGain) previewGain.gain.rampTo(Math.max(0, Math.min(1, v)), 0.02);
};

/** Small lookahead for preview (immediate) use. */
const t = (): number => Tone.now() + 0.006;

// ─── Voice factories (output = destination node) ──────────────────────────────

const createKick = (output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const s = new Tone.MembraneSynth({
    pitchDecay: 0.07, octaves: 8,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 1.2 },
  }).connect(output);
  return {
    trigger: (v = 0.75, time?) => s.triggerAttackRelease("C1", "8n", time ?? t(), v),
    dispose: () => s.dispose(),
  };
};

const createSnare = (output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const noise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 },
  }).connect(output);
  const body = new Tone.MembraneSynth({
    pitchDecay: 0.01, octaves: 3,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
  }).connect(output);
  return {
    trigger: (v = 0.75, time?) => {
      const at = time ?? t();
      noise.triggerAttackRelease("8n", at, v * 0.65);
      body.triggerAttackRelease("D2", "16n", at, v * 0.35);
    },
    dispose: () => { noise.dispose(); body.dispose(); },
  };
};

/**
 * NoiseSynth + Filter — replaces Tone.MetalSynth which is silent in this
 * Tone.js 15.1.22 / Electron environment.
 */
const makeNoiseSynth = (
  decay: number,
  filterType: "highpass" | "bandpass",
  filterFreq: number,
  output: Tone.ToneAudioNode = getPreviewGain()
): { noise: Tone.NoiseSynth; filter: Tone.Filter } => {
  const filter = new Tone.Filter({ frequency: filterFreq, type: filterType, Q: 1.2 }).connect(output);
  const noise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay, sustain: 0, release: Math.max(0.01, decay * 0.1) },
  }).connect(filter);
  return { noise, filter };
};

const createSnareRim = (output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const { noise, filter } = makeNoiseSynth(0.05, "highpass", 5000, output);
  return {
    trigger: (v = 0.75, time?) => noise.triggerAttackRelease("32n", time ?? t(), Math.min(1, v ?? 0.75)),
    dispose: () => { noise.dispose(); filter.dispose(); },
  };
};

const createHihatClosed = (output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const { noise, filter } = makeNoiseSynth(0.055, "highpass", 7500, output);
  return {
    trigger: (v = 0.75, time?) => noise.triggerAttackRelease("32n", time ?? t(), Math.min(1, v ?? 0.75)),
    dispose: () => { noise.dispose(); filter.dispose(); },
  };
};

const createHihatOpen = (output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const { noise, filter } = makeNoiseSynth(0.48, "highpass", 7000, output);
  return {
    trigger: (v = 0.75, time?) => noise.triggerAttackRelease("4n", time ?? t(), Math.min(1, v ?? 0.75)),
    dispose: () => { noise.dispose(); filter.dispose(); },
  };
};

const createHihatPedal = (output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const { noise, filter } = makeNoiseSynth(0.038, "highpass", 7000, output);
  return {
    trigger: (v = 0.75, time?) => noise.triggerAttackRelease("32n", time ?? t(), Math.min(1, v ?? 0.75)),
    dispose: () => { noise.dispose(); filter.dispose(); },
  };
};

const makeTom = (note: string, decay: number, output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const s = new Tone.MembraneSynth({
    pitchDecay: 0.055, octaves: 4.5,
    envelope: { attack: 0.001, decay, sustain: 0, release: 0.9 },
  }).connect(output);
  return {
    trigger: (v = 0.75, time?) => s.triggerAttackRelease(note, "8n", time ?? t(), v),
    dispose: () => s.dispose(),
  };
};

// Map old MetalSynth freq (250–520 Hz range) → bandpass center (1.5–7 kHz)
const makeCymbal = (freq: number, decay: number, _modIdx: number, output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const filterFreq = Math.min(7000, Math.max(1500, 3500 * (freq / 320)));
  const { noise, filter } = makeNoiseSynth(decay, "bandpass", filterFreq, output);
  return {
    trigger: (v = 0.75, time?) => noise.triggerAttackRelease("4n", time ?? t(), Math.min(1, v ?? 0.75)),
    dispose: () => { noise.dispose(); filter.dispose(); },
  };
};

// ─── Preview factory map (connect to previewGain) ─────────────────────────────

export const VOICE_FACTORIES: Record<DrumPiece, () => DrumVoice> = {
  kick:        () => createKick(),
  kick2:       () => createKick(),
  snare:       () => createSnare(),
  snareRim:    () => createSnareRim(),
  hihatClosed: () => createHihatClosed(),
  hihatOpen:   () => createHihatOpen(),
  hihatPedal:  () => createHihatPedal(),
  tomHigh:     () => makeTom("A3", 0.22),
  tomMid:      () => makeTom("E3", 0.30),
  tomLow:      () => makeTom("B2", 0.38),
  crash:       () => makeCymbal(280, 1.9, 11),
  ride:        () => makeCymbal(350, 0.85, 20),
  splash:      () => makeCymbal(390, 0.38, 26),
  otherCymbal: () => makeCymbal(320, 1.1, 16),
};

// ─── Playback factory (connect to given output) ───────────────────────────────

/** Create a playback voice for a piece, routing to the given audio node. */
export const createVoiceForPiece = (piece: DrumPiece, output: Tone.ToneAudioNode): DrumVoice => {
  switch (piece) {
    case "kick":        return createKick(output);
    case "kick2":       return createKick(output);
    case "snare":       return createSnare(output);
    case "snareRim":    return createSnareRim(output);
    case "hihatClosed": return createHihatClosed(output);
    case "hihatOpen":   return createHihatOpen(output);
    case "hihatPedal":  return createHihatPedal(output);
    case "tomHigh":     return makeTom("A3", 0.22, output);
    case "tomMid":      return makeTom("E3", 0.30, output);
    case "tomLow":      return makeTom("B2", 0.38, output);
    case "crash":       return makeCymbal(280, 1.9, 11, output);
    case "ride":        return makeCymbal(350, 0.85, 20, output);
    case "splash":      return makeCymbal(390, 0.38, 26, output);
    case "otherCymbal": return makeCymbal(320, 1.1, 16, output);
  }
};
