import { fillMeasureSlots, type DisplaySlot } from "./restOptimizer";
import type { MeasureData, TimeSignature } from "../core/types";

export interface CleanupOptions {
  enabled: boolean;
}

export const DEFAULT_CLEANUP: CleanupOptions = { enabled: false };

/**
 * Produce a display-only slot list for one measure.
 *
 * Contract: this function NEVER modifies MIDI timing. It only produces
 * display metadata (durations, rest positions) for VexFlow rendering.
 * The original `project.hits` and `quantizedHits` are untouched.
 */
export const cleanMeasure = (
  measure: MeasureData,
  ppq: number,
  signature: TimeSignature,
  ticksPerMeasure: number
): DisplaySlot[] => {
  const beatTicks = ppq * (4 / signature.denominator);
  return fillMeasureSlots(measure.chords, ticksPerMeasure, ppq, beatTicks);
};
