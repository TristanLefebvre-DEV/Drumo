/**
 * Compose Page — v4
 *
 * Layout inspiré de l'image de référence :
 *  - Toolbar fine (Grid + Groove + contextuel)
 *  - Tab bar : Partition | Vue Batteur | MIDI | Mixeur | Corps
 *  - Zone centrale : vue principale (score prend tout l'espace)
 *  - PropertiesPanel droit (Propriétés | Piste)
 *  - Panneaux flottants (Humanize, Metronome, Balance) via Outils
 */

import { useEffect, useMemo, useState } from "react";
import { DrumGrid }          from "../components/DrumGrid";
import { MuseScorePanel }    from "../components/MuseScorePanel";
import { DrummerView }       from "../components/DrummerView";
import { DrumAnimationView } from "../components/DrumAnimationView";
import { DrummerVisualizer } from "../components/DrummerVisualizer";
import { HeatmapControls }   from "../components/HeatmapControls";
import { AiPanel }           from "../components/AiPanel";
import { KitBalancePanel }   from "../components/KitBalancePanel";
import { SectionTimeline }   from "../components/SectionTimeline";
import { IsolationPanel }    from "../components/IsolationPanel";
import { DrumKitSelector }   from "../components/DrumKitSelector";
import { DrumMixer }         from "../components/DrumMixer";
import { MetronomePanel }    from "../components/MetronomePanel";
import { HumanizePanel }     from "../components/HumanizePanel";
import { FloatingPanel }    from "../components/FloatingPanel";
import { EnergyTimeline }    from "../components/EnergyTimeline";
import { PropertiesPanel }   from "../components/PropertiesPanel";
import { useProjectStore }   from "../../store/projectStore";
import { useUiStore }        from "../../store/uiStore";
import { analyzeVelocity }   from "../../render/velocityAnalyzer";
import { LIMB_COLOR, computeLimbStats, crossoverCount, avgConfidence } from "../../analysis/limbAnalyzer";
import { summarizePlayability } from "../../analysis/playabilityEngine";
import type { QuantizeGrid, DrumPiece } from "../../core/types";

// ─── View modes ───────────────────────────────────────────────────────────────

type ViewMode = "score" | "grid" | "drummer" | "animation" | "body";

// Tab bar configuration (référence image)
const VIEW_TABS: { id: ViewMode; label: string }[] = [
  { id: "score",     label: "Partition"   },
  { id: "drummer",   label: "Vue Batteur" },
  { id: "grid",      label: "MIDI"        },
  { id: "animation", label: "Animation"   },
  { id: "body",      label: "Corps"       },
];

// ─── Shared primitives ────────────────────────────────────────────────────────

const Sep = () => (
  <div style={{ width: 1, height: 14, flexShrink: 0, background: "var(--sep)", margin: "0 3px" }} />
);

// ─── Limb legend ──────────────────────────────────────────────────────────────

