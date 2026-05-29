/**
 * Impossible Transition Detector
 *
 * Detects physically impossible or very hard TRANSITIONS between instruments
 * for a given limb, using the body simulation's spatial movement model.
 *
 * Complements impossiblePatternDetector.ts (which focuses on per-limb speed
 * and simultaneous overload). This module adds movement-distance awareness:
 * a crash→floor-tom jump in 40 ms is flagged here even if the per-limb
 * speed detector misses it (the speed per se may not be the issue — the
 * physical distance is).
 */

import type { DrumHit } from "../core/types";
import type { Limb } from "./ergonomicRules";
import type { LimbMap } from "./limbAnalyzer";
import { buildMovementMap } from "../simulation/movementPlanner";
import type { PlayabilityIssue } from "./impossiblePatternDetector";

// ─── Thresholds ────────────────────────────────────────────────────────────────

// Time window: if a transition takes less than this, it's hard/impossible
const TRANSITION_HARD_MS     = 70;
const TRANSITION_IMPOS_MS    = 35;

// Minimum kit-space distance that triggers a transition check (nearby = no issue)
const MIN_DISTANCE_TO_CHECK  = 3.0;
// Impossible distance threshold (far jumps are extra penalised)
const DISTANCE_IMPOSSIBLE    = 7.0;

// ─── Detector ─────────────────────────────────────────────────────────────────

export const detectImpossibleTransitions = (
  hits:    DrumHit[],
  limbMap: LimbMap,
  ppq:     number,
  bpm:     number
): PlayabilityIssue[] => {
  if (hits.length < 2) return [];

  const msPerTick = 60_000 / (bpm * ppq);
  const movMap    = buildMovementMap(hits, limbMap);
  const issues: PlayabilityIssue[] = [];

  const sorted = [...hits].sort((a, b) => a.tick - b.tick);
  const prevHit = new Map<Limb, DrumHit>();

  for (const hit of sorted) {
    const a = limbMap[hit.id];
    if (!a) continue;

    const limb = a.limb;
    const mov  = movMap.get(hit.id);
    const prev = prevHit.get(limb);

    if (prev && mov && mov.distance >= MIN_DISTANCE_TO_CHECK) {
      const gapMs  = (hit.tick - prev.tick) * msPerTick;
      const isFar  = mov.distance >= DISTANCE_IMPOSSIBLE;

      if (gapMs < TRANSITION_IMPOS_MS && isFar) {
        issues.push({
          type:        "impossible-displacement",
          severity:    "error",
          score:       90,
          hitIds:      [prev.id, hit.id],
          tick:        hit.tick,
          description: `${limb} : ${prev.piece} → ${hit.piece} en ${gapMs.toFixed(0)} ms — déplacement de ${mov.distance.toFixed(1)} unités, physiquement impossible`,
          suggestion:  `Requiert ~${mov.travelMs.toFixed(0)} ms. Utiliser l'autre main ou redistribuer le sticking.`,
        });
      } else if (gapMs < TRANSITION_IMPOS_MS) {
        issues.push({
          type:        "impossible-displacement",
          severity:    "error",
          score:       72,
          hitIds:      [prev.id, hit.id],
          tick:        hit.tick,
          description: `${limb} : transition ${prev.piece} → ${hit.piece} très rapide (${gapMs.toFixed(0)} ms, dist. ${mov.distance.toFixed(1)})`,
          suggestion:  `Limite physiologique approchée. Vérifier le sticking.`,
        });
      } else if (gapMs < TRANSITION_HARD_MS && isFar) {
        issues.push({
          type:        "impossible-displacement",
          severity:    "warning",
          score:       50,
          hitIds:      [prev.id, hit.id],
          tick:        hit.tick,
          description: `${limb} : grand déplacement ${prev.piece} → ${hit.piece} (${gapMs.toFixed(0)} ms, dist. ${mov.distance.toFixed(1)}) — difficile`,
          suggestion:  `Techniquement jouable pour un batteur expérimenté. Envisager une redistribution.`,
        });
      } else if (gapMs < TRANSITION_HARD_MS) {
        issues.push({
          type:        "impossible-displacement",
          severity:    "warning",
          score:       35,
          hitIds:      [prev.id, hit.id],
          tick:        hit.tick,
          description: `${limb} : transition rapide ${prev.piece} → ${hit.piece} (${gapMs.toFixed(0)} ms)`,
          suggestion:  `Exigeant — ce mouvement peut nuire au groove. Vérifier avec un batteur.`,
        });
      }
    }

    prevHit.set(limb, hit);
  }

  return issues.sort((a, b) => a.tick - b.tick);
};
