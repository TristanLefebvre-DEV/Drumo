import type { DrumPiece, QuantizeGrid } from "./types";

export interface DrumRow {
  piece: DrumPiece;
  label: string;
  midi: number;
  color: string;
}

export const DRUM_ROWS: DrumRow[] = [
  { piece: "crash",       label: "Crash",    midi: 49, color: "#e879f9" },
  { piece: "ride",        label: "Ride",     midi: 51, color: "#a78bfa" },
  { piece: "splash",      label: "Splash",   midi: 55, color: "#c084fc" },
  { piece: "otherCymbal", label: "Cym+",     midi: 51, color: "#8b5cf6" },
  { piece: "hihatOpen",   label: "HH Open",  midi: 46, color: "#60a5fa" },
  { piece: "hihatClosed", label: "HH Close", midi: 42, color: "#7dd3fc" },
  { piece: "hihatPedal",  label: "HH Pedal", midi: 44, color: "#93c5fd" },
  { piece: "tomHigh",     label: "Tom Hi",   midi: 48, color: "#4ade80" },
  { piece: "tomMid",      label: "Tom Mid",  midi: 47, color: "#34d399" },
  { piece: "tomLow",      label: "Tom Low",  midi: 45, color: "#2dd4bf" },
  { piece: "snareRim",    label: "Rim",      midi: 40, color: "#fbbf24" },
  { piece: "snare",       label: "Snare",    midi: 38, color: "#fb923c" },
  { piece: "kick",        label: "Kick",     midi: 36, color: "#f87171" },
  { piece: "kick2",       label: "Kick 2",   midi: 35, color: "#fca5a5" },
];

export const PIECE_TO_ROW = new Map<DrumPiece, DrumRow>(DRUM_ROWS.map(r => [r.piece, r]));

export const gridStepTicks = (ppq: number, grid: QuantizeGrid): number => {
  switch (grid) {
    case "1/4":  return ppq;
    case "1/8":  return ppq / 2;
    case "1/16": return ppq / 4;
    case "1/32": return ppq / 8;
    case "8T":   return Math.round(ppq / 3);
    case "16T":  return Math.round(ppq / 6);
  }
};
