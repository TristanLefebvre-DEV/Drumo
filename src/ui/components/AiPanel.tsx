import { useState, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore";
import { aiEngine } from "../../ai/aiEngine";
import { DIFFICULTY_COLORS, DIFFICULTY_BG } from "../../ai/difficultyAnalyzer";
import { rudimentLabel } from "../../ai/rudimentDetector";
import { smartQuantize } from "../../ai/smartQuantizer";
import type { AiAnalysisResult } from "../../ai/types";
import type { AiEngineStatus } from "../../ai/aiEngine";

// ─── Sub-components ────────────────────────────────────────────────────────────

const ConfidenceBar = ({ value, color = "bg-blue-500" }: { value: number; color?: string }) => (
  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
    <div
      className={`h-full rounded-full transition-all duration-500 ${color}`}
      style={{ width: `${Math.round(value * 100)}%` }}
    />
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
    {children}
  </div>
);

// Style badge label (no emojis)
const STYLE_LABEL: Record<string, string> = {
  rock:        "ROCK",
  metal:       "METAL",
  "blast-beat":"BLAST",
  funk:        "FUNK",
  jazz:        "JAZZ",
  shuffle:     "SHUFFLE",
  halftime:    "HALF",
  unknown:     "?",
};

// ─── Main panel ────────────────────────────────────────────────────────────────

interface AiPanelProps {
  onClose: () => void;
}

export const AiPanel = ({ onClose }: AiPanelProps) => {
  const { project, quantizeOptions } = useProjectStore();
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [status, setStatus] = useState<AiEngineStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  const [sqStrength, setSqStrength] = useState(0.6);
  const [sqHuman, setSqHuman] = useState(0.5);

  const runAnalysis = useCallback(async () => {
    if (!project) return;
    setError(null);
    setStatus("analyzing");
    try {
      aiEngine.onStatus(setStatus);
      const res = await aiEngine.analyze(project);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur analyse IA");
    } finally {
      setStatus("ready");
    }
  }, [project]);

  const applySmartQuantize = useCallback(() => {
    if (!project) return;
    const newHits = smartQuantize(project.hits, quantizeOptions.grid, project.ppq, {
      strength:       sqStrength,
      humanFactor:    sqHuman,
      preserveGhosts: true,
    });
    useProjectStore.getState().loadProjectData({
      project: { ...project, hits: newHits },
      quantizeOptions,
    });
  }, [project, quantizeOptions, sqStrength, sqHuman]);

  return (
    <div className="flex h-full w-72 flex-col gap-2 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 text-sm shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-100">AI Analysis</span>
          <span className="rounded-full bg-violet-600/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-400 border border-violet-500/30">
            OFFLINE
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDebugMode((v) => !v)}
            className={`rounded px-1.5 py-0.5 text-[9px] transition ${debugMode ? "bg-zinc-700 text-zinc-300" : "text-zinc-600 hover:text-zinc-400"}`}
            title="Debug mode"
          >
            DBG
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-zinc-500 hover:text-zinc-200 transition text-xs"
          >
            ×
          </button>
        </div>
      </div>

      {/* Analyze button */}
      <button
        type="button"
        onClick={() => void runAnalysis()}
        disabled={!project || status === "analyzing"}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition ${
          status === "analyzing"
            ? "border-violet-500/40 bg-violet-600/15 text-violet-400 cursor-wait"
            : "border-violet-600/60 bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
        }`}
      >
        {status === "analyzing" ? (
          <span className="animate-pulse">Analyse en cours…</span>
        ) : (
          "Analyser le groove"
        )}
      </button>

      {error && (
        <p className="rounded-md border border-red-700/40 bg-red-900/20 px-2 py-1.5 text-xs text-red-400">
          {error}
        </p>
      )}

      {!project && (
        <p className="text-center text-xs text-zinc-600">Charge un fichier MIDI pour activer l'IA.</p>
      )}

      {result && (
        <>
          {/* ── Groove Classification ── */}
          <Section title="Style Groove">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/20 border border-violet-500/30 font-mono text-[10px] font-bold text-violet-300">
                {STYLE_LABEL[result.groove.style] ?? "?"}
              </span>
              <div className="flex-1">
                <p className="text-base font-bold capitalize text-zinc-100">
                  {result.groove.style.replace("-", " ")}
                </p>
                <ConfidenceBar value={result.groove.confidence} color="bg-violet-500" />
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  Confiance : {Math.round(result.groove.confidence * 100)}%
                </p>
              </div>
            </div>
            {debugMode && (
              <div className="mt-2 space-y-0.5">
                {Object.entries(result.groove.scores).map(([style, score]) => (
                  <div key={style} className="flex items-center gap-2">
                    <span className="w-20 text-[9px] text-zinc-500 capitalize">{style}</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-violet-700/60" style={{ width: `${Math.round((score ?? 0) * 100)}%` }} />
                    </div>
                    <span className="w-8 text-right text-[9px] text-zinc-600">{Math.round((score ?? 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Difficulty ── */}
          <Section title="Difficulté">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg border px-3 py-2 text-center ${DIFFICULTY_BG[result.difficulty.level]}`}>
                <p className={`text-lg font-black ${DIFFICULTY_COLORS[result.difficulty.level]}`}>
                  {result.difficulty.score}
                </p>
                <p className="text-[9px] text-zinc-500">/100</p>
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${DIFFICULTY_COLORS[result.difficulty.level]}`}>
                  {result.difficulty.level}
                </p>
                <ConfidenceBar
                  value={result.difficulty.score / 100}
                  color={
                    result.difficulty.level === "Expert" ? "bg-red-500" :
                    result.difficulty.level === "Advanced" ? "bg-amber-500" :
                    result.difficulty.level === "Intermediate" ? "bg-blue-500" : "bg-green-500"
                  }
                />
              </div>
            </div>
            {debugMode && (
              <div className="mt-2 grid grid-cols-2 gap-1">
                {Object.entries(result.difficulty.breakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded bg-zinc-800/50 px-1.5 py-0.5">
                    <span className="text-[9px] text-zinc-500">{k.replace("Score","")}</span>
                    <span className="text-[9px] font-mono text-zinc-400">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Human Feel ── */}
          <Section title="Human Feel">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Humanness</span>
                <span className="font-mono text-zinc-300">
                  {Math.round(result.humanFeel.humanness * 100)}%
                </span>
              </div>
              <ConfidenceBar value={result.humanFeel.humanness} color="bg-emerald-500" />
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="rounded bg-zinc-800/60 p-1">
                  <p className="font-mono text-zinc-300">{(result.humanFeel.swingRatio * 100).toFixed(0)}%</p>
                  <p className="text-zinc-600">Swing</p>
                </div>
                <div className="rounded bg-zinc-800/60 p-1">
                  <p className="font-mono text-zinc-300">{Math.round(result.humanFeel.dynamicRange * 100)}%</p>
                  <p className="text-zinc-600">Dynamique</p>
                </div>
                <div className="rounded bg-zinc-800/60 p-1">
                  <p className="font-mono text-zinc-300">{Math.round(result.humanFeel.timingVariance * 100)}%</p>
                  <p className="text-zinc-600">Timing</p>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Rudiments ── */}
          {result.rudiments.length > 0 && (
            <Section title={`Rudiments (${result.rudiments.length})`}>
              <div className="space-y-1">
                {result.rudiments.slice(0, 6).map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-28 truncate text-xs text-zinc-300">{rudimentLabel[r.type]}</span>
                    <ConfidenceBar value={r.confidence} color="bg-amber-500" />
                    <span className="w-8 text-right text-[10px] font-mono text-zinc-500">
                      {Math.round(r.confidence * 100)}%
                    </span>
                  </div>
                ))}
                {result.rudiments.length > 6 && (
                  <p className="text-[10px] text-zinc-600">+ {result.rudiments.length - 6} autres…</p>
                )}
              </div>
            </Section>
          )}

          {/* ── Smart Quantizer ── */}
          <Section title="Smart Quantizer IA">
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs text-zinc-400">
                <span>Correction</span>
                <span className="font-mono text-zinc-300">{Math.round(sqStrength * 100)}%</span>
              </label>
              <div className="flex items-center gap-1 text-[9px] text-zinc-600">
                <span>Human</span>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={sqStrength}
                  onChange={(e) => setSqStrength(Number(e.target.value))}
                  className="flex-1 accent-violet-500"
                />
                <span>Strict</span>
              </div>
              <label className="flex items-center justify-between text-xs text-zinc-400">
                <span>Préservation groove</span>
                <span className="font-mono text-zinc-300">{Math.round(sqHuman * 100)}%</span>
              </label>
              <input
                type="range" min={0} max={1} step={0.05}
                value={sqHuman}
                onChange={(e) => setSqHuman(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
              <button
                type="button"
                onClick={applySmartQuantize}
                disabled={!project}
                className="w-full rounded-md border border-violet-600/40 bg-violet-600/15 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-600/25 disabled:opacity-40"
              >
                Appliquer Smart Quantize
              </button>
            </div>
          </Section>

          <p className="text-center text-[9px] text-zinc-700">
            Analysé {new Date(result.analyzedAt).toLocaleTimeString()} • TF.js offline
          </p>
        </>
      )}

      {!result && status !== "analyzing" && project && (
        <div className="flex flex-1 items-center justify-center py-8 text-center">
          <div>
            <div className="mx-auto mb-3 h-10 w-10 rounded-lg border border-zinc-700 bg-zinc-800/60" />
            <p className="text-xs text-zinc-500">
              Cliquer Analyser pour détecter le style, la difficulté et les rudiments.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
