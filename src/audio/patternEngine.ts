/**
 * PatternEngine — rhythm pattern model + drift-free scheduler.
 *
 * Architecture:
 *   RhythmPattern (measures → beats → steps)
 *   → pre-computed event list (offsetSecs per event)
 *   → AudioClock → Tone.js synths via metronomeEngine.triggerAt()
 *   → setTimeout UI callbacks
 *
 * Completely independent from MetronomeEngine's internal scheduling.
 * Uses MetronomeEngine's synths via the public triggerAt() API.
 */

import * as Tone from "tone";
import { AudioClock } from "./audioClock";
import { metronomeEngine } from "./metronomeEngine";
import type { MetroSignature, AccentLevel } from "./metronomeEngine";

// ─── Public data types ────────────────────────────────────────────────────────

export type StepAccent = "normal" | "accent" | "strong" | "ghost";

const ACCENT_TO_LEVEL: Record<StepAccent, AccentLevel> = {
  ghost:  0,
  normal: 1,
  accent: 2,
  strong: 2,
};

export interface RhythmStep {
  active: boolean;
  accent: StepAccent;
}

export interface RhythmBeat {
  /** Subdivisions per beat: 1–8 */
  subdivisions: number;
  /** Array length must equal subdivisions */
  steps: RhythmStep[];
}

export interface RhythmMeasure {
  signature: MetroSignature;
  /** Array length must equal signature.numerator */
  beats: RhythmBeat[];
}

export interface RhythmPattern {
  id: string;
  name: string;
  bpm: number;
  measures: RhythmMeasure[];
}

// ─── Transport (shared with visualizer) ──────────────────────────────────────

export interface PatternTransport {
  isPlaying: boolean;
  /** AudioContext.currentTime when the current loop started */
  startAudioTime: number;
  /** Duration of one full pattern loop in seconds */
  totalDurationSecs: number;
  /** beatOffsets[mi][bi] = start time (offset from loop start) for that beat */
  beatOffsets: number[][];
  /** stepDuration[mi][bi] = seconds per step for that beat */
  stepDurations: number[][];
}

export type PatternEventCallback = (
  measureIndex: number,
  beatIndex: number,
  stepIndex: number,
  accent: StepAccent,
  loopIndex: number,
) => void;

// ─── Internal pre-computed event ──────────────────────────────────────────────

interface ScheduledEvent {
  offsetSecs: number;
  measureIndex: number;
  beatIndex: number;
  stepIndex: number;
  accent: StepAccent;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns seconds per beat for a given BPM and time-sig denominator. */
function beatDurationSecs(bpm: number, denominator: number): number {
  // A quarter note = 60/bpm. Scale by 4/denominator to normalise.
  return (60 / bpm) * (4 / denominator);
}

/** Build a default beat with all steps active at normal accent. */
export function makeBeat(subdivisions: number): RhythmBeat {
  return {
    subdivisions,
    steps: Array.from({ length: subdivisions }, (_, i) => ({
      active: true,
      accent: i === 0 ? "accent" : "normal",
    })),
  };
}

/** Build an N-beat measure with 1 subdivision per beat from a signature. */
export function makeMeasure(sig: MetroSignature, subdivisions = 1): RhythmMeasure {
  return {
    signature: sig,
    beats: Array.from({ length: sig.numerator }, (_, i) =>
      ({
        subdivisions,
        steps: Array.from({ length: subdivisions }, (_, s) => ({
          active: true,
          accent: (i === 0 && s === 0) ? "strong" : s === 0 ? "accent" : "normal",
        })),
      })
    ),
  };
}

// ─── PatternEngine ────────────────────────────────────────────────────────────

export class PatternEngine {
  private clock: AudioClock | null = null;
  private ctx: AudioContext | null = null;

  private _pattern: RhythmPattern | null = null;
  private _bpm = 120;
  private _isRunning = false;
  private startAudioTime = 0;
  private scheduledUpTo = -Infinity;

  // Pre-computed schedule
  private _schedule: ScheduledEvent[] = [];
  private _totalDurationSecs = 0;
  private _beatOffsets: number[][] = [];
  private _stepDurations: number[][] = [];

  // Callbacks
  private onEventCb: PatternEventCallback | null = null;
  private onStopCb: (() => void) | null = null;
  private onMeasureCb: ((measureIndex: number, loopIndex: number) => void) | null = null;

  // Prevent duplicate scheduling of the same event time
  private _scheduledEventTimes = new Set<string>();

  // ── Initialization ──────────────────────────────────────────────────────────

