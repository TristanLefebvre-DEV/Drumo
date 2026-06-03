/**
 * PrecisionEngine — measures drummer tap accuracy against metronome beats.
 *
 * Usage:
 *   1. Call recordBeat(audioTime) from MetronomeEngine beat callback
 *   2. Call recordTap() from UI when user taps (spacebar / pad / button)
 *   3. Read getMetrics() for real-time stats
 *
 * Timing domain: all times are in performance.now() ms.
 * The engine converts AudioContext times to performance.now() domain
 * using a calibrated offset computed on first recordBeat call.
 */

import * as Tone from "tone";

export interface PrecisionMetrics {
  /** Average deviation in ms (negative = early, positive = late) */
  avg: number;
  /** Standard deviation in ms — lower = more consistent */
  stdDev: number;
  /** 0–100 stability score (100 = rock-solid) */
  stability: number;
  /** 0–100 overall score combining accuracy + stability */
  score: number;
  /** Last N deviations in ms for the history bar */
  history: number[];
  /** How many valid taps have been scored this session */
  tapCount: number;
  /** Most recent raw deviation in ms */
  lastDeviation: number | null;
}

interface TapRecord {
  perfTime: number;
  deviation: number | null;
}

export class PrecisionEngine {
  /** How far ahead/behind a tap can be and still match a beat (ms) */
  private readonly MATCH_WINDOW_MS = 600;
  private readonly HISTORY_SIZE    = 16;

  /** Calibrated offset: perfNow - audioCtxTime * 1000 */
  private audioToPerfOffset: number | null = null;

  /** Expected beat times in performance.now() ms */
  private expectedBeats: number[] = [];

  /** Tap records */
  private taps: TapRecord[] = [];

  /** Whether precision mode is active */
  private _active = false;

  // ─── Activation ──────────────────────────────────────────────────────────────

  activate(): void {
    this._active = true;
    this.reset();
  }

  deactivate(): void {
    this._active = false;
  }

  get active(): boolean { return this._active; }

  // ─── Beat recording (called from metronome beat callback) ─────────────────────

  recordBeat(audioTime: number): void {
    if (!this._active) return;

    // Calibrate offset once using AudioContext.currentTime vs performance.now()
    if (this.audioToPerfOffset === null) {
      const ctx = Tone.context.rawContext as AudioContext;
      this.audioToPerfOffset = performance.now() - ctx.currentTime * 1000;
    }

    const perfTime = audioTime * 1000 + this.audioToPerfOffset;
    this.expectedBeats.push(perfTime);

    // Keep only recent beats to avoid matching against old events
    if (this.expectedBeats.length > this.HISTORY_SIZE * 2) {
      this.expectedBeats.shift();
    }
  }

  // ─── Tap recording (called from UI, e.g. keyboard handler) ───────────────────

  recordTap(): void {
    if (!this._active) return;

    const tapTime   = performance.now();
    const closest   = this.findClosestBeat(tapTime);
    const deviation = closest !== null ? tapTime - closest : null;

    this.taps.push({ perfTime: tapTime, deviation });
    if (this.taps.length > this.HISTORY_SIZE) {
      this.taps.shift();
    }
  }

  // ─── Metrics ─────────────────────────────────────────────────────────────────

  getMetrics(): PrecisionMetrics {
    const valid = this.taps.filter((t) => t.deviation !== null);

    if (valid.length === 0) {
      return { avg: 0, stdDev: 0, stability: 0, score: 0, history: [], tapCount: 0, lastDeviation: null };
    }

    const deviations  = valid.map((t) => t.deviation!);
    const avg         = deviations.reduce((s, v) => s + v, 0) / deviations.length;
    const variance    = deviations.reduce((s, v) => s + (v - avg) ** 2, 0) / deviations.length;
    const stdDev      = Math.sqrt(variance);

    // Stability: 100 at 0ms stdDev, 0 at 50ms stdDev
    const stability   = Math.max(0, Math.min(100, Math.round(100 - (stdDev / 50) * 100)));

    // Accuracy: 100 at 0ms avg error, 0 at 50ms avg error
    const accuracy    = Math.max(0, Math.min(100, Math.round(100 - (Math.abs(avg) / 50) * 100)));

    const score       = Math.round((accuracy * 0.4 + stability * 0.6));
    const last        = deviations[deviations.length - 1] ?? null;

    return {
      avg:          Math.round(avg * 10) / 10,
      stdDev:       Math.round(stdDev * 10) / 10,
      stability,
      score,
      history:      deviations.slice(-8),
      tapCount:     valid.length,
      lastDeviation: last !== undefined ? Math.round(last * 10) / 10 : null,
    };
  }

  // ─── Reset ────────────────────────────────────────────────────────────────────

  reset(): void {
    this.expectedBeats       = [];
    this.taps                = [];
    this.audioToPerfOffset   = null;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private findClosestBeat(tapTime: number): number | null {
    if (this.expectedBeats.length === 0) return null;
    let best     = this.expectedBeats[0];
    let bestDist = Math.abs(tapTime - best);
    for (const t of this.expectedBeats) {
      const d = Math.abs(tapTime - t);
      if (d < bestDist) { bestDist = d; best = t; }
    }
    return bestDist <= this.MATCH_WINDOW_MS ? best : null;
  }
}

/** Module-level singleton */
export const precisionEngine = new PrecisionEngine();
