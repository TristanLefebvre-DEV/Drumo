/**
 * Sticking Engine
 *
 * Core algorithm that assigns a Limb to every drum hit.
 *
 * Pipeline:
 *   1. Sort hits by tick.
 *   2. Group simultaneous hits (within 5 ticks) into "chord events".
 *   3. For each event:
 *      a. Assign feet deterministically.
 *      b. Assign hands using the natural-limb table.
 *      c. Resolve simultaneous conflicts (two natural-RH instruments at once).
 *      d. Apply alternation for fast sequential hits on the same instrument.
 *      e. Detect crossovers and physically impossible patterns.
 *   4. Return a Record<hitId, LimbAssignment>.
 *
 * Modes:
 *   strict   – strict alternation, no repeated strokes allowed
 *   human    – permits repeated strokes at moderate speed
 *   advanced – more flexibility for advanced techniques (heel-toe, etc.)
 */

import type { DrumHit } from "../core/types";
import {
  NATURAL_LIMB,
  ALTERNATE_LIMB,
  CAN_ALTERNATE,
  IS_FOOT,
  ALTERNATION_THRESHOLD_MS,
  isCrossover,
  physicalDistance,
  type Limb,
  type StickingMode,
} from "./ergonomicRules";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LimbAssignment {
  noteId:      string;
  limb:        Limb;
  confidence:  number;    // 0–1
  isCrossover: boolean;
  reason?:     string;    // Pedagogical explanation
}

/** Per-limb "last used" state maintained across events. */
interface LimbState {
  RH: { piece: string; tick: number };
  LH: { piece: string; tick: number };
  RF: { piece: string; tick: number };
  LF: { piece: string; tick: number };
}

