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
import { createKitVoices, buildVoiceFromVariant } from "../audio/drumKitSampler";
import { getVariantById } from "../audio/drumPieceLibrary";
import { buildSampleVoice } from "../audio/sampleKitEngine";
import { sampleKitStore } from "./sampleKitStore";
import { customKitLoader } from "../audio/customKitLoader";
import type { DrumKit, DrumKitId, DrumKitMixer } from "../audio/drumKitManager";
import type { KitRecommendationResult } from "../audio/drumKitRecommendationEngine";
import type { TransportOptions } from "../audio/playbackEngine";
import type { LimbMap, StickingMode } from "../analysis/limbAnalyzer";
import type { PlayabilityMap } from "../analysis/playabilityEngine";
import type { Section } from "../analysis/sectionAnalyzer";
import type { IsolationMode } from "../audio/grooveIsolation";
import type { DrumHit, DrumPiece, NoteType, ParsedDrumProject, QuantizeGrid, QuantizeOptions, QuantizedHit, RhythmResult } from "../core/types";

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

  /**
   * Source audio de la lecture — toujours "midi".
   *
   * Play MIDI    → audioSource = "midi", la vue MIDI est active.
   * Play Partition → audioSource = "midi", la vue Partition suit visuellement.
   *
   * La partition (MuseScorePanel) n'est PAS une source audio :
   * elle suit le curseur de lecture MIDI via RAF (zero re-render React).
   * Toute modification de la partition visuelle ne change PAS le son joué.
   * Seul le MIDI (project.hits) détermine ce qui est entendu.
   */
  readonly playbackSource: "midi";

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

  /** Sons personnalisés pièce par pièce : pieceName → variantId */
  customPieceSounds: Partial<Record<string, string>>;
  /** Fichiers audio personnalisés pièce par pièce : pieceName → { path, name } */
  samplePieceFiles: Partial<Record<string, { path: string; name: string }>>;
  /** ID du kit personnalisé actuellement chargé (null si aucun) */
  activeSampleKitId: string | null;
  /** ID du kit en cours de chargement (null si aucun) */
  loadingKitId: string | null;

  setDrumKit: (id: DrumKitId) => void;
  patchDrumMixer: (patch: Partial<DrumKitMixer>) => void;
  resetDrumMixer: () => void;
  setMixerChannelMute: (channel: keyof DrumKitMixer, muted: boolean) => void;
  setMixerChannelSolo: (channel: keyof DrumKitMixer, soloed: boolean) => void;
  setShowDrumMixer: (v: boolean) => void;
  setKitRecommendation: (r: KitRecommendationResult | null) => void;
  toggleKitFavorite: (kitId: string) => void;
  /** Sélectionner une variante de son pour une pièce — change le son en temps réel */
  setCustomPieceSound: (pieceName: string, variantId: string | null) => void;
  /** Assigner un fichier audio à une pièce — charge et swipe la voix en temps réel */
  setCustomPieceSample: (pieceName: string, filePath: string, fileName: string) => Promise<void>;
  /** Supprimer l'assignation personnalisée d'une pièce (retour au kit de base) */
  clearCustomPiece: (pieceName: string) => void;
  /** Réinitialiser tous les sons personnalisés (retour aux sons du kit actif) */
  resetCustomPieceSounds: () => void;
  /** Charger un kit personnalisé sauvegardé — async */
  loadSampleKit: (kitId: string) => Promise<void>;
  /** Décharger le kit personnalisé actif */
  unloadSampleKit: () => void;

  moveHit: (hitId: string, deltaTicks: number) => void;
  removeHit: (hitId: string) => void;
  addHit: (piece: DrumPiece, midi: number, tick: number, velocity: number) => void;
  setHitVelocity: (hitId: string, velocity: number) => void;
  setHitDuration: (hitId: string, durationTicks: number) => void;
  pasteHits: (hits: Array<{ piece: DrumPiece; midi: number; tick: number; velocity: number; durationTicks: number }>) => void;
  newProject: (bpm?: number, numerator?: number, denominator?: number) => void;

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  undoStack: DrumHit[][];
  redoStack: DrumHit[][];
  undo: () => void;
  redo: () => void;

  // ── Note properties ───────────────────────────────────────────────────────
  setHitType:        (hitId: string, noteType: NoteType) => void;
  setHitProbability: (hitId: string, probability: number) => void;
  toggleHitMute:     (hitId: string) => void;
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
    isPlaying:      false,
    isPaused:       false,
    playbackSource: "midi" as const,
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
    dicOutput: null,
    message: "Glisse un MIDI batterie ou clique Import MIDI.",

    customPieceSounds: {},
    samplePieceFiles: {},
    activeSampleKitId: null,
    loadingKitId: null,
    activeDrumKitId: DEFAULT_KIT_ID,
    activeDrumKit: DRUM_KIT_PRESETS[DEFAULT_KIT_ID],
    drumMixer: { ...DRUM_KIT_PRESETS[DEFAULT_KIT_ID].mixer },
    drumMixerMute: {},
    drumMixerSolo: {},
    showDrumMixer: false,
    kitRecommendation: null,
    kitFavorites: customKitLoader.getFavoriteIds(),

    undoStack: [],
    redoStack: [],

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

    setCustomPieceSound: (pieceName, variantId) => {
      const output = playbackEngine.masterOutput;
      if (output && variantId) {
        const variant = getVariantById(variantId);
        if (variant) {
          const voice = buildVoiceFromVariant(variant, output);
          playbackEngine.swapSingleVoice(pieceName as import("../core/types").DrumPiece, voice);
        }
      } else if (output && !variantId) {
        // Revenir au son du kit actif pour cette pièce
        const kit = get().activeDrumKit;
        const allVoices = createKitVoices(kit, output);
        const voice = allVoices.get(pieceName as import("../core/types").DrumPiece);
        if (voice) {
          playbackEngine.swapSingleVoice(pieceName as import("../core/types").DrumPiece, voice);
          // Disposer les autres voix créées pour ce rebuild temporaire
          for (const [p, v] of allVoices) {
            if (p !== pieceName) setTimeout(() => { try { v.dispose(); } catch { /**/ } }, 50);
          }
        }
      }
      set((state) => ({
        customPieceSounds: {
          ...state.customPieceSounds,
          [pieceName]: variantId ?? undefined,
        },
      }));
    },

    resetCustomPieceSounds: () => {
      const output = playbackEngine.masterOutput;
      if (output) {
        const kit = get().activeDrumKit;
        const voices = createKitVoices(kit, output);
        playbackEngine.swapKitVoices(voices);
      }
      set({ customPieceSounds: {}, samplePieceFiles: {}, activeSampleKitId: null });
    },

    setCustomPieceSample: async (pieceName, filePath, fileName) => {
      const output = playbackEngine.masterOutput;
      if (!output) return;
      try {
        const voice = await buildSampleVoice(filePath, output);
        playbackEngine.swapSingleVoice(pieceName as import("../core/types").DrumPiece, voice);
        set((state) => ({
          samplePieceFiles: { ...state.samplePieceFiles, [pieceName]: { path: filePath, name: fileName } },
          // Enlever toute variante synth sur cette pièce
          customPieceSounds: { ...state.customPieceSounds, [pieceName]: undefined },
          activeSampleKitId: null,  // kit personnalisé modifié → plus de lien avec un kit sauvegardé
        }));
      } catch (err) {
        console.error("[sampleKit] Impossible de charger le fichier :", filePath, err);
      }
    },

    clearCustomPiece: (pieceName) => {
      const output = playbackEngine.masterOutput;
      if (output) {
        const kit = get().activeDrumKit;
        const voices = createKitVoices(kit, output);
        const voice  = voices.get(pieceName as import("../core/types").DrumPiece);
        if (voice) {
          playbackEngine.swapSingleVoice(pieceName as import("../core/types").DrumPiece, voice);
          for (const [p, v] of voices) {
            if (p !== pieceName) setTimeout(() => { try { v.dispose(); } catch { /**/ } }, 50);
          }
        }
      }
      set((state) => ({
        customPieceSounds: { ...state.customPieceSounds, [pieceName]: undefined },
        samplePieceFiles:  { ...state.samplePieceFiles,  [pieceName]: undefined },
        activeSampleKitId: null,
      }));
    },

    loadSampleKit: async (kitId) => {
      const kit = sampleKitStore.get(kitId);
      if (!kit) return;
      const output = playbackEngine.masterOutput;
      if (!output) return;

      set({ loadingKitId: kitId });

      // 1. Charger les voix de base du kit synth
      const baseKit = DRUM_KIT_PRESETS[kit.baseKitId as DrumKitId];
      if (baseKit) {
        const baseVoices = createKitVoices(baseKit, output);
        playbackEngine.swapKitVoices(baseVoices);
      }

      // 2. Appliquer les assignations personnalisées pièce par pièce
      const newCustom: Partial<Record<string, string>> = {};
      const newSamples: Partial<Record<string, { path: string; name: string }>> = {};
      const loadErrors: string[] = [];

      for (const [pieceName, assignment] of Object.entries(kit.pieces)) {
        if (!assignment) continue;
        if (assignment.type === "sample") {
          try {
            const voice = await buildSampleVoice(assignment.filePath, output);
            playbackEngine.swapSingleVoice(pieceName as import("../core/types").DrumPiece, voice);
            newSamples[pieceName] = { path: assignment.filePath, name: assignment.fileName };
          } catch {
            loadErrors.push(pieceName);
          }
        } else if (assignment.type === "variant") {
          const variant = getVariantById(assignment.variantId);
          if (variant) {
            const voice = buildVoiceFromVariant(variant, output);
            playbackEngine.swapSingleVoice(pieceName as import("../core/types").DrumPiece, voice);
            newCustom[pieceName] = assignment.variantId;
          }
        }
      }

      set({
        loadingKitId: null,
        activeSampleKitId: kitId,
        customPieceSounds: newCustom,
        samplePieceFiles: newSamples,
      });

      if (loadErrors.length > 0) {
        console.warn("[sampleKit] Fichiers introuvables pour :", loadErrors.join(", "));
      }
    },

    unloadSampleKit: () => {
      const output = playbackEngine.masterOutput;
      if (output) {
        const kit = get().activeDrumKit;
        const voices = createKitVoices(kit, output);
        playbackEngine.swapKitVoices(voices);
      }
      set({ customPieceSounds: {}, samplePieceFiles: {}, activeSampleKitId: null });
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

    // ── Undo / Redo helpers ───────────────────────────────────────────────────

    undo: () => {
      const { undoStack, redoStack, project } = get();
      if (undoStack.length === 0 || !project) return;
      const prev = undoStack[undoStack.length - 1];
      const nextProject = { ...project, hits: prev };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      const limbMap = rebuildLimbs(nextProject, get().limbMode);
      set({
        project: nextProject, ...next, limbMap,
        ...rebuildAnalysis(nextProject, limbMap),
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, [...project.hits]],
        message: "Annulé.",
      });
    },

    redo: () => {
      const { undoStack, redoStack, project } = get();
      if (redoStack.length === 0 || !project) return;
      const next_ = redoStack[redoStack.length - 1];
      const nextProject = { ...project, hits: next_ };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      const limbMap = rebuildLimbs(nextProject, get().limbMode);
      set({
        project: nextProject, ...next, limbMap,
        ...rebuildAnalysis(nextProject, limbMap),
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, [...project.hits]],
        message: "Rétabli.",
      });
    },

    // ── Note properties ───────────────────────────────────────────────────────

    setHitType: (hitId, noteType) => {
      const project = get().project;
      if (!project) return;
      const { undoStack } = get();
      const hits = project.hits.map((h) =>
        h.id === hitId ? { ...h, noteType: noteType === "normal" ? undefined : noteType } : h
      );
      const nextProject = { ...project, hits };
      playbackEngine.setProject(nextProject);
      const opts = get().quantizeOptions;
      set({ project: nextProject, ...rebuild(nextProject, opts), undoStack: [...undoStack.slice(-49), [...project.hits]], redoStack: [] });
    },

    setHitProbability: (hitId, probability) => {
      const project = get().project;
      if (!project) return;
      const { undoStack } = get();
      const clamped = Math.max(0, Math.min(100, Math.round(probability)));
      const hits = project.hits.map((h) =>
        h.id === hitId ? { ...h, probability: clamped === 100 ? undefined : clamped } : h
      );
      const nextProject = { ...project, hits };
      playbackEngine.setProject(nextProject);
      set({ project: nextProject, ...rebuild(nextProject, get().quantizeOptions), undoStack: [...undoStack.slice(-49), [...project.hits]], redoStack: [] });
    },

    toggleHitMute: (hitId) => {
      const project = get().project;
      if (!project) return;
      const { undoStack } = get();
      const hits = project.hits.map((h) =>
        h.id === hitId ? { ...h, muted: !h.muted || undefined } : h
      );
      const nextProject = { ...project, hits };
      playbackEngine.setProject(nextProject);
      const limbMap = rebuildLimbs(nextProject, get().limbMode);
      set({ project: nextProject, ...rebuild(nextProject, get().quantizeOptions), limbMap, ...rebuildAnalysis(nextProject, limbMap), undoStack: [...undoStack.slice(-49), [...project.hits]], redoStack: [] });
    },

    // ── Hits CRUD (with undo snapshot) ────────────────────────────────────────

    moveHit: (hitId, deltaTicks) => {
      const project = get().project;
      if (!project) return;
      const { undoStack } = get();
      const hits = project.hits.map((h) => h.id === hitId ? { ...h, tick: Math.max(0, h.tick + deltaTicks) } : h);
      const nextProject = { ...project, hits };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      const limbMap = rebuildLimbs(nextProject, get().limbMode);
      set({ project: nextProject, ...next, limbMap, ...rebuildAnalysis(nextProject, limbMap), message: "Frappe déplacée.", undoStack: [...undoStack.slice(-49), [...project.hits]], redoStack: [] });
    },

    removeHit: (hitId) => {
      const project = get().project;
      if (!project) return;
      const { undoStack } = get();
      const nextProject = { ...project, hits: project.hits.filter((h) => h.id !== hitId) };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      const limbMap = rebuildLimbs(nextProject, get().limbMode);
      set({ project: nextProject, ...next, limbMap, ...rebuildAnalysis(nextProject, limbMap), message: "Frappe supprimée.", undoStack: [...undoStack.slice(-49), [...project.hits]], redoStack: [] });
    },

    addHit: (piece, midi, tick, velocity) => {
      const project = get().project;
      if (!project) return;
      const { undoStack } = get();
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
      set({ project: nextProject, ...next, limbMap: limbMapA, ...rebuildAnalysis(nextProject, limbMapA), undoStack: [...undoStack.slice(-49), [...project.hits]], redoStack: [] });
    },

    setHitVelocity: (hitId, velocity) => {
      const project = get().project;
      if (!project) return;
      const { undoStack } = get();
      const hits = project.hits.map((h) =>
        h.id === hitId ? { ...h, velocity, isGhost: velocity < 0.42, isAccent: velocity > 0.85 } : h
      );
      const nextProject = { ...project, hits };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      const limbMapB = rebuildLimbs(nextProject, get().limbMode);
      set({ project: nextProject, ...next, limbMap: limbMapB, ...rebuildAnalysis(nextProject, limbMapB), undoStack: [...undoStack.slice(-49), [...project.hits]], redoStack: [] });
    },

    setHitDuration: (hitId, durationTicks) => {
      const project = get().project;
      if (!project) return;
      const { undoStack } = get();
      const hits = project.hits.map((h) =>
        h.id === hitId ? { ...h, durationTicks: Math.max(1, durationTicks) } : h
      );
      const nextProject = { ...project, hits };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      set({ project: nextProject, ...next, undoStack: [...undoStack.slice(-49), [...project.hits]], redoStack: [] });
    },

    pasteHits: (descriptors) => {
      const project = get().project;
      if (!project || descriptors.length === 0) return;
      const { undoStack } = get();
      const newHits: DrumHit[] = descriptors.map((d) => ({
        id: crypto.randomUUID(),
        midi: d.midi, piece: d.piece,
        tick: Math.max(0, d.tick),
        durationTicks: Math.max(1, d.durationTicks),
        velocity: d.velocity,
        isGhost: d.velocity < 0.42,
        isAccent: d.velocity > 0.85,
      }));
      const nextProject = { ...project, hits: [...project.hits, ...newHits] };
      const next = rebuild(nextProject, get().quantizeOptions);
      playbackEngine.setProject(nextProject);
      const limbMap = rebuildLimbs(nextProject, get().limbMode);
      set({ project: nextProject, ...next, limbMap, ...rebuildAnalysis(nextProject, limbMap), message: `${newHits.length} note(s) collée(s).`, undoStack: [...undoStack.slice(-49), [...project.hits]], redoStack: [] });
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