  private ensureCtx(): void {
    if (this.ctx) return;
    this.ctx = Tone.context.rawContext as AudioContext;
    this.clock = new AudioClock((from, to) => this.scheduleWindow(from, to));
    // Ensure MetronomeEngine's synths are ready for triggerAt()
    metronomeEngine.initAudio();
  }

  // ── Schedule building ────────────────────────────────────────────────────────

  /** Pre-computes the flat event list and timing tables from the current pattern. */
  private rebuildSchedule(): void {
    this._schedule = [];
    this._beatOffsets = [];
    this._stepDurations = [];
    this._totalDurationSecs = 0;

    if (!this._pattern) return;

    let t = 0;
    for (let mi = 0; mi < this._pattern.measures.length; mi++) {
      const measure = this._pattern.measures[mi];
      const beatDur = beatDurationSecs(this._bpm, measure.signature.denominator);
      this._beatOffsets.push([]);
      this._stepDurations.push([]);

      for (let bi = 0; bi < measure.beats.length; bi++) {
        const beat = measure.beats[bi];
        const stepDur = beatDur / beat.subdivisions;
        this._beatOffsets[mi].push(t);
        this._stepDurations[mi].push(stepDur);

        for (let si = 0; si < beat.steps.length; si++) {
          const step = beat.steps[si];
          if (step.active) {
            this._schedule.push({
              offsetSecs: t,
              measureIndex: mi,
              beatIndex: bi,
              stepIndex: si,
              accent: step.accent,
            });
          }
          t += stepDur;
        }
      }
    }

    this._totalDurationSecs = t;
  }

  // ── Core scheduling window ────────────────────────────────────────────────────

  private scheduleWindow(windowStart: number, windowEnd: number): void {
    if (!this._isRunning || !this.ctx || this._totalDurationSecs <= 0) return;

    const schedFrom = Math.max(windowStart, this.scheduledUpTo);
    if (schedFrom >= windowEnd) return;

    const elapsed0 = schedFrom - this.startAudioTime;
    const elapsed1 = windowEnd - this.startAudioTime;

    const loopStart = Math.max(0, Math.floor(elapsed0 / this._totalDurationSecs));
    const loopEnd   = Math.ceil(elapsed1  / this._totalDurationSecs);

    for (let loop = loopStart; loop <= loopEnd; loop++) {
      const loopBase = this.startAudioTime + loop * this._totalDurationSecs;

      for (const event of this._schedule) {
        const eventTime = loopBase + event.offsetSecs;
        if (eventTime < schedFrom || eventTime >= windowEnd) continue;

        const key = `${loop}_${event.measureIndex}_${event.beatIndex}_${event.stepIndex}`;
        if (this._scheduledEventTimes.has(key)) continue;
        this._scheduledEventTimes.add(key);

        // Prune old keys to prevent unbounded growth
        if (this._scheduledEventTimes.size > 2000) {
          const iter = this._scheduledEventTimes.values();
          for (let i = 0; i < 500; i++) {
            const next = iter.next();
            if (next.done) break;
            this._scheduledEventTimes.delete(next.value);
          }
        }

        // ── Audio ────────────────────────────────────────────────────────────
        const level = ACCENT_TO_LEVEL[event.accent];
        metronomeEngine.triggerAt(level, eventTime);

        // ── UI callback ───────────────────────────────────────────────────────
        const nowAudio = this.ctx.currentTime;
        const delayMs  = Math.max(0, (eventTime - nowAudio) * 1000);
        const { measureIndex, beatIndex, stepIndex, accent } = event;
        setTimeout(() => {
          this.onEventCb?.(measureIndex, beatIndex, stepIndex, accent, loop);
          if (beatIndex === 0 && stepIndex === 0) {
            this.onMeasureCb?.(measureIndex, loop);
          }
        }, delayMs);
      }
    }

    this.scheduledUpTo = windowEnd;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this._isRunning) return;
    await Tone.start();
    this.ensureCtx();
    this.rebuildSchedule();
    if (this._totalDurationSecs <= 0) return;

    this._isRunning = true;
    this._scheduledEventTimes.clear();
    this.startAudioTime = this.ctx!.currentTime + 0.05;
    this.scheduledUpTo  = this.ctx!.currentTime;
    this.clock!.start();
  }

  stop(): void {
    if (!this._isRunning) return;
    this._isRunning = false;
    this.clock?.stop();
    this._scheduledEventTimes.clear();
    this.onStopCb?.();
  }

  get isRunning(): boolean { return this._isRunning; }

  // ── Pattern ───────────────────────────────────────────────────────────────────

