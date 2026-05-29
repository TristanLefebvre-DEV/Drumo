/**
 * Beam Optimizer
 *
 * Generates VexFlow Beam objects with proper beat-boundary awareness.
 *
 * Key rule: beams must NEVER cross a beat boundary.
 * Quarter notes and longer notes act as natural beat separators.
 *
 * Strategy:
 *   1. Walk the note array in order.
 *   2. Accumulate beamable notes (8th / 16th / 32nd, non-rest).
 *   3. Flush the group when a non-beamable note (quarter+) or rest appears.
 *   4. Beam each group independently.
 *
 * This means a rock groove with 8th-note hi-hats and quarter-note accents
 * will produce two separate beam groups per beat — exactly as a copyist would.
 */

import { Beam } from "vexflow";
import type { StaveNote } from "vexflow";

const BEAMABLE_DURS = new Set(["8", "16", "32"]);

/**
 * Split a flat note array into contiguous beam groups.
 * Non-beamable notes (quarter+, rests) act as separators.
 */
const splitIntoGroups = (notes: StaveNote[]): StaveNote[][] => {
  const groups: StaveNote[][] = [];
  let current: StaveNote[] = [];

  for (const note of notes) {
    const beamable = !note.isRest() && BEAMABLE_DURS.has(note.getDuration());
    if (beamable) {
      current.push(note);
    } else {
      if (current.length >= 2) groups.push(current);
      current = [];
    }
  }
  if (current.length >= 2) groups.push(current);
  return groups;
};

/**
 * Generate VexFlow Beam objects for a set of StaveNotes.
 *
 * Only beams 8th, 16th, and 32nd notes; rests and quarter+ notes act as
 * group separators so beams never cross beat boundaries.
 */
export const generateBeams = (notes: StaveNote[]): Beam[] => {
  const groups = splitIntoGroups(notes);
  if (groups.length === 0) return [];

  const beams: Beam[] = [];

  for (const group of groups) {
    try {
      const generated = Beam.generateBeams(group, {
        beamRests:            false,
        maintainStemDirections: true,
      });
      beams.push(...generated);
    } catch {
      // VexFlow can fail on unusual stem combinations; skip the group
    }
  }

  return beams;
};
