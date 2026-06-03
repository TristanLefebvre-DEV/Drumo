/**
 * Kit Balance Panel
 *
 * Professional analytics dashboard showing the proportional usage
 * of each instrument category compared to a reference style profile.
 *
 * Features:
 *   - Horizontal bar chart per metric (actual vs target)
 *   - Style selector (rock/jazz/metal/funk/electronic)
 *   - Closest style detection with match score
 *   - Groove DNA similarity scores
 *   - Cymbal role summary
 *   - Page layout preview
 *   - Actionable suggestions
 */

import { useState, useMemo } from "react";
import { useProjectStore } from "../../store/projectStore";
import { analyzeKitBalance } from "../../analysis/kitBalanceAnalyzer";
import { STYLE_PROFILES, ALL_STYLES } from "../../analysis/styleProfiles";
import { computeStyleSimilarities } from "../../ai/grooveEmbedding";
import { extractGrooveDNA } from "../../ai/grooveDNA";
import type { DrumStyle } from "../../analysis/styleProfiles";

// ─── Sub-components ────────────────────────────────────────────────────────────

const MetricBar = ({
  label, actual, target, color, delta,
}: {
  label: string; actual: number; target: number; color: string; delta: number;
}) => {
  const severity =
    Math.abs(delta) < 10 ? "ok" :
    Math.abs(delta) < 20 ? "minor" :
    Math.abs(delta) < 35 ? "moderate" : "major";

  const indicatorColor =
    severity === "ok"       ? "text-green-400" :
    severity === "minor"    ? "text-yellow-400" :
    severity === "moderate" ? "text-orange-400" : "text-red-400";

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-400">{label}</span>
        <span className={`font-mono font-semibold ${indicatorColor}`}>
          {actual}%
          {severity !== "ok" && (
            <span className="ml-1 text-zinc-600">
              {delta > 0 ? `+${delta}` : delta} vs ref
            </span>
          )}
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-zinc-800 overflow-hidden">
        {/* Target line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-zinc-500/60 z-10"
          style={{ left: `${Math.min(100, target)}%` }}
        />
        {/* Actual bar */}
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, actual)}%`, backgroundColor: color, opacity: 0.85 }}
        />
      </div>
    </div>
  );
};

const SimilarityChip = ({ style, score, active }: { style: string; score: number; active?: boolean }) => (
  <div className={`flex items-center justify-between rounded-md border px-2 py-1 text-[10px] ${
    active ? "border-blue-500/40 bg-blue-600/15" : "border-zinc-800 bg-zinc-900/60"
  }`}>
    <span className={active ? "text-blue-300 font-semibold" : "text-zinc-400 capitalize"}>{style}</span>
    <span className="font-mono text-zinc-500">{Math.round(score * 100)}%</span>
    <div className="ml-2 h-1 w-16 overflow-hidden rounded-full bg-zinc-700">
      <div
        className={`h-full rounded-full transition-all ${active ? "bg-blue-400" : "bg-zinc-500"}`}
        style={{ width: `${Math.round(score * 100)}%` }}
      />
    </div>
  </div>
);

// ─── Main panel ────────────────────────────────────────────────────────────────

interface KitBalancePanelProps {
  onClose: () => void;
  embedded?: boolean;
}

export const KitBalancePanel = ({ onClose, embedded = false }: KitBalancePanelProps) => {
  const { project } = useProjectStore();
  const [targetStyle, setTargetStyle] = useState<DrumStyle>("rock");
  const [activeTab, setActiveTab] = useState<"balance" | "dna">("balance");

  const analysis = useMemo(
    () => project ? analyzeKitBalance(project, targetStyle) : null,
    [project, targetStyle]
  );

  const dnaResults = useMemo(() => {
    if (!project) return null;
    const dna = extractGrooveDNA(project);
    return computeStyleSimilarities(dna);
  }, [project]);

  if (!project) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 text-center ${embedded ? "h-full w-full" : "h-full w-72 rounded-xl border border-zinc-800 bg-zinc-950/95"}`}>
        <p className="text-xs text-zinc-600">Charge un projet pour accéder à l'analyse Kit Balance.</p>
        {!embedded && <button type="button" onClick={onClose} className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 transition">Fermer</button>}
      </div>
    );
  }

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "balance", label: "Balance" },
    { key: "dna",     label: "Groove DNA" },
  ];

  return (
    <div className={`flex flex-col gap-0 overflow-hidden text-sm ${embedded ? "h-full w-full" : "h-full w-80 rounded-xl border border-zinc-800 bg-zinc-950/98 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"}`}>
      {/* Header (masqué si embedded) */}
      {!embedded && (
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5 shrink-0">
          <span className="font-semibold text-zinc-100">Kit Balance</span>
          <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-200 transition px-1.5">×</button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/60">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-1.5 text-[10px] font-medium transition ${
              activeTab === tab.key
                ? "border-b-2 border-blue-500 text-blue-300 bg-zinc-900"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* ── BALANCE TAB ──────────────────────────────────────────────────── */}
        {activeTab === "balance" && analysis && (
          <>
            {/* Style selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 shrink-0">Référence :</span>
              <div className="flex flex-wrap gap-1">
                {ALL_STYLES.filter(s => s.id !== "custom").map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTargetStyle(p.id)}
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold transition ${
                      targetStyle === p.id
                        ? "text-white"
                        : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                    style={targetStyle === p.id ? { borderColor: p.color, backgroundColor: `${p.color}25`, color: p.color } : {}}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Match badge */}
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <div>
                <p className="text-[10px] text-zinc-500">Style le plus proche</p>
                <p className="font-bold text-zinc-100" style={{ color: analysis.closestStyle.color }}>
                  {analysis.closestStyle.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-zinc-100">{analysis.matchScore}</p>
                <p className="text-[9px] text-zinc-600">/100 match</p>
              </div>
            </div>

            {/* Metric bars */}
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                Métriques — tiret = target {STYLE_PROFILES[targetStyle].name}
              </p>
              {analysis.chartData.map(m => (
                <MetricBar
                  key={m.key}
                  label={m.label}
                  actual={m.actual}
                  target={m.target}
                  delta={m.delta}
                  color={m.color}
                />
              ))}
            </div>

            {/* Suggestions */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Suggestions</p>
              {analysis.suggestions.map((s, i) => (
                <p key={i} className="text-[10px] text-zinc-400 flex gap-1.5">
                  <span className="shrink-0 text-zinc-600">•</span>{s}
                </p>
              ))}
            </div>

            {/* Style traits */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                Traits {STYLE_PROFILES[targetStyle].name}
              </p>
              {STYLE_PROFILES[targetStyle].traits.map((t, i) => (
                <p key={i} className="text-[10px] text-zinc-500 flex gap-1.5">
                  <span className="text-zinc-700">›</span>{t}
                </p>
              ))}
            </div>
          </>
        )}

        {/* ── DNA TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "dna" && dnaResults && (
          <>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">
                Similarité Groove DNA
              </p>
              {dnaResults.map((r, i) => (
                <SimilarityChip
                  key={r.style}
                  style={r.style.replace("-", " ")}
                  score={r.score}
                  active={i === 0}
                />
              ))}
            </div>
            {dnaResults[0] && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-600/10 p-3">
                <p className="text-[10px] font-semibold text-blue-400">
                  {dnaResults[0].label}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  Confiance : {dnaResults[0].confidence}
                </p>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};