const freshState = (): LimbState => ({
  RH: { piece: "", tick: -Infinity },
  LH: { piece: "", tick: -Infinity },
  RF: { piece: "", tick: -Infinity },
  LF: { piece: "", tick: -Infinity },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Group consecutive hits that occur within 5 ticks into one chord event. */
const groupIntoEvents = (sorted: DrumHit[]): DrumHit[][] => {
  const events: DrumHit[][] = [];
  let group: DrumHit[] = [];
  for (const hit of sorted) {
    if (group.length === 0 || hit.tick - group[0].tick <= 5) {
      group.push(hit);
    } else {
      events.push(group);
      group = [hit];
    }
  }
  if (group.length > 0) events.push(group);
  return events;
};

/**
 * For a chord event, determine which hand plays what.
 *
 * Rules:
 *   - Each limb can only appear once per event.
 *   - Natural limb is preferred.
 *   - When two hand-hits share a natural limb, the "further" instrument
 *     from its side gets the alternate limb (e.g. crash+ride both want RH →
 *     crash gets LH since it's on the left).
 *   - Impossibility: same limb on two instruments — mark low confidence.
 */
const resolveChordHands = (
  handHits: DrumHit[],
  usedLimbs: Set<Limb>
): Map<string, { limb: Limb; confidence: number; reason: string }> => {
  const assignments = new Map<string, { limb: Limb; confidence: number; reason: string }>();

  // Sort by instrument "fixedness" (non-alternatable first)
  const sorted = [...handHits].sort((a, b) =>
    Number(CAN_ALTERNATE[a.piece]) - Number(CAN_ALTERNATE[b.piece])
  );

  for (const hit of sorted) {
    const natural = NATURAL_LIMB[hit.piece] as "RH" | "LH";
    const alt     = ALTERNATE_LIMB[hit.piece] as "RH" | "LH" | undefined;

    if (!usedLimbs.has(natural)) {
      assignments.set(hit.id, { limb: natural, confidence: 0.92, reason: "Position naturelle" });
      usedLimbs.add(natural);
    } else if (alt && !usedLimbs.has(alt)) {
      assignments.set(hit.id, { limb: alt, confidence: 0.75, reason: "Alternate limb (accord simultané)" });
      usedLimbs.add(alt);
    } else {
      // Conflict — best-effort
      const fallback = usedLimbs.has("RH") ? "LH" : "RH";
      assignments.set(hit.id, { limb: fallback, confidence: 0.45, reason: "Conflit — accord complexe" });
    }
  }
  return assignments;
};

// ─── Main solver ──────────────────────────────────────────────────────────────

export const solveSticking = (
  hits:  DrumHit[],
  ppq:   number,
  bpm:   number,
  mode:  StickingMode = "human"
): Record<string, LimbAssignment> => {
  const result: Record<string, LimbAssignment> = {};
  if (hits.length === 0) return result;

  const sorted    = [...hits].sort((a, b) => a.tick - b.tick);
  const events    = groupIntoEvents(sorted);
  const state     = freshState();
  const msPerTick = 60_000 / (bpm * ppq);
  const altThreshTicks = ALTERNATION_THRESHOLD_MS[mode] / msPerTick;

  for (const event of events) {
    const eventTick = event[0].tick;
    const usedLimbs = new Set<Limb>();

    // ── Pass 1: feet (always deterministic) ──────────────────────────────────
    const footHits = event.filter((h) => IS_FOOT[h.piece]);
    const handHits = event.filter((h) => !IS_FOOT[h.piece]);

    for (const hit of footHits) {
      const limb = NATURAL_LIMB[hit.piece];
      result[hit.id] = {
        noteId: hit.id, limb, confidence: 0.99,
        isCrossover: false, reason: "Pied (déterministique)",
      };
      usedLimbs.add(limb);
      state[limb] = { piece: hit.piece, tick: eventTick };
    }

    // ── Pass 2: chord hand resolution ────────────────────────────────────────
    const chordMap = resolveChordHands(handHits, usedLimbs);

    // ── Pass 3: alternation override for fast sequential hits ────────────────
    for (const hit of handHits) {
      let { limb, confidence, reason } = chordMap.get(hit.id) ??
        { limb: NATURAL_LIMB[hit.piece] as Limb, confidence: 0.8, reason: "Défaut" };

      // Only reconsider hands (not feet)
      if (limb !== "RF" && limb !== "LF" && CAN_ALTERNATE[hit.piece]) {
        const altLimb  = limb === "RH" ? "LH" : "RH";
        const lastSame = state[limb];
        const lastAlt  = state[altLimb];

        const tickSinceSame = eventTick - lastSame.tick;
        const tickSinceAlt  = eventTick - lastAlt.tick;

        // Condition: same limb was used recently AND alt was used even more recently
        // → continue alternation by keeping current limb (the pattern is already established)
        const shouldAlternate =
          lastSame.piece === hit.piece &&
          tickSinceSame < altThreshTicks &&
          !usedLimbs.has(altLimb);

        if (shouldAlternate) {
          limb      = altLimb;
          confidence = 0.88;
          reason    = "Alternance automatique";
          usedLimbs.delete(NATURAL_LIMB[hit.piece] as Limb);
          usedLimbs.add(limb);
        }

        // Detect arm travel impossibility (same limb, far-apart instruments, very fast)
        const lastAnyHand = tickSinceSame < tickSinceAlt ? lastSame : lastAlt;
        if (
          lastAnyHand.piece &&
          lastAnyHand.piece !== hit.piece &&
          physicalDistance(lastAnyHand.piece as Parameters<typeof physicalDistance>[0], hit.piece) >= 3 &&
          Math.min(tickSinceSame, tickSinceAlt) < altThreshTicks * 0.5
        ) {
          confidence = Math.min(confidence, 0.55);
          reason += " (déplacement rapide)";
        }
      }

      const cross = isCrossover(limb, hit.piece);
      result[hit.id] = {
        noteId: hit.id, limb, confidence,
        isCrossover: cross,
        reason: cross ? `${reason} — croisement` : reason,
      };
      state[limb] = { piece: hit.piece, tick: eventTick };
    }
  }

  return result;
};
