/**
 * AdvancedMetronomeEngine — plays up to 4 independent instrument layers.
 *
 * Receives scheduling windows from MetronomeEngine (same AudioClock),
 * maintains per-instrument Tone.js synth pairs, and fires notes at
 * precise audio times with optional humanize + swing.
 *
 * Never creates its own clock — always driven by MetronomeEngine.
 */

import * as Tone from "tone";
import type { AdvMetronome, InstrumentId } from "../store/advancedMetronomeStore";

// ─── Per-instrument synth pair ────────────────────────────────────────────────

interface SynthPair {
  accent: Tone.MembraneSynth | null;
  noise:  Tone.NoiseSynth   | null;
  filter: Tone.Filter       | null;
  gain:   Tone.Gain         | null;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

class AdvancedMetronomeEngine {
  private masterGain:  Tone.Gain | null = null;
  private initialized  = false;
  private synths       = new Map<string, SynthPair>(); // key = metronome id

  // ── Initialization ─────────────────────────────────────────────────────────

  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.masterGain  = new Tone.Gain(1).toDestination();
  }

  // ── Synth factory ──────────────────────────────────────────────────────────

  private buildSynth(instrument: InstrumentId): SynthPair {
    if (!this.masterGain) return { accent: null, noise: null, filter: null, gain: null };

    const gain = new Tone.Gain(0.85).connect(this.masterGain);

    let accent: Tone.MembraneSynth;
    let filter: Tone.Filter;
    let noise:  Tone.NoiseSynth;

    switch (instrument) {
      case "kick":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.055, octaves: 6, envelope: { attack: 0.001, decay: 0.22, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 200, type: "lowpass", Q: 1 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.005 } }).connect(filter);
        break;

