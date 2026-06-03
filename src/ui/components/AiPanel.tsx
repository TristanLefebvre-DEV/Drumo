/**
 * Panneau IA — v2
 *
 * Analyse groove, difficulté, rudiments et quantification intelligente.
 * Design unifié avec le design system CSS (pas de Tailwind zinc).
 * Entièrement en français.
 */

import { useState, useCallback } from "react";
import { useProjectStore }    from "../../store/projectStore";
import { aiEngine }           from "../../ai/aiEngine";
import { DIFFICULTY_COLORS, DIFFICULTY_BG } from "../../ai/difficultyAnalyzer";
import { rudimentLabel }      from "../../ai/rudimentDetector";
import { smartQuantize }      from "../../ai/smartQuantizer";
import type { AiAnalysisResult } from "../../ai/types";
import type { AiEngineStatus }   from "../../ai/aiEngine";

// ─── Primitives ───────────────────────────────────────────────────────────────

const ProgressBar = ({
  value, color = "var(--accent)",
}: {
  value: number; color?: string;
}) => (
  <div style={{
    height: 4, width: "100%", borderRadius: 999,
    background: "var(--bg-4)", overflow: "hidden", marginTop: 4,
  }}>
    <div style={{
      height: "100%", borderRadius: 999,
      width: `${Math.round(value * 100)}%`,
      background: color,
      transition: "width 0.5s ease",
    }} />
  </div>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{
    borderRadius: 10, padding: "10px 12px",
    background: "var(--bg-3)", border: "1px solid var(--sep)",
  }}>
    <p style={{
      fontSize: 9, fontWeight: 700,
      textTransform: "uppercase" as const, letterSpacing: "0.09em",
      color: "var(--tx-4)", margin: "0 0 8px",
    }}>{title}</p>
    {children}
  </div>
);

const StatRow = ({
  label, value, color = "var(--tx-1)",
}: {
  label: string; value: string | number; color?: string;
}) => (
  <div style={{
    display: "flex", alignItems: "center",
    justifyContent: "space-between",
    fontSize: 11, padding: "2px 0",
  }}>
    <span style={{ color: "var(--tx-3)" }}>{label}</span>
    <span style={{ fontFamily: "monospace", fontWeight: 600, color }}>{value}</span>
  </div>
);

// Labels de styles groove
const STYLE_LABELS: Record<string, string> = {
  rock: "Rock", metal: "Metal", "blast-beat": "Blast", funk: "Funk",
  jazz: "Jazz", shuffle: "Shuffle", halftime: "Demi-temps", unknown: "?",
};

// ─── Panneau principal ────────────────────────────────────────────────────────

interface AiPanelProps { onClose: () => void; }

