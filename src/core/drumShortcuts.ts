/**
 * Drum MIDI Editor — centralized keyboard shortcut definitions.
 *
 * Only shortcuts relevant to the drum grid editor are defined here.
 * Other application shortcuts (file, view, playback) are owned by AppShell/AppMenuBar.
 */

// ─── Action identifiers ───────────────────────────────────────────────────────

export type DrumAction =
  // Selection
  | "deleteSelected"
  | "selectAll"
  | "selectAllSamePiece"
  | "deselectAll"
  // Clipboard
  | "copy"
  | "paste"
  | "duplicate"
  // History
  | "undo"
  | "redo"
  // Move (one grid step)
  | "moveLeft"
  | "moveRight"
  // Row navigation (move selected notes to adjacent drum row)
  | "movePieceUp"
  | "movePieceDown"
  // Velocity
  | "velocityUp"
  | "velocityDown"
  // Quantize
  | "quantizeSelected"
  // Note properties
  | "toggleMute"
  | "toggleFlam"
  | "toggleRoll"
  // Zoom
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  // Grid navigation (scroll the editor)
  | "scrollLeft"
  | "scrollRight"
  | "scrollToStart"
  | "scrollToEnd"
  // Transport (mirrors global shortcuts but active in grid context)
  | "playPause"
  | "returnToStart";

// ─── Human-readable metadata for each action ─────────────────────────────────

export interface ActionMeta {
  label: string;
  description: string;
  group: "selection" | "clipboard" | "move" | "velocity" | "quantize" | "zoom" | "navigation" | "transport";
}

export const ACTION_META: Record<DrumAction, ActionMeta> = {
  deleteSelected:    { label: "Delete selected",          description: "Remove all selected notes",                      group: "selection"   },
  selectAll:         { label: "Select all",               description: "Select every note in the grid",                  group: "selection"   },
  selectAllSamePiece:{ label: "Select same drum",         description: "Select all notes of the currently active piece", group: "selection"   },
  deselectAll:       { label: "Deselect all",             description: "Clear the current selection",                    group: "selection"   },
  copy:              { label: "Copy",                     description: "Copy selected notes to clipboard",               group: "clipboard"   },
  paste:             { label: "Paste",                    description: "Paste clipboard at playhead position",           group: "clipboard"   },
  duplicate:         { label: "Duplicate",                description: "Duplicate selection immediately to the right",   group: "clipboard"   },
  undo:              { label: "Undo",                     description: "Undo the last edit",                             group: "clipboard"   },
  redo:              { label: "Redo",                     description: "Redo the last undone edit",                      group: "clipboard"   },
  moveLeft:          { label: "Move left",                description: "Shift selected notes one step earlier",          group: "move"        },
  moveRight:         { label: "Move right",               description: "Shift selected notes one step later",            group: "move"        },
  movePieceUp:       { label: "Move to row above",        description: "Reassign selected notes to the row above",       group: "move"        },
  movePieceDown:     { label: "Move to row below",        description: "Reassign selected notes to the row below",       group: "move"        },
  velocityUp:        { label: "Velocity +10",             description: "Increase velocity of selected notes by 10",      group: "velocity"    },
  velocityDown:      { label: "Velocity −10",             description: "Decrease velocity of selected notes by 10",      group: "velocity"    },
  quantizeSelected:  { label: "Quantize",                 description: "Snap selected notes to the active grid",         group: "quantize"    },
  toggleMute:        { label: "Mute / Unmute",            description: "Silence selected notes without deleting them",   group: "selection"   },
  toggleFlam:        { label: "Toggle Flam",              description: "Add / remove flam articulation on selected notes", group: "selection" },
  toggleRoll:        { label: "Toggle Roll",              description: "Add / remove roll articulation on selected notes", group: "selection" },
  zoomIn:            { label: "Zoom in",                  description: "Zoom in horizontally",                           group: "zoom"        },
  zoomOut:           { label: "Zoom out",                 description: "Zoom out horizontally",                          group: "zoom"        },
  zoomReset:         { label: "Reset zoom",               description: "Reset zoom to 100%",                             group: "zoom"        },
  scrollLeft:        { label: "Scroll left",              description: "Scroll the grid one measure to the left",        group: "navigation"  },
  scrollRight:       { label: "Scroll right",             description: "Scroll the grid one measure to the right",       group: "navigation"  },
  scrollToStart:     { label: "Go to start",              description: "Jump the view to the beginning of the pattern",  group: "navigation"  },
  scrollToEnd:       { label: "Go to end",                description: "Jump the view to the last note",                 group: "navigation"  },
  playPause:         { label: "Play / Pause",             description: "Toggle playback",                                group: "transport"   },
  returnToStart:     { label: "Return to start",          description: "Stop and return playhead to bar 1",              group: "transport"   },
};

