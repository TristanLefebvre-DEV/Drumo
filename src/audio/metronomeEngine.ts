/**
 * MetronomeEngine — standalone, drift-free metronome.
 *
 * Architecture:
 *   AudioClock (setInterval + AudioContext.currentTime) → scheduleWindow()
 *   → Tone.js synths triggered at precise audio times
 *   → setTimeout UI callbacks (visual beat updates)
 *
 * Completely independent from PlaybackEngine — works without a MIDI project.
 */

import * as Tone from "tone";
import { AudioClock } from "./audioClock";

// ─── Public types ─────────────────────────────────────────────────────────────

export type MetroSound = "click" | "woodblock" | "beep" | "hihat" | "rimshot";

export type MetroSubdivision = "quarter" | "eighth" | "triplet" | "sixteenth";

export interface MetroSignature { numerator: number; denominator: number }

export interface MetroTrainingConfig {
  enabled: boolean;
  targetBpm: number;
  stepBpm: number;
  stepMeasures: number;
}

export interface MetroPolyConfig {
  enabled: boolean;
  against: number;
}

export interface MetronomeState {
  bpm: number;
  signature: MetroSignature;
  subdivision: MetroSubdivision;
  soundType: MetroSound;
  volume: number;
  visualOnly: boolean;
  training: MetroTrainingConfig;
  poly: MetroPolyConfig;
}

export type BeatCallback = (beatIndex: number, isAccent: boolean, subdivIndex: number, totalSubdivs: number) => void;

// ─── Subdivision helpers ──────────────────────────────────────────────────────

const SUBDIV_COUNTS: Record<MetroSubdivision, number> = {
  quarter:   1,
  eighth:    2,
  triplet:   3,
  sixteenth: 4,
};

// ─── MetronomeEngine ──────────────────────────────────────────────────────────

export class MetronomeEngine {
  private clock: AudioClock | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: Tone.Gain | null = null;
  private initialized = false;

  // ── Sound generators ────────────────────────────────────────────────────────
  private accentHigh: Tone.MembraneSynth | null = null;
  private beatNormal: Tone.NoiseSynth | null = null;
  private beatNormalFilter: Tone.Filter | null = null;
  private subdivSynth: Tone.NoiseSynth | null = null;
  private subdivSynthFilter: Tone.Filter | null = null;
  private polyBeepSynth: Tone.Synth | null = null;

  // ── State ───────────────────────────────────────────────────────────────────
  private _bpm = 120;
  private _numerator = 4;
  private _denominator = 4;
  private _subdivision: MetroSubdivision = "quarter";
  private _soundType: MetroSound = "click";
  private _volume = 0.8;
  private _visualOnly = false;
  private _training: MetroTrainingConfig = { enabled: false, targetBpm: 180, stepBpm: 5, stepMeasures: 4 };
  private _poly: MetroPolyConfig = { enabled: false, against: 3 };

  // ── Scheduling state ─────────────────────────────────────────────────────────
  private _isRunning = false;
  private startAudioTime = 0;
  private scheduledUpTo = -Infinity;
  private totalSubdivsScheduled = 0;

  // ── Training state ──────────────────────────────────────────────────────────
  private trainingMeasureCount = 0;

  // ── Callbacks ────────────────────────────────────────────────────────────────
  private onBeatCb: BeatCallback | null = null;
  private onBpmChangeCb: ((bpm: number) => void) | null = null;
  private onStopCb: (() => void) | null = null;

