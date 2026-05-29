import { Beam } from "vexflow";
import type { StaveNote } from "vexflow";

/**
 * Generate VexFlow Beam objects for a set of StaveNotes.
 * Only beams 8th, 16th, and 32nd notes; skips rests.
 */
export const generateBeams = (notes: StaveNote[]): Beam[] => {
  const beamable = notes.filter((n) => {
    if (n.isRest()) return false;
    const dur = n.getDuration();
    return dur === "8" || dur === "16" || dur === "32";
  });

  if (beamable.length < 2) return [];

  try {
    return Beam.generateBeams(beamable, {
      beamRests: false,
      maintainStemDirections: true,
    });
  } catch {
    return [];
  }
};
