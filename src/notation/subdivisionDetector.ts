/**
 * Subdivision Detector
 *
 * Analyses the tick positions of chords in a single measure and returns the
 * dominant rhythmic grid plus the groove feel (straight / swing / shuffle /
 * triplet / 16th).
 *
 * Priority: LISIBILITY over mathematical precision.
 *   • Prefer coarser grids when the fit is nearly as good.
 *   • Only report 1/32 when strictly necessary.
 *   • When swing is detected, report it so callers can choose triplet notation.
 */

import type { MeasureData } from "../core/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export type SubdivisionType = "1/4" | "1/8" | "1/16" | "1/32" | "8T" | "16T";
export type GrooveType = "straight" | "swing" | "shuffle" | "triplet" | "16th" | "mixed";

export interface MeasureSubdivision {
  /** Coarsest grid that accurately represents the measure. */
  subdivision: SubdivisionType;
  /** Human groove category. */
  grooveType: GrooveType;
  /** 0 = perfectly straight, ~0.33 = full triplet swing. */
  swingRatio: number;
  /** 0–1: how unambiguous the dominant grid is. */
  confidence: number;
  /** Short text a musician would recognise. */
  justification: string;
}

// ─── Grid candidates (coarse → fine) ─────────────────────────────────────────

type Grid = { name: SubdivisionType; mult: number };

const GRIDS: Grid[] = [
  { name: "1/4",  mult: 1       },
  { name: "1/8",  mult: 0.5     },
  { name: "8T",   mult: 1 / 3   },
  { name: "1/16", mult: 0.25    },
  { name: "16T",  mult: 1 / 6   },
  { name: "1/32", mult: 0.125   },
];

// ─── Core scoring ─────────────────────────────────────────────────────────────

/**
 * RMS snap error expressed as a fraction of the step size.
 * Lower = notes align better to this grid.
 */
const rmsError = (ticks: number[], step: number): number => {
  if (ticks.length === 0) return Infinity;
  const sum = ticks.reduce((acc, t) => {
    const mod  = ((t % step) + step) % step;
    const dist = Math.min(mod, step - mod) / step; // 0–0.5
    return acc + dist * dist;
  }, 0);
  return Math.sqrt(sum / ticks.length);
};

// ─── Swing measurement ────────────────────────────────────────────────────────

/**
 * Estimate how much the "offbeat" 8th-note positions are pushed late.
 * Returns 0 (straight) → ~0.33 (full swing/triplet).
 *
 * Algorithm:
 *   For every tick that lands near the second 8th of a pair, compute its
 *   position within that pair as a ratio.  Straight = 0.5, full swing ≈ 0.667.
 *   We normalise to 0–0.35.
 */
const measureSwing = (ticks: number[], step8: number): number => {
  const pair = step8 * 2;
  const offbeats = ticks.filter(t => {
    const mod = ((t % pair) + pair) % pair;
    // Accept ticks sitting between 55 % and 145 % of step8 inside a pair
    return mod > step8 * 0.55 && mod < step8 * 1.45;
  });
  if (offbeats.length < 2) return 0;

  const ratios = offbeats.map(t => {
    const pairStart = Math.floor(t / pair) * pair;
    return (t - pairStart) / pair; // expected ≈ 0.5 straight, ≈ 0.667 full swing
  });
  const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;

  // Map [0.5 … 0.667+] → [0 … 0.35]
  const raw = (avg - 0.5) / 0.5;
  return Math.max(0, Math.min(0.35, raw));
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const detectMeasureSubdivision = (
  measure: MeasureData,
  ppq: number
): MeasureSubdivision => {
  const ticks = measure.chords.map(c => c.tickInMeasure);

  if (ticks.length === 0) {
    return {
      subdivision: "1/4",
      grooveType:  "straight",
      swingRatio:  0,
      confidence:  0,
      justification: "Mesure vide",
    };
  }

  // ── 1. Score all grids ──────────────────────────────────────────────────────
  const scored = GRIDS
    .map(g => ({ ...g, step: ppq * g.mult, error: rmsError(ticks, ppq * g.mult) }))
    .sort((a, b) => a.error - b.error);

  const best   = scored[0];
  const second = scored[1];

  // Confidence: relative gap between best and second-best
  const confidence = second.error > 0
    ? Math.min(1, (second.error - best.error) / second.error + 0.25)
    : 1;

  // ── 2. Simplicity bias: prefer coarser grid when fine also fits ────────────
  let subdivision: SubdivisionType = best.name;

  const err = (name: SubdivisionType) => scored.find(s => s.name === name)!.error;

  // 1/16 → try 1/8 first
  if (subdivision === "1/16" && err("1/8") < 0.12 && err("1/8") <= err("1/16") * 1.4) {
    subdivision = "1/8";
  }
  // 1/8 or 1/16 → try 1/4
  if ((subdivision === "1/8" || subdivision === "1/16") && err("1/4") < 0.07) {
    subdivision = "1/4";
  }
  // Prefer triplet grid (8T / 16T) only when it wins clearly
  if (subdivision === "8T" && err("1/8") < err("8T") * 1.5) {
    subdivision = "1/8";
  }

  // ── 3. Swing detection ─────────────────────────────────────────────────────
  const step8      = ppq * 0.5;
  const swingRatio = measureSwing(ticks, step8);

  // ── 4. Groove type ─────────────────────────────────────────────────────────
  let grooveType: GrooveType;

  if (subdivision === "8T" || subdivision === "16T") {
    grooveType = "triplet";
  } else if (swingRatio > 0.22) {
    grooveType = "swing";
  } else if (swingRatio > 0.08) {
    grooveType = "shuffle";
  } else if (subdivision === "1/32") {
    grooveType = "mixed";
  } else if (subdivision === "1/16") {
    grooveType = "16th";
  } else {
    grooveType = "straight";
  }

  // ── 5. Human-readable justification ───────────────────────────────────────
  const parts: string[] = [`Grille: ${subdivision}`, `Groove: ${grooveType}`];
  if (swingRatio > 0.06) {
    parts.push(`swing ${(swingRatio * 100).toFixed(0)} %`);
  }
  if (confidence < 0.45) {
    parts.push("subdivision ambiguë — plusieurs grilles possibles");
  }

  return {
    subdivision,
    grooveType,
    swingRatio,
    confidence,
    justification: parts.join(" | "),
  };
};