export const GROUP_LABELS: Record<ActionMeta["group"], string> = {
  selection:  "Selection",
  clipboard:  "Clipboard",
  move:       "Move & Rearrange",
  velocity:   "Velocity",
  quantize:   "Quantize",
  zoom:       "Zoom",
  navigation: "Grid Navigation",
  transport:  "Transport",
};

// ─── Shortcut descriptor ──────────────────────────────────────────────────────

export interface ShortcutDef {
  key: string;        // e.g. "Delete", "ArrowLeft", "d", "q"
  ctrl?: boolean;     // Ctrl / Cmd
  shift?: boolean;
  alt?: boolean;
}

/** Canonical string key for a shortcut, used for conflict detection. */
export const shortcutKey = (s: ShortcutDef): string =>
  [s.ctrl ? "ctrl" : "", s.shift ? "shift" : "", s.alt ? "alt" : "", s.key.toLowerCase()]
    .filter(Boolean)
    .join("+");

/** Human-readable label for display in the UI. */
export const shortcutLabel = (s: ShortcutDef): string => {
  const parts: string[] = [];
  if (s.ctrl)  parts.push("Ctrl");
  if (s.shift) parts.push("Shift");
  if (s.alt)   parts.push("Alt");
  parts.push(KEY_DISPLAY_NAMES[s.key] ?? s.key);
  return parts.join("+");
};

const KEY_DISPLAY_NAMES: Record<string, string> = {
  Delete:      "Del",
  Backspace:   "⌫",
  ArrowLeft:   "←",
  ArrowRight:  "→",
  ArrowUp:     "↑",
  ArrowDown:   "↓",
  Home:        "Home",
  End:         "End",
  Escape:      "Esc",
  " ":         "Space",
  "=":         "+",
};

// ─── Default shortcuts — DAW-inspired, drum-editor focused ───────────────────

export const DEFAULT_SHORTCUTS: Record<DrumAction, ShortcutDef> = {
  // Selection
  deleteSelected:     { key: "Delete"      },
  selectAll:          { key: "a",    ctrl: true                  },
  selectAllSamePiece: { key: "a",    ctrl: true, shift: true     },
  deselectAll:        { key: "Escape"      },
  // Clipboard
  copy:               { key: "c",    ctrl: true                  },
  paste:              { key: "v",    ctrl: true                  },
  duplicate:          { key: "d",    ctrl: true                  },
  // History
  undo:               { key: "z",    ctrl: true                  },
  redo:               { key: "y",    ctrl: true                  },
  // Move
  moveLeft:           { key: "ArrowLeft"   },
  moveRight:          { key: "ArrowRight"  },
  movePieceUp:        { key: "ArrowUp"     },
  movePieceDown:      { key: "ArrowDown"   },
  // Velocity
  velocityUp:         { key: "ArrowUp",   shift: true            },
  velocityDown:       { key: "ArrowDown", shift: true            },
  // Quantize
  quantizeSelected:   { key: "q"           },
  // Note properties
  toggleMute:         { key: "m"           },
  toggleFlam:         { key: "f"           },
  toggleRoll:         { key: "r"           },
  // Zoom
  zoomIn:             { key: "=",    ctrl: true                  },
  zoomOut:            { key: "-",    ctrl: true                  },
  zoomReset:          { key: "0",    ctrl: true                  },
  // Navigation
  scrollLeft:         { key: "ArrowLeft",  ctrl: true            },
  scrollRight:        { key: "ArrowRight", ctrl: true            },
  scrollToStart:      { key: "Home"        },
  scrollToEnd:        { key: "End"         },
  // Transport
  playPause:          { key: " "           },
  returnToStart:      { key: "Home",  ctrl: true                 },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Build a reverse lookup from canonical shortcut key → action. */
export const buildLookup = (
  shortcuts: Record<DrumAction, ShortcutDef>,
): Map<string, DrumAction> => {
  const map = new Map<string, DrumAction>();
  for (const [action, def] of Object.entries(shortcuts) as [DrumAction, ShortcutDef][]) {
    map.set(shortcutKey(def), action);
  }
  return map;
};

/** Check an existing mapping for conflicts with a new shortcut. Returns the conflicting action or null. */
export const findConflict = (
  shortcuts: Record<DrumAction, ShortcutDef>,
  targetAction: DrumAction,
  candidate: ShortcutDef,
): DrumAction | null => {
  const k = shortcutKey(candidate);
  for (const [action, def] of Object.entries(shortcuts) as [DrumAction, ShortcutDef][]) {
    if (action === targetAction) continue;
    if (shortcutKey(def) === k) return action as DrumAction;
  }
  return null;
};

/** Convert a native KeyboardEvent to a ShortcutDef for matching. */
export const eventToShortcut = (e: KeyboardEvent): ShortcutDef => ({
  key:   e.key,
  ctrl:  e.ctrlKey || e.metaKey || undefined,
  shift: e.shiftKey || undefined,
  alt:   e.altKey || undefined,
});
