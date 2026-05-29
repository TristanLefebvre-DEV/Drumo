import { create } from "zustand";
import { playbackEngine } from "../audio/playbackEngine";
import { parseDrumMidi } from "../core/midiParser";
import { quantizeHits } from "../core/quantizer";
import { buildRhythm } from "../core/rhythmEngine";
import { DEFAULT_TRANSPORT } from "../audio/transportController";
import { analyzeLimbs, EMPTY_LIMB_MAP } from "../analysis/limbAnalyzer";
import { buildPlayabilityMap } from "../analysis/playabilityEngine";
import { analyzeSections } from "../analysis/sectionAnalyzer";
import { analyzeEnergyFlow, type EnergyFlow } from "../analysis/energyFlowAnalyzer";
import { runDrumIntelligenceCore } from "../ai/drum-core/drumIntelligenceCore";
import type { DrumCoreOutput } from "../ai/drum-core/types";
import { getIsolationMuteState } from "../audio/grooveIsolation";
import { drumKitManager, DRUM_KIT_PRESETS, DEFAULT_KIT_ID, PIECE_TO_MIXER_CHANNEL } from "../audio/drumKitManager";
import { buildHumanizeProcessors, DEFAULT_HUMANIZE, type HumanizeSettings } from "../playback/humanizeEngine";
import { createKitVoices } from "../audio/drumKitSampler";
import { customKitLoader } from "../audio/customKitLoader";
import type { DrumKit, DrumKitId, DrumKitMixer } from "../audio/drumKitManager";
import type { KitRecommendationResult } from "../audio/drumKitRecommendationEngine";
import type { TransportOptions } from "../audio/playbackEngine";
import type { LimbMap, StickingMode } from "../analysis/limbAnalyzer";
import type { PlayabilityMap } from "../analysis/playabilityEngine";
import type { Section } from "../analysis/sectionAnalyzer";
import type { IsolationMode } from "../audio/grooveIsolation";
import type { DrumHit, DrumPiece, ParsedDrumProject, QuantizeGrid, QuantizeOptions, QuantizedHit, RhythmResult } from "../core/types";

interface ProjectStore {
  project: ParsedDrumProject | null;
  quantizedHits: QuantizedHit[];
  rhythm: RhythmResult | null;
  activeTick: number;
  zoomX: number;
  zoomY: number;
  quantizeOptions: QuantizeOptions;
  message: string;
  isPlaying: boolean;
  isPaused: boolean;
  transport: TransportOptions;

  loadMidi: (payload: { bytes: number[]; filePath: string }) => void;
  loadProjectData: (payload: { project: ParsedDrumProject; quantizeOptions?: Partial<QuantizeOptions> }) => void;
  setGrid: (grid: QuantizeGrid) => void;
  setPreserveGroove: (enabled: boolean) => void;
  setZoomX: (value: number) => void;
  setZoomY: (value: number) => void;

  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  togglePlayback: () => Promise<void>;
  seekTo: (tick: number) => Promise<void>;
  rewindToStart: () => void;
  rewindMeasure: () => void;

  updateTransport: (patch: Partial<TransportOptions>) => void;

  limbMap: LimbMap;
  limbMode: StickingMode;
  showLimbAnalysis: boolean;
  setLimbMode: (mode: StickingMode) => void;
  setShowLimbAnalysis: (show: boolean) => void;

  playabilityMap: PlayabilityMap;
  showPlayabilityOverlay: boolean;
  setShowPlayabilityOverlay: (show: boolean) => void;

  sections: Section[];
  showSectionTimeline: boolean;
  setShowSectionTimeline: (show: boolean) => void;

  energyFlow: EnergyFlow | null;
  showEnergyTimeline: boolean;
  setShowEnergyTimeline: (show: boolean) => void;

  isolationMode: IsolationMode;
  setIsolationMode: (mode: IsolationMode) => void;

  humanize: HumanizeSettings;
  setHumanize: (patch: Partial<HumanizeSettings>) => void;

