/**
 * Transport Bar — v3
 *
 * Clean SVG icons, refined layout. Logic Pro / Final Cut Pro aesthetic.
 * No emoji — proper iconography throughout.
 */

import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { DRUM_PIECE_LABELS, DRUM_PIECES_ORDERED, formatPosition } from "../../audio/transportController";
import type { DrumPiece } from "../../core/types";

// ─── SVG transport icons ──────────────────────────────────────────────────────

const IcoRewind = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M13 3L6 8l7 5V3z" fill="currentColor" opacity="0.85"/>
  </svg>
);

const IcoPrevMeasure = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M11 3L4 8l7 5V3z" fill="currentColor" opacity="0.85"/>
    <path d="M2 3v10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IcoPlay = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M4 3l10 5-10 5V3z" fill="currentColor"/>
  </svg>
);

const IcoPause = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="3"  y="3" width="4" height="10" rx="1" fill="currentColor"/>
    <rect x="9"  y="3" width="4" height="10" rx="1" fill="currentColor"/>
  </svg>
);

const IcoStop = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="currentColor"/>
  </svg>
);

const IcoLoop = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2.5 5.5a5.5 5.5 0 019 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M13.5 10.5a5.5 5.5 0 01-9 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M11.5 3.5l2 2-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.5 12.5l-2-2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IcoMetronome = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M8 2L4 14h8L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
    <line x1="8" y1="9" x2="11" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="8" cy="9" r="1.2" fill="currentColor"/>
  </svg>
);

const IcoMixer = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <line x1="3"  y1="4"  x2="3"  y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="8"  y1="4"  x2="8"  y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="13" y1="4"  x2="13" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="3"  cy="7"  r="2" fill="var(--bg-2)" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="8"  cy="9"  r="2" fill="var(--bg-2)" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="13" cy="6"  r="2" fill="var(--bg-2)" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Divider = () => (
  <div style={{ width: 1, height: 14, flexShrink: 0, background: "var(--sep)", margin: "0 2px" }} />
);

const StatusDot = ({ color, pulse = false }: { color: string; pulse?: boolean }) => (
  <span
    className={pulse ? "play-dot" : undefined}
    style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }}
  />
);

// ─── Icon transport button ────────────────────────────────────────────────────

const TrBtn = ({
  onClick, disabled = false, title, size = 28, active = false, children, playing = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  size?: number;
  active?: boolean;
  children: React.ReactNode;
  playing?: boolean;
}) => (
  <button
    type="button"
    className="tr-btn"
    disabled={disabled}
    title={title}
    onClick={onClick}
    style={{
      width: size,
      height: size,
      borderRadius: size >= 34 ? "50%" : undefined,
      background: playing
        ? "var(--c-green)"
        : active
        ? "var(--sel-bg)"
        : "transparent",
      color: playing
        ? "#fff"
        : active
        ? "var(--tx-2)"
        : "var(--tx-3)",
      border: `1px solid ${
        playing ? "transparent" :
        active  ? "var(--sel-border)"    :
        "transparent"
      }`,
      boxShadow: playing ? "0 2px 10px rgba(48,209,88,0.35)" : "none",
      transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
    }}
  >
    {children}
  </button>
);

// ─── Pill button ──────────────────────────────────────────────────────────────

