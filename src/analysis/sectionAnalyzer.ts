/**
 * Section Analyzer
 *
 * Groups consecutive same-type measures (from fillDetector) into
 * musical sections, then detects intro/outro by analysing density ramps.
 *
 * Output: Section[]  (non-overlapping, covering the entire piece)
 *
 * Section types:
 *   intro       – beginning, density ramps up
 *   groove      – consistent backbone
 *   fill        – tom-heavy deviation
 *   transition  – bridge between groove and fill
 *   break       – very sparse / silent
 *   outro       – end, density ramps down
 */

import { detectFills, type MeasureStats, type MeasureType } from "./fillDetector";
import type { ParsedDrumProject } from "../core/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SectionType = MeasureType | "intro" | "outro";

export interface Section {
  type:          SectionType;
  startMeasure:  number;
  endMeasure:    number;   // inclusive
  confidence:    number;
  avgDensity:    number;
  avgVelocity:   number;
  measureCount:  number;
}

// ─── Colour map ───────────────────────────────────────────────────────────────

export const SECTION_COLORS: Record<SectionType, { hex: string; label: string }> = {
  groove:     { hex: "#3b82f6", label: "Groove"     },
  fill:       { hex: "#f97316", label: "Fill"       },
  transition: { hex: "#8b5cf6", label: "Transition" },
  break:      { hex: "#6b7280", label: "Break"      },
  intro:      { hex: "#22c55e", label: "Intro"      },
  outro:      { hex: "#ef4444", label: "Outro"      },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avg = (vals: number[]) =>
  vals.length === 0 ? 0 : vals.reduce((s, v) => s + v, 0) / vals.length;

const isDensityRising = (stats: MeasureStats[], from: number, to: number): boolean => {
  if (to <= from) return false;
  const slice = stats.slice(from, to + 1);
  let rising = 0;
  for (let i = 1; i < slice.length; i++) {
    if (slice[i].density > slice[i - 1].density) rising++;
  }
  return rising / (slice.length - 1) >= 0.6;
};

const isDensityFalling = (stats: MeasureStats[], from: number, to: number): boolean => {
  if (to <= from) return false;
  const slice = stats.slice(from, to + 1);
  let falling = 0;
  for (let i = 1; i < slice.length; i++) {
    if (slice[i].density < slice[i - 1].density) falling++;
  }
  return falling / (slice.length - 1) >= 0.6;
};

// ─── Group consecutive measures ────────────────────────────────────────────────

const groupConsecutive = (stats: MeasureStats[]): Section[] => {
  if (stats.length === 0) return [];

  const sections: Section[] = [];
  let start = 0;
  let curType = stats[0].type;

  for (let i = 1; i <= stats.length; i++) {
    const atEnd = i === stats.length;
    const typeChanged = !atEnd && stats[i].type !== curType;

    if (atEnd || typeChanged) {
      const slice = stats.slice(start, i);
      sections.push({
        type:         curType,
        startMeasure: start,
        endMeasure:   i - 1,
        confidence:   avg(slice.map((s) => s.confidence)),
        avgDensity:   avg(slice.map((s) => s.density)),
        avgVelocity:  avg(slice.map((s) => s.avgVelocity)),
        measureCount: slice.length,
      });
      if (!atEnd) { start = i; curType = stats[i].type; }
    }
  }

  return sections;
};

// ─── Intro / Outro detection ───────────────────────────────────────────────────

const detectIntroOutro = (sections: Section[], allStats: MeasureStats[]): void => {
  if (sections.length === 0) return;

  const INTRO_MAX_MEASURES = 8;
  const OUTRO_MAX_MEASURES = 8;

  // Intro: first groove section with rising density ≤ INTRO_MAX_MEASURES
  const first = sections[0];
  if (
    first.type === "groove" &&
    first.measureCount <= INTRO_MAX_MEASURES &&
    isDensityRising(allStats, first.startMeasure, first.endMeasure)
  ) {
    first.type = "intro";
  }

  // Outro: last groove section with falling density ≤ OUTRO_MAX_MEASURES
  const last = sections[sections.length - 1];
  if (
    last.type === "groove" &&
    last.measureCount <= OUTRO_MAX_MEASURES &&
    isDensityFalling(allStats, last.startMeasure, last.endMeasure)
  ) {
    last.type = "outro";
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const analyzeSections = (project: ParsedDrumProject): Section[] => {
  const measureStats = detectFills(project);
  if (measureStats.length === 0) return [];

  const sections = groupConsecutive(measureStats);
  detectIntroOutro(sections, measureStats);
  return sections;
};

/** Find which section contains a given measure index. */
export const sectionAtMeasure = (sections: Section[], measureIndex: number): Section | null =>
  sections.find((s) => measureIndex >= s.startMeasure && measureIndex <= s.endMeasure) ?? null;

/** Compact text label: "Groove 8m" */
export const sectionLabel = (s: Section): string =>
  `${SECTION_COLORS[s.type].label} ${s.measureCount}m`;
