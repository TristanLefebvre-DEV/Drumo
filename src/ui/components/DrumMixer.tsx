/**
 * Mixeur de batterie — v2
 *
 * Interface inspirée des vraies consoles de mixage :
 *   • Faders verticaux réalistes avec handle
 *   • VU-mètres animés (simulation basée sur hits proches du tick actuel)
 *   • Panoramique gauche/droite par canal
 *   • Mute / Solo par canal
 *   • Fader master
 *   • Remise à zéro par canal ou global
 *
 * Entièrement en français, CSS variables, sans Tailwind zinc.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore";
import type { DrumKitMixer } from "../../audio/drumKitManager";

// ─── Configuration des canaux ─────────────────────────────────────────────────

interface ChannelDef {
  key:        keyof DrumKitMixer;
  label:      string;
  shortLabel: string;
  color:      string;
  pieces:     string[];   // drum pieces mapped to this channel (for VU simulation)
}

const CHANNELS: ChannelDef[] = [
  { key: "kickVolume",   label: "Grosse Caisse", shortLabel: "GC",  color: "#3b82f6", pieces: ["kick"]                                      },
  { key: "snareVolume",  label: "Caisse Claire",  shortLabel: "CC",  color: "#ef4444", pieces: ["snare", "snareRim"]                          },
  { key: "hihatVolume",  label: "Hi-Hat",         shortLabel: "HH",  color: "#22c55e", pieces: ["hihatClosed", "hihatOpen", "hihatPedal"]     },
  { key: "cymbalVolume", label: "Cymbales",        shortLabel: "CY",  color: "#f59e0b", pieces: ["crash", "ride", "splash", "otherCymbal"]    },
  { key: "tomVolume",    label: "Toms",            shortLabel: "TM",  color: "#8b5cf6", pieces: ["tomHigh", "tomMid", "tomLow"]               },
  { key: "roomAmount",   label: "Réverbe",         shortLabel: "RV",  color: "#64748b", pieces: []                                            },
];

// ─── Hook VU-mètre ────────────────────────────────────────────────────────────
// Simule les niveaux de sortie à partir des hits proches du tick actuel.

function useVuMeter(channelPieces: string[]): number {
  const [level, setLevel] = useState(0);
  const decayRef = useRef(0);
  const rafRef   = useRef<number>(0);

  const { isPlaying } = useProjectStore.getState();

  // Rafraîchissement par animation frame pendant la lecture
  useEffect(() => {
    if (!isPlaying) { setLevel(0); return; }

    const tick = () => {
      const state = useProjectStore.getState();
      if (!state.isPlaying) { setLevel(0); return; }

      // Cherche des hits récents (fenêtre de 60 ticks ~= 1 croche à 120 BPM)
      const window = 60;
      const now = state.activeTick;
      const hit = state.quantizedHits?.some(
        (h) => channelPieces.includes(h.piece) && Math.abs(h.tick - now) < window
      );

      if (hit) {
        // Spike immédiat
        decayRef.current = 0.92 + Math.random() * 0.07;
      } else {
        decayRef.current *= 0.88; // décroissance naturelle
      }

      setLevel(decayRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, channelPieces.join()]);

  return level;
}

// ─── VU-mètre visuel ──────────────────────────────────────────────────────────

const VuMeter = ({
  level, color, muted,
}: {
  level: number; color: string; muted: boolean;
}) => {
  const SEGMENTS = 12;
  const activeCount = muted ? 0 : Math.round(level * SEGMENTS);
  const warningAt   = Math.round(SEGMENTS * 0.75);
  const peakAt      = Math.round(SEGMENTS * 0.90);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 2,
      width: 8,
    }}>
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const segIdx  = SEGMENTS - 1 - i; // top = peak
        const isActive = segIdx < activeCount;
        const isPeak   = segIdx >= peakAt;
        const isWarn   = segIdx >= warningAt && !isPeak;
        return (
          <div
            key={i}
            style={{
              height: 4,
              borderRadius: 1,
              background: isActive
                ? isPeak   ? "#ff453a"
                : isWarn   ? "#ffd60a"
                : color
                : "var(--bg-4)",
              transition: "background 0.04s",
              opacity: isActive ? 1 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
};

// ─── Knob panoramique ─────────────────────────────────────────────────────────
// Pan -100 (gauche) ↔ 0 (centre) ↔ +100 (droite)

const PanKnob = ({
  value, onChange, color,
}: {
  value: number; onChange: (v: number) => void; color: string;
}) => {
  const dragging = useRef(false);
  const startY   = useRef(0);
  const startVal = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current   = e.clientY;
    startVal.current = value;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = (startY.current - e.clientY) * 2;
      onChange(Math.max(-100, Math.min(100, Math.round(startVal.current + delta))));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [onChange]);

  // Angle: -135° à gauche, 0° au centre, +135° à droite
  const angle = (value / 100) * 135;
  const isCentered = Math.abs(value) < 5;

  return (
    <div
      style={{
        width: 24, height: 24, position: "relative", cursor: "ns-resize",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onChange(0)}
      title={`Pan: ${value > 0 ? "D" : value < 0 ? "G" : "C"} ${Math.abs(value) || ""}${Math.abs(value) ? "%" : "entre"}`}
    >
      {/* Arc de fond */}
      <svg width="24" height="24" viewBox="0 0 24 24" style={{ position: "absolute", inset: 0 }}>
        <circle cx="12" cy="12" r="9" fill="var(--bg-4)" stroke="var(--sep-2)" strokeWidth="1"/>
        {/* Arc coloré selon la valeur */}
        {!isCentered && (
          <circle
            cx="12" cy="12" r="9"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeDasharray={`${Math.abs(value) / 100 * 28} 56`}
            strokeDashoffset={value > 0 ? -14 : 14 - Math.abs(value) / 100 * 28}
            strokeLinecap="round"
            opacity="0.6"
          />
        )}
        {/* Indicateur (ligne) */}
        <line
          x1="12" y1="12"
          x2={12 + 7 * Math.sin((angle * Math.PI) / 180)}
          y2={12 - 7 * Math.cos((angle * Math.PI) / 180)}
          stroke={isCentered ? "var(--tx-3)" : color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2" fill={isCentered ? "var(--tx-4)" : color} opacity="0.8"/>
      </svg>
    </div>
  );
};