const LimbLegend = ({
  limbMap, limbMode, onModeChange,
}: {
  limbMap:      import("../../analysis/limbAnalyzer").LimbMap;
  limbMode:     import("../../analysis/limbAnalyzer").StickingMode;
  onModeChange: (m: import("../../analysis/limbAnalyzer").StickingMode) => void;
}) => {
  const stats  = computeLimbStats(limbMap);
  const xovers = crossoverCount(limbMap);
  const conf   = avgConfidence(limbMap);
  const LABELS = { RH: "M.Droite", LH: "M.Gauche", RF: "P.Droit", LF: "P.Gauche" } as const;
  return (
    <div style={{
      display: "flex", flexWrap: "wrap" as const, alignItems: "center",
      gap: 10, padding: "6px 12px",
      background: "var(--bg-2)", borderRadius: 8, fontSize: 11,
      border: "1px solid var(--sep)", flexShrink: 0,
    }}>
      {(["RH","LH","RF","LF"] as const).map((l) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 24, height: 18, borderRadius: 4, fontSize: 9, fontWeight: 700, color: "#fff",
            backgroundColor: LIMB_COLOR[l].hex,
          }}>{l}</span>
          <span style={{ color: "var(--tx-2)" }}>{LABELS[l]}</span>
          <span style={{
            padding: "0 4px", borderRadius: 4, fontFamily: "monospace",
            background: "var(--bg-3)", color: "var(--tx-3)", fontSize: 10,
          }}>{stats[l]}</span>
        </div>
      ))}
      <Sep />
      <span style={{ color: "var(--tx-3)" }}>
        Croisements <span style={{ fontFamily: "monospace", color: "var(--c-yellow)" }}>{xovers}</span>
      </span>
      <span style={{ color: "var(--tx-3)" }}>
        Conf. <span style={{ fontFamily: "monospace", color: "var(--c-green)" }}>{Math.round(conf * 100)}%</span>
      </span>
      <Sep />
      {(["strict","human","advanced"] as const).map((m) => (
        <button key={m} type="button" onClick={() => onModeChange(m)}
          className={`tb-btn${limbMode === m ? " active" : ""}`}
          style={{ fontSize: 10 }}
        >{{ strict: "Strict", human: "Humain", advanced: "Avancé" }[m]}</button>
      ))}
    </div>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = ({ onImport, onNew }: { onImport: () => void; onNew: () => void }) => (
  <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
    <div style={{ textAlign: "center", maxWidth: 320 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18, margin: "0 auto 20px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-3)", border: "1px solid var(--sep)",
      }}>
        <svg width="28" height="24" viewBox="0 0 36 30" fill="none" opacity="0.28">
          <circle cx="18" cy="19" r="9" stroke="var(--tx-2)" strokeWidth="2" fill="none"/>
          <circle cx="18" cy="19" r="5" stroke="var(--tx-2)" strokeWidth="1.2" fill="none"/>
          <ellipse cx="9" cy="13" rx="4.5" ry="2.2" stroke="var(--tx-2)" strokeWidth="1.8" fill="none"/>
          <ellipse cx="27" cy="3.5" rx="4" ry="1.3" stroke="var(--tx-2)" strokeWidth="1.5" fill="none"/>
          <line x1="18" y1="10" x2="27" y2="4" stroke="var(--tx-2)" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="18" y1="10" x2="9"  y2="4" stroke="var(--tx-2)" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-1)", margin: "0 0 6px" }}>
        Prêt à composer
      </p>
      <p style={{ fontSize: 12, color: "var(--tx-3)", margin: "0 0 24px", lineHeight: 1.65 }}>
        Déposez un fichier MIDI ici, ou importez depuis la barre supérieure.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          type="button" onClick={onImport}
          style={{
            padding: "9px 20px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: "var(--accent)", color: "#fff",
            border: "none", transition: "opacity 0.12s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          Importer MIDI
        </button>
        <button
          type="button" onClick={onNew}
          style={{
            padding: "9px 20px", borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: "pointer",
            background: "transparent", color: "var(--tx-3)",
            border: "1px solid var(--sep)", transition: "background 0.12s",
          }}
        >
          Nouveau projet
        </button>
      </div>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface ComposePageProps { onImportMidi: () => void; }

export const ComposePage = ({ onImportMidi }: ComposePageProps) => {

  // ── Local UI state ────────────────────────────────────────────────────────
  const [selectedHitId, setSelectedHitId] = useState<string | null>(null);
  const [viewMode,      setViewMode]      = useState<ViewMode>("score");
  const [showEdu,       setShowEdu]       = useState(false);

  // Panneaux flottants — état partagé avec AppMenuBar via uiStore
  const {
    showHumanize, showMixer, showMetronome, showKitBalance, showAiPanel,
    openPanel, closePanel,
  } = useUiStore();

  const setShowHumanize   = (v: boolean) => v ? openPanel("humanize")   : closePanel("humanize");
  const setShowMixer      = (v: boolean) => v ? openPanel("mixer")       : closePanel("mixer");
  const setShowKitBalance = (v: boolean) => v ? openPanel("balance")     : closePanel("balance");
  const setShowAiPanel    = (v: boolean) => v ? openPanel("ai")          : closePanel("ai");

  // ── Store ─────────────────────────────────────────────────────────────────
  const {
    project, rhythm, quantizeOptions, zoomX, activeTick,
    setGrid, setPreserveGroove, setZoomX,
    stop, rewindToStart, moveHit, removeHit, addHit, setHitVelocity, setHitDuration, pasteHits,
    setHitType, setHitProbability, toggleHitMute, undo, redo,
    newProject, togglePlayback,
    heatmap, setHeatmap, preview, setPreview,
    quantizedHits, isPlaying,
    limbMap, limbMode, showLimbAnalysis, setLimbMode, setShowLimbAnalysis,
    playabilityMap, showPlayabilityOverlay, setShowPlayabilityOverlay,
    sections, showSectionTimeline, setShowSectionTimeline,
    seekTo,
    energyFlow, showEnergyTimeline, setShowEnergyTimeline,
    humanize,
  } = useProjectStore();

  const velocityStats    = useMemo(() => analyzeVelocity(project?.hits ?? []), [project?.hits]);
  const playabilityBadge = useMemo(() => summarizePlayability(playabilityMap), [playabilityMap]);
  const isScoreView      = viewMode === "score";

  // Derive selected piece from selected hit id
  const selectedPiece = useMemo((): DrumPiece | null => {
    if (!selectedHitId || !project) return null;
    return project.hits.find((h) => h.id === selectedHitId)?.piece ?? null;
  }, [selectedHitId, project]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (e.code === "Space")  { e.preventDefault(); void togglePlayback(); }
      if (e.code === "Home")   { e.preventDefault(); rewindToStart(); }
      if (e.code === "Escape") { e.preventDefault(); stop(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlayback, rewindToStart, stop]);

  const seekMeasure = (m: number) =>
    void seekTo(m * (project?.ppq ?? 480) * (project?.timeSignature.numerator ?? 4));

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg-app)" }}>

      {/* ── Toolbar (minimal) ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 16px",
        borderBottom: "1px solid var(--sep)",
        background: "var(--bg-2)",
        flexShrink: 0,
        height: 44,
      }}>
        {/* Kit selector */}
        <div style={{ flexShrink: 0 }}>
          <DrumKitSelector />
        </div>

        <Sep />

        {/* Quantize grid */}
        <label style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "var(--tx-4)" }}>
            Grille
          </span>
          <select
            value={quantizeOptions.grid}
            onChange={(e) => setGrid(e.target.value as QuantizeGrid)}
            style={{
              padding: "3px 8px", borderRadius: 8, fontSize: 11.5,
              background: "var(--bg-1)", color: "var(--tx-2)",
              border: "1px solid var(--sep)", cursor: "pointer", outline: "none",
            }}
          >
            {["1/4","1/8","1/16","1/32","8T","16T"].map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>

        {/* Groove checkbox */}
        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={quantizeOptions.preserveGroove}
            onChange={(e) => setPreserveGroove(e.target.checked)}
            style={{ width: 11, height: 11, accentColor: "var(--accent)", cursor: "pointer" }}
          />
          <span style={{ fontSize: 11, color: "var(--tx-3)" }}>Groove</span>
        </label>

        <Sep />

        {/* Zoom X */}
        <label style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: "var(--tx-4)", width: 8 }}>X</span>
          <input
            type="range" min={0.7} max={2} step={0.1} value={zoomX}
            onChange={(e) => setZoomX(Number(e.target.value))}
            className="compact-range"
            style={{ width: 52 }}
          />
          <span style={{ fontSize: 10, color: "var(--tx-3)", width: 26, textAlign: "right", fontFamily: "monospace", flexShrink: 0 }}>
            {Math.round(zoomX * 100)}%
          </span>
        </label>

        {/* Outils + overlays — droite */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2 }}>
          {/* Overlays score (contextuel) */}
          {isScoreView && project && (<>
            <button className={`tb-btn${heatmap.enabled ? " active" : ""}`} type="button" onClick={() => setHeatmap({ enabled: !heatmap.enabled })}>Chaleur</button>
            <button className={`tb-btn${showLimbAnalysis ? " active" : ""}`} type="button" onClick={() => setShowLimbAnalysis(!showLimbAnalysis)}>Membres</button>
            <Sep />
          </>)}
          {/* Panneaux avancés */}
          <button className={`tb-btn${showHumanize ? " active" : ""}`} type="button" onClick={() => setShowHumanize(!showHumanize)}>
            Humaniser{humanize.enabled ? " ●" : ""}
          </button>
          <button className={`tb-btn${showMixer ? " active" : ""}`} type="button" onClick={() => setShowMixer(!showMixer)}>Mixeur</button>
          {project && <button className={`tb-btn${showKitBalance ? " active" : ""}`} type="button" onClick={() => setShowKitBalance(!showKitBalance)}>Balance</button>}
          <Sep />
          <button className={`tb-btn${showAiPanel ? " active" : ""}`} type="button" onClick={() => setShowAiPanel(!showAiPanel)}>IA</button>
          {viewMode === "body" && (
            <button className={`tb-btn${showEdu ? " active" : ""}`} type="button" onClick={() => setShowEdu((v) => !v)}>Tutoriel</button>
          )}
          {/* Édition note sélectionnée */}
          {selectedHitId && (<>
            <Sep />
            <button className="tb-btn" type="button" onClick={() => moveHit(selectedHitId, -24)}>← Tick</button>
            <button className="tb-btn" type="button" onClick={() => moveHit(selectedHitId,  24)}>Tick →</button>
            <button className="tb-btn danger" type="button" onClick={() => { removeHit(selectedHitId); setSelectedHitId(null); }}>Supprimer</button>
          </>)}
        </div>
      </div>

      {/* ── Tab bar vues (style référence) ── */}
      <div style={{
        display: "flex",
        alignItems: "stretch",
        borderBottom: "1px solid var(--sep)",
        background: "var(--bg-1)",
        flexShrink: 0,
        height: 42,
        padding: "0 12px",
        gap: 2,
      }}>
        {VIEW_TABS.map(({ id, label }) => {
          const active = viewMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              style={{
                height: "100%",
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12.5,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--tx-1)" : "var(--tx-3)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                transition: "color 0.12s, border-color 0.12s",
                marginBottom: "-1px",
                whiteSpace: "nowrap" as const,
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = "var(--tx-2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = active ? "var(--tx-1)" : "var(--tx-3)";
              }}
            >
              {label}
            </button>
          );
        })}

        {/* Right side: overlay quick toggles */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2 }}>
          {project && isScoreView && (<>
            <button className={`tb-btn${showSectionTimeline ? " active" : ""}`} type="button" style={{ fontSize: 10 }}
              onClick={() => setShowSectionTimeline(!showSectionTimeline)}>Sections</button>
            <button className={`tb-btn${showPlayabilityOverlay ? " active" : ""}`} type="button" style={{ fontSize: 10 }}
              onClick={() => setShowPlayabilityOverlay(!showPlayabilityOverlay)}>
              Jouabilité
              {playabilityBadge.errorCount > 0 && (
                <span style={{ marginLeft: 3, padding: "0 3px", borderRadius: 8, fontSize: 8, fontWeight: 700, background: "rgba(255,69,58,0.18)", color: "var(--c-red)" }}>
                  {playabilityBadge.errorCount}
                </span>
              )}
            </button>
            <button className={`tb-btn${showEnergyTimeline ? " active" : ""}`} type="button" style={{ fontSize: 10 }}
              onClick={() => setShowEnergyTimeline(!showEnergyTimeline)}>Énergie</button>
          </>)}
        </div>
      </div>

      {/* ── Energy timeline ── */}
      {project && rhythm && showEnergyTimeline && energyFlow && energyFlow.measures.length > 0 && (
        <div style={{ flexShrink: 0, padding: "6px 16px", borderBottom: "1px solid var(--sep)", background: "var(--bg-2)" }}>
          <EnergyTimeline
            energyFlow={energyFlow} sections={sections}
            activeTick={activeTick} totalMeasures={rhythm.measures.length}
            ppq={project.ppq} timeSignature={project.timeSignature}
            onSeekToMeasure={seekMeasure}
          />
        </div>
      )}

      {/* ── Heatmap controls ── */}
      {project && (heatmap.enabled || preview.enabled) && (
        <div style={{ flexShrink: 0, borderBottom: "1px solid var(--sep)", background: "var(--bg-2)" }}>
          <HeatmapControls
            heatmapEnabled={heatmap.enabled} sensitivity={heatmap.sensitivity}
            stats={velocityStats} previewEnabled={preview.enabled} previewVolume={preview.volume}
            onSensitivity={(v) => setHeatmap({ sensitivity: v })}
            onPreviewVolume={(v) => setPreview({ volume: v })}
          />
        </div>
      )}

      {/* ── Section timeline + isolation ── */}
      {project && rhythm && isScoreView && (
        <div style={{ flexShrink: 0, background: "var(--bg-2)" }}>
          {showSectionTimeline && sections.length > 0 && (
            <div style={{ padding: "4px 12px", borderBottom: "1px solid var(--sep)" }}>
              <SectionTimeline
                sections={sections} playabilityMap={showPlayabilityOverlay ? playabilityMap : {}}
                totalMeasures={rhythm.measures.length} onSeekToMeasure={seekMeasure}
              />
            </div>
          )}
          <IsolationPanel />
        </div>
      )}

      {/* ── Main content row ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

        {/* Primary view */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", padding: 14, gap: 12 }}>
          {project && rhythm ? (
            isScoreView ? (
              <>
                <MuseScorePanel project={project} />
                {showLimbAnalysis && (
                  <LimbLegend limbMap={limbMap} limbMode={limbMode} onModeChange={setLimbMode} />
                )}
              </>
            ) : viewMode === "grid" ? (
              <div style={{ flex: 1, overflow: "auto", borderRadius: 14, background: "var(--bg-2)", border: "1px solid var(--sep)", boxShadow: "var(--shadow-sm)" }}>
                <DrumGrid
                  project={project} quantizeGrid={quantizeOptions.grid}
                  activeTick={activeTick} heatmap={heatmap} previewEnabled={preview.enabled}
                  onAddHit={addHit} onRemoveHit={removeHit} onMoveHit={moveHit}
                  onSetVelocity={setHitVelocity} onSetDuration={setHitDuration}
                  onPasteHits={pasteHits}
                  onToggleMute={toggleHitMute}
                  onSetNoteType={setHitType}
                  onSetProbability={setHitProbability}
                  onUndo={undo}
                  onRedo={redo}
                />
              </div>
            ) : viewMode === "drummer" ? (
              <DrummerView
                project={project} quantizedHits={quantizedHits} quantizeGrid={quantizeOptions.grid}
                isPlaying={isPlaying} zoomX={zoomX} heatmap={heatmap} previewEnabled={preview.enabled}
              />
            ) : viewMode === "body" ? (
              <DrummerVisualizer showEducationalMode={showEdu} />
            ) : (
              <DrumAnimationView
                project={project} quantizedHits={quantizedHits}
                quantizeGrid={quantizeOptions.grid} isPlaying={isPlaying}
              />
            )
          ) : (
            <EmptyState
              onImport={onImportMidi}
              onNew={() => { newProject(); setViewMode("grid"); }}
            />
          )}
        </div>

        {/* ── Panneaux flottants (portals — flottent au-dessus de toute l'interface) ── */}
        {showHumanize  && <FloatingPanel id="humanize"  title="Humanisation"><HumanizePanel   onClose={() => closePanel("humanize")}  embedded /></FloatingPanel>}
        {showMetronome && <FloatingPanel id="metronome" title="Métronome"    ><MetronomePanel  embedded /></FloatingPanel>}
        {showMixer     && <FloatingPanel id="mixer"     title="Mixeur"       ><DrumMixer       onClose={() => closePanel("mixer")}     embedded /></FloatingPanel>}
        {showKitBalance && <FloatingPanel id="balance"  title="Kit Balance"  ><KitBalancePanel onClose={() => closePanel("balance")}  embedded /></FloatingPanel>}
        {showAiPanel   && <FloatingPanel id="ai"        title="Analyse IA"   ><AiPanel         onClose={() => closePanel("ai")}       embedded /></FloatingPanel>}

        {/* ── Properties Panel (right, permanent) ── */}
        <PropertiesPanel selectedPiece={selectedPiece} />
      </div>
    </div>
  );
};
