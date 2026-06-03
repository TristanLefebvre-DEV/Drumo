/**
 * Compose Page — v2
 *
 * Primary creative workspace. Transport bar is now at app-shell level.
 * Toolbar is reorganised into labelled groups with consistent spacing.
 * Right inspector is always visible; optional panels slide in beside it.
 */

import { useEffect, useMemo, useState } from "react";
import { ScoreCanvas }       from "../components/ScoreCanvas";
import { DrumGrid }          from "../components/DrumGrid";
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
import { EnergyTimeline }    from "../components/EnergyTimeline";
import { useProjectStore }   from "../../store/projectStore";
import { analyzeVelocity }   from "../../render/velocityAnalyzer";
import { LIMB_COLOR, computeLimbStats, crossoverCount, avgConfidence } from "../../analysis/limbAnalyzer";
import { summarizePlayability } from "../../analysis/playabilityEngine";
import type { QuantizeGrid }    from "../../core/types";

// ─── Toolbar primitives ───────────────────────────────────────────────────────

/** Compact toolbar button — active state is white-bg only, never coloured. */
const Btn = ({
  active = false,
  onClick,
  children,
  danger = false,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  title?: string;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      padding: "3px 9px",
      borderRadius: 5,
      fontSize: 11,
      fontWeight: active ? 600 : 400,
      background:   danger  ? "rgba(255,69,58,0.12)"
                  : active  ? "var(--sel-bg)"
                  : "transparent",
      color:        danger  ? "var(--c-red)"
                  : active  ? "var(--tx-1)"
                  : "var(--tx-3)",
      border: `1px solid ${
        danger  ? "rgba(255,69,58,0.20)" :
        active  ? "var(--sel-border)" :
        "transparent"
      }`,
      cursor: "pointer",
      transition: "background 0.12s, color 0.12s, border-color 0.12s",
      whiteSpace: "nowrap" as const,
    }}
  >
    {children}
  </button>
);

/** Thin vertical separator in toolbar. */
const Sep = () => (
  <div style={{ width: 1, height: 14, flexShrink: 0, background: "var(--sep)", margin: "0 2px" }} />
);

/** Tiny uppercase group label. */
const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <span style={{
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--tx-4)",
    userSelect: "none",
    flexShrink: 0,
  }}>
    {children}
  </span>
);

// ─── View mode switcher ───────────────────────────────────────────────────────

type ViewMode = "score" | "grid" | "drummer" | "animation" | "body";

const VIEW_CONFIG: { id: ViewMode; label: string }[] = [
  { id: "score",     label: "Partition" },
  { id: "grid",      label: "Grille"   },
  { id: "drummer",   label: "Batteur"  },
  { id: "animation", label: "Anim"     },
  { id: "body",      label: "Corps"    },
];

