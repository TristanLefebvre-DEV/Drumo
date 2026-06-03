import * as Tone from "tone";

export type ScheduleCallback = (windowStart: number, windowEnd: number) => void;

/**
 * Drift-free ahead-of-time scheduler built on AudioContext.currentTime.
 * Fires onSchedule(windowStart, windowEnd) every intervalMs milliseconds,
 * giving the consumer a lookahead window in which to schedule audio events.
 *
 * Because AudioContext.currentTime advances at hardware clock rate (not JS
 * clock rate), this completely eliminates the drift that RAF-based schedulers
 * accumulate over long playback sessions.
 */
export class AudioClock {
  private handle: ReturnType<typeof setInterval> | null = null;
  private readonly ctx: AudioContext;

  /** How far ahead (in seconds) to schedule events. */
  readonly lookaheadSec = 0.08;
  /** How often (in ms) to run the scheduling callback. */
  readonly intervalMs = 22;

  constructor(private readonly onSchedule: ScheduleCallback) {
    this.ctx = Tone.context.rawContext as AudioContext;
  }

  start(): void {
    if (this.handle !== null) return;
    const fireWindow = () => {
      const now = this.ctx.currentTime;
      this.onSchedule(now, now + this.lookaheadSec);
    };
    // Fire immediately so notes at startTick are scheduled before the first
    // setInterval tick (which arrives ~22 ms later and could be slightly late).
    fireWindow();
    this.handle = setInterval(fireWindow, this.intervalMs);
  }

  stop(): void {
    if (this.handle !== null) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  get running(): boolean {
    return this.handle !== null;
  }
}
