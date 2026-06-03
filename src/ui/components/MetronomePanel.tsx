/**
 * MetronomePanel — advanced drum training metronome.
 *
 * Two modes:
 *   Standard: floating tool panel (light theme, BPM dial).
 *   Drummer Mode: full-screen overlay (intentionally dark, stage use).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { metronomeEngine } from "../../audio/metronomeEngine";
import { precisionEngine  } from "../../audio/precisionEngine";
import { RhythmWorkshop }         from "./RhythmWorkshop";
import { AdvancedMetronomePanel } from "./AdvancedMetronomePanel";
import {
  TapTempoDetector,
  DEFAULT_METRO_PRESETS,
  saveMetroPreset,
  loadUserMetroPresets,
  deleteMetroPreset,
} from "../../audio/metronomeEngine";
import type {
  MetroSound, MetroSubdivision, MetroSignature, MetroPreset,
  AccentLevel, MetroTrainingConfig, SilenceTrainingConfig,
} from "../../audio/metronomeEngine";
import type { PrecisionMetrics } from "../../audio/precisionEngine";
import { useProjectStore } from "../../store/projectStore";
import { useUiStore } from "../../store/uiStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const SIG_PRESETS: { label: string; sig: MetroSignature }[] = [
  { label: "2/4",   sig: { numerator: 2,  denominator: 4  } },
  { label: "3/4",   sig: { numerator: 3,  denominator: 4  } },
  { label: "4/4",   sig: { numerator: 4,  denominator: 4  } },
  { label: "5/4",   sig: { numerator: 5,  denominator: 4  } },
  { label: "6/8",   sig: { numerator: 6,  denominator: 8  } },
  { label: "7/8",   sig: { numerator: 7,  denominator: 8  } },
  { label: "9/8",   sig: { numerator: 9,  denominator: 8  } },
  { label: "11/8",  sig: { numerator: 11, denominator: 8  } },
  { label: "13/16", sig: { numerator: 13, denominator: 16 } },
];

const SUBDIV_OPTS: { id: MetroSubdivision; label: string; symbol: string }[] = [
  { id: "quarter",   label: "Noires",        symbol: "♩"  },
  { id: "eighth",    label: "Croches",        symbol: "♪"  },
  { id: "triplet",   label: "Triolets",       symbol: "♪3" },
  { id: "sixteenth", label: "Double croches", symbol: "♬"  },
  { id: "quintolet", label: "Quintolets",     symbol: "5"  },
  { id: "sextolet",  label: "Sextolets",      symbol: "6"  },
  { id: "septolet",  label: "Septolets",      symbol: "7"  },
];

const SOUND_OPTS: { id: MetroSound; label: string }[] = [
  { id: "click",     label: "Clic"     },
  { id: "rimshot",   label: "Rimshot"  },
  { id: "hihat",     label: "Hi-Hat"   },
  { id: "kick",      label: "Kick"     },
  { id: "snare",     label: "Snare"    },
  { id: "cowbell",   label: "Cowbell"  },
  { id: "clave",     label: "Clave"    },
  { id: "woodblock", label: "Bois"     },
  { id: "beep",      label: "Bip"      },
];

const TEMPO_LABELS: [number, string][] = [
  [20, "Larghissimo"], [40, "Grave"],    [60, "Largo"],
  [66, "Larghetto"],   [76, "Adagio"],   [108, "Andante"],
  [120, "Moderato"],   [156, "Allegro"], [176, "Vivace"],
  [200, "Presto"],     [250, "Prestissimo"],
];

function getTempoLabel(bpm: number): string {
  for (let i = TEMPO_LABELS.length - 1; i >= 0; i--) {
    if (bpm >= TEMPO_LABELS[i][0]) return TEMPO_LABELS[i][1];
  }
  return "Larghissimo";
}

// ─── BPM Rotary Dial ──────────────────────────────────────────────────────────

const DIAL_SIZE    = 232;
const DIAL_CX      = DIAL_SIZE / 2;
const DIAL_CY      = DIAL_SIZE / 2;
const DIAL_R       = 92;
const DIAL_TRACK_W = 12;
const DIAL_MIN     = 20;
const DIAL_MAX     = 300;
const DIAL_START   = 135;  // SVG angle (°) de la position BPM minimum
const DIAL_SWEEP   = 270;  // balayage total en degrés

const toRad = (d: number) => (d * Math.PI) / 180;
const polar  = (angleDeg: number, r: number) => ({
  x: DIAL_CX + r * Math.cos(toRad(angleDeg)),
  y: DIAL_CY + r * Math.sin(toRad(angleDeg)),
});

function arcPath(a1: number, a2: number, r: number): string {
  const p1    = polar(a1, r);
  const p2    = polar(a2, r);
  const delta = ((a2 - a1) % 360 + 360) % 360;
  const large = delta > 180 ? 1 : 0;
  return `M${p1.x.toFixed(2)},${p1.y.toFixed(2)} A${r},${r},0,${large},1,${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
}

function bpmToDialAngle(bpm: number): number {
  const t = Math.max(0, Math.min(1, (bpm - DIAL_MIN) / (DIAL_MAX - DIAL_MIN)));
  return DIAL_START + t * DIAL_SWEEP;
}

function pointerToBpm(rawAngleDeg: number): number {
  const a      = ((rawAngleDeg % 360) + 360) % 360;
  const endDeg = (DIAL_START + DIAL_SWEEP) % 360; // 45
  let rel: number;
  if (a >= DIAL_START) {
    rel = a - DIAL_START;
  } else if (a <= endDeg) {
    rel = a + (360 - DIAL_START);
  } else {
    const dStart = Math.min(Math.abs(a - DIAL_START), 360 - Math.abs(a - DIAL_START));
    const dEnd   = Math.min(Math.abs(a - endDeg),   360 - Math.abs(a - endDeg));
    rel = dEnd < dStart ? DIAL_SWEEP : 0;
  }
  rel = Math.max(0, Math.min(DIAL_SWEEP, rel));
  return Math.round(DIAL_MIN + (rel / DIAL_SWEEP) * (DIAL_MAX - DIAL_MIN));
}

// Ticks majeurs (avec label) et mineurs
const DIAL_TICKS_MAJOR: { bpm: number; label: string }[] = [
  { bpm: 60,  label: "60"  },
  { bpm: 120, label: "120" },
  { bpm: 180, label: "180" },
];
const DIAL_TICKS_MINOR = [40, 80, 100, 140, 160, 200, 240];

const BpmDial = ({
  bpm, running, isSilent, inCountIn,
  editingBpm, bpmInput,
  onBpmChange, onStartEdit, onInputChange, onInputCommit, onInputCancel,
}: {
  bpm: number; running: boolean; isSilent: boolean; inCountIn: boolean;
  editingBpm: boolean; bpmInput: string;
  onBpmChange: (v: number) => void;
  onStartEdit: () => void;
  onInputChange: (v: string) => void;
  onInputCommit: () => void;
  onInputCancel: () => void;
}) => {
  const svgRef    = useRef<SVGSVGElement>(null);
  const dragging  = useRef(false);

  const getSvgAngle = (e: React.PointerEvent): number => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    return (Math.atan2(e.clientY - rect.top - DIAL_CY, e.clientX - rect.left - DIAL_CX) * 180) / Math.PI;
  };

  const isOnRing = (e: React.PointerEvent): boolean => {
    if (!svgRef.current) return false;
    const rect = svgRef.current.getBoundingClientRect();
    const dx   = e.clientX - rect.left - DIAL_CX;
    const dy   = e.clientY - rect.top  - DIAL_CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist >= DIAL_R - 28 && dist <= DIAL_R + 28;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isOnRing(e)) return;
    dragging.current = true;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    onBpmChange(pointerToBpm(getSvgAngle(e)));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    onBpmChange(pointerToBpm(getSvgAngle(e)));
  };

  const onPointerUp = () => { dragging.current = false; };

  const currentAngle  = bpmToDialAngle(bpm);
  const trackEndAngle = DIAL_START + DIAL_SWEEP;
  const knob          = polar(currentAngle, DIAL_R);
  // Direction arrow du knob (vers le centre depuis le bord)
  const knobDir       = polar(currentAngle, DIAL_R - DIAL_TRACK_W / 2 - 2);

  const bpmColor = running
    ? (isSilent ? "var(--tx-4)" : "var(--tx-1)")
    : "var(--tx-3)";

  return (
    <div style={{ position: "relative", width: DIAL_SIZE, height: DIAL_SIZE, flexShrink: 0 }}>
      <svg
        ref={svgRef}
        width={DIAL_SIZE}
        height={DIAL_SIZE}
        style={{ display: "block", touchAction: "none", cursor: "default", overflow: "visible" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => {
          e.preventDefault();
          onBpmChange(Math.max(DIAL_MIN, Math.min(DIAL_MAX, bpm + (e.deltaY < 0 ? 1 : -1))));
        }}
      >
        <defs>
          {/* Ombre portée sous la roue */}
          <filter id="dialShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="rgba(0,0,0,0.18)" floodOpacity="1" />
          </filter>
          {/* Glow accent quand en lecture */}
          <filter id="accentGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Plateau extérieur (anneau gris surélevé) ── */}
        <circle cx={DIAL_CX} cy={DIAL_CY}
          r={DIAL_R + DIAL_TRACK_W / 2 + 8}
          fill="var(--bg-3)"
          stroke="var(--sep-2)" strokeWidth={1}
          filter="url(#dialShadow)"
        />

        {/* ── Surface centrale (dépression visuelle) ── */}
        <circle cx={DIAL_CX} cy={DIAL_CY}
          r={DIAL_R - DIAL_TRACK_W / 2 - 8}
          fill="var(--bg-2)"
          stroke="var(--sep)" strokeWidth={1}
        />

        {/* ── Track vide ── */}
        <path
          d={arcPath(DIAL_START, trackEndAngle, DIAL_R)}
          fill="none"
          stroke="var(--sep-3)"
          strokeWidth={DIAL_TRACK_W}
          strokeLinecap="round"
        />

        {/* ── Arc rempli ── */}
        {bpm > DIAL_MIN && (
          <path
            d={arcPath(DIAL_START, currentAngle, DIAL_R)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={DIAL_TRACK_W}
            strokeLinecap="round"
            opacity={running ? 1 : 0.55}
            filter={running ? "url(#accentGlow)" : undefined}
            style={{ transition: "opacity 0.25s" }}
          />
        )}

        {/* ── Ticks mineurs ── */}
        {DIAL_TICKS_MINOR.map((b) => {
          const a     = bpmToDialAngle(b);
          const inner = polar(a, DIAL_R - DIAL_TRACK_W / 2 - 2);
          const outer = polar(a, DIAL_R + DIAL_TRACK_W / 2 + 2);
          const past  = b <= bpm;
          return (
            <line key={b}
              x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke={past && running ? "rgba(0,113,227,0.5)" : "var(--sep-3)"}
              strokeWidth={1.5} strokeLinecap="round"
            />
          );
        })}

        {/* ── Ticks majeurs + labels ── */}
        {DIAL_TICKS_MAJOR.map(({ bpm: b, label }) => {
          const a     = bpmToDialAngle(b);
          const inner = polar(a, DIAL_R - DIAL_TRACK_W / 2 - 2);
          const outer = polar(a, DIAL_R + DIAL_TRACK_W / 2 + 4);
          const lp    = polar(a, DIAL_R + DIAL_TRACK_W / 2 + 14);
          const past  = b <= bpm;
          return (
            <g key={b}>
              <line
                x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke={past && running ? "var(--accent)" : "var(--tx-4)"}
                strokeWidth={2} strokeLinecap="round"
              />
              <text
                x={lp.x} y={lp.y}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={8} fontWeight={600}
                fill={past && running ? "var(--accent)" : "var(--tx-4)"}
                style={{ userSelect: "none", pointerEvents: "none" }}>
                {label}
              </text>
            </g>
          );
        })}

        {/* ── Knob ── */}
        {/* Halo */}
        {running && (
          <circle cx={knob.x} cy={knob.y} r={DIAL_TRACK_W / 2 + 8}
            fill="var(--accent)" opacity={0.18}
          />
        )}
        {/* Corps du knob */}
        <circle cx={knob.x} cy={knob.y} r={DIAL_TRACK_W / 2 + 5}
          fill={running ? "var(--accent)" : "var(--bg-4)"}
          stroke="var(--bg-2)" strokeWidth={2}
          style={{ transition: "fill 0.2s", cursor: "ew-resize", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.25))" }}
        />
        {/* Point directionnel */}
        <circle cx={knobDir.x} cy={knobDir.y} r={2}
          fill={running ? "rgba(255,255,255,0.8)" : "var(--tx-4)"}
          style={{ pointerEvents: "none" }}
        />

        {/* ── Zone drag invisible ── */}
        <circle cx={DIAL_CX} cy={DIAL_CY} r={DIAL_R}
          fill="none" stroke="transparent" strokeWidth={DIAL_TRACK_W + 36}
          style={{ cursor: "ew-resize" }}
        />

        {/* ── Contenu central ── */}
        {!editingBpm && (
          <>
            {(inCountIn || (isSilent && running)) && (
              <text x={DIAL_CX} y={DIAL_CY - 36}
                textAnchor="middle" fontSize={8} fontWeight={700} letterSpacing={1.5}
                fill={inCountIn ? "var(--c-yellow)" : "var(--c-red)"}
                style={{ userSelect: "none", pointerEvents: "none" }}>
                {inCountIn ? "DÉCOMPTE" : "SILENCE"}
              </text>
            )}

            <text x={DIAL_CX} y={DIAL_CY + 14}
              textAnchor="middle"
              fontSize={56} fontWeight={900} letterSpacing={-2}
              fontFamily="-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif"
              fill={bpmColor}
              style={{ transition: "fill 0.2s", userSelect: "none", pointerEvents: "none" }}>
              {bpm}
            </text>
            <text x={DIAL_CX} y={DIAL_CY + 32}
              textAnchor="middle"
              fontSize={11} fontWeight={500}
              fontFamily="-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif"
              fill="var(--tx-3)"
              style={{ userSelect: "none", pointerEvents: "none" }}>
              {getTempoLabel(bpm)}
            </text>
            <text x={DIAL_CX} y={DIAL_CY + 46}
              textAnchor="middle"
              fontSize={8.5} fontWeight={700} letterSpacing={2}
              fontFamily="-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif"
              fill="var(--tx-4)"
              style={{ userSelect: "none", pointerEvents: "none" }}>
              BPM
            </text>

            {/* Zone double-clic pour édition directe */}
            <circle cx={DIAL_CX} cy={DIAL_CY} r={58}
              fill="transparent"
              style={{ cursor: "text" }}
              onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            />
          </>
        )}
      </svg>

      {/* Input édition BPM directe */}
      {editingBpm && (
        <input
          autoFocus
          type="number"
          value={bpmInput}
          min={20}
          max={300}
          onChange={(e) => onInputChange(e.target.value)}
          onBlur={onInputCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter")  onInputCommit();
            if (e.key === "Escape") onInputCancel();
          }}
          style={{
            position:   "absolute",
            left:       "50%",
            top:        "50%",
            transform:  "translate(-50%, -66%)",
            width:      96,
            fontSize:   44,
            fontWeight: 900,
            letterSpacing: "-2px",
            textAlign:  "center",
            background: "transparent",
            border:     "none",
            outline:    "2px solid var(--accent)",
            borderRadius: 8,
            color:      "var(--tx-1)",
            fontFamily: "inherit",
          }}
        />
      )}
    </div>
  );
};

