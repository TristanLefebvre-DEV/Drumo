import type { DrumPiece, QuantizedHit } from "../core/types";

export interface HitEvent {
  tick: number;
  piece: DrumPiece;
  velocity: number;
}

/** Build a sorted tick-based timeline from quantized hits. */
export const buildTimeline = (hits: QuantizedHit[]): HitEvent[] =>
  hits
    .map((h) => ({ tick: h.quantizedTick, piece: h.piece, velocity: h.velocity }))
    .sort((a, b) => a.tick - b.tick);

/** Return all events whose tick falls in (fromTick, toTick]. */
export const getHitsInRange = (
  timeline: HitEvent[],
  fromTick: number,
  toTick: number
): HitEvent[] => timeline.filter((e) => e.tick > fromTick && e.tick <= toTick);