      case "snare":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.009, octaves: 2.5, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 1600, type: "bandpass", Q: 1 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.01 } }).connect(filter);
        break;

      case "clap":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.007, octaves: 2, envelope: { attack: 0.001, decay: 0.07, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 2200, type: "bandpass", Q: 1.2 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.01 } }).connect(filter);
        break;

      case "hihat":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 8000, type: "highpass", Q: 1 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.005 } }).connect(filter);
        break;

      case "hihat-open":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.012, octaves: 2.5, envelope: { attack: 0.001, decay: 0.28, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 7000, type: "highpass", Q: 1 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.04 } }).connect(filter);
        break;

      case "ride":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.012, octaves: 1.8, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 5500, type: "highpass", Q: 1 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.02 } }).connect(filter);
        break;

      case "crash":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.018, octaves: 3, envelope: { attack: 0.001, decay: 0.55, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 4500, type: "highpass", Q: 0.8 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.08 } }).connect(filter);
        break;

      case "tom-high":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 4, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 420, type: "lowpass", Q: 1 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.005 } }).connect(filter);
        break;

      case "tom-mid":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.045, octaves: 5, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 280, type: "lowpass", Q: 1 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.005 } }).connect(filter);
        break;

      case "tom-low":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 5.5, envelope: { attack: 0.001, decay: 0.19, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 200, type: "lowpass", Q: 1 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.005 } }).connect(filter);
        break;

      case "rimshot":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.005, octaves: 2, envelope: { attack: 0.001, decay: 0.055, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 5000, type: "highpass", Q: 1 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.005 } }).connect(filter);
        break;

      case "cowbell":
        accent = new Tone.MembraneSynth({ pitchDecay: 0.006, octaves: 0.8, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 900, type: "bandpass", Q: 1.5 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.01 } }).connect(filter);
        break;

      default: // percussion, custom
        accent = new Tone.MembraneSynth({ pitchDecay: 0.018, octaves: 3, envelope: { attack: 0.001, decay: 0.06, sustain: 0 } }).connect(gain);
        filter = new Tone.Filter({ frequency: 4000, type: "highpass", Q: 1 }).connect(gain);
        noise  = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.005 } }).connect(filter);
        break;
    }

    return { accent, noise, filter, gain };
  }

  private disposeSynth(pair: SynthPair): void {
    try { pair.accent?.dispose(); } catch { /* ignore */ }
    try { pair.noise?.dispose();  } catch { /* ignore */ }
    try { pair.filter?.dispose(); } catch { /* ignore */ }
    try { pair.gain?.dispose();   } catch { /* ignore */ }
  }

  // ── Sync synths with metronome list ────────────────────────────────────────

  syncMetronomes(metronomes: AdvMetronome[]): void {
    this.ensureInit();

    // Remove synths for deleted/changed metronomes
    const current = new Set(metronomes.map((m) => m.id));
    for (const [id, pair] of this.synths) {
      if (!current.has(id)) {
        this.disposeSynth(pair);
        this.synths.delete(id);
      }
    }

    // Create synths for new metronomes
    for (const m of metronomes) {
      if (!this.synths.has(m.id)) {
        this.synths.set(m.id, this.buildSynth(m.instrument));
      }
    }
  }

  // ── Main scheduling window ─────────────────────────────────────────────────
  /**
   * Called by MetronomeEngine on every 22ms scheduling tick.
   * windowStart / windowEnd are AudioContext times (seconds).
   * startAudioTime is the same reference as MetronomeEngine.startAudioTime.
   */
  scheduleWindow(
    windowStart:    number,
    windowEnd:      number,
    startAudioTime: number,
    bpm:            number,
    numerator:      number,
    metronomes:     AdvMetronome[],
  ): void {
    if (!this.masterGain || metronomes.length === 0) return;

    const hasSolo  = metronomes.some((m) => m.solo && m.enabled && !m.muted);
    const beatDur  = 60 / bpm; // seconds per beat

    for (const metro of metronomes) {
      if (!metro.enabled) continue;
      if (metro.muted)    continue;
      if (hasSolo && !metro.solo) continue;

      const pair = this.synths.get(metro.id);
      if (!pair?.accent || !pair?.noise) continue;

      // Update gain
      pair.gain?.gain.setValueAtTime(metro.volume, windowStart);

      const stepDur    = beatDur / metro.subdivision;
      const elapsed0   = windowStart - startAudioTime;
      const elapsed1   = windowEnd   - startAudioTime;

      if (elapsed1 <= 0) continue;

      const stepFrom = Math.ceil(Math.max(0, elapsed0) / stepDur);
      const stepTo   = Math.floor((elapsed1 - 0.0001)  / stepDur);

      for (let si = stepFrom; si <= stepTo; si++) {
        const beatIdx = Math.floor(si / metro.subdivision) % numerator;
        const stepIdx = si % metro.subdivision;

        const step = metro.pattern[beatIdx]?.[stepIdx];
        if (!step?.active)          continue;
        if (step.accent === "mute") continue;

        let eventTime = startAudioTime + si * stepDur;

        // Swing — delay even sub-steps (8th-note feel)
        if (metro.swing > 0 && metro.subdivision >= 2 && stepIdx % 2 === 1) {
          eventTime += stepDur * 0.667 * metro.swing - stepDur * 0.5;
        }

        // Humanize timing
        if (metro.humanize.enabled && metro.humanize.timingMs > 0) {
          eventTime += (Math.random() - 0.5) * 2 * (metro.humanize.timingMs / 1000);
        }

        // Don't fire in the past
        if (eventTime < windowStart - 0.005) continue;

        // Velocity with humanize
        let vel = step.velocity;
        if (metro.humanize.enabled && metro.humanize.velocityAmount > 0) {
          vel += (Math.random() - 0.5) * metro.humanize.velocityAmount;
        }
        vel = Math.max(0.05, Math.min(1, vel));

        const isAccent = step.accent === "strong" || step.accent === "accent";
        const isGhost  = step.accent === "ghost";

        if (isAccent) {
          pair.accent.triggerAttackRelease("C2", "32n", eventTime, vel);
        } else if (isGhost) {
          pair.noise.triggerAttackRelease("32n", eventTime, vel * 0.22);
        } else {
          pair.noise.triggerAttackRelease("32n", eventTime, vel * 0.72);
        }
      }
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  disposeAll(): void {
    for (const pair of this.synths.values()) this.disposeSynth(pair);
    this.synths.clear();
    try { this.masterGain?.dispose(); } catch { /* ignore */ }
    this.masterGain  = null;
    this.initialized = false;
  }
}

export const advancedMetronomeEngine = new AdvancedMetronomeEngine();
