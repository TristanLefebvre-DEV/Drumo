import type { DrumPiece, QuantizedHit } from "../core/types";

const CYMBAL_PIECES = new Set<DrumPiece>([
  "crash", "ride", "splash", "otherCymbal",
  "hihatOpen", "hihatClosed", "hihatPedal",
]);

export const isCymbalPiece = (piece: DrumPiece): boolean => CYMBAL_PIECES.has(piece);

/**
 * Returns the VexFlow stem direction for a chord.
 * Convention: cymbals → up (1), drums → down (-1).
 * Mixed chords use up-stem so the cymbal notehead reads clearly.
 */
export const chordStemDir = (hits: QuantizedHit[]): 1 | -1 => {
  const hasCymbal = hits.some((h) => isCymbalPiece(h.piece));
  const hasDrum   = hits.some((h) => !isCymbalPiece(h.piece));
  if (hasCymbal && !hasDrum) return 1;
  if (!hasCymbal && hasDrum) return -1;
  return hasCymbal ? 1 : -1; // mixed → cymbal wins (up-stem)
};
