/**
 * Impossible Pattern Detector
 *
 * Detects patterns that are physically impossible or extremely difficult
 * for a single human drummer to execute.
 *
 * Detection categories:
 *   impossible-speed        – a single limb hits faster than its physiological limit
 *   too-many-simultaneous   – more than 4 distinct limbs needed at one tick
 *   impossible-displacement – same limb must jump across the kit unrealistically fast
 *   inhuman-tempo           – BPM so fast that standard patterns become impossible
 *
 * Output: PlayabilityIssue[]  (sorted by tick)
 */

import type { DrumHit } from "../core/types";
import type { LimbMap } from "./limbAnalyzer";
import type { Limb } from "./ergonomicRules";
import { IS_FOOT, physicalDistance } from "./ergonomicRules";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type IssueType =
  | "impossible-speed"
  | "too-many-simultaneous"
  | "impossible-displacement"
  | "inhuman-tempo";

export type IssueSeverity = "warning" | "error";

export interface PlayabilityIssue {
  type:        IssueType;
  severity:    IssueSeverity;
  /** 0–100: contribution to total impossibility score. */
  score:       number;
  hitIds:      string[];
  tick:        number;
  description: string;
  suggestion:  string;
}

// ─── Physiological limits ─────────────────────────────────────────────────────

// Absolute minimum inter-onset interval (ms) per limb type
const IOI_HAND_IMPOSSIBLE  = 25;   // ~40 Hz — absolute physiological limit per hand
const IOI_HAND_ERROR       = 45;   // < 45 ms = nearly impossible for most drummers
const IOI_HAND_WARNING     = 80;   // < 80 ms = elite-level difficulty
const IOI_FOOT_IMPOSSIBLE  = 40;   // double-bass physical minimum
const IOI_FOOT_ERROR       = 65;   // < 65 ms = very demanding double-bass
const IOI_FOOT_WARNING     = 100;  // < 100 ms = hard double-bass
const DISPLACEMENT_HARD_MS = 100;  // same limb, 3+ kit positions apart, < 100 ms
const DISPLACEMENT_IMPOS_MS = 50;  // same limb, 3+ positions apart, < 50 ms = impossible

// ─── Helpers ──────────────────────────────────────────────────────────────────

const groupByTick = (sorted: DrumHit[]): Map<number, DrumHit[]> => {
  const map = new Map<number, DrumHit[]>();
  for (const hit of sorted) {
    // Group events within 5 ticks as simultaneous
    const bucketKey = Math.round(hit.tick / 5) * 5;
    if (!map.has(bucketKey)) map.set(bucketKey, []);
    map.get(bucketKey)!.push(hit);
  }
  return map;
};

const uniqLimbsNeeded = (event: DrumHit[], limbMap: LimbMap): Set<Limb> => {
  const limbs = new Set<Limb>();
  for (const hit of event) {
    const a = limbMap[hit.id];
    if (a) limbs.add(a.limb);
  }
  return limbs;
};

// ─── Individual detectors ─────────────────────────────────────────────────────

/** Check per-limb speed violations across the full hit list. */
const detectSpeedViolations = (
  hits:     DrumHit[],
  limbMap:  LimbMap,
  msPerTick: number
): PlayabilityIssue[] => {
  // Group hits by limb
  const byLimb = new Map<Limb, DrumHit[]>();
  for (const hit of hits) {
    const a = limbMap[hit.id];
    if (!a) continue;
    if (!byLimb.has(a.limb)) byLimb.set(a.limb, []);
    byLimb.get(a.limb)!.push(hit);
  }

  const issues: PlayabilityIssue[] = [];

  for (const [limb, limbHits] of byLimb) {
    const sorted = limbHits.sort((a, b) => a.tick - b.tick);
    const isFoot = limb === "RF" || limb === "LF";

    for (let i = 1; i < sorted.length; i++) {
      const gapMs = (sorted[i].tick - sorted[i - 1].tick) * msPerTick;
      const impossThresh = isFoot ? IOI_FOOT_IMPOSSIBLE  : IOI_HAND_IMPOSSIBLE;
      const errorThresh  = isFoot ? IOI_FOOT_ERROR       : IOI_HAND_ERROR;
      const warnThresh   = isFoot ? IOI_FOOT_WARNING     : IOI_HAND_WARNING;

      if (gapMs < impossThresh) {
        issues.push({
          type: "impossible-speed", severity: "error", score: 95,
          hitIds: [sorted[i - 1].id, sorted[i].id],
          tick: sorted[i].tick,
          description: `${limb} : ${gapMs.toFixed(0)} ms entre deux frappes — limite physiologique dépassée`,
          suggestion:  `Minimum recommandé : ${impossThresh} ms. Vérifier le quantize ou le tempo.`,
        });
      } else if (gapMs < errorThresh) {
        issues.push({
          type: "impossible-speed", severity: "error", score: 75,
          hitIds: [sorted[i - 1].id, sorted[i].id],
          tick: sorted[i].tick,
          description: `${limb} : ${gapMs.toFixed(0)} ms — vitesse extrême (< ${errorThresh} ms)`,
          suggestion: `Pattern possible seulement pour batteurs élite. Envisager l'alternance.`,
        });
      } else if (gapMs < warnThresh) {
        issues.push({
          type: "impossible-speed", severity: "warning", score: 40,
          hitIds: [sorted[i - 1].id, sorted[i].id],
          tick: sorted[i].tick,
          description: `${limb} : ${gapMs.toFixed(0)} ms — vitesse élevée`,
          suggestion: `Techniquement jouable mais exigeant.`,
        });
      }
    }
  }
  return issues;
};

