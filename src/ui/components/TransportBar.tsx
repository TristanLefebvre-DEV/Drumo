/**
 * Transport Bar — Logic Pro / Final Cut Pro style
 *
 * Clean, uncluttered transport: play/pause/stop/rewind | BPM | position |
 * speed | loop | metronome.  No color theatrics — just clarity.
 */

import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { DRUM_PIECE_LABELS, DRUM_PIECES_ORDERED, formatPosition } from "../../audio/transportController";
import type { DrumPiece } from "../../core/types";

// ─── Primitive styles ─────────────────────────────────────────────────────────

const iconBtnStyle = (active = false): React.CSSProperties => ({
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  fontSize: 13,
  background: active ? "rgba(255,255,255,0.09)" : "transparent",
  color: active ? "var(--tx-1)" : "var(--tx-3)",
  border: `1px solid ${active ? "rgba(255,255,255,0.12)" : "transparent"}`,
  cursor: "pointer",
  transition: "all 0.12s",
  flexShrink: 0,
});

const pillBtnStyle = (active = false): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 8px",
  borderRadius: 5,
  fontSize: 11,
  fontWeight: active ? 600 : 400,
  background: active ? "rgba(255,255,255,0.08)" : "transparent",
  color: active ? "var(--tx-2)" : "var(--tx-4)",
  border: `1px solid ${active ? "rgba(255,255,255,0.11)" : "transparent"}`,
  cursor: "pointer",
  transition: "all 0.12s",
  whiteSpace: "nowrap" as const,
});

const Divider = () => (
  <div style={{ width: 1, height: 16, flexShrink: 0, background: "var(--sep)" }} />
);

// ─── Mixer strip ──────────────────────────────────────────────────────────────

