import type { DrumHit, DrumPiece, ParsedDrumProject } from "../core/types";
import type * as Tone from "tone";
import { createVoiceForPiece, type DrumVoice } from "./drumSampler";

export interface SchedulerConfig {
  project: ParsedDrumProject;
  /** AudioContext time at which tick `startTick` plays. */
  startAudioTime: number;
  startTick: number;
  speed: number;
  muteState: Readonly<Partial<Record<DrumPiece, boolean>>>;
  soloState: Readonly<Partial<Record<DrumPiece, boolean>>>;
  loop: { enabled: boolean; startTick: number; endTick: number };
}

/**
 * Schedules drum hits into the Web Audio graph with sub-millisecond precision.
 * Receives scheduling windows from AudioClock and fires voice.trigger(vel, time)
 * for every hit whose tick falls within [windowStart, windowEnd).
 *
 * Tracks `scheduledUpTo` to guarantee each event is fired exactly once,
 * even when windows overlap due to setInterval jitter.
 *
 * Supports real-time kit switching via swapVoices() — no clicks, no interruption.
 * Supports per-piece volume scaling via setPieceVolumes() for the mixer.
 */
export class MidiScheduler {
  private voices = new Map<DrumPiece, DrumVoice>();
  private sortedHits: DrumHit[] = [];
  private config: SchedulerConfig | null = null;
  private scheduledUpTo = -Infinity;

  /** Per-piece volume multiplier set by the DrumMixer (0–1). */
  private pieceVolumes = new Map<DrumPiece, number>();

  /** Per-piece velocity post-processor (applied after volume, before trigger). */
  private velocityProcessor: ((piece: DrumPiece, rawVel: number) => number) | null = null;

  /** Humanize: returns a tick offset (positive = late, negative = early) per hit. */
  private humanizeTimingProcessor: ((hit: DrumHit) => number) | null = null;
  /** Humanize: returns a velocity multiplier applied after the kit processor. */
  private humanizeVelocityProcessor: ((hit: DrumHit, vel: number) => number) | null = null;

  constructor(private readonly output: Tone.ToneAudioNode) {
    this.warmVoices();
  }

  /** Pre-create all synths so the first note has zero latency. */
  private warmVoices(): void {
    const pieces: DrumPiece[] = [
      "kick", "snare", "snareRim",
      "hihatClosed", "hihatOpen", "hihatPedal",
      "tomHigh", "tomMid", "tomLow",
      "crash", "ride", "splash", "otherCymbal",
    ];
    for (const piece of pieces) {
      this.voices.set(piece, createVoiceForPiece(piece, this.output));
    }
  }

  configure(config: SchedulerConfig): void {
    this.config = config;
    this.sortedHits = [...config.project.hits].sort((a, b) => a.tick - b.tick);
    this.scheduledUpTo = config.startAudioTime - 0.001;
  }

  scheduleWindow(windowStart: number, windowEnd: number): void {
    if (!this.config) return;
    const { startAudioTime, startTick, project, speed, muteState, soloState, loop } = this.config;
    const ticksPerSec = (project.ppq * project.tempoBpm * speed) / 60;
    const hasSolo = (Object.values(soloState) as boolean[]).some(Boolean);

    const schedFrom = Math.max(windowStart, this.scheduledUpTo);
    if (schedFrom >= windowEnd) return;

    const fromTick = startTick + (schedFrom - startAudioTime) * ticksPerSec;
    let toTick = startTick + (windowEnd - startAudioTime) * ticksPerSec;
    if (loop.enabled) toTick = Math.min(toTick, loop.endTick);

    for (const hit of this.sortedHits) {
      if (hit.tick < fromTick) continue;
      if (hit.tick >= toTick) break;

      // Per-piece mute / solo
      const muted = hasSolo ? !soloState[hit.piece] : !!muteState[hit.piece];
      if (muted) continue;

      // Per-note mute
      if (hit.muted) continue;

      // Probability: skip randomly (each pass is independent)
      if (hit.probability !== undefined && hit.probability < 100) {
        if (Math.random() * 100 > hit.probability) continue;
      }

      // Humanize timing: deterministic tick offset from the humanize engine
      const tickOffset = this.humanizeTimingProcessor ? this.humanizeTimingProcessor(hit) : 0;
      const eventTime  = startAudioTime + ((hit.tick + tickOffset) - startTick) / ticksPerSec;

      // Apply per-piece volume + optional velocity processor (kit curve + humanize)
      let velocity = hit.velocity;
      if (this.velocityProcessor) {
        velocity = this.velocityProcessor(hit.piece, velocity);
      } else {
        const pieceVol = this.pieceVolumes.get(hit.piece) ?? 1.0;
        velocity = Math.max(0, Math.min(1, velocity * pieceVol));
      }
      // Humanize velocity: applied after the kit curve processor
      if (this.humanizeVelocityProcessor) {
        velocity = this.humanizeVelocityProcessor(hit, velocity);
      }

      const noteType = hit.noteType ?? "normal";

      if (noteType === "roll") {
        // Schedule rapid hits every 1/32 note for the note's duration
        const rollInterval = 60 / (project.tempoBpm * speed) / 8;
        const endTime = startAudioTime + ((hit.tick + hit.durationTicks) - startTick) / ticksPerSec;
        let t = eventTime;
        while (t < endTime) {
          this.voices.get(hit.piece)?.trigger(velocity, t);
          t += rollInterval;
        }
        continue;
      }

      if (noteType === "flam") {
        // Grace note: soft hit ~30 ms before the main strike
        const graceTime = eventTime - 0.030;
        this.voices.get(hit.piece)?.trigger(velocity * 0.35, graceTime);
      }

      this.voices.get(hit.piece)?.trigger(velocity, eventTime);
    }

    this.scheduledUpTo = windowEnd;
  }