  // ─── Initialization ──────────────────────────────────────────────────────────

  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.ctx = Tone.context.rawContext as AudioContext;
    this.masterGain = new Tone.Gain(this._volume).toDestination();
    this.clock = new AudioClock((from, to) => this.scheduleWindow(from, to));
    this.rebuildSynths();
  }

  private makeNoisePair(
    decay: number,
    filterType: "highpass" | "bandpass",
    filterFreq: number,
    out: Tone.ToneAudioNode
  ): { noise: Tone.NoiseSynth; filter: Tone.Filter } {
    const filter = new Tone.Filter({ frequency: filterFreq, type: filterType, Q: 1.2 }).connect(out);
    const noise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay, sustain: 0, release: Math.max(0.005, decay * 0.1) },
    }).connect(filter);
    return { noise, filter };
  }

  private rebuildSynths(): void {
    if (!this.masterGain) return;
    this.accentHigh?.dispose();
    this.beatNormal?.dispose();
    this.beatNormalFilter?.dispose();
    this.subdivSynth?.dispose();
    this.subdivSynthFilter?.dispose();
    this.polyBeepSynth?.dispose();

    const out = this.masterGain;

    switch (this._soundType) {
      case "click": {
        this.accentHigh = new Tone.MembraneSynth({
          pitchDecay: 0.018, octaves: 3,
          envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
        }).connect(out);
        const b = this.makeNoisePair(0.04, "highpass", 4000, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        const s = this.makeNoisePair(0.025, "highpass", 6000, out);
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }

      case "woodblock": {
        this.accentHigh = new Tone.MembraneSynth({
          pitchDecay: 0.008, octaves: 1.5,
          envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
        }).connect(out);
        const b = this.makeNoisePair(0.055, "bandpass", 3000, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        const s = this.makeNoisePair(0.030, "bandpass", 4500, out);
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }

      case "beep": {
        this.accentHigh = new Tone.MembraneSynth({
          pitchDecay: 0.001, octaves: 0.5,
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.01 },
        }).connect(out);
        const b = this.makeNoisePair(0.06, "highpass", 3000, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        const s = this.makeNoisePair(0.04, "highpass", 4500, out);
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }

      case "hihat": {
        this.accentHigh = new Tone.MembraneSynth({
          pitchDecay: 0.01, octaves: 2,
          envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
        }).connect(out);
        const b = this.makeNoisePair(0.06, "highpass", 7000, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        const s = this.makeNoisePair(0.035, "highpass", 9000, out);
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }

      case "rimshot": {
        this.accentHigh = new Tone.MembraneSynth({
          pitchDecay: 0.005, octaves: 2,
          envelope: { attack: 0.001, decay: 0.055, sustain: 0 },
        }).connect(out);
        const b = this.makeNoisePair(0.045, "highpass", 5000, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        const s = this.makeNoisePair(0.022, "highpass", 7000, out);
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
    }

    // Polyrhythm cross-beat synth (always the same — a subtle high beep)
    this.polyBeepSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    } as Tone.SynthOptions).connect(out);
  }

  // ─── Core scheduling ──────────────────────────────────────────────────────────

  private get secsPerBeat(): number {
    return 60 / this._bpm;
  }

  private get subdivsPerBeat(): number {
    return SUBDIV_COUNTS[this._subdivision];
  }

  private get secsPerSubdiv(): number {
    return this.secsPerBeat / this.subdivsPerBeat;
  }

  private get secsPerMeasure(): number {
    return this.secsPerBeat * this._numerator;
  }

  private scheduleWindow(windowStart: number, windowEnd: number): void {
    if (!this._isRunning || !this.ctx) return;

    const spSubdiv = this.secsPerSubdiv;
    const totalSubdivs = this._numerator * this.subdivsPerBeat;
    const schedFrom = Math.max(windowStart, this.scheduledUpTo);
    if (schedFrom >= windowEnd) return;

    const fromIdx = Math.ceil((schedFrom - this.startAudioTime) / spSubdiv);
    const toIdx   = Math.floor((windowEnd - this.startAudioTime - 0.0001) / spSubdiv);

    for (let si = fromIdx; si <= toIdx; si++) {
      const eventTime = this.startAudioTime + si * spSubdiv;
      const beatIndex  = Math.floor(si / this.subdivsPerBeat) % this._numerator;
      const subdivIdx  = si % this.subdivsPerBeat;
      const isAccent   = beatIndex === 0 && subdivIdx === 0;
      const isBeat     = subdivIdx === 0;

      // Training mode: detect measure boundaries
      if (isAccent && si > 0 && si === this.totalSubdivsScheduled) {
        // We just advanced to a new measure — handled by totalSubdivsScheduled tracking
      }
      if (isAccent && si > 0) {
        const measuresPlayed = Math.floor(si / (this._numerator * this.subdivsPerBeat));
        if (this._training.enabled && measuresPlayed > 0 && measuresPlayed !== this.trainingMeasureCount) {
          this.trainingMeasureCount = measuresPlayed;
          if (measuresPlayed % this._training.stepMeasures === 0) {
            this.stepTrainingBpm();
          }
        }
      }

      // Trigger audio
      if (!this._visualOnly) {
        const vol = this._volume;
        if (isAccent) {
          this.accentHigh?.triggerAttackRelease("C2", "32n", eventTime, vol);
        } else if (isBeat) {
          this.beatNormal?.triggerAttackRelease("32n", eventTime, vol * 0.65);
        } else {
          this.subdivSynth?.triggerAttackRelease("32n", eventTime, vol * 0.30);
        }
      }

      // Polyrhythm cross-beats
      if (this._poly.enabled && isBeat) {
        this.schedulePolyBeats(eventTime, beatIndex, spSubdiv * this.subdivsPerBeat);
      }

      // UI callback via setTimeout (close enough to audio time for visual sync)
      const nowAudio = this.ctx.currentTime;
      const delayMs = Math.max(0, (eventTime - nowAudio) * 1000);
      setTimeout(() => {
        this.onBeatCb?.(beatIndex, isAccent, subdivIdx, totalSubdivs);
      }, delayMs);
    }

    this.scheduledUpTo = windowEnd;
  }

  private schedulePolyBeats(beatStart: number, beatIndex: number, beatDuration: number): void {
    if (!this._poly.enabled || !this.polyBeepSynth || this._visualOnly) return;
    const against = this._poly.against;
    // If we are on beat 0 of measure, schedule `against` events across the measure
    if (beatIndex !== 0) return; // only fire at measure start to avoid duplicate scheduling
    const measureDur = this.secsPerMeasure;
    for (let i = 0; i < against; i++) {
      const t = beatStart + (i / against) * measureDur;
      const vol = this._volume * 0.45;
      this.polyBeepSynth.triggerAttackRelease(
        i === 0 ? "A4" : "E4",
        "32n",
        t,
        vol
      );
    }
    void beatDuration;
  }

  private stepTrainingBpm(): void {
    if (!this._training.enabled) return;
    const newBpm = Math.min(this._training.targetBpm, this._bpm + this._training.stepBpm);
    if (newBpm === this._bpm) {
      // Reached target — optionally stop training
      return;
    }
    this.changeBpmMidplay(newBpm);
    this.onBpmChangeCb?.(newBpm);
  }

  /** Change BPM while running without interrupting playback (seeks to keep beat position). */
  private changeBpmMidplay(newBpm: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const oldSpSubdiv = this.secsPerSubdiv;
    const elapsed = now - this.startAudioTime;
    const subdivsElapsed = elapsed / oldSpSubdiv;

    this._bpm = Math.max(20, Math.min(300, newBpm));

    const newSpSubdiv = this.secsPerSubdiv;
    this.startAudioTime = now - subdivsElapsed * newSpSubdiv;
    this.scheduledUpTo = now - 0.001;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this._isRunning) return;
    await Tone.start();
    this.ensureInit();

    this._isRunning = true;
    this.startAudioTime = this.ctx!.currentTime + 0.05;
    this.scheduledUpTo = this.ctx!.currentTime;
    this.totalSubdivsScheduled = 0;
    this.trainingMeasureCount = 0;
    this.clock!.start();
  }

  stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;
    this.clock?.stop();
    this.onStopCb?.();
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  // ── BPM ─────────────────────────────────────────────────────────────────────

  get bpm(): number { return this._bpm; }

  setBpm(bpm: number): void {
    const clamped = Math.max(20, Math.min(300, Math.round(bpm)));
    if (this._isRunning) {
      this.changeBpmMidplay(clamped);
    } else {
      this._bpm = clamped;
    }
    this.onBpmChangeCb?.(this._bpm);
  }

  // ── Signature ────────────────────────────────────────────────────────────────

  get signature(): MetroSignature { return { numerator: this._numerator, denominator: this._denominator }; }

  setSignature(sig: MetroSignature): void {
    this._numerator = sig.numerator;
    this._denominator = sig.denominator;
    if (this._isRunning) this.restartClock();
  }

  // ── Subdivision ──────────────────────────────────────────────────────────────

  get subdivision(): MetroSubdivision { return this._subdivision; }

  setSubdivision(sub: MetroSubdivision): void {
    this._subdivision = sub;
    if (this._isRunning) this.restartClock();
  }

  // ── Sound type ───────────────────────────────────────────────────────────────

  get soundType(): MetroSound { return this._soundType; }

  setSoundType(type: MetroSound): void {
    this._soundType = type;
    this.ensureInit();
    this.rebuildSynths();
  }

  // ── Volume ───────────────────────────────────────────────────────────────────

  get volume(): number { return this._volume; }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.rampTo(this._volume, 0.05);
    }
  }

  // ── Visual only ───────────────────────────────────────────────────────────────

  get visualOnly(): boolean { return this._visualOnly; }
  setVisualOnly(v: boolean): void { this._visualOnly = v; }

  // ── Training ─────────────────────────────────────────────────────────────────

  get training(): MetroTrainingConfig { return { ...this._training }; }
  setTraining(cfg: Partial<MetroTrainingConfig>): void {
    this._training = { ...this._training, ...cfg };
  }

  // ── Polyrhythm ────────────────────────────────────────────────────────────────

  get poly(): MetroPolyConfig { return { ...this._poly }; }
  setPoly(cfg: Partial<MetroPolyConfig>): void {
    this._poly = { ...this._poly, ...cfg };
  }

  // ── Callbacks ─────────────────────────────────────────────────────────────────

  onBeat(cb: BeatCallback): void { this.onBeatCb = cb; }
  onBpmChange(cb: (bpm: number) => void): void { this.onBpmChangeCb = cb; }
  onStop(cb: () => void): void { this.onStopCb = cb; }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private restartClock(): void {
    if (!this._isRunning || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.startAudioTime = now + 0.02;
    this.scheduledUpTo = now;
    this.trainingMeasureCount = 0;
  }

  getState(): MetronomeState {
    return {
      bpm: this._bpm,
      signature: { numerator: this._numerator, denominator: this._denominator },
      subdivision: this._subdivision,
      soundType: this._soundType,
      volume: this._volume,
      visualOnly: this._visualOnly,
      training: { ...this._training },
      poly: { ...this._poly },
    };
  }

  dispose(): void {
    this.stop();
    this.masterGain?.dispose();
    this.accentHigh?.dispose();
    this.beatNormal?.dispose();
    this.beatNormalFilter?.dispose();
    this.subdivSynth?.dispose();
    this.subdivSynthFilter?.dispose();
    this.polyBeepSynth?.dispose();
  }
}

