/**
 * Groove-aware quantizer
 *
 * Philosophy (matching the notation spec):
 *   • Hard snapping destroys groove → use a SOFT tolerance window.
 *   • If a note is within `grooveTolerance × step` of the nearest grid
 *     position, keep its original tick (preserves human feel).
 *   • Only snap when the deviation is large enough to be a mistake, not feel.
 *   • Swing is detected automatically per pair of 8th notes.
 */

import type { ParsedDrumProject, QuantizeGrid, QuantizeOptions, QuantizedHit } from "./types";

// ─── Grid → ticks ─────────────────────────────────────────────────────────────

const gridToTicks = (ppq: number, grid: QuantizeGrid): number => {
  switch (grid) {
    case "1/4":  return ppq;
    case "1/8":  return ppq / 2;
    case "1/16": return ppq / 4;
    case "1/32": return ppq / 8;
    case "8T":   return ppq / 3;
    case "16T":  return ppq / 6;
  }
};

// ─── Swing detection ──────────────────────────────────────────────────────────

/**
 * Estimate swing amount from the distribution of offbeat 8th positions.
 * Returns 0 (straight) to 0.25 (strong shuffle).
 */
const detectSwing = (hits: ParsedDrumProject["hits"], step: number): number => {
  const offbeats = hits
    .map(h => h.tick % (step * 2))
    .filter(v => v > 0.2 * step && v < 1.9 * step);
  if (offbeats.length === 0) return 0;
  const avg = offbeats.reduce((acc, v) => acc + v, 0) / offbeats.length;
  return Math.max(0, Math.min(0.25, (avg - step) / step));
};

// ─── Smart snap ──────────────────────────────────────────────────────────────

/**
 * Find the nearest grid position for a tick.
 *
 * With swing, the second 8th of each pair is shifted by `swing × step`.
 * All integer multiples of `step` are valid candidates; we check the two
 * surrounding ones plus the swing-shifted one.
 *
 * `grooveTolerance` (0–0.5): if the nearest grid position is within this
 * fraction of `step`, return the ORIGINAL tick instead of snapping.
 * Set to 0 for strict quantisation, ~0.15 for groove-preserving mode.
 */
const snapTickToGrid = (
  tick: number,
  step: number,
  swing: number,
  grooveTolerance: number
): number => {
  const lower = Math.floor(tick / step) * step;
  const upper = lower + step;

  // Standard candidates: immediate grid neighbours
  const candidates = [lower, upper];

  // Swing: the "and" of each pair sits at pairStart + step + step*swing
  if (swing > 0) {
    const pair       = step * 2;
    const pairStart  = Math.floor(tick / pair) * pair;
    const swingPos   = pairStart + step + step * swing;
    candidates.push(swingPos);
    // Also try the next pair's swing position
    candidates.push(swingPos + pair);
  }

  // Closest candidate
  let best     = candidates[0];
  let bestDist = Math.abs(tick - best);
  for (const c of candidates.slice(1)) {
    const d = Math.abs(tick - c);
    if (d < bestDist) { best = c; bestDist = d; }
  }

  // Soft groove preservation: don't snap when the deviation is small
  if (grooveTolerance > 0 && bestDist / step <= grooveTolerance) {
    return tick; // keep original tick — this IS the groove
  }

  return Math.round(best);
};

// ─── Public API ───────────────────────────────────────────────────────────────

/** Default tolerance for groove-preserving mode (15 % of a step). */
export const DEFAULT_GROOVE_TOLERANCE = 0.15;

export const quantizeHits = (
  project: ParsedDrumProject,
  inputOptions: Partial<QuantizeOptions>
): { hits: QuantizedHit[]; options: QuantizeOptions } => {
  const options: QuantizeOptions = {
    grid:           inputOptions.grid           ?? "1/16",
    preserveGroove: inputOptions.preserveGroove ?? true,
    swing:          inputOptions.swing          ?? 0,
  };

  const step       = gridToTicks(project.ppq, options.grid);
  const autoSwing  = options.swing > 0
    ? options.swing
    : detectSwing(project.hits, step);

  // Groove tolerance: active when preserveGroove is on, disabled for strict mode
  const tolerance = options.preserveGroove ? DEFAULT_GROOVE_TOLERANCE : 0;

  const hits: QuantizedHit[] = project.hits.map(hit => {
    const quantizedTick = snapTickToGrid(hit.tick, step, autoSwing, tolerance);

    return {
      ...hit,
      originalTick:      hit.tick,
      quantizedTick,
      quantizedDuration: Math.max(step, Math.round(hit.durationTicks / step) * step),
      // Keep velocity as-is in groove-preserve mode; normalise in strict mode
      velocity: options.preserveGroove
        ? hit.velocity
        : Math.round(hit.velocity * 100) / 100,
    };
  });

  hits.sort((a, b) => a.quantizedTick - b.quantizedTick);
  return { hits, options: { ...options, swing: autoSwing } };
};
