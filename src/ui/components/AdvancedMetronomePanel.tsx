/**
 * AdvancedMetronomePanel — mode "Avancé" du métronome.
 * Subdivision indépendante par temps, thème clair desktop.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAdvancedMetronomeStore,
  INSTRUMENT_META,
  MAX_METRONOMES,
  buildDefaultPattern,
} from "../../store/advancedMetronomeStore";
import type { AdvMetronome, InstrumentId, StepAccent, AdvMetroStep } from "../../store/advancedMetronomeStore";
import { advancedMetronomeEngine } from "../../audio/advancedMetronomeEngine";
import { metronomeEngine } from "../../audio/metronomeEngine";
import { InstrumentPicker } from "./InstrumentPicker";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AdvancedMetronomePanelProps {
  bpm:       number;
  numerator: number;
  running:   boolean;
}

// ─── Accent system ─────────────────────────────────────────────────────────────

const ACCENT_CYCLE: StepAccent[] = ["normal", "accent", "strong", "ghost", "mute"];

interface AccentCfg { icon: string; label: string; bg: string; border: string; color: string; }

const ACCENT_CFG: Record<StepAccent, AccentCfg> = {
  normal: { icon: "•",  label: "Normal",  bg: "var(--bg-sel)",           border: "var(--sep-3)",         color: "var(--tx-2)"    },
  accent: { icon: "›",  label: "Accent",  bg: "var(--accent-dim)",       border: "var(--accent-line)",   color: "var(--accent)"  },
  strong: { icon: "»",  label: "Fort",    bg: "rgba(37,162,68,0.12)",    border: "rgba(37,162,68,0.38)", color: "var(--c-green)" },
  ghost:  { icon: "·",  label: "Ghost",   bg: "var(--bg-hover)",         border: "var(--sep-2)",         color: "var(--tx-4)"    },
  mute:   { icon: "–",  label: "Muet",    bg: "transparent",             border: "var(--sep)",           color: "var(--tx-4)"    },
};

// ─── Subdivision constants ──────────────────────────────────────────────────────

const SUBDIV_VALUES = [1, 2, 3, 4, 5, 6, 7, 8];
const SUBDIV_ICON: Record<number, string> = {
  1: "♩", 2: "♪", 3: "♪3", 4: "♬", 5: "5×", 6: "6×", 7: "7×", 8: "8×",
};

// ─── Small helpers ──────────────────────────────────────────────────────────────

const SecLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 9.5, fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "0.09em", color: "var(--tx-3)", marginBottom: 6,
  }}>
    {children}
  </div>
);

// ─── Toggle Switch ──────────────────────────────────────────────────────────────

const ToggleSwitch = ({
  on, onChange, label, description,
}: {
  on: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) => (
  <div
    style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" as const }}
    onClick={() => onChange(!on)}
  >
    <div style={{
      width: 34, height: 20, borderRadius: 10, flexShrink: 0,
      background: on ? "var(--accent)" : "var(--sep-3)",
      position: "relative", transition: "background 0.18s",
    }}>
      <div style={{
        position: "absolute", top: 3, left: on ? 17 : 3,
        width: 14, height: 14, borderRadius: "50%",
        background: "#fff", transition: "left 0.18s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
      }} />
    </div>
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--tx-2)", lineHeight: 1.2 }}>{label}</div>
      {description && (
        <div style={{ fontSize: 10, color: "var(--tx-4)", lineHeight: 1.3, marginTop: 1 }}>{description}</div>
      )}
    </div>
  </div>
);

// ─── Per-beat subdivision control ──────────────────────────────────────────────

const PerBeatSubdivControl = ({
  pattern, numBeats, defaultSubdiv, color, instrument,
  onSetBeat, onApplyAll,
}: {
  pattern:       AdvMetroStep[][];
  numBeats:      number;
  defaultSubdiv: number;
  color:         string;
  instrument:    InstrumentId;
  onSetBeat:     (beat: number, subdiv: number) => void;
  onApplyAll:    (subdiv: number, newPattern: AdvMetroStep[][]) => void;
}) => {
  // Derive per-beat subdivisions from the pattern lengths
  const subdivs = Array.from({ length: numBeats }, (_, b) =>
    Math.max(1, pattern[b]?.length ?? defaultSubdiv)
  );
  const total   = subdivs.reduce((a, b) => a + b, 0);
  const allSame = subdivs.every(v => v === subdivs[0]);

  const infoText = allSame
    ? `${subdivs[0]}× par temps · ${total} cellules au total`
    : `Personnalisé : ${subdivs.join(" + ")} · ${total} cellules au total`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <SecLabel>Subdivision par temps</SecLabel>
        {!allSame && (
          <span style={{
            fontSize: 9, color: "var(--accent)",
            background: "var(--accent-dim)", padding: "1px 6px",
            borderRadius: 99, border: "1px solid var(--accent-line)",
          }}>
            personnalisé
          </span>
        )}
      </div>

      {/* Per-beat cards */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, marginBottom: 10 }}>
        {subdivs.map((sv, b) => {
          const isCustom = sv !== defaultSubdiv;
          return (
            <div key={b} style={{
              minWidth: 50, flex: "1 1 50px",
              background: isCustom ? `${color}0d` : "var(--bg-3)",
              border: `1.5px solid ${isCustom ? `${color}55` : "var(--sep-2)"}`,
              borderRadius: 8, padding: "7px 4px 6px",
              display: "flex", flexDirection: "column" as const,
              alignItems: "center", gap: 5,
              transition: "border-color 0.15s, background 0.15s",
            }}>
              {/* Beat number */}
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                color: isCustom ? color : "var(--tx-4)",
              }}>
                T{b + 1}
              </span>

              {/* Stepper */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button type="button"
                  onClick={() => {
                    const idx = SUBDIV_VALUES.indexOf(sv);
                    if (idx > 0) onSetBeat(b, SUBDIV_VALUES[idx - 1]);
                  }}
                  disabled={sv <= 1}
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    fontSize: 13, fontWeight: 700,
                    background: "transparent",
                    border: "1px solid var(--sep-2)",
                    color: "var(--tx-3)",
                    cursor: sv > 1 ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: sv <= 1 ? 0.25 : 1, lineHeight: 1,
                  }}>
                  −
                </button>

                <span style={{
                  fontSize: 18, fontWeight: 900, lineHeight: 1,
                  color: isCustom ? color : "var(--tx-1)",
                  minWidth: 18, textAlign: "center" as const,
                  fontVariantNumeric: "tabular-nums" as const,
                }}>
                  {sv}
                </span>

                <button type="button"
                  onClick={() => {
                    const idx = SUBDIV_VALUES.indexOf(sv);
                    if (idx < SUBDIV_VALUES.length - 1) onSetBeat(b, SUBDIV_VALUES[idx + 1]);
                  }}
                  disabled={sv >= 8}
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    fontSize: 13, fontWeight: 700,
                    background: "transparent",
                    border: "1px solid var(--sep-2)",
                    color: "var(--tx-3)",
                    cursor: sv < 8 ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: sv >= 8 ? 0.25 : 1, lineHeight: 1,
                  }}>
                  +
                </button>
              </div>

              {/* Icon */}
              <span style={{ fontSize: 9, color: isCustom ? color : "var(--tx-4)", fontWeight: 500 }}>
                {SUBDIV_ICON[sv] ?? `${sv}×`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Apply to all quick row */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" as const, marginBottom: 7 }}>
        <span style={{ fontSize: 9.5, color: "var(--tx-4)", flexShrink: 0, marginRight: 2 }}>
          Appliquer à tous :
        </span>
        {SUBDIV_VALUES.map(v => {
          const isActive = allSame && subdivs[0] === v;
          return (
            <button key={v} type="button"
              onClick={() => onApplyAll(v, buildDefaultPattern(instrument, numBeats, v))}
              style={{
                height: 22, padding: "0 6px", borderRadius: 5,
                fontSize: 10, fontWeight: 600,
                background: isActive ? color : "transparent",
                border: `1px solid ${isActive ? color : "var(--sep-2)"}`,
                color: isActive ? "#fff" : "var(--tx-3)",
                cursor: "pointer", transition: "all 0.1s",
              }}>
              {v}×
            </button>
          );
        })}
      </div>

      {/* Info */}
      <p style={{ fontSize: 9.5, color: "var(--tx-4)", margin: 0 }}>{infoText}</p>
    </div>
  );
};

