/**
 * Energy Flow Analyzer
 *
 * Understands how musical energy evolves across the entire piece.
 * Operates on per-measure stats from fillDetector to compute:
 *   - energy score 0–100 per measure (velocity + density + cymbal + fill)
 *   - delta / momentum (rate of change)
 *   - global trend (rising / falling / steady / dynamic)
 *   - rule-based AI suggestions (fills, crashes, ghost notes…)
 *
 * Designed to be fast: O(n) after fillDetector runs.
 */

import type { ParsedDrumProject } from "../core/types";
import { detectFills, type MeasureStats } from "./fillDetector";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type EnergyLevel = "silent" | "calm" | "moderate" | "high" | "peak";
export type EnergyTrend = "rising" | "falling" | "steady" | "dynamic";

export interface MeasureEnergy {
  measureIndex:      number;
  score:             number;   // 0–100
  level:             EnergyLevel;
  velocityComponent: number;   // 0–100
  densityComponent:  number;   // 0–100
  cymbalComponent:   number;   // 0–100
  fillComponent:     number;   // 0–100
  /** Δ score vs previous measure (negative = drop, positive = rise). */
  delta:             number;
  /** Running trend direction: −1 (falling hard) to +1 (rising hard). */
  momentum:          number;
}

export type SuggestionType =
  | "add-fill"
  | "open-hihat"
  | "reduce-density"
  | "add-crash"
  | "add-ghost-notes"
  | "prep-crescendo";

export interface EnergySuggestion {
  measureIndex: number;
  type:         SuggestionType;
  description:  string;
  priority:     "high" | "medium" | "low";
}

export interface EnergyFlow {
  measures:    MeasureEnergy[];
  peakMeasure: number;       // index of highest-energy measure
  avgScore:    number;       // average across all measures
  maxScore:    number;
  globalTrend: EnergyTrend;
  suggestions: EnergySuggestion[];
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

/** Hex colour for an energy score:  blue → orange → red */
export const energyColor = (score: number): string => {
  if (score < 35) return "#3b82f6";   // blue  — calm
  if (score < 65) return "#f97316";   // orange — building
  return "#ef4444";                   // red   — intense
};

/** Muted (hex + alpha) version for backgrounds. */
export const energyColorMuted = (score: number, opacity = 0.35): string => {
  const hex   = energyColor(score);
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, "0");
  return hex + alpha;
};

// ─── Score calculation ────────────────────────────────────────────────────────

const toLevel = (score: number): EnergyLevel => {
  if (score === 0)  return "silent";
  if (score < 25)   return "calm";
  if (score < 55)   return "moderate";
  if (score < 78)   return "high";
  return "peak";
};

const scoreMeasure = (
  stats:       MeasureStats,
  peakDensity: number
): Pick<MeasureEnergy, "score" | "velocityComponent" | "densityComponent" | "cymbalComponent" | "fillComponent"> => {
  // Velocity (0-100): average velocity normalized
  const velComp = Math.round(stats.avgVelocity * 100);

  // Density (0-100): relative to peak density across the piece
  const densComp = peakDensity > 0
    ? Math.round(Math.min(stats.density / peakDensity, 1) * 100)
    : 0;

  // Cymbal (0-100): crash/ride presence drives energy peaks
  const cymComp = Math.round(Math.min(stats.cymbalCount * 18, 100));

  // Fill (0-100): fills are high-energy events
  const fillComp = stats.type === "fill"       ? 80
                 : stats.type === "transition"  ? 40
                 : 0;

  const score = Math.round(
    velComp  * 0.40 +
    densComp * 0.30 +
    cymComp  * 0.15 +
    fillComp * 0.10
  );

  return { score, velocityComponent: velComp, densityComponent: densComp, cymbalComponent: cymComp, fillComponent: fillComp };
};

// ─── Global trend ─────────────────────────────────────────────────────────────

const computeGlobalTrend = (measures: MeasureEnergy[]): EnergyTrend => {
  if (measures.length < 4) return "steady";

  const half     = Math.floor(measures.length / 2);
  const firstAvg = measures.slice(0, half).reduce((s, m) => s + m.score, 0) / half;
  const lastAvg  = measures.slice(half).reduce((s, m) => s + m.score, 0) / (measures.length - half);

  // High variance = lots of energy changes throughout the piece
  const variance = measures.reduce((s, m) => s + m.delta * m.delta, 0) / measures.length;
  if (variance > 360) return "dynamic";

  if (lastAvg > firstAvg + 10) return "rising";
  if (firstAvg > lastAvg + 10) return "falling";
  return "steady";
};