// ─── Primitive UI ─────────────────────────────────────────────────────────────

const Chip = ({
  active, onClick, children, title, small, disabled,
}: {
  active?: boolean; onClick: () => void; children: React.ReactNode;
  title?: string; small?: boolean; disabled?: boolean;
}) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:      small ? "2px 8px" : "4px 11px",
        borderRadius: 100,
        fontSize:     small ? 10.5 : 11.5,
        fontWeight:   active ? 600 : 400,
        background:   active ? "var(--accent-dim)" : hov && !disabled ? "var(--bg-hover)" : "transparent",
        color:        active ? "var(--accent)" : disabled ? "var(--tx-4)" : hov ? "var(--tx-2)" : "var(--tx-3)",
        border:       `1px solid ${active ? "var(--accent-line)" : "var(--sep-2)"}`,
        cursor:       disabled ? "not-allowed" : "pointer",
        transition:   "all 0.1s",
        whiteSpace:   "nowrap" as const,
        userSelect:   "none" as const,
        height:       small ? 24 : 28,
        display:      "flex",
        alignItems:   "center",
        opacity:      disabled ? 0.45 : 1,
        outline:      "none",
      }}
    >
      {children}
    </button>
  );
};

const SecLabel = ({ children, badge }: { children: React.ReactNode; badge?: string }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    fontSize: 9.5, fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "0.10em", color: "var(--tx-3)",
    marginBottom: 6, userSelect: "none" as const,
  }}>
    <span>{children}</span>
    {badge && (
      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-line)" }}>
        {badge}
      </span>
    )}
  </div>
);

