/**
 * Drum Optimization Engine
 *
 * Produces suggested pattern variants that:
 *   - Always preserve the original musical intent
 *   - Improve specific aspects (playability, readability, feel)
 *   - Never change the character of the groove
 *
 * Three variant strategies:
 *   1. "simplified"   — remove impossible / exhausting hits, keep groove intact
 *   2. "humanized"    — add micro-timing variation and velocity shaping
 *   3. "transcribed"  — clean up quantization artifacts for notation
 *
 * All operations are heuristic — no ML.
 */

import type { MidiDrumData, MidiDrumHit, OptimizedPattern, OptimizedHitDelta } from "./types";
import type { PhysicalAnalysis, GrooveAnalysis } from "./types";

// ─── Strategy 1: Simplified ───────────────────────────────────────────────────

/**
 * Remove hits that cause impossible physical conflicts, keeping all other hits.
 * If the same tick has other hits, the removed hit was a doublon or over-dense cluster.
 */
const buildSimplified = (
  data:     MidiDrumData,
  physical: PhysicalAnalysis
): OptimizedPattern => {
  const conflictHitIds = new Set(physical.conflicts
    .filter(c => c.severity === "error")
    .flatMap(c => c.hitIds)
  );

  // For each conflict hit, find the lower-velocity one to remove
  const toRemove = new Set<string>();
  for (const conflict of physical.conflicts.filter(c => c.severity === "error")) {
    const pairs = conflict.hitIds.map(id => data.hits.find(h => h.id === id)).filter(Boolean) as MidiDrumHit[];
    if (pairs.length >= 2) {
      // Remove the quieter one
      const sorted = [...pairs].sort((a, b) => a.velocity - b.velocity);
      toRemove.add(sorted[0].id);
    } else {
      pairs.forEach(h => toRemove.add(h.id));
    }
  }

  const deltas: OptimizedHitDelta[] = [];
  for (const id of conflictHitIds) {
    if (toRemove.has(id)) {
      deltas.push({ originalId: id, action: "remove", reason: "Conflit physique impossible" });
    }
  }

  const changes: string[] = [];
  if (deltas.filter(d => d.action === "remove").length > 0) {
    changes.push(`${deltas.filter(d => d.action === "remove").length} frappes impossibles supprimées`);
  }
  if (physical.ergonomicWarnings.length > 0) {
    changes.push("Avertissements ergonomiques préservés pour information");
  }

  return {
    name:            "Simplifié",
    description:     "Version jouable — conflits physiques résolus, groove préservé",
    changesApplied:  changes.length > 0 ? changes : ["Aucun conflit — pattern déjà jouable"],
    preservedIntent: "Structure rythmique principale (kick/snare/cymbal pattern) intacte",
    improvedAspects: ["Jouabilité", "Réduction de la fatigue"],
    hitDeltas:       deltas,
  };
};

// ─── Strategy 2: Humanized ────────────────────────────────────────────────────

/**
 * Shape velocities to create a more dynamic, human feel:
 *   - Hi-hat: slight alternating accent (RL sticking simulation)
 *   - Snare backbeat: slightly louder than average
 *   - Ghost notes: keep very soft (0.2–0.35)
 *   - Kick: consistent strong hits
 */