// ─── AI suggestions (rule-based) ─────────────────────────────────────────────

const generateSuggestions = (measures: MeasureEnergy[]): EnergySuggestion[] => {
  const seen: Set<number> = new Set();
  const result: EnergySuggestion[] = [];

  const push = (s: EnergySuggestion) => {
    if (!seen.has(s.measureIndex)) {
      seen.add(s.measureIndex);
      result.push(s);
    }
  };

  for (let i = 1; i < measures.length; i++) {
    const prev = measures[i - 1];
    const curr = measures[i];
    const next = i + 1 < measures.length ? measures[i + 1] : null;

    // Sharp drop before an upcoming rise → suggest a preparatory fill
    if (curr.delta < -22 && next && next.delta > 12) {
      push({
        measureIndex: i,
        type:         "add-fill",
        description:  `Ajouter un fill ici — chute d'énergie (Δ${curr.delta}) avant montée`,
        priority:     "high",
      });
    }

    // Sudden large jump from low energy, no fill → suggest a build-up
    if (curr.delta > 28 && prev.level === "calm" && prev.fillComponent < 10) {
      push({
        measureIndex: Math.max(0, i - 1),
        type:         "prep-crescendo",
        description:  `Entrée brutale (+${curr.delta}) — préparer avec un crescendo ou fill`,
        priority:     "medium",
      });
    }

    // High energy section with barely any cymbal → suggest crash accent
    if ((curr.level === "high" || curr.level === "peak") && curr.cymbalComponent < 18) {
      push({
        measureIndex: i,
        type:         "add-crash",
        description:  `Section intense sans cymbal accent — ajouter un crash`,
        priority:     "medium",
      });
    }

    // Sustained low energy with weak velocity → ghost notes suggestion
    if (curr.level === "calm" && curr.velocityComponent < 42 && prev.level === "calm") {
      push({
        measureIndex: i,
        type:         "add-ghost-notes",
        description:  `Section calme prolongée — ghost notes ajouteraient du mouvement`,
        priority:     "low",
      });
    }

    // High density but mid energy → reduce density for contrast
    if (curr.densityComponent > 80 && curr.velocityComponent < 50) {
      push({
        measureIndex: i,
        type:         "reduce-density",
        description:  `Forte densité mais dynamique faible — alléger le groove ici`,
        priority:     "low",
      });
    }
  }

  return result;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const analyzeEnergyFlow = (project: ParsedDrumProject): EnergyFlow => {
  const measureStats = detectFills(project);
  const empty: EnergyFlow = { measures: [], peakMeasure: 0, avgScore: 0, maxScore: 0, globalTrend: "steady", suggestions: [] };
  if (measureStats.length === 0) return empty;

  const peakDensity = Math.max(...measureStats.map((s) => s.density), 0.01);

  // Build raw measures
  const raw: MeasureEnergy[] = measureStats.map((stats, i) => ({
    measureIndex: i,
    ...scoreMeasure(stats, peakDensity),
    level:        "silent" as EnergyLevel,
    delta:        0,
    momentum:     0,
  }));

  // Fill in level, delta, momentum
  const MOMENTUM_W = 4;
  for (let i = 0; i < raw.length; i++) {
    raw[i].level = toLevel(raw[i].score);
    raw[i].delta = i > 0 ? raw[i].score - raw[i - 1].score : 0;

    if (i >= MOMENTUM_W) {
      const win   = raw.slice(i - MOMENTUM_W, i + 1);
      const trend = win[win.length - 1].score - win[0].score;
      raw[i].momentum = Math.max(-1, Math.min(1, trend / 50));
    }
  }

  const scores      = raw.map((m) => m.score);
  const maxScore    = Math.max(...scores, 0);
  const avgScore    = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const peakMeasure = scores.indexOf(maxScore);
  const globalTrend = computeGlobalTrend(raw);
  const suggestions = generateSuggestions(raw);

  return { measures: raw, peakMeasure, avgScore, maxScore, globalTrend, suggestions };
};
