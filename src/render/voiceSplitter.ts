import { fillMeasureSlots, type DisplaySlot } from "./restOptimizer";
import type { MeasureData, DrumChord, TimeSignature, DrumPiece } from "../core/types";
import { mapMidiToDrum } from "../core/drumMapper";
import { normalizeMeasure } from "../notation/measureNormalizer";
import type { SubdivisionType } from "../notation/subdivisionDetector";

const CYMBAL_PIECES = new Set<DrumPiece>([
  "hihatClosed", "hihatOpen", "hihatPedal",
  "crash", "ride", "splash", "otherCymbal",
]);

export interface SplitVoices {
  /** Voice 1 — stem up: cymbals and hi-hats. */
  cymbals: DisplaySlot[];
  /** Voice 2 — stem down: kick, snare, toms. */
  drums:   DisplaySlot[];
}

const filterChord = (chord: DrumChord, wantCymbals: boolean): DrumChord | null => {
  const filtered = chord.hits.filter(h => {
    const entry = mapMidiToDrum(h.midi);
    if (!entry) return false;
    return wantCymbals ? CYMBAL_PIECES.has(entry.piece) : !CYMBAL_PIECES.has(entry.piece);
  });
  return filtered.length > 0 ? { ...chord, hits: filtered } : null;
};

/**
 * Split one measure into two independent DisplaySlot arrays for two-voice notation.
 *
 * Before splitting:
 *   - Hard-snaps all chord ticks to the detected (or forced) subdivision grid.
 *   - Merges chords that collide after snapping.
 *
 * After splitting:
 *   - Each sub-voice is independently filled with rests to span the full measure.
 *
 * @param measure            Source measure (not mutated).
 * @param ticksPerMeasure    Total tick span of the measure.
 * @param ppq                Pulses per quarter note.
 * @param signature          Time signature (for beat-boundary rest alignment).
 * @param globalSubdivision  Optional: override per-measure detection for cross-measure consistency.
 */
export const splitMeasureVoices = (
  measure: MeasureData,
  ticksPerMeasure: number,
  ppq: number,
  signature: TimeSignature,
  globalSubdivision?: SubdivisionType
): SplitVoices => {
  const beatTicks = ppq * (4 / signature.denominator);

  // Normalize first: hard-snap ticks to subdivision grid + merge collisions
  const { chords: normalized } = normalizeMeasure(
    measure, ppq, ticksPerMeasure, globalSubdivision
  );

  const cymbalChords: DrumChord[] = normalized
    .map(c => filterChord(c, true))
    .filter((c): c is DrumChord => c !== null);

  const drumChords: DrumChord[] = normalized
    .map(c => filterChord(c, false))
    .filter((c): c is DrumChord => c !== null);

  return {
    cymbals: fillMeasureSlots(cymbalChords, ticksPerMeasure, ppq, beatTicks),
    drums:   fillMeasureSlots(drumChords,   ticksPerMeasure, ppq, beatTicks),
  };
};