export const AiPanel = ({ onClose }: AiPanelProps) => {
  const { project, quantizeOptions } = useProjectStore();
  const [result, setResult]   = useState<AiAnalysisResult | null>(null);
  const [status, setStatus]   = useState<AiEngineStatus>("idle");
  const [error, setError]     = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [sqStrength, setSqStrength] = useState(0.6);
  const [sqHuman,    setSqHuman]    = useState(0.5);

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
      strength: sqStrength, humanFactor: sqHuman, preserveGhosts: true,
    });
    useProjectStore.getState().loadProjectData({
      project: { ...project, hits: newHits },
      quantizeOptions,
    });
  }, [project, quantizeOptions, sqStrength, sqHuman]);

  return (
    <div style={{
      width: 276,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      overflowY: "auto",
      borderRadius: 12,
      border: "1px solid var(--sep-2)",
      background: "var(--bg-2)",
      padding: 10,
      boxShadow: "var(--shadow-md)",
    }}>

      {/* ── En-tête ── */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)" }}>
            Analyse IA
          </span>
          <span style={{
            padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700,
            background: "var(--accent-dim)", color: "var(--accent)",
            border: "1px solid var(--accent-line)",
            textTransform: "uppercase" as const, letterSpacing: "0.05em",
          }}>
            Hors ligne
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => setDebugMode((v) => !v)}
            title="Mode débogage"
            style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 9,
              background: debugMode ? "var(--bg-4)" : "transparent",
              color: debugMode ? "var(--tx-2)" : "var(--tx-4)",
              border: "1px solid transparent", cursor: "pointer",
              transition: "all 0.12s",
            }}
          >
            DBG
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 22, height: 22, borderRadius: 5,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg-3)", border: "none",
              cursor: "pointer", fontSize: 14, color: "var(--tx-3)",
              transition: "all 0.12s",
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Bouton analyser ── */}
      <button
        type="button"
        onClick={() => void runAnalysis()}
        disabled={!project || status === "analyzing"}
        style={{
          width: "100%", padding: "10px 12px",
          borderRadius: 9, fontSize: 12, fontWeight: 700,
          cursor: (!project || status === "analyzing") ? "not-allowed" : "pointer",
          background: status === "analyzing" ? "var(--accent-dim)" : "var(--accent)",
          color: status === "analyzing" ? "var(--accent)" : "#fff",
          border: `1px solid ${status === "analyzing" ? "var(--accent-line)" : "transparent"}`,
          opacity: !project ? 0.4 : 1,
          transition: "all 0.15s",
          flexShrink: 0,
        }}
      >
        {status === "analyzing" ? "Analyse en cours…" : "Analyser le groove"}
      </button>

      {error && (
        <div style={{
          padding: "8px 10px", borderRadius: 8, fontSize: 11,
          background: "rgba(255,69,58,0.08)",
          border: "1px solid rgba(255,69,58,0.22)",
          color: "var(--c-red)",
        }}>
          {error}
        </div>
      )}

      {!project && (
        <p style={{ fontSize: 11, color: "var(--tx-3)", textAlign: "center", margin: 0 }}>
          Charge un fichier MIDI pour activer l'analyse IA.
        </p>
      )}

      {result && (
        <>
          {/* ── Style de groove ── */}
          <Card title="Style de groove">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 9, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--accent-dim)", border: "1px solid var(--accent-line)",
              }}>
                <span style={{
                  fontFamily: "monospace", fontSize: 10, fontWeight: 800, color: "var(--accent)",
                }}>
                  {STYLE_LABELS[result.groove.style] ?? "?"}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14, fontWeight: 700, color: "var(--tx-1)",
                  textTransform: "capitalize" as const, margin: "0 0 2px",
                }}>
                  {result.groove.style.replace("-", " ")}
                </p>
                <ProgressBar value={result.groove.confidence} color="var(--accent)" />
                <p style={{ fontSize: 10, color: "var(--tx-3)", margin: "3px 0 0" }}>
                  Confiance : {Math.round(result.groove.confidence * 100)}%
                </p>
              </div>
            </div>

            {debugMode && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                {Object.entries(result.groove.scores).map(([style, score]) => (
                  <div key={style} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
                    <span style={{ width: 60, color: "var(--tx-3)", textTransform: "capitalize" as const }}>
                      {style}
                    </span>
                    <div style={{
                      flex: 1, height: 3, borderRadius: 999,
                      background: "var(--bg-4)", overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 999,
                        width: `${Math.round((score ?? 0) * 100)}%`,
                        background: "var(--accent)",
                        opacity: 0.6,
                      }} />
                    </div>
                    <span style={{ width: 28, textAlign: "right", fontFamily: "monospace", color: "var(--tx-4)" }}>
                      {Math.round((score ?? 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── Difficulté ── */}
          <Card title="Difficulté">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className={DIFFICULTY_BG[result.difficulty.level]} style={{
                width: 48, height: 48, borderRadius: 9, flexShrink: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}>
                <span className={DIFFICULTY_COLORS[result.difficulty.level]}
                  style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800 }}>
                  {result.difficulty.score}
                </span>
                <span style={{ fontSize: 8, color: "var(--tx-4)" }}>/100</span>
              </div>
              <div style={{ flex: 1 }}>
                <p className={DIFFICULTY_COLORS[result.difficulty.level]}
                  style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>
                  {result.difficulty.level}
                </p>
                <ProgressBar
                  value={result.difficulty.score / 100}
                  color={
                    result.difficulty.level === "Expert"       ? "var(--c-red)"    :
                    result.difficulty.level === "Advanced"     ? "var(--c-orange)" :
                    result.difficulty.level === "Intermediate" ? "var(--accent)"   :
                    "var(--c-green)"
                  }
                />
              </div>
            </div>
            {debugMode && (
              <div style={{
                marginTop: 8, display: "grid",
                gridTemplateColumns: "1fr 1fr", gap: 4,
              }}>
                {Object.entries(result.difficulty.breakdown).map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "3px 6px", borderRadius: 5, background: "var(--bg-4)",
                  }}>
                    <span style={{ fontSize: 9, color: "var(--tx-3)" }}>
                      {k.replace("Score", "")}
                    </span>
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--tx-2)" }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── Feeling humain ── */}
          <Card title="Feeling humain">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <StatRow
                label="Humanisation"
                value={`${Math.round(result.humanFeel.humanness * 100)}%`}
                color={result.humanFeel.humanness > 0.7 ? "var(--c-green)" : "var(--tx-1)"}
              />
              <ProgressBar value={result.humanFeel.humanness} color="var(--c-green)" />
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                gap: 5, marginTop: 6,
              }}>
                {[
                  { label: "Swing",     value: `${(result.humanFeel.swingRatio * 100).toFixed(0)}%` },
                  { label: "Dynamique", value: `${Math.round(result.humanFeel.dynamicRange * 100)}%` },
                  { label: "Timing",    value: `${Math.round(result.humanFeel.timingVariance * 100)}%` },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    textAlign: "center", padding: "6px 4px",
                    borderRadius: 7, background: "var(--bg-4)",
                  }}>
                    <p style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "var(--tx-1)", margin: 0 }}>
                      {value}
                    </p>
                    <p style={{ fontSize: 9, color: "var(--tx-3)", margin: "2px 0 0" }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* ── Rudiments ── */}
          {result.rudiments.length > 0 && (
            <Card title={`Rudiments (${result.rudiments.length})`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {result.rudiments.slice(0, 6).map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      flex: 1, fontSize: 11, color: "var(--tx-2)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {rudimentLabel[r.type]}
                    </span>
                    <ProgressBar value={r.confidence} color="var(--c-yellow)" />
                    <span style={{ width: 32, textAlign: "right", fontFamily: "monospace", fontSize: 10, color: "var(--tx-4)" }}>
                      {Math.round(r.confidence * 100)}%
                    </span>
                  </div>
                ))}
                {result.rudiments.length > 6 && (
                  <p style={{ fontSize: 10, color: "var(--tx-4)", margin: 0 }}>
                    + {result.rudiments.length - 6} autres…
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* ── Quantification intelligente ── */}
          <Card title="Quantification IA">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: "var(--tx-3)" }}>Correction</span>
                  <span style={{ fontFamily: "monospace", color: "var(--tx-1)" }}>
                    {Math.round(sqStrength * 100)}%
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "var(--tx-4)" }}>
                  <span>Humain</span>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={sqStrength}
                    onChange={(e) => setSqStrength(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--accent)" }}
                  />
                  <span>Strict</span>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: "var(--tx-3)" }}>Préservation groove</span>
                  <span style={{ fontFamily: "monospace", color: "var(--tx-1)" }}>
                    {Math.round(sqHuman * 100)}%
                  </span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={sqHuman}
                  onChange={(e) => setSqHuman(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--accent)" }}
                />
              </div>
              <button
                type="button"
                onClick={applySmartQuantize}
                disabled={!project}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  fontSize: 11, fontWeight: 700, cursor: project ? "pointer" : "not-allowed",
                  background: "var(--accent-dim)", color: "var(--accent)",
                  border: "1px solid var(--accent-line)",
                  opacity: project ? 1 : 0.4,
                  transition: "all 0.12s",
                }}
              >
                Appliquer la quantification IA
              </button>
            </div>
          </Card>

          <p style={{ fontSize: 9, color: "var(--tx-4)", textAlign: "center", margin: 0 }}>
            Analysé à {new Date(result.analyzedAt).toLocaleTimeString("fr-FR")} · TF.js hors ligne
          </p>
        </>
      )}

      {!result && status !== "analyzing" && project && (
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          justifyContent: "center", padding: "24px 0",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, margin: "0 auto 10px",
              background: "var(--bg-3)", border: "1px solid var(--sep)",
            }} />
            <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0, lineHeight: 1.5 }}>
              Cliquer « Analyser le groove » pour détecter<br/>
              le style, la difficulté et les rudiments.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
