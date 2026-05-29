/**
 * DrumKit Recommendation Engine
 *
 * Uses the existing groove classifier output + analysis data to suggest
 * the best-matching drum kits for the currently loaded MIDI pattern.
 *
 * Input:  GroovePrediction, tempo, velocity stats
 * Output: Ranked list of kit recommendations with confidence scores
 */

import type { GroovePrediction, GrooveStyle } from "../ai/types";
import type { DrumKitId } from "./drumKitManager";
import { DRUM_KIT_PRESETS } from "./drumKitManager";

export interface KitRecommendation {
  kitId: DrumKitId;
  score: number;        // 0–1
  reason: string;
  isPrimary: boolean;
}

export interface KitRecommendationResult {
  detectedGroove: GrooveStyle;
  confidence: number;
  grooveLabel: string;
  recommendations: KitRecommendation[];
}

// ─── Groove → kit affinity matrix ────────────────────────────────────────────

type KitAffinityMap = Partial<Record<DrumKitId, number>>;

const GROOVE_KIT_AFFINITY: Record<GrooveStyle, KitAffinityMap> = {
  rock: {
    rock: 1.00, studio: 0.80, vintage: 0.65,
    funk: 0.40, metal: 0.30,
  },
  metal: {
    metal: 1.00, rock: 0.55, studio: 0.35,
    electronic: 0.20,
  },
  "blast-beat": {
    metal: 1.00, rock: 0.45, electronic: 0.25,
  },
  funk: {
    funk: 1.00, rock: 0.55, studio: 0.60,
    jazz: 0.35, vintage: 0.45,
  },
  jazz: {
    jazz: 1.00, vintage: 0.70, studio: 0.50,
    lofi: 0.45, funk: 0.30,
  },
  shuffle: {
    jazz: 0.80, vintage: 0.85, lofi: 0.70,
    funk: 0.55, rock: 0.40,
  },
  halftime: {
    rock: 0.75, studio: 0.70, funk: 0.65,
    lofi: 0.55, vintage: 0.50,
  },
  unknown: {
    studio: 0.70, rock: 0.60, funk: 0.55,
    vintage: 0.50, jazz: 0.45,
  },
};

// ─── Human-readable groove labels ────────────────────────────────────────────

const GROOVE_LABELS: Record<GrooveStyle, string> = {
  rock:        "Rock classique",
  metal:       "Metal",
  "blast-beat":"Blast Beat",
  funk:        "Funk",
  jazz:        "Jazz / Swing",
  shuffle:     "Shuffle",
  halftime:    "Half-time groove",
  unknown:     "Groove indéterminé",
};

// ─── Tempo-based affinity adjustments ─────────────────────────────────────────

function tempoBoost(kitId: DrumKitId, bpm: number): number {
  const kit = DRUM_KIT_PRESETS[kitId];
  // No bpm range on DrumKit (only on StyleProfile), so we use simple heuristics
  if (kitId === "metal" && bpm >= 120) return 0.15;
  if (kitId === "jazz" && bpm >= 80 && bpm <= 280) return 0.08;
  if (kitId === "electronic" && bpm >= 110 && bpm <= 180) return 0.10;
  if (kitId === "lofi" && bpm >= 60 && bpm <= 110) return 0.12;
  if (kitId === "funk" && bpm >= 80 && bpm <= 130) return 0.10;
  if (kitId === "rock" && bpm >= 90 && bpm <= 160) return 0.08;
  if (kitId === "vintage" && bpm <= 130) return 0.08;
  void kit;
  return 0;
}

// ─── Recommendation reasons ───────────────────────────────────────────────────

function buildReason(kitId: DrumKitId, grooveStyle: GrooveStyle, score: number): string {
  const kit = DRUM_KIT_PRESETS[kitId];
  if (score >= 0.85) return `Correspondance parfaite avec groove ${GROOVE_LABELS[grooveStyle]}`;
  if (score >= 0.65) return `Très adapté — ${kit.description}`;
  if (score >= 0.45) return `Bonne alternative — ${kit.description}`;
  return `Option complémentaire — ${kit.description}`;
}

// ─── Main recommendation function ─────────────────────────────────────────────

/**
 * Generate kit recommendations from a groove prediction + tempo.
 *
 * @param prediction  Output from grooveClassifier
 * @param bpm         Current project tempo
 * @param topN        Maximum recommendations to return (default: 4)
 */
export function recommendKits(
  prediction: GroovePrediction,
  bpm: number,
  topN = 4
): KitRecommendationResult {
  const { style, confidence, scores } = prediction;

  const allKitIds = Object.keys(DRUM_KIT_PRESETS) as DrumKitId[];
  const affinityMap = GROOVE_KIT_AFFINITY[style] ?? GROOVE_KIT_AFFINITY.unknown;

  // Score each kit: base affinity + cross-style blend + tempo boost
  const scored: Array<{ kitId: DrumKitId; score: number }> = allKitIds.map((kitId) => {
    let score = affinityMap[kitId] ?? 0;

    // Blend in secondary style affinities (when classifier isn't confident)
    if (confidence < 0.75 && scores) {
      for (const [gs, gConf] of Object.entries(scores) as [GrooveStyle, number][]) {
        if (gs === style) continue;
        const secAffinity = GROOVE_KIT_AFFINITY[gs]?.[kitId] ?? 0;
        score += secAffinity * gConf * (1 - confidence) * 0.5;
      }
    }

    score += tempoBoost(kitId, bpm);
    return { kitId, score: Math.min(1, score) };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topN).filter((s) => s.score > 0.15);

  const recommendations: KitRecommendation[] = top.map((entry, i) => ({
    kitId: entry.kitId,
    score: entry.score,
    reason: buildReason(entry.kitId, style, entry.score),
    isPrimary: i === 0,
  }));

  return {
    detectedGroove: style,
    confidence,
    grooveLabel: GROOVE_LABELS[style],
    recommendations,
  };
}

/** Quick helper: just return the top recommended kit ID. */
export function topKitFor(prediction: GroovePrediction, bpm: number): DrumKitId {
  const result = recommendKits(prediction, bpm, 1);
  return result.recommendations[0]?.kitId ?? "studio";
}
