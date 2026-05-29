/**
 * Kit Balance Analyzer
 *
 * Measures the proportional usage of each instrument category and
 * compares it against reference style profiles to:
 *   1. Identify the closest matching style
 *   2. Surface deviations from the target profile
 *   3. Generate concrete, actionable suggestions
 *
 * Output is designed for display in a professional analytics panel.
 */

import type { ParsedDrumProject } from "../core/types";
import { STYLE_PROFILES, type DrumStyle, type StyleProfile } from "./styleProfiles";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface KitBalance {
  kickDominance:  number;  // 0–100
  snarePresence:  number;
  cymbalDensity:  number;
  tomUsage:       number;
  ghostNoteRatio: number;
  accentRatio:    number;
  dynamicRange:   number;
  totalHits:      number;
  bpm:            number;
}

export interface StyleDeviation {
  metric:   keyof Omit<KitBalance, "totalHits" | "bpm">;
  actual:   number;
  target:   number;
  delta:    number;    // actual − target (negative = below, positive = above)
  severity: "ok" | "minor" | "moderate" | "major";
}

export interface KitBalanceResult {
  balance:       KitBalance;
  closestStyle:  StyleProfile;
  targetStyle:   StyleProfile;  // selected by user (may differ from closest)
  matchScore:    number;        // 0–100 similarity to closestStyle
  deviations:    StyleDeviation[];
  suggestions:   string[];
  chartData:     ChartMetric[];
}

export interface ChartMetric {
  key:     keyof Omit<KitBalance, "totalHits" | "bpm">;
  label:   string;
  actual:  number;
  target:  number;
  delta:   number;
  color:   string;   // actual bar colour
}

// ─── Metric descriptors ────────────────────────────────────────────────────────

const METRIC_LABELS: Record<keyof Omit<KitBalance, "totalHits" | "bpm">, string> = {
  kickDominance:  "Kick",
  snarePresence:  "Snare",
  cymbalDensity:  "Cymbales",
  tomUsage:       "Toms",
  ghostNoteRatio: "Ghost Notes",
  accentRatio:    "Accents",
  dynamicRange:   "Dynamique",
};

const METRIC_COLORS: Record<keyof Omit<KitBalance, "totalHits" | "bpm">, string> = {
  kickDominance:  "#3b82f6",
  snarePresence:  "#22c55e",
  cymbalDensity:  "#f59e0b",
  tomUsage:       "#8b5cf6",
  ghostNoteRatio: "#6b7280",
  accentRatio:    "#ef4444",
  dynamicRange:   "#14b8a6",
};

// ─── Balance extraction ────────────────────────────────────────────────────────

export const extractKitBalance = (project: ParsedDrumProject): KitBalance => {
  const { hits, tempoBpm } = project;
  const total = Math.max(1, hits.length);

  const kick   = hits.filter(h => h.piece === "kick");
  const snare  = hits.filter(h => h.piece === "snare" || h.piece === "snareRim");
  const cymbal = hits.filter(h =>
    h.piece === "hihatClosed" || h.piece === "hihatOpen" || h.piece === "hihatPedal" ||
    h.piece === "ride" || h.piece === "crash" || h.piece === "splash" || h.piece === "otherCymbal");
  const toms  = hits.filter(h =>
    h.piece === "tomHigh" || h.piece === "tomMid" || h.piece === "tomLow");
  const ghost  = hits.filter(h => h.isGhost);
  const accent = hits.filter(h => h.isAccent);

  const vels = hits.map(h => h.velocity);
  const dynRange = vels.length > 1
    ? (Math.max(...vels) - Math.min(...vels)) * 100
    : 0;

  return {
    kickDominance:  Math.round(kick.length   / total * 100),
    snarePresence:  Math.round(snare.length  / total * 100),
    cymbalDensity:  Math.round(cymbal.length / total * 100),
    tomUsage:       Math.round(toms.length   / total * 100),
    ghostNoteRatio: Math.round(ghost.length  / total * 100),
    accentRatio:    Math.round(accent.length / total * 100),
    dynamicRange:   Math.round(Math.min(100, dynRange)),
    totalHits:      total,
    bpm:            tempoBpm,
  };
};

