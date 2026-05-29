/**
 * Section Energy Detector
 *
 * Maps structural sections (groove/fill/break/transition/intro/outro) from
 * sectionAnalyzer to MUSICAL roles (verse/chorus/bridge/breakdown/build-up)
 * by correlating them with per-measure energy scores.
 *
 * Output: MusicalSection[] — enriches each structural Section with a
 * musical context label and energy statistics.
 */

import type { Section } from "./sectionAnalyzer";
import type { MeasureEnergy } from "./energyFlowAnalyzer";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MusicalRole =
  | "intro"
  | "verse"
  | "chorus"
  | "bridge"
  | "breakdown"
  | "build"
  | "fill"
  | "outro"
  | "unknown";

export interface MusicalSection {
  section:     Section;
  musicalRole: MusicalRole;
  avgEnergy:   number;    // 0–100
  peakEnergy:  number;    // 0–100
  energyTrend: "rising" | "falling" | "steady";
  color:       string;    // hex for UI
}

// ─── Colour + label maps ───────────────────────────────────────────────────────

export const MUSICAL_ROLE_COLORS: Record<MusicalRole, string> = {
  intro:     "#22c55e",
  verse:     "#60a5fa",
  chorus:    "#ef4444",
  bridge:    "#f59e0b",
  breakdown: "#6b7280",
  build:     "#f97316",
  fill:      "#a78bfa",
  outro:     "#94a3b8",
  unknown:   "#3f3f46",
};

export const MUSICAL_ROLE_LABELS: Record<MusicalRole, string> = {
  intro:     "Intro",
  verse:     "Verse",
  chorus:    "Chorus",
  bridge:    "Bridge",
  breakdown: "Breakdown",
  build:     "Build",
  fill:      "Fill",
  outro:     "Outro",
  unknown:   "—",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sliceEnergy = (sec: Section, measures: MeasureEnergy[]): MeasureEnergy[] =>
  measures.slice(sec.startMeasure, sec.endMeasure + 1);

const sectionAvg = (sec: Section, measures: MeasureEnergy[]): number => {
  const slice = sliceEnergy(sec, measures);
  return slice.length === 0 ? 0 : slice.reduce((s, m) => s + m.score, 0) / slice.length;
};

const sectionPeak = (sec: Section, measures: MeasureEnergy[]): number => {
  const slice = sliceEnergy(sec, measures);
  return slice.length === 0 ? 0 : Math.max(...slice.map((m) => m.score));
};

const sectionTrend = (
  sec: Section,
  measures: MeasureEnergy[]
): MusicalSection["energyTrend"] => {
  const slice = sliceEnergy(sec, measures);
  if (slice.length < 2) return "steady";
  const mid    = Math.ceil(slice.length / 2);
  const first  = slice.slice(0, mid).reduce((s, m) => s + m.score, 0) / mid;
  const second = slice.slice(mid).reduce((s, m) => s + m.score, 0) / Math.max(slice.length - mid, 1);
  if (second > first + 8)  return "rising";
  if (first  > second + 8) return "falling";
  return "steady";
};

// ─── Role mapping ─────────────────────────────────────────────────────────────

const assignRole = (
  section:          Section,
  avgEnergy:        number,
  peakEnergy:       number,
  trend:            MusicalSection["energyTrend"],
  globalPeakEnergy: number
): MusicalRole => {
  // Preserve labels already detected by sectionAnalyzer
  if (section.type === "intro") return "intro";
  if (section.type === "outro") return "outro";
  if (section.type === "fill")  return "fill";

  const peakRatio = globalPeakEnergy > 0 ? peakEnergy  / globalPeakEnergy : 0;
  const avgRatio  = globalPeakEnergy > 0 ? avgEnergy   / globalPeakEnergy : 0;

  // Very low energy → breakdown (could be a quiet bridge or actual breakdown)
  if (avgEnergy < 18 || (section.type === "break" && avgEnergy < 32)) return "breakdown";

  // Clear energy peak (high avg + high relative score) → chorus
  if (peakRatio > 0.78 && avgRatio > 0.68) return "chorus";

  // Rising energy and moderate level → build-up
  if (trend === "rising" && avgRatio > 0.30 && avgRatio < 0.72) return "build";

  // Very short sections between high/low energy → bridge
  if (section.measureCount <= 3 && section.type === "transition") return "bridge";
  if (section.type === "transition") return "bridge";

  // Moderate energy → verse
  if (avgRatio > 0.28) return "verse";

  return "breakdown";
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enriches structural sections with musical roles based on energy profiles.
 * Pure function — safe to call in useMemo.
 */
export const detectMusicalSections = (
  sections: Section[],
  measures: MeasureEnergy[]
): MusicalSection[] => {
  if (sections.length === 0 || measures.length === 0) return [];

  const avgEnergies = sections.map((s) => sectionAvg(s, measures));
  const globalPeak  = Math.max(...avgEnergies, 1);

  return sections.map((section, i) => {
    const avgEnergy  = Math.round(avgEnergies[i]);
    const peakEnergy = Math.round(sectionPeak(section, measures));
    const trend      = sectionTrend(section, measures);
    const role       = assignRole(section, avgEnergies[i], peakEnergy, trend, globalPeak);

    return {
      section,
      musicalRole:  role,
      avgEnergy,
      peakEnergy,
      energyTrend:  trend,
      color:        MUSICAL_ROLE_COLORS[role],
    };
  });
};