  get pattern(): RhythmPattern | null { return this._pattern; }

  setPattern(p: RhythmPattern): void {
    this._pattern = p;
    this._bpm = p.bpm;
    if (this._isRunning) {
      // Restart cleanly with new pattern
      this.stop();
      void this.start();
    }
  }

  updatePattern(updater: (p: RhythmPattern) => RhythmPattern): void {
    if (!this._pattern) return;
    this._pattern = updater(this._pattern);
    this.rebuildSchedule();
    if (this._isRunning) {
      this._scheduledEventTimes.clear();
      this.startAudioTime = this.ctx!.currentTime + 0.02;
      this.scheduledUpTo  = this.ctx!.currentTime;
    }
  }

  // ── BPM ───────────────────────────────────────────────────────────────────────

  get bpm(): number { return this._bpm; }

  setBpm(bpm: number): void {
    this._bpm = Math.max(20, Math.min(300, Math.round(bpm)));
    if (this._pattern) this._pattern = { ...this._pattern, bpm: this._bpm };
    this.rebuildSchedule();
    if (this._isRunning) {
      this._scheduledEventTimes.clear();
      const now = this.ctx?.currentTime ?? 0;
      this.startAudioTime = now + 0.02;
      this.scheduledUpTo  = now;
    }
  }

  // ── Transport state (for visualizer) ─────────────────────────────────────────

  getTransport(): PatternTransport {
    return {
      isPlaying: this._isRunning,
      startAudioTime: this.startAudioTime,
      totalDurationSecs: this._totalDurationSecs,
      beatOffsets: this._beatOffsets,
      stepDurations: this._stepDurations,
    };
  }

  /** Real-time position in the loop. Used by CircularRhythmView via requestAnimationFrame. */
  getCurrentPosition(): {
    loopProgress: number;
    measureIndex: number;
    beatIndex: number;
    stepIndex: number;
    beatProgress: number;
  } | null {
    if (!this._isRunning || !this.ctx || this._totalDurationSecs <= 0) return null;

    const elapsed     = this.ctx.currentTime - this.startAudioTime;
    const loopElapsed = ((elapsed % this._totalDurationSecs) + this._totalDurationSecs) % this._totalDurationSecs;
    const loopProgress = loopElapsed / this._totalDurationSecs;

    // Find current beat
    let measureIndex = 0;
    let beatIndex    = 0;
    let stepIndex    = 0;
    let beatProgress = 0;

    outer:
    for (let mi = 0; mi < (this._beatOffsets.length ?? 0); mi++) {
      for (let bi = 0; bi < (this._beatOffsets[mi]?.length ?? 0); bi++) {
        const beatStart = this._beatOffsets[mi][bi];
        const stepDur   = this._stepDurations[mi][bi];
        const beatSubs  = this._pattern?.measures[mi]?.beats[bi]?.subdivisions ?? 1;
        const beatEnd   = beatStart + stepDur * beatSubs;

        if (loopElapsed >= beatStart && loopElapsed < beatEnd) {
          measureIndex = mi;
          beatIndex    = bi;
          beatProgress = (loopElapsed - beatStart) / (beatEnd - beatStart);
          stepIndex    = Math.floor(beatProgress * beatSubs);
          break outer;
        }
      }
    }

    return { loopProgress, measureIndex, beatIndex, stepIndex, beatProgress };
  }

  // ── Callbacks ─────────────────────────────────────────────────────────────────

  onEvent(cb: PatternEventCallback): void  { this.onEventCb = cb; }
  onStop(cb: () => void): void             { this.onStopCb = cb; }
  onMeasure(cb: (mi: number, loop: number) => void): void { this.onMeasureCb = cb; }

  // ── Preset serialization ─────────────────────────────────────────────────────

  exportJson(): string { return JSON.stringify(this._pattern, null, 2); }

  importJson(json: string): void {
    try {
      const p = JSON.parse(json) as RhythmPattern;
      this.setPattern(p);
    } catch { /* ignore bad JSON */ }
  }
}

// ─── Default patterns ────────────────────────────────────────────────────────

function sig(n: number, d: number): MetroSignature { return { numerator: n, denominator: d }; }

function beat(subs: number, accents: StepAccent[]): RhythmBeat {
  return {
    subdivisions: subs,
    steps: Array.from({ length: subs }, (_, i) => ({
      active: true,
      accent: accents[i] ?? "normal",
    })),
  };
}

