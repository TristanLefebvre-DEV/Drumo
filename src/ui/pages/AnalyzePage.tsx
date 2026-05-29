/**
 * Analyze Page
 *
 * Dedicated analysis dashboard — all analysis tools always visible,
 * no toggling required.
 *
 * Layout (3-column when project loaded):
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │  Summary bar (score overview)                                     │
 *   ├───────────────────────────────────────────────────────────────────┤
 *   │  Energy timeline (full width)                                     │
 *   │  Section timeline (full width)                                    │
 *   ├──────────────┬────────────────────────────┬───────────────────────┤
 *   │  Ergonomics  │  Limb & Sticking           │  Playability Details  │
 *   │  & Energy    │  (stats + legend)          │  (issue list)         │
 *   ├──────────────┴────────────────────────────┴───────────────────────┤
 *   │  Body Simulation (full width)                                     │
 *   └───────────────────────────────────────────────────────────────────┘
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

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard = ({
  label, value, sub, accentColor = "var(--text-1)",
}: { label: string; value: string | number; sub?: string; accentColor?: string }) => (
  <div
    className="flex flex-col gap-1 rounded-xl p-3"
    style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}
  >
    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
      {label}
    </span>
    <span className="text-xl font-black font-mono tabular-nums" style={{ color: accentColor }}>
      {value}
    </span>
    {sub && <span className="text-[10px]" style={{ color: "var(--text-3)" }}>{sub}</span>}
  </div>
);

// ─── Section heading ──────────────────────────────────────────────────────────

const SectionHead = ({ title }: { title: string }) => (
  <h2 className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-3)" }}>
    {title}
  </h2>
);

// ─── Empty state ──────────────────────────────────────────────────────────────

const AnalyzeEmpty = () => (
  <div className="flex h-full items-center justify-center">
    <div className="space-y-3 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }} />
      <p className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>Analyse en attente</p>
      <p className="text-xs" style={{ color: "var(--text-3)" }}>
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

  // ── Derived analysis data ────────────────────────────────────────────────

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

  const energyAvg   = energyFlow?.avgScore  ?? 0;
  const energyTrend = energyFlow?.globalTrend ?? "steady";

  const TREND_LABELS = { rising: "↑ Montée", falling: "↓ Descente", steady: "→ Stable", dynamic: "⚡ Dynamique" };

  if (!project) return (
    <div className="h-full" style={{ background: "var(--bg-base)" }}>
      <AnalyzeEmpty />
    </div>
  );

  return (
    <div
      className="flex h-full flex-col gap-3 overflow-auto p-3 section-fade-in"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Summary stats bar ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Hits"       value={project.hits.length} />
        <StatCard label="BPM"        value={project.tempoBpm.toFixed(0)} />
        <StatCard label="Playability"
          value={playabilitySummary.overallScore}
          sub={`${playabilitySummary.errorCount} erreurs`}
          accentColor={playabilityBadgeColor(
            playabilitySummary.overallScore < 40 ? "ok"
            : playabilitySummary.overallScore < 70 ? "hard"
            : playabilitySummary.overallScore < 85 ? "very-hard"
            : "impossible"
          )}
        />
        <StatCard label="Énergie moy."
          value={energyAvg}
          sub={TREND_LABELS[energyTrend]}
          accentColor={energyColor(energyAvg)}
        />
        <StatCard label="Croisements" value={xoverCount}
          accentColor={xoverCount > 10 ? "#f97316" : "var(--text-1)"}
        />
        <StatCard label="Confiance"   value={`${Math.round(confAvg * 100)}%`}
          accentColor={confAvg >= 0.8 ? "#4ade80" : confAvg >= 0.6 ? "#f59e0b" : "#ef4444"}
        />
        {ergonomics && (
          <StatCard label="Ergonomie"   value={ergonomics.overallScore}
            sub={ergonomics.fatigueScore > 40 ? "Fatigue élevée" : ""}
            accentColor={ergonomics.overallScore >= 70 ? "#4ade80" : ergonomics.overallScore >= 40 ? "#f59e0b" : "#ef4444"}
          />
        )}
        <StatCard label="Sections"    value={sections.length}
          sub={`${musicalSections.filter(s => s.musicalRole === "chorus").length} chorus`}
        />
      </div>

      {/* ── Energy timeline (full width) ── */}
      {energyFlow && energyFlow.measures.length > 0 && rhythm && (
        <div>
          <SectionHead title="Energy Flow" />
          <div className="mt-1.5">
            <EnergyTimeline
              energyFlow={energyFlow}
              sections={sections}
              activeTick={activeTick}
              totalMeasures={rhythm.measures.length}
              ppq={project.ppq}
              timeSignature={project.timeSignature}
              onSeekToMeasure={(m) => void seekTo(m * project.ppq * project.timeSignature.numerator)}
            />
          </div>
        </div>
      )}

      {/* ── Section map ── */}
      {sections.length > 0 && rhythm && (
        <div>
          <SectionHead title="Sections" />
          <div className="mt-1.5">
            <SectionTimeline
              sections={sections}
              playabilityMap={playabilityMap}
              totalMeasures={rhythm.measures.length}
              onSeekToMeasure={(m) => void seekTo(m * project.ppq * project.timeSignature.numerator)}
            />
          </div>
        </div>
      )}

      {/* ── Musical roles ── */}
      {musicalSections.length > 0 && (
        <div>
          <SectionHead title="Rôles Musicaux" />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {musicalSections.map((ms, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                style={{ background: `${ms.color}15`, border: `1px solid ${ms.color}30` }}
              >
                <span className="text-[10px] font-semibold" style={{ color: ms.color }}>
                  {MUSICAL_ROLE_LABELS[ms.musicalRole]}
                </span>
                <span className="text-[9px]" style={{ color: "var(--text-3)" }}>
                  m.{ms.section.startMeasure + 1}–{ms.section.endMeasure + 1}
                </span>
                <span className="rounded px-1 text-[9px] font-mono"
                  style={{ background: "var(--bg-3)", color: energyColor(ms.avgEnergy) }}>
                  {ms.avgEnergy}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Three-column analysis ── */}
      <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-3">

        {/* ── Col 1: Limb stats ── */}
        <div
          className="rounded-xl p-4 space-y-4"
          style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)" }}
        >
          <SectionHead title="Analyse des Membres" />

          <div className="grid grid-cols-2 gap-2">
            {(["RH","LH","RF","LF"] as const).map((l) => (
              <div key={l} className="rounded-lg p-3" style={{ background: "var(--bg-2)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-6 w-8 items-center justify-center rounded-full text-[9px] font-black text-white"
                    style={{ backgroundColor: LIMB_COLOR[l].hex }}>
                    {l}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-2)" }}>
                    {{ RH: "Main droite", LH: "Main gauche", RF: "Pied droit", LF: "Pied gauche" }[l]}
                  </span>
                </div>
                <p className="text-2xl font-black font-mono" style={{ color: LIMB_COLOR[l].hex }}>
                  {limbStats[l]}
                </p>
                <p className="text-[9px]" style={{ color: "var(--text-3)" }}>
                  {limbStats.total > 0 ? `${Math.round(limbStats[l] / limbStats.total * 100)}%` : "0%"}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--text-3)" }}>Croisements de bras</span>
              <span className="font-mono font-semibold"
                style={{ color: xoverCount > 10 ? "#f59e0b" : "var(--text-1)" }}>
                {xoverCount}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--text-3)" }}>Confiance moyenne</span>
              <span className="font-mono font-semibold"
                style={{ color: confAvg >= 0.8 ? "#4ade80" : confAvg >= 0.6 ? "#f59e0b" : "#ef4444" }}>
                {Math.round(confAvg * 100)}%
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--text-3)" }}>Mode sticking</span>
              <span className="font-mono font-semibold capitalize" style={{ color: "var(--accent)" }}>
                {limbMode}
              </span>
            </div>
          </div>
        </div>

        {/* ── Col 2: Ergonomics ── */}
        <div
          className="rounded-xl p-4 space-y-4"
          style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)" }}
        >
          <SectionHead title="Ergonomie & Mouvement" />

          {ergonomics ? (
            <div className="space-y-3">
              {/* Score gauge */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px]" style={{ color: "var(--text-3)" }}>Score global</span>
                  <span className="font-mono font-bold text-sm"
                    style={{ color: ergonomics.overallScore >= 70 ? "#4ade80" : ergonomics.overallScore >= 40 ? "#f59e0b" : "#ef4444" }}>
                    {ergonomics.overallScore}/100
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${ergonomics.overallScore}%`,
                      background: ergonomics.overallScore >= 70 ? "#4ade80" : ergonomics.overallScore >= 40 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              </div>

              {/* Fatigue gauge */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px]" style={{ color: "var(--text-3)" }}>Fatigue</span>
                  <span className="font-mono font-bold text-sm"
                    style={{ color: ergonomics.fatigueScore < 30 ? "#4ade80" : ergonomics.fatigueScore < 60 ? "#f59e0b" : "#ef4444" }}>
                    {ergonomics.fatigueScore}/100
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${ergonomics.fatigueScore}%`,
                      background: ergonomics.fatigueScore < 30 ? "#4ade80" : ergonomics.fatigueScore < 60 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              </div>

              {/* Limb workloads */}
              {(["RH","LH","RF","LF"] as const).map((l) => {
                const w = ergonomics.limbWorkloads[l];
                return (
                  <div key={l} className="flex items-center gap-2 text-[10px]">
                    <span className="w-6 rounded px-1 text-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: LIMB_COLOR[l].hex }}>
                      {l}
                    </span>
                    <span style={{ color: "var(--text-3)" }} className="w-10">{w.hitCount}x</span>
                    <div className="flex-1 h-1 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${Math.min(100, w.avgDistance * 10)}%`, backgroundColor: LIMB_COLOR[l].hex + "99" }} />
                    </div>
                    <span className="w-12 text-right font-mono" style={{ color: "var(--text-3)" }}>
                      {w.avgDistance.toFixed(1)}u
                    </span>
                  </div>
                );
              })}

              <p className="text-[10px] rounded-lg px-3 py-2" style={{ background: "var(--bg-2)", color: "var(--text-2)" }}>
                {ergonomics.summary}
              </p>
            </div>
          ) : (
            <p className="text-[10px]" style={{ color: "var(--text-3)" }}>
              Aucune donnée — limb analysis non disponible.
            </p>
          )}
        </div>

        {/* ── Col 3: Playability issues ── */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)" }}
        >
          <div className="flex items-center justify-between">
            <SectionHead title="Problèmes de jouabilité" />
            {playabilitySummary.errorCount > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                {playabilitySummary.errorCount} erreurs
              </span>
            )}
          </div>

          {playabilitySummary.totalIssues === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <span className="text-2xl">✓</span>
              <p className="text-[11px] font-semibold" style={{ color: "#4ade80" }}>Aucun problème détecté</p>
              <p className="text-[10px]" style={{ color: "var(--text-3)" }}>Pattern entièrement jouable</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-auto max-h-64 pr-1">
              {Object.values(playabilityMap)
                .filter((m) => m.issues.length > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 20)
                .flatMap((m) => m.issues)
                .map((issue, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-2.5"
                    style={{
                      background: issue.severity === "error" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)",
                      border: `1px solid ${issue.severity === "error" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 text-[10px]"
                        style={{ color: issue.severity === "error" ? "#ef4444" : "#f59e0b" }}>
                        {issue.severity === "error" ? "✕" : "▲"}
                      </span>
                      <div>
                        <p className="text-[10px] leading-snug" style={{ color: "var(--text-1)" }}>
                          {issue.description}
                        </p>
                        <p className="mt-0.5 text-[9px]" style={{ color: "var(--text-3)" }}>
                          {issue.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: "var(--border-1)" }}>
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--text-3)" }}>Mesures problématiques</span>
              <span className="font-mono" style={{ color: "var(--text-1)" }}>{playabilitySummary.problematicMeasures}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--text-3)" }}>Score global</span>
              <span className="font-mono font-semibold"
                style={{ color: playabilityBadgeColor(
                  playabilitySummary.overallScore < 40 ? "ok" :
                  playabilitySummary.overallScore < 70 ? "hard" :
                  playabilitySummary.overallScore < 85 ? "very-hard" : "impossible"
                )}}>
                {playabilitySummary.overallScore}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body simulation (full width, collapsible) ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHead title="Body Simulation" />
          <button
            type="button"
            onClick={() => setShowBodySim((v) => !v)}
            className="text-[10px] transition"
            style={{ color: "var(--text-3)" }}
          >
            {showBodySim ? "▲ Réduire" : "▼ Afficher"}
          </button>
        </div>
        {showBodySim && (
          <div style={{ height: 280 }}>
            <DrummerVisualizer showEducationalMode={false} />
          </div>
        )}
      </div>
    </div>
  );
};
