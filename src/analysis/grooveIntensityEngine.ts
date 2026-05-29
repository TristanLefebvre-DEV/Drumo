/**
 * Groove Intensity Engine
 *
 * Style-aware playback adaptation layer.
 * Translates per-measure energy scores into concrete adaptation hints:
 *   - velocity multiplier (how hard to hit)
 *   - hi-hat openness (closed=0, open=1)
 *   - whether to suggest a crash accent
 *   - whether to trigger a fill
 *   - whether to soften ghost notes
 *
 * Each style has its own energy thresholds because "high energy" means
 * different things in jazz vs metal.
 *
 * The IntensityProfile is ready to be consumed by a playback adapter;
 * the hints are advisory — they don't directly modify MIDI output yet.
 */

import type { DrumStyle } from "./styleProfiles";
import type { MeasureEnergy, EnergyTrend } from "./energyFlowAnalyzer";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface IntensityAdaptation {
  measureIndex:   number;
  energyScore:    number;
  velocityFactor: number;   // 0.68–1.15 — multiply raw velocity
  hihatOpenness:  number;   // 0 = fully closed, 1 = fully open
  crashSuggested: boolean;
  fillSuggested:  boolean;
  ghostNoteBoost: boolean;  // soften ghost notes further in low-energy sections
  label:          string;   // human-readable for UI
}

export interface IntensityProfile {
  adaptations: IntensityAdaptation[];
  style:       DrumStyle;
  trend:       EnergyTrend;
  summary:     string;
}

// ─── Style-aware thresholds ───────────────────────────────────────────────────

interface StyleThresholds {
  high:           number;   // score ≥ this → high energy adaptation
  low:            number;   // score < this → low energy adaptation
  velBoost:       number;   // velocity × at high energy
  velDrop:        number;   // velocity × at low energy
  crashThreshold: number;   // energy level that warrants a crash suggestion
  fillDeltaTrig:  number;   // energy delta that triggers a fill suggestion
}

const THRESHOLDS: Record<DrumStyle, StyleThresholds> = {
  jazz:       { high: 52, low: 22, velBoost: 1.07, velDrop: 0.70, crashThreshold: 60, fillDeltaTrig: 20 },
  funk:       { high: 58, low: 20, velBoost: 1.10, velDrop: 0.72, crashThreshold: 62, fillDeltaTrig: 22 },
  rock:       { high: 65, low: 25, velBoost: 1.12, velDrop: 0.76, crashThreshold: 66, fillDeltaTrig: 25 },
  metal:      { high: 72, low: 32, velBoost: 1.15, velDrop: 0.80, crashThreshold: 73, fillDeltaTrig: 28 },
  electronic: { high: 70, low: 20, velBoost: 1.05, velDrop: 0.82, crashThreshold: 74, fillDeltaTrig: 30 },
  custom:     { high: 65, low: 25, velBoost: 1.10, velDrop: 0.76, crashThreshold: 66, fillDeltaTrig: 25 },
};

// ─── Per-measure adaptation ───────────────────────────────────────────────────

const adapt = (m: MeasureEnergy, t: StyleThresholds): IntensityAdaptation => {
  const isHigh = m.score >= t.high;
  const isLow  = m.score < t.low;

  const velocityFactor = isHigh ? t.velBoost : isLow ? t.velDrop : 1.0;

  // Hi-hat openness scales smoothly with energy
  const hihatOpenness = Math.max(0, Math.min(1,
    isHigh ? 0.65 + (m.score - t.high) / 200
           : isLow ? 0.04
           : 0.25 + (m.score - t.low) / (t.high - t.low) * 0.40
  ));

  const crashSuggested = m.score >= t.crashThreshold && m.cymbalComponent < 20;
  const fillSuggested  = m.delta > t.fillDeltaTrig && m.level !== "peak";
  const ghostNoteBoost = isLow && m.velocityComponent < 45;

  const label = isHigh
    ? `Haute énergie — vélocité ×${velocityFactor.toFixed(2)}, hi-hat ouvert`
    : isLow
    ? `Basse énergie — vélocité ×${velocityFactor.toFixed(2)}, dynamique douce`
    : "Énergie modérée — groove naturel";

  return {
    measureIndex:   m.measureIndex,
    energyScore:    m.score,
    velocityFactor,
    hihatOpenness,
    crashSuggested,
    fillSuggested,
    ghostNoteBoost,
    label,
  };
};

// ─── Summary text ─────────────────────────────────────────────────────────────

const buildSummary = (
  adaptations: IntensityAdaptation[],
  t:           StyleThresholds
): string => {
  const total    = adaptations.length;
  if (total === 0) return "Pas de données";

  const high  = adaptations.filter((a) => a.energyScore >= t.high).length;
  const low   = adaptations.filter((a) => a.energyScore < t.low).length;
  const crash = adaptations.filter((a) => a.crashSuggested).length;

  if (high / total > 0.55) return `Intensité élevée dominante (${Math.round(high / total * 100)}% des mesures)`;
  if (low  / total > 0.40) return `Fort contraste énergie — sections calmes bien marquées`;
  if (crash > 3)           return `${crash} crashs suggérés pour renforcer les sections intenses`;
  return "Énergie modérée et régulière — groove stable";
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a full intensity profile for a set of measures, style-aware.
 * Call this after analyzeEnergyFlow() to get playback adaptation hints.
 */
export const buildIntensityProfile = (
  measures: MeasureEnergy[],
  style:    DrumStyle = "rock",
  trend:    EnergyTrend = "steady"
): IntensityProfile => {
  const t           = THRESHOLDS[style];
  const adaptations = measures.map((m) => adapt(m, t));
  const summary     = buildSummary(adaptations, t);
  return { adaptations, style, trend, summary };
};

/** Fast lookup of adaptation for a single measure. */
export const getAdaptationAt = (
  profile:      IntensityProfile,
  measureIndex: number
): IntensityAdaptation | null =>
  profile.adaptations.find((a) => a.measureIndex === measureIndex) ?? null;
