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

const makeMetalSynth = (
  freq: number,
  opts: ConstructorParameters<typeof Tone.MetalSynth>[0],
  output: Tone.ToneAudioNode = getPreviewGain()
): Tone.MetalSynth => {
  const s = new Tone.MetalSynth(opts).connect(output);
  s.frequency.value = freq;
  return s;
};

const createSnareRim = (output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const s = makeMetalSynth(800, {
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 8, modulationIndex: 20, resonance: 5000, octaves: 0.5,
  }, output);
  return {
    trigger: (v = 0.75, time?) => s.triggerAttackRelease("32n", time ?? t(), Math.min(1, v ?? 0.75)),
    dispose: () => s.dispose(),
  };
};

const createHihatClosed = (output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const s = makeMetalSynth(400, {
    envelope: { attack: 0.001, decay: 0.055, release: 0.01 },
    harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
  }, output);
  return {
    trigger: (v = 0.75, time?) => s.triggerAttackRelease("32n", time ?? t(), Math.min(1, v ?? 0.75)),
    dispose: () => s.dispose(),
  };
};

const createHihatOpen = (output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const s = makeMetalSynth(400, {
    envelope: { attack: 0.001, decay: 0.48, release: 0.28 },
    harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
  }, output);
  return {
    trigger: (v = 0.75, time?) => s.triggerAttackRelease("4n", time ?? t(), Math.min(1, v ?? 0.75)),
    dispose: () => s.dispose(),
  };
};

const createHihatPedal = (output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const s = makeMetalSynth(340, {
    envelope: { attack: 0.001, decay: 0.038, release: 0.01 },
    harmonicity: 4.5, modulationIndex: 28, resonance: 3400, octaves: 1.0,
  }, output);
  return {
    trigger: (v = 0.75, time?) => s.triggerAttackRelease("32n", time ?? t(), Math.min(1, v ?? 0.75)),
    dispose: () => s.dispose(),
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

const makeCymbal = (freq: number, decay: number, modIdx: number, output: Tone.ToneAudioNode = getPreviewGain()): DrumVoice => {
  const s = makeMetalSynth(freq, {
    envelope: { attack: 0.001, decay, release: decay * 0.25 },
    harmonicity: 3.1, modulationIndex: modIdx, resonance: 3000, octaves: 1.5,
  }, output);
  // No extra multiplier — velocity scaling is handled upstream by the scheduler / velocity processor
  return {
    trigger: (v = 0.75, time?) => s.triggerAttackRelease("4n", time ?? t(), Math.min(1, v ?? 0.75)),
    dispose: () => s.dispose(),
  };
};

// ─── Preview factory map (connect to previewGain) ─────────────────────────────

export const VOICE_FACTORIES: Record<DrumPiece, () => DrumVoice> = {
  kick:        () => createKick(),
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
