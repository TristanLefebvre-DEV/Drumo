import { fillMeasureSlots, type DisplaySlot } from "./restOptimizer";
import { normalizeMeasure } from "../notation/measureNormalizer";
import type { MeasureData, TimeSignature } from "../core/types";
import type { SubdivisionType } from "../notation/subdivisionDetector";

export interface CleanupOptions {
  enabled: boolean;
}

export const DEFAULT_CLEANUP: CleanupOptions = { enabled: false };

/**
 * Produce a display-only slot list for one measure.
 *
 * When a globalSubdivision is provided (recommended for cross-measure consistency),
 * all chord ticks are hard-snapped to that grid before duration assignment.
 *
 * Contract: never modifies MIDI timing. Only produces display metadata
 * (durations, rest positions) for VexFlow rendering.
 */
export const cleanMeasure = (
  measure: MeasureData,
  ppq: number,
  signature: TimeSignature,
  ticksPerMeasure: number,
  globalSubdivision?: SubdivisionType
): DisplaySlot[] => {
  const beatTicks = ppq * (4 / signature.denominator);
  const { chords } = normalizeMeasure(measure, ppq, ticksPerMeasure, globalSubdivision);
  return fillMeasureSlots(chords, ticksPerMeasure, ppq, beatTicks);
};
