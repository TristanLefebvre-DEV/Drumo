import * as Tone from "tone";
import type { DrumPiece } from "../core/types";
import { VOICE_FACTORIES, setPreviewVolume, type DrumVoice } from "./drumSampler";

// Module-level singleton — initialized once on first user gesture
let ready = false;
const voices = new Map<DrumPiece, DrumVoice>();

const init = async (): Promise<void> => {
  if (ready) return;
  await Tone.start();
  for (const [piece, factory] of Object.entries(VOICE_FACTORIES) as [DrumPiece, () => DrumVoice][]) {
    voices.set(piece, factory());
  }
  ready = true;
};

/**
 * Play the synthesized sound for a drum piece at the given velocity (0–1).
 * Initializes the AudioContext on first call (requires prior user gesture).
 */
export const playDrumSound = (piece: DrumPiece, velocity = 0.75): void => {
  // Fire-and-forget: init is fast after first call, Tone.start() is a no-op once running
  void init().then(() => {
    voices.get(piece)?.trigger(Math.max(0.05, Math.min(1, velocity)));
  });
};

/**
 * Let all preview sounds decay naturally.
 * Drum voices are short by design — no hard stop needed.
 */
export const stopAllPreviewSounds = (): void => {
  // Intentionally no-op: MembraneSynth/MetalSynth/NoiseSynth decay on their own.
  // Calling triggerRelease mid-envelope causes audible clicks.
};

/**
 * Set master preview volume. v = 0 (silent) – 1 (full).
 */
export const setPreviewVol = (v: number): void => {
  setPreviewVolume(v);
};

/** Release all Tone.js nodes (call on component unmount if needed). */
export const disposePreview = (): void => {
  voices.forEach((v) => v.dispose());
  voices.clear();
  ready = false;
};
