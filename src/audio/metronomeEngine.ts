/**
 * MetronomeEngine — drift-free, feature-complete metronome for drummers.
 *
 * Architecture:
 *   AudioClock (setInterval + AudioContext.currentTime) → scheduleWindow()
 *   → Tone.js synths triggered at precise audio times
 *   → setTimeout UI callbacks (visual only, never drives audio)
 *
 * Independent from PlaybackEngine. Works without a MIDI project.
 */

import * as Tone from "tone";
import { AudioClock } from "./audioClock";

// ─── Public types ─────────────────────────────────────────────────────────────

export type MetroSound =
  | "click" | "sharp-click" | "woodblock" | "beep" | "hihat" | "rimshot"
  | "cowbell" | "clave" | "kick" | "snare";

const MAX_METRONOME_VOLUME = 2;

export type MetroSubdivision =
  | "quarter" | "eighth" | "triplet" | "sixteenth"
  | "quintolet" | "sextolet" | "septolet";

/** 0 = mute, 1 = normal, 2 = strong accent */
export type AccentLevel = 0 | 1 | 2;

export interface MetroSignature { numerator: number; denominator: number }

export interface MetroTrainingConfig {
  enabled: boolean;
  targetBpm: number;
  stepBpm: number;
  stepMeasures: number;
  /** After reaching targetBpm, step back down to original bpm */
  descend: boolean;
}

export interface SilenceTrainingConfig {
  enabled: boolean;
  /** Number of measures the click plays */
  onMeasures: number;
  /** Number of measures the click is silent */
  offMeasures: number;
  /** Automatically increase offMeasures by 1 each cycle */
  progressive: boolean;
}

export interface MetroPolyConfig {
  enabled: boolean;
  against: number; // 2–7 cross pulses per measure
}

export interface MetronomeState {
  bpm: number;
  signature: MetroSignature;
  subdivision: MetroSubdivision;
  soundType: MetroSound;
  volume: number;
  volumeAccent: number;
  volumeSubdiv: number;
  accentPattern: AccentLevel[];
  visualOnly: boolean;
  countInBars: number;
  training: MetroTrainingConfig;
  silence: SilenceTrainingConfig;
  poly: MetroPolyConfig;
}

export type BeatCallback = (
  beatIndex: number,
  accentLevel: AccentLevel,
  subdivIndex: number,
  totalSubdivs: number,
  measureIndex: number,
  isCountIn: boolean,
  isSilent: boolean,
) => void;

// ─── Subdivision helpers ──────────────────────────────────────────────────────

