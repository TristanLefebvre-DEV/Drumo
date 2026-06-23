import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuantizeGrid } from "../core/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Appearance    = "dark" | "light";
export type VisualDensity = "minimal" | "standard" | "dense";
export type FontSize      = "small" | "medium" | "large";
export type AnimMode      = "full" | "reduced" | "none";
export type GradientStyle = "flat" | "subtle" | "radial" | "mesh" | "aurora" | "neon" | "prism" | "wave";
export type StaminaModel  = "standard" | "advanced";
export type PracticeMode  = "free" | "guided";
export type AIProc        = "background" | "synchronous";
export type AudioBufSize  = 256 | 512 | 1024 | 2048;
export type RenderQuality = "standard" | "high";
export type MetroSoundId  = "click" | "sharp-click" | "woodblock" | "beep" | "hihat" | "rimshot";

export interface AISettings {
  grooveDetection:      boolean;
  autoDetectStyle:      boolean;
  physicalSimulation:   boolean;
  difficultyAnalysis:   boolean;
  smartQuantization:    boolean;
  optimizationVariants: boolean;
  confidenceThreshold:  number; // 0–100
}

export interface MidiSettings {
  defaultGrid:         QuantizeGrid;
  preserveGroove:      boolean;
  swingAmount:         number; // 0–100
  ghostNoteThreshold:  number; // 0–127 MIDI velocity
  accentThreshold:     number; // 0–127 MIDI velocity
}

export interface PhysicsSettings {
  enabled:              boolean;
  conflictSensitivity:  number; // 0–100
  showLimbLoad:         boolean;
  warningThreshold:     number; // 0–100
  staminaModel:         StaminaModel;
}

export interface NotationSettings {
  cleanup:                boolean;
  restOptimization:       boolean;
  beamOptimization:       boolean;
  subdivisionAutoDetect:  boolean;
  showVelocityDynamics:   boolean;
  showArticulations:      boolean;
  scoreScale:             number; // 80–140 (%)
}

export interface AudioSettings {
  masterVolume:         number; // 0–100
  metronomeVolume:      number; // 0–200
  previewVolume:        number; // 0–100
  countInBars:          0 | 1 | 2 | 4;
  metronomeSound:       MetroSoundId;
  latencyCompensationMs: number; // -100 to +100
}

export interface PerformanceSettings {
  aiProcessing:        AIProc;
  audioBufferSize:     AudioBufSize;
  renderQuality:       RenderQuality;
  animations:          AnimMode;
  autoSave:            boolean;
  autoSaveIntervalMin: number; // 1–30
}

export interface LearnSettings {
  showDifficultyOverlay: boolean;
  showPhysicalWarnings:  boolean;
  showGrooveHints:       boolean;
  showRudimentNames:     boolean;
  practiceMode:          PracticeMode;
  bpmTrainingEnabled:    boolean;
}

export interface ThemeSettings {
  appearance:      Appearance;
  gradientColor1:  string;   // hex — couleur primaire du dégradé
  gradientColor2:  string;   // hex — couleur secondaire du dégradé
  density:         VisualDensity;
  animations:      boolean;
  highContrast:    boolean;
  fontSize:        FontSize;
  gradientStyle:   GradientStyle;
  gradientAngle:   number;   // 0–360, défaut 135
  gradientInvert:  boolean;  // inverser le sens
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  ai: {
    grooveDetection:      true,
    autoDetectStyle:      true,
    physicalSimulation:   true,
    difficultyAnalysis:   true,
    smartQuantization:    true,
    optimizationVariants: true,
    confidenceThreshold:  70,
  } satisfies AISettings,

  midi: {
    defaultGrid:        "1/16",
    preserveGroove:     false,
    swingAmount:        0,
    ghostNoteThreshold: 40,
    accentThreshold:    100,
  } satisfies MidiSettings,

  physics: {
    enabled:             true,
    conflictSensitivity: 60,
    showLimbLoad:        true,
    warningThreshold:    70,
    staminaModel:        "standard",
  } satisfies PhysicsSettings,

  notation: {
    cleanup:               true,
    restOptimization:      true,
    beamOptimization:      true,
    subdivisionAutoDetect: true,
    showVelocityDynamics:  true,
    showArticulations:     true,
    scoreScale:            100,
  } satisfies NotationSettings,