// ─── Bande de canal ───────────────────────────────────────────────────────────

interface ChannelStripProps {
  def:        ChannelDef;
  volume:     number;        // 0–1
  pan:        number;        // -100 à +100
  muted:      boolean;
  soloed:     boolean;
  anySoloed:  boolean;
  onVolume:   (v: number) => void;
  onPan:      (v: number) => void;
  onMute:     () => void;
  onSolo:     () => void;
  onReset:    () => void;
}

const ChannelStrip = ({
  def, volume, pan, muted, soloed, anySoloed,
  onVolume, onPan, onMute, onSolo, onReset,
}: ChannelStripProps) => {
  const vuLevel = useVuMeter(def.pieces);
  const dimmed  = anySoloed && !soloed;
  const pct     = Math.round(volume * 100);
  const effectiveDim = (muted || dimmed) && !soloed;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 5,
      padding: "8px 6px",
      borderRadius: 10,
      border: `1px solid ${
        soloed ? "var(--c-yellow)"
        : muted ? "var(--sep)"
        : "var(--sep-2)"
      }`,
      background: soloed
        ? "rgba(255,214,10,0.05)"
        : muted
        ? "var(--bg-1)"
        : "var(--bg-2)",
      opacity: effectiveDim ? 0.35 : 1,
      transition: "opacity 0.2s, border-color 0.2s, background 0.2s",
      minWidth: 48,
    }}>

      {/* Nom du canal */}
      <span style={{
        fontSize: 8, fontWeight: 700,
        textTransform: "uppercase" as const, letterSpacing: "0.08em",
        color: soloed ? "var(--c-yellow)" : muted ? "var(--tx-4)" : "var(--tx-3)",
        textAlign: "center",
      }}>
        {def.shortLabel}
      </span>

      {/* Indicateur couleur */}
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        backgroundColor: muted ? "var(--tx-4)" : def.color,
        boxShadow: !muted ? `0 0 6px 1px ${def.color}55` : "none",
        transition: "all 0.2s",
      }} />

      {/* VU-mètre + Fader (côte à côte) */}
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 100 }}>
        {/* VU-mètre */}
        <VuMeter level={vuLevel} color={def.color} muted={muted} />

        {/* Fader vertical */}
        <div style={{
          position: "relative",
          width: 14,
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {/* Rail */}
          <div style={{
            position: "absolute",
            left: "50%", transform: "translateX(-50%)",
            width: 3, height: "100%",
            borderRadius: 3,
            background: "var(--bg-4)",
            overflow: "hidden",
          }}>
            {/* Remplissage coloré */}
            <div style={{
              position: "absolute",
              bottom: 0, width: "100%",
              height: `${pct}%`,
              background: muted ? "var(--tx-4)" : def.color,
              opacity: 0.5,
              transition: "height 0.08s",
            }} />
          </div>

          {/* Input range vertical */}
          <input
            type="range"
            min={0} max={100} step={1}
            value={pct}
            onChange={(e) => onVolume(parseInt(e.target.value, 10) / 100)}
            disabled={muted}
            style={{
              position: "absolute",
              writingMode: "vertical-lr",
              direction: "rtl",
              WebkitAppearance: "slider-vertical",
              width: 14,
              height: "100%",
              opacity: 0,
              cursor: muted ? "not-allowed" : "pointer",
              zIndex: 2,
            } as React.CSSProperties}
            title={`${def.label}: ${pct}%`}
          />

          {/* Handle visuel du fader */}
          <div style={{
            position: "absolute",
            bottom: `calc(${pct}% - 8px)`,
            left: "50%", transform: "translateX(-50%)",
            width: 14, height: 16,
            borderRadius: 3,
            background: muted ? "var(--bg-4)" : "var(--bg-3)",
            border: `1.5px solid ${muted ? "var(--sep)" : def.color}`,
            boxShadow: muted ? "none" : "0 1px 4px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            transition: "border-color 0.15s",
          }} />
        </div>
      </div>

      {/* Valeur numérique */}
      <span style={{
        fontSize: 9, fontFamily: "monospace", fontWeight: 600,
        color: muted ? "var(--tx-4)" : pct < 80 ? "var(--tx-3)" : "var(--tx-2)",
        letterSpacing: "0.02em",
      }}>
        {pct}%
      </span>

      {/* Panoramique */}
      <PanKnob value={pan} onChange={onPan} color={def.color} />
      <span style={{ fontSize: 8, color: "var(--tx-4)", fontFamily: "monospace" }}>
        {pan === 0 ? "C" : pan > 0 ? `D${pan}` : `G${-pan}`}
      </span>

      {/* Mute */}
      <button
        type="button"
        onClick={onMute}
        title={muted ? "Activer" : "Couper (Mute)"}
        style={{
          width: 28, height: 18, borderRadius: 4, fontSize: 8, fontWeight: 800,
          cursor: "pointer", letterSpacing: "0.06em",
          background: muted ? "rgba(255,69,58,0.25)"  : "var(--bg-3)",
          color:      muted ? "var(--c-red)"          : "var(--tx-4)",
          border:     `1px solid ${muted ? "rgba(255,69,58,0.40)" : "var(--sep)"}`,
          transition: "all 0.12s",
        }}
      >
        M
      </button>

      {/* Solo */}
      <button
        type="button"
        onClick={onSolo}
        title={soloed ? "Annuler solo" : "Solo"}
        style={{
          width: 28, height: 18, borderRadius: 4, fontSize: 8, fontWeight: 800,
          cursor: "pointer", letterSpacing: "0.06em",
          background: soloed ? "rgba(255,214,10,0.25)" : "var(--bg-3)",
          color:      soloed ? "var(--c-yellow)"       : "var(--tx-4)",
          border:     `1px solid ${soloed ? "rgba(255,214,10,0.40)" : "var(--sep)"}`,
          transition: "all 0.12s",
        }}
      >
        S
      </button>

      {/* Remise à zéro du canal */}
      <button
        type="button"
        onClick={onReset}
        title="Réinitialiser ce canal"
        style={{
          fontSize: 9, padding: "1px 5px", borderRadius: 3,
          background: "transparent", border: "none",
          color: "var(--tx-4)", cursor: "pointer",
          transition: "color 0.12s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tx-2)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tx-4)"; }}
      >
        ↺
      </button>
    </div>
  );
};

