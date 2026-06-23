import * as Tone from "tone";
import { AudioClock } from "./audioClock";
import { MidiScheduler } from "./midiScheduler";
import { createKitVoices } from "./drumKitSampler";
import { drumKitManager } from "./drumKitManager";
import type { DrumVoice } from "./drumSampler";
import type { DrumPiece, ParsedDrumProject } from "../core/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TransportOptions {
  speed: number;                        // 0.25 – 2.0, 1.0 = normal
  loopEnabled: boolean;
  loopStartTick: number;
  loopEndTick: number;
  metronomeEnabled: boolean;
  countInBars: 0 | 1 | 2 | 4;
  muteState: Partial<Record<DrumPiece, boolean>>;
  soloState: Partial<Record<DrumPiece, boolean>>;
}

export const DEFAULT_TRANSPORT_OPTIONS: TransportOptions = {
  speed: 1,
  loopEnabled: false,
  loopStartTick: 0,
  loopEndTick: 0,
  metronomeEnabled: false,
  countInBars: 0,
  muteState: {},
  soloState: {},
};

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Professional-grade playback engine. Features:
 * - Zero-drift scheduling via AudioClock (setInterval + AudioContext.currentTime)
 * - Sub-millisecond event timing via MidiScheduler lookahead
 * - Pause/resume at exact tick position
 * - Seek with immediate clock re-sync
 * - Per-instrument mute / solo
 * - Speed control (re-seeks automatically to avoid drift after speed change)
 * - Loop region
 * - Integrated metronome (click accent on beat 1, regular click on other beats)
 * - Count-in (N bars of click before playback starts)
 */
export class PlaybackEngine {
  // Lazily initialized on first play() call (requires user gesture for AudioContext)
  private clock: AudioClock | null = null;
  private scheduler: MidiScheduler | null = null;
  private masterGain: Tone.Gain | null = null;
  private clickAccent: Tone.MembraneSynth | null = null;
  private clickBeat: Tone.NoiseSynth | null = null;
  private clickBeatFilter: Tone.Filter | null = null;
  private ctx: AudioContext | null = null;
  private initialized = false;

  private _isPlaying = false;
  private _isPaused = false;
  private pauseAtTick = 0;
  private startAudioTime = 0;
  private startTick = 0;
  private metroScheduledUpTo = -Infinity;

  private project: ParsedDrumProject | null = null;
  private options: TransportOptions = { ...DEFAULT_TRANSPORT_OPTIONS };

  private rafHandle: number | null = null;
  private onTickCb: ((tick: number) => void) | null = null;
  private onStateCb: ((playing: boolean, paused: boolean) => void) | null = null;

  // ─── Lazy init ──────────────────────────────────────────────────────────────

  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.ctx = Tone.context.rawContext as AudioContext;
    this.masterGain = new Tone.Gain(1).toDestination();
    this.clock = new AudioClock((from, to) => this.onScheduleWindow(from, to));
    this.scheduler = new MidiScheduler(this.masterGain);

    this.clickAccent = new Tone.MembraneSynth({
      pitchDecay: 0.015, octaves: 2.5,
      envelope: { attack: 0.001, decay: 0.055, sustain: 0 },
    }).connect(this.masterGain);