  audio: {
    masterVolume:          80,
    metronomeVolume:       120,
    previewVolume:         75,
    countInBars:           0,
    metronomeSound:        "click",
    latencyCompensationMs: 0,
  } satisfies AudioSettings,

  performance: {
    aiProcessing:        "background",
    audioBufferSize:     512,
    renderQuality:       "standard",
    animations:          "full",
    autoSave:            true,
    autoSaveIntervalMin: 5,
  } satisfies PerformanceSettings,

  learn: {
    showDifficultyOverlay: true,
    showPhysicalWarnings:  true,
    showGrooveHints:       true,
    showRudimentNames:     false,
    practiceMode:          "free",
    bpmTrainingEnabled:    false,
  } satisfies LearnSettings,

  theme: {
    appearance:      "light",
    gradientColor1:  "#007aff",
    gradientColor2:  "#8e8e93",
    density:         "standard",
    animations:      true,
    highContrast:    false,
    fontSize:        "medium",
    gradientStyle:   "flat",
    gradientAngle:   135,
    gradientInvert:  false,
  } satisfies ThemeSettings,
};

// ─── Store ─────────────────────────────────────────────────────────────────────

interface SettingsStore {
  ai:          AISettings;
  midi:        MidiSettings;
  physics:     PhysicsSettings;
  notation:    NotationSettings;
  audio:       AudioSettings;
  performance: PerformanceSettings;
  learn:       LearnSettings;
  theme:       ThemeSettings;

  setAI:          (patch: Partial<AISettings>)          => void;
  setMidi:        (patch: Partial<MidiSettings>)        => void;
  setPhysics:     (patch: Partial<PhysicsSettings>)     => void;
  setNotation:    (patch: Partial<NotationSettings>)    => void;
  setAudio:       (patch: Partial<AudioSettings>)       => void;
  setPerformance: (patch: Partial<PerformanceSettings>) => void;
  setLearn:       (patch: Partial<LearnSettings>)       => void;
  setTheme:       (patch: Partial<ThemeSettings>)       => void;
  resetAll:       () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setAI:          (p) => set((s) => ({ ai:          { ...s.ai,          ...p } })),
      setMidi:        (p) => set((s) => ({ midi:        { ...s.midi,        ...p } })),
      setPhysics:     (p) => set((s) => ({ physics:     { ...s.physics,     ...p } })),
      setNotation:    (p) => set((s) => ({ notation:    { ...s.notation,    ...p } })),
      setAudio:       (p) => set((s) => ({ audio:       { ...s.audio,       ...p } })),
      setPerformance: (p) => set((s) => ({ performance: { ...s.performance, ...p } })),
      setLearn:       (p) => set((s) => ({ learn:       { ...s.learn,       ...p } })),
      setTheme:       (p) => set((s) => ({ theme:       { ...s.theme,       ...p } })),
      resetAll:       () => set({ ...DEFAULT_SETTINGS }),
    }),
    { name: "drumo-settings-v1" }
  )
);

// ─── DOM theme application ─────────────────────────────────────────────────────

export const applyThemeToDom = (t: ThemeSettings): void => {
  const root = document.documentElement;
  root.setAttribute("data-theme",    t.appearance);
  root.setAttribute("data-density",  t.density);
  root.setAttribute("data-fontsize", t.fontSize);
  root.setAttribute("data-hc",       t.highContrast ? "1" : "0");
  root.setAttribute("data-anim",     t.animations   ? "full" : "none");

  // Gradient engine drives all color variables dynamically
  import("../ui/utils/gradientEngine").then(({ applyGradientToDom }) => {
    applyGradientToDom(
      t.gradientColor1 ?? "#0071e3",
      t.gradientColor2 ?? "#bf5af2",
      t.appearance,
      t.gradientStyle  ?? "mesh",
      t.gradientAngle  ?? 135,
      t.gradientInvert ?? false,
    );
  });
};

// Reactive: re-apply whenever theme settings change
useSettingsStore.subscribe((s) => applyThemeToDom(s.theme));

// Apply synchronously before first render so no flash
applyThemeToDom(useSettingsStore.getState().theme);