// ─── Pattern Editor ─────────────────────────────────────────────────────────────

const PatternEditor = ({
  metro, numBeats, onStep, onReset,
}: {
  metro: AdvMetronome; numBeats: number;
  onStep: (beat: number, step: number, field: "active" | "accent") => void;
  onReset: () => void;
}) => {
  // Per-beat step counts from the actual pattern
  const beatLens = Array.from({ length: numBeats }, (_, b) =>
    Math.max(1, metro.pattern[b]?.length ?? metro.subdivision)
  );
  const total   = beatLens.reduce((a, c) => a + c, 0);
  const maxLen  = Math.max(...beatLens, 1);

  // Cell sizing — adapt to density
  const cellH    = total > 20 ? 26 : 32;
  const cellMinW = total > 28 ? 12 : total > 20 ? 16 : 22;
  const iconSize = total > 20 ? 11 : 14;
  const needsScroll = total > 24;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--tx-2)" }}>Rythme</span>
          <span style={{ fontSize: 10, color: "var(--tx-4)", marginLeft: 7 }}>
            {total} cellule{total > 1 ? "s" : ""}
          </span>
        </div>
        <button type="button" onClick={onReset}
          style={{
            height: 24, padding: "0 8px", borderRadius: 5,
            fontSize: 10.5, color: "var(--tx-4)",
            background: "transparent", border: "1px solid var(--sep-2)",
            cursor: "pointer",
          }}>
          ↺ Réinit.
        </button>
      </div>

      {/* Grid */}
      <div style={{
        overflowX: needsScroll ? "auto" : "visible",
        marginBottom: 8,
        paddingBottom: needsScroll ? 4 : 0,
      }}>
        <div style={{
          display: "flex", gap: 5,
          minWidth: needsScroll
            ? `${numBeats * (maxLen * (cellMinW + 2) + 5)}px`
            : undefined,
        }}>
          {Array.from({ length: numBeats }, (_, b) => {
            const len = beatLens[b];
            return (
              <div key={b} style={{
                flex: len, // proportional width per beat
                display: "flex", flexDirection: "column" as const, gap: 3,
                minWidth: len * (cellMinW + 2),
              }}>
                {/* Beat label */}
                <div style={{
                  fontSize: 8.5, color: "var(--tx-4)", fontWeight: 700,
                  textAlign: "center", letterSpacing: "0.04em",
                }}>
                  {b + 1}
                  {len !== metro.subdivision && (
                    <span style={{ color: metro.color, marginLeft: 2 }}>·{len}</span>
                  )}
                </div>
                {/* Steps */}
                <div style={{ display: "flex", gap: 2 }}>
                  {Array.from({ length: len }, (_, s) => {
                    const cell   = metro.pattern[b]?.[s];
                    const active = cell?.active ?? false;
                    const accent = cell?.accent ?? "normal";
                    const cfg    = active ? ACCENT_CFG[accent] : null;
                    return (
                      <button
                        key={s}
                        type="button"
                        title={
                          active
                            ? `${ACCENT_CFG[accent].label} — Clic: désactiver · Clic droit: accent`
                            : "Inactif — Clic: activer"
                        }
                        onPointerDown={(e) => {
                          e.preventDefault();
                          if (e.button === 2) { if (active) onStep(b, s, "accent"); }
                          else                { onStep(b, s, "active"); }
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                          flex: 1,
                          minWidth: cellMinW,
                          height: cellH,
                          borderRadius: 4,
                          background: cfg ? cfg.bg : "var(--bg-3)",
                          border: `1.5px solid ${cfg ? cfg.border : "var(--sep-2)"}`,
                          color: cfg ? cfg.color : "var(--tx-4)",
                          cursor: "pointer",
                          fontSize: iconSize, fontWeight: 800,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.08s",
                        }}
                      >
                        {active ? cfg!.icon : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: 0, flexWrap: "wrap" as const,
        background: "var(--bg-3)", border: "1px solid var(--sep)",
        borderRadius: 7, overflow: "hidden",
      }}>
        {(Object.entries(ACCENT_CFG) as [StepAccent, AccentCfg][]).map(([, cfg], i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "5px 8px",
            borderRight: i < 4 ? "1px solid var(--sep)" : "none",
            flex: 1, justifyContent: "center",
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color, lineHeight: 1, width: 12, textAlign: "center" as const }}>
              {cfg.icon}
            </span>
            <span style={{ fontSize: 9, color: "var(--tx-4)", whiteSpace: "nowrap" as const }}>{cfg.label}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 9, color: "var(--tx-4)", margin: "5px 0 0", textAlign: "right" as const }}>
        Clic gauche — activer · Clic droit — changer accent
      </p>
    </div>
  );
};

// ─── Metronome Card ─────────────────────────────────────────────────────────────

const MetronomeCard = ({
  metro, numBeats,
  onToggleEnabled, onToggleMute, onToggleSolo, onToggleExpanded,
  onUpdate, onStep, onReset, onRemove, onSetBeatSubdiv,
}: {
  metro: AdvMetronome; numBeats: number;
  onToggleEnabled: () => void; onToggleMute: () => void;
  onToggleSolo: () => void; onToggleExpanded: () => void;
  onUpdate: (patch: Partial<AdvMetronome>) => void;
  onStep: (beat: number, step: number, field: "active" | "accent") => void;
  onReset: () => void; onRemove: () => void;
  onSetBeatSubdiv: (beat: number, subdiv: number) => void;
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta    = INSTRUMENT_META[metro.instrument];
  const isMuted = metro.muted;
  const isSolo  = metro.solo;
  const isOff   = !metro.enabled;
  const dimmed  = isOff || isMuted;

  // Derived per-beat subdivisions for the subtitle
  const subdivs  = Array.from({ length: numBeats }, (_, b) =>
    Math.max(1, metro.pattern[b]?.length ?? metro.subdivision)
  );
  const allSame  = subdivs.every(v => v === subdivs[0]);
  const subLabel = allSame
    ? (subdivs[0] === 1 ? "Noire" : subdivs[0] === 2 ? "Croche" : subdivs[0] === 4 ? "Double croche" : `${subdivs[0]}×/temps`)
    : `Personnalisé (${subdivs.join("·")})`;

  return (
    <div style={{
      borderRadius: 10,
      background:   "var(--bg-2)",
      border:       "1px solid var(--sep-2)",
      borderLeft:   `3px solid ${dimmed ? "var(--sep-3)" : metro.color}`,
      overflow:     "hidden",
      boxShadow:    "var(--shadow-sm)",
      transition:   "border-color 0.15s, opacity 0.15s",
      opacity:      dimmed ? 0.65 : 1,
    }}>

      {/* ── Card header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px",
        background: "var(--bg-3)",
        borderBottom: metro.expanded ? "1px solid var(--sep)" : "none",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${metro.color}18`,
          border: `1.5px solid ${metro.color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16,
        }}>
          {meta.emoji}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tx-1)", lineHeight: 1.2 }}>
            {metro.name}
          </div>
          <div style={{ fontSize: 9.5, color: "var(--tx-4)", marginTop: 1 }}>
            {subLabel} · {Math.round(metro.volume * 100)}%
            {metro.humanize.enabled && " · Humanize"}
            {metro.swing > 0 && ` · Swing ${Math.round(metro.swing * 100)}%`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <button type="button" onClick={onToggleEnabled}
            title={metro.enabled ? "Désactiver" : "Activer"}
            style={{
              height: 24, padding: "0 9px", borderRadius: 6,
              fontSize: 10, fontWeight: 700,
              background:  metro.enabled ? `${metro.color}1a` : "var(--bg-4)",
              border:      `1px solid ${metro.enabled ? `${metro.color}44` : "var(--sep-2)"}`,
              color:       metro.enabled ? metro.color : "var(--tx-4)",
              cursor: "pointer", transition: "all 0.12s",
            }}>
            {metro.enabled ? "ON" : "OFF"}
          </button>

          <button type="button" onClick={onToggleMute}
            title={isMuted ? "Réactiver le son" : "Mute"}
            style={{
              width: 28, height: 24, borderRadius: 6,
              fontSize: 10, fontWeight: 700,
              background:  isMuted ? "rgba(217,48,37,0.10)" : "transparent",
              border:      `1px solid ${isMuted ? "rgba(217,48,37,0.28)" : "var(--sep-2)"}`,
              color:       isMuted ? "var(--c-red)" : "var(--tx-3)",
              cursor: "pointer", transition: "all 0.12s",
            }}>
            M
          </button>

          <button type="button" onClick={onToggleSolo}
            title={isSolo ? "Désactiver le solo" : "Solo"}
            style={{
              width: 28, height: 24, borderRadius: 6,
              fontSize: 10, fontWeight: 700,
              background:  isSolo ? "rgba(192,144,0,0.12)" : "transparent",
              border:      `1px solid ${isSolo ? "rgba(192,144,0,0.32)" : "var(--sep-2)"}`,
              color:       isSolo ? "var(--c-yellow)" : "var(--tx-3)",
              cursor: "pointer", transition: "all 0.12s",
            }}>
            S
          </button>
        </div>

        <button type="button" onClick={onToggleExpanded}
          title={metro.expanded ? "Réduire" : "Développer"}
          style={{
            width: 22, height: 22, borderRadius: 5, flexShrink: 0,
            background: "none", border: "none",
            color: "var(--tx-4)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: metro.expanded ? "rotate(90deg)" : "none",
            transition: "transform 0.15s", fontSize: 9,
          }}>
          ▶
        </button>
      </div>

      {/* ── Expanded body ── */}
      {metro.expanded && (
        <div style={{
          padding: "14px 14px 16px",
          display: "flex", flexDirection: "column" as const, gap: 16,
        }}>

          {/* Volume */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <SecLabel>Volume</SecLabel>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: metro.color }}>
                {Math.round(metro.volume * 100)}%
              </span>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={metro.volume}
              onChange={(e) => onUpdate({ volume: Number(e.target.value) })}
              className="compact-range"
              style={{ width: "100%", accentColor: metro.color }}
            />
          </div>

          {/* Per-beat subdivision */}
          <PerBeatSubdivControl
            pattern={metro.pattern}
            numBeats={numBeats}
            defaultSubdiv={metro.subdivision}
            color={metro.color}
            instrument={metro.instrument}
            onSetBeat={onSetBeatSubdiv}
            onApplyAll={(subdiv, newPattern) =>
              onUpdate({ subdivision: subdiv, pattern: newPattern })
            }
          />

          {/* Humanize */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
            <ToggleSwitch
              on={metro.humanize.enabled}
              onChange={(v) => onUpdate({ humanize: { ...metro.humanize, enabled: v } })}
              label="Humanize"
              description="Légères variations de timing pour un rendu naturel"
            />
            {metro.humanize.enabled && (
              <div style={{ paddingLeft: 44 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "var(--tx-4)" }}>Décalage max</span>
                  <span style={{ fontSize: 10.5, fontFamily: "monospace", fontWeight: 700, color: "var(--c-orange)" }}>
                    ±{metro.humanize.timingMs} ms
                  </span>
                </div>
                <input type="range" min={0} max={40} step={1}
                  value={metro.humanize.timingMs}
                  onChange={(e) => onUpdate({ humanize: { ...metro.humanize, timingMs: Number(e.target.value) } })}
                  className="compact-range"
                  style={{ width: "100%", accentColor: "var(--c-orange)" }}
                />
              </div>
            )}
          </div>

          {/* Swing */}
          {metro.subdivision >= 2 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <SecLabel>Swing</SecLabel>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: metro.swing > 0 ? "#8b5cf6" : "var(--tx-4)" }}>
                  {Math.round(metro.swing * 100)}%
                </span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={metro.swing}
                onChange={(e) => onUpdate({ swing: Number(e.target.value) })}
                className="compact-range"
                style={{ width: "100%", accentColor: "#8b5cf6" }}
              />
            </div>
          )}

          {/* Pattern editor */}
          <PatternEditor metro={metro} numBeats={numBeats} onStep={onStep} onReset={onReset} />

          {/* Delete */}
          <div style={{ borderTop: "1px solid var(--sep)", paddingTop: 10 }}>
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                style={{
                  height: 28, padding: "0 12px", borderRadius: 6,
                  fontSize: 11, fontWeight: 500,
                  background: "transparent",
                  border: "1px solid var(--sep-2)",
                  color: "var(--tx-4)", cursor: "pointer", transition: "all 0.12s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "rgba(217,48,37,0.35)";
                  el.style.color = "var(--c-red)";
                  el.style.background = "rgba(217,48,37,0.05)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--sep-2)";
                  el.style.color = "var(--tx-4)";
                  el.style.background = "transparent";
                }}>
                Supprimer ce métronome
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 11, color: "var(--tx-3)", flex: 1 }}>
                  Confirmer la suppression ?
                </span>
                <button type="button" onClick={() => { onRemove(); setConfirmDelete(false); }}
                  style={{ height: 28, padding: "0 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(217,48,37,0.10)", border: "1px solid rgba(217,48,37,0.30)", color: "var(--c-red)", cursor: "pointer" }}>
                  Supprimer
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}
                  style={{ height: 28, padding: "0 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: "var(--bg-3)", border: "1px solid var(--sep-2)", color: "var(--tx-3)", cursor: "pointer" }}>
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main panel ─────────────────────────────────────────────────────────────────

export const AdvancedMetronomePanel = ({ bpm, numerator, running }: AdvancedMetronomePanelProps) => {
  const {
    metronomes, canAdd, addMetronome, removeMetronome, updateMetronome,
    toggleEnabled, toggleMute, toggleSolo, toggleExpanded,
    setStep, setSubdivisionForBeat, resetPattern, resetAll,
  } = useAdvancedMetronomeStore();

  const [showPicker,   setShowPicker]   = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    advancedMetronomeEngine.syncMetronomes(metronomes);
  }, [metronomes]);

  const metronomeRef = useRef(metronomes);
  metronomeRef.current = metronomes;

  useEffect(() => {
    metronomeEngine.setAdvancedScheduleCallback(
      (ws, we, startTime, b, num) =>
        advancedMetronomeEngine.scheduleWindow(ws, we, startTime, b, num, metronomeRef.current)
    );
    return () => metronomeEngine.setAdvancedScheduleCallback(null);
  }, []);

  const collapseAll = () => metronomes.forEach((m) => { if (m.expanded) toggleExpanded(m.id); });

  const usedInstruments = new Set<InstrumentId>(metronomes.map((m) => m.instrument));

  const handleStep = useCallback((id: string, beat: number, step: number, field: "active" | "accent") => {
    const metro = metronomes.find((m) => m.id === id);
    if (!metro) return;
    const cell = metro.pattern[beat]?.[step];
    if (!cell) return;
    if (field === "active") {
      setStep(id, beat, step, { active: !cell.active });
    } else {
      const idx  = ACCENT_CYCLE.indexOf(cell.accent);
      const next = ACCENT_CYCLE[(idx + 1) % ACCENT_CYCLE.length];
      setStep(id, beat, step, { accent: next });
    }
  }, [metronomes, setStep]);

  return (
    <div style={{
      display: "flex", flexDirection: "column" as const,
      height: "100%", background: "var(--bg-2)",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 9px",
        borderBottom: "1px solid var(--sep)",
        flexShrink: 0,
        background: "var(--bg-3)",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tx-1)" }}>
              Multi-métronomes
            </span>
            {running && (
              <div className="play-dot" style={{
                width: 6, height: 6, borderRadius: "50%", background: "var(--c-green)",
              }} />
            )}
          </div>
          <p style={{ fontSize: 10, color: "var(--tx-4)", margin: "2px 0 0" }}>
            {metronomes.length}/{MAX_METRONOMES} actifs · {bpm} BPM · {numerator}/4
          </p>
        </div>

        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {metronomes.length > 1 && (
            <button type="button" onClick={collapseAll}
              style={{
                height: 26, padding: "0 10px", borderRadius: 6, fontSize: 10.5,
                background: "transparent", border: "1px solid var(--sep-2)",
                color: "var(--tx-3)", cursor: "pointer",
              }}>
              Réduire tout
            </button>
          )}
          <button type="button"
            disabled={!canAdd}
            onClick={() => setShowPicker(true)}
            title={!canAdd ? `Limite de ${MAX_METRONOMES} métronomes atteinte` : "Ajouter un métronome"}
            style={{
              height: 30, padding: "0 14px", borderRadius: 7,
              fontSize: 12, fontWeight: 700,
              cursor: canAdd ? "pointer" : "not-allowed",
              background: canAdd ? "var(--accent)" : "var(--bg-4)",
              border: "none",
              color: canAdd ? "#fff" : "var(--tx-4)",
              boxShadow: canAdd ? "0 2px 8px rgba(0,113,227,0.28)" : "none",
              opacity: canAdd ? 1 : 0.55,
              transition: "all 0.15s",
            }}>
            + Créer
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 14px 16px" }}>

        {/* Empty state */}
        {metronomes.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column" as const,
            alignItems: "center", justifyContent: "center",
            gap: 16, padding: "40px 20px", textAlign: "center",
            minHeight: 220,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--bg-3)",
              border: "2px dashed var(--sep-3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28,
            }}>
              🥁
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--tx-2)", margin: "0 0 7px" }}>
                Aucun métronome avancé
              </p>
              <p style={{ fontSize: 11.5, color: "var(--tx-4)", margin: 0, lineHeight: 1.65 }}>
                Crée un métronome par instrument.<br />
                Jusqu'à {MAX_METRONOMES} simultanément, synchronisés<br />
                sur le même tempo.
              </p>
            </div>
            <button type="button" onClick={() => setShowPicker(true)}
              style={{
                height: 38, padding: "0 24px", borderRadius: 10,
                fontSize: 13.5, fontWeight: 700,
                background: "var(--accent)", border: "none", color: "#fff",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,113,227,0.28)",
              }}>
              + Créer mon premier métronome
            </button>
          </div>
        )}

        {/* Limit banner */}
        {metronomes.length >= MAX_METRONOMES && (
          <div style={{
            padding: "7px 12px", borderRadius: 8, marginBottom: 10,
            background: "rgba(192,144,0,0.08)",
            border: "1px solid rgba(192,144,0,0.20)",
            fontSize: 11, color: "var(--c-yellow)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>⚠</span>
            Limite atteinte — {MAX_METRONOMES}/{MAX_METRONOMES} métronomes
          </div>
        )}

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          {metronomes.map((metro) => (
            <MetronomeCard
              key={metro.id}
              metro={metro}
              numBeats={numerator}
              onToggleEnabled={() => toggleEnabled(metro.id)}
              onToggleMute={    () => toggleMute(metro.id)}
              onToggleSolo={    () => toggleSolo(metro.id)}
              onToggleExpanded={ () => toggleExpanded(metro.id)}
              onUpdate={(patch) => updateMetronome(metro.id, patch)}
              onStep={(b, s, f) => handleStep(metro.id, b, s, f)}
              onReset={() => resetPattern(metro.id, numerator)}
              onRemove={() => removeMetronome(metro.id)}
              onSetBeatSubdiv={(beat, subdiv) => setSubdivisionForBeat(metro.id, beat, subdiv)}
            />
          ))}
        </div>

        {/* Reset all */}
        {metronomes.length > 0 && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--sep)", paddingTop: 12 }}>
            {!confirmReset ? (
              <button type="button" onClick={() => setConfirmReset(true)}
                style={{
                  height: 28, padding: "0 12px", borderRadius: 6,
                  fontSize: 11, fontWeight: 500,
                  background: "transparent",
                  border: "1px solid var(--sep-2)",
                  color: "var(--tx-4)", cursor: "pointer", transition: "all 0.12s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "rgba(217,48,37,0.30)";
                  el.style.color = "var(--c-red)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--sep-2)";
                  el.style.color = "var(--tx-4)";
                }}>
                Tout supprimer
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 11, color: "var(--tx-3)", flex: 1 }}>
                  Supprimer tous les métronomes ?
                </span>
                <button type="button" onClick={() => { resetAll(); setConfirmReset(false); }}
                  style={{ height: 28, padding: "0 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(217,48,37,0.10)", border: "1px solid rgba(217,48,37,0.30)", color: "var(--c-red)", cursor: "pointer" }}>
                  Tout supprimer
                </button>
                <button type="button" onClick={() => setConfirmReset(false)}
                  style={{ height: 28, padding: "0 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: "var(--bg-3)", border: "1px solid var(--sep-2)", color: "var(--tx-3)", cursor: "pointer" }}>
                  Annuler
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Instrument picker ── */}
      {showPicker && (
        <InstrumentPicker
          onSelect={(id) => { addMetronome(id, numerator); }}
          onClose={() => setShowPicker(false)}
          disabled={usedInstruments}
        />
      )}
    </div>
  );
};