export const DEFAULT_PATTERNS: RhythmPattern[] = [
  {
    id: "pat_simple44",
    name: "4/4 Simple",
    bpm: 80,
    measures: [{
      signature: sig(4, 4),
      beats: [
        beat(1, ["strong"]),
        beat(1, ["normal"]),
        beat(1, ["normal"]),
        beat(1, ["normal"]),
      ],
    }],
  },
  {
    id: "pat_16th44",
    name: "4/4 Doubles croches",
    bpm: 100,
    measures: [{
      signature: sig(4, 4),
      beats: [
        beat(4, ["strong", "normal", "normal", "normal"]),
        beat(4, ["accent", "normal", "normal", "normal"]),
        beat(4, ["strong", "normal", "normal", "normal"]),
        beat(4, ["accent", "normal", "normal", "normal"]),
      ],
    }],
  },
  {
    id: "pat_accent24",
    name: "4/4 Accent 2 et 4",
    bpm: 90,
    measures: [{
      signature: sig(4, 4),
      beats: [
        beat(1, ["strong"]),
        beat(1, ["accent"]),
        beat(1, ["normal"]),
        beat(1, ["accent"]),
      ],
    }],
  },
  {
    id: "pat_funk",
    name: "4/4 Funk",
    bpm: 95,
    measures: [{
      signature: sig(4, 4),
      beats: [
        beat(4, ["strong", "ghost", "normal", "ghost"]),
        beat(2, ["accent", "ghost"]),
        beat(4, ["normal", "ghost", "accent", "ghost"]),
        beat(4, ["accent", "ghost", "ghost", "strong"]),
      ],
    }],
  },
  {
    id: "pat_afro68",
    name: "6/8 Afro",
    bpm: 112,
    measures: [{
      signature: sig(6, 8),
      beats: [
        beat(1, ["strong"]),
        beat(1, ["normal"]),
        beat(1, ["normal"]),
        beat(1, ["accent"]),
        beat(1, ["normal"]),
        beat(1, ["normal"]),
      ],
    }],
  },
  {
    id: "pat_prog78",
    name: "7/8 (2+2+3)",
    bpm: 105,
    measures: [{
      signature: sig(7, 8),
      beats: [
        beat(1, ["strong"]),
        beat(1, ["normal"]),
        beat(1, ["accent"]),
        beat(1, ["normal"]),
        beat(1, ["strong"]),
        beat(1, ["normal"]),
        beat(1, ["normal"]),
      ],
    }],
  },
  {
    id: "pat_prog54",
    name: "5/4 Progressif",
    bpm: 88,
    measures: [{
      signature: sig(5, 4),
      beats: [
        beat(1, ["strong"]),
        beat(1, ["normal"]),
        beat(1, ["accent"]),
        beat(1, ["normal"]),
        beat(1, ["normal"]),
      ],
    }],
  },
  {
    id: "pat_exercise_8111",
    name: "Exercice 8+1+1+1",
    bpm: 70,
    measures: [{
      signature: sig(4, 4),
      beats: [
        beat(8, ["strong", "normal", "normal", "normal", "accent", "normal", "normal", "normal"]),
        beat(1, ["accent"]),
        beat(1, ["normal"]),
        beat(1, ["normal"]),
      ],
    }],
  },
  {
    id: "pat_endurance16th",
    name: "Endurance Doubles Croches",
    bpm: 100,
    measures: [{
      signature: sig(4, 4),
      beats: [
        beat(4, ["strong", "normal", "normal", "normal"]),
        beat(4, ["normal", "normal", "normal", "normal"]),
        beat(4, ["accent", "normal", "normal", "normal"]),
        beat(4, ["normal", "normal", "normal", "normal"]),
      ],
    }],
  },
  {
    id: "pat_ghost_accent",
    name: "Ghost Notes & Accents",
    bpm: 85,
    measures: [{
      signature: sig(4, 4),
      beats: [
        beat(4, ["strong", "ghost", "normal", "ghost"]),
        beat(4, ["ghost", "accent", "ghost", "normal"]),
        beat(4, ["strong", "ghost", "ghost", "accent"]),
        beat(4, ["ghost", "ghost", "accent", "strong"]),
      ],
    }],
  },
];

const STORAGE_KEY = "drumo:patterns_v1";

export function savePattern(p: RhythmPattern): void {
  const all = loadPatterns().filter((x) => x.id !== p.id);
  all.push(p);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* */ }
}

export function loadPatterns(): RhythmPattern[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RhythmPattern[]) : [];
  } catch { return []; }
}

export function deletePattern(id: string): void {
  const all = loadPatterns().filter((p) => p.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* */ }
}

/** Module-level singleton */
export const patternEngine = new PatternEngine();