  heatmap: { enabled: boolean; sensitivity: number };
  setHeatmap: (patch: Partial<{ enabled: boolean; sensitivity: number }>) => void;
  preview: { enabled: boolean; volume: number };
  setPreview: (patch: Partial<{ enabled: boolean; volume: number }>) => void;
  cleanup: { enabled: boolean };
  setCleanup: (patch: Partial<{ enabled: boolean }>) => void;

  /** Output from the Drum Intelligence Core — set once per project load */
  dicOutput: DrumCoreOutput | null;

  // ── Drum Kit ──────────────────────────────────────────────────────────────
  activeDrumKitId: DrumKitId;
  activeDrumKit: DrumKit;
  drumMixer: DrumKitMixer;
  drumMixerMute: Partial<Record<keyof DrumKitMixer, boolean>>;
  drumMixerSolo: Partial<Record<keyof DrumKitMixer, boolean>>;
  showDrumMixer: boolean;
  kitRecommendation: KitRecommendationResult | null;
  kitFavorites: string[];

  setDrumKit: (id: DrumKitId) => void;
  patchDrumMixer: (patch: Partial<DrumKitMixer>) => void;
  resetDrumMixer: () => void;
  setMixerChannelMute: (channel: keyof DrumKitMixer, muted: boolean) => void;
  setMixerChannelSolo: (channel: keyof DrumKitMixer, soloed: boolean) => void;
  setShowDrumMixer: (v: boolean) => void;
  setKitRecommendation: (r: KitRecommendationResult | null) => void;
  toggleKitFavorite: (kitId: string) => void;

  moveHit: (hitId: string, deltaTicks: number) => void;
  removeHit: (hitId: string) => void;
  addHit: (piece: DrumPiece, midi: number, tick: number, velocity: number) => void;
  setHitVelocity: (hitId: string, velocity: number) => void;
  newProject: (bpm?: number, numerator?: number, denominator?: number) => void;
}

const rebuild = (project: ParsedDrumProject, quantizeOptions: QuantizeOptions) => {
  const quantized = quantizeHits(project, quantizeOptions);
  return {
    quantizedHits: quantized.hits,
    quantizeOptions: quantized.options,
    rhythm: buildRhythm(quantized.hits, project.ppq, project.timeSignature)
  };
};

/**
 * Run the Drum Intelligence Core and derive smart initial quantize options.
 * Falls back to current options if the project is empty.
 */
const runDIC = (
  project:        ParsedDrumProject,
  currentOptions: QuantizeOptions
): { dicOutput: DrumCoreOutput; smartOptions: QuantizeOptions } => {
  const dicOutput    = runDrumIntelligenceCore(project);
  const smartOptions: QuantizeOptions = {
    grid:           dicOutput.quantization.recommendedGrid,
    preserveGroove: dicOutput.quantization.preserveMicroTiming,
    swing:          currentOptions.swing,  // keep user's swing preference
  };
  return { dicOutput, smartOptions };
};

const rebuildLimbs = (project: ParsedDrumProject, mode: StickingMode): LimbMap =>
  analyzeLimbs(project.hits, project.ppq, project.tempoBpm, mode);

const rebuildAnalysis = (project: ParsedDrumProject, limbMap: LimbMap) => ({
  playabilityMap: buildPlayabilityMap(project, limbMap),
  sections:       analyzeSections(project),
  energyFlow:     analyzeEnergyFlow(project),
});

