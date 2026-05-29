/**
 * Cymbal Grouping Engine
 *
 * Groups cymbal hits by musical function and provides notational metadata:
 *   - Primary time-keeping voice (hi-hat or ride)
 *   - Accent layer (crashes, open hi-hats)
 *   - Transition markers (section changes)
 *
 * Also generates notational suggestions:
 *   - Stem direction for each cymbal group
 *   - Whether to notate open hi-hats with "o" above
 *   - Crash chord grouping with kick
 */

import { detectCymbalRoles, type CymbalRoleMap } from "./cymbalRoleDetector";
import type { ParsedDrumProject } from "../core/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CymbalGroupType = "groove" | "accent" | "transition" | "expression";

export interface CymbalGroup {
  type:         CymbalGroupType;
  hitIds:       string[];
  stemDir:      "up" | "down";
  addOpenMark:  boolean;  // add "o" marker above open hi-hats
  suggestion?:  string;   // notational improvement suggestion
}

export interface CymbalGroupingResult {
  roleMap:     CymbalRoleMap;
  groups:      CymbalGroup[];
  suggestions: string[];
  primaryVoice: "hihat" | "ride";
}

// ─── Grouping logic ───────────────────────────────────────────────────────────

export const groupCymbals = (project: ParsedDrumProject): CymbalGroupingResult => {
  const roleMap = detectCymbalRoles(project);
  const assignments = Object.values(roleMap);

  // Determine primary groove voice
  const grooveHH   = assignments.filter(a => a.role === "hihat-groove").length;
  const grooveRide = assignments.filter(a => a.role === "ride-groove").length;
  const primaryVoice: "hihat" | "ride" = grooveRide > grooveHH ? "ride" : "hihat";

  // Build groups
  const grooveIds     = assignments.filter(a => a.role === "hihat-groove" || a.role === "ride-groove").map(a => a.hitId);
  const accentIds     = assignments.filter(a => a.role === "crash-accent" || a.role === "bell").map(a => a.hitId);
  const transIds      = assignments.filter(a => a.role === "cymbal-trans").map(a => a.hitId);
  const expressionIds = assignments.filter(a => a.role === "hihat-open" || a.role === "hihat-close").map(a => a.hitId);

  const groups: CymbalGroup[] = [];

  if (grooveIds.length > 0) {
    groups.push({
      type: "groove", hitIds: grooveIds,
      stemDir: "up",
      addOpenMark: false,
      suggestion: grooveIds.length < 4
        ? "Pattern de groove cymbal très sparse — envisager d'ajouter le ride ou hi-hat"
        : undefined,
    });
  }

  if (accentIds.length > 0) {
    groups.push({
      type: "accent", hitIds: accentIds,
      stemDir: "up",
      addOpenMark: false,
    });
  }

  if (transIds.length > 0) {
    groups.push({
      type: "transition", hitIds: transIds,
      stemDir: "up",
      addOpenMark: false,
      suggestion: transIds.length > 4 ? "Nombreuses transitions de cymbal — vérifier la lisibilité" : undefined,
    });
  }

  if (expressionIds.length > 0) {
    groups.push({
      type: "expression", hitIds: expressionIds,
      stemDir: "up",
      addOpenMark: true,
      suggestion: "Hi-hat ouvert — notation 'o' recommandée",
    });
  }

  // Global notational suggestions
  const suggestions: string[] = [];

  const openHHCount = assignments.filter(a => a.role === "hihat-open").length;
  if (openHHCount > 0 && openHHCount < 3) {
    suggestions.push(`${openHHCount} ouverture(s) de hi-hat détectée(s) — notation 'o' appliquée`);
  }

  const crashCount = assignments.filter(a => a.role === "crash-accent").length;
  if (crashCount === 0 && project.hits.length > 32) {
    suggestions.push("Aucun crash d'accent détecté — groove très régulier");
  }

  if (primaryVoice === "ride") {
    suggestions.push("Ride utilisé comme voix groove principale");
  }

  const rideCount = project.hits.filter(h => h.piece === "ride").length;
  const hihatClosedCount = project.hits.filter(h => h.piece === "hihatClosed").length;
  if (rideCount > 0 && hihatClosedCount > 0) {
    suggestions.push("Mix ride + hi-hat détecté — changement de couleur de section possible");
  }

  return { roleMap, groups, suggestions, primaryVoice };
};

/** Colour hex per group type (for UI display). */
export const GROUP_COLOR: Record<CymbalGroupType, string> = {
  groove:     "#3b82f6",  // blue
  accent:     "#ef4444",  // red
  transition: "#8b5cf6",  // violet
  expression: "#22c55e",  // green
};