// ─── Fader master ─────────────────────────────────────────────────────────────

const MasterFader = ({
  volume, onChange,
}: {
  volume: number; onChange: (v: number) => void;
}) => {
  const pct = Math.round(volume * 100);
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 5,
      padding: "8px 6px",
      borderRadius: 10,
      border: "1px solid var(--sep-2)",
      background: "var(--bg-1)",
      minWidth: 44,
    }}>
      <span style={{
        fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const,
        letterSpacing: "0.08em", color: "var(--tx-3)",
      }}>
        MST
      </span>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />

      <div style={{
        position: "relative", width: 14, height: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          width: 4, height: "100%", borderRadius: 4, background: "var(--bg-4)", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", bottom: 0, width: "100%", height: `${pct}%`,
            background: "var(--accent)", opacity: 0.6, transition: "height 0.08s",
          }} />
        </div>
        <input
          type="range" min={0} max={100} step={1} value={pct}
          onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
          style={{
            position: "absolute", writingMode: "vertical-lr", direction: "rtl",
            WebkitAppearance: "slider-vertical", width: 14, height: "100%",
            opacity: 0, cursor: "pointer", zIndex: 2,
          } as React.CSSProperties}
        />
        <div style={{
          position: "absolute", bottom: `calc(${pct}% - 9px)`,
          left: "50%", transform: "translateX(-50%)",
          width: 16, height: 18, borderRadius: 4,
          background: "var(--bg-3)", border: "2px solid var(--accent)",
          boxShadow: "0 1px 6px rgba(0,0,0,0.40)",
          pointerEvents: "none",
        }} />
      </div>

      <span style={{
        fontSize: 9, fontFamily: "monospace", fontWeight: 700, color: "var(--accent)",
      }}>
        {pct}%
      </span>
    </div>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────

