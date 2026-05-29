/**
 * Playability Engine
 *
 * Aggregates individual PlayabilityIssues into a per-measure score map
 * suitable for visual rendering (colour highlight intensity per measure).
 *
 * Score 0 = fully realistic
 * Score 100 = physically impossible
 */

import { detectImpossiblePatterns, type PlayabilityIssue } from "./impossiblePatternDetector";
import type { ParsedDrumProject } from "../core/types";
import type { LimbMap } from "./limbAnalyzer";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PlayabilityLevel = "ok" | "hard" | "very-hard" | "impossible";

export interface MeasurePlayability {
  measureIndex: number;
  score:        number;          // 0–100
  level:        PlayabilityLevel;
  issues:       PlayabilityIssue[];
  hitIds:       Set<string>;    // all problematic hit IDs in this measure
}

/** Keyed by measure index. */
export type PlayabilityMap = Record<number, MeasurePlayability>;

// ─── Scoring ──────────────────────────────────────────────────────────────────

const scoreToLevel = (score: number): PlayabilityLevel => {
  if (score === 0)    return "ok";
  if (score < 40)     return "hard";
  if (score < 70)     return "very-hard";
  return "impossible";
};

/** Combine multiple issue scores into a single measure score (clamped 0–100). */
const combineScores = (issues: PlayabilityIssue[]): number =>
  Math.min(100, issues.reduce((max, iss) => Math.max(max, iss.score), 0));

// ─── Build map ─────────────────────────────────────────────────────────────────

export const buildPlayabilityMap = (
  project: ParsedDrumProject,
  limbMap: LimbMap
): PlayabilityMap => {
  const issues = detectImpossiblePatterns(
    project.hits, project.ppq, project.tempoBpm, limbMap
  );
  if (issues.length === 0) return {};

  const ticksPerMeasure = project.ppq * project.timeSignature.numerator;
  const map: PlayabilityMap = {};

  // Assign issues to measures
  for (const issue of issues) {
    const measureIdx = Math.floor(issue.tick / ticksPerMeasure);
    if (!map[measureIdx]) {
      map[measureIdx] = {
        measureIndex: measureIdx, score: 0,
        level: "ok", issues: [], hitIds: new Set(),
      };
    }
    map[measureIdx].issues.push(issue);
    issue.hitIds.forEach((id) => map[measureIdx].hitIds.add(id));
  }

  // Compute scores
  for (const entry of Object.values(map)) {
    entry.score = combineScores(entry.issues);
    entry.level = scoreToLevel(entry.score);
  }

  return map;
};

// ─── Global summary ────────────────────────────────────────────────────────────

export interface PlayabilitySummary {
  overallScore:     number;
  totalIssues:      number;
  errorCount:       number;
  warningCount:     number;
  problematicMeasures: number;
  worstMeasure:     number;
}

export const summarizePlayability = (map: PlayabilityMap): PlayabilitySummary => {
  const entries = Object.values(map);
  if (entries.length === 0) {
    return { overallScore: 0, totalIssues: 0, errorCount: 0, warningCount: 0, problematicMeasures: 0, worstMeasure: -1 };
  }
  const allIssues = entries.flatMap((e) => e.issues);
  const scores    = entries.map((e) => e.score);
  return {
    overallScore:        Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    totalIssues:         allIssues.length,
    errorCount:          allIssues.filter((i) => i.severity === "error").length,
    warningCount:        allIssues.filter((i) => i.severity === "warning").length,
    problematicMeasures: entries.filter((e) => e.score > 0).length,
    worstMeasure:        entries.reduce((best, e) => e.score > (map[best]?.score ?? 0) ? e.measureIndex : best, -1),
  };
};

/** Colour (hex) for a playability score, used in overlays. */
export const playabilityColor = (score: number): string => {
  if (score === 0)    return "transparent";
  if (score < 40)     return "#eab30830";  // amber / hard
  if (score < 70)     return "#f9731640";  // orange / very-hard
  return "#ef444450";                       // red / impossible
};

/** Solid hex colour for the badge. */
export const playabilityBadgeColor = (level: PlayabilityLevel): string => ({
  ok:          "#22c55e",
  hard:        "#eab308",
  "very-hard": "#f97316",
  impossible:  "#ef4444",
}[level]);