    this.clickBeatFilter = new Tone.Filter({ frequency: 6500, type: "highpass", Q: 2.2 }).connect(this.masterGain);
    this.clickBeat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.004 },
    }).connect(this.clickBeatFilter);

    // Apply the currently active drum kit to the fresh scheduler
    const kitVoices = createKitVoices(drumKitManager.activeKit, this.masterGain);
    this.scheduler.swapVoices(kitVoices);
    this.scheduler.setVelocityProcessor(
      (piece, rawVel) => drumKitManager.processVelocity(rawVel, piece)
    );
  }

  // ─── Internal scheduling ────────────────────────────────────────────────────

  private onScheduleWindow(from: number, to: number): void {
    if (!this._isPlaying || !this.project || !this.scheduler) return;
    this.scheduler.scheduleWindow(from, to);
    if (this.options.metronomeEnabled) this.scheduleMetronome(from, to);
  }

  private scheduleMetronome(from: number, to: number): void {
    if (!this.project || !this.ctx || !this.clickAccent || !this.clickBeat) return;
    const { ppq, tempoBpm, timeSignature } = this.project;
    const speed = this.options.speed;
    const ticksPerSec = (ppq * tempoBpm * speed) / 60;
    const ticksPerBeat = ppq;
    const ticksPerMeasure = ppq * timeSignature.numerator;

    const schedFrom = Math.max(from, this.metroScheduledUpTo);
    if (schedFrom >= to) return;

    const fromTick = this.startTick + (schedFrom - this.startAudioTime) * ticksPerSec;
    const toTick = this.startTick + (to - this.startAudioTime) * ticksPerSec;
    const first = Math.ceil(fromTick / ticksPerBeat);
    const last = Math.floor((toTick - 0.001) / ticksPerBeat);

    for (let beat = first; beat <= last; beat++) {
      const tick = beat * ticksPerBeat;
      if (this.options.loopEnabled && tick >= this.options.loopEndTick) break;
      const beatTime = this.startAudioTime + (tick - this.startTick) / ticksPerSec;
      if (beatTime < from) continue;
      if (tick % ticksPerMeasure === 0) {
        this.clickAccent.triggerAttackRelease("C4", "32n", beatTime, 0.95);
      } else {
        this.clickBeat.triggerAttackRelease("32n", beatTime, 0.62);
      }
    }
    this.metroScheduledUpTo = to;
  }

  private scheduleCountIn(startTime: number, duration: number): void {
    if (!this.project || duration <= 0 || !this.clickAccent || !this.clickBeat) return;
    const { tempoBpm, timeSignature } = this.project;
    const secPerBeat = 60 / (tempoBpm * this.options.speed);
    const beats = Math.round(duration / secPerBeat);
    for (let i = 0; i < beats; i++) {
      const time = startTime + i * secPerBeat;
      if (i % timeSignature.numerator === 0) {
        this.clickAccent.triggerAttackRelease("C4", "32n", time, 1);
      } else {
        this.clickBeat.triggerAttackRelease("32n", time, 0.72);
      }
    }
  }

  private countInDuration(): number {
    if (!this.project || this.options.countInBars === 0) return 0;
    const { tempoBpm, timeSignature } = this.project;
    return this.options.countInBars * (60 / (tempoBpm * this.options.speed)) * timeSignature.numerator;
  }

  // ─── RAF loop — only for UI position updates ─────────────────────────────

  private startRaf(): void {
    if (this.rafHandle !== null) return;
    const tick = () => {
      if (!this._isPlaying || !this.scheduler || !this.ctx) return;
      const ct = Math.max(0, this.scheduler.tickAtAudioTime(this.ctx.currentTime));

      if (this.options.loopEnabled && ct >= this.options.loopEndTick) {
        void this.seek(this.options.loopStartTick);
        return;
      }
      const maxTick = this.getMaxTick();
      if (!this.options.loopEnabled && ct >= maxTick) {
        this.stop();
        return;
      }

      this.onTickCb?.(ct);
      this.rafHandle = requestAnimationFrame(tick);
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  private stopRaf(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private getMaxTick(): number {
    if (!this.project) return 1920;
    if (this.project.hits.length === 0) return this.project.ppq * 4;
    return Math.max(...this.project.hits.map((h) => h.tick)) + this.project.ppq;
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  async play(fromTick?: number): Promise<void> {
    if (this._isPlaying) return;
    await Tone.start();
    this.ensureInit();

    const startTick = fromTick ?? (this._isPaused ? this.pauseAtTick : 0);
    this._isPaused = false;
    this._isPlaying = true;

    const countIn = this.countInDuration();
    this.startAudioTime = this.ctx!.currentTime + 0.025 + countIn;
    this.startTick = startTick;
    this.metroScheduledUpTo = this.ctx!.currentTime;

    this.scheduler!.configure({
      project: this.project!,
      startAudioTime: this.startAudioTime,
      startTick,
      speed: this.options.speed,
      muteState: this.options.muteState,
      soloState: this.options.soloState,
      loop: {
        enabled: this.options.loopEnabled,
        startTick: this.options.loopStartTick,
        endTick: this.options.loopEndTick,
      },
    });

    if (countIn > 0) this.scheduleCountIn(this.ctx!.currentTime + 0.025, countIn);
    this.clock!.start();
    this.startRaf();
    this.onStateCb?.(true, false);
  }

  pause(): void {
    if (!this._isPlaying || !this.scheduler || !this.ctx) return;
    this.pauseAtTick = Math.max(0, this.scheduler.tickAtAudioTime(this.ctx.currentTime));
    this._isPlaying = false;
    this._isPaused = true;
    this.clock?.stop();
    this.stopRaf();
    this.onTickCb?.(this.pauseAtTick);
    this.onStateCb?.(false, true);
  }

  stop(): void {
    this._isPlaying = false;
    this._isPaused = false;
    this.pauseAtTick = 0;
    this.clock?.stop();
    this.stopRaf();
    this.onTickCb?.(0);
    this.onStateCb?.(false, false);
  }

  async seek(tick: number): Promise<void> {
    const wasPlaying = this._isPlaying;
    if (wasPlaying) {
      this.clock?.stop();
      this.stopRaf();
      this._isPlaying = false;
    }
    this.pauseAtTick = Math.max(0, tick);
    this.onTickCb?.(this.pauseAtTick);
    if (wasPlaying) await this.play(this.pauseAtTick);
  }

  rewindToStart(): void {
    void this.seek(0);
  }

  rewindMeasure(): void {
    if (!this.project) return;
    const ticksPerMeasure = this.project.ppq * this.project.timeSignature.numerator;
    const ct =
      this._isPlaying && this.scheduler && this.ctx
        ? Math.max(0, this.scheduler.tickAtAudioTime(this.ctx.currentTime))
        : this.pauseAtTick;
    const measure = Math.floor(ct / ticksPerMeasure);
    const tickInMeasure = ct % ticksPerMeasure;
    const target =
      tickInMeasure < ticksPerMeasure * 0.1 && measure > 0
        ? (measure - 1) * ticksPerMeasure
        : measure * ticksPerMeasure;
    void this.seek(Math.max(0, target));
  }

  setProject(project: ParsedDrumProject): void {
    const wasPlaying = this._isPlaying;
    if (wasPlaying) this.stop();
    this.project = project;
    if (wasPlaying) void this.play(0);
  }

  updateOptions(patch: Partial<TransportOptions>): void {
    const speedChanged = patch.speed !== undefined && patch.speed !== this.options.speed;
    const loopChanged =
      patch.loopEnabled !== undefined ||
      patch.loopStartTick !== undefined ||
      patch.loopEndTick !== undefined;
    this.options = { ...this.options, ...patch };

    if (this._isPlaying && (speedChanged || loopChanged) && this.scheduler && this.ctx) {
      const ct = Math.max(0, this.scheduler.tickAtAudioTime(this.ctx.currentTime));
      void this.seek(ct);
    }
  }

  onTick(cb: (tick: number) => void): void {
    this.onTickCb = cb;
  }

  onStateChange(cb: (playing: boolean, paused: boolean) => void): void {
    this.onStateCb = cb;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get currentTick(): number {
    if (this._isPlaying && this.scheduler && this.ctx) {
      return Math.max(0, this.scheduler.tickAtAudioTime(this.ctx.currentTime));
    }
    return this.pauseAtTick;
  }

  // ─── Kit integration ────────────────────────────────────────────────────────

  /**
   * Expose the master gain node so external code can create kit voices
   * connected to the same output chain.
   */
  get masterOutput(): Tone.ToneAudioNode | null {
    return this.masterGain;
  }

  /**
   * Swap all drum voices for a new kit — seamless, no clicks.
   * If the engine isn't initialized yet, the voices will be applied
   * on the next `play()` call via `ensureInit()`.
   */
  swapKitVoices(newVoices: Map<DrumPiece, DrumVoice>): void {
    if (this.scheduler) {
      this.scheduler.swapVoices(newVoices);
    }
    // If not initialized: next ensureInit() will pick up drumKitManager.activeKit directly
  }

  /**
   * Swap a single voice for one piece (per-piece sound selection).
   * If not initialized yet, does nothing (kit voices will be created on play()).
   */
  swapSingleVoice(piece: DrumPiece, voice: import("./drumSampler").DrumVoice): void {
    this.scheduler?.swapSingleVoice(piece, voice);
  }

  /**
   * Install a velocity post-processor (kit curve + humanize + mixer volume).
   * Called after kit switch or mixer change.
   */
  setVelocityProcessor(fn: ((piece: DrumPiece, rawVel: number) => number) | null): void {
    this.scheduler?.setVelocityProcessor(fn);
  }

  /** Install humanize timing + velocity processors. Real-time — no playback restart. */
  setHumanizeProcessors(
    timing:   ((hit: import("../core/types").DrumHit) => number) | null,
    velocity: ((hit: import("../core/types").DrumHit, vel: number) => number) | null
  ): void {
    this.scheduler?.setHumanizeProcessors(timing, velocity);
  }

  dispose(): void {
    this.stop();
    if (this.initialized) {
      this.scheduler?.dispose();
      this.clickAccent?.dispose();
      this.clickBeat?.dispose();
      this.clickBeatFilter?.dispose();
      this.masterGain?.dispose();
    }
  }
}

/** Module-level singleton — import and use directly from anywhere. */
export const playbackEngine = new PlaybackEngine();