const SUBDIV_COUNTS: Record<MetroSubdivision, number> = {
  quarter:   1,
  eighth:    2,
  triplet:   3,
  sixteenth: 4,
  quintolet: 5,
  sextolet:  6,
  septolet:  7,
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
  private countInSynth: Tone.Synth | null = null;

  // ── State ───────────────────────────────────────────────────────────────────
  private _bpm = 120;
  private _numerator = 4;
  private _denominator = 4;
  private _subdivision: MetroSubdivision = "quarter";
  private _soundType: MetroSound = "click";
  private _volume = 0.8;
  private _volumeAccent = 1.0;
  private _volumeSubdiv = 0.35;
  private _visualOnly = false;
  private _accentPattern: AccentLevel[] = [];
  private _countInBars = 0;
  private _training: MetroTrainingConfig = {
    enabled: false, targetBpm: 180, stepBpm: 5, stepMeasures: 4, descend: false,
  };
  private _silence: SilenceTrainingConfig = {
    enabled: false, onMeasures: 4, offMeasures: 4, progressive: false,
  };
  private _poly: MetroPolyConfig = { enabled: false, against: 3 };

  // ── Scheduling state ─────────────────────────────────────────────────────────
  private _isRunning = false;
  private startAudioTime = 0;
  private scheduledUpTo = -Infinity;

  // ── Training tracking ────────────────────────────────────────────────────────
  private trainingMeasureCount = 0;
  private trainingOriginalBpm = 120;
  private silenceCurrentOffMeasures = 0;

  // ── Callbacks ────────────────────────────────────────────────────────────────
  private onBeatCb: BeatCallback | null = null;
  private onBpmChangeCb: ((bpm: number) => void) | null = null;
  private onStopCb: (() => void) | null = null;
  private onMeasureCb: ((measureIndex: number, isSilent: boolean, isCountIn: boolean) => void) | null = null;
  // Advanced-engine hook — receives same scheduling windows, never drives the main clock
  private advancedCb: ((ws: number, we: number, startTime: number, bpm: number, numerator: number) => void) | null = null;

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
    filterType: "highpass" | "bandpass" | "lowpass",
    filterFreq: number,
    out: Tone.ToneAudioNode
  ): { noise: Tone.NoiseSynth; filter: Tone.Filter } {
    const filter = new Tone.Filter({
      frequency: filterFreq,
      type: filterType,
      Q: 1.2,
    }).connect(out);
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
    this.countInSynth?.dispose();

    const out = this.masterGain;

    switch (this._soundType) {
      case "click": {
        this.accentHigh = new Tone.MembraneSynth({ pitchDecay: 0.018, octaves: 3, envelope: { attack: 0.001, decay: 0.06, sustain: 0 } }).connect(out);
        const b = this.makeNoisePair(0.04, "highpass", 4000, out);
        const s = this.makeNoisePair(0.025, "highpass", 6000, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
      case "sharp-click": {
        this.accentHigh = new Tone.MembraneSynth({ pitchDecay: 0.004, octaves: 1.2, envelope: { attack: 0.001, decay: 0.028, sustain: 0 } }).connect(out);
        const b = this.makeNoisePair(0.018, "highpass", 9000, out);
        const s = this.makeNoisePair(0.012, "highpass", 11000, out);
        b.filter.Q.value = 3.5;
        s.filter.Q.value = 4.5;
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
      case "woodblock": {
        this.accentHigh = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 1.5, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(out);
        const b = this.makeNoisePair(0.055, "bandpass", 3000, out);
        const s = this.makeNoisePair(0.030, "bandpass", 4500, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
      case "beep": {
        this.accentHigh = new Tone.MembraneSynth({ pitchDecay: 0.001, octaves: 0.5, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 } } as Tone.MembraneSynthOptions).connect(out);
        const b = this.makeNoisePair(0.06, "highpass", 3000, out);
        const s = this.makeNoisePair(0.04, "highpass", 4500, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
      case "hihat": {
        this.accentHigh = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } }).connect(out);
        const b = this.makeNoisePair(0.06, "highpass", 7000, out);
        const s = this.makeNoisePair(0.035, "highpass", 9000, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
      case "rimshot": {
        this.accentHigh = new Tone.MembraneSynth({ pitchDecay: 0.005, octaves: 2, envelope: { attack: 0.001, decay: 0.055, sustain: 0 } }).connect(out);
        const b = this.makeNoisePair(0.045, "highpass", 5000, out);
        const s = this.makeNoisePair(0.022, "highpass", 7000, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
      case "cowbell": {
        // Square oscillator shape + tight bandpass for that classic cowbell
        this.accentHigh = new Tone.MembraneSynth({ pitchDecay: 0.006, octaves: 0.8, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } }).connect(out);
        const b = this.makeNoisePair(0.09, "bandpass", 900, out);
        const s = this.makeNoisePair(0.045, "bandpass", 1400, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
      case "clave": {
        // Very short, bright resonant click
        this.accentHigh = new Tone.MembraneSynth({ pitchDecay: 0.002, octaves: 1, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } }).connect(out);
        const b = this.makeNoisePair(0.028, "bandpass", 2200, out);
        const s = this.makeNoisePair(0.014, "bandpass", 3400, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
      case "kick": {
        // Low thump: long pitch decay, low-pass filtered noise
        this.accentHigh = new Tone.MembraneSynth({ pitchDecay: 0.055, octaves: 6, envelope: { attack: 0.001, decay: 0.22, sustain: 0 } }).connect(out);
        const b = this.makeNoisePair(0.06, "lowpass", 180, out);
        const s = this.makeNoisePair(0.03, "lowpass", 280, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
      case "snare": {
        // Wide bandpass noise snap
        this.accentHigh = new Tone.MembraneSynth({ pitchDecay: 0.009, octaves: 2.5, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } }).connect(out);
        const b = this.makeNoisePair(0.13, "bandpass", 1600, out);
        const s = this.makeNoisePair(0.065, "bandpass", 2400, out);
        this.beatNormal = b.noise; this.beatNormalFilter = b.filter;
        this.subdivSynth = s.noise; this.subdivSynthFilter = s.filter;
        break;
      }
    }

    // Poly cross-beat synth (always a high triangle beep)
    this.polyBeepSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    } as Tone.SynthOptions).connect(out);

    // Count-in synth (higher, distinct from main click)
    this.countInSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.01 },
    } as Tone.SynthOptions).connect(out);
  }

  // ─── Accent pattern ──────────────────────────────────────────────────────────

  /** Returns the accent level for a given beat index using the current pattern.
   *  Falls back to default behaviour (beat 0 = strong, rest = normal) when pattern is empty.  */
  private getAccentLevel(beatIndex: number): AccentLevel {
    if (this._accentPattern.length === 0) {
      return beatIndex === 0 ? 2 : 1;
    }
    return this._accentPattern[beatIndex % this._accentPattern.length] ?? 1;
  }

  // ─── Core scheduling ──────────────────────────────────────────────────────────

  private get secsPerBeat(): number { return 60 / this._bpm; }
  private get subdivsPerBeat(): number { return SUBDIV_COUNTS[this._subdivision]; }
  private get secsPerSubdiv(): number { return this.secsPerBeat / this.subdivsPerBeat; }
  private get secsPerMeasure(): number { return this.secsPerBeat * this._numerator; }
  private get accentNote(): string { return this._soundType === "sharp-click" ? "C6" : "C2"; }

  private scheduleWindow(windowStart: number, windowEnd: number): void {
    if (!this._isRunning || !this.ctx) return;

    const spSubdiv    = this.secsPerSubdiv;
    const subPerMeas  = this._numerator * this.subdivsPerBeat;
    const schedFrom   = Math.max(windowStart, this.scheduledUpTo);
    if (schedFrom >= windowEnd) return;

    const fromIdx = Math.ceil((schedFrom - this.startAudioTime) / spSubdiv);
    const toIdx   = Math.floor((windowEnd - this.startAudioTime - 0.0001) / spSubdiv);

    // Count-in: first N measures use countInSynth and are flagged isCountIn
    const countInSubdivs = this._countInBars * subPerMeas;

    for (let si = fromIdx; si <= toIdx; si++) {
      const eventTime   = this.startAudioTime + si * spSubdiv;
      const isCountIn   = si < countInSubdivs;
      const adjustedSi  = isCountIn ? si : si - countInSubdivs;
      const beatIndex   = Math.floor(adjustedSi / this.subdivsPerBeat) % this._numerator;
      const subdivIdx   = adjustedSi % this.subdivsPerBeat;
      const measureIndex = Math.floor(adjustedSi / subPerMeas);
      const isMeasureStart = beatIndex === 0 && subdivIdx === 0;
      const isBeat      = subdivIdx === 0;

      // ── Silence training ──────────────────────────────────────────────────
      let isSilent = false;
      if (!isCountIn && this._silence.enabled) {
        const offMeas = this._silence.progressive
          ? this._silence.offMeasures + this.silenceCurrentOffMeasures
          : this._silence.offMeasures;
        const cycle = this._silence.onMeasures + offMeas;
        const pos   = measureIndex % cycle;
        isSilent    = pos >= this._silence.onMeasures;
      }

      // ── BPM progression training ──────────────────────────────────────────
      if (!isCountIn && isMeasureStart && measureIndex > 0 && this._training.enabled) {
        if (measureIndex !== this.trainingMeasureCount) {
          this.trainingMeasureCount = measureIndex;
          if (measureIndex % this._training.stepMeasures === 0) {
            this.stepTrainingBpm();
          }
        }
      }

      // Progressive silence: increase offMeasures every full cycle
      if (!isCountIn && isMeasureStart && this._silence.enabled && this._silence.progressive) {
        const cycle = this._silence.onMeasures + this._silence.offMeasures + this.silenceCurrentOffMeasures;
        if (measureIndex > 0 && measureIndex % cycle === 0) {
          this.silenceCurrentOffMeasures++;
        }
      }

      // ── Audio synthesis ───────────────────────────────────────────────────
      if (!this._visualOnly) {
        if (isCountIn) {
          // Count-in: high beep on each beat, higher pitch on beat 1
          if (isBeat && this.countInSynth) {
            const countBeat = Math.floor(si / this.subdivsPerBeat) % this._numerator;
            const note = countBeat === 0 ? "A5" : "E5";
            this.countInSynth.triggerAttackRelease(note, "32n", eventTime, this._volume * 0.7);
          }
        } else if (!isSilent) {
          const accentLevel = this.getAccentLevel(beatIndex);
          if (accentLevel > 0) {
            if (isBeat) {
              if (accentLevel === 2) {
                // Strong accent — membrane synth
                this.accentHigh?.triggerAttackRelease(this.accentNote, "32n", eventTime, this._volume * this._volumeAccent);
              } else {
                // Normal beat
                const normalVol = this._soundType === "sharp-click" ? 0.85 : 0.65;
                this.beatNormal?.triggerAttackRelease("32n", eventTime, this._volume * normalVol);
              }
            } else {
              // Subdivision click
              const subdivVol = this._soundType === "sharp-click"
                ? Math.min(1, this._volumeSubdiv * 1.15)
                : this._volumeSubdiv;
              this.subdivSynth?.triggerAttackRelease("32n", eventTime, this._volume * subdivVol);
            }
          }
        }
      }

      // ── Polyrhythm cross-beats ─────────────────────────────────────────────
      if (!isCountIn && this._poly.enabled && isBeat && beatIndex === 0) {
        this.schedulePolyBeats(eventTime);
      }

      // ── UI callback (setTimeout — visual sync, never drives audio) ─────────
      const nowAudio = this.ctx.currentTime;
      const delayMs  = Math.max(0, (eventTime - nowAudio) * 1000);
      const accentLvl = isCountIn ? 2 : this.getAccentLevel(beatIndex);
      setTimeout(() => {
        this.onBeatCb?.(
          beatIndex,
          accentLvl,
          subdivIdx,
          subPerMeas,
          measureIndex,
          isCountIn,
          isSilent,
        );
        if (isMeasureStart) {
          this.onMeasureCb?.(measureIndex, isSilent, isCountIn);
        }
      }, delayMs);
    }

    this.scheduledUpTo = windowEnd;

    // Notify advanced engine with same window
    this.advancedCb?.(windowStart, windowEnd, this.startAudioTime, this._bpm, this._numerator);
  }

  private schedulePolyBeats(measureStart: number): void {
    if (!this._poly.enabled || !this.polyBeepSynth || this._visualOnly) return;
    const against = this._poly.against;
    const measureDur = this.secsPerMeasure;
    for (let i = 0; i < against; i++) {
      const t   = measureStart + (i / against) * measureDur;
      const vol = this._volume * 0.45;
      this.polyBeepSynth.triggerAttackRelease(i === 0 ? "A4" : "E4", "32n", t, vol);
    }
  }

  private stepTrainingBpm(): void {
    if (!this._training.enabled) return;
    let newBpm: number;
    if (this._training.descend && this._bpm >= this._training.targetBpm) {
      // Descend back to original
      newBpm = Math.max(this.trainingOriginalBpm, this._bpm - this._training.stepBpm);
    } else {
      newBpm = Math.min(this._training.targetBpm, this._bpm + this._training.stepBpm);
    }
    if (newBpm === this._bpm) return;
    this.changeBpmMidplay(newBpm);
    this.onBpmChangeCb?.(newBpm);
  }

  /** Change BPM seamlessly during playback. Maintains beat phase. */
  private changeBpmMidplay(newBpm: number): void {
    if (!this.ctx) return;
    const now          = this.ctx.currentTime;
    const oldSpSubdiv  = this.secsPerSubdiv;
    const elapsed      = now - this.startAudioTime;
    const subdivsElapsed = elapsed / oldSpSubdiv;

    this._bpm = Math.max(20, Math.min(300, newBpm));

    const newSpSubdiv = this.secsPerSubdiv;
    this.startAudioTime = now - subdivsElapsed * newSpSubdiv;
    this.scheduledUpTo  = now - 0.001;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this._isRunning) return;
    await Tone.start();
    this.ensureInit();

    this._isRunning = true;
    this.trainingOriginalBpm = this._bpm;
    this.trainingMeasureCount = 0;
    this.silenceCurrentOffMeasures = 0;

    // startAudioTime includes count-in offset so measure 0 is the actual downbeat
    const countInDur = this._countInBars * this.secsPerMeasure;
    this.startAudioTime = this.ctx!.currentTime + 0.05 - countInDur;
    this.scheduledUpTo  = this.ctx!.currentTime;
    this.clock!.start();
  }

  stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;
    this.clock?.stop();
    this.onStopCb?.();
  }

  get isRunning(): boolean { return this._isRunning; }

  /** Register a callback to receive the same scheduling windows as the main engine.
   *  Pass null to unregister. Used by AdvancedMetronomeEngine. */
  setAdvancedScheduleCallback(
    cb: ((ws: number, we: number, startTime: number, bpm: number, numerator: number) => void) | null
  ): void {
    this.advancedCb = cb;
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
    this._numerator   = sig.numerator;
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
    this._volume = Math.max(0, Math.min(MAX_METRONOME_VOLUME, v));
    if (this.masterGain) this.masterGain.gain.rampTo(this._volume, 0.05);
  }

  get volumeAccent(): number { return this._volumeAccent; }
  setVolumeAccent(v: number): void { this._volumeAccent = Math.max(0, Math.min(1, v)); }

  get volumeSubdiv(): number { return this._volumeSubdiv; }
  setVolumeSubdiv(v: number): void { this._volumeSubdiv = Math.max(0, Math.min(1, v)); }

  // ── Accent pattern ────────────────────────────────────────────────────────────

  get accentPattern(): AccentLevel[] { return [...this._accentPattern]; }
  setAccentPattern(pattern: AccentLevel[]): void { this._accentPattern = [...pattern]; }

  // ── Visual only ───────────────────────────────────────────────────────────────

  get visualOnly(): boolean { return this._visualOnly; }
  setVisualOnly(v: boolean): void { this._visualOnly = v; }

  // ── Count-in ─────────────────────────────────────────────────────────────────

  get countInBars(): number { return this._countInBars; }
  setCountInBars(n: number): void { this._countInBars = Math.max(0, Math.min(8, n)); }

  // ── Training ─────────────────────────────────────────────────────────────────

  get training(): MetroTrainingConfig { return { ...this._training }; }
  setTraining(cfg: Partial<MetroTrainingConfig>): void {
    this._training = { ...this._training, ...cfg };
  }

  // ── Silence training ─────────────────────────────────────────────────────────

  get silence(): SilenceTrainingConfig { return { ...this._silence }; }
  setSilence(cfg: Partial<SilenceTrainingConfig>): void {
    this._silence = { ...this._silence, ...cfg };
    this.silenceCurrentOffMeasures = 0;
  }

  // ── Polyrhythm ────────────────────────────────────────────────────────────────

  get poly(): MetroPolyConfig { return { ...this._poly }; }
  setPoly(cfg: Partial<MetroPolyConfig>): void { this._poly = { ...this._poly, ...cfg }; }

  // ── Callbacks ─────────────────────────────────────────────────────────────────

  onBeat(cb: BeatCallback): void { this.onBeatCb = cb; }
  onBpmChange(cb: (bpm: number) => void): void { this.onBpmChangeCb = cb; }
  onStop(cb: () => void): void { this.onStopCb = cb; }

  /**
   * Trigger a click sound at a precise AudioContext time.
   * Used by PatternEngine so both modes share the same synth configuration.
   * level: 0=mute, 1=normal, 2=accent
   */
  triggerAt(level: AccentLevel, time: number): void {
    if (!this.initialized) this.ensureInit();
    if (this._visualOnly || level === 0) return;
    const vol = this._volume;
    if (level === 2) {
      this.accentHigh?.triggerAttackRelease(this.accentNote, "32n", time, vol * this._volumeAccent);
    } else {
      const normalVol = this._soundType === "sharp-click" ? 0.85 : 0.65;
      this.beatNormal?.triggerAttackRelease("32n", time, vol * normalVol);
    }
  }

  /** Exposed so PatternEngine can initialize the audio context on demand. */
  initAudio(): void { this.ensureInit(); }
  onMeasure(cb: (measureIndex: number, isSilent: boolean, isCountIn: boolean) => void): void {
    this.onMeasureCb = cb;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private restartClock(): void {
    if (!this._isRunning || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.startAudioTime = now + 0.02;
    this.scheduledUpTo  = now;
    this.trainingMeasureCount = 0;
  }

  getState(): MetronomeState {
    return {
      bpm: this._bpm,
      signature: { numerator: this._numerator, denominator: this._denominator },
      subdivision: this._subdivision,
      soundType: this._soundType,
      volume: this._volume,
      volumeAccent: this._volumeAccent,
      volumeSubdiv: this._volumeSubdiv,
      accentPattern: [...this._accentPattern],
      visualOnly: this._visualOnly,
      countInBars: this._countInBars,
      training: { ...this._training },
      silence: { ...this._silence },
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
    this.countInSynth?.dispose();
  }
}

// ─── Tap tempo utility ────────────────────────────────────────────────────────

export class TapTempoDetector {
  private taps: number[] = [];
  private readonly maxTaps = 8;
  private readonly maxAgeMs = 3000;

  tap(): number | null {
    const now  = performance.now();
    this.taps  = [...this.taps.filter((t) => now - t < this.maxAgeMs), now];
    if (this.taps.length < 2) return null;
    const relevant  = this.taps.slice(-this.maxTaps);
    const intervals = relevant.slice(1).map((t, i) => t - relevant[i]);
    const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    return Math.max(20, Math.min(300, Math.round(60000 / avg)));
  }

  reset(): void { this.taps = []; }
  get tapCount(): number { return this.taps.length; }
}

// ─── Preset storage & defaults ───────────────────────────────────────────────

const PRESET_STORAGE_KEY = "musecore:metro_presets_v2";

export interface MetroPreset {
  id: string;
  name: string;
  bpm: number;
  signature: MetroSignature;
  subdivision: MetroSubdivision;
  soundType: MetroSound;
  accentPattern?: AccentLevel[];
  volumeAccent?: number;
  volumeSubdiv?: number;
  training?: Partial<MetroTrainingConfig>;
  silence?: Partial<SilenceTrainingConfig>;
  isDefault?: boolean;
}

export const DEFAULT_METRO_PRESETS: MetroPreset[] = [
  {
    id: "default_warmup", name: "Warm-up 60", isDefault: true,
    bpm: 60, signature: { numerator: 4, denominator: 4 },
    subdivision: "quarter", soundType: "click",
    accentPattern: [2, 0, 1, 0],
  },
  {
    id: "default_rock", name: "Groove Rock", isDefault: true,
    bpm: 100, signature: { numerator: 4, denominator: 4 },
    subdivision: "eighth", soundType: "rimshot",
    accentPattern: [2, 0, 1, 0],
  },
  {
    id: "default_shuffle", name: "Shuffle", isDefault: true,
    bpm: 96, signature: { numerator: 4, denominator: 4 },
    subdivision: "triplet", soundType: "click",
    accentPattern: [2, 0, 1, 0],
  },
  {
    id: "default_funk", name: "Funk 16th", isDefault: true,
    bpm: 90, signature: { numerator: 4, denominator: 4 },
    subdivision: "sixteenth", soundType: "hihat",
    accentPattern: [2, 1, 0, 1],
  },
  {
    id: "default_jazz", name: "Jazz Swing", isDefault: true,
    bpm: 132, signature: { numerator: 4, denominator: 4 },
    subdivision: "triplet", soundType: "hihat",
    accentPattern: [1, 0, 2, 0],
  },
  {
    id: "default_metal", name: "Metal Double", isDefault: true,
    bpm: 160, signature: { numerator: 4, denominator: 4 },
    subdivision: "sixteenth", soundType: "kick",
    accentPattern: [2, 1, 2, 1],
  },
  {
    id: "default_afro", name: "Afro 6/8", isDefault: true,
    bpm: 112, signature: { numerator: 6, denominator: 8 },
    subdivision: "eighth", soundType: "woodblock",
    accentPattern: [2, 0, 0, 1, 0, 0],
  },
  {
    id: "default_prog78", name: "7/8 Prog", isDefault: true,
    bpm: 105, signature: { numerator: 7, denominator: 8 },
    subdivision: "eighth", soundType: "click",
    accentPattern: [2, 0, 1, 0, 2, 0, 1],
  },
  {
    id: "default_silence", name: "Silence Challenge", isDefault: true,
    bpm: 90, signature: { numerator: 4, denominator: 4 },
    subdivision: "quarter", soundType: "click",
    accentPattern: [2, 0, 1, 0],
    silence: { enabled: true, onMeasures: 4, offMeasures: 4, progressive: false },
  },
  {
    id: "default_speed", name: "Speed Builder", isDefault: true,
    bpm: 80, signature: { numerator: 4, denominator: 4 },
    subdivision: "eighth", soundType: "click",
    accentPattern: [2, 0, 1, 0],
    training: { enabled: true, targetBpm: 180, stepBpm: 5, stepMeasures: 4, descend: false },
  },
];

export function saveMetroPreset(preset: Omit<MetroPreset, "id">): MetroPreset {
  const all  = loadUserMetroPresets();
  const full: MetroPreset = { ...preset, id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
  all.push(full);
  try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(all)); } catch { /* */ }
  return full;
}

export function loadUserMetroPresets(): MetroPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MetroPreset[]) : [];
  } catch { return []; }
}

export function deleteMetroPreset(id: string): void {
  const all = loadUserMetroPresets().filter((p) => p.id !== id);
  try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(all)); } catch { /* */ }
}

/** Module-level singleton */
export const metronomeEngine = new MetronomeEngine();
