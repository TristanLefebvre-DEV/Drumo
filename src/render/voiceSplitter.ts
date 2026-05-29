import { fillMeasureSlots, type DisplaySlot } from "./restOptimizer";
import type { MeasureData, DrumChord, TimeSignature, DrumPiece } from "../core/types";
import { mapMidiToDrum } from "../core/drumMapper";

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
 * Split one measure into two independent slot arrays for two-voice notation.
 * Each array is filled with rests so both voices span the full measure duration.
 *
 * @param measure          Source measure with all chords.
 * @param ticksPerMeasure  Total tick count for the measure.
 * @param ppq              Pulses per quarter note.
 * @param signature        Time signature (for beat-boundary rest alignment).
 */
export const splitMeasureVoices = (
  measure: MeasureData,
  ticksPerMeasure: number,
  ppq: number,
  signature: TimeSignature
): SplitVoices => {
  const beatTicks = ppq * (4 / signature.denominator);

  const cymbalChords: DrumChord[] = measure.chords
    .map(c => filterChord(c, true))
    .filter((c): c is DrumChord => c !== null);

  const drumChords: DrumChord[] = measure.chords
    .map(c => filterChord(c, false))
    .filter((c): c is DrumChord => c !== null);

  return {
    cymbals: fillMeasureSlots(cymbalChords, ticksPerMeasure, ppq, beatTicks),
    drums:   fillMeasureSlots(drumChords,   ticksPerMeasure, ppq, beatTicks),
  };
};
