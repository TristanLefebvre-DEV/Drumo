/**
 * Drum Overkill AI Core — public orchestrator
 *
 * Single entry point: analyzeDrumMidi(input: MidiDrumData): DrumAIResult
 *
 * Pipeline:
 *   1. Groove Intelligence Engine  — musical style + feel
 *   2. Physical Simulation Engine  — biomechanical feasibility (deterministic)
 *   3. Difficulty & Analysis Engine — pedagogical score + level
 *   4. Optimization Engine          — three playable + readable variants
 *
 * All engines are synchronous and heuristic — no ML runtime required.
 * Compatible with Electron main process and renderer thread.
 */

export { analyzeGroove }             from "./grooveEngine";
export { analyzePhysical }           from "./physicalEngine";
export { analyzeDifficultyCore }     from "./difficultyEngine";
export { optimizePattern }           from "./optimizationEngine";
export { runDrumIntelligenceCore }   from "./drumIntelligenceCore";
export type {
  MidiDrumData,
  MidiDrumHit,
  DrumAIResult,
  DrumCoreOutput,
  GrooveAnalysis,
  PhysicalAnalysis,
  DifficultyAnalysis,
  OptimizedPattern,
  OptimizedHitDelta,
  DetectedStyle,
  DifficultyLevel,
  LimbLoad,
  PhysicalConflict,
  SubdivisionMap,
} from "./types";

import { analyzeGroove }         from "./grooveEngine";
import { analyzePhysical }       from "./physicalEngine";
import { analyzeDifficultyCore } from "./difficultyEngine";
import { optimizePattern }       from "./optimizationEngine";
import type { MidiDrumData, DrumAIResult } from "./types";

/**
 * Full drum AI analysis.
 *
 * @param input  MIDI drum data (hits, ppq, bpm, totalTicks)
 * @returns      DrumAIResult with groove, physical, difficulty, and optimized variants
 */
export const analyzeDrumMidi = (input: MidiDrumData): DrumAIResult => {
  const groove     = analyzeGroove(input);
  const physical   = analyzePhysical(input);
  const difficulty = analyzeDifficultyCore(input);
  const optimized  = optimizePattern(input, groove, physical);

  return {
    groove,
    physical,
    difficulty,
    optimized,
    analyzedAt: Date.now(),
  };
};
