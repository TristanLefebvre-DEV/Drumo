/**
 * Groove Isolation
 *
 * Provides pre-built mute-state configurations for "learn one part at a time"
 * practice.  Each mode silences everything except the target instrument group,
 * with the effective mute state fed directly into TransportOptions.muteState.
 *
 * ghost-notes-only is special: it looks at the actual hit list to decide
 * which pieces contain ghost notes, then mutes pieces with none.
 *
 * Usage in the store:
 *   updateTransport({ muteState: getIsolationMuteState(mode, project.hits) })
 */

import type { DrumHit, DrumPiece } from "../core/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type IsolationMode =
  | "kick-only"
  | "snare-only"
  | "cymbals-only"
  | "toms-only"
  | "ghost-notes-only"
  | null;

export const ISOLATION_LABELS: Record<NonNullable<IsolationMode>, string> = {
  "kick-only":        "Kick seul",
  "snare-only":       "Snare seul",
  "cymbals-only":     "Cymbales",
  "toms-only":        "Toms",
  "ghost-notes-only": "Notes fantômes",
};

export const ISOLATION_ICONS: Record<NonNullable<IsolationMode>, string> = {
  "kick-only":        "KCK",
  "snare-only":       "SNR",
  "cymbals-only":     "CYM",
  "toms-only":        "TOM",
  "ghost-notes-only": "GHT",
};

// ─── All drum pieces (for muting what's not selected) ────────────────────────

const ALL_PIECES: DrumPiece[] = [
  "kick", "snare", "snareRim",
  "hihatClosed", "hihatOpen", "hihatPedal",
  "tomHigh", "tomMid", "tomLow",
  "crash", "ride", "splash", "otherCymbal",
];

const PIECES_IN_GROUP: Record<NonNullable<IsolationMode>, DrumPiece[]> = {
  "kick-only":        ["kick", "hihatPedal"],
  "snare-only":       ["snare", "snareRim"],
  "cymbals-only":     ["hihatClosed", "hihatOpen", "hihatPedal", "crash", "ride", "splash", "otherCymbal"],
  "toms-only":        ["tomHigh", "tomMid", "tomLow"],
  "ghost-notes-only": [], // handled dynamically
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a muteState object to pass to TransportOptions.
 * Pieces NOT in the isolation group are muted.
 */
export const getIsolationMuteState = (
  mode: IsolationMode,
  hits: DrumHit[] = []
): Partial<Record<DrumPiece, boolean>> => {
  if (!mode) return {};  // No isolation → nothing muted

  if (mode === "ghost-notes-only") {
    // Find which pieces have at least one ghost note
    const ghostPieces = new Set(hits.filter((h) => h.isGhost).map((h) => h.piece));
    return Object.fromEntries(
      ALL_PIECES.filter((p) => !ghostPieces.has(p)).map((p) => [p, true])
    ) as Partial<Record<DrumPiece, boolean>>;
  }

  const keep = new Set<DrumPiece>(PIECES_IN_GROUP[mode]);
  return Object.fromEntries(
    ALL_PIECES.filter((p) => !keep.has(p)).map((p) => [p, true])
  ) as Partial<Record<DrumPiece, boolean>>;
};

/**
 * Human-readable description of what the isolation mode hears.
 * Used for the pedagogical tooltip.
 */
export const ISOLATION_DESCRIPTION: Record<NonNullable<IsolationMode>, string> = {
  "kick-only":        "Écoute uniquement le kick et la pédale hi-hat. Idéal pour apprendre le groove de pied.",
  "snare-only":       "Écoute uniquement la caisse claire. Utile pour analyser le backbeat et les dynamics.",
  "cymbals-only":     "Écoute toutes les cymbales. Parfait pour apprendre le pattern de hi-hat ou le ride.",
  "toms-only":        "Écoute uniquement les toms. Idéal pour apprendre les fills.",
  "ghost-notes-only": "Écoute uniquement les ghost notes (frappes légères). Révèle le groove subtil.",
};
