/**
 * Cymbal Role Detector
 *
 * Assigns a musical role to each cymbal hit based on:
 *   - Instrument type (hi-hat, ride, crash, splash)
 *   - Position in the bar (beat 1, offbeats, etc.)
 *   - Surrounding context (after fills, opening/closing patterns)
 *   - Density relative to the measure average
 *
 * Roles:
 *   hihat-groove   – primary time-keeping hi-hat pattern
 *   ride-groove    – ride cymbal as primary time-keeping voice
 *   crash-accent   – accent crash (beat 1, fill endings, builds)
 *   hihat-open     – expressive hi-hat opening gesture
 *   hihat-close    – hi-hat closing (choke-like)
 *   cymbal-trans   – cymbal change marking section transition
 *   bell           – ride bell accent
 *   generic        – unclassified
 */

import type { DrumHit, ParsedDrumProject } from "../core/types";
import { detectFills } from "../analysis/fillDetector";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CymbalRole =
  | "hihat-groove"
  | "ride-groove"
  | "crash-accent"
  | "hihat-open"
  | "hihat-close"
  | "cymbal-trans"
  | "bell"
  | "generic";

export interface CymbalRoleAssignment {
  hitId:      string;
  role:       CymbalRole;
  confidence: number;  // 0–1
  note?:      string;  // short pedagogical annotation
}

export type CymbalRoleMap = Record<string, CymbalRoleAssignment>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isCymbal = (h: DrumHit) =>
  h.piece === "hihatClosed" || h.piece === "hihatOpen" || h.piece === "hihatPedal" ||
  h.piece === "ride" || h.piece === "crash" || h.piece === "splash" || h.piece === "otherCymbal";

/** Step index within the bar (0–15, 16th note resolution). */
const stepOf = (hit: DrumHit, ppq: number, barTicks: number): number =>
  Math.min(15, Math.round((hit.tick % barTicks) / (ppq / 4)) % 16);

// ─── Role classification ───────────────────────────────────────────────────────

export const detectCymbalRoles = (project: ParsedDrumProject): CymbalRoleMap => {
  const { hits, ppq, timeSignature } = project;
  const barTicks      = ppq * timeSignature.numerator;
  const cymbalHits    = hits.filter(isCymbal).sort((a, b) => a.tick - b.tick);
  const result: CymbalRoleMap = {};

  if (cymbalHits.length === 0) return result;

  // Build fill measure set for context
  const fillMeasures = new Set<number>();
  try {
    const measureStats = detectFills(project);
    for (const s of measureStats) {
      if (s.type === "fill" || s.type === "transition") fillMeasures.add(s.index);
    }
  } catch { /* ok — no fill context */ }

  // Count ride vs hihat dominance to determine "primary groove cymbal"
  const rideCount  = cymbalHits.filter(h => h.piece === "ride").length;
  const hihatCount = cymbalHits.filter(h => h.piece === "hihatClosed" || h.piece === "hihatOpen").length;
  const primaryGroove: "ride" | "hihat" = rideCount > hihatCount ? "ride" : "hihat";

  // Track last hi-hat state to detect open/close patterns
  let lastHihatOpen = false;

  for (let i = 0; i < cymbalHits.length; i++) {
    const h   = cymbalHits[i];
    const step = stepOf(h, ppq, barTicks);
    const measureIndex = Math.floor(h.tick / barTicks);
    const inFill = fillMeasures.has(measureIndex);

    const prevH = cymbalHits[i - 1];

    let role: CymbalRole = "generic";
    let confidence = 0.7;
    let note: string | undefined;

    // ── Crash / Splash / OtherCymbal ─────────────────────────────────────────
    if (h.piece === "crash" || h.piece === "splash" || h.piece === "otherCymbal") {
      if (step === 0 && !inFill) {
        role = "crash-accent"; confidence = 0.92;
        note = "Crash sur le temps 1";
      } else if (inFill || (prevH && prevH.piece === "tomHigh") || (prevH && prevH.piece === "tomLow")) {
        role = "crash-accent"; confidence = 0.85;
        note = "Crash fin de fill";
      } else if (step % 4 === 0) {
        role = "crash-accent"; confidence = 0.78;
      } else {
        role = "cymbal-trans"; confidence = 0.65;
        note = "Transition de cymbal";
      }
    }

    // ── Ride ──────────────────────────────────────────────────────────────────
    else if (h.piece === "ride") {
      if (primaryGroove === "ride") {
        role = "ride-groove"; confidence = 0.88;
        if (step % 4 === 0) note = "Ride — temps fort";
      } else {
        // Ride used as accent when hi-hat is dominant
        role = h.isAccent ? "crash-accent" : "cymbal-trans";
        confidence = 0.72;
      }
    }

    // ── Hi-hat ────────────────────────────────────────────────────────────────
    else if (h.piece === "hihatClosed") {
      if (primaryGroove === "hihat") {
        role = "hihat-groove"; confidence = 0.90;
        if (step === 0 && !lastHihatOpen) note = "HH — groove principal";
      } else {
        // Close after open
        if (lastHihatOpen) {
          role = "hihat-close"; confidence = 0.82;
          note = "Fermeture HH";
        } else {
          role = "hihat-groove"; confidence = 0.75;
        }
      }
      lastHihatOpen = false;
    }

    else if (h.piece === "hihatOpen") {
      role = "hihat-open"; confidence = 0.88;
      note = "HH ouvert — expression";
      lastHihatOpen = true;
    }

    else if (h.piece === "hihatPedal") {
      // Pedal hi-hat on 2 and 4 = classic jazz/funk foot pattern
      if (step === 4 || step === 12) {
        role = "hihat-groove"; confidence = 0.85;
        note = "HH pédale — 2 et 4";
      } else {
        role = "hihat-groove"; confidence = 0.70;
      }
    }

    result[h.id] = { hitId: h.id, role, confidence, note };
  }

  return result;
};

/** Human-readable label for a cymbal role. */
export const CYMBAL_ROLE_LABEL: Record<CymbalRole, string> = {
  "hihat-groove":  "HH Groove",
  "ride-groove":   "Ride Groove",
  "crash-accent":  "Crash Accent",
  "hihat-open":    "HH Ouvert",
  "hihat-close":   "HH Fermé",
  "cymbal-trans":  "Transition",
  "bell":          "Cloche Ride",
  "generic":       "Cymbal",
};