const buildHumanized = (
  data:   MidiDrumData,
  groove: GrooveAnalysis
): OptimizedPattern => {
  const { hits, ppq } = data;
  const barTicks = ppq * 4;
  const deltas:  OptimizedHitDelta[] = [];
  let hhCounter = 0;

  for (const hit of hits) {
    let newVelocity: number | undefined;

    if (hit.piece === "hihatClosed" || hit.piece === "hihatOpen") {
      // Alternate accent every other hi-hat
      const isAccented = (hhCounter % 2 === 0);
      const target = isAccented ? 0.75 : 0.55;
      if (Math.abs(hit.velocity - target) > 0.08) {
        newVelocity = target;
      }
      hhCounter++;
    } else if (hit.piece === "snare") {
      const step = Math.round((hit.tick % barTicks) / (ppq / 4)) % 16;
      const isBackbeat = step === 4 || step === 8 || step === 12;
      if (isBackbeat && hit.velocity < 0.75) {
        newVelocity = 0.82;
      }
    } else if (hit.isGhost && hit.velocity > 0.35) {
      newVelocity = 0.28;
    } else if (hit.piece === "kick" && hit.velocity < 0.65) {
      newVelocity = 0.72;
    }

    if (newVelocity !== undefined) {
      deltas.push({
        originalId:  hit.id,
        action:      "velocity-adjust",
        newVelocity,
        reason:      `Dynamique naturalisée (${hit.piece})`,
      });
    }
  }

  const swingDesc = groove.swingRatio > 0.56 ? " avec swing naturel" : "";

  return {
    name:            "Humanisé",
    description:     `Version avec dynamique naturelle${swingDesc}`,
    changesApplied:  [
      `${deltas.length} ajustements de vélocité`,
      "Hi-hat avec alternance RH/LH simulée",
      "Backbeat renforcé",
    ],
    preservedIntent: "Timing et structure rythmique identiques — seules les vélocités changent",
    improvedAspects: ["Feeling humain", "Dynamique", "Lisibilité"],
    hitDeltas:       deltas,
  };
};

// ─── Strategy 3: Transcribed ──────────────────────────────────────────────────

/**
 * Clean up micro-timing noise for clean notation:
 *   - Snap hits that are within 10% of a grid position to that grid
 *   - Merge hits closer than 10ms to avoid double-notation
 *   - Preserve intentional groove offsets (swing, ghost notes off-grid)
 */
const buildTranscribed = (
  data:   MidiDrumData,
  groove: GrooveAnalysis
): OptimizedPattern => {
  const { hits, ppq } = data;
  const dominant = groove.subdivisionMap.dominant;
  const gridMults: Record<string, number> = {
    "1/4": 1, "1/8": 0.5, "8T": 1/3, "1/16": 0.25, "16T": 1/6, "1/32": 0.125
  };
  const step      = ppq * (gridMults[dominant] ?? 0.25);
  const snapTol   = step * 0.12;  // within 12% of step = snap
  const mergeGap  = ppq * 0.04;   // < 20 ticks = same position
  const deltas:    OptimizedHitDelta[] = [];

  // Snap near-grid hits (excluding intentional ghost/swing offsets)
  for (const hit of hits) {
    if (hit.isGhost) continue; // ghost notes can be intentionally off-grid
    const snapped   = Math.round(hit.tick / step) * step;
    const err       = Math.abs(hit.tick - snapped);
    if (err > 0 && err < snapTol) {
      deltas.push({
        originalId: hit.id,
        action:     "move",
        newTick:    snapped,
        reason:     `Aligné sur la grille ${dominant} (décalage ${err.toFixed(0)} ticks)`,
      });
    }
  }

  // Find very close hits that would notate as doubles
  const sorted = [...hits].sort((a, b) => a.tick - b.tick);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].tick - sorted[i - 1].tick;
    if (gap > 0 && gap < mergeGap && sorted[i].piece === sorted[i - 1].piece) {
      // Remove the quieter duplicate
      const toRemoveId = sorted[i].velocity < sorted[i - 1].velocity
        ? sorted[i].id : sorted[i - 1].id;
      if (!deltas.find(d => d.originalId === toRemoveId)) {
        deltas.push({
          originalId: toRemoveId,
          action:     "remove",
          reason:     `Doublon MIDI à ${gap} ticks — artefact de quantization`,
        });
      }
    }
  }

  return {
    name:            "Transcrit",
    description:     `Version nettoyée pour partition — grille ${dominant}`,
    changesApplied:  [
      `${deltas.filter(d => d.action === "move").length} frappes alignées sur la grille`,
      `${deltas.filter(d => d.action === "remove").length} doublons supprimés`,
    ],
    preservedIntent: "Notes intentionnelles (ghost notes, swing) conservées hors grille",
    improvedAspects: ["Lisibilité de la partition", "Propreté de la transcription"],
    hitDeltas:       deltas,
  };
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const optimizePattern = (
  data:     MidiDrumData,
  groove:   GrooveAnalysis,
  physical: PhysicalAnalysis
): OptimizedPattern[] => [
  buildSimplified(data, physical),
  buildHumanized(data, groove),
  buildTranscribed(data, groove),
];