export const DrumMixer = ({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) => {
  const {
    activeDrumKit,
    drumMixer,
    drumMixerMute,
    drumMixerSolo,
    patchDrumMixer,
    resetDrumMixer,
    setMixerChannelMute,
    setMixerChannelSolo,
  } = useProjectStore();

  // Panoramique par canal (stocké localement, non persisté — peut être intégré au store si besoin)
  const [panValues, setPanValues] = useState<Record<keyof DrumKitMixer, number>>({
    kickVolume: 0, snareVolume: 0, hihatVolume: 0,
    cymbalVolume: 0, tomVolume: 0, roomAmount: 0,
  });

  // Volume master (multiplicateur global)
  const [masterVolume, setMasterVolumeState] = useState(1.0);

  const anySoloed = Object.values(drumMixerSolo).some(Boolean);

  const handleResetChannel = useCallback((key: keyof DrumKitMixer) => {
    patchDrumMixer({ [key]: activeDrumKit.mixer[key] });
    setPanValues((prev) => ({ ...prev, [key]: 0 }));
    setMixerChannelMute(key, false);
    setMixerChannelSolo(key, false);
  }, [activeDrumKit, patchDrumMixer, setMixerChannelMute, setMixerChannelSolo]);

  const handleResetAll = useCallback(() => {
    resetDrumMixer();
    setPanValues({ kickVolume: 0, snareVolume: 0, hihatVolume: 0, cymbalVolume: 0, tomVolume: 0, roomAmount: 0 });
    setMasterVolumeState(1.0);
  }, [resetDrumMixer]);

  return (
    <div style={{
      borderRadius: embedded ? 0 : 14,
      border:       embedded ? "none" : "1px solid var(--sep-2)",
      background:   embedded ? "transparent" : "var(--bg-2)",
      boxShadow:    embedded ? "none" : "var(--shadow-lg)",
      overflow:     "hidden",
      flexShrink:   0,
      height:       embedded ? "100%" : undefined,
      display:      "flex",
      flexDirection:"column" as const,
    }}>
      {/* ── En-tête (masqué si embedded) ── */}
      {!embedded && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 14px",
          borderBottom: "1px solid var(--sep)",
          background: "var(--bg-1)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              backgroundColor: activeDrumKit.color,
              boxShadow: `0 0 6px 1px ${activeDrumKit.color}66`,
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-1)" }}>
              Mixeur — {activeDrumKit.name}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={handleResetAll}
              style={{
                fontSize: 10, padding: "3px 8px", borderRadius: 5,
                background: "transparent", color: "var(--tx-3)",
                border: "1px solid var(--sep)", cursor: "pointer",
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tx-1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tx-3)"; }}
            >
              Réinitialiser
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: 22, height: 22, borderRadius: 5,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bg-3)", border: "none",
                  cursor: "pointer", fontSize: 14, color: "var(--tx-3)",
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Console ── */}
      <div style={{ padding: "10px 10px 8px" }}>
        {/* Légende */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          padding: "0 4px 6px",
          fontSize: 8, color: "var(--tx-4)",
          textTransform: "uppercase" as const, letterSpacing: "0.08em",
        }}>
          <span>Canaux</span>
          <span>Master</span>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          {/* Canaux individuels */}
          {CHANNELS.map((ch) => (
            <ChannelStrip
              key={ch.key}
              def={ch}
              volume={drumMixer[ch.key]}
              pan={panValues[ch.key]}
              muted={!!drumMixerMute[ch.key]}
              soloed={!!drumMixerSolo[ch.key]}
              anySoloed={anySoloed}
              onVolume={(v) => patchDrumMixer({ [ch.key]: v })}
              onPan={(v) => setPanValues((prev) => ({ ...prev, [ch.key]: v }))}
              onMute={() => setMixerChannelMute(ch.key, !drumMixerMute[ch.key])}
              onSolo={() => setMixerChannelSolo(ch.key, !drumMixerSolo[ch.key])}
              onReset={() => handleResetChannel(ch.key)}
            />
          ))}

          {/* Séparateur */}
          <div style={{ width: 1, height: 120, background: "var(--sep)", alignSelf: "center" }} />

          {/* Fader master */}
          <MasterFader
            volume={masterVolume}
            onChange={setMasterVolumeState}
          />
        </div>
      </div>

      {/* ── Pied ── */}
      <div style={{
        padding: "6px 14px",
        borderTop: "1px solid var(--sep)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 9, color: "var(--tx-4)", fontStyle: "italic" }}>
          {activeDrumKit.description}
        </span>
        {anySoloed && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            padding: "1px 6px", borderRadius: 4,
            background: "rgba(255,214,10,0.15)", color: "var(--c-yellow)",
          }}>
            SOLO ACTIF
          </span>
        )}
      </div>
    </div>
  );
};