export const useProjectStore = create<ProjectStore>((set, get) => {
  // Wire engine callbacks once at store creation time
  playbackEngine.onTick((tick) => set({ activeTick: tick }));
  playbackEngine.onStateChange((playing, paused) => set({ isPlaying: playing, isPaused: paused }));

  return {
    project: null,
    quantizedHits: [],
    rhythm: null,
    activeTick: 0,
    zoomX: 1,
    zoomY: 1,
    quantizeOptions: { grid: "1/16", preserveGroove: true, swing: 0 },
    isPlaying: false,
    isPaused: false,
    transport: { ...DEFAULT_TRANSPORT },
    limbMap: EMPTY_LIMB_MAP,
    limbMode: "human" as StickingMode,
    showLimbAnalysis: false,
    playabilityMap: {},
    showPlayabilityOverlay: false,
    sections: [],
    showSectionTimeline: false,
    energyFlow: null,
    showEnergyTimeline: false,
    isolationMode: null as IsolationMode,
    humanize: { ...DEFAULT_HUMANIZE },
    heatmap: { enabled: false, sensitivity: 1.0 },
    preview: { enabled: true, volume: 0.85 },
    cleanup: { enabled: false },
    dicOutput: null,
    message: "Glisse un MIDI batterie ou clique Import MIDI.",

    activeDrumKitId: DEFAULT_KIT_ID,
    activeDrumKit: DRUM_KIT_PRESETS[DEFAULT_KIT_ID],
    drumMixer: { ...DRUM_KIT_PRESETS[DEFAULT_KIT_ID].mixer },
    drumMixerMute: {},
    drumMixerSolo: {},
    showDrumMixer: false,
    kitRecommendation: null,
    kitFavorites: customKitLoader.getFavoriteIds(),

    // ── Drum Kit actions ───────────────────────────────────────────────────────

    setDrumKit: (id) => {
      const kit = DRUM_KIT_PRESETS[id];
      if (!kit) return;

      // Update the singleton (also fires any registered listeners)
      drumKitManager.setKit(id);

      // Create new kit voices and swap them in the scheduler (seamless, no interruption)
      const output = playbackEngine.masterOutput;
      if (output) {
        const newVoices = createKitVoices(kit, output);
        playbackEngine.swapKitVoices(newVoices);
        // Reinstall velocity processor with new kit's curve + humanize
        playbackEngine.setVelocityProcessor(
          (piece, rawVel) => drumKitManager.processVelocity(rawVel, piece)
        );
      }

      const newMixer = { ...kit.mixer };
      set({
        activeDrumKitId: id,
        activeDrumKit: kit,
        drumMixer: newMixer,
        drumMixerMute: {},
        drumMixerSolo: {},
      });
    },

    patchDrumMixer: (patch) => {
      drumKitManager.patchMixer(patch);
      // Velocity processor reads drumKitManager.mixer on every hit — no extra call needed
      set((state) => ({ drumMixer: { ...state.drumMixer, ...patch } }));
    },

    resetDrumMixer: () => {
      drumKitManager.resetMixerToKitDefaults();
      set((state) => ({ drumMixer: { ...state.activeDrumKit.mixer } }));
    },

    setMixerChannelMute: (channel, muted) => {
      // Map mixer channel → piece-level mute in transport
      const affectedPieces = (Object.entries(PIECE_TO_MIXER_CHANNEL) as [DrumPiece, keyof DrumKitMixer][])
        .filter(([, ch]) => ch === channel)
        .map(([piece]) => piece);

      set((state) => {
        const newMixerMute = { ...state.drumMixerMute, [channel]: muted };
        // Build transport muteState from all muted channels
        const muteState: Partial<Record<DrumPiece, boolean>> = { ...state.transport.muteState };
        for (const piece of affectedPieces) {
          if (muted) muteState[piece] = true;
          else delete muteState[piece];
        }
        playbackEngine.updateOptions({ muteState });
        return { drumMixerMute: newMixerMute, transport: { ...state.transport, muteState } };
      });
    },

    setMixerChannelSolo: (channel, soloed) => {
      set((state) => {
        const newMixerSolo = { ...state.drumMixerSolo, [channel]: soloed };
        // Rebuild piece-level soloState from all soloed mixer channels
        const soloState: Partial<Record<DrumPiece, boolean>> = {};
        for (const [ch, isSoloed] of Object.entries(newMixerSolo) as [keyof DrumKitMixer, boolean][]) {
          if (!isSoloed) continue;
          const pieces = (Object.entries(PIECE_TO_MIXER_CHANNEL) as [DrumPiece, keyof DrumKitMixer][])
            .filter(([, c]) => c === ch).map(([p]) => p);
          for (const p of pieces) soloState[p] = true;
        }
        playbackEngine.updateOptions({ soloState });
        return { drumMixerSolo: newMixerSolo, transport: { ...state.transport, soloState } };
      });
    },

    setShowDrumMixer: (v) => set({ showDrumMixer: v }),

    setKitRecommendation: (r) => set({ kitRecommendation: r }),

    toggleKitFavorite: (kitId) => {
      customKitLoader.toggleFavorite(kitId);
      set({ kitFavorites: customKitLoader.getFavoriteIds() });
    },

    loadMidi: (payload) => {
      try {
        const project = parseDrumMidi(new Uint8Array(payload.bytes), payload.filePath);

        // ── Drum Intelligence Core: analyse the groove, derive smart defaults ──
        const { dicOutput, smartOptions } = project.hits.length > 0
          ? runDIC(project, get().quantizeOptions)
          : { dicOutput: null, smartOptions: get().quantizeOptions };

        const next = rebuild(project, smartOptions);
        playbackEngine.stop();
        playbackEngine.setProject(project);
        const limbMap = rebuildLimbs(project, get().limbMode);
        const humanize = get().humanize;
        const { timingFn, velocityFn } = buildHumanizeProcessors(humanize, project);
        playbackEngine.setHumanizeProcessors(timingFn, velocityFn);
        set({
          project,
          ...next,
          dicOutput,
          limbMap,
          ...rebuildAnalysis(project, limbMap),
          message: `${project.sourceName} — ${project.hits.length} frappes chargées.`,
        });
      } catch (error) {
        set({ message: `Impossible de charger: ${error instanceof Error ? error.message : String(error)}` });
      }
    },

    loadProjectData: (payload) => {
      try {
        // DIC overrides quantize options only when the caller doesn't explicitly provide them
        const hasCaller = payload.quantizeOptions && Object.keys(payload.quantizeOptions).length > 0;
        const baseOptions = hasCaller
          ? { ...get().quantizeOptions, ...(payload.quantizeOptions ?? {}) }
          : get().quantizeOptions;

        const { dicOutput, smartOptions } = payload.project.hits.length > 0
          ? runDIC(payload.project, baseOptions)
          : { dicOutput: null, smartOptions: baseOptions };

        const finalOptions = hasCaller ? baseOptions : smartOptions;
        const next = rebuild(payload.project, finalOptions);
        playbackEngine.stop();
        playbackEngine.setProject(payload.project);
        const limbMap = rebuildLimbs(payload.project, get().limbMode);
        set({
          project: payload.project,
          ...next,
          dicOutput,
          limbMap,
          ...rebuildAnalysis(payload.project, limbMap),
          message: `${payload.project.sourceName} — projet chargé.`,
        });
      } catch (error) {
        set({ message: `Projet invalide: ${error instanceof Error ? error.message : String(error)}` });
      }
    },

    setGrid: (grid) => {
      const project = get().project;
      if (!project) return;
      set(rebuild(project, { ...get().quantizeOptions, grid }));
    },

    setPreserveGroove: (enabled) => {
      const project = get().project;
      if (!project) return;
      set(rebuild(project, { ...get().quantizeOptions, preserveGroove: enabled }));
    },

    setZoomX: (value) => set({ zoomX: value }),
    setZoomY: (value) => set({ zoomY: value }),

    play: async () => {
      if (!get().project) return;
      await playbackEngine.play();
    },

    pause: () => {
      playbackEngine.pause();
    },

    stop: () => {
      playbackEngine.stop();
    },

    togglePlayback: async () => {
      if (get().isPlaying) {
        playbackEngine.pause();
      } else {
        if (!get().project) return;
        await playbackEngine.play();
      }
    },

    seekTo: async (tick) => {
      await playbackEngine.seek(tick);
    },

    rewindToStart: () => {
      playbackEngine.rewindToStart();
    },

    rewindMeasure: () => {
      playbackEngine.rewindMeasure();
    },

    updateTransport: (patch) => {
      set((state) => ({ transport: { ...state.transport, ...patch } }));
      playbackEngine.updateOptions(patch);
    },

    setLimbMode: (mode) => {
      const project = get().project;
      if (!project) { set({ limbMode: mode }); return; }
      const limbMap = rebuildLimbs(project, mode);
      set({ limbMode: mode, limbMap, ...rebuildAnalysis(project, limbMap) });
    },
    setShowLimbAnalysis: (show) => set({ showLimbAnalysis: show }),

    setShowPlayabilityOverlay: (show) => set({ showPlayabilityOverlay: show }),
    setShowSectionTimeline: (show) => set({ showSectionTimeline: show }),
    setShowEnergyTimeline: (show) => set({ showEnergyTimeline: show }),

    setIsolationMode: (mode) => {
      const project = get().project;
      const isolationMute = getIsolationMuteState(mode, project?.hits ?? []);
      set({ isolationMode: mode });
      // Merge isolation mute with any existing user mute
      get().updateTransport({ muteState: isolationMute });
    },

    setHumanize: (patch) => {
      const next = { ...get().humanize, ...patch };
      set({ humanize: next });
      const project = get().project;
      if (project) {
        const { timingFn, velocityFn } = buildHumanizeProcessors(next, project);
        playbackEngine.setHumanizeProcessors(timingFn, velocityFn);
      }
    },

    setHeatmap: (patch) => set((state) => ({ heatmap: { ...state.heatmap, ...patch } })),
    setPreview: (patch) => set((state) => ({ preview: { ...state.preview, ...patch } })),
    setCleanup: (patch) => set((state) => ({ cleanup: { ...state.cleanup, ...patch } })),

    moveHit: (hitId, deltaTicks) => {
      const project = get().project;
      if (!project) return;
      const hits = project.hits.map((h) => h.id === hitId ? { ...h, tick: Math.max(0, h.tick + deltaTicks) } : h);
      const nextProject = { ...project, hits };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      const limbMap = rebuildLimbs(nextProject, get().limbMode);
      set({ project: nextProject, ...next, limbMap, ...rebuildAnalysis(nextProject, limbMap), message: "Frappe déplacée." });
    },

    removeHit: (hitId) => {
      const project = get().project;
      if (!project) return;
      const nextProject = { ...project, hits: project.hits.filter((h) => h.id !== hitId) };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      const limbMap = rebuildLimbs(nextProject, get().limbMode);
      set({ project: nextProject, ...next, limbMap, ...rebuildAnalysis(nextProject, limbMap), message: "Frappe supprimée." });
    },

    addHit: (piece, midi, tick, velocity) => {
      const project = get().project;
      if (!project) return;
      const newHit: DrumHit = {
        id: crypto.randomUUID(),
        midi, piece, tick,
        durationTicks: Math.round(project.ppq / 4),
        velocity,
        isGhost: velocity < 0.42,
        isAccent: velocity > 0.85,
      };
      const nextProject = { ...project, hits: [...project.hits, newHit] };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      const limbMapA = rebuildLimbs(nextProject, get().limbMode);
      set({ project: nextProject, ...next, limbMap: limbMapA, ...rebuildAnalysis(nextProject, limbMapA) });
    },

    setHitVelocity: (hitId, velocity) => {
      const project = get().project;
      if (!project) return;
      const hits = project.hits.map((h) =>
        h.id === hitId ? { ...h, velocity, isGhost: velocity < 0.42, isAccent: velocity > 0.85 } : h
      );
      const nextProject = { ...project, hits };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      const limbMapB = rebuildLimbs(nextProject, get().limbMode);
      set({ project: nextProject, ...next, limbMap: limbMapB, ...rebuildAnalysis(nextProject, limbMapB) });
    },

    newProject: (bpm = 120, numerator = 4, denominator = 4) => {
      const project: ParsedDrumProject = {
        ppq: 480, tempoBpm: bpm,
        timeSignature: { numerator, denominator },
        sourceName: "Nouveau projet", hits: [],
      };
      const next = rebuild(project, get().quantizeOptions);
      playbackEngine.stop();
      playbackEngine.setProject(project);
      set({ project, ...next, limbMap: EMPTY_LIMB_MAP, message: "Nouveau projet vide créé." });
    },
  };
});
