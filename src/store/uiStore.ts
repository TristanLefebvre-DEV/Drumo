/**
 * UI Store — panneaux flottants avec géométrie, z-index et persistance.
 * Partagé entre AppMenuBar (écriture) et ComposePage (lecture).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PanelId = "humanize" | "mixer" | "metronome" | "balance" | "ai";
export type FloatingPanel = PanelId; // backward compat

export interface PanelState {
  isOpen:    boolean;
  minimized: boolean;
  x:         number;
  y:         number;
  width:     number;
  height:    number;
  zIndex:    number;
}

const BASE_Z     = 200;
const PANEL_IDS: PanelId[] = ["humanize", "mixer", "metronome", "balance", "ai"];

// Positions et tailles par défaut — décalées pour ne pas empiler
const DEFAULT_GEOMETRIES: Record<PanelId, { x: number; y: number; width: number; height: number }> = {
  metronome: { x: 60,  y: 80,  width: 310, height: 560 },
  humanize:  { x: 400, y: 80,  width: 300, height: 520 },
  mixer:     { x: 740, y: 80,  width: 440, height: 430 },
  balance:   { x: 60,  y: 100, width: 330, height: 500 },
  ai:        { x: 400, y: 100, width: 300, height: 480 },
};

function buildInitialPanels(): Record<PanelId, PanelState> {
  return Object.fromEntries(
    PANEL_IDS.map((id, i) => [
      id,
      { ...DEFAULT_GEOMETRIES[id], zIndex: BASE_Z + i, isOpen: false, minimized: false },
    ])
  ) as Record<PanelId, PanelState>;
}

const INITIAL_PANELS = buildInitialPanels();

function derivedFlags(panels: Record<PanelId, PanelState>) {
  return {
    showHumanize:   panels.humanize.isOpen,
    showMixer:      panels.mixer.isOpen,
    showMetronome:  panels.metronome.isOpen,
    showKitBalance: panels.balance.isOpen,
    showAiPanel:    panels.ai.isOpen,
  };
}

interface UiStore {
  panels: Record<PanelId, PanelState>;
  topZ:   number;

  // Backward-compat booleans — miroirs de panels[id].isOpen
  showHumanize:   boolean;
  showMixer:      boolean;
  showMetronome:  boolean;
  showKitBalance: boolean;
  showAiPanel:    boolean;

  openPanel:        (id: PanelId) => void;
  closePanel:       (id: PanelId) => void;
  togglePanel:      (id: PanelId) => void;
  bringToFront:     (id: PanelId) => void;
  setPanelGeometry: (id: PanelId, x: number, y: number, w: number, h: number) => void;
  toggleMinimize:   (id: PanelId) => void;
  resetLayout:      () => void;
}

function nextZ(topZ: number): number {
  // Plafonne à 490 pour rester sous les overlays plein écran (2000+)
  return topZ >= 490 ? BASE_Z + 1 : topZ + 1;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      panels: { ...INITIAL_PANELS },
      topZ:   BASE_Z + PANEL_IDS.length,
      ...derivedFlags(INITIAL_PANELS),

      openPanel: (id) => {
        const { panels, topZ } = get();
        const newZ      = nextZ(topZ);
        const newPanels = { ...panels, [id]: { ...panels[id], isOpen: true, minimized: false, zIndex: newZ } };
        set({ panels: newPanels, topZ: newZ, ...derivedFlags(newPanels) });
      },

      closePanel: (id) => {
        const { panels } = get();
        const newPanels = { ...panels, [id]: { ...panels[id], isOpen: false } };
        set({ panels: newPanels, ...derivedFlags(newPanels) });
      },

      togglePanel: (id) => {
        const { panels } = get();
        if (panels[id].isOpen) get().closePanel(id);
        else get().openPanel(id);
      },

      bringToFront: (id) => {
        const { panels, topZ } = get();
        const maxZ = Math.max(...PANEL_IDS.map((pid) => panels[pid].zIndex));
        if (panels[id].zIndex === maxZ) return;
        const newZ = nextZ(topZ);
        set({
          panels: { ...panels, [id]: { ...panels[id], zIndex: newZ } },
          topZ:   newZ,
        });
      },

      setPanelGeometry: (id, x, y, w, h) => {
        const { panels } = get();
        set({ panels: { ...panels, [id]: { ...panels[id], x, y, width: w, height: h } } });
      },

      toggleMinimize: (id) => {
        const { panels } = get();
        set({ panels: { ...panels, [id]: { ...panels[id], minimized: !panels[id].minimized } } });
      },

      resetLayout: () => {
        const { panels } = get();
        const reset = Object.fromEntries(
          PANEL_IDS.map((id, i) => [
            id,
            { ...DEFAULT_GEOMETRIES[id], zIndex: BASE_Z + i, isOpen: panels[id].isOpen, minimized: false },
          ])
        ) as Record<PanelId, PanelState>;
        set({ panels: reset, topZ: BASE_Z + PANEL_IDS.length, ...derivedFlags(reset) });
      },
    }),
    {
      name: "drumo-ui-v2",
      // Persiste uniquement la géométrie — les panneaux sont toujours fermés au démarrage
      partialize: (s) => ({
        panels: Object.fromEntries(
          PANEL_IDS.map((id) => [
            id,
            { x: s.panels[id].x, y: s.panels[id].y, width: s.panels[id].width, height: s.panels[id].height },
          ])
        ),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Fusionne la géométrie sauvegardée avec l'état initial (panneaux fermés)
        const saved = (state as unknown as { panels: Record<string, Partial<PanelState>> }).panels;
        if (saved) {
          PANEL_IDS.forEach((id, i) => {
            state.panels[id] = {
              ...INITIAL_PANELS[id],
              ...(saved[id] ? { x: saved[id].x ?? INITIAL_PANELS[id].x, y: saved[id].y ?? INITIAL_PANELS[id].y, width: saved[id].width ?? INITIAL_PANELS[id].width, height: saved[id].height ?? INITIAL_PANELS[id].height } : {}),
              zIndex:    BASE_Z + i,
              isOpen:    false,
              minimized: false,
            };
          });
        }
        state.topZ = BASE_Z + PANEL_IDS.length;
        Object.assign(state, derivedFlags(state.panels));
      },
    }
  )
);
