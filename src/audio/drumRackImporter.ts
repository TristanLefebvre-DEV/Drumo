/**
 * Drum Rack Importer
 *
 * Reconstructs a complete drum kit mapping from a Drum Rack description
 * (Ableton-style or any DAW) — a list of {midiNote, filename} pairs.
 *
 * What it does:
 *   1. Identifies each slot's drum instrument via sampleNameAnalyzer.
 *   2. Builds a custom MIDI → DrumPiece map, merging with GM defaults.
 *   3. Groups velocity layers (multiple notes for the same instrument).
 *   4. Detects choke groups (open ↔ closed hi-hat pairs).
 *   5. Infers the musical style from the kit's instrument palette.
 *   6. Produces notation hints so the notation engine can render correctly.
 *   7. Emits warnings for ambiguous or conflicting assignments.
 */

import { DRUM_MAP, type DrumMapEntry } from "../core/drumMapper";
import type { DrumPiece } from "../core/types";
import {
  analyzeSampleName,
  type KitStyleHint,
  type SampleAnalysis,
  type SampleArticulation,
} from "./sampleNameAnalyzer";

// ─── Public types ─────────────────────────────────────────────────────────────

/** One pad in a Drum Rack (or one file in a sample folder). */
export interface DrumRackSlot {
  /** MIDI note the pad is assigned to. */
  midiNote: number;
  /** Sample filename, e.g. "Kick_808.wav". */
  filename: string;
  /** Optional folder path that provides extra context. */
  folderPath?: string;
}

/** Analyzed slot with full identification. */
export interface AnalyzedSlot {
  slot:        DrumRackSlot;
  analysis:    SampleAnalysis;
  /** The VexFlow-ready mapping entry for this slot. */
  mapEntry:    DrumMapEntry & { articulation: SampleArticulation };
}

/** Two or more notes that form a velocity layer stack for the same instrument. */
export interface VelocityLayerGroup {
  piece:  DrumPiece;
  slots:  AnalyzedSlot[];
  /** Suggested "canonical" MIDI note for notation (usually the loudest layer). */
  primaryNote: number;
}

/** Open/closed hi-hat pair that should choke each other. */
export interface ChokeGroup {
  openNote:   number;
  closedNote: number;
  label:      string;
}

/** Notation hint for the rendering engine. */
export interface NotationHint {
  type:    "open-hh" | "ghost-snare" | "accent" | "bell" | "choke" | "style";
  message: string;
}

/** Full result of the drum rack analysis. */
export interface ImportedDrumRack {
  /** Every slot with its identified instrument. */
  slots:           AnalyzedSlot[];
  /** Custom MIDI → DrumMapEntry map, overriding GM defaults. */
  customMidiMap:   Record<number, DrumMapEntry & { articulation: SampleArticulation }>;
  /** Velocity layer groups: pieces with multiple dynamic layers. */
  velocityLayers:  VelocityLayerGroup[];
  /** Hi-hat choke pairs. */
  chokeGroups:     ChokeGroup[];
  /** Dominant musical style inferred from the kit. */
  detectedStyle:   KitStyleHint | "unknown";
  /** Suggestions for the notation engine. */
  notationHints:   NotationHint[];
  /** Non-fatal issues discovered during analysis. */
  warnings:        string[];
}

// ─── VexFlow key & notehead tables ───────────────────────────────────────────

const PIECE_VEX: Record<DrumPiece, { vexKey: string; notehead: "normal" | "x"; stem: 1 | -1 }> = {
  kick:         { vexKey: "f/4", notehead: "normal", stem: -1 },
  kick2:        { vexKey: "e/4", notehead: "normal", stem: -1 },
  snare:        { vexKey: "c/5", notehead: "normal", stem: -1 },
  snareRim:     { vexKey: "c/5", notehead: "x",      stem: -1 },
  hihatClosed:  { vexKey: "g/5", notehead: "x",      stem:  1 },
  hihatOpen:    { vexKey: "g/5", notehead: "x",      stem:  1 },
  hihatPedal:   { vexKey: "d/4", notehead: "x",      stem:  1 },
  tomHigh:      { vexKey: "e/5", notehead: "normal", stem: -1 },
  tomMid:       { vexKey: "b/4", notehead: "normal", stem: -1 },
  tomLow:       { vexKey: "a/4", notehead: "normal", stem: -1 },
  crash:        { vexKey: "a/5", notehead: "x",      stem:  1 },
  ride:         { vexKey: "a/5", notehead: "x",      stem:  1 },
  splash:       { vexKey: "b/5", notehead: "x",      stem:  1 },
  otherCymbal:  { vexKey: "b/5", notehead: "x",      stem:  1 },
};

const CYMBAL_PIECES = new Set<DrumPiece>([
  "crash", "ride", "splash", "otherCymbal",
  "hihatOpen", "hihatClosed", "hihatPedal",
]);

