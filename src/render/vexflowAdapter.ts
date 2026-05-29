import { Dot, StaveNote } from "vexflow";
import { mapMidiToDrum } from "../core/drumMapper";
import { mapVelocityToColor, mapVelocityToColorAlpha } from "./velocityColor";
import { chordStemDir } from "./stemDirectionEngine";
import type { QuantizedHit } from "../core/types";

export interface HeatmapOpts {
  enabled: boolean;
  sensitivity: number;
}

/** Override to use a cleaned-up display duration instead of the quantized one. */
export interface DurOverride {
  dur: string;
  dotted: boolean;
}

const durationFromTicks = (durationTicks: number, ppq: number): string => {
  if (durationTicks >= ppq * 1.5) return "h";
  if (durationTicks >= ppq * 0.75) return "q";
  if (durationTicks >= ppq * 0.375) return "8";
  return "16";
};

/** Create a percussion rest note (display-only, no MIDI data). */
export const createRestNote = (vexRestDur: string, dotted: boolean): StaveNote => {
  const note = new StaveNote({
    keys: ["b/4"],
    duration: vexRestDur, // e.g. "qr", "8r", "hr", "wr"
    clef: "percussion",
  });
  if (dotted) Dot.buildAndAttach([note]);
  return note;
};

export const chordToStaveNote = (
  hits: QuantizedHit[],
  ppq: number,
  active: boolean,
  heatmap?: HeatmapOpts,
  durOverride?: DurOverride
): StaveNote | null => {
  const mapped = hits.map((hit) => ({ hit, map: mapMidiToDrum(hit.midi) })).filter((h) => h.map !== null);
  if (mapped.length === 0) return null;

  const keys = mapped.map((item) => item.map!.vexKey);
  const stemDir = chordStemDir(hits);

  const duration = durOverride
    ? durOverride.dur
    : durationFromTicks(Math.min(...hits.map((h) => h.quantizedDuration)), ppq);

  const note = new StaveNote({
    keys,
    duration,
    clef: "percussion",
    stem_direction: stemDir,
  });

  if (durOverride?.dotted) Dot.buildAndAttach([note]);

  if (heatmap?.enabled) {
    mapped.forEach((item, index) => {
      const color = item.hit.isGhost
        ? mapVelocityToColorAlpha(item.hit.velocity, heatmap.sensitivity, 0.45)
        : mapVelocityToColor(item.hit.velocity, heatmap.sensitivity);
      note.setKeyStyle(index, { fillStyle: color, strokeStyle: color });
      if (item.hit.isGhost) Dot.buildAndAttach([note], { index });
    });
    const maxVel = Math.max(...hits.map((h) => h.velocity));
    const stemColor = mapVelocityToColor(maxVel, heatmap.sensitivity);
    note.setStyle({ fillStyle: stemColor, strokeStyle: stemColor });
  } else {
    mapped.forEach((item, index) => {
      if (item.map!.notehead === "x") {
        note.setKeyStyle(index, { fillStyle: "#7dd3fc", strokeStyle: "#7dd3fc" });
      }
      if (item.hit.isGhost) {
        note.setKeyStyle(index, { fillStyle: "#71717a", strokeStyle: "#71717a" });
        Dot.buildAndAttach([note], { index });
      }
    });
    if (mapped.some((item) => item.hit.isAccent)) {
      note.setStyle({ fillStyle: "#fbbf24", strokeStyle: "#fbbf24" });
    }
  }

  if (active) {
    note.setStyle({ fillStyle: "#fb7185", strokeStyle: "#fb7185" });
  }

  return note;
};
