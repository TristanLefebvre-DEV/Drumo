/**
 * Advanced Metronome Store — multi-instrument layered metronome state.
 *
 * Up to MAX_METRONOMES (4) independent instrument metronomes,
 * each with its own pattern, subdivision, volume, humanize, and swing.
 * All are synchronized to the main MetronomeEngine clock.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InstrumentId =
  | "kick" | "snare" | "hihat" | "hihat-open" | "ride" | "crash"
  | "tom-high" | "tom-mid" | "tom-low" | "rimshot" | "clap" | "cowbell"
  | "percussion" | "custom";

export type StepAccent = "normal" | "accent" | "strong" | "ghost" | "mute";

export interface AdvMetroStep {
  active:   boolean;
  accent:   StepAccent;
  velocity: number; // 0–1
}

export interface AdvMetronome {
  id:          string;
  name:        string;
  instrument:  InstrumentId;
  enabled:     boolean;
  muted:       boolean;
  solo:        boolean;
  volume:      number;       // 0–1
  color:       string;
  subdivision: number;       // steps per beat: 1=quarter, 2=eighth, 4=sixteenth
  pattern:     AdvMetroStep[][]; // [beat][step]
  humanize: {
    enabled:         boolean;
    timingMs:        number; // max offset ±ms
    velocityAmount:  number; // 0–1 variance
  };
  swing:    number;  // 0–1
  expanded: boolean; // UI only
}

// ─── Instrument metadata ──────────────────────────────────────────────────────

export interface InstrumentMeta {
  name:         string;
  emoji:        string;
  color:        string;
  defaultSubdiv: number;
}

export const INSTRUMENT_META: Record<InstrumentId, InstrumentMeta> = {
  "kick":       { name: "Kick",          emoji: "🥁", color: "#3b82f6", defaultSubdiv: 1 },
  "snare":      { name: "Snare",         emoji: "🪘", color: "#ef4444", defaultSubdiv: 1 },
  "hihat":      { name: "Hi-Hat",        emoji: "🎩", color: "#22c55e", defaultSubdiv: 2 },
  "hihat-open": { name: "Hi-Hat Ouvert", emoji: "🔓", color: "#84cc16", defaultSubdiv: 1 },
  "ride":       { name: "Ride",          emoji: "⭕", color: "#f59e0b", defaultSubdiv: 2 },
  "crash":      { name: "Crash",         emoji: "💥", color: "#f97316", defaultSubdiv: 1 },
  "tom-high":   { name: "Tom Haut",      emoji: "🔴", color: "#8b5cf6", defaultSubdiv: 1 },
  "tom-mid":    { name: "Tom Mid",       emoji: "🟠", color: "#7c3aed", defaultSubdiv: 1 },
  "tom-low":    { name: "Tom Bas",       emoji: "🟣", color: "#6d28d9", defaultSubdiv: 1 },
  "rimshot":    { name: "Rimshot",       emoji: "🎯", color: "#ec4899", defaultSubdiv: 1 },
  "clap":       { name: "Clap",          emoji: "👏", color: "#14b8a6", defaultSubdiv: 1 },
  "cowbell":    { name: "Cowbell",       emoji: "🔔", color: "#eab308", defaultSubdiv: 1 },
  "percussion": { name: "Percussion",    emoji: "🪷", color: "#64748b", defaultSubdiv: 1 },
  "custom":     { name: "Custom",        emoji: "✨", color: "#6366f1", defaultSubdiv: 1 },
};

export const MAX_METRONOMES = 4;

// ─── Default pattern factory ──────────────────────────────────────────────────

export function buildDefaultPattern(
  instrument: InstrumentId,
  numBeats:   number,
  subdiv:     number,
): AdvMetroStep[][] {
  const empty = (): AdvMetroStep => ({ active: false, accent: "normal", velocity: 0.8 });
  const pat: AdvMetroStep[][] = Array.from({ length: numBeats }, () =>
    Array.from({ length: subdiv }, empty)
  );

  const set = (b: number, s: number, accent: StepAccent, vel = 0.8) => {
    if (b < numBeats && s < subdiv) pat[b][s] = { active: true, accent, velocity: vel };
  };

  switch (instrument) {
    case "kick":
      for (let b = 0; b < numBeats; b += 2) set(b, 0, b === 0 ? "strong" : "normal", 0.9);
      break;
    case "snare":
      for (let b = 1; b < numBeats; b += 2) set(b, 0, "accent", 0.85);
      break;
    case "hihat":
      for (let b = 0; b < numBeats; b++)
        for (let s = 0; s < subdiv; s++) set(b, s, s === 0 ? "normal" : "ghost", s === 0 ? 0.75 : 0.45);
      break;
    case "hihat-open":
      set(0, 0, "accent", 0.8);
      break;
    case "ride":
      for (let b = 0; b < numBeats; b++) set(b, 0, b === 0 ? "accent" : "normal", 0.7);
      if (subdiv >= 2) for (let b = 0; b < numBeats; b++) set(b, 1, "ghost", 0.4);
      break;
    case "crash":
      set(0, 0, "strong", 0.95);
      break;
    case "tom-high":
      set(0, 0, "normal"); set(1, 0, "normal");
      break;
    case "tom-mid":
      set(1, 0, "normal"); set(2, 0, "normal");
      break;
    case "tom-low":
      set(2, 0, "normal"); set(3, 0, "normal");
      break;
    case "rimshot":
    case "clap":
      for (let b = 1; b < numBeats; b += 2) set(b, 0, "accent", 0.8);
      break;
    case "cowbell":
      for (let b = 0; b < numBeats; b += 2) set(b, 0, b === 0 ? "accent" : "normal", 0.75);
      break;
    default:
      set(0, 0, "normal");
      break;
  }

  return pat;
}

// ─── Simple ID generator ──────────────────────────────────────────────────────

function genId(): string {
  return `adv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface AdvancedMetronomeStore {
  metronomes:      AdvMetronome[];
  canAdd:          boolean;

  addMetronome:    (instrument: InstrumentId, numBeats?: number) => void;
  removeMetronome: (id: string) => void;
  updateMetronome: (id: string, patch: Partial<Omit<AdvMetronome, "id">>) => void;
  toggleEnabled:   (id: string) => void;
  toggleMute:      (id: string) => void;
  toggleSolo:      (id: string) => void;
  toggleExpanded:  (id: string) => void;
  setStep:               (id: string, beat: number, step: number, value: Partial<AdvMetroStep>) => void;
  setSubdivisionForBeat: (id: string, beat: number, subdiv: number) => void;
  resetPattern:          (id: string, numBeats: number) => void;
  resetAll:              () => void;
}

export const useAdvancedMetronomeStore = create<AdvancedMetronomeStore>()(
  persist(
    (set, get) => ({
      metronomes: [],

      get canAdd() { return get().metronomes.length < MAX_METRONOMES; },

      addMetronome: (instrument, numBeats = 4) => {
        const { metronomes } = get();
        if (metronomes.length >= MAX_METRONOMES) return;

        const meta  = INSTRUMENT_META[instrument];
        const subdiv = meta.defaultSubdiv;

        const metro: AdvMetronome = {
          id:          genId(),
          name:        meta.name,
          instrument,
          enabled:     true,
          muted:       false,
          solo:        false,
          volume:      0.8,
          color:       meta.color,
          subdivision: subdiv,
          pattern:     buildDefaultPattern(instrument, numBeats, subdiv),
          humanize:    { enabled: false, timingMs: 12, velocityAmount: 0.12 },
          swing:       0,
          expanded:    true,
        };

        set({ metronomes: [...metronomes, metro] });
      },

      removeMetronome: (id) =>
        set((s) => ({ metronomes: s.metronomes.filter((m) => m.id !== id) })),

      updateMetronome: (id, patch) =>
        set((s) => ({
          metronomes: s.metronomes.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),

      toggleEnabled:  (id) => set((s) => ({ metronomes: s.metronomes.map((m) => m.id === id ? { ...m, enabled: !m.enabled } : m) })),
      toggleMute:     (id) => set((s) => ({ metronomes: s.metronomes.map((m) => m.id === id ? { ...m, muted:   !m.muted   } : m) })),
      toggleSolo:     (id) => set((s) => ({ metronomes: s.metronomes.map((m) => m.id === id ? { ...m, solo:    !m.solo    } : m) })),
      toggleExpanded: (id) => set((s) => ({ metronomes: s.metronomes.map((m) => m.id === id ? { ...m, expanded:!m.expanded} : m) })),

      setStep: (id, beat, step, value) =>
        set((s) => ({
          metronomes: s.metronomes.map((m) => {
            if (m.id !== id) return m;
            const newPat = m.pattern.map((row, bi) =>
              row.map((cell, si) => bi === beat && si === step ? { ...cell, ...value } : cell)
            );
            return { ...m, pattern: newPat };
          }),
        })),

      setSubdivisionForBeat: (id, beat, subdiv) =>
        set((s) => ({
          metronomes: s.metronomes.map((m) => {
            if (m.id !== id) return m;
            const empty = (): AdvMetroStep => ({ active: false, accent: "normal", velocity: 0.8 });
            // Pad pattern to ensure beat exists
            const pat = [...m.pattern];
            while (pat.length <= beat) {
              pat.push(Array.from({ length: m.subdivision }, empty));
            }
            const newPat = pat.map((steps, b) => {
              if (b !== beat) return steps;
              const cur = steps.length;
              if (subdiv > cur) return [...steps, ...Array.from({ length: subdiv - cur }, empty)];
              return steps.slice(0, Math.max(1, subdiv));
            });
            return { ...m, pattern: newPat };
          }),
        })),

      resetPattern: (id, numBeats) =>
        set((s) => ({
          metronomes: s.metronomes.map((m) =>
            m.id === id
              ? { ...m, pattern: buildDefaultPattern(m.instrument, numBeats, m.subdivision) }
              : m
          ),
        })),

      resetAll: () => set({ metronomes: [] }),
    }),
    {
      name: "drumo-adv-metro-v1",
      // Don't persist UI-only state
      partialize: (s) => ({
        metronomes: s.metronomes.map(({ expanded: _exp, ...rest }) => ({ ...rest, expanded: false })),
      }),
    }
  )
);
