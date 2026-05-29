/**
 * Notation Engine
 *
 * Master transcription pipeline. Takes a quantized RhythmResult and produces
 * per-measure notation data ready for VexFlow rendering.
 *
 * Design goals (mirroring the spec):
 *   • Preserve groove feel — no over-quantisation.
 *   • One coherent subdivision per measure.
 *   • Ghost notes and accents derived from velocity.
 *   • Automatic fill / break detection.
 *   • Warnings for notations that would be hard to read.
 *   • Per-measure justification text for debugging / UI display.
 */

import type { MeasureData, QuantizedHit, RhythmResult, TimeSignature } from "../core/types";
import {
  detectMeasureSubdivision,
  type MeasureSubdivision,
} from "./subdivisionDetector";
import { fillMeasureSlots, type DisplaySlot, type NoteSlot } from "../render/restOptimizer";

// ─── Velocity thresholds ──────────────────────────────────────────────────────
// Velocities in DrumHit are normalised 0–1 (see midiParser).

/** Below this → ghost note (written pp, parenthesised notehead or faint colour). */
const GHOST_THRESHOLD  = 0.31; // ≈ 40 / 127

/** Above this → accent (written ff, extra marker). */
const ACCENT_THRESHOLD = 0.79; // ≈ 100 / 127

// ─── Voice classification ─────────────────────────────────────────────────────

const CYMBAL_PIECES = new Set([
  "crash", "ride", "splash", "otherCymbal",
  "hihatOpen", "hihatClosed", "hihatPedal",
]);
const SNARE_PIECES = new Set(["snare", "snareRim"]);

type VoiceLayer = "cymbal" | "snare" | "kick" | "tom";

const hitVoice = (piece: string): VoiceLayer => {
  if (CYMBAL_PIECES.has(piece)) return "cymbal";
  if (SNARE_PIECES.has(piece))  return "snare";
  if (piece === "kick")         return "kick";
  return "tom";
};

// ─── Fill detection ───────────────────────────────────────────────────────────

/**
 * A measure is flagged as a fill when:
 *   (a) toms appear, OR
 *   (b) note density is ≥ FILL_DENSITY_FACTOR × running average AND
 *       the measure departs from the established groove pattern.
 */
const FILL_DENSITY_FACTOR = 1.75;

const detectFills = (measures: MeasureData[]): boolean[] => {
  const densities = measures.map(m => m.chords.length);
  const avgDensity =
    densities.reduce((s, d) => s + d, 0) / Math.max(1, densities.length);

  return measures.map(m => {
    const hasToms       = m.chords.some(c => c.hits.some(h => hitVoice(h.piece) === "tom"));
    const isHighDensity = m.chords.length >= avgDensity * FILL_DENSITY_FACTOR;

    // High density AND both kick+snare present suggests a fill (or break)
    const bothKickSnare =
      m.chords.some(c => c.hits.some(h => hitVoice(h.piece) === "kick")) &&
      m.chords.some(c => c.hits.some(h => hitVoice(h.piece) === "snare"));

    return hasToms || (isHighDensity && bothKickSnare);
  });
};

// ─── Velocity classification ──────────────────────────────────────────────────

const classifyHit = (hit: QuantizedHit) => ({
  isGhost:  hit.isGhost  || hit.velocity <= GHOST_THRESHOLD,
  isAccent: hit.isAccent || hit.velocity >= ACCENT_THRESHOLD,
});

// ─── Notation complexity check ────────────────────────────────────────────────

/** Warn when a measure mixes too many different note durations. */
const MAX_DISTINCT_DURS = 3;