  /** Returns the playback tick corresponding to the given AudioContext time. */
  tickAtAudioTime(audioTime: number): number {
    if (!this.config) return 0;
    const { startAudioTime, startTick, project, speed } = this.config;
    const ticksPerSec = (project.ppq * project.tempoBpm * speed) / 60;
    return startTick + (audioTime - startAudioTime) * ticksPerSec;
  }

  // ─── Kit switching ───────────────────────────────────────────────────────────

  /**
   * Swap all voices for a new kit — zero-click, zero-interruption.
   *
   * New voices are installed immediately. Old voices are disposed after
   * a 250ms grace period to let any already-scheduled audio finish.
   * The next scheduling window will use the new voices automatically.
   */
  swapVoices(newVoices: Map<DrumPiece, DrumVoice>): void {
    const oldVoices = this.voices;
    this.voices = newVoices;
    // Grace period: old voices may have triggers already scheduled in the
    // WebAudio graph — dispose them after audio settles
    setTimeout(() => {
      for (const v of oldVoices.values()) {
        try { v.dispose(); } catch { /* ignore disposal errors */ }
      }
    }, 250);
  }

  /**
   * Swap a single voice for one drum piece — sans toucher aux autres.
   * Utilisé pour la sélection de son pièce par pièce.
   */
  swapSingleVoice(piece: DrumPiece, newVoice: DrumVoice): void {
    const oldVoice = this.voices.get(piece);
    this.voices.set(piece, newVoice);
    if (oldVoice) {
      setTimeout(() => { try { oldVoice.dispose(); } catch { /* ignore */ } }, 250);
    }
  }

  // ─── Mixer volume control ─────────────────────────────────────────────────────

  /**
   * Set per-piece volume multipliers from the DrumMixer.
   * Applied on every trigger call — no audio graph restructuring needed.
   */
  setPieceVolumes(volumes: Partial<Record<DrumPiece, number>>): void {
    for (const [piece, vol] of Object.entries(volumes) as [DrumPiece, number][]) {
      this.pieceVolumes.set(piece, Math.max(0, Math.min(1, vol)));
    }
  }

  /** Clear a single piece override (reverts to 1.0). */
  clearPieceVolume(piece: DrumPiece): void {
    this.pieceVolumes.delete(piece);
  }

  /** Clear all mixer volume overrides. */
  clearAllPieceVolumes(): void {
    this.pieceVolumes.clear();
  }

  // ─── Velocity processor ───────────────────────────────────────────────────────

  /**
   * Install a custom velocity processor that receives (piece, rawVelocity)
   * and returns the final velocity after kit curve + humanize + mixer volume.
   * When set, this takes priority over pieceVolumes.
   */
  setVelocityProcessor(fn: ((piece: DrumPiece, rawVel: number) => number) | null): void {
    this.velocityProcessor = fn;
  }

  /** Install humanize processors (timing + velocity). Pass null to disable. */
  setHumanizeProcessors(
    timing:   ((hit: DrumHit) => number) | null,
    velocity: ((hit: DrumHit, vel: number) => number) | null
  ): void {
    this.humanizeTimingProcessor   = timing;
    this.humanizeVelocityProcessor = velocity;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  dispose(): void {
    for (const v of this.voices.values()) v.dispose();
    this.voices.clear();
  }
}
