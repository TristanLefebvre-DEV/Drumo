import { useEffect, useMemo, useState } from "react";
import { ScoreCanvas } from "../components/ScoreCanvas";
import { DrumGrid } from "../components/DrumGrid";
import { DrummerView } from "../components/DrummerView";
import { DrumAnimationView } from "../components/DrumAnimationView";
import { DrummerVisualizer } from "../components/DrummerVisualizer";
import { EnergyTimeline } from "../components/EnergyTimeline";
import { HumanizePanel } from "../components/HumanizePanel";
import { HeatmapControls } from "../components/HeatmapControls";
import { TransportBar } from "../components/TransportBar";
import { RightPanel } from "../components/RightPanel";
import { MenuBar } from "../components/MenuBar";
import { AiPanel } from "../components/AiPanel";
import { KitBalancePanel } from "../components/KitBalancePanel";
import { SectionTimeline } from "../components/SectionTimeline";
import { IsolationPanel } from "../components/IsolationPanel";
import { DrumKitSelector } from "../components/DrumKitSelector";
import { DrumMixer } from "../components/DrumMixer";
import { MetronomePanel } from "../components/MetronomePanel";
import { useProjectStore } from "../../store/projectStore";
import { analyzeVelocity } from "../../render/velocityAnalyzer";
import { formatPosition } from "../../audio/transportController";
import { LIMB_COLOR, computeLimbStats, crossoverCount, avgConfidence } from "../../analysis/limbAnalyzer";
import { summarizePlayability } from "../../analysis/playabilityEngine";
import type { ParsedDrumProject, QuantizeGrid, QuantizeOptions } from "../../core/types";
import { exportProjectToMidiBytes } from "../../core/midiExporter";

// ─── Limb Legend ──────────────────────────────────────────────────────────────

const LIMB_LABELS: Record<string, string> = {
  RH: "Main droite", LH: "Main gauche", RF: "Pied droit", LF: "Pied gauche",
};
type StickingMode = "strict" | "human" | "advanced";