const ViewSwitcher = ({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) => (
  <div style={{
    display: "flex",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 7,
    padding: 2,
    gap: 1,
    flexShrink: 0,
  }}>
    {VIEW_CONFIG.map(({ id, label }) => (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        style={{
          padding: "3px 10px",
          borderRadius: 5,
          fontSize: 11,
          fontWeight: value === id ? 600 : 400,
          background:   value === id ? "rgba(255,255,255,0.08)" : "transparent",
          color:        value === id ? "var(--tx-1)" : "var(--tx-3)",
          border:       value === id ? "1px solid rgba(255,255,255,0.10)" : "1px solid transparent",
          cursor: "pointer",
          transition: "all 0.12s",
        }}
      >
        {label}
      </button>
    ))}
  </div>
);

// ─── Limb legend ──────────────────────────────────────────────────────────────

const LimbLegend = ({
  limbMap, limbMode, onModeChange,
}: {
  limbMap:    import("../../analysis/limbAnalyzer").LimbMap;
  limbMode:   import("../../analysis/limbAnalyzer").StickingMode;
  onModeChange: (m: import("../../analysis/limbAnalyzer").StickingMode) => void;
}) => {
  const stats  = computeLimbStats(limbMap);
  const xovers = crossoverCount(limbMap);
  const conf   = avgConfidence(limbMap);
  const LABELS = { RH: "M.Droite", LH: "M.Gauche", RF: "P.Droit", LF: "P.Gauche" } as const;

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap" as const,
      alignItems: "center",
      gap: 10,
      padding: "6px 12px",
      background: "var(--bg-2)",
      borderRadius: 8,
      fontSize: 11,
      border: "1px solid var(--sep)",
      flexShrink: 0,
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
          style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 10, cursor: "pointer",
            fontWeight: limbMode === m ? 600 : 400,
            background: limbMode === m ? "var(--sel-bg)" : "transparent",
            color:      limbMode === m ? "var(--tx-1)"  : "var(--tx-3)",
            border:     limbMode === m ? "1px solid var(--sel-border)" : "1px solid transparent",
            transition: "all 0.1s",
          }}
        >{m}</button>
      ))}
    </div>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = ({ onImport, onNew }: { onImport: () => void; onNew: () => void }) => (
  <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
    <div style={{ textAlign: "center", maxWidth: 340 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18, margin: "0 auto 20px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-3)", border: "1px solid var(--sep)",
      }}>
        <svg width="28" height="24" viewBox="0 0 36 30" fill="none" opacity="0.35">
          <circle cx="18" cy="19" r="9" stroke="var(--tx-2)" strokeWidth="2" fill="none"/>
          <circle cx="18" cy="19" r="5" stroke="var(--tx-2)" strokeWidth="1.2" fill="none"/>
          <ellipse cx="9" cy="13" rx="4.5" ry="2.2" stroke="var(--tx-2)" strokeWidth="1.8" fill="none"/>
          <ellipse cx="27" cy="3.5" rx="4" ry="1.3" stroke="var(--tx-2)" strokeWidth="1.5" fill="none"/>
          <line x1="18" y1="10" x2="27" y2="4" stroke="var(--tx-2)" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="18" y1="10" x2="9"  y2="4" stroke="var(--tx-2)" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-1)", margin: "0 0 8px" }}>
        Prêt à composer
      </p>
      <p style={{ fontSize: 12, color: "var(--tx-3)", margin: "0 0 24px", lineHeight: 1.6 }}>
        Déposez un fichier MIDI ici, ou importez depuis la barre supérieure.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          type="button"
          onClick={onImport}
          style={{
            padding: "9px 20px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: "rgba(255,255,255,0.09)", color: "var(--tx-1)",
            border: "1px solid rgba(255,255,255,0.14)", transition: "background 0.12s",
          }}
        >
          Importer MIDI
        </button>
        <button
          type="button"
          onClick={onNew}
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

// ─── Inspector stat cell ──────────────────────────────────────────────────────

const StatCell = ({ label, value }: { label: string; value: string | number }) => (
  <div style={{
    padding: "7px 8px",
    borderRadius: 7,
    background: "var(--bg-2)",
    border: "1px solid var(--sep)",
  }}>
    <p style={{
      fontSize: 9,
      textTransform: "uppercase" as const,
      letterSpacing: "0.07em",
      color: "var(--tx-4)",
      margin: "0 0 2px",
    }}>{label}</p>
    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-1)", margin: 0, fontFamily: "monospace" }}>
      {value}
    </p>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface ComposePageProps { onImportMidi: () => void; }

