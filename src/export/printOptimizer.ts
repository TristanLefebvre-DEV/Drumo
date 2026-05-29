/**
 * Print Optimizer
 *
 * Transforms a PageLayout into print-ready recommendations and metadata.
 * Provides layout quality scores, potential issues, and suggestions.
 *
 * Does NOT touch the VexFlow renderer directly — it outputs data structures
 * that can be passed to the renderer or used in a PDF export pipeline.
 */

import { computePageLayout, layoutSummary, type PageLayout, type LayoutPreset } from "./pageLayoutEngine";
import type { ParsedDrumProject } from "../core/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PrintIssue {
  severity:    "warning" | "info";
  message:     string;
  pageIndex?:  number;
  lineIndex?:  number;
}

export interface PrintOptimization {
  layout:       PageLayout;
  issues:       PrintIssue[];
  qualityScore: number;   // 0–100
  summary:      string;
  suggestions:  string[];
}

// ─── Quality scoring ──────────────────────────────────────────────────────────

const scoreLayout = (layout: PageLayout): { score: number; issues: PrintIssue[] } => {
  const issues: PrintIssue[] = [];
  let deductions = 0;

  for (const page of layout.pages) {
    for (let li = 0; li < page.lines.length; li++) {
      const line = page.lines[li];

      // Single-measure lines are problematic (unless the whole piece is one measure)
      if (line.measureCount === 1 && layout.totalMeasures > 4) {
        issues.push({ severity: "warning", message: `Ligne orpheline (1 mesure) — page ${page.pageIndex + 1}`, pageIndex: page.pageIndex, lineIndex: li });
        deductions += 15;
      }

      // Very dense fill lines adjacent to very sparse lines
      const prev = li > 0 ? page.lines[li - 1] : null;
      if (prev && Math.abs(line.visualWeight - prev.visualWeight) > 0.6) {
        issues.push({ severity: "info", message: `Contraste de densité élevé entre lignes ${li} et ${li + 1} — page ${page.pageIndex + 1}`, pageIndex: page.pageIndex, lineIndex: li });
        deductions += 5;
      }

      // Line with too many measures (hard to read)
      if (line.measureCount > 5) {
        issues.push({ severity: "warning", message: `${line.measureCount} mesures sur une ligne — lisibilité réduite`, pageIndex: page.pageIndex, lineIndex: li });
        deductions += 8;
      }
    }

    // Last page with only one line
    if (layout.pages.length > 1 && page.pageIndex === layout.pages.length - 1 && page.lineCount === 1) {
      issues.push({ severity: "info", message: "Dernière page avec seulement 1 ligne — envisager le mode compact", pageIndex: page.pageIndex });
      deductions += 10;
    }
  }

  return { score: Math.max(0, 100 - deductions), issues };
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const optimizeForPrint = (
  project: ParsedDrumProject,
  preset:  LayoutPreset = "reading"
): PrintOptimization => {
  const layout = computePageLayout(project, preset);
  const { score, issues } = scoreLayout(layout);
  const summary = layoutSummary(layout);

  const suggestions: string[] = [];
  if (score < 70) {
    suggestions.push("Essayer le mode 'compact' pour réduire le nombre de pages.");
  }
  if (issues.some(i => i.severity === "warning")) {
    suggestions.push("Ajuster manuellement les lignes avec contraste de densité élevé.");
  }
  if (layout.pages.length > 3) {
    suggestions.push("Pièce longue — vérifier la mise en page avant impression.");
  }
  if (layout.lineGroups.some(l => l.containsFill && l.measureCount > 4)) {
    suggestions.push("Certains fills s'étendent sur des lignes chargées — lisibilité optimale à 4 mesures/ligne.");
  }

  return { layout, issues, qualityScore: score, summary, suggestions };
};

/** Compute layout for all three presets and return the highest-scoring one. */
export const bestPreset = (project: ParsedDrumProject): PrintOptimization => {
  const presets: LayoutPreset[] = ["compact", "reading", "publication"];
  const opts = presets.map(p => optimizeForPrint(project, p));
  return opts.reduce((best, cur) => cur.qualityScore > best.qualityScore ? cur : best);
};