const FlexRow = ({ children, gap = 4, wrap = true }: { children: React.ReactNode; gap?: number; wrap?: boolean }) => (
  <div style={{ display: "flex", flexWrap: wrap ? "wrap" as const : "nowrap", alignItems: "center", gap }}>
    {children}
  </div>
);

const SliderRow = ({
  label, value, min, max, step = 1, onChange, valStr, color,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; valStr?: string; color?: string;
}) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: 11.5, color: "var(--tx-3)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--tx-2)", fontFamily: "monospace" }}>
        {valStr ?? value}
      </span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="compact-range"
      style={{ width: "100%", accentColor: color ?? "var(--accent)" }}
    />
  </div>
);

const Section = ({
  title, children, defaultOpen = false, badge,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid var(--sep)" }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 0 6px", background: "none", border: "none", cursor: "pointer",
          color: "var(--tx-2)", fontSize: 12, fontWeight: 600, userSelect: "none" as const,
        }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {title}
          {badge && (
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-line)" }}>
              {badge}
            </span>
          )}
        </span>
        <span style={{ fontSize: 8, color: "var(--tx-4)", display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      </button>
      {open && <div style={{ paddingBottom: 10 }}>{children}</div>}
    </div>
  );
};

// ─── Beat visualizer ──────────────────────────────────────────────────────────

