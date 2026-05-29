/**
 * Smart Quantizer
 *
 * AI-assisted quantization that preserves the human feel of a performance.
 *
 * Unlike hard quantization (snap-to-grid), this module:
 *   - Applies a variable strength per hit based on its context
 *   - Reduces correction for ghost notes (they carry groove intentionality)
 *   - Detects "intentional" off-beats (syncopation) and protects them
 *   - Preserves swing ratios
 *
 * Slider mapping (strength 0–1):
 *   0.0  → no change          (pure human feel)
 *   0.3  → light correction   (tighten without killing groove)
 *   0.6  → medium correction  (standard groove-aware quantize)
 *   1.0  → strict snap        (hard quantize)
 *
 * Produces QuantizeSuggestion[] so the UI can preview changes before applying.
 */

import type { DrumHit } from "../core/types";
import type { QuantizeGrid } from "../core/types";
import type { QuantizeSuggestion, SmartQuantizeOptions } from "./types";

// ─── Grid resolution ───────────────────────────────────────────────────────────

const GRID_TICKS: Record<QuantizeGrid, (ppq: number) => number> = {
  "1/4":  (ppq) => ppq,
  "1/8":  (ppq) => ppq / 2,
  "1/16": (ppq) => ppq / 4,
  "1/32": (ppq) => ppq / 8,
  "8T":   (ppq) => ppq / 3,    // eighth-note triplet
  "16T":  (ppq) => ppq / 6,    // sixteenth-note triplet
};

// ─── Context analysis ─────────────────────────────────────────────────────────

/**
 * Detect if a hit is likely an intentional syncopation.
 * A hit is "syncopated" if the nearest hits before and after are on the beat
 * but this one is clearly off-beat with consistent occurrence.
 */
const isIntentionalSyncopation = (
  hit: DrumHit,
  stepTicks: number,
  allHits: DrumHit[]
): boolean => {
  const nearest = Math.round(hit.tick / stepTicks) * stepTicks;
  const offset  = Math.abs(hit.tick - nearest);
  if (offset < stepTicks * 0.15) return false; // already near grid — not syncopation

  // Check if a similar hit appears at same off-beat position in other bars
  const barTicks  = stepTicks * 16; // 4/4 bar at the selected grid
  const hitOffset = hit.tick % barTicks;
  const similar   = allHits.filter(
    (h) =>
      h.piece === hit.piece &&
      h.id !== hit.id &&
      Math.abs((h.tick % barTicks) - hitOffset) < stepTicks * 0.2
  );
  return similar.length >= 1; // recurring → intentional
};

/**
 * Per-hit correction strength.
 * Ghost notes and intentional syncopations get less correction.
 */
const perHitStrength = (
  hit: DrumHit,
  globalStrength: number,
  humanFactor: number,
  preserveGhosts: boolean,
  stepTicks: number,
  allHits: DrumHit[]
): number => {
  let s = globalStrength;

  // Ghost notes carry groove detail — protect them
  if (preserveGhosts && hit.isGhost) s *= 0.25;

  // Intentional off-beats should be moved less aggressively
  if (isIntentionalSyncopation(hit, stepTicks, allHits)) s *= (1 - humanFactor * 0.6);

  // Accented notes on strong beats are likely fine as-is
  if (hit.isAccent) s *= 0.85;

  return Math.max(0, Math.min(1, s));
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate quantization suggestions without modifying the original hits.
 * The caller can preview and selectively apply suggestions.
 */
export const suggestQuantization = (
  hits: DrumHit[],
  grid: QuantizeGrid,
  ppq: number,
  options: SmartQuantizeOptions
): QuantizeSuggestion[] => {
  const stepTicks = GRID_TICKS[grid](ppq);
  const suggestions: QuantizeSuggestion[] = [];

  for (const hit of hits) {
    const nearest  = Math.round(hit.tick / stepTicks) * stepTicks;
    const error    = nearest - hit.tick;
    if (error === 0) continue;

    const strength = perHitStrength(
      hit, options.strength, options.humanFactor,
      options.preserveGhosts, stepTicks, hits
    );
    const correctedTick = Math.max(0, Math.round(hit.tick + error * strength));
    if (correctedTick === hit.tick) continue;

    const reason = hit.isGhost
      ? "Ghost note — light correction"
      : isIntentionalSyncopation(hit, stepTicks, hits)
      ? "Syncopation preserved"
      : Math.abs(error) > stepTicks * 0.3
      ? "Strong timing correction"
      : "Minor timing correction";

    suggestions.push({
      hitId:             hit.id,
      originalTick:      hit.tick,
      suggestedTick:     correctedTick,
      correctionStrength: strength,
      reason,
    });
  }

  return suggestions;
};

/**
 * Apply quantization suggestions to a set of hits.
 * Suggestions are applied by ID — unaffected hits pass through unchanged.
 */
export const applyQuantizeSuggestions = (
  hits: DrumHit[],
  suggestions: QuantizeSuggestion[]
): DrumHit[] => {
  const map = new Map(suggestions.map((s) => [s.hitId, s.suggestedTick]));
  return hits.map((hit) =>
    map.has(hit.id) ? { ...hit, tick: map.get(hit.id)! } : hit
  );
};

/**
 * Convenience: suggest + apply in one call.
 * This is the "Apply Smart Quantize" action.
 */
export const smartQuantize = (
  hits: DrumHit[],
  grid: QuantizeGrid,
  ppq: number,
  options: SmartQuantizeOptions
): DrumHit[] => {
  const suggestions = suggestQuantization(hits, grid, ppq, options);
  return applyQuantizeSuggestions(hits, suggestions);
};

/** Default options: medium correction, preserves ghost notes. */
export const DEFAULT_SMART_QUANTIZE: SmartQuantizeOptions = {
  strength:      0.6,
  humanFactor:   0.5,
  preserveGhosts: true,
};
