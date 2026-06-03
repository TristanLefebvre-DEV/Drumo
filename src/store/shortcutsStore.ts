import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_SHORTCUTS,
  type DrumAction,
  type ShortcutDef,
  buildLookup,
  findConflict,
} from "../core/drumShortcuts";

// ─── Store interface ──────────────────────────────────────────────────────────

interface ShortcutsStore {
  shortcuts: Record<DrumAction, ShortcutDef>;

  /** Set the shortcut for a single action. Ignores conflicting bindings. */
  setShortcut: (action: DrumAction, def: ShortcutDef) => DrumAction | null;

  /** Reset a single action to its default. */
  resetShortcut: (action: DrumAction) => void;

  /** Reset the entire map to defaults. */
  resetAll: () => void;

  /** Derived reverse lookup — rebuilt whenever shortcuts change. */
  lookup: Map<string, DrumAction>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useShortcutsStore = create<ShortcutsStore>()(
  persist(
    (set, get) => ({
      shortcuts: { ...DEFAULT_SHORTCUTS },
      lookup:    buildLookup(DEFAULT_SHORTCUTS),

      setShortcut: (action, def) => {
        const current   = get().shortcuts;
        const conflict  = findConflict(current, action, def);
        const updated   = { ...current, [action]: def };
        set({ shortcuts: updated, lookup: buildLookup(updated) });
        return conflict;
      },

      resetShortcut: (action) => {
        const updated = { ...get().shortcuts, [action]: DEFAULT_SHORTCUTS[action] };
        set({ shortcuts: updated, lookup: buildLookup(updated) });
      },

      resetAll: () =>
        set({ shortcuts: { ...DEFAULT_SHORTCUTS }, lookup: buildLookup(DEFAULT_SHORTCUTS) }),
    }),
    {
      name: "drumo-shortcuts-v1",
      // Zustand persist cannot serialize Map, so we exclude lookup from storage
      // and rebuild it on rehydration.
      partialize: (s) => ({ shortcuts: s.shortcuts }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.lookup = buildLookup(state.shortcuts);
        }
      },
    }
  )
);
