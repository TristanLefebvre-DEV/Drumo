/**
 * Difficulty & Analysis Engine
 *
 * Wraps the existing analyzeDifficulty() and extends it with:
 *   - "Virtuoso" level above Expert (score >= 92)
 *   - Human-readable explanation string driven by the dominant sub-scores
 */

import { analyzeDifficulty } from "../difficultyAnalyzer";
import type { DrumHit, TimeSignature } from "../../core/types";
import type { MidiDrumData, DifficultyAnalysis, DifficultyLevel } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toFullHits = (data: MidiDrumData): DrumHit[] =>
  data.hits.map(h => ({
    id:            h.id,
    midi:          0,
    piece:         h.piece,
    tick:          h.tick,
    durationTicks: Math.round(data.ppq / 4),
    velocity:      h.velocity,
    isGhost:       h.isGhost,
    isAccent:      h.isAccent,
  }));

const scoreToLevel = (score: number): DifficultyLevel => {
  if (score >= 92) return "Virtuoso";
  if (score >= 78) return "Expert";
  if (score >= 55) return "Advanced";
  if (score >= 30) return "Intermediate";
  return "Beginner";
};

const buildExplanation = (
  level:   DifficultyLevel,
  score:   number,
  bpm:     number,
  bd: { bpmScore: number; densityScore: number; independenceScore: number; speedScore: number; complexityScore: number }
): string => {
  const drivers: string[] = [];

  if (bd.speedScore > 70)        drivers.push(`vitesse extrême (score vitesse : ${bd.speedScore}/100)`);
  if (bd.independenceScore > 65) drivers.push(`indépendance des membres élevée (${bd.independenceScore}/100)`);
  if (bd.densityScore > 65)      drivers.push(`densité de notes élevée (${bd.densityScore}/100)`);
  if (bd.bpmScore > 60)          drivers.push(`tempo rapide (${Math.round(bpm)} BPM)`);
  if (bd.complexityScore > 60)   drivers.push(`rythmes complexes (subdivisions mixtes)`);

  if (drivers.length === 0) {
    return `Niveau ${level} (score ${score}/100) — pattern standard.`;
  }

  return `Niveau ${level} (score ${score}/100) — principaux défis : ${drivers.join(", ")}.`;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const analyzeDifficultyCore = (data: MidiDrumData): DifficultyAnalysis => {
  const hits: DrumHit[] = toFullHits(data);
  const sig: TimeSignature = { numerator: 4, denominator: 4 };

  if (hits.length === 0) {
    return {
      difficultyScore: 0,
      difficultyLevel: "Beginner",
      explanation:     "Aucune frappe — impossible d'évaluer la difficulté.",
      breakdown:       { bpm: 0, density: 0, independence: 0, speed: 0, complexity: 0 },
    };
  }

  const result = analyzeDifficulty(hits, data.ppq, data.bpm, sig);
  const level  = scoreToLevel(result.score);

  return {
    difficultyScore: result.score,
    difficultyLevel: level,
    explanation:     buildExplanation(level, result.score, data.bpm, {
      bpmScore:          result.breakdown.bpmScore,
      densityScore:      result.breakdown.densityScore,
      independenceScore: result.breakdown.independenceScore,
      speedScore:        result.breakdown.speedScore,
      complexityScore:   result.breakdown.complexityScore,
    }),
    breakdown: {
      bpm:          result.breakdown.bpmScore,
      density:      result.breakdown.densityScore,
      independence: result.breakdown.independenceScore,
      speed:        result.breakdown.speedScore,
      complexity:   result.breakdown.complexityScore,
    },
  };
};