const BeatViz = ({
  numerator, activeBeat, pattern, large = false,
}: {
  numerator: number; activeBeat: number; pattern: AccentLevel[]; large?: boolean;
}) => {
  const sz = large ? 42 : 26;
  return (
    <div style={{ display: "flex", gap: large ? 10 : 6, alignItems: "center", justifyContent: "center", flexWrap: "wrap" as const }}>
      {Array.from({ length: numerator }, (_, i) => {
        const lvl = pattern.length > 0 ? (pattern[i] ?? 1) : (i === 0 ? 2 : 1);
        const on  = activeBeat === i;
        return (
          <div key={i} style={{
            width: sz, height: sz, borderRadius: sz / 2,
            border: `${large ? 2 : 1.5}px solid ${
              lvl === 2 ? "var(--accent-line)" : lvl === 0 ? "var(--sep)" : "var(--sep-3)"
            }`,
            background: on
              ? (lvl === 2 ? "var(--accent)" : lvl === 0 ? "transparent" : "var(--bg-sel)")
              : (lvl === 2 ? "var(--accent-dim)" : "transparent"),
            transform:  on ? `scale(${lvl === 2 ? 1.2 : 1.1})` : "scale(1)",
            transition: "all 0.06s ease",
            display:    "flex", alignItems: "center", justifyContent: "center",
            boxShadow:  on && lvl === 2 ? "0 0 8px var(--accent-ring, rgba(0,113,227,0.22))" : "none",
          }}>
            {large && lvl > 0 && (
              <span style={{ fontSize: 12, fontWeight: 800, color: on ? (lvl === 2 ? "#fff" : "var(--tx-1)") : "var(--tx-4)", userSelect: "none" as const }}>
                {i + 1}
              </span>
            )}
            {lvl === 0 && (
              <div style={{ width: sz * 0.3, height: 1.5, background: "var(--sep-3)", borderRadius: 1 }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Accent grid ──────────────────────────────────────────────────────────────

const AccentGrid = ({
  numerator, pattern, onChange,
}: {
  numerator: number; pattern: AccentLevel[]; onChange: (p: AccentLevel[]) => void;
}) => {
  const display: AccentLevel[] = Array.from({ length: numerator }, (_, i) =>
    pattern.length > 0 ? (pattern[i] ?? 1) : (i === 0 ? 2 : 1)
  );
  const cycle = (l: AccentLevel): AccentLevel => l === 1 ? 2 : l === 2 ? 0 : 1;

  const ICONS:  Record<AccentLevel, string> = { 0: "–", 1: "·", 2: ">" };
  const BG:     Record<AccentLevel, string> = { 0: "var(--bg-hover)", 1: "var(--bg-3)", 2: "var(--accent-dim)" };
  const BORDER: Record<AccentLevel, string> = { 0: "var(--sep)", 1: "var(--sep-2)", 2: "var(--accent-line)" };
  const CLR:    Record<AccentLevel, string> = { 0: "var(--tx-4)", 1: "var(--tx-2)", 2: "var(--accent)" };

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginBottom: 6 }}>
        {display.map((lvl, i) => (
          <button key={i} type="button"
            onClick={() => { const n = [...display]; n[i] = cycle(lvl); onChange(n); }}
            title={`Temps ${i + 1}: ${lvl === 0 ? "muet" : lvl === 1 ? "normal" : "accent"} — clic pour changer`}
            style={{
              width: 32, height: 32, borderRadius: 6, background: BG[lvl], cursor: "pointer",
              border: `1.5px solid ${BORDER[lvl]}`,
              color: CLR[lvl], display: "flex", flexDirection: "column" as const,
              alignItems: "center", justifyContent: "center", gap: 1, transition: "all 0.1s",
            }}>
            <span style={{ fontSize: 7.5, lineHeight: 1, color: "var(--tx-4)" }}>{i + 1}</span>
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{ICONS[lvl]}</span>
          </button>
        ))}
        <button type="button" onClick={() => onChange([])} title="Réinitialiser"
          style={{ width: 32, height: 32, borderRadius: 6, background: "transparent", border: "1px solid var(--sep)", color: "var(--tx-4)", fontSize: 14, cursor: "pointer" }}>
          ↺
        </button>
      </div>
      <div style={{ fontSize: 9.5, color: "var(--tx-4)", display: "flex", gap: 12 }}>
        <span><b style={{ color: "var(--tx-3)" }}>–</b> Muet</span>
        <span><b style={{ color: "var(--tx-2)" }}>·</b> Normal</span>
        <span style={{ color: "var(--accent)" }}><b>›</b> Accent</span>
      </div>
    </div>
  );
};

// ─── Precision display ────────────────────────────────────────────────────────

const PrecisionDisplay = ({ metrics }: { metrics: PrecisionMetrics }) => {
  const scoreColor = metrics.score >= 80 ? "var(--c-green)" : metrics.score >= 50 ? "var(--c-yellow)" : "var(--c-red)";
  const maxAbs     = Math.max(...metrics.history.map(Math.abs), 20);
  return (
    <div style={{ background: "var(--bg-3)", borderRadius: 8, padding: 10, border: "1px solid var(--sep)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor, fontVariantNumeric: "tabular-nums" as const }}>{metrics.score}</div>
          <div style={{ fontSize: 9, color: "var(--tx-4)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Score</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: Math.abs(metrics.avg) < 10 ? "var(--c-green)" : "var(--c-yellow)" }}>
            {metrics.avg > 0 ? "+" : ""}{metrics.avg.toFixed(1)} ms
          </div>
          <div style={{ fontSize: 9, color: "var(--tx-4)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
            {metrics.avg > 8 ? "En retard" : metrics.avg < -8 ? "En avance" : "En place"}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" as const }}>{metrics.stability}</div>
          <div style={{ fontSize: 9, color: "var(--tx-4)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Stabilité</div>
        </div>
      </div>
      {metrics.history.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, height: 26, marginBottom: 4 }}>
          {metrics.history.map((dev, i) => {
            const pct = Math.abs(dev) / maxAbs;
            const h   = Math.max(2, Math.round(pct * 22));
            const col = Math.abs(dev) < 10 ? "var(--c-green)" : Math.abs(dev) < 25 ? "var(--c-yellow)" : "var(--c-red)";
            return (
              <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                <div style={{ width: "100%", height: h, background: col, borderRadius: 2, opacity: 0.85 }} />
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 10, color: "var(--tx-4)", textAlign: "center" }}>
        {metrics.tapCount} tap{metrics.tapCount > 1 ? "s" : ""} · σ {metrics.stdDev.toFixed(1)} ms
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const MetronomePanel = ({ embedded = false }: { embedded?: boolean }) => {
  const { togglePanel } = useUiStore();
  const project         = useProjectStore((s) => s.project);
  const projectBpm      = project?.tempoBpm ?? null;

  // ── Engine state ──────────────────────────────────────────────────────────
  const [running,    setRunning]    = useState(metronomeEngine.isRunning);
  const [bpm,        setBpmSt]      = useState(metronomeEngine.bpm);
  const [sig,        setSig]        = useState<MetroSignature>(metronomeEngine.signature);
  const [subdiv,     setSubdiv]     = useState<MetroSubdivision>(metronomeEngine.subdivision);
  const [sound,      setSound]      = useState<MetroSound>(metronomeEngine.soundType);
  const [vol,        setVol]        = useState(metronomeEngine.volume);
  const [volAcc,     setVolAcc]     = useState(metronomeEngine.volumeAccent);
  const [volSub,     setVolSub]     = useState(metronomeEngine.volumeSubdiv);
  const [pattern,    setPattern]    = useState<AccentLevel[]>(metronomeEngine.accentPattern);
  const [visualOnly, setVisualOnly] = useState(metronomeEngine.visualOnly);
  const [countIn,    setCountIn]    = useState(metronomeEngine.countInBars);
  const [training,   setTraining]   = useState<MetroTrainingConfig>(metronomeEngine.training);
  const [silence,    setSilence]    = useState<SilenceTrainingConfig>(metronomeEngine.silence);
  const [poly,       setPoly]       = useState(metronomeEngine.poly);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeBeat,   setActiveBeat]   = useState(-1);
  const [isSilent,     setIsSilent]     = useState(false);
  const [inCountIn,    setInCountIn]    = useState(false);
  const [drummerMode,  setDrummerMode]  = useState(false);
  const [workshopMode, setWorkshopMode] = useState(false);
  const [editingBpm,   setEditingBpm]   = useState(false);
  const [bpmInput,     setBpmInput]     = useState("");
  const [tapCnt,       setTapCnt]       = useState(0);
  const [tapFlash,     setTapFlash]     = useState(false);
  const [userPresets,  setUserPresets]  = useState<MetroPreset[]>(() => loadUserMetroPresets());
  const [precisionOn,  setPrecisionOn]  = useState(false);
  const [metrics,      setMetrics]      = useState<PrecisionMetrics | null>(null);
  const [activeTab,    setActiveTab]    = useState<"tempo" | "training" | "presets" | "advanced">("tempo");

  const tapDetector = useRef(new TapTempoDetector());
  const bpmRef      = useRef(bpm);
  bpmRef.current    = bpm;

  // ── Engine callbacks ──────────────────────────────────────────────────────
  useEffect(() => {
    metronomeEngine.onBeat((_bi, _al, _si, _tot, _mi, isCI, isSil) => {
      setActiveBeat(_bi);
      setIsSilent(isSil);
      setInCountIn(isCI);
      if (!isCI && precisionOn) {
        const ctx = (window as unknown as { __toneCtx?: AudioContext }).__toneCtx;
        if (ctx) precisionEngine.recordBeat(ctx.currentTime);
        setMetrics(precisionEngine.getMetrics());
      }
    });
    metronomeEngine.onBpmChange((b) => setBpmSt(b));
    metronomeEngine.onStop(() => { setRunning(false); setActiveBeat(-1); setInCountIn(false); });
  }, [precisionOn]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); void togglePlay(); }
      if (e.code === "KeyT")  { e.preventDefault(); handleTap(); }
      if (e.code === "KeyP" && precisionOn) { e.preventDefault(); precisionTap(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, precisionOn]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const togglePlay = async () => {
    if (metronomeEngine.isRunning) {
      metronomeEngine.stop();
      setRunning(false);
      setActiveBeat(-1);
    } else {
      await metronomeEngine.start();
      setRunning(true);
    }
  };

  const applyBpm = (v: number) => {
    metronomeEngine.setBpm(v);
    setBpmSt(metronomeEngine.bpm);
  };

  const handleTap = () => {
    const det = tapDetector.current.tap();
    setTapCnt(tapDetector.current.tapCount);
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);
    if (det !== null) { applyBpm(det); }
  };

  const applySig = (s: MetroSignature) => {
    metronomeEngine.setSignature(s);
    setSig(s);
    const def: AccentLevel[] = Array.from({ length: s.numerator }, (_, i) => (i === 0 ? 2 : 1) as AccentLevel);
    metronomeEngine.setAccentPattern(def);
    setPattern(def);
  };

  const applyPattern = useCallback((p: AccentLevel[]) => {
    metronomeEngine.setAccentPattern(p);
    setPattern(p);
  }, []);

  const applyPreset = (p: MetroPreset) => {
    metronomeEngine.setBpm(p.bpm);
    metronomeEngine.setSignature(p.signature);
    metronomeEngine.setSubdivision(p.subdivision);
    metronomeEngine.setSoundType(p.soundType);
    if (p.accentPattern)              metronomeEngine.setAccentPattern(p.accentPattern);
    if (p.volumeAccent !== undefined) metronomeEngine.setVolumeAccent(p.volumeAccent);
    if (p.volumeSubdiv !== undefined) metronomeEngine.setVolumeSubdiv(p.volumeSubdiv);
    if (p.training)                   metronomeEngine.setTraining(p.training);
    if (p.silence)                    metronomeEngine.setSilence(p.silence);
    setBpmSt(p.bpm); setSig(p.signature); setSubdiv(p.subdivision); setSound(p.soundType);
    setPattern(p.accentPattern ?? []);
    if (p.volumeAccent !== undefined) setVolAcc(p.volumeAccent);
    if (p.volumeSubdiv !== undefined) setVolSub(p.volumeSubdiv);
    if (p.training) setTraining((prev) => ({ ...prev, ...p.training }));
    if (p.silence)  setSilence((prev) => ({ ...prev, ...p.silence }));
  };

  const savePreset = () => {
    const name = prompt("Nom du preset :");
    if (!name?.trim()) return;
    const saved = saveMetroPreset({ name: name.trim(), bpm, signature: sig, subdivision: subdiv, soundType: sound, accentPattern: pattern, volumeAccent: volAcc, volumeSubdiv: volSub, training, silence });
    setUserPresets((prev) => [...prev, saved]);
  };

  const delPreset     = (id: string) => { deleteMetroPreset(id); setUserPresets(loadUserMetroPresets()); };
  const precisionTap  = () => { precisionEngine.recordTap(); setMetrics(precisionEngine.getMetrics()); };
  const togglePrecision = () => {
    if (!precisionOn) { precisionEngine.activate(); setMetrics(null); }
    else              { precisionEngine.deactivate(); precisionEngine.reset(); setMetrics(null); }
    setPrecisionOn((v) => !v);
  };

  // ─── Drummer Mode ─────────────────────────────────────────────────────────

  if (drummerMode) {
    const D = {
      bg:      "linear-gradient(160deg,#07080f 0%,#0c0e1a 55%,#08090e 100%)",
      glass:   "rgba(255,255,255,0.06)",
      glassBd: "rgba(255,255,255,0.1)",
      accent:  "#0071e3",
      red:     "#ff453a",
      redG:    "rgba(255,69,58,0.18)",
      redBd:   "rgba(255,69,58,0.35)",
    };
    return createPortal((
      <div style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: D.bg, fontFamily: "-apple-system,system-ui,sans-serif",
        display: "flex", flexDirection: "column" as const, overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
          background: running
            ? "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,90,200,0.09) 0%, transparent 70%)"
            : "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,255,255,0.02) 0%, transparent 70%)",
          transition: "background 0.4s",
        }} />

        <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%",
              background: running ? "#30d158" : "rgba(255,255,255,0.2)",
              boxShadow: running ? "0 0 8px rgba(48,209,88,0.6)" : "none",
              transition: "all 0.3s",
            }} className={running ? "play-dot" : undefined} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)" }}>
              Mode Batteur
            </span>
            {(isSilent || inCountIn) && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const,
                color: inCountIn ? "#ffd60a" : "#ff453a",
                background: inCountIn ? "rgba(255,214,10,0.1)" : "rgba(255,69,58,0.1)",
                border: `1px solid ${inCountIn ? "rgba(255,214,10,0.25)" : "rgba(255,69,58,0.25)"}`,
                padding: "2px 10px", borderRadius: 100,
              }}>
                {inCountIn ? "Décompte" : "Silence"}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button"
              onClick={() => { metronomeEngine.setVisualOnly(!visualOnly); setVisualOnly((v) => !v); }}
              style={{ height: 30, padding: "0 14px", borderRadius: 100, background: visualOnly ? "rgba(0,113,227,0.15)" : D.glass, border: `1px solid ${visualOnly ? "rgba(0,113,227,0.35)" : D.glassBd}`, color: visualOnly ? D.accent : "rgba(255,255,255,0.55)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
              {visualOnly ? "👁 Visuel" : "🔈 Son"}
            </button>
            <button type="button" onClick={() => setDrummerMode(false)}
              style={{ height: 30, padding: "0 14px", borderRadius: 100, background: D.glass, border: `1px solid ${D.glassBd}`, color: "rgba(255,255,255,0.55)", fontSize: 11.5, fontWeight: 500, cursor: "pointer" }}>
              ← Réduire
            </button>
          </div>
        </div>

        <div style={{ flex: 1, position: "relative", zIndex: 2, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 24 }}>
          <div style={{ textAlign: "center", lineHeight: 1 }}
            onWheel={(e) => applyBpm(bpmRef.current + (e.deltaY < 0 ? 1 : -1))}>
            <div style={{ fontSize: "clamp(96px,14vw,160px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.9, fontVariantNumeric: "tabular-nums" as const, color: running ? (isSilent ? "rgba(255,255,255,0.12)" : "#f5f5f7") : "rgba(255,255,255,0.22)", transition: "color 0.25s", cursor: "default", textShadow: running && !isSilent ? "0 0 80px rgba(0,113,227,0.2)" : "none" }}>
              {bpm}
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>
              {getTempoLabel(bpm)} &nbsp;·&nbsp; {sig.numerator}/{sig.denominator}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" as const, justifyContent: "center" }}>
            {Array.from({ length: sig.numerator }, (_, i) => {
              const lvl = pattern.length > 0 ? (pattern[i] ?? 1) : (i === 0 ? 2 : 1);
              const on  = activeBeat === i;
              return (
                <div key={i} style={{ width: 44, height: 44, borderRadius: "50%",
                  border: `2px solid ${lvl === 2 ? (on ? "#0071e3" : "rgba(0,113,227,0.45)") : on ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"}`,
                  background: on ? (lvl === 2 ? "rgba(0,113,227,0.35)" : "rgba(255,255,255,0.18)") : (lvl === 2 ? "rgba(0,113,227,0.08)" : "transparent"),
                  boxShadow: on ? (lvl === 2 ? "0 0 16px rgba(0,113,227,0.5)" : "0 0 12px rgba(255,255,255,0.2)") : "none",
                  transform: on ? "scale(1.18)" : "scale(1)", transition: "all 0.07s ease",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: on ? "#fff" : "rgba(255,255,255,0.3)" }}>{i + 1}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {([-10, -5, -1, 1, 5, 10] as number[]).map((d) => (
              <button key={d} type="button" onClick={() => applyBpm(bpm + d)}
                style={{ width: 52, height: 40, borderRadius: 10, fontSize: 13, fontWeight: 700, background: D.glass, border: `1px solid ${D.glassBd}`, color: "rgba(255,255,255,0.65)", cursor: "pointer" }}>
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>

          <div style={{ width: "min(480px, 85vw)" }}>
            <input type="range" min={20} max={300} step={1} value={bpm}
              onChange={(e) => applyBpm(Number(e.target.value))}
              className="compact-range" style={{ width: "100%", accentColor: "#0071e3" }} />
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button type="button" onClick={() => void togglePlay()}
              style={{ width: 180, height: 64, borderRadius: 32, fontSize: 18, fontWeight: 800, background: running ? D.redG : "linear-gradient(135deg,#0071e3,#0058cc)", color: running ? D.red : "#fff", border: `2px solid ${running ? D.redBd : "transparent"}`, cursor: "pointer", boxShadow: running ? `0 0 0 4px ${D.redG}` : "0 4px 24px rgba(0,113,227,0.45), 0 0 0 4px rgba(0,113,227,0.1)" }}>
              {running ? "⏹ Stop" : "▶ Démarrer"}
            </button>
            <button type="button" onClick={handleTap}
              style={{ width: 100, height: 64, borderRadius: 32, fontSize: 15, fontWeight: 700, background: D.glass, border: `1px solid ${D.glassBd}`, color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>
              Frapper{tapCnt > 1 ? ` ${tapCnt}` : ""}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, justifyContent: "center" }}>
              {SIG_PRESETS.slice(0, 7).map(({ label, sig: s }) => {
                const active = sig.numerator === s.numerator && sig.denominator === s.denominator;
                return (
                  <button key={label} type="button" onClick={() => applySig(s)}
                    style={{ height: 30, padding: "0 13px", borderRadius: 100, fontSize: 12, fontWeight: active ? 700 : 400, background: active ? "rgba(0,113,227,0.2)" : D.glass, border: `1px solid ${active ? "rgba(0,113,227,0.4)" : D.glassBd}`, color: active ? "#0071e3" : "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, justifyContent: "center" }}>
              {SUBDIV_OPTS.map(({ id, symbol, label }) => {
                const active = subdiv === id;
                return (
                  <button key={id} type="button" title={label}
                    onClick={() => { metronomeEngine.setSubdivision(id); setSubdiv(id); }}
                    style={{ height: 30, padding: "0 13px", borderRadius: 100, fontSize: 13, fontWeight: active ? 700 : 400, background: active ? "rgba(0,113,227,0.2)" : D.glass, border: `1px solid ${active ? "rgba(0,113,227,0.4)" : D.glassBd}`, color: active ? "#0071e3" : "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                    {symbol}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 2, padding: "10px 24px 18px", textAlign: "center", fontSize: 10.5, color: "rgba(255,255,255,0.2)", display: "flex", gap: 18, justifyContent: "center" }}>
          {[["Espace","Start/Stop"],["T","Tap Tempo"]].map(([k, l]) => (
            <span key={k}>
              <kbd style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.07)", padding: "1px 6px", borderRadius: 4 }}>{k}</kbd>
              {" "}{l}
            </span>
          ))}
        </div>
      </div>
    ), document.body);
  }

  // ─── Standard panel (light-theme) ─────────────────────────────────────────

  const TABS = [
    { id: "tempo"    as const, label: "Tempo"    },
    { id: "training" as const, label: "Training" },
    { id: "presets"  as const, label: "Presets"  },
    { id: "advanced" as const, label: "Avancé"   },
  ];

  return (
    <div style={{
      width:        embedded ? "100%" : 292,
      maxHeight:    embedded ? undefined : "90vh",
      overflowY:    embedded ? undefined : "auto",
      overflowX:    "hidden",
      borderRadius: embedded ? 0 : 12,
      background:   embedded ? "transparent" : "var(--bg-2)",
      border:       embedded ? "none" : "1px solid var(--sep-2)",
      boxShadow:    embedded ? "none" : "var(--shadow-lg)",
      userSelect:   "none" as const,
      fontSize:     13,
    }}>

      {/* ── Header ── */}
      {!embedded && (
        <div style={{
          height: 42, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 12px 0 14px",
          borderBottom: "1px solid var(--sep)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {running && (
              <div className="play-dot" style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: isSilent ? "var(--c-red)" : "var(--c-green)",
              }} />
            )}
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--tx-2)", letterSpacing: "0.05em" }}>
              MÉTRONOME
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {projectBpm && (
              <button type="button" onClick={() => applyBpm(projectBpm)}
                title="Synchroniser avec le BPM du projet"
                style={{ height: 24, padding: "0 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 600, background: "var(--bg-3)", border: "1px solid var(--sep-2)", color: "var(--tx-3)", cursor: "pointer" }}>
                SYNC {Math.round(projectBpm)}
              </button>
            )}
            <button type="button" onClick={() => setWorkshopMode(true)}
              title="Éditeur de partition"
              style={{ height: 24, padding: "0 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 600, background: "rgba(37,162,68,0.1)", border: "1px solid rgba(37,162,68,0.25)", color: "var(--c-green)", cursor: "pointer" }}>
              ◯
            </button>
            <button type="button" onClick={() => setDrummerMode(true)}
              title="Mode batteur (plein écran)"
              style={{ height: 24, padding: "0 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: "var(--accent-dim)", border: "1px solid var(--accent-line)", color: "var(--accent)", cursor: "pointer" }}>
              🥁
            </button>
            <button type="button" onClick={() => togglePanel("metronome")}
              style={{ width: 24, height: 24, borderRadius: 5, background: "none", border: "none", color: "var(--tx-3)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
              ×
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "12px 14px 10px", display: "flex", flexDirection: "column" as const, gap: 10 }}>

        {/* ── Central BPM dial ── */}
        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8 }}>
          <BpmDial
            bpm={bpm}
            running={running}
            isSilent={isSilent}
            inCountIn={inCountIn}
            editingBpm={editingBpm}
            bpmInput={bpmInput}
            onBpmChange={applyBpm}
            onStartEdit={() => { setEditingBpm(true); setBpmInput(String(bpm)); }}
            onInputChange={setBpmInput}
            onInputCommit={() => {
              const v = parseInt(bpmInput, 10);
              if (!isNaN(v)) applyBpm(v);
              setEditingBpm(false);
            }}
            onInputCancel={() => setEditingBpm(false)}
          />

          {/* Beat dots */}
          <BeatViz numerator={sig.numerator} activeBeat={activeBeat} pattern={pattern} />

          {/* Quick BPM ±buttons */}
          <div style={{ display: "flex", gap: 3, width: "100%" }}>
            {([-10, -5, -1, 1, 5, 10] as number[]).map((d) => (
              <button key={d} type="button" onClick={() => applyBpm(bpm + d)}
                style={{
                  flex: 1, height: 26, borderRadius: 6, fontSize: 10.5, fontWeight: 600,
                  cursor: "pointer",
                  background: "transparent",
                  border: "1px solid var(--sep-2)",
                  color: "var(--tx-3)",
                  transition: "all 0.1s",
                }}>
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
        </div>

        {/* ── Controls row ── */}
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => void togglePlay()}
            style={{
              flex: 1, height: 40, borderRadius: 10, fontSize: 13.5, fontWeight: 700,
              background: running ? "rgba(217,48,37,0.09)" : "var(--accent)",
              color:      running ? "var(--c-red)" : "#fff",
              border:     `1.5px solid ${running ? "rgba(217,48,37,0.28)" : "transparent"}`,
              cursor:     "pointer", transition: "all 0.15s",
              boxShadow:  running ? "none" : "0 2px 8px rgba(0,113,227,0.28)",
            }}>
            {running ? "⏹ Stop" : "▶ Démarrer"}
          </button>

          <button type="button" onClick={handleTap}
            style={{
              width:      68, height: 40, borderRadius: 10,
              fontSize:   11.5, fontWeight: 700,
              background: tapFlash ? "var(--accent-dim)" : "var(--bg-3)",
              border:     `1.5px solid ${tapFlash ? "var(--accent-line)" : "var(--sep-2)"}`,
              color:      tapFlash ? "var(--accent)" : "var(--tx-2)",
              cursor:     "pointer", transition: "all 0.08s",
              display:    "flex", flexDirection: "column" as const,
              alignItems: "center", justifyContent: "center", lineHeight: 1.2,
            }}>
            <span>Taper</span>
            {tapCnt > 1 && <span style={{ fontSize: 9, color: "var(--tx-4)", fontWeight: 400 }}>{tapCnt}</span>}
          </button>

          <button type="button"
            onClick={() => { metronomeEngine.setVisualOnly(!visualOnly); setVisualOnly((v) => !v); }}
            title={visualOnly ? "Son désactivé (mode visuel)" : "Son activé"}
            style={{
              width:      40, height: 40, borderRadius: 10, fontSize: 16,
              cursor:     "pointer", transition: "all 0.1s",
              background: visualOnly ? "var(--accent-dim)" : "var(--bg-3)",
              border:     `1.5px solid ${visualOnly ? "var(--accent-line)" : "var(--sep-2)"}`,
              color:      visualOnly ? "var(--accent)" : "var(--tx-3)",
              display:    "flex", alignItems: "center", justifyContent: "center",
            }}>
            {visualOnly ? "👁" : "🔈"}
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div style={{
          display:       "flex",
          borderBottom:  "1px solid var(--sep)",
          margin:        "0 -14px",
          padding:       "0 14px",
        }}>
          {TABS.map(({ id, label }) => {
            const isActive = activeTab === id;
            return (
              <button key={id} type="button" onClick={() => setActiveTab(id)}
                style={{
                  flex:       1, height: 32,
                  fontSize:   11, fontWeight: isActive ? 700 : 400,
                  color:      isActive ? "var(--tx-1)" : "var(--tx-3)",
                  background: "transparent",
                  border:     "none",
                  borderBottom: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
                  marginBottom: -1,
                  cursor:     "pointer", transition: "all 0.12s",
                }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Tab: Tempo ── */}
        {activeTab === "tempo" && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <SecLabel>Mesure</SecLabel>
                <FlexRow gap={3}>
                  {SIG_PRESETS.map(({ label, sig: s }) => (
                    <Chip key={label} active={sig.numerator === s.numerator && sig.denominator === s.denominator} onClick={() => applySig(s)} small>{label}</Chip>
                  ))}
                </FlexRow>
              </div>
              <div>
                <SecLabel>Subdivision</SecLabel>
                <FlexRow gap={3}>
                  {SUBDIV_OPTS.map(({ id, symbol, label: lbl }) => (
                    <Chip key={id} active={subdiv === id} title={lbl} small
                      onClick={() => { metronomeEngine.setSubdivision(id); setSubdiv(id); }}>
                      {symbol}
                    </Chip>
                  ))}
                </FlexRow>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10 }}>
              <div>
                <SecLabel>Décompte</SecLabel>
                <FlexRow gap={3}>
                  {[0, 1, 2, 4].map((n) => (
                    <Chip key={n} active={countIn === n} small
                      onClick={() => { metronomeEngine.setCountInBars(n); setCountIn(n); }}>
                      {n === 0 ? "Off" : `${n}m`}
                    </Chip>
                  ))}
                </FlexRow>
              </div>
              <div>
                <SecLabel>Son</SecLabel>
                <FlexRow gap={3}>
                  {SOUND_OPTS.map(({ id, label: lbl }) => (
                    <Chip key={id} active={sound === id} small
                      onClick={() => { metronomeEngine.setSoundType(id); setSound(id); }}>
                      {lbl}
                    </Chip>
                  ))}
                </FlexRow>
              </div>
            </div>

            <div>
              <SecLabel>Volumes</SecLabel>
              <SliderRow label="Master" value={Math.round(vol * 100)} min={0} max={100} valStr={`${Math.round(vol * 100)}%`}
                onChange={(v) => { const n = v / 100; metronomeEngine.setVolume(n); setVol(n); }} />
              <SliderRow label="Accent fort" value={Math.round(volAcc * 100)} min={0} max={100} valStr={`${Math.round(volAcc * 100)}%`} color="var(--c-yellow)"
                onChange={(v) => { const n = v / 100; metronomeEngine.setVolumeAccent(n); setVolAcc(n); }} />
              <SliderRow label="Subdivisions" value={Math.round(volSub * 100)} min={0} max={100} valStr={`${Math.round(volSub * 100)}%`} color="var(--c-green)"
                onChange={(v) => { const n = v / 100; metronomeEngine.setVolumeSubdiv(n); setVolSub(n); }} />
            </div>

            <Section title="Accents" badge={pattern.length > 0 ? "custom" : undefined}>
              <AccentGrid numerator={sig.numerator} pattern={pattern} onChange={applyPattern} />
            </Section>
          </div>
        )}

        {/* ── Tab: Training ── */}
        {activeTab === "training" && (
          <div>
            <Section title="Silence Training" defaultOpen badge={silence.enabled ? "ON" : undefined}>
              <div style={{ marginBottom: 8 }}>
                <Chip active={silence.enabled} onClick={() => { const v = { ...silence, enabled: !silence.enabled }; metronomeEngine.setSilence(v); setSilence(v); }}>
                  {silence.enabled ? "✓ Activé" : "Activer"}
                </Chip>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 9.5, color: "var(--tx-4)", marginBottom: 5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Clic (mesures)</div>
                  <FlexRow gap={3}>
                    {[1, 2, 4, 8, 16].map((n) => (
                      <Chip key={n} active={silence.onMeasures === n} small onClick={() => { const v = { ...silence, onMeasures: n }; metronomeEngine.setSilence(v); setSilence(v); }}>{n}</Chip>
                    ))}
                  </FlexRow>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, color: "var(--tx-4)", marginBottom: 5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Silence (mesures)</div>
                  <FlexRow gap={3}>
                    {[1, 2, 4, 8, 16].map((n) => (
                      <Chip key={n} active={silence.offMeasures === n} small onClick={() => { const v = { ...silence, offMeasures: n }; metronomeEngine.setSilence(v); setSilence(v); }}>{n}</Chip>
                    ))}
                  </FlexRow>
                </div>
              </div>
              <Chip active={silence.progressive} onClick={() => { const v = { ...silence, progressive: !silence.progressive }; metronomeEngine.setSilence(v); setSilence(v); }}>
                Progressif (+1 silence/cycle)
              </Chip>
            </Section>

            <Section title="Progression BPM" defaultOpen badge={training.enabled ? `→ ${training.targetBpm}` : undefined}>
              <div style={{ marginBottom: 8 }}>
                <Chip active={training.enabled} onClick={() => { const v = { ...training, enabled: !training.enabled }; metronomeEngine.setTraining(v); setTraining(v); }}>
                  {training.enabled ? "✓ Activé" : "Activer"}
                </Chip>
              </div>
              <SliderRow label="BPM cible" value={training.targetBpm} min={40} max={300}
                onChange={(v) => { const t = { ...training, targetBpm: v }; metronomeEngine.setTraining(t); setTraining(t); }} />
              <div style={{ marginBottom: 8 }}>
                <SecLabel>Pas (+BPM)</SecLabel>
                <FlexRow gap={4}>
                  {[1, 2, 5, 10].map((n) => (
                    <Chip key={n} active={training.stepBpm === n} small onClick={() => { const t = { ...training, stepBpm: n }; metronomeEngine.setTraining(t); setTraining(t); }}>+{n}</Chip>
                  ))}
                </FlexRow>
              </div>
              <div style={{ marginBottom: 8 }}>
                <SecLabel>Toutes les N mesures</SecLabel>
                <FlexRow gap={4}>
                  {[1, 2, 4, 8, 16].map((n) => (
                    <Chip key={n} active={training.stepMeasures === n} small onClick={() => { const t = { ...training, stepMeasures: n }; metronomeEngine.setTraining(t); setTraining(t); }}>{n}m</Chip>
                  ))}
                </FlexRow>
              </div>
              <Chip active={training.descend} onClick={() => { const t = { ...training, descend: !training.descend }; metronomeEngine.setTraining(t); setTraining(t); }}>
                Redescendre après la cible
              </Chip>
              {training.enabled && running && (
                <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--tx-3)" }}>
                  {bpm} BPM → {training.targetBpm} · +{training.stepBpm} / {training.stepMeasures} mesure{training.stepMeasures > 1 ? "s" : ""}
                </div>
              )}
            </Section>

            <Section title="Polyrythmie" badge={poly.enabled ? `÷${poly.against}` : undefined}>
              <div style={{ marginBottom: 8 }}>
                <Chip active={poly.enabled} onClick={() => { const v = { ...poly, enabled: !poly.enabled }; metronomeEngine.setPoly(v); setPoly(v); }}>
                  {poly.enabled ? "✓ Activé" : "Activer"}
                </Chip>
              </div>
              <SecLabel>Contre</SecLabel>
              <FlexRow gap={4}>
                {[2, 3, 4, 5, 6, 7].map((n) => (
                  <Chip key={n} active={poly.against === n} small onClick={() => { const v = { ...poly, against: n }; metronomeEngine.setPoly(v); setPoly(v); }}>{n}</Chip>
                ))}
              </FlexRow>
              {poly.enabled && (
                <div style={{ fontSize: 10, color: "var(--tx-4)", marginTop: 6 }}>{poly.against} pulsations contre {sig.numerator}/{sig.denominator}</div>
              )}
            </Section>

            <Section title="Mode Précision" badge={precisionOn ? "actif" : undefined}>
              <div style={{ marginBottom: 8 }}>
                <Chip active={precisionOn} onClick={togglePrecision}>{precisionOn ? "✓ Actif" : "Activer"}</Chip>
              </div>
              {precisionOn && (
                <>
                  <button type="button" onClick={precisionTap}
                    style={{ width: "100%", height: 46, borderRadius: 8, marginBottom: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "var(--bg-3)", border: "1.5px solid var(--sep-2)", color: "var(--tx-1)" }}>
                    Tapper ici · <kbd style={{ fontSize: 10.5, fontFamily: "monospace", background: "var(--bg-4)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--sep-2)" }}>P</kbd>
                  </button>
                  {metrics && metrics.tapCount > 0 ? (
                    <PrecisionDisplay metrics={metrics} />
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--tx-4)", textAlign: "center", padding: "6px 0" }}>
                      Tape en rythme avec le métronome
                    </div>
                  )}
                  <button type="button" onClick={() => { precisionEngine.reset(); setMetrics(null); }}
                    style={{ marginTop: 6, fontSize: 10, color: "var(--tx-4)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    Réinitialiser
                  </button>
                </>
              )}
            </Section>
          </div>
        )}

        {/* ── Tab: Presets ── */}
        {activeTab === "presets" && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
            <div>
              <SecLabel>Presets par défaut</SecLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                {DEFAULT_METRO_PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => applyPreset(p)}
                    style={{ height: 32, borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: "pointer", background: "var(--bg-3)", border: "1px solid var(--sep-2)", color: "var(--tx-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, padding: "0 10px", textAlign: "left", transition: "all 0.1s" }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {userPresets.length > 0 && (
              <div>
                <SecLabel>Mes presets</SecLabel>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                  {userPresets.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <button type="button" onClick={() => applyPreset(p)}
                        style={{ flex: 1, height: 30, borderRadius: 6, fontSize: 11, cursor: "pointer", background: "var(--bg-3)", border: "1px solid var(--sep-2)", color: "var(--tx-2)", textAlign: "left", padding: "0 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                        {p.name}
                      </button>
                      <button type="button" onClick={() => delPreset(p.id)}
                        style={{ width: 26, height: 26, borderRadius: 5, fontSize: 13, background: "transparent", border: "none", color: "var(--tx-4)", cursor: "pointer" }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="button" onClick={savePreset}
              style={{ width: "100%", height: 34, borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--accent-dim)", border: "1px solid var(--accent-line)", color: "var(--accent)", cursor: "pointer" }}>
              + Sauvegarder la configuration actuelle
            </button>

            <div style={{ fontSize: 10, color: "var(--tx-4)", textAlign: "center" }}>
              <kbd style={{ fontFamily: "monospace", background: "var(--bg-3)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--sep-2)" }}>Espace</kbd> Start/Stop &nbsp;
              <kbd style={{ fontFamily: "monospace", background: "var(--bg-3)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--sep-2)" }}>T</kbd> Tap
              {precisionOn && <> &nbsp;<kbd style={{ fontFamily: "monospace", background: "var(--bg-3)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--sep-2)" }}>P</kbd> Précision</>}
            </div>
          </div>
        )}

        {/* ── Tab: Avancé ── */}
        {activeTab === "advanced" && (
          <div style={{ margin: "0 -14px -10px", minHeight: 300 }}>
            <AdvancedMetronomePanel bpm={bpm} numerator={sig.numerator} running={running} />
          </div>
        )}

      </div>

      {workshopMode && createPortal(
        <RhythmWorkshop onClose={() => setWorkshopMode(false)} />,
        document.body
      )}
    </div>
  );
};
