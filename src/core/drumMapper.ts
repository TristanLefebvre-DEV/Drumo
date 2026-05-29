import type { DrumPiece } from "./types";

export interface DrumMapEntry {
  piece: DrumPiece;
  vexKey: string;
  isCymbal: boolean;
  notehead: "normal" | "x";
  stem: 1 | -1;
}

export const DRUM_MAP: Record<number, DrumMapEntry> = {
  36: { piece: "kick", vexKey: "f/4", isCymbal: false, notehead: "normal", stem: -1 },
  38: { piece: "snare", vexKey: "c/5", isCymbal: false, notehead: "normal", stem: -1 },
  40: { piece: "snareRim", vexKey: "c/5", isCymbal: false, notehead: "x", stem: -1 },
  42: { piece: "hihatClosed", vexKey: "g/5", isCymbal: true, notehead: "x", stem: 1 },
  44: { piece: "hihatPedal", vexKey: "d/4", isCymbal: true, notehead: "x", stem: 1 },
  46: { piece: "hihatOpen", vexKey: "g/5", isCymbal: true, notehead: "x", stem: 1 },
  45: { piece: "tomLow", vexKey: "a/4", isCymbal: false, notehead: "normal", stem: -1 },
  47: { piece: "tomMid", vexKey: "b/4", isCymbal: false, notehead: "normal", stem: -1 },
  48: { piece: "tomHigh", vexKey: "e/5", isCymbal: false, notehead: "normal", stem: -1 },
  49: { piece: "crash", vexKey: "a/5", isCymbal: true, notehead: "x", stem: 1 },
  51: { piece: "ride", vexKey: "a/5", isCymbal: true, notehead: "x", stem: 1 },
  53: { piece: "ride", vexKey: "a/5", isCymbal: true, notehead: "x", stem: 1 },
  55: { piece: "splash", vexKey: "b/5", isCymbal: true, notehead: "x", stem: 1 },
  57: { piece: "crash", vexKey: "b/5", isCymbal: true, notehead: "x", stem: 1 },
  59: { piece: "ride", vexKey: "g/5", isCymbal: true, notehead: "x", stem: 1 }
};

export const mapMidiToDrum = (midi: number): DrumMapEntry | null => DRUM_MAP[midi] ?? null;
