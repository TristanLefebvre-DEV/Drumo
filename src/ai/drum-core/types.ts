/**
 * Drum Overkill AI Core — shared types
 *
 * Strict separation of concerns:
 *   GrooveAnalysis   — musical intent, feel, style
 *   PhysicalAnalysis — biomechanical feasibility (deterministic)
 *   DifficultyAnalysis — pedagogical score + explanation
 *   OptimizedPattern — suggested variants that preserve musical intent
 */

import type { DrumPiece, QuantizeGrid } from "../../core/types";

// ─── Input ─────────────────────────────────────────────────────────────────────

/** Minimal MIDI drum data the AI core needs. Mirrors ParsedDrumProject. */
export interface MidiDrumData {
  ppq:   number;
  bpm:   number;
  hits:  MidiDrumHit[];
  /** Total duration in ticks */
  totalTicks: number;
}

export interface MidiDrumHit {
  id:       string;
  piece:    DrumPiece;
  tick:     number;
  velocity: number;  // 0–1 normalized
  isGhost:  boolean;
  isAccent: boolean;
}

// ─── Groove Analysis ──────────────────────────────────────────────────────────

export type DetectedStyle =
  | "rock" | "metal" | "funk" | "jazz"
  | "shuffle" | "halftime" | "blast-beat"
  | "trap" | "latin" | "lofi" | "pop" | "fusion"
  | "unknown";

export interface SubdivisionMap {
  /** Dominant subdivision: "1/4" | "1/8" | "1/16" | "1/32" | "8T" | "16T" */
  dominant:   string;
  /** Per-instrument subdivision breakdown (0–1 proportion using each grid) */
  byPiece:    Partial<Record<DrumPiece, string>>;
  /** Is triplet-based feel dominant? */
  isTriplet:  boolean;
}

export interface GrooveAnalysis {
  /** 0–100: how well the groove locks in rhythmically */
  grooveScore:             number;
  detectedStyle:           DetectedStyle;
  subdivisionMap:          SubdivisionMap;
  /** 0.5 = straight, 0.67 = full triplet swing */
  swingRatio:              number;
  /** 0–1: confidence that musical intent is clear and readable */
  musicalIntentConfidence: number;
  /** Dominant pattern description (e.g. "16th-note hi-hat with backbeat") */
  patternDescription:      string;
}

// ─── Physical Analysis ────────────────────────────────────────────────────────

export interface LimbLoad {
  /** Right hand — 0–100% of theoretical maximum */
  RH: number;
  LH: number;
  RF: number;
  LF: number;
}

export interface PhysicalConflict {
  tick:        number;
  description: string;
  severity:    "warning" | "error";
  hitIds:      string[];
}

export interface PhysicalAnalysis {
  /** True iff no impossible-severity conflicts exist */
  playable:          boolean;
  /** Per-limb utilization percentage */
  limbLoad:          LimbLoad;
  /** Physical impossibilities and near-impossibilities */
  conflicts:         PhysicalConflict[];
  /** Ergonomic suggestions (crossovers, excessive reach, etc.) */
  ergonomicWarnings: string[];
}

// ─── Difficulty Analysis ──────────────────────────────────────────────────────

export type DifficultyLevel =
  | "Beginner" | "Intermediate" | "Advanced" | "Expert" | "Virtuoso";

export interface DifficultyAnalysis {
  /** 0–100 composite score */
  difficultyScore: number;
  difficultyLevel: DifficultyLevel;
  /** Human-readable explanation of the main difficulty drivers */
  explanation:     string;
  breakdown: {
    bpm:          number;
    density:      number;
    independence: number;
    speed:        number;
    complexity:   number;
  };
}

// ─── Optimization ─────────────────────────────────────────────────────────────

export interface OptimizedPattern {
  name:             string;
  description:      string;
  changesApplied:   string[];
  preservedIntent:  string;
  improvedAspects:  string[];
  /** Modified hit list (only changed hits; absent = unchanged) */
  hitDeltas:        OptimizedHitDelta[];
}

export interface OptimizedHitDelta {
  originalId: string;
  action:     "keep" | "remove" | "move" | "velocity-adjust";
  newTick?:   number;
  newVelocity?: number;
  reason:     string;
}

// ─── Drum Intelligence Core (central brain) ───────────────────────────────────

/**
 * Unified output from the Drum Intelligence Core.
 * Every downstream module reads from this single source of truth.
 */
export interface DrumCoreOutput {
  groove: {
    /** Detected genre/style */
    style:    string;
    /** 0.5 = straight, 0.67 = full swing */
    swing:    number;
    /** 0–100: rhythmic cohesion */
    strength: number;
  };
  quantization: {
    /** Grid that best matches the musical intent */
    recommendedGrid:     QuantizeGrid;
    /** When true, use groove-tolerant snapping (jazz, funk, shuffle) */
    preserveMicroTiming: boolean;
    /** Per-hit guidance: "snap" / "preserve" / "adjust" */
    correctionMap:       Record<string, "snap" | "preserve" | "adjust">;
  };
  physical: {
    playable:  boolean;
    limbLoad:  Record<string, number>;
    /** Human-readable conflict descriptions */
    conflicts: string[];
  };
  difficulty: {
    score: number;
    level: string;
  };
  notation: {
    /** Dominant subdivision string (e.g. "1/16") */
    subdivision: string;
    voiceSplitHints: {
      cymbalPieces: DrumPiece[];
      /** VexFlow dur code for cymbal voice cap ("8" | "q" | "h") */
      maxCymbalDur: string;
    };
  };
  optimization?: {
    versions: OptimizedPattern[];
  };
  /** Human-readable summary bullets for the UI */
  insights: string[];
}

// ─── Aggregate result ─────────────────────────────────────────────────────────

export interface DrumAIResult {
  groove:     GrooveAnalysis;
  physical:   PhysicalAnalysis;
  difficulty: DifficultyAnalysis;
  optimized?: OptimizedPattern[];
  analyzedAt: number;
}