const Pill = ({
  active = false, onClick, children, title,
}: {
  active?: boolean; onClick: () => void; children: React.ReactNode; title?: string;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 9px",
      borderRadius: 5,
      fontSize: 11,
      fontWeight: active ? 600 : 400,
      background: active ? "rgba(255,255,255,0.07)" : "transparent",
      color: active ? "var(--tx-2)" : "var(--tx-4)",
      border: `1px solid ${active ? "rgba(255,255,255,0.10)" : "transparent"}`,
      cursor: "pointer",
      transition: "all 0.12s",
      whiteSpace: "nowrap" as const,
      userSelect: "none" as const,
    }}
  >
    {children}
  </button>
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
    <span style={{ fontSize: 9, fontWeight: 500, color: muted ? "var(--tx-4)" : "var(--tx-3)", letterSpacing: "0.02em" }}>
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

  const ppq        = project?.ppq         ?? 480;
  const bpm        = project?.tempoBpm    != null ? Math.round(project.tempoBpm).toString() : null;
  const sig        = project ? `${project.timeSignature.numerator}/${project.timeSignature.denominator}` : null;
  const numerator  = project?.timeSignature.numerator ?? 4;
  const position   = formatPosition(activeTick, ppq, numerator);
  const hasSolo    = Object.values(transport.soloState).some(Boolean);
  const speedPct   = Math.round(transport.speed * 100);
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
      boxShadow: "0 1px 0 rgba(255,255,255,0.55) inset",
    }}>
      {/* ── Main row ── */}
      <div style={{
        display: "flex",
        flexWrap: "wrap" as const,
        alignItems: "center",
        gap: 6,
        padding: "7px 18px",
        minHeight: 54,
      }}>

        {/* Playback controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <TrBtn size={26} disabled={!hasProject} onClick={rewindToStart} title="Retour au début">
            <IcoRewind />
          </TrBtn>
          <TrBtn size={26} disabled={!hasProject} onClick={rewindMeasure} title="Mesure précédente">
            <IcoPrevMeasure />
          </TrBtn>

          {/* Play / Pause — primary action */}
          <TrBtn
            size={36}
            disabled={!hasProject}
            onClick={() => void (isPlaying ? pause() : play())}
            title="Lecture / Pause (Espace)"
            playing={isPlaying}
          >
            {isPlaying ? <IcoPause /> : <IcoPlay />}
          </TrBtn>

          <TrBtn size={26} disabled={!hasProject} onClick={stop} title="Stop (Échap)">
            <IcoStop />
          </TrBtn>
        </div>

        <Divider />

        {/* Position display */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "4px 12px", borderRadius: 10,
          background: "var(--bg-1)", border: "1px solid var(--sep)",
          flexShrink: 0, minWidth: 76,
        }}>
          <span style={{
            fontFamily: "monospace", fontSize: 12, fontWeight: 600,
            color: "var(--tx-2)", letterSpacing: "0.05em",
          }}>
            {position}
          </span>
          {isPlaying && <StatusDot color="var(--c-green)" pulse />}
          {isPaused  && <StatusDot color="var(--c-yellow)" />}
        </div>

        <Divider />

        {/* Speed */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, color: "var(--tx-4)", userSelect: "none", flexShrink: 0 }}>Vitesse</span>
          <input
            type="range" min={0.25} max={2} step={0.05}
            value={transport.speed}
            onChange={(e) => updateTransport({ speed: Number(e.target.value) })}
            className="compact-range"
            style={{ width: 68 }}
            title="Vitesse de lecture"
          />
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--tx-2)", width: 30, textAlign: "right", flexShrink: 0 }}>
            {speedPct}%
          </span>
          {transport.speed !== 1 && (
            <button
              type="button"
              onClick={() => updateTransport({ speed: 1 })}
              style={{
                fontSize: 10, color: "var(--tx-4)", background: "none",
                border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0,
              }}
              title="Réinitialiser à 100%"
            >
              1×
            </button>
          )}
        </div>

        <Divider />

        {/* Loop */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Pill
            active={transport.loopEnabled}
            onClick={() => updateTransport({ loopEnabled: !transport.loopEnabled })}
            title="Activer la boucle"
          >
            <IcoLoop />
            Boucle
          </Pill>
          {transport.loopEnabled && (
            <>
              <button
                type="button"
                onClick={() => updateTransport({ loopStartTick: activeTick })}
                style={{
                  padding: "2px 7px", borderRadius: 4, fontSize: 10, cursor: "pointer",
                  background: "var(--bg-3)", color: "var(--tx-3)",
                  border: "1px solid var(--sep)", fontFamily: "monospace",
                }}
                title="Marquer le début de boucle"
              >
                [ENT
              </button>
              <button
                type="button"
                onClick={() => updateTransport({ loopEndTick: activeTick })}
                style={{
                  padding: "2px 7px", borderRadius: 4, fontSize: 10, cursor: "pointer",
                  background: "var(--bg-3)", color: "var(--tx-3)",
                  border: "1px solid var(--sep)", fontFamily: "monospace",
                }}
                title="Marquer la fin de boucle"
              >
                SOR]
              </button>
            </>
          )}
        </div>

        <Divider />

        {/* Metronome + count-in */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Pill
            active={transport.metronomeEnabled}
            onClick={() => updateTransport({ metronomeEnabled: !transport.metronomeEnabled })}
            title="Métronome"
          >
            <IcoMetronome />
            Métro
          </Pill>
          <Pill
            active={transport.countInBars > 0}
            onClick={() => {
              const cycle = [0, 1, 2, 4] as const;
              const idx = cycle.indexOf(transport.countInBars as 0 | 1 | 2 | 4);
              updateTransport({ countInBars: cycle[(idx + 1) % cycle.length] });
            }}
            title="Décompte avant lecture"
          >
            {transport.countInBars === 0 ? "Décompte" : `${transport.countInBars}m av.`}
          </Pill>
        </div>

        {/* Right: BPM + 4/4 + Mixeur */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          {bpm && sig && (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "0 12px", borderRadius: 10, height: 30,
                background: "var(--bg-1)", border: "1px solid var(--sep)", flexShrink: 0,
              }}>
                <span style={{ fontSize: 9, color: "var(--tx-4)", fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase" as const }}>BPM</span>
                <span style={{
                  fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em",
                  color: isPlaying ? "var(--c-green)" : "var(--tx-1)", transition: "color 0.3s",
                }}>
                  {bpm}
                </span>
                {isPlaying && <span className="play-dot" style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--c-green)", flexShrink: 0 }} />}
              </div>
              <button
                type="button"
                style={{
                  display: "flex", alignItems: "center", gap: 4, height: 30,
                  padding: "0 10px", borderRadius: 10,
                  background: "var(--bg-1)", border: "1px solid var(--sep)",
                  color: "var(--tx-2)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "monospace", flexShrink: 0, transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-4)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-3)"; }}
              >
                {sig}
                <svg width="7" height="4" viewBox="0 0 7 4" fill="none">
                  <path d="M1 0.5l2.5 3 2.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <Divider />
            </>
          )}
          <Pill
            active={showMixer}
            onClick={() => setShowMixer((v) => !v)}
            title="Mixeur d'instruments"
          >
            <IcoMixer />
            Mixeur
            {hasSolo && (
              <span style={{
                padding: "0 4px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                background: "rgba(255,214,10,0.15)", color: "var(--c-yellow)",
              }}>
                SOLO
              </span>
            )}
          </Pill>
        </div>
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
              muted={!!transport.muteState[piece]}
              soloed={!!transport.soloState[piece]}
              onMute={() => toggleMute(piece)}
              onSolo={() => toggleSolo(piece)}
            />
          ))}
          {(Object.values(transport.muteState).some(Boolean) || hasSolo) && (
            <button
              type="button"
              onClick={() => updateTransport({ muteState: {}, soloState: {} })}
              style={{
                marginLeft: "auto", padding: "3px 8px", borderRadius: 5, fontSize: 10,
                background: "transparent", color: "var(--tx-3)",
                border: "1px solid var(--sep)", cursor: "pointer",
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
