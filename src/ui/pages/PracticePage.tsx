/**
 * Practice Page — v2
 *
 * Focused on tempo training, looping, and playback-as-practice.
 * Transport is now at the app-shell level — no local transport bar here.
 */

import { useProjectStore } from "../../store/projectStore";
import { MetronomePanel }  from "../components/MetronomePanel";
import { useState }        from "react";

// ─── Speed presets ────────────────────────────────────────────────────────────

const SPEED_PRESETS = [
  { label: "50%",  value: 0.50 },
  { label: "60%",  value: 0.60 },
  { label: "75%",  value: 0.75 },
  { label: "85%",  value: 0.85 },
  { label: "100%", value: 1.00 },
  { label: "110%", value: 1.10 },
  { label: "120%", value: 1.20 },
];

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div style={{
    padding: "10px 12px",
    borderRadius: 10,
    background: "var(--bg-2)",
    border: "1px solid var(--sep-2)",
  }}>
    <p style={{
      fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const,
      letterSpacing: "0.08em", color: "var(--tx-3)", margin: "0 0 4px",
    }}>{label}</p>
    <p style={{
      fontSize: 16, fontWeight: 700, fontFamily: "monospace",
      color: "var(--tx-1)", margin: 0,
    }}>{value}</p>
  </div>
);

// ─── Section panel wrapper ────────────────────────────────────────────────────

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{
    borderRadius: 12,
    padding: 16,
    background: "var(--bg-1)",
    border: "1px solid var(--sep-2)",
  }}>
    <p style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
      letterSpacing: "0.09em", color: "var(--tx-3)", margin: "0 0 14px",
    }}>
      {title}
    </p>
    {children}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const PracticePage = () => {
  const {
    project, activeTick,
    transport, updateTransport,
  } = useProjectStore();

  const [showMetronome, setShowMetronome] = useState(true);
  const speedPct = Math.round(transport.speed * 100);

  return (
    <div
      className="fade-in"
      style={{ display: "flex", height: "100%", flexDirection: "column", background: "var(--bg-app)", overflow: "hidden" }}
    >
      <div style={{
        display: "flex",
        flex: 1,
        gap: 12,
        padding: 12,
        overflow: "hidden",
        minHeight: 0,
      }}>

        {/* ── Left column: practice tools ── */}
        <div style={{ width: 272, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>

          {/* Speed trainer */}
          <Panel title="Entraîneur de vitesse">
            {/* Current speed */}
            <div style={{ textAlign: "center", paddingBottom: 12 }}>
              <span style={{ fontFamily: "monospace", fontSize: 40, fontWeight: 800, color: "var(--accent)" }}>
                {speedPct}%
              </span>
              <p style={{ fontSize: 11, color: "var(--tx-3)", margin: "4px 0 0" }}>
                {project
                  ? `${Math.round(project.tempoBpm * transport.speed)} BPM effectif`
                  : "Aucun projet chargé"}
              </p>
            </div>

            {/* Slider */}
            <input
              type="range" min={0.25} max={1.5} step={0.05}
              value={transport.speed}
              onChange={(e) => updateTransport({ speed: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent)", display: "block", marginBottom: 12 }}
            />

            {/* Preset buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5, marginBottom: 10 }}>
              {SPEED_PRESETS.map((p) => {
                const active = Math.abs(transport.speed - p.value) < 0.02;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => updateTransport({ speed: p.value })}
                    style={{
                      padding: "6px 4px",
                      borderRadius: 7,
                      fontSize: 10,
                      fontWeight: active ? 700 : 400,
                      cursor: "pointer",
                      background: active ? "var(--accent-dim)" : "var(--bg-2)",
                      color:      active ? "var(--accent)"     : "var(--tx-3)",
                      border:     active ? "1px solid var(--accent-line)" : "1px solid var(--sep)",
                      transition: "all 0.12s",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => updateTransport({ speed: 1 })}
              disabled={transport.speed === 1}
              style={{
                width: "100%",
                padding: "7px 12px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 500,
                cursor: transport.speed === 1 ? "not-allowed" : "pointer",
                background: "var(--bg-2)",
                color: "var(--tx-2)",
                border: "1px solid var(--sep-2)",
                opacity: transport.speed === 1 ? 0.3 : 1,
                transition: "opacity 0.12s",
              }}
            >
              Réinitialiser à 100%
            </button>
          </Panel>

          {/* Loop region */}
          <Panel title="Zone de boucle">
            <button
              type="button"
              onClick={() => updateTransport({ loopEnabled: !transport.loopEnabled })}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                background:  transport.loopEnabled ? "var(--accent-dim)" : "var(--bg-2)",
                color:       transport.loopEnabled ? "var(--accent)"     : "var(--tx-2)",
                border:      transport.loopEnabled ? "1px solid var(--accent-line)" : "1px solid var(--sep-2)",
                transition: "all 0.15s",
              }}
            >
              {transport.loopEnabled ? "● Boucle active" : "Boucle"}
            </button>

            {transport.loopEnabled && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => updateTransport({ loopStartTick: activeTick })}
                  style={{
                    flex: 1, padding: "7px 8px", borderRadius: 7,
                    fontSize: 10, fontWeight: 600, cursor: "pointer",
                    background: "var(--bg-2)", color: "var(--tx-2)",
                    border: "1px solid var(--sep-2)",
                  }}
                >
                  [ENT] Marquer
                </button>
                <button
                  type="button"
                  onClick={() => updateTransport({ loopEndTick: activeTick })}
                  style={{
                    flex: 1, padding: "7px 8px", borderRadius: 7,
                    fontSize: 10, fontWeight: 600, cursor: "pointer",
                    background: "var(--bg-2)", color: "var(--tx-2)",
                    border: "1px solid var(--sep-2)",
                  }}
                >
                  [SOR] Marquer
                </button>
              </div>
            )}
          </Panel>

          {/* Project stats */}
          {project && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatCard label="Tempo"     value={`${project.tempoBpm.toFixed(0)} BPM`} />
              <StatCard label="Notes"     value={String(project.hits.length)} />
              <StatCard label="Vitesse"   value={`${speedPct}%`} />
              <StatCard label="Signature" value={`${project.timeSignature.numerator}/${project.timeSignature.denominator}`} />
            </div>
          )}
        </div>

        {/* ── Centre: score ── */}
        <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0, minHeight: 0, gap: 8, overflow: "hidden" }}>
          {project ? (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 12, background: "var(--bg-1)", border: "1px solid var(--sep-2)",
            }}>
              <p style={{ fontSize: 12, color: "var(--tx-3)", textAlign: "center" }}>
                {project.hits.length} notes · {project.tempoBpm} BPM<br />
                <span style={{ fontSize: 10, color: "var(--tx-4)" }}>Lecture via Transport</span>
              </p>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: "var(--bg-1)",
              border: "1px dashed var(--sep-2)",
            }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-2)", margin: "0 0 6px" }}>Aucun projet</p>
                <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0 }}>
                  Charge un fichier MIDI dans <span style={{ color: "var(--accent)" }}>Compose</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: metronome ── */}
        {showMetronome ? (
          <div className="slide-in-right" style={{ flexShrink: 0 }}>
            <MetronomePanel onClose={() => setShowMetronome(false)} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowMetronome(true)}
            style={{
              flexShrink: 0,
              height: 48,
              alignSelf: "flex-start",
              padding: "0 14px",
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              background: "var(--bg-1)",
              color: "var(--tx-3)",
              border: "1px solid var(--sep-2)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 13 }}>♩</span> Métro
          </button>
        )}
      </div>
    </div>
  );
};
