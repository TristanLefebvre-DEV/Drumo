/**
 * Transport Bar — Logic Pro / Final Cut Pro style
 *
 * App-level transport: play/pause/stop/rewind | position | speed | loop |
 * metronome | optional mixer strip.
 * No colour theatrics — clarity first.
 */

import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { DRUM_PIECE_LABELS, DRUM_PIECES_ORDERED, formatPosition } from "../../audio/transportController";
import type { DrumPiece } from "../../core/types";

// ─── Style helpers ────────────────────────────────────────────────────────────

const iconBtn = (active = false, size = 28): React.CSSProperties => ({
  width: size,
  height: size,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  fontSize: 12,
  background: active ? "rgba(255,255,255,0.09)" : "transparent",
  color: active ? "var(--tx-1)" : "var(--tx-3)",
  border: `1px solid ${active ? "rgba(255,255,255,0.12)" : "transparent"}`,
  cursor: "pointer",
  transition: "all 0.12s",
  flexShrink: 0,
  userSelect: "none" as const,
});

const pill = (active = false): React.CSSProperties => ({
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
  userSelect: "none" as const,
});

const Divider = () => (
  <div style={{ width: 1, height: 16, flexShrink: 0, background: "var(--sep)", margin: "0 1px" }} />
);

// ─── Status dot ───────────────────────────────────────────────────────────────

const StatusDot = ({ color, pulse = false }: { color: string; pulse?: boolean }) => (
  <span
    className={pulse ? "play-dot" : undefined}
    style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }}
  />
);

// ─── Mixer strip ──────────────────────────────────────────────────────────────

const MixerStrip = ({
  piece, muted, soloed, onMute, onSolo,
}: { piece: DrumPiece; muted: boolean; soloed: boolean; onMute: () => void; onSolo: () => void }) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    padding: "4px 6px",
    borderRadius: 6,
    background: "var(--bg-3)",
    border: "1px solid var(--sep)",
    flexShrink: 0,
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
  const position  = formatPosition(activeTick, ppq, numerator);
  const hasSolo   = Object.values(transport.soloState).some(Boolean);
  const speedPct  = Math.round(transport.speed * 100);
  const hasProject = !!project;

  const toggleMute = (piece: DrumPiece) =>
    updateTransport({ muteState: { ...transport.muteState, [piece]: !transport.muteState[piece] } });
  const toggleSolo = (piece: DrumPiece) =>
    updateTransport({ soloState: { ...transport.soloState, [piece]: !transport.soloState[piece] } });

  return (
    <div style={{
      flexShrink: 0,
      background: "var(--bg-2)",
      borderBottom: "1px solid var(--sep)",
    }}>
      {/* ── Main row ── */}
      <div style={{
        display: "flex",
        flexWrap: "wrap" as const,
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        minHeight: 38,
      }}>

        {/* Playback controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button type="button" style={iconBtn()} onClick={rewindToStart} title="Aller au début (Origine)" disabled={!hasProject}>
            ⏮
          </button>
          <button type="button" style={iconBtn()} onClick={rewindMeasure} title="Mesure précédente" disabled={!hasProject}>
            ◂◂
          </button>

          {/* Play / Pause — slightly larger */}
          <button
            type="button"
            disabled={!hasProject}
            onClick={() => void (isPlaying ? pause() : play())}
            title="Lecture / Pause (Espace)"
            style={{
              width: 34, height: 34, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              background: isPlaying
                ? "rgba(48,209,88,0.15)"
                : "rgba(255,255,255,0.07)",
              color: isPlaying ? "var(--c-green)" : "var(--tx-1)",
              border: isPlaying
                ? "1px solid rgba(48,209,88,0.25)"
                : "1px solid rgba(255,255,255,0.12)",
              fontSize: 14,
              cursor: hasProject ? "pointer" : "not-allowed",
              opacity: hasProject ? 1 : 0.35,
              transition: "all 0.15s",
            }}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          <button type="button" style={iconBtn()} onClick={stop} title="Stop (Échap)" disabled={!hasProject}>
            ⏹
          </button>
        </div>

        <Divider />

        {/* Position display */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "3px 10px", borderRadius: 6,
          background: "var(--bg-3)", border: "1px solid var(--sep)",
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "var(--tx-2)", letterSpacing: "0.04em" }}>
            {position}
          </span>
          {isPlaying && <StatusDot color="var(--c-green)" pulse />}
          {isPaused  && <StatusDot color="var(--c-yellow)" />}
        </div>

        <Divider />

        {/* Speed */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, color: "var(--tx-4)", userSelect: "none" }}>Vitesse</span>
          <input
            type="range" min={0.25} max={2} step={0.05}
            value={transport.speed}
            onChange={(e) => updateTransport({ speed: Number(e.target.value) })}
            style={{ width: 72, accentColor: "var(--tx-3)" }}
            title="Vitesse de lecture"
          />
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--tx-2)", width: 32, textAlign: "right" }}>
            {speedPct}%
          </span>
          {transport.speed !== 1 && (
            <button
              type="button"
              onClick={() => updateTransport({ speed: 1 })}
              style={{ fontSize: 10, color: "var(--tx-4)", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
              title="Réinitialiser à 100%"
            >1×</button>
          )}
        </div>

        <Divider />

        {/* Loop */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <button type="button" style={pill(transport.loopEnabled)}
            onClick={() => updateTransport({ loopEnabled: !transport.loopEnabled })}>
            <StatusDot color={transport.loopEnabled ? "var(--c-green)" : "var(--tx-4)"} />
            Boucle
          </button>
          {transport.loopEnabled && (<>
            <button type="button"
              onClick={() => updateTransport({ loopStartTick: activeTick })}
              style={{ ...pill(), fontSize: 10 }}
              title="Marquer le début"
            >
              [ENT
            </button>
            <button type="button"
              onClick={() => updateTransport({ loopEndTick: activeTick })}
              style={{ ...pill(), fontSize: 10 }}
              title="Marquer la fin"
            >
              SOR]
            </button>
          </>)}
        </div>

        <Divider />

        {/* Metronome + count-in */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <button type="button"
            style={pill(transport.metronomeEnabled)}
            onClick={() => updateTransport({ metronomeEnabled: !transport.metronomeEnabled })}>
            <StatusDot color={transport.metronomeEnabled ? "var(--c-yellow)" : "var(--tx-4)"} />
            Métro
          </button>
          <button type="button"
            style={pill(transport.countInBars > 0)}
            title="Count-in bars — click to cycle"
            onClick={() => {
              const cycle = [0, 1, 2, 4] as const;
              const idx = cycle.indexOf(transport.countInBars as 0|1|2|4);
              updateTransport({ countInBars: cycle[(idx + 1) % cycle.length] });
            }}>
            {transport.countInBars === 0 ? "Décompte" : `${transport.countInBars}m av.`}
          </button>
        </div>

        {/* Mixer toggle — pushed to right */}
        <button
          type="button"
          onClick={() => setShowMixer((v) => !v)}
          style={{ ...pill(showMixer), marginLeft: "auto" }}
        >
          Mixeur
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
          flexWrap: "wrap" as const,
          alignItems: "center",
          gap: 4,
          padding: "5px 12px 7px",
          borderTop: "1px solid var(--sep)",
          background: "var(--bg-1)",
        }}>
          <span style={{ fontSize: 10, color: "var(--tx-4)", marginRight: 4, userSelect: "none" }}>
            Instruments
          </span>
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
              Effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
};
