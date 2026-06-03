/**
 * Analyze Page — v2
 *
 * Dedicated analysis dashboard. All analysis tools visible at once,
 * no toggling. Transport is at app-shell level.
 *
 * Layout when project loaded:
 *   ┌─────────────────────────────────────────────┐
 *   │  Summary stats (8-column grid)              │
 *   ├─────────────────────────────────────────────┤
 *   │  Energy timeline (full width)               │
 *   │  Section map (full width)                   │
 *   ├────────────┬──────────────┬─────────────────┤
 *   │  Limbs     │  Ergonomics  │  Playability    │
 *   ├────────────┴──────────────┴─────────────────┤
 *   │  Body simulation (collapsible)              │
 *   └─────────────────────────────────────────────┘
 */

import { useMemo, useState } from "react";
import { useProjectStore }        from "../../store/projectStore";
import { EnergyTimeline }         from "../components/EnergyTimeline";
import { SectionTimeline }        from "../components/SectionTimeline";
import { DrummerVisualizer }      from "../components/DrummerVisualizer";
import { LIMB_COLOR, computeLimbStats, crossoverCount, avgConfidence } from "../../analysis/limbAnalyzer";
import { playabilityBadgeColor, summarizePlayability } from "../../analysis/playabilityEngine";
import { analyzeErgonomics }      from "../../simulation/ergonomicsEngine";
import { energyColor }            from "../../analysis/energyFlowAnalyzer";
import { detectMusicalSections, MUSICAL_ROLE_LABELS } from "../../analysis/sectionEnergyDetector";

// ─── Primitives ───────────────────────────────────────────────────────────────

const StatCard = ({
  label, value, sub, accentColor = "var(--tx-1)",
}: { label: string; value: string | number; sub?: string; accentColor?: string }) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    gap: 4,
    borderRadius: 10,
    padding: "10px 12px",
    background: "var(--bg-2)",
    border: "1px solid var(--sep-2)",
  }}>
    <span style={{
      fontSize: 9, fontWeight: 600,
      textTransform: "uppercase" as const, letterSpacing: "0.08em",
      color: "var(--tx-3)",
    }}>
      {label}
    </span>
    <span style={{
      fontSize: 20, fontWeight: 800, fontFamily: "monospace",
      fontVariantNumeric: "tabular-nums",
      color: accentColor,
    }}>
      {value}
    </span>
    {sub && <span style={{ fontSize: 10, color: "var(--tx-3)" }}>{sub}</span>}
  </div>
);

const SectionHead = ({ title }: { title: string }) => (
  <h2 style={{
    fontSize: 10, fontWeight: 700,
    textTransform: "uppercase" as const, letterSpacing: "0.11em",
    color: "var(--tx-3)", margin: "0 0 10px",
  }}>
    {title}
  </h2>
);

const AnalysisCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{
    borderRadius: 12,
    padding: 16,
    background: "var(--bg-1)",
    border: "1px solid var(--sep-2)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  }}>
    <SectionHead title={title} />
    {children}
  </div>
);

const GaugeBar = ({ value, max = 100, color }: { value: number; max?: number; color: string }) => (
  <div style={{ height: 5, width: "100%", borderRadius: 999, overflow: "hidden", background: "var(--bg-3)" }}>
    <div style={{
      height: "100%",
      borderRadius: 999,
      width: `${Math.min(100, (value / max) * 100)}%`,
      background: color,
      transition: "width 0.5s ease",
    }} />
  </div>
);

// ─── Empty state ──────────────────────────────────────────────────────────────

