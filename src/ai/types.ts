/**
 * Shared AI type definitions.
 *
 * All AI modules receive normalized DrumEvent / GrooveFrame inputs and
 * return typed prediction structs. No React or Tone.js dependencies here.
 */

// ─── Input representations ────────────────────────────────────────────────────

/** One MIDI drum event, instrument-agnostic. */
export interface DrumEvent {
  tick: number;
  note: number;         // MIDI note number
  velocity: number;     // 0–1 normalized
  duration: number;     // in ticks
}

/**
 * 16-step grid representation of one bar (4/4 at 16th-note resolution).
 * Each cell holds the average velocity of hits landing on that step (0 = no hit).
 */
export interface GrooveFrame {
  kick:  number[];   // length 16
  snare: number[];   // length 16
  hihat: number[];   // length 16
  tempo: number;     // BPM
  totalBars: number; // number of bars that were averaged
}

// ─── Groove classification ────────────────────────────────────────────────────

export type GrooveStyle =
  | "rock"
  | "metal"
  | "funk"
  | "jazz"
  | "shuffle"
  | "halftime"
  | "blast-beat"
  | "unknown";

export interface GroovePrediction {
  style: GrooveStyle;
  confidence: number;                        // 0–1
  scores: Partial<Record<GrooveStyle, number>>; // raw scores for all styles
}

// ─── Rudiment detection ───────────────────────────────────────────────────────

export type RudimentType =
  | "single-stroke-roll"
  | "double-stroke-roll"
  | "paradiddle"
  | "flam"
  | "drag"
  | "none";

export interface RudimentResult {
  type: RudimentType;
  confidence: number;  // 0–1
  startTick: number;
  endTick: number;
}

// ─── Difficulty ───────────────────────────────────────────────────────────────

export type DifficultyLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export interface DifficultyBreakdown {
  bpmScore:          number;  // 0–100
  densityScore:      number;  // 0–100
  independenceScore: number;  // 0–100
  speedScore:        number;  // 0–100
  complexityScore:   number;  // 0–100
}

export interface DifficultyResult {
  level:     DifficultyLevel;
  score:     number;           // 0–100 composite
  breakdown: DifficultyBreakdown;
}

// ─── Human feel ───────────────────────────────────────────────────────────────

export interface HumanFeelAnalysis {
  humanness:      number;  // 0–1 (0 = robotic grid, 1 = very human)
  swingRatio:     number;  // 0.5 = straight, 0.67 = full triplet swing
  dynamicRange:   number;  // velocity max − min  (0–1)
  timingVariance: number;  // std dev of timing offsets vs grid (0–1)
}

// ─── Groove similarity ────────────────────────────────────────────────────────

export interface SimilarityResult {
  score: number;         // 0–1  (1 = identical)
  kickSimilarity:  number;
  snareSimilarity: number;
  hihatSimilarity: number;
}

// ─── Aggregated result ────────────────────────────────────────────────────────

export interface AiAnalysisResult {
  groove:     GroovePrediction;
  difficulty: DifficultyResult;
  rudiments:  RudimentResult[];
  humanFeel:  HumanFeelAnalysis;
  analyzedAt: number;  // Date.now()
}

// ─── Smart quantizer ─────────────────────────────────────────────────────────

export interface SmartQuantizeOptions {
  /** 0 = no correction, 1 = full snap to grid */
  strength: number;
  /** 0 = strict, 1 = preserve all groove nuances */
  humanFactor: number;
  /** Protect ghost notes from quantization */
  preserveGhosts: boolean;
}

export interface QuantizeSuggestion {
  hitId: string;
  originalTick: number;
  suggestedTick: number;
  correctionStrength: number;
  reason: string;
}
