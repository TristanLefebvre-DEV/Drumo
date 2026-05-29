import { Annotation, Articulation } from "vexflow";
import type { StaveNote } from "vexflow";
import type { QuantizedHit } from "../core/types";
import { mapMidiToDrum } from "../core/drumMapper";

/** Add an accent marker (>) to a note. Position is auto-determined by VexFlow based on stem direction. */
export const applyAccent = (note: StaveNote): void => {
  try { note.addModifier(new Articulation("a>")); } catch { /* skip on unusual note types */ }
};

/** Add an open hi-hat circle ("o") above a note. */
export const applyOpenHiHat = (note: StaveNote): void => {
  try {
    const ann = new Annotation("o");
    ann.setVerticalJustification(Annotation.VerticalJustify.TOP);
    note.addModifier(ann);
  } catch { /* skip */ }
};

/** Return true if any hit in the chord maps to an open hi-hat. */
const hasOpenHiHat = (hits: QuantizedHit[]): boolean =>
  hits.some(h => mapMidiToDrum(h.midi)?.piece === "hihatOpen");

/**
 * Apply all standard drum articulation modifiers to a StaveNote:
 *   - Accent (>)  when any hit has isAccent
 *   - Open HH (o) when any hit is an open hi-hat
 *
 * Ghost-note parentheses are handled separately via notehead coloring in vexflowAdapter.
 */
export const applyArticulations = (note: StaveNote, hits: QuantizedHit[]): void => {
  if (hits.some(h => h.isAccent)) applyAccent(note);
  if (hasOpenHiHat(hits))         applyOpenHiHat(note);
};
