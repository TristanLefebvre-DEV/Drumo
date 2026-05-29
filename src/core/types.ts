export type DrumPiece =
  | "kick"
  | "snare"
  | "snareRim"
  | "hihatClosed"
  | "hihatOpen"
  | "hihatPedal"
  | "tomHigh"
  | "tomMid"
  | "tomLow"
  | "crash"
  | "ride"
  | "splash"
  | "otherCymbal";

export type QuantizeGrid = "1/4" | "1/8" | "1/16" | "1/32" | "8T" | "16T";

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface DrumHit {
  id: string;
  midi: number;
  piece: DrumPiece;
  tick: number;
  durationTicks: number;
  velocity: number;
  isGhost: boolean;
  isAccent: boolean;
}

export interface ParsedDrumProject {
  ppq: number;
  tempoBpm: number;
  timeSignature: TimeSignature;
  sourceName: string;
  hits: DrumHit[];
}

export interface QuantizeOptions {
  grid: QuantizeGrid;
  preserveGroove: boolean;
  swing: number;
}

export interface QuantizedHit extends DrumHit {
  originalTick: number;
  quantizedTick: number;
  quantizedDuration: number;
}

export interface DrumChord {
  tickInMeasure: number;
  absoluteTick: number;
  hits: QuantizedHit[];
}

export interface MeasureData {
  index: number;
  startTick: number;
  chords: DrumChord[];
}

export interface RhythmResult {
  measures: MeasureData[];
  ticksPerMeasure: number;
}