const MixerStrip = ({
  piece, muted, soloed, onMute, onSolo,
}: { piece: DrumPiece; muted: boolean; soloed: boolean; onMute: () => void; onSolo: () => void }) => (
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    padding: "4px 6px", borderRadius: 5,
    background: "var(--bg-3)", border: "1px solid var(--sep)",
  }}>
    <span style={{ fontSize: 9, fontWeight: 500, color: muted ? "var(--tx-4)" : "var(--tx-3)" }}>
      {DRUM_PIECE_LABELS[piece]}
    </span>
    <div style={{ display: "flex", gap: 2 }}>
      {[
        { label: "M", active: muted,  color: "var(--c-red)",    onClick: onMute },
        { label: "S", active: soloed, color: "var(--c-yellow)", onClick: onSolo },
      ].map(({ label, active, color, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          style={{
            width: 18, height: 16, borderRadius: 3, fontSize: 9, fontWeight: 700,
            cursor: "pointer",
            background: active ? color : "var(--bg-4)",
            color: active ? "#fff" : "var(--tx-4)",
            border: "none",
            transition: "all 0.1s",
          }}
        >{label}</button>
      ))}
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const TransportBar = () => {
  const {
    project, activeTick, isPlaying, isPaused,
    transport, play, pause, stop, rewindToStart, rewindMeasure, updateTransport,
  } = useProjectStore();

  const [showMixer, setShowMixer] = useState(false);

  const ppq       = project?.ppq         ?? 480;
  const numerator = project?.timeSignature.numerator ?? 4;
  const bpm       = project?.tempoBpm    ?? 120;
  const position  = formatPosition(activeTick, ppq, numerator);
  const hasSolo   = Object.values(transport.soloState).some(Boolean);
  const speedPct  = Math.round(transport.speed * 100);

  const toggleMute = (piece: DrumPiece) =>
    updateTransport({ muteState: { ...transport.muteState, [piece]: !transport.muteState[piece] } });
  const toggleSolo = (piece: DrumPiece) =>
    updateTransport({ soloState: { ...transport.soloState, [piece]: !transport.soloState[piece] } });

  return (
    <div style={{
      flexShrink: 0,
      background: "var(--bg-1)",
      borderBottom: "1px solid var(--sep)",
    }}>
      {/* ── Main row ── */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        minHeight: 38,
      }}>

        {/* Playback controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button type="button" style={iconBtnStyle()} onClick={rewindToStart} title="Début (Home)">
            ⏮
          </button>
          <button type="button" style={iconBtnStyle()} onClick={rewindMeasure} title="Mesure précédente">
            ◂◂
          </button>

          {/* Play / Pause — larger, slightly prominent */}
          <button
            type="button"
            disabled={!project}
            onClick={() => void (isPlaying ? pause() : play())}
            title="Play / Pause (Espace)"
            style={{
              width: 32, height: 32, borderRadius: 7, display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
              background: isPlaying ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.07)",
              color: "var(--tx-1)", border: "1px solid rgba(255,255,255,0.12)",
              fontSize: 14, cursor: project ? "pointer" : "not-allowed",
              opacity: project ? 1 : 0.3, transition: "all 0.12s",
            }}
          >
            {isPlaying ? "⏸" : isPaused ? "▶" : "▶"}
          </button>

          <button type="button" style={iconBtnStyle()} onClick={stop} title="Stop (Esc)">⏹</button>
        </div>

        <Divider />

        {/* BPM + position */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "3px 10px", borderRadius: 6,
          background: "var(--bg-2)", border: "1px solid var(--sep)",
        }}>
          <span style={{ fontSize: 10, color: "var(--tx-4)", fontWeight: 500 }}>BPM</span>
          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "var(--tx-1)" }}>{bpm}</span>
          <span style={{ width: 1, height: 12, background: "var(--sep)", display: "inline-block" }} />
          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "var(--tx-2)" }}>
            {position}
          </span>
          {/* Subtle playing indicator */}
          {isPlaying && (
            <span className="play-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--c-green)", display: "inline-block" }} />
          )}
        </div>

        <Divider />

        {/* Speed */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, color: "var(--tx-4)" }}>Vitesse</span>
          <input
            type="range" min={0.25} max={2} step={0.05}
            value={transport.speed}
            onChange={(e) => updateTransport({ speed: Number(e.target.value) })}
            style={{ width: 72, accentColor: "var(--tx-3)" }}
            title="Vitesse de lecture"
          />
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--tx-2)", width: 30, textAlign: "right" }}>
            {speedPct}%
          </span>
          {transport.speed !== 1 && (
            <button
              type="button"
              onClick={() => updateTransport({ speed: 1 })}
              style={{ fontSize: 10, color: "var(--tx-4)", background: "none", border: "none", cursor: "pointer" }}
            >1×</button>
          )}
        </div>

        <Divider />

        {/* Loop */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <button type="button" style={pillBtnStyle(transport.loopEnabled)}
            onClick={() => updateTransport({ loopEnabled: !transport.loopEnabled })}>
            <span style={{ width: 5, height: 5, borderRadius: "50%",
              background: transport.loopEnabled ? "var(--c-green)" : "var(--tx-4)" }} />
            Loop
          </button>
          {transport.loopEnabled && (<>
            <button type="button"
              onClick={() => updateTransport({ loopStartTick: activeTick })}
              style={{ ...pillBtnStyle(), fontSize: 10 }}
            >[IN</button>
            <button type="button"
              onClick={() => updateTransport({ loopEndTick: activeTick })}
              style={{ ...pillBtnStyle(), fontSize: 10 }}
            >OUT]</button>
          </>)}
        </div>

        <Divider />

        {/* Metronome + count-in */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <button type="button"
            style={pillBtnStyle(transport.metronomeEnabled)}
            onClick={() => updateTransport({ metronomeEnabled: !transport.metronomeEnabled })}>
            <span style={{ width: 5, height: 5, borderRadius: "50%",
              background: transport.metronomeEnabled ? "var(--c-yellow)" : "var(--tx-4)" }} />
            Metro
          </button>
          <button type="button"
            style={pillBtnStyle(transport.countInBars > 0)}
            onClick={() => {
              const cycle = [0, 1, 2, 4] as const;
              const idx = cycle.indexOf(transport.countInBars as 0|1|2|4);
              updateTransport({ countInBars: cycle[(idx + 1) % cycle.length] });
            }}>
            {transport.countInBars === 0 ? "Count-in" : `${transport.countInBars}m in`}
          </button>
        </div>

        {/* Mixer toggle */}
        <button
          type="button"
          onClick={() => setShowMixer((v) => !v)}
          style={{ ...pillBtnStyle(showMixer), marginLeft: "auto" }}
        >
          Mixer
          {hasSolo && (
            <span style={{
              padding: "0 4px", borderRadius: 4, fontSize: 9, fontWeight: 700,
              background: "rgba(255,214,10,0.15)", color: "var(--c-yellow)",
            }}>SOLO</span>
          )}
        </button>
      </div>

      {/* ── Mixer strip ── */}
      {showMixer && (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 4,
          padding: "4px 10px 6px",
          borderTop: "1px solid var(--sep)",
          background: "var(--bg-1)",
        }}>
          <span style={{ fontSize: 10, color: "var(--tx-4)", marginRight: 2 }}>Instruments</span>
          {DRUM_PIECES_ORDERED.map((piece) => (
            <MixerStrip
              key={piece} piece={piece}
              muted={!!transport.muteState[piece]} soloed={!!transport.soloState[piece]}
              onMute={() => toggleMute(piece)} onSolo={() => toggleSolo(piece)}
            />
          ))}
          {(Object.values(transport.muteState).some(Boolean) || hasSolo) && (
            <button
              type="button"
              onClick={() => updateTransport({ muteState: {}, soloState: {} })}
              style={{
                marginLeft: "auto", padding: "3px 8px", borderRadius: 5, fontSize: 10,
                background: "transparent", color: "var(--tx-3)", border: "1px solid var(--sep)", cursor: "pointer",
              }}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
};