const buildMapEntry = (
  piece: DrumPiece,
  articulation: SampleArticulation
): DrumMapEntry & { articulation: SampleArticulation } => {
  const vex = PIECE_VEX[piece];
  return {
    piece,
    vexKey:    vex.vexKey,
    isCymbal:  CYMBAL_PIECES.has(piece),
    notehead:  vex.notehead,
    stem:      vex.stem,
    articulation,
  };
};

// ─── Style inference ──────────────────────────────────────────────────────────

/**
 * Infer the musical style from the collection of identified pieces and
 * their style hints.
 */
const inferStyle = (slots: AnalyzedSlot[]): KitStyleHint | "unknown" => {
  // Tally style hints
  const votes: Partial<Record<KitStyleHint | "unknown", number>> = {};
  for (const s of slots) {
    const hint = s.analysis.styleHint;
    if (hint) {
      votes[hint] = (votes[hint] ?? 0) + 1;
    }
  }

  // Kit composition signals
  const pieces = new Set(slots.map(s => s.analysis.piece));
  const hasBrush  = slots.some(s => s.analysis.articulation === "brush");
  const hasRide   = pieces.has("ride");
  const hasToms   = pieces.has("tomHigh") || pieces.has("tomMid") || pieces.has("tomLow");
  const hasChina  = pieces.has("otherCymbal");
  const ghostSnares = slots.filter(s => s.analysis.piece === "snare" && s.analysis.articulation === "ghost").length;

  // Boost from composition
  if (hasBrush || (hasRide && !hasToms)) { votes.jazz = (votes.jazz ?? 0) + 2; }
  if (hasChina)                          { votes.metal = (votes.metal ?? 0) + 1; }
  if (ghostSnares >= 2)                  { votes.funk = (votes.funk ?? 0) + 1; }

  const sorted = Object.entries(votes).sort((a, b) => (b[1] as number) - (a[1] as number));
  const winner = sorted[0];
  if (!winner || (winner[1] as number) === 0) return "unknown";
  return winner[0] as KitStyleHint;
};

// ─── Velocity layer detection ─────────────────────────────────────────────────

const buildVelocityLayers = (slots: AnalyzedSlot[]): VelocityLayerGroup[] => {
  // Group by piece
  const byPiece = new Map<DrumPiece, AnalyzedSlot[]>();
  for (const s of slots) {
    const arr = byPiece.get(s.analysis.piece) ?? [];
    arr.push(s);
    byPiece.set(s.analysis.piece, arr);
  }

  const groups: VelocityLayerGroup[] = [];
  for (const [piece, pieceSlots] of byPiece.entries()) {
    // Only flag as velocity layers when 2+ samples share the same piece
    if (pieceSlots.length < 2) continue;
    // Sort by velocity layer index (or MIDI note as proxy)
    const sorted = [...pieceSlots].sort(
      (a, b) => (a.analysis.velocityLayer ?? a.slot.midiNote)
               - (b.analysis.velocityLayer ?? b.slot.midiNote)
    );
    groups.push({
      piece,
      slots: sorted,
      primaryNote: sorted[sorted.length - 1].slot.midiNote, // loudest = highest note
    });
  }
  return groups;
};

// ─── Choke group detection ────────────────────────────────────────────────────

const buildChokeGroups = (slots: AnalyzedSlot[]): ChokeGroup[] => {
  const openSlots   = slots.filter(s => s.analysis.piece === "hihatOpen");
  const closedSlots = slots.filter(s => s.analysis.piece === "hihatClosed");

  const groups: ChokeGroup[] = [];

  // Pair each open HH with the nearest closed HH note
  for (const open of openSlots) {
    const best = closedSlots.reduce<AnalyzedSlot | null>((acc, c) => {
      if (!acc) return c;
      const distAcc  = Math.abs(acc.slot.midiNote  - open.slot.midiNote);
      const distC    = Math.abs(c.slot.midiNote     - open.slot.midiNote);
      return distC < distAcc ? c : acc;
    }, null);

    if (best) {
      groups.push({
        openNote:   open.slot.midiNote,
        closedNote: best.slot.midiNote,
        label:      `HH choke: note ${best.slot.midiNote} (fermé) ↔ ${open.slot.midiNote} (ouvert)`,
      });
    }
  }
  return groups;
};

// ─── Notation hints ───────────────────────────────────────────────────────────

