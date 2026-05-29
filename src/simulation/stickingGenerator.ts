/**
 * Sticking Generator
 *
 * Generates explicit R/L sticking suggestions for a hit sequence.
 * Complements stickingEngine.ts (which assigns limbs algorithmically);
 * this module focuses on musical style, ergonomic naturalness, and
 * producing a readable R-L-R-L pattern string.
 *
 * Uses spatial distances from KIT_POSITIONS to prefer the closer hand.
 */

import type { DrumHit, DrumPiece } from "../core/types";
import type { Limb } from "../analysis/ergonomicRules";
import type { DrumStyle } from "../analysis/styleProfiles";
import { KIT_POSITIONS, LIMB_REST, kitDistance } from "./drummerBodyEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type StickToken = "R" | "L" | "RF" | "LF";

export interface StickingSuggestion {
  hitId:          string;
  token:          StickToken;
  limb:           Limb;
  alternative:    Limb | null;
  ergonomicScore: number;      // 0–1, 1 = perfect natural position
  note:           string;
}

// ─── Style preferences ────────────────────────────────────────────────────────

interface StyleHandPrefs {
  openHanded:           boolean;  // LH on hi-hat instead of crossing over
  preferRHCrash:        boolean;  // prefer right hand for crash (ride-side crash)
  ghostNoteDensityHint: number;   // 0–1, informational
}

const STYLE_PREFS: Record<DrumStyle, StyleHandPrefs> = {
  jazz:        { openHanded: true,  preferRHCrash: false, ghostNoteDensityHint: 0.30 },
  funk:        { openHanded: false, preferRHCrash: false, ghostNoteDensityHint: 0.50 },
  rock:        { openHanded: false, preferRHCrash: false, ghostNoteDensityHint: 0.08 },
  metal:       { openHanded: false, preferRHCrash: true,  ghostNoteDensityHint: 0.03 },
  electronic:  { openHanded: false, preferRHCrash: false, ghostNoteDensityHint: 0.00 },
  custom:      { openHanded: false, preferRHCrash: false, ghostNoteDensityHint: 0.10 },
};

// Instruments where one limb is always correct (no choice)
const LOCKED_LIMB: Partial<Record<DrumPiece, Limb>> = {
  kick:       "RF",
  hihatPedal: "LF",
  ride:       "RH",
};

// ─── Main generator ───────────────────────────────────────────────────────────

export const generateSticking = (
  hits:  DrumHit[],
  style: DrumStyle = "rock"
): StickingSuggestion[] => {
  const prefs  = STYLE_PREFS[style];
  const result: StickingSuggestion[] = [];

  const sorted = [...hits].sort((a, b) => a.tick - b.tick);

  // State: last tick each hand was used + last piece per hand
  const lastTick:  { RH: number; LH: number } = { RH: -1, LH: -1 };
  const lastPiece: { RH: DrumPiece | null; LH: DrumPiece | null } = { RH: null, LH: null };

  for (const hit of sorted) {
    // Feet are deterministic
    const locked = LOCKED_LIMB[hit.piece];
    if (locked) {
      result.push({
        hitId:          hit.id,
        token:          locked === "RF" ? "RF" : locked === "LF" ? "LF" : locked === "RH" ? "R" : "L",
        limb:           locked,
        alternative:    null,
        ergonomicScore: 1.0,
        note:           "Déterministique",
      });
      continue;
    }

    // Compute spatial closeness from each hand's current position
    const rhPos   = lastPiece.RH ? KIT_POSITIONS[lastPiece.RH] : LIMB_REST.RH;
    const lhPos   = lastPiece.LH ? KIT_POSITIONS[lastPiece.LH] : LIMB_REST.LH;
    const target  = KIT_POSITIONS[hit.piece];

    const rhDist  = kitDistance(rhPos, target);
    const lhDist  = kitDistance(lhPos, target);

    // Style override: open-handed jazz → LH on hi-hat
    let preferred: "RH" | "LH";
    if (prefs.openHanded && (hit.piece === "hihatClosed" || hit.piece === "hihatOpen")) {
      preferred = "LH";
    } else {
      preferred = rhDist <= lhDist ? "RH" : "LH";
    }

    const alt: "RH" | "LH" = preferred === "RH" ? "LH" : "RH";

    // Alternation: if preferred was used more recently on the SAME piece, switch
    const preferUsedLast = lastTick[preferred] > lastTick[alt];
    const repeatingSelf  = lastPiece[preferred] === hit.piece;
    const shouldAlternate = preferUsedLast && repeatingSelf;

    const chosen: "RH" | "LH" = shouldAlternate ? alt : preferred;
    const altLimb: "RH" | "LH" = chosen === "RH" ? "LH" : "RH";

    const chosenDist = chosen === "RH" ? rhDist : lhDist;
    const ergScore   = Math.max(0, 1 - chosenDist / 10);

    const note = shouldAlternate ? "Alternance" : `Position naturelle (dist. ${chosenDist.toFixed(1)})`;

    result.push({
      hitId:          hit.id,
      token:          chosen === "RH" ? "R" : "L",
      limb:           chosen,
      alternative:    altLimb,
      ergonomicScore: ergScore,
      note,
    });

    lastTick[chosen]  = hit.tick;
    lastPiece[chosen] = hit.piece;
  }

  return result;
};

// ─── Pattern formatter ────────────────────────────────────────────────────────

/** Converts a sticking suggestion list into a compact pattern string, e.g. "R L R L RF R L". */
export const formatStickingPattern = (suggestions: StickingSuggestion[]): string =>
  suggestions.map((s) => s.token).join(" ");
