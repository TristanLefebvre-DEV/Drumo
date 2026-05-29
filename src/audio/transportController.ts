import type { DrumPiece } from "../core/types";
import type { TransportOptions } from "./playbackEngine";

export type { TransportOptions };

export const DEFAULT_TRANSPORT: TransportOptions = {
  speed: 1,
  loopEnabled: false,
  loopStartTick: 0,
  loopEndTick: 0,
  metronomeEnabled: false,
  countInBars: 0,
  muteState: {},
  soloState: {},
};

export const DRUM_PIECE_LABELS: Record<DrumPiece, string> = {
  kick:        "Kick",
  snare:       "Snare",
  snareRim:    "Rim",
  hihatClosed: "HH",
  hihatOpen:   "HH Op",
  hihatPedal:  "HH Pd",
  tomHigh:     "T.Hi",
  tomMid:      "T.Mid",
  tomLow:      "T.Lo",
  crash:       "Crash",
  ride:        "Ride",
  splash:      "Splash",
  otherCymbal: "Cymb",
};

/** All drum pieces in display order for mixer strip. */
export const DRUM_PIECES_ORDERED: DrumPiece[] = [
  "kick", "snare", "snareRim",
  "hihatClosed", "hihatOpen", "hihatPedal",
  "tomHigh", "tomMid", "tomLow",
  "crash", "ride", "splash", "otherCymbal",
];

/** Convert tick position to "bar:beat:tick" display string (1-based). */
export const formatPosition = (tick: number, ppq: number, numerator: number): string => {
  if (tick < 0) tick = 0;
  const ticksPerMeasure = ppq * numerator;
  const bar = Math.floor(tick / ticksPerMeasure) + 1;
  const beat = Math.floor((tick % ticksPerMeasure) / ppq) + 1;
  const sub = Math.floor(tick % ppq);
  return `${bar}:${String(beat).padStart(2, "0")}:${String(sub).padStart(3, "0")}`;
};
