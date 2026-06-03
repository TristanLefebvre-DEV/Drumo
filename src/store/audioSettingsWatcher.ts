/**
 * audioSettingsWatcher
 *
 * Subscribes to settingsStore and applies audio/performance settings in real
 * time to Tone.js and the metronome engine.  Import once (side-effect only)
 * from AppShell.tsx.
 */

import * as Tone from "tone";
import { metronomeEngine } from "../audio/metronomeEngine";
import { useSettingsStore } from "./settingsStore";
import type { AudioSettings, PerformanceSettings } from "./settingsStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert 0-100 linear slider value to dB for Tone.js. */
function toDb(vol: number): number {
  if (vol <= 0) return -Infinity;
  return 20 * Math.log10(vol / 100);
}

// ─── Apply functions ──────────────────────────────────────────────────────────

export function applyAudioSettings(audio: AudioSettings): void {
  // Master volume → Tone.js Destination
  try {
    Tone.getDestination().volume.value = toDb(audio.masterVolume);
  } catch { /* Tone not yet started */ }

  // Metronome volume (0-100 → 0-1)
  metronomeEngine.setVolume(audio.metronomeVolume / 100);

  // Metronome sound type
  metronomeEngine.setSoundType(audio.metronomeSound);

  // Latency compensation (ms → seconds for Tone)
  try {
    Tone.setContext(Tone.getContext());
    Tone.getContext().lookAhead = Math.max(0, 0.1 + audio.latencyCompensationMs / 1000);
  } catch { /* ignore */ }
}

export function applyPerformanceSettings(perf: PerformanceSettings): void {
  const root = document.documentElement;
  // Override animation mode from performance settings
  root.setAttribute("data-anim", perf.animations);
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

let _prevAudio: AudioSettings | null = null;
let _prevPerf: PerformanceSettings | null = null;

useSettingsStore.subscribe((state) => {
  if (state.audio !== _prevAudio) {
    _prevAudio = state.audio;
    applyAudioSettings(state.audio);
  }
  if (state.performance !== _prevPerf) {
    _prevPerf = state.performance;
    applyPerformanceSettings(state.performance);
  }
});

// Apply immediately on import
const initial = useSettingsStore.getState();
applyAudioSettings(initial.audio);
applyPerformanceSettings(initial.performance);
