export type DrumPiece =
  | "kick"
  | "kick2"         // double bass drum (gauche / second pédalier)
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

/** Drum-notation specific articulation for a hit. */
export type NoteType = "normal" | "flam" | "roll";

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
  /** Drum articulation type — default "normal". */
  noteType?: NoteType;
  /** Probability (0–100) that this note plays on each pass — default 100. */
  probability?: number;
  /** Silenced without deletion — default false. */
  muted?: boolean;
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
