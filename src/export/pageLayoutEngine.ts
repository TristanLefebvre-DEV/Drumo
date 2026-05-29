/**
 * Page Layout Engine
 *
 * Computes an optimal distribution of measures across lines and pages
 * for professional print/PDF output.
 *
 * Goals:
 *   - Respect section boundaries (don't split fills mid-line)
 *   - Balance visual density across lines (avoid sparse + dense lines adjacent)
 *   - Standard target: 4 measures per line (adjustable by density)
 *   - Avoid orphan lines (single measure on last line of a page)
 *   - Support compact / reading / publication presets
 *
 * The engine works on MeasureStats from fillDetector and returns
 * LineGroup[] — each line group specifies which measure range to render.
 */

import { detectFills, type MeasureStats } from "../analysis/fillDetector";
import type { ParsedDrumProject } from "../core/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LayoutPreset = "compact" | "reading" | "publication";

export interface LineGroup {
  startMeasure:  number;  // inclusive
  endMeasure:    number;  // inclusive
  measureCount:  number;
  visualWeight:  number;  // 0–1 relative density for this line
  containsFill:  boolean;
}

export interface PageGroup {
  lines:        LineGroup[];
  pageIndex:    number;
  lineCount:    number;
}

export interface PageLayout {
  pages:          PageGroup[];
  lineGroups:     LineGroup[];   // flat list for rendering
  totalMeasures:  number;
  measuresPerLine: number;       // target (may vary per line)
  preset:         LayoutPreset;
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESET_CONFIG: Record<LayoutPreset, {
  targetPerLine: number;
  linesPerPage:  number;
  maxPerLine:    number;
  minPerLine:    number;
}> = {
  compact:     { targetPerLine: 5, linesPerPage: 8, maxPerLine: 6, minPerLine: 3 },
  reading:     { targetPerLine: 4, linesPerPage: 6, maxPerLine: 5, minPerLine: 2 },
  publication: { targetPerLine: 4, linesPerPage: 5, maxPerLine: 5, minPerLine: 3 },
};

// ─── Visual weight ────────────────────────────────────────────────────────────

const computeWeight = (stats: MeasureStats): number => {
  // Combine density, unique pieces, and accent info
  const base    = Math.min(1, stats.density / 4);
  const complex = Math.min(1, stats.uniquePieces / 8);
  const fill    = stats.type === "fill" ? 0.3 : 0;
  return Math.min(1, base * 0.6 + complex * 0.3 + fill);
};

// ─── Core grouping algorithm ──────────────────────────────────────────────────

const groupMeasures = (
  stats:  MeasureStats[],
  config: typeof PRESET_CONFIG[LayoutPreset]
): LineGroup[] => {
  const { targetPerLine, maxPerLine, minPerLine } = config;
  const lines: LineGroup[] = [];
  let i = 0;

  while (i < stats.length) {
    // Try to form a line of targetPerLine measures, but respect section boundaries
    const remaining = stats.length - i;
    let count = Math.min(targetPerLine, remaining);

    // Don't break in the middle of a fill
    let j = i + count - 1;
    if (j < stats.length - 1) {
      // Look ahead: if j is mid-fill, extend or shrink the line
      if (stats[j].type === "fill" && j + 1 < stats.length && stats[j + 1].type === "fill") {
        // Extend to include the full fill
        while (j + 1 < stats.length && stats[j + 1].type === "fill" && count < maxPerLine) {
          j++; count++;
        }
      } else if (stats[j + 1]?.type === "fill" && count > minPerLine) {
        // End the line before the fill starts
        j--; count--;
      }
    }

    // Handle orphan: last line shouldn't be a single measure if avoidable
    if (remaining - count === 1 && count > minPerLine) {
      j--; count--;
    }

    const slice = stats.slice(i, i + count);
    const weight = slice.length > 0
      ? slice.reduce((s, m) => s + computeWeight(m), 0) / slice.length
      : 0;
    const hasFill = slice.some(m => m.type === "fill");

    lines.push({
      startMeasure: i,
      endMeasure:   i + count - 1,
      measureCount: count,
      visualWeight: weight,
      containsFill: hasFill,
    });

    i += count;
  }

  return lines;
};

// ─── Page grouping ────────────────────────────────────────────────────────────

const paginateLines = (lines: LineGroup[], linesPerPage: number): PageGroup[] => {
  const pages: PageGroup[] = [];
  for (let p = 0; p < lines.length; p += linesPerPage) {
    const pageLines = lines.slice(p, p + linesPerPage);
    pages.push({
      lines: pageLines,
      pageIndex: pages.length,
      lineCount: pageLines.length,
    });
  }
  return pages;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const computePageLayout = (
  project: ParsedDrumProject,
  preset:  LayoutPreset = "reading"
): PageLayout => {
  const stats  = detectFills(project);
  const config = PRESET_CONFIG[preset];

  if (stats.length === 0) {
    return {
      pages: [], lineGroups: [], totalMeasures: 0,
      measuresPerLine: config.targetPerLine, preset,
    };
  }

  const lineGroups = groupMeasures(stats, config);
  const pages      = paginateLines(lineGroups, config.linesPerPage);

  return {
    pages,
    lineGroups,
    totalMeasures:  stats.length,
    measuresPerLine: config.targetPerLine,
    preset,
  };
};

/** Summary string for display. */
export const layoutSummary = (layout: PageLayout): string => {
  const { pages, totalMeasures, preset } = layout;
  const totalLines = pages.reduce((s, p) => s + p.lineCount, 0);
  return `${totalMeasures} mesures · ${totalLines} lignes · ${pages.length} page(s) · mode ${preset}`;
};