const buildNotationHints = (
  slots: AnalyzedSlot[],
  chokeGroups: ChokeGroup[],
  style: KitStyleHint | "unknown"
): NotationHint[] => {
  const hints: NotationHint[] = [];

  const openHH    = slots.filter(s => s.analysis.piece === "hihatOpen");
  const ghostSn   = slots.filter(s => s.analysis.piece === "snare" && s.analysis.articulation === "ghost");
  const accents   = slots.filter(s => s.analysis.articulation === "accent");
  const bellSlots = slots.filter(s => s.analysis.articulation === "bell");

  if (openHH.length > 0) {
    hints.push({
      type: "open-hh",
      message: `${openHH.length} hi-hat(s) ouvert(s) détecté(s) — notation 'o' au-dessus des noteheads`,
    });
  }
  if (chokeGroups.length > 0) {
    hints.push({
      type: "choke",
      message: `${chokeGroups.length} paire(s) choke HH détectée(s) — fermeture marque la fin d'ouverture`,
    });
  }
  if (ghostSn.length > 0) {
    hints.push({
      type: "ghost-snare",
      message: `${ghostSn.length} caisse claire ghost — parenthèses ou notehead foncé recommandé`,
    });
  }
  if (accents.length > 0) {
    hints.push({
      type: "accent",
      message: `${accents.length} note(s) avec accent fort — marqueur '>' ou '^' à appliquer`,
    });
  }
  if (bellSlots.length > 0) {
    hints.push({
      type: "bell",
      message: `Ride bell détectée — notehead en diamant ou croix avec annotation 'bell'`,
    });
  }
  if (style !== "unknown") {
    hints.push({
      type: "style",
      message: `Style détecté: ${style} — appliquer le profil de groove correspondant`,
    });
  }

  return hints;
};

// ─── Main import function ─────────────────────────────────────────────────────

/**
 * Analyze a Drum Rack (list of MIDI-note → sample pairs) and return a
 * complete, ready-to-use ImportedDrumRack.
 *
 * @param slots  Array of {midiNote, filename, folderPath?} describing the rack.
 */
export const importDrumRack = (slots: DrumRackSlot[]): ImportedDrumRack => {
  const warnings: string[] = [];

  // ── 1. Analyze each slot ────────────────────────────────────────────────────
  const analyzedSlots: AnalyzedSlot[] = slots.map(slot => {
    const analysis = analyzeSampleName(slot.filename, slot.folderPath ?? "");
    return {
      slot,
      analysis,
      mapEntry: buildMapEntry(analysis.piece, analysis.articulation),
    };
  });

  // ── 2. Warn on very low confidence slots ───────────────────────────────────
  for (const as of analyzedSlots) {
    if (as.analysis.confidence < 0.35) {
      warnings.push(
        `Note ${as.slot.midiNote} (${as.slot.filename}): identification incertaine ` +
        `(${as.analysis.piece}, confiance ${(as.analysis.confidence * 100).toFixed(0)} %) — vérifier`
      );
    }
  }

  // ── 3. Detect conflicting assignments (two slots mapped to same piece) ─────
  const pieceToNotes = new Map<DrumPiece, number[]>();
  for (const as of analyzedSlots) {
    const arr = pieceToNotes.get(as.analysis.piece) ?? [];
    arr.push(as.slot.midiNote);
    pieceToNotes.set(as.analysis.piece, arr);
  }
  for (const [piece, notes] of pieceToNotes.entries()) {
    if (notes.length > 1 && !isVelocityLayeredPiece(piece)) {
      warnings.push(
        `Instrument "${piece}" assigné à ${notes.length} notes (${notes.join(", ")}) — ` +
        `probablement des couches vélocité`
      );
    }
  }

  // ── 4. Build custom MIDI map (GM defaults + overrides) ────────────────────
  const customMidiMap: Record<number, DrumMapEntry & { articulation: SampleArticulation }> = {};

  // Start from GM defaults
  for (const [noteStr, entry] of Object.entries(DRUM_MAP)) {
    const note = parseInt(noteStr, 10);
    customMidiMap[note] = { ...entry, articulation: "normal" };
  }

  // Override with analyzed slots (higher priority than GM)
  for (const as of analyzedSlots) {
    customMidiMap[as.slot.midiNote] = as.mapEntry;
  }

  // ── 5. Velocity layers ─────────────────────────────────────────────────────
  const velocityLayers = buildVelocityLayers(analyzedSlots);

  // ── 6. Choke groups ────────────────────────────────────────────────────────
  const chokeGroups = buildChokeGroups(analyzedSlots);

  // ── 7. Style inference ─────────────────────────────────────────────────────
  const detectedStyle = inferStyle(analyzedSlots);

  // ── 8. Notation hints ──────────────────────────────────────────────────────
  const notationHints = buildNotationHints(analyzedSlots, chokeGroups, detectedStyle);

  return {
    slots:          analyzedSlots,
    customMidiMap,
    velocityLayers,
    chokeGroups,
    detectedStyle,
    notationHints,
    warnings,
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pieces where multiple samples on different notes = velocity layers, not conflicts. */
const LAYERED_PIECES = new Set<DrumPiece>(["kick", "snare", "hihatClosed", "hihatOpen", "crash"]);
const isVelocityLayeredPiece = (p: DrumPiece) => LAYERED_PIECES.has(p);