const AnalyzeEmpty = () => (
  <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
    <div style={{ textAlign: "center", maxWidth: 320 }}>
      <div style={{
        width: 56, height: 56, margin: "0 auto 16px",
        borderRadius: 16,
        background: "var(--bg-2)",
        border: "1px solid var(--sep-2)",
      }} />
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-2)", margin: "0 0 6px" }}>
        En attente d'analyse
      </p>
      <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0 }}>
        Charge un fichier MIDI dans <strong style={{ color: "var(--accent)" }}>Compose</strong> pour analyser le groove.
      </p>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const AnalyzePage = () => {
  const {
    project, rhythm, limbMap, limbMode, playabilityMap, sections,
    energyFlow, activeTick, seekTo,
  } = useProjectStore();

  const [showBodySim, setShowBodySim] = useState(true);

  const playabilitySummary = useMemo(() => summarizePlayability(playabilityMap), [playabilityMap]);
  const limbStats          = useMemo(() => computeLimbStats(limbMap),  [limbMap]);
  const xoverCount         = useMemo(() => crossoverCount(limbMap),    [limbMap]);
  const confAvg            = useMemo(() => avgConfidence(limbMap),     [limbMap]);

  const ergonomics = useMemo(() => {
    if (!project || Object.keys(limbMap).length === 0) return null;
    return analyzeErgonomics(project.hits, limbMap, project.ppq, project.tempoBpm);
  }, [project, limbMap]);

  const musicalSections = useMemo(
    () => detectMusicalSections(sections, energyFlow?.measures ?? []),
    [sections, energyFlow]
  );

  const energyAvg   = energyFlow?.avgScore   ?? 0;
  const energyTrend = energyFlow?.globalTrend ?? "steady";

  const TREND_LABELS: Record<string, string> = {
    rising: "↑ Rising", falling: "↓ Falling", steady: "→ Steady", dynamic: "⚡ Dynamic",
  };

  if (!project) return (
    <div style={{ height: "100%", background: "var(--bg-app)" }}>
      <AnalyzeEmpty />
    </div>
  );

  const seekMeasure = (m: number) =>
    void seekTo(m * project.ppq * project.timeSignature.numerator);

  return (
    <div
      className="fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflow: "auto",
        padding: 14,
        background: "var(--bg-app)",
        height: "100%",
      }}
    >
      {/* ── Summary stats bar ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
        gap: 8,
      }}>
        <StatCard label="Notes"      value={project.hits.length} />
        <StatCard label="BPM"        value={project.tempoBpm.toFixed(0)} />
        <StatCard
          label="Playability"
          value={playabilitySummary.overallScore}
          sub={`${playabilitySummary.errorCount} erreurs`}
          accentColor={playabilityBadgeColor(
            playabilitySummary.overallScore < 40 ? "ok"
            : playabilitySummary.overallScore < 70 ? "hard"
            : playabilitySummary.overallScore < 85 ? "very-hard"
            : "impossible"
          )}
        />
        <StatCard
          label="Énergie moy."
          value={energyAvg}
          sub={TREND_LABELS[energyTrend]}
          accentColor={energyColor(energyAvg)}
        />
        <StatCard
          label="Croisements"
          value={xoverCount}
          accentColor={xoverCount > 10 ? "var(--c-orange)" : "var(--tx-1)"}
        />
        <StatCard
          label="Confiance"
          value={`${Math.round(confAvg * 100)}%`}
          accentColor={confAvg >= 0.8 ? "var(--c-green)" : confAvg >= 0.6 ? "var(--c-yellow)" : "var(--c-red)"}
        />
        {ergonomics && (
          <StatCard
            label="Ergonomie"
            value={ergonomics.overallScore}
            sub={ergonomics.fatigueScore > 40 ? "Fatigue élevée" : ""}
            accentColor={ergonomics.overallScore >= 70 ? "var(--c-green)" : ergonomics.overallScore >= 40 ? "var(--c-yellow)" : "var(--c-red)"}
          />
        )}
        <StatCard
          label="Sections"
          value={sections.length}
          sub={`${musicalSections.filter(s => s.musicalRole === "chorus").length} refrain`}
        />
      </div>

      {/* ── Energy flow ── */}
      {energyFlow && energyFlow.measures.length > 0 && rhythm && (
        <div>
          <SectionHead title="Flux d'énergie" />
          <EnergyTimeline
            energyFlow={energyFlow}
            sections={sections}
            activeTick={activeTick}
            totalMeasures={rhythm.measures.length}
            ppq={project.ppq}
            timeSignature={project.timeSignature}
            onSeekToMeasure={seekMeasure}
          />
        </div>
      )}

      {/* ── Section map ── */}
      {sections.length > 0 && rhythm && (
        <div>
          <SectionHead title="Sections" />
          <SectionTimeline
            sections={sections}
            playabilityMap={playabilityMap}
            totalMeasures={rhythm.measures.length}
            onSeekToMeasure={seekMeasure}
          />
        </div>
      )}

      {/* ── Musical roles ── */}
      {musicalSections.length > 0 && (
        <div>
          <SectionHead title="Rôles musicaux" />
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
            {musicalSections.map((ms, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 8,
                  background: `${ms.color}15`, border: `1px solid ${ms.color}30`,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: ms.color }}>
                  {MUSICAL_ROLE_LABELS[ms.musicalRole]}
                </span>
                <span style={{ fontSize: 9, color: "var(--tx-3)" }}>
                  m.{ms.section.startMeasure + 1}–{ms.section.endMeasure + 1}
                </span>
                <span style={{
                  borderRadius: 4, padding: "1px 4px", fontSize: 9, fontFamily: "monospace",
                  background: "var(--bg-3)", color: energyColor(ms.avgEnergy),
                }}>
                  {ms.avgEnergy}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Three-column analysis ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 12,
      }}>

        {/* Col 1: Limb stats */}
        <AnalysisCard title="Analyse des membres">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(["RH","LH","RF","LF"] as const).map((l) => (
              <div key={l} style={{ borderRadius: 8, padding: 10, background: "var(--bg-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <span style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    height: 20, width: 28, borderRadius: 4,
                    fontSize: 9, fontWeight: 800, color: "#fff",
                    backgroundColor: LIMB_COLOR[l].hex,
                  }}>
                    {l}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--tx-2)" }}>
                    {{ RH: "M.Droite", LH: "M.Gauche", RF: "P.Droit", LF: "P.Gauche" }[l]}
                  </span>
                </div>
                <p style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800, margin: "0 0 2px", color: LIMB_COLOR[l].hex }}>
                  {limbStats[l]}
                </p>
                <p style={{ fontSize: 9, color: "var(--tx-3)", margin: 0 }}>
                  {limbStats.total > 0 ? `${Math.round(limbStats[l] / limbStats.total * 100)}%` : "0%"}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "var(--tx-3)" }}>Croisements de bras</span>
              <span style={{
                fontFamily: "monospace", fontWeight: 600,
                color: xoverCount > 10 ? "var(--c-yellow)" : "var(--tx-1)",
              }}>{xoverCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "var(--tx-3)" }}>Confiance moyenne</span>
              <span style={{
                fontFamily: "monospace", fontWeight: 600,
                color: confAvg >= 0.8 ? "var(--c-green)" : confAvg >= 0.6 ? "var(--c-yellow)" : "var(--c-red)",
              }}>{Math.round(confAvg * 100)}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "var(--tx-3)" }}>Mode sticking</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, textTransform: "capitalize" as const, color: "var(--accent)" }}>
                {limbMode}
              </span>
            </div>
          </div>
        </AnalysisCard>

        {/* Col 2: Ergonomics */}
        <AnalysisCard title="Ergonomie & Mouvement">
          {ergonomics ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                  <span style={{ color: "var(--tx-3)" }}>Score global</span>
                  <span style={{
                    fontFamily: "monospace", fontWeight: 700,
                    color: ergonomics.overallScore >= 70 ? "var(--c-green)" : ergonomics.overallScore >= 40 ? "var(--c-yellow)" : "var(--c-red)",
                  }}>{ergonomics.overallScore}/100</span>
                </div>
                <GaugeBar
                  value={ergonomics.overallScore}
                  color={ergonomics.overallScore >= 70 ? "var(--c-green)" : ergonomics.overallScore >= 40 ? "var(--c-yellow)" : "var(--c-red)"}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                  <span style={{ color: "var(--tx-3)" }}>Fatigue</span>
                  <span style={{
                    fontFamily: "monospace", fontWeight: 700,
                    color: ergonomics.fatigueScore < 30 ? "var(--c-green)" : ergonomics.fatigueScore < 60 ? "var(--c-yellow)" : "var(--c-red)",
                  }}>{ergonomics.fatigueScore}/100</span>
                </div>
                <GaugeBar
                  value={ergonomics.fatigueScore}
                  color={ergonomics.fatigueScore < 30 ? "var(--c-green)" : ergonomics.fatigueScore < 60 ? "var(--c-yellow)" : "var(--c-red)"}
                />
              </div>

              {(["RH","LH","RF","LF"] as const).map((l) => {
                const w = ergonomics.limbWorkloads[l];
                return (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
                    <span style={{
                      width: 24, borderRadius: 4, padding: "1px 4px", textAlign: "center",
                      fontSize: 9, fontWeight: 800, color: "#fff",
                      backgroundColor: LIMB_COLOR[l].hex,
                    }}>{l}</span>
                    <span style={{ color: "var(--tx-3)", width: 36 }}>{w.hitCount}×</span>
                    <div style={{ flex: 1, height: 4, overflow: "hidden", borderRadius: 999, background: "var(--bg-3)" }}>
                      <div style={{
                        height: "100%", borderRadius: 999,
                        width: `${Math.min(100, w.avgDistance * 10)}%`,
                        backgroundColor: LIMB_COLOR[l].hex + "99",
                      }} />
                    </div>
                    <span style={{ width: 36, textAlign: "right", fontFamily: "monospace", color: "var(--tx-3)" }}>
                      {w.avgDistance.toFixed(1)}u
                    </span>
                  </div>
                );
              })}

              <p style={{
                fontSize: 11, padding: "8px 10px", borderRadius: 8,
                background: "var(--bg-2)", color: "var(--tx-2)", margin: 0, lineHeight: 1.5,
              }}>
                {ergonomics.summary}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0 }}>
              Aucune donnée — analyse des membres indisponible.
            </p>
          )}
        </AnalysisCard>

        {/* Col 3: Playability */}
        <AnalysisCard title="Problèmes de jouabilité">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {playabilitySummary.errorCount > 0 && (
              <span style={{
                borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 700,
                background: "rgba(255,69,58,0.12)", color: "var(--c-red)",
              }}>
                {playabilitySummary.errorCount} erreurs
              </span>
            )}
          </div>

          {playabilitySummary.totalIssues === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "16px 0" }}>
              <span style={{ fontSize: 20, color: "var(--c-green)" }}>✓</span>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-green)", margin: 0 }}>
                Aucun problème détecté
              </p>
              <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0 }}>Pattern entièrement jouable</p>
            </div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.values(playabilityMap)
                .filter((m) => m.issues.length > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 20)
                .flatMap((m) => m.issues)
                .map((issue, i) => (
                  <div
                    key={i}
                    style={{
                      borderRadius: 8, padding: "8px 10px",
                      background: issue.severity === "error" ? "rgba(255,69,58,0.06)" : "rgba(255,159,10,0.06)",
                      border: `1px solid ${issue.severity === "error" ? "rgba(255,69,58,0.18)" : "rgba(255,159,10,0.18)"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                      <span style={{ fontSize: 10, flexShrink: 0, color: issue.severity === "error" ? "var(--c-red)" : "var(--c-orange)" }}>
                        {issue.severity === "error" ? "✕" : "▲"}
                      </span>
                      <div>
                        <p style={{ fontSize: 11, margin: "0 0 2px", color: "var(--tx-1)", lineHeight: 1.4 }}>
                          {issue.description}
                        </p>
                        <p style={{ fontSize: 10, margin: 0, color: "var(--tx-3)" }}>{issue.suggestion}</p>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8, borderTop: "1px solid var(--sep)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "var(--tx-3)" }}>Mesures problématiques</span>
              <span style={{ fontFamily: "monospace", color: "var(--tx-1)" }}>{playabilitySummary.problematicMeasures}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "var(--tx-3)" }}>Score global</span>
              <span style={{
                fontFamily: "monospace", fontWeight: 600,
                color: playabilityBadgeColor(
                  playabilitySummary.overallScore < 40 ? "ok" :
                  playabilitySummary.overallScore < 70 ? "hard" :
                  playabilitySummary.overallScore < 85 ? "very-hard" : "impossible"
                ),
              }}>
                {playabilitySummary.overallScore}/100
              </span>
            </div>
          </div>
        </AnalysisCard>
      </div>

      {/* ── Body simulation ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <SectionHead title="Simulation corporelle" />
          <button
            type="button"
            onClick={() => setShowBodySim((v) => !v)}
            style={{
              fontSize: 10, background: "none", border: "none", cursor: "pointer",
              color: "var(--tx-3)", padding: "2px 6px",
            }}
          >
            {showBodySim ? "▲ Réduire" : "▼ Afficher"}
          </button>
        </div>
        {showBodySim && (
          <div style={{ height: 280, borderRadius: 12, overflow: "hidden", border: "1px solid var(--sep)" }}>
            <DrummerVisualizer showEducationalMode={false} />
          </div>
        )}
      </div>
    </div>
  );
};
