/**
 * Practice Page
 *
 * Focused on tempo training, looping, and playback-as-practice.
 * No editing — pure performance and learning tools.
 */

import { useState } from "react";
import { TransportBar }    from "../components/TransportBar";
import { MetronomePanel }  from "../components/MetronomePanel";
import { ScoreCanvas }     from "../components/ScoreCanvas";
import { useProjectStore } from "../../store/projectStore";

// ─── Speed trainer ────────────────────────────────────────────────────────────

const SPEED_PRESETS = [
  { label: "50%",  value: 0.50 },
  { label: "60%",  value: 0.60 },
  { label: "75%",  value: 0.75 },
  { label: "85%",  value: 0.85 },
  { label: "100%", value: 1.00 },
  { label: "110%", value: 1.10 },
  { label: "120%", value: 1.20 },
];

// ─── Stat block ───────────────────────────────────────────────────────────────

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl p-3" style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}>
    <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{label}</p>
    <p className="mt-1 text-lg font-black font-mono" style={{ color: "var(--text-1)" }}>{value}</p>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const PracticePage = () => {
  const {
    project, rhythm, activeTick, zoomX,
    transport, updateTransport, heatmap, preview,
    sections, limbMap,
  } = useProjectStore();

  const [showMetronome, setShowMetronome] = useState(true);
  const speedPct = Math.round(transport.speed * 100);

  return (
    <div className="flex h-full flex-col section-fade-in" style={{ background: "var(--bg-base)" }}>
      {/* Transport */}
      <TransportBar />

      <div className="flex min-h-0 flex-1 gap-3 p-3 overflow-hidden">

        {/* ── Left column: practice tools ── */}
        <div className="flex w-72 shrink-0 flex-col gap-3">

          {/* Speed trainer */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Speed Trainer
            </p>

            {/* Current speed display */}
            <div className="text-center py-2">
              <span className="text-4xl font-black font-mono" style={{ color: "var(--accent)" }}>
                {speedPct}%
              </span>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-3)" }}>
                {project ? `${Math.round(project.tempoBpm * transport.speed)} BPM effectif` : "Aucun projet"}
              </p>
            </div>

            {/* Speed slider */}
            <input
              type="range" min={0.25} max={1.5} step={0.05}
              value={transport.speed}
              onChange={(e) => updateTransport({ speed: Number(e.target.value) })}
              className="w-full accent-cyan-500"
            />

            {/* Presets */}
            <div className="grid grid-cols-4 gap-1">
              {SPEED_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => updateTransport({ speed: p.value })}
                  className="rounded py-1.5 text-[10px] font-semibold transition"
                  style={Math.abs(transport.speed - p.value) < 0.02
                    ? { background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }
                    : { background: "var(--bg-2)", color: "var(--text-3)", border: "1px solid var(--border-1)" }
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => updateTransport({ speed: 1 })}
              disabled={transport.speed === 1}
              className="w-full rounded-lg py-1.5 text-[11px] font-semibold transition disabled:opacity-30"
              style={{ background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}
            >
              Reset to 100%
            </button>
          </div>

          {/* Loop section */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "var(--bg-1)", border: "1px solid var(--border-2)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Loop Region
            </p>
            <button
              type="button"
              onClick={() => updateTransport({ loopEnabled: !transport.loopEnabled })}
              className="w-full rounded-lg py-2 text-[11px] font-semibold transition"
              style={transport.loopEnabled
                ? { background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }
                : { background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border-2)" }
              }
            >
              {transport.loopEnabled ? "● Loop Actif" : "Loop"}
            </button>
            {transport.loopEnabled && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateTransport({ loopStartTick: activeTick })}
                    className="flex-1 rounded-lg py-1.5 text-[10px] font-semibold"
                    style={{ background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}
                  >
                    [IN] Marquer
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTransport({ loopEndTick: activeTick })}
                    className="flex-1 rounded-lg py-1.5 text-[10px] font-semibold"
                    style={{ background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}
                  >
                    [OUT] Marquer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Project stats */}
          {project && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Tempo" value={`${project.tempoBpm.toFixed(0)} BPM`} />
              <Stat label="Hits"  value={String(project.hits.length)} />
              <Stat label="Vitesse" value={`${speedPct}%`} />
              <Stat label="Signature" value={`${project.timeSignature.numerator}/${project.timeSignature.denominator}`} />
            </div>
          )}
        </div>

        {/* ── Centre: score view or metronome only ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {project && rhythm ? (
            <ScoreCanvas
              rhythm={rhythm} ppq={project.ppq} signature={project.timeSignature}
              activeTick={activeTick} zoomX={zoomX} zoomY={1}
              heatmap={heatmap} cleanup={{ enabled: false }} previewEnabled={preview.enabled}
              hits={project.hits} limbMap={limbMap}
              showLimbAnalysis={false} playabilityMap={{}} showPlayabilityOverlay={false}
              sections={sections} showSectionTimeline={false}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl"
              style={{ background: "var(--bg-1)", border: "1px dashed var(--border-2)" }}>
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>Aucun projet</p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  Charge un fichier MIDI dans <strong style={{ color: "var(--accent)" }}>Compose</strong>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: metronome ── */}
        {showMetronome && (
          <div className="panel-slide-in shrink-0">
            <MetronomePanel onClose={() => setShowMetronome(false)} />
          </div>
        )}
        {!showMetronome && (
          <button
            type="button"
            onClick={() => setShowMetronome(true)}
            className="flex shrink-0 h-12 items-center justify-center rounded-xl px-3 text-[10px] font-semibold transition"
            style={{ background: "var(--bg-1)", color: "var(--text-3)", border: "1px solid var(--border-2)" }}
          >
            ♩ Métro
          </button>
        )}
      </div>
    </div>
  );
};