export const ComposePage = ({ onImportMidi }: ComposePageProps) => {

  // ── Local UI state ────────────────────────────────────────────────────────
  const [selectedHitId,  setSelectedHitId] = useState<string | null>(null);
  const [viewMode,       setViewMode]      = useState<ViewMode>("score");
  const [showAiPanel,    setShowAiPanel]   = useState(false);
  const [showKitBalance, setShowKitBalance]= useState(false);
  const [showMixer,      setShowMixer]     = useState(false);
  const [showMetronome,  setShowMetronome] = useState(false);
  const [showHumanize,   setShowHumanize]  = useState(false);
  const [showEdu,        setShowEdu]       = useState(false);

  // ── Store ─────────────────────────────────────────────────────────────────
  const {
    project, rhythm, quantizeOptions, zoomX, zoomY, activeTick, message,
    setGrid, setPreserveGroove, setZoomX, setZoomY,
    stop, rewindToStart, moveHit, removeHit, addHit, setHitVelocity,
    newProject, togglePlayback,
    heatmap, setHeatmap, preview, setPreview, cleanup, setCleanup,
    quantizedHits, isPlaying,
    limbMap, limbMode, showLimbAnalysis, setLimbMode, setShowLimbAnalysis,
    playabilityMap, showPlayabilityOverlay, setShowPlayabilityOverlay,
    sections, showSectionTimeline, setShowSectionTimeline,
    seekTo, activeDrumKit,
    energyFlow, showEnergyTimeline, setShowEnergyTimeline,
    humanize,
  } = useProjectStore();

  const velocityStats    = useMemo(() => analyzeVelocity(project?.hits ?? []), [project?.hits]);
  const signatureText    = `${project?.timeSignature.numerator ?? 4}/${project?.timeSignature.denominator ?? 4}`;
  const editableHits     = useMemo(
    () => (project?.hits ?? []).slice(0, 80).map((h) => ({ id: h.id, label: `${h.piece} @ ${h.tick}` })),
    [project?.hits]
  );
  const playabilityBadge = useMemo(() => summarizePlayability(playabilityMap), [playabilityMap]);
  const isScoreView      = viewMode === "score";

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
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

      {/* ── Toolbar ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap" as const,
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderBottom: "1px solid var(--sep)",
          background: "var(--bg-1)",
          flexShrink: 0,
        }}
      >
        {/* ── Group: Edit ── */}
        <GroupLabel>Edit</GroupLabel>
        <select
          value={quantizeOptions.grid}
          onChange={(e) => setGrid(e.target.value as QuantizeGrid)}
          style={{
            padding: "3px 6px", borderRadius: 5, fontSize: 11,
            background: "var(--bg-3)", color: "var(--tx-2)",
            border: "1px solid var(--sep)", cursor: "pointer",
          }}
        >
          {["1/4","1/8","1/16","1/32","8T","16T"].map((v) => <option key={v}>{v}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={quantizeOptions.preserveGroove}
            onChange={(e) => setPreserveGroove(e.target.checked)}
            style={{ width: 11, height: 11, accentColor: "var(--accent)", cursor: "pointer" }}
          />
          <span style={{ fontSize: 11, color: "var(--tx-3)" }}>Groove</span>
        </label>

        <Sep />

        {/* ── Group: Zoom ── */}
        <GroupLabel>Zoom</GroupLabel>
        {(["X","Y"] as const).map((axis) => {
          const val  = axis === "X" ? zoomX : zoomY;
          const setVal = axis === "X" ? setZoomX : setZoomY;
          return (
            <label key={axis} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: "var(--tx-4)", width: 8 }}>{axis}</span>
              <input
                type="range" min={0.7} max={2} step={0.1} value={val}
                onChange={(e) => setVal(Number(e.target.value))}
                style={{ width: 52, accentColor: "var(--tx-3)" }}
              />
              <span style={{ fontSize: 10, color: "var(--tx-3)", width: 28, textAlign: "right", fontFamily: "monospace" }}>
                {Math.round(val * 100)}%
              </span>
            </label>
          );
        })}

        <Sep />

        {/* ── Group: Kit ── */}
        <GroupLabel>Kit</GroupLabel>
        <DrumKitSelector />

        <Sep />

        {/* ── Group: View ── */}
        <GroupLabel>Vue</GroupLabel>
        <ViewSwitcher value={viewMode} onChange={setViewMode} />

        <Sep />

        {/* ── Group: Overlays ── */}
        <GroupLabel>Affichage</GroupLabel>
        <Btn active={heatmap.enabled} onClick={() => setHeatmap({ enabled: !heatmap.enabled })}>Chaleur</Btn>
        <Btn active={preview.enabled} onClick={() => setPreview({ enabled: !preview.enabled })}>Son</Btn>
        {isScoreView && project && (
          <Btn active={cleanup.enabled} onClick={() => setCleanup({ enabled: !cleanup.enabled })}>Nettoyer</Btn>
        )}

        {/* Score-only analysis */}
        {isScoreView && project && (<>
          <Btn active={showLimbAnalysis} onClick={() => setShowLimbAnalysis(!showLimbAnalysis)}>Membres</Btn>
          <Btn active={showSectionTimeline} onClick={() => setShowSectionTimeline(!showSectionTimeline)}>Sections</Btn>
          <Btn
            active={showPlayabilityOverlay}
            onClick={() => setShowPlayabilityOverlay(!showPlayabilityOverlay)}
          >
            Jouabilité
            {playabilityBadge.errorCount > 0 && (
              <span style={{
                marginLeft: 4, padding: "0 4px", borderRadius: 9, fontSize: 9, fontWeight: 700,
                background: "rgba(255,69,58,0.18)", color: "var(--c-red)",
              }}>
                {playabilityBadge.errorCount}
              </span>
            )}
          </Btn>
        </>)}
        {project && <Btn active={showEnergyTimeline} onClick={() => setShowEnergyTimeline(!showEnergyTimeline)}>Énergie</Btn>}
        {viewMode === "body" && <Btn active={showEdu} onClick={() => setShowEdu((v) => !v)}>Tutoriel</Btn>}

        <Sep />

        {/* ── Group: Panels ── */}
        <GroupLabel>Panneaux</GroupLabel>
        <Btn active={showAiPanel}    onClick={() => setShowAiPanel((v) => !v)}>AI</Btn>
        <Btn active={showHumanize}   onClick={() => setShowHumanize((v) => !v)}>
          Humaniser{humanize.enabled ? " ●" : ""}
        </Btn>
        <Btn active={showMixer}      onClick={() => setShowMixer((v) => !v)}>Mixeur</Btn>
        <Btn active={showMetronome}  onClick={() => setShowMetronome((v) => !v)}>Métro</Btn>
        {project && <Btn active={showKitBalance} onClick={() => setShowKitBalance((v) => !v)}>Balance</Btn>}

        {/* Context: hit selected */}
        {selectedHitId && (<>
          <Sep />
          <GroupLabel>Note</GroupLabel>
          <Btn onClick={() => moveHit(selectedHitId, -24)}>← Tick</Btn>
          <Btn onClick={() => moveHit(selectedHitId,  24)}>Tick →</Btn>
          <Btn danger onClick={() => { removeHit(selectedHitId); setSelectedHitId(null); }}>Supprimer</Btn>
        </>)}
      </div>

      {/* ── Energy timeline ── */}
      {project && rhythm && showEnergyTimeline && energyFlow && energyFlow.measures.length > 0 && (
        <div style={{ flexShrink: 0, padding: "4px 12px", borderBottom: "1px solid var(--sep)", background: "var(--bg-1)" }}>
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
        <div style={{ flexShrink: 0, borderBottom: "1px solid var(--sep)", background: "var(--bg-1)" }}>
          <HeatmapControls
            heatmapEnabled={heatmap.enabled} sensitivity={heatmap.sensitivity}
            stats={velocityStats} previewEnabled={preview.enabled} previewVolume={preview.volume}
            onSensitivity={(v) => setHeatmap({ sensitivity: v })}
            onPreviewVolume={(v) => setPreview({ volume: v })}
          />
        </div>
      )}

      {/* ── Score extras (section map, isolation) ── */}
      {project && rhythm && isScoreView && (
        <div style={{ flexShrink: 0, background: "var(--bg-1)" }}>
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
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", padding: 8, gap: 8 }}>
          {project && rhythm ? (
            isScoreView ? (
              <>
                <ScoreCanvas
                  rhythm={rhythm} ppq={project.ppq} signature={project.timeSignature}
                  activeTick={activeTick} zoomX={zoomX} zoomY={zoomY}
                  heatmap={heatmap} cleanup={cleanup} previewEnabled={preview.enabled}
                  hits={project.hits} limbMap={limbMap} showLimbAnalysis={showLimbAnalysis}
                  playabilityMap={playabilityMap} showPlayabilityOverlay={showPlayabilityOverlay}
                  sections={sections} showSectionTimeline={showSectionTimeline}
                />
                {showLimbAnalysis && (
                  <LimbLegend limbMap={limbMap} limbMode={limbMode} onModeChange={setLimbMode} />
                )}
              </>
            ) : viewMode === "grid" ? (
              <div style={{
                flex: 1, overflow: "auto", borderRadius: 8,
                background: "var(--bg-2)", border: "1px solid var(--sep)",
              }}>
                <DrumGrid
                  project={project} quantizeGrid={quantizeOptions.grid}
                  activeTick={activeTick} heatmap={heatmap} previewEnabled={preview.enabled}
                  onAddHit={addHit} onRemoveHit={removeHit} onMoveHit={moveHit} onSetVelocity={setHitVelocity}
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

        {/* ── Right side: optional panels + permanent inspector ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, overflow: "auto" }}>
          {showHumanize   && (
            <div className="slide-in-right" style={{ flexShrink: 0 }}>
              <HumanizePanel  onClose={() => setShowHumanize(false)} />
            </div>
          )}
          {showMetronome  && (
            <div className="slide-in-right" style={{ flexShrink: 0 }}>
              <MetronomePanel onClose={() => setShowMetronome(false)} />
            </div>
          )}
          {showMixer      && (
            <div className="slide-in-right" style={{ flexShrink: 0 }}>
              <DrumMixer      onClose={() => setShowMixer(false)} />
            </div>
          )}
          {showKitBalance && (
            <div className="slide-in-right" style={{ flexShrink: 0 }}>
              <KitBalancePanel onClose={() => setShowKitBalance(false)} />
            </div>
          )}
          {showAiPanel    && (
            <div className="slide-in-right" style={{ flexShrink: 0 }}>
              <AiPanel        onClose={() => setShowAiPanel(false)} />
            </div>
          )}

          {/* ── Permanent inspector ── */}
          <div style={{
            width: 216,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 12,
            overflow: "auto",
            borderLeft: "1px solid var(--sep)",
            background: "var(--bg-1)",
            flex: 1,
          }}>
            <p style={{
              fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const,
              letterSpacing: "0.09em", color: "var(--tx-4)", margin: 0,
            }}>
              Inspecteur
            </p>

            {/* Stats grid */}
            {project ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <StatCell label="Notes"  value={project.hits.length} />
                <StatCell label="BPM"    value={project.tempoBpm.toFixed(0)} />
                <StatCell label="Sig"    value={signatureText} />
                <StatCell label="Kit"    value={activeDrumKit.name} />
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "var(--tx-4)", margin: 0 }}>Aucun projet chargé</p>
            )}

            {/* System message */}
            {message && (
              <p style={{ fontSize: 11, color: "var(--tx-3)", lineHeight: 1.5, margin: 0 }}>{message}</p>
            )}

            {/* Kit indicator */}
            {project && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px", borderRadius: 7,
                background: "var(--bg-2)", border: "1px solid var(--sep)",
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  backgroundColor: activeDrumKit.color, flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: "var(--tx-2)", fontWeight: 500 }}>
                  {activeDrumKit.name}
                </span>
                {isPlaying && (
                  <span
                    className="play-dot"
                    style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-green)", marginLeft: "auto" }}
                  />
                )}
              </div>
            )}

            {/* Editable hit list */}
            {editableHits.length > 0 && (
              <div>
                <p style={{
                  fontSize: 9, textTransform: "uppercase" as const,
                  letterSpacing: "0.08em", color: "var(--tx-4)", margin: "0 0 6px",
                }}>
                  Notes
                </p>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {editableHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => setSelectedHitId(hit.id)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "3px 6px", borderRadius: 4, marginBottom: 1,
                        fontSize: 10, cursor: "pointer", transition: "all 0.1s",
                        background:   selectedHitId === hit.id ? "var(--sel-bg)"    : "transparent",
                        color:        selectedHitId === hit.id ? "var(--tx-1)"      : "var(--tx-3)",
                        border:       selectedHitId === hit.id ? "1px solid var(--sel-border)" : "1px solid transparent",
                      }}
                    >
                      {hit.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
