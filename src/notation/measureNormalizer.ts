/**
 * Measure Normalizer
 *
 * Converts a raw-quantized MeasureData into a notation-ready form:
 *
 *   1. Detects (or accepts) the dominant subdivision for the measure.
 *   2. Hard-snaps every chord tick to that subdivision grid.
 *      (Different from the MIDI quantizer which uses a soft groove-tolerance window —
 *       here we always snap hard because notation readability requires exact alignment.)
 *   3. Merges chords that collide at the same snapped position
 *      (combines their hits; when the same DrumPiece appears twice, keeps the louder one).
 *   4. Clamps snapped ticks to [0, ticksPerMeasure − step] so no chord escapes the measure.
 *
 * Cross-measure consistency:
 *   Call computeGlobalSubdivision() once over all measures, then pass the result
 *   as forceSubdivision to normalizeMeasure() — every measure will use the same grid.
 */

import type { MeasureData, DrumChord, QuantizedHit } from "../core/types";
import { detectMeasureSubdivision, type SubdivisionType } from "./subdivisionDetector";

// ─── Public types ──────────────────────────────────────────────────────────────

export interface NormalizerResult {
  chords:          DrumChord[];
  subdivision:     SubdivisionType;
  /** Ticks per one subdivision unit (e.g. ppq/4 for 1/16 at ppq=480 → 120). */
  subdivisionStep: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUBDIVISION_MULTIPLIER: Record<SubdivisionType, number> = {
  "1/4":  1,
  "1/8":  0.5,
  "8T":   1 / 3,
  "1/16": 0.25,
  "16T":  1 / 6,
  "1/32": 0.125,
};

const snapToGrid = (tick: number, step: number): number =>
  Math.round(tick / step) * step;

// ─── Global subdivision (cross-measure consistency) ───────────────────────────

/**
 * Majority-vote over all measures to find the dominant subdivision.
 *
 * Empty measures are skipped. When there is a tie, the coarser grid wins
 * (prefer 1/8 over 1/16 when equally common — easier to read).
 */
export const computeGlobalSubdivision = (
  measures: MeasureData[],
  ppq: number
): SubdivisionType => {
  const votes = new Map<SubdivisionType, number>();

  for (const m of measures) {
    if (m.chords.length === 0) continue;
    const { subdivision } = detectMeasureSubdivision(m, ppq);
    votes.set(subdivision, (votes.get(subdivision) ?? 0) + 1);
  }

  if (votes.size === 0) return "1/8";

  // Sort by count DESC, then by coarseness (higher multiplier = coarser = preferred on tie)
  const ranked = [...votes.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // more votes first
    return SUBDIVISION_MULTIPLIER[b[0]] - SUBDIVISION_MULTIPLIER[a[0]]; // coarser first
  });

  return ranked[0][0];
};

// ─── Per-measure normalizer ───────────────────────────────────────────────────

/**
 * Normalize one measure for notation rendering.
 *
 * @param measure            Source measure — never mutated.
 * @param ppq                Pulses per quarter note.
 * @param ticksPerMeasure    Total tick span of the measure.
 * @param forceSubdivision   Override per-measure detection (use for cross-measure consistency).
 */
export const normalizeMeasure = (
  measure: MeasureData,
  ppq: number,
  ticksPerMeasure: number,
  forceSubdivision?: SubdivisionType
): NormalizerResult => {
  const detected       = detectMeasureSubdivision(measure, ppq);
  const subdivision    = forceSubdivision ?? detected.subdivision;
  const subdivisionStep = Math.round(ppq * SUBDIVISION_MULTIPLIER[subdivision]);

  // Clamp boundary: a chord snapping to ticksPerMeasure would escape into the next measure
  const maxTick = ticksPerMeasure - subdivisionStep;

  // ── 1. Hard-snap ────────────────────────────────────────────────────────────
  const snapped: DrumChord[] = measure.chords
    .filter(c => c.hits.length > 0)
    .map(chord => {
      const raw         = snapToGrid(chord.tickInMeasure, subdivisionStep);
      const snappedTick = Math.max(0, Math.min(maxTick, raw));
      return {
        ...chord,
        tickInMeasure: snappedTick,
        absoluteTick:  measure.startTick + snappedTick,
      };
    });

  // ── 2. Merge chords at the same snapped position ────────────────────────────
  const byTick = new Map<number, { hits: QuantizedHit[]; absoluteTick: number }>();

  for (const chord of snapped) {
    const existing = byTick.get(chord.tickInMeasure);
    if (!existing) {
      byTick.set(chord.tickInMeasure, {
        hits:         [...chord.hits],
        absoluteTick: chord.absoluteTick,
      });
      continue;
    }
    // Merge: deduplicate by piece, keep the louder velocity
    for (const hit of chord.hits) {
      const idx = existing.hits.findIndex(h => h.piece === hit.piece);
      if (idx === -1) {
        existing.hits.push(hit);
      } else if (hit.velocity > existing.hits[idx].velocity) {
        existing.hits[idx] = hit;
      }
    }
  }

  // ── 3. Rebuild sorted chord list ────────────────────────────────────────────
  const mergedChords: DrumChord[] = [...byTick.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tick, { hits, absoluteTick }]) => ({
      tickInMeasure: tick,
      absoluteTick,
      hits,
    }));

  return { chords: mergedChords, subdivision, subdivisionStep };
};