/** Check for tick events requiring more than 4 simultaneous limbs. */
const detectSimultaneousOverload = (
  sorted:   DrumHit[],
  limbMap:  LimbMap
): PlayabilityIssue[] => {
  const issues: PlayabilityIssue[] = [];
  const byTick = groupByTick(sorted);

  for (const [tick, event] of byTick) {
    const limbs = uniqLimbsNeeded(event, limbMap);
    if (limbs.size > 4) {
      issues.push({
        type: "too-many-simultaneous", severity: "error", score: 100,
        hitIds: event.map((h) => h.id),
        tick,
        description: `${limbs.size} membres requis simultanément — impossible (max 4)`,
        suggestion: "Réduire le nombre de frappes simultanées ou vérifier la transcription.",
      });
    } else if (limbs.size === 4 && event.length > 4) {
      issues.push({
        type: "too-many-simultaneous", severity: "warning", score: 50,
        hitIds: event.map((h) => h.id),
        tick,
        description: `4 membres actifs + ${event.length - 4} frappe(s) supplémentaire(s) au même instant`,
        suggestion: "Pattern très complexe — vérifier si c'est un doublon MIDI.",
      });
    }
  }
  return issues;
};

/** Detect impossible arm displacement (same limb jumping far across kit too fast). */
const detectDisplacement = (
  hits:     DrumHit[],
  limbMap:  LimbMap,
  msPerTick: number
): PlayabilityIssue[] => {
  const byLimb = new Map<Limb, DrumHit[]>();
  for (const hit of hits) {
    const a = limbMap[hit.id];
    if (!a || IS_FOOT[hit.piece]) continue;
    if (!byLimb.has(a.limb)) byLimb.set(a.limb, []);
    byLimb.get(a.limb)!.push(hit);
  }

  const issues: PlayabilityIssue[] = [];

  for (const [limb, limbHits] of byLimb) {
    const sorted = limbHits.sort((a, b) => a.tick - b.tick);
    for (let i = 1; i < sorted.length; i++) {
      const dist  = physicalDistance(sorted[i - 1].piece, sorted[i].piece);
      const gapMs = (sorted[i].tick - sorted[i - 1].tick) * msPerTick;
      if (dist >= 3) {
        if (gapMs < DISPLACEMENT_IMPOS_MS) {
          issues.push({
            type: "impossible-displacement", severity: "error", score: 85,
            hitIds: [sorted[i - 1].id, sorted[i].id],
            tick: sorted[i].tick,
            description: `${limb} : déplacement ${sorted[i-1].piece}→${sorted[i].piece} en ${gapMs.toFixed(0)} ms — physiquement impossible`,
            suggestion: "Utiliser l'autre main pour l'un de ces instruments.",
          });
        } else if (gapMs < DISPLACEMENT_HARD_MS) {
          issues.push({
            type: "impossible-displacement", severity: "warning", score: 45,
            hitIds: [sorted[i - 1].id, sorted[i].id],
            tick: sorted[i].tick,
            description: `${limb} : déplacement rapide (${gapMs.toFixed(0)} ms, dist. ${dist})`,
            suggestion: "Difficile — envisager une redistribution des membres.",
          });
        }
      }
    }
  }
  return issues;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const detectImpossiblePatterns = (
  hits:     DrumHit[],
  ppq:      number,
  bpm:      number,
  limbMap:  LimbMap
): PlayabilityIssue[] => {
  if (hits.length === 0) return [];
  const sorted    = [...hits].sort((a, b) => a.tick - b.tick);
  const msPerTick = 60_000 / (bpm * ppq);

  return [
    ...detectSpeedViolations(sorted, limbMap, msPerTick),
    ...detectSimultaneousOverload(sorted, limbMap),
    ...detectDisplacement(sorted, limbMap, msPerTick),
  ].sort((a, b) => a.tick - b.tick);
};
