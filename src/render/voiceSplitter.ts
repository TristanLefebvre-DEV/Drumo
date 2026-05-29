/**
 * Voice Splitter
 *
 * Splits a normalized measure into two independent DisplaySlot arrays:
 *
 *   Voice 1 — cymbals (stem up)
 *     hi-hat (open/closed/pedal), crash, ride, splash, otherCymbal
 *     maxNoteDur = 2 × subdivision step
 *       → 16th hi-hats stay 16th notes even when the next cymbal event is far away
 *       → 8th hi-hats stay 8th notes
 *       → crashes in a 16th-note pattern get an 8th note (readable, not a half note)
 *
 *   Voice 2 — drums (stem down)
 *     kick, snare, snareRim, toms
 *     maxNoteDur = 2 beats (half note max)
 *       → kick/snare quarter notes in standard grooves
 *       → half-note kick in sparse passages
 *
 * Both voices span the full measure (rests fill every gap).
 */

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
 * Split one measure into two DisplaySlot arrays for two-voice drum notation.
 *
 * Pipeline:
 *   1. normalizeMeasure: hard-snap ticks to subdivision grid + merge collisions.
 *   2. filterChord: cymbal hits → voice 1, drum hits → voice 2.
 *   3. fillMeasureSlots: assign note durations + fill gaps with rests.
 *      Per-voice maxNoteDur ensures notation matches the instrument's role.
 */
export const splitMeasureVoices = (
  measure:           MeasureData,
  ticksPerMeasure:   number,
  ppq:               number,
  signature:         TimeSignature,
  globalSubdivision?: SubdivisionType
): SplitVoices => {
  const beatTicks = ppq * (4 / signature.denominator);

  // Step 1 — normalize: snap + merge
  const { chords: normalized, subdivisionStep } = normalizeMeasure(
    measure, ppq, ticksPerMeasure, globalSubdivision
  );

  // Step 2 — filter per voice
  const cymbalChords: DrumChord[] = normalized
    .map(c => filterChord(c, true))
    .filter((c): c is DrumChord => c !== null);

  const drumChords: DrumChord[] = normalized
    .map(c => filterChord(c, false))
    .filter((c): c is DrumChord => c !== null);

  // Step 3 — assign durations + fill rests
  //
  // Cymbal max: 2 × subdivision step.
  //   If subdiv = 1/16 (120 ticks) → max = 240 (8th note).
  //   If subdiv = 1/8  (240 ticks) → max = 480 (quarter note).
  //   If subdiv = 1/4  (480 ticks) → max = beatTicks (= 1 beat, avoid half-note hi-hat).
  //
  // Drum max: 2 beats (half note). A kick spanning 2 beats is valid; more is unusual.
  const cymbalMax = Math.min(subdivisionStep * 2, beatTicks);
  const drumMax   = beatTicks * 2;

  return {
    cymbals: fillMeasureSlots(cymbalChords, ticksPerMeasure, ppq, beatTicks, cymbalMax),
    drums:   fillMeasureSlots(drumChords,   ticksPerMeasure, ppq, beatTicks, drumMax),
  };
};