const LimbLegend = ({
  limbMap, limbMode, onModeChange,
}: {
  limbMap: import("../../analysis/limbAnalyzer").LimbMap;
  limbMode: StickingMode;
  onModeChange: (m: StickingMode) => void;
}) => {
  const stats  = computeLimbStats(limbMap);
  const xovers = crossoverCount(limbMap);
  const conf   = avgConfidence(limbMap);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs">
      {(["RH", "LH", "RF", "LF"] as const).map((limb) => (
        <div key={limb} className="flex items-center gap-1.5">
          <span
            className="flex h-5 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: LIMB_COLOR[limb].hex }}
          >
            {limb}
          </span>
          <span className="text-zinc-400">{LIMB_LABELS[limb]}</span>
          <span className="rounded bg-zinc-800 px-1 font-mono text-zinc-500">{stats[limb]}</span>
        </div>
      ))}
      <div className="h-4 w-px bg-zinc-700" />
      <span className="text-zinc-500">
        Croisements : <span className="font-mono text-amber-400">{xovers}</span>
      </span>
      <span className="text-zinc-500">
        Confiance : <span className="font-mono text-teal-400">{Math.round(conf * 100)}%</span>
      </span>
      <div className="h-4 w-px bg-zinc-700" />
      <div className="flex items-center gap-1">
        <span className="text-zinc-600">Mode :</span>
        {(["strict", "human", "advanced"] as StickingMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`rounded px-2 py-0.5 capitalize transition ${
              limbMode === m
                ? "bg-teal-600/30 text-teal-300 border border-teal-500/40"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Toolbar toggle button ─────────────────────────────────────────────────────

const ToggleBtn = ({
  active, onClick, color, label, badge, activeDotPulse,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  label: string;
  badge?: React.ReactNode;
  activeDotPulse?: boolean;
}) => {
  const activeStyle: Record<string, string> = {
    violet: "border-violet-500/50 bg-violet-600/20 text-violet-300",
    amber:  "border-amber-500/50 bg-amber-600/20 text-amber-300",
    teal:   "border-teal-500/50 bg-teal-600/20 text-teal-300",
    orange: "border-orange-500/50 bg-orange-600/20 text-orange-300",
    red:    "border-red-500/50 bg-red-600/20 text-red-300",
    emerald:"border-emerald-500/50 bg-emerald-600/20 text-emerald-300",
  };
  const dotActive: Record<string, string> = {
    violet: "bg-violet-400",
    amber:  "bg-amber-400",
    teal:   "bg-teal-400",
    orange: "bg-orange-400",
    red:    "bg-red-400",
    emerald:"bg-emerald-400",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition ${
        active
          ? (activeStyle[color] ?? "border-zinc-600 bg-zinc-700 text-zinc-200")
          : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
      }`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${
        active ? (dotActive[color] ?? "bg-zinc-400") : "bg-zinc-700"
      } ${active && activeDotPulse ? "animate-pulse" : ""}`} />
      {label}
      {badge}
    </button>
  );
};

// ─── View switcher ─────────────────────────────────────────────────────────────

type ViewMode = "score" | "grid" | "drummer" | "animation" | "body";
const VIEW_LABELS: Record<ViewMode, string> = {
  score: "Partition", grid: "Drum Grid", drummer: "Drummer", animation: "Anim", body: "Body Sim",
};

const ViewSwitcher = ({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) => (
  <div className="flex shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 p-0.5 gap-0.5">
    {(["score", "grid", "drummer", "animation", "body"] as ViewMode[]).map((v) => (
      <button
        key={v}
        type="button"
        onClick={() => onChange(v)}
        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
          value === v ? "bg-zinc-700 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        {VIEW_LABELS[v]}
      </button>
    ))}
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

export const DrumScorePage = () => {
  const [selectedHitId, setSelectedHitId] = useState<string | null>(null);
  const [theme, setTheme]       = useState<"graphite" | "blue">("graphite");
  const [focusMode, setFocusMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("score");
  const [showAiPanel, setShowAiPanel]       = useState(false);
  const [showKitBalance, setShowKitBalance] = useState(false);
  const [showMixerPanel, setShowMixerPanel]   = useState(false);
  const [showMetronome, setShowMetronome]       = useState(false);
  const [showEducational, setShowEducational]   = useState(false);
  const [showHumanizePanel, setShowHumanizePanel] = useState(false);

  const {
    project, rhythm, quantizeOptions,
    zoomX, zoomY, activeTick, message,
    loadMidi, loadProjectData,
    setGrid, setPreserveGroove, setZoomX, setZoomY,
    togglePlayback, stop, rewindToStart,
    moveHit, removeHit, addHit, setHitVelocity,
    newProject,
    heatmap, setHeatmap,
    preview, setPreview,
    cleanup, setCleanup,
    quantizedHits, isPlaying,
    limbMap, limbMode, showLimbAnalysis, setLimbMode, setShowLimbAnalysis,
    playabilityMap, showPlayabilityOverlay, setShowPlayabilityOverlay,
    sections, showSectionTimeline, setShowSectionTimeline,
    energyFlow, showEnergyTimeline, setShowEnergyTimeline,
    humanize,
    seekTo,
    activeDrumKit,
  } = useProjectStore();

  const velocityStats = useMemo(() => analyzeVelocity(project?.hits ?? []), [project?.hits]);

  const signatureText = useMemo(
    () => `${project?.timeSignature.numerator ?? 4}/${project?.timeSignature.denominator ?? 4}`,
    [project],
  );
  const editableHits = useMemo(
    () => (project?.hits ?? []).slice(0, 80).map((hit) => ({ id: hit.id, label: `${hit.piece} @ ${hit.tick}` })),
    [project],
  );

  const importMidi = async () => {
    const payload = await window.drumApp.openMidiFile();
    if (!payload) return;
    try { loadMidi(payload); } catch { /* store sets message */ }
    setSelectedHitId(null);
  };

  const saveProject = async () => {
    const state = useProjectStore.getState();
    if (!state.project) return;
    await window.drumApp.saveProject({ project: state.project, quantizeOptions: state.quantizeOptions });
  };

  const loadProject = async () => {
    const loaded = await window.drumApp.loadProject();
    if (!loaded) return;
    const parsed = JSON.parse(loaded.content) as { project?: ParsedDrumProject; quantizeOptions?: Partial<QuantizeOptions> };
    if (!parsed.project || !Array.isArray(parsed.project.hits) || typeof parsed.project.ppq !== "number") return;
    loadProjectData({ project: parsed.project, quantizeOptions: parsed.quantizeOptions });
  };

  const toggleFocusMode = async () => {
    const next = !focusMode;
    setFocusMode(next);
    await window.drumApp.setFullscreen(next);
  };

  const exportMidi = async () => {
    if (!project) return;
    await window.drumApp.exportMidi(exportProjectToMidiBytes(project));
  };

  const exportSvg = async () => {
    const svg = document.querySelector("svg");
    if (!svg) return;
    await window.drumApp.exportSvg(svg.outerHTML);
  };

  const onDrop: React.DragEventHandler<HTMLElement> = async (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".mid") && !lower.endsWith(".midi")) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    try { loadMidi({ bytes: Array.from(bytes), filePath: file.name }); } catch { /* */ }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (e.code === "Space") { e.preventDefault(); void togglePlayback(); }
      if (e.code === "Home")  { e.preventDefault(); rewindToStart(); }
      if (e.code === "Escape") { e.preventDefault(); stop(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") { e.preventDefault(); void importMidi(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void saveProject(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlayback, rewindToStart, stop]);

  const playabilityBadge = useMemo(() => summarizePlayability(playabilityMap), [playabilityMap]);
  const timelinePct = project
    ? Math.min(100, Math.max(0, (activeTick / Math.max(1, project.ppq * project.timeSignature.numerator * 4)) * 100))
    : 0;

  const isScoreView = viewMode === "score";

  return (
    <main
      className={`flex h-screen flex-col text-zinc-100 ${
        theme === "graphite"
          ? "bg-[radial-gradient(circle_at_top,#18181b,#09090b_55%)]"
          : "bg-[radial-gradient(circle_at_top,#1e3a8a,#020617_60%)]"
      }`}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* ── Unified header (MenuBar + TopBar merged) ── */}
      <MenuBar
        focusMode={focusMode}
        theme={theme}
        canEditSelection={selectedHitId !== null}
        grid={quantizeOptions.grid}
        preserveGroove={quantizeOptions.preserveGroove}
        zoomX={zoomX}
        zoomY={zoomY}
        onToggleFocus={() => void toggleFocusMode()}
        onThemeChange={setTheme}
        onImport={() => void importMidi()}
        onSave={() => void saveProject()}
        onLoad={() => void loadProject()}
        onExportPdf={() => void window.drumApp.exportPdf()}
        onExportMidi={() => void exportMidi()}
        onExportSvg={() => void exportSvg()}
        onGridChange={(v: QuantizeGrid) => setGrid(v)}
        onPreserveGroove={setPreserveGroove}
        onZoomX={setZoomX}
        onZoomY={setZoomY}
        onNudgeLeft={() => { if (selectedHitId) moveHit(selectedHitId, -24); }}
        onNudgeRight={() => { if (selectedHitId) moveHit(selectedHitId, 24); }}
        onDelete={() => { if (!selectedHitId) return; removeHit(selectedHitId); setSelectedHitId(null); }}
      />

      {/* ── Transport ── */}
      <TransportBar />

      {/* ── Main content ── */}
      <section className="flex min-h-0 flex-1 p-3">
        <div className="flex min-h-0 flex-1 flex-col gap-2">

          {/* ── Toolbar: timeline + toggles + view switcher ── */}
          <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm">

            {/* Timeline + position */}
            <div className="flex min-w-0 items-center gap-2" style={{ width: 220 }}>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-blue-500/70 transition-all duration-100"
                  style={{ width: `${timelinePct}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-blue-300">
                {formatPosition(activeTick, project?.ppq ?? 480, project?.timeSignature.numerator ?? 4)}
              </span>
            </div>

            <div className="h-4 w-px shrink-0 bg-zinc-700/60" />

            {/* Swing */}
            <span className="shrink-0 text-[11px] text-zinc-600">
              Swing <span className="font-mono text-zinc-400">{(quantizeOptions.swing * 100).toFixed(0)}%</span>
            </span>

            <div className="h-4 w-px shrink-0 bg-zinc-700/60" />

            {/* Drum Kit Selector */}
            <DrumKitSelector />

            {/* Mixer toggle */}
            <button
              type="button"
              title="Ouvrir le mixer"
              onClick={() => setShowMixerPanel((v) => !v)}
              className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition ${
                showMixerPanel
                  ? "border-zinc-500/60 bg-zinc-700/60 text-zinc-200"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              <span className="text-[9px]">⚙</span> Mixer
            </button>

            {/* Humanize toggle */}
            <button
              type="button"
              title="Humanize Engine"
              onClick={() => setShowHumanizePanel((v) => !v)}
              className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition ${
                showHumanizePanel
                  ? "border-orange-500/50 bg-orange-600/20 text-orange-300"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              {humanize.enabled && (
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
              )}
              <span className="text-[9px]">♪</span> Humanize
            </button>

            {/* Metronome toggle */}
            <button
              type="button"
              title="Métronome standalone"
              onClick={() => setShowMetronome((v) => !v)}
              className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition ${
                showMetronome
                  ? "border-amber-500/50 bg-amber-600/20 text-amber-300"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              <span className="text-[9px]">♩</span> Métronome
            </button>

            <div className="h-4 w-px shrink-0 bg-zinc-700/60" />

            {/* View controls: Heatmap + Sound Preview */}
            {project && (
              <>
                <div className="flex items-center gap-1">
                  <ToggleBtn
                    active={heatmap.enabled}
                    onClick={() => setHeatmap({ enabled: !heatmap.enabled })}
                    color="amber"
                    label="Heatmap"
                  />
                  <ToggleBtn
                    active={preview.enabled}
                    onClick={() => setPreview({ enabled: !preview.enabled })}
                    color="emerald"
                    label="Sound"
                  />
                </div>
                <div className="h-4 w-px shrink-0 bg-zinc-700/60" />
              </>
            )}

            {/* Analysis toggles */}
            <div className="flex flex-wrap items-center gap-1">
              {isScoreView && project && (
                <ToggleBtn
                  active={cleanup.enabled}
                  onClick={() => setCleanup({ enabled: !cleanup.enabled })}
                  color="violet"
                  label="Clean"
                />
              )}
              {project && (
                <ToggleBtn
                  active={showKitBalance}
                  onClick={() => setShowKitBalance((v) => !v)}
                  color="amber"
                  label="Balance"
                />
              )}
              <ToggleBtn
                active={showAiPanel}
                onClick={() => setShowAiPanel((v) => !v)}
                color="violet"
                label="AI"
                activeDotPulse
              />
              {isScoreView && project && (
                <ToggleBtn
                  active={showLimbAnalysis}
                  onClick={() => setShowLimbAnalysis(!showLimbAnalysis)}
                  color="teal"
                  label="Limbs"
                />
              )}
              {isScoreView && project && (
                <ToggleBtn
                  active={showSectionTimeline}
                  onClick={() => setShowSectionTimeline(!showSectionTimeline)}
                  color="orange"
                  label="Sections"
                />
              )}
              {isScoreView && project && (
                <ToggleBtn
                  active={showPlayabilityOverlay}
                  onClick={() => setShowPlayabilityOverlay(!showPlayabilityOverlay)}
                  color="red"
                  label="Playability"
                  badge={
                    playabilityBadge.errorCount > 0 ? (
                      <span className="rounded-full bg-red-500/30 px-1 text-[9px] text-red-400">
                        {playabilityBadge.errorCount}
                      </span>
                    ) : undefined
                  }
                />
              )}
              {viewMode === "body" && (
                <ToggleBtn
                  active={showEducational}
                  onClick={() => setShowEducational((v) => !v)}
                  color="amber"
                  label="Éducatif"
                />
              )}
              {project && (
                <ToggleBtn
                  active={showEnergyTimeline}
                  onClick={() => setShowEnergyTimeline(!showEnergyTimeline)}
                  color="orange"
                  label="Energy"
                />
              )}
            </div>

            {/* View switcher — pushed to right */}
            <div className="ml-auto shrink-0">
              <ViewSwitcher value={viewMode} onChange={setViewMode} />
            </div>
          </div>

          {/* ── Heatmap + Sound expanded controls ── */}
          {project && (heatmap.enabled || preview.enabled) && (
            <HeatmapControls
              heatmapEnabled={heatmap.enabled}
              sensitivity={heatmap.sensitivity}
              stats={velocityStats}
              previewEnabled={preview.enabled}
              previewVolume={preview.volume}
              onSensitivity={(v) => setHeatmap({ sensitivity: v })}
              onPreviewVolume={(v) => setPreview({ volume: v })}
            />
          )}

          {/* ── Energy Timeline ── */}
          {project && rhythm && showEnergyTimeline && energyFlow && energyFlow.measures.length > 0 && (
            <EnergyTimeline
              energyFlow={energyFlow}
              sections={sections}
              activeTick={activeTick}
              totalMeasures={rhythm.measures.length}
              ppq={project.ppq}
              timeSignature={project.timeSignature}
              onSeekToMeasure={(m) => {
                const ticksPerMeasure = project.ppq * project.timeSignature.numerator;
                void seekTo(m * ticksPerMeasure);
              }}
            />
          )}

          {/* ── Score view extras ── */}
          {project && rhythm && isScoreView && (
            <>
              {showSectionTimeline && sections.length > 0 && (
                <SectionTimeline
                  sections={sections}
                  playabilityMap={showPlayabilityOverlay ? playabilityMap : {}}
                  totalMeasures={rhythm.measures.length}
                  onSeekToMeasure={(m) => {
                    const ticksPerMeasure = project.ppq * project.timeSignature.numerator;
                    void seekTo(m * ticksPerMeasure);
                  }}
                />
              )}
              <IsolationPanel />
            </>
          )}

          {/* ── Main view ── */}
          {project && rhythm ? (
            isScoreView ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <ScoreCanvas
                  rhythm={rhythm}
                  ppq={project.ppq}
                  signature={project.timeSignature}
                  activeTick={activeTick}
                  zoomX={zoomX}
                  zoomY={zoomY}
                  heatmap={heatmap}
                  cleanup={cleanup}
                  previewEnabled={preview.enabled}
                  hits={project.hits}
                  limbMap={limbMap}
                  showLimbAnalysis={showLimbAnalysis}
                  playabilityMap={playabilityMap}
                  showPlayabilityOverlay={showPlayabilityOverlay}
                  sections={sections}
                  showSectionTimeline={showSectionTimeline}
                />
                {showLimbAnalysis && (
                  <LimbLegend limbMap={limbMap} limbMode={limbMode} onModeChange={setLimbMode} />
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="relative flex-1 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/90 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                <DrumGrid
                  project={project}
                  quantizeGrid={quantizeOptions.grid}
                  activeTick={activeTick}
                  heatmap={heatmap}
                  previewEnabled={preview.enabled}
                  onAddHit={addHit}
                  onRemoveHit={removeHit}
                  onMoveHit={moveHit}
                  onSetVelocity={setHitVelocity}
                />
              </div>
            ) : viewMode === "drummer" ? (
              <DrummerView
                project={project}
                quantizedHits={quantizedHits}
                quantizeGrid={quantizeOptions.grid}
                isPlaying={isPlaying}
                zoomX={zoomX}
                heatmap={heatmap}
                previewEnabled={preview.enabled}
              />
            ) : viewMode === "body" ? (
              <DrummerVisualizer showEducationalMode={showEducational} />
            ) : (
              <DrumAnimationView
                project={project}
                quantizedHits={quantizedHits}
                quantizeGrid={quantizeOptions.grid}
                isPlaying={isPlaying}
              />
            )
          ) : (
            /* ── Empty state ── */
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50">
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60">
                  <svg width="28" height="28" viewBox="0 0 36 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-40">
                    <circle cx="18" cy="19" r="9" stroke="#71717a" strokeWidth="2" fill="none" />
                    <circle cx="18" cy="19" r="5" stroke="#71717a" strokeWidth="1.2" fill="none" />
                    <ellipse cx="9" cy="13" rx="4.5" ry="2.2" stroke="#71717a" strokeWidth="1.8" fill="none" />
                    <ellipse cx="6.5" cy="3.5" rx="4" ry="1.3" stroke="#71717a" strokeWidth="1.5" fill="none" />
                    <line x1="6.5" y1="4" x2="6.5" y2="10.5" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300">Dépose ton fichier MIDI ici</p>
                  <p className="mt-1 text-xs text-zinc-600">ou utilise Import MIDI dans la barre de menu</p>
                </div>
                <button
                  type="button"
                  onClick={() => { newProject(); setViewMode("grid"); }}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-700"
                >
                  + Nouveau projet vide
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Side panels ── */}
        {showHumanizePanel && (
          <div className="ml-3 shrink-0">
            <HumanizePanel onClose={() => setShowHumanizePanel(false)} />
          </div>
        )}
        {showMetronome && (
          <div className="ml-3 shrink-0">
            <MetronomePanel onClose={() => setShowMetronome(false)} />
          </div>
        )}
        {showMixerPanel && (
          <div className="ml-3 shrink-0">
            <DrumMixer onClose={() => setShowMixerPanel(false)} />
          </div>
        )}
        {showKitBalance && (
          <div className="ml-3 shrink-0">
            <KitBalancePanel onClose={() => setShowKitBalance(false)} />
          </div>
        )}
        {showAiPanel && (
          <div className="ml-3 shrink-0">
            <AiPanel onClose={() => setShowAiPanel(false)} />
          </div>
        )}

        {!focusMode && (
          <RightPanel
            message={message}
            hitCount={project?.hits.length ?? 0}
            tempo={project?.tempoBpm ?? 120}
            signature={signatureText}
            hasSelection={selectedHitId !== null}
            selectedHitId={selectedHitId}
            editableHits={editableHits}
            onSelectHit={setSelectedHitId}
            onNudgeSelected={(delta) => { if (selectedHitId) moveHit(selectedHitId, delta); }}
            onDeleteSelected={() => {
              if (!selectedHitId) return;
              removeHit(selectedHitId);
              setSelectedHitId(null);
            }}
          />
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950/80 px-4 py-1 text-[10px] text-zinc-600">
        <span>Drumo — Drum Editor &amp; Groove Station</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: activeDrumKit.color }}
            />
            <span className="text-zinc-500">{activeDrumKit.name} Kit</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isPlaying ? "bg-blue-400 animate-pulse" : "bg-zinc-700"}`} />
            {isPlaying ? "Playing" : "Stopped"} · Offline · AudioContext
          </span>
        </span>
      </footer>
    </main>
  );
};