// ─── Tap tempo utility ────────────────────────────────────────────────────────

export class TapTempoDetector {
  private taps: number[] = [];
  private readonly maxTaps = 8;
  private readonly maxAgeMs = 3000;

  tap(): number | null {
    const now = performance.now();
    this.taps = [...this.taps.filter((t) => now - t < this.maxAgeMs), now];
    if (this.taps.length < 2) return null;
    const relevant = this.taps.slice(-this.maxTaps);
    const intervals = relevant.slice(1).map((t, i) => t - relevant[i]);
    const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    return Math.max(20, Math.min(300, Math.round(60000 / avg)));
  }

  reset(): void { this.taps = []; }
  get tapCount(): number { return this.taps.length; }
}

// ─── Preset storage ───────────────────────────────────────────────────────────

const PRESET_STORAGE_KEY = "musecore:metro_presets";

export interface MetroPreset {
  id: string;
  name: string;
  bpm: number;
  signature: MetroSignature;
  subdivision: MetroSubdivision;
  soundType: MetroSound;
}

export function saveMetroPreset(preset: Omit<MetroPreset, "id">): MetroPreset {
  const all = loadMetroPresets();
  const full: MetroPreset = { ...preset, id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
  all.push(full);
  try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(all)); } catch { /* */ }
  return full;
}

export function loadMetroPresets(): MetroPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MetroPreset[]) : [];
  } catch { return []; }
}

export function deleteMetroPreset(id: string): void {
  const all = loadMetroPresets().filter((p) => p.id !== id);
  try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(all)); } catch { /* */ }
}

/** Module-level singleton */
export const metronomeEngine = new MetronomeEngine();