const complexityWarning = (slots: DisplaySlot[], measureIndex: number): string | null => {
  const noteSlots = slots.filter((s): s is NoteSlot => s.type === "note");
  const durs = new Set(noteSlots.map(s => s.dur));
  return durs.size > MAX_DISTINCT_DURS
    ? `Mesure ${measureIndex + 1} : notation complexe (${durs.size} durées différentes) — vérifier lisibilité`
    : null;
};

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MeasureNotation {
  measureIndex:  number;
  subdivision:   MeasureSubdivision;
  /** Display slots (notes + rests) ordered by tick, ready for VexFlow. */
  slots:         DisplaySlot[];
  /** Hit IDs that should render as ghost notes (pp, faint). */
  ghostNoteIds:  ReadonlySet<string>;
  /** Hit IDs that should render with an accent marker. */
  accentNoteIds: ReadonlySet<string>;
  /** True when this measure looks like a fill or break. */
  isFill:        boolean;
  /** Human-readable explanations for the choices made. */
  justification: string[];
}

export interface NotationResult {
  measures:     MeasureNotation[];
  /** Dominant groove style across the whole piece. */
  globalGroove: string;
  /** Non-fatal issues the caller should surface in the UI. */
  warnings:     string[];
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export const buildNotation = (
  rhythm: RhythmResult,
  ppq: number,
  signature: TimeSignature
): NotationResult => {
  const { measures, ticksPerMeasure } = rhythm;
  const beatTicks = ppq * (4 / signature.denominator);
  const warnings: string[] = [];

  // ── Per-measure subdivision analysis ────────────────────────────────────────
  const subdivisions = measures.map(m => detectMeasureSubdivision(m, ppq));

  // ── Global groove: majority vote ─────────────────────────────────────────────
  const grooveVotes = subdivisions.reduce<Record<string, number>>((acc, s) => {
    acc[s.grooveType] = (acc[s.grooveType] ?? 0) + 1;
    return acc;
  }, {});
  const globalGroove =
    Object.entries(grooveVotes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "straight";

  // Warn on unstable groove
  const dominantCount = Math.max(...Object.values(grooveVotes));
  if (measures.length > 2 && dominantCount < measures.length * 0.6) {
    warnings.push(
      "Groove irrégulier — le feel change souvent entre les mesures. " +
      "Envisager une notation swing unifiée ou vérifier la source MIDI."
    );
  }

  // ── Fill detection ───────────────────────────────────────────────────────────
  const fillFlags = detectFills(measures);

  // ── Per-measure notation ─────────────────────────────────────────────────────
  const result: MeasureNotation[] = measures.map((measure, i) => {
    const subdivision  = subdivisions[i];
    const slots        = fillMeasureSlots(measure.chords, ticksPerMeasure, ppq, beatTicks);
    const justification: string[] = [subdivision.justification];

    // Velocity classification
    const ghostNoteIds  = new Set<string>();
    const accentNoteIds = new Set<string>();

    for (const chord of measure.chords) {
      for (const hit of chord.hits) {
        const { isGhost, isAccent } = classifyHit(hit);
        if (isGhost)  ghostNoteIds.add(hit.id);
        if (isAccent) accentNoteIds.add(hit.id);
      }
    }

    // Annotations
    if (fillFlags[i]) {
      justification.push(
        measure.chords.some(c => c.hits.some(h => hitVoice(h.piece) === "tom"))
          ? "Fill détecté (toms présents)"
          : "Break détecté (haute densité)"
      );
    }
    if (ghostNoteIds.size > 0) {
      justification.push(`${ghostNoteIds.size} ghost note(s) (vélocité faible)`);
    }
    if (accentNoteIds.size > 0) {
      justification.push(`${accentNoteIds.size} accent(s) (vélocité forte)`);
    }
    if (subdivision.confidence < 0.45) {
      justification.push("Subdivision incertaine — notation simplifiée appliquée");
    }

    // Complexity check
    const warn = complexityWarning(slots, i);
    if (warn) {
      justification.push("⚠ Notation complexe");
      warnings.push(warn);
    }

    return {
      measureIndex:  i,
      subdivision,
      slots,
      ghostNoteIds,
      accentNoteIds,
      isFill: fillFlags[i],
      justification,
    };
  });

  return { measures: result, globalGroove, warnings };
};