// ─── Style matching ────────────────────────────────────────────────────────────

const styleDistance = (balance: KitBalance, profile: StyleProfile): number => {
  const keys: Array<keyof Omit<KitBalance, "totalHits" | "bpm">> = [
    "kickDominance", "snarePresence", "cymbalDensity", "tomUsage",
    "ghostNoteRatio", "accentRatio", "dynamicRange",
  ];
  const weights = [2.0, 1.8, 1.5, 1.0, 0.8, 0.8, 1.2]; // weighted by importance
  let dist = 0, totalW = 0;
  for (let i = 0; i < keys.length; i++) {
    const d = Math.abs(balance[keys[i]] - profile[keys[i]]);
    dist   += d * weights[i];
    totalW += 100 * weights[i];
  }
  return dist / totalW;  // 0 = perfect, 1 = max distance
};

const findClosestStyle = (balance: KitBalance): StyleProfile => {
  const profiles = Object.values(STYLE_PROFILES).filter(p => p.id !== "custom");
  return profiles.reduce((best, p) => {
    return styleDistance(balance, p) < styleDistance(balance, best) ? p : best;
  }, profiles[0]);
};

// ─── Deviation analysis ───────────────────────────────────────────────────────

const severityOf = (delta: number): StyleDeviation["severity"] => {
  const abs = Math.abs(delta);
  if (abs < 10) return "ok";
  if (abs < 20) return "minor";
  if (abs < 35) return "moderate";
  return "major";
};

const computeDeviations = (balance: KitBalance, target: StyleProfile): StyleDeviation[] => {
  const keys: Array<keyof Omit<KitBalance, "totalHits" | "bpm">> = [
    "kickDominance", "snarePresence", "cymbalDensity", "tomUsage",
    "ghostNoteRatio", "accentRatio", "dynamicRange",
  ];
  return keys.map(metric => {
    const actual = balance[metric];
    const tgt    = target[metric as keyof StyleProfile] as number;
    const delta  = actual - tgt;
    return { metric, actual, target: tgt, delta, severity: severityOf(delta) };
  });
};

// ─── Suggestion generation ────────────────────────────────────────────────────

const buildSuggestions = (devs: StyleDeviation[], target: StyleProfile): string[] => {
  const s: string[] = [];
  for (const d of devs) {
    if (d.severity === "ok") continue;
    const label = METRIC_LABELS[d.metric];
    const dir   = d.delta > 0 ? "trop élevé" : "trop faible";
    const adj   = d.delta > 0 ? "Réduire" : "Augmenter";
    s.push(`${label} ${dir} (${d.actual}% vs ${d.target}% pour ${target.name}) — ${adj} la présence`);
  }
  if (s.length === 0) s.push(`Équilibre excellent pour le style ${target.name}.`);
  if (devs.some(d => d.metric === "ghostNoteRatio" && d.delta < -15))
    s.push("Ajouter des ghost notes renforcerait le groove.");
  if (devs.some(d => d.metric === "dynamicRange" && d.delta < -20))
    s.push("Varier les vélocités pour plus d'expressivité.");
  return s;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const analyzeKitBalance = (
  project:     ParsedDrumProject,
  targetStyle: DrumStyle = "rock"
): KitBalanceResult => {
  const balance      = extractKitBalance(project);
  const closestStyle = findClosestStyle(balance);
  const targetProf   = STYLE_PROFILES[targetStyle];
  const deviations   = computeDeviations(balance, targetProf);
  const suggestions  = buildSuggestions(deviations, targetProf);
  const matchScore   = Math.round((1 - styleDistance(balance, closestStyle)) * 100);

  const chartData: ChartMetric[] = deviations.map(d => ({
    key:    d.metric,
    label:  METRIC_LABELS[d.metric],
    actual: d.actual,
    target: d.target,
    delta:  d.delta,
    color:  METRIC_COLORS[d.metric],
  }));

  return { balance, closestStyle, targetStyle: targetProf, matchScore, deviations, suggestions, chartData };
};
