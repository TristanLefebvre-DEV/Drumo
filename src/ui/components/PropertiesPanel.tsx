/**
 * Properties Panel — v1
 *
 * Panneau droit style image de référence : Propriétés | Piste.
 * - Instrument selector (pièce sélectionnée)
 * - Réglages : Volume (mixer), Panoramique, Hauteur
 * - Dynamics : Accentuation, Ghost Notes
 * - Humanize : Timing, Vélocité
 * - IA Suggestions contextuel
 */

import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { PIECE_TO_MIXER_CHANNEL } from "../../audio/drumKitManager";
import type { DrumPiece } from "../../core/types";
import type { DrumKitMixer } from "../../audio/drumKitManager";

// ─── Noms affichage pièces ────────────────────────────────────────────────────

const PIECE_LABELS: Partial<Record<DrumPiece, string>> = {
  kick:        "Grosse Caisse",
  kick2:       "Grosse Caisse 2",
  snare:       "Caisse Claire",
  snareRim:    "Bord Caisse",
  hihatClosed: "Hi-Hat Fermé",
  hihatOpen:   "Hi-Hat Ouvert",
  hihatPedal:  "Hi-Hat Pied",
  crash:       "Crash",
  ride:        "Ride",
  splash:      "Splash",
  tomHigh:     "Tom Aigu",
  tomMid:      "Tom Médium",
  tomLow:      "Tom Grave",
  otherCymbal: "Cymbal",
};

// ─── Icône instrument ─────────────────────────────────────────────────────────

const InstrumentIcon = ({ piece }: { piece: DrumPiece | null }) => {
  if (!piece) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" opacity="0.3">
        <circle cx="12" cy="12" r="9" stroke="var(--tx-2)" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="4" stroke="var(--tx-2)" strokeWidth="1.2"/>
      </svg>
    );
  }
  const isHihat = piece.startsWith("hihat");
  const isCymbal = ["crash","ride","splash","otherCymbal"].includes(piece);
  const isTom = piece.startsWith("tom");
  const isKick = piece === "kick";

  if (isKick) return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="16" rx="8" ry="3.5" stroke="var(--accent)" strokeWidth="1.4"/>
      <path d="M4 16V10M20 16V10" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round"/>
      <ellipse cx="12" cy="10" rx="8" ry="3.5" stroke="var(--accent)" strokeWidth="1.4"/>
    </svg>
  );
  if (isHihat) return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="8"  rx="8" ry="2"   stroke="var(--accent)" strokeWidth="1.4"/>
      <ellipse cx="12" cy="12" rx="8" ry="2"   stroke="var(--accent)" strokeWidth="1.4" opacity="0.6"/>
      <line x1="12" y1="14" x2="12" y2="20" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
  if (isCymbal) return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="10" rx="9" ry="2.5" stroke="var(--accent)" strokeWidth="1.4"/>
      <line x1="12" y1="13" x2="12" y2="20" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
  if (isTom) return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="9"  rx="7" ry="2.2" stroke="var(--accent)" strokeWidth="1.4"/>
      <path d="M5 9v6M19 9v6" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round"/>
      <ellipse cx="12" cy="15" rx="7" ry="2.2" stroke="var(--accent)" strokeWidth="1.4"/>
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke="var(--accent)" strokeWidth="1.4"/>
      <circle cx="12" cy="12" r="3" stroke="var(--accent)" strokeWidth="1.2" opacity="0.6"/>
    </svg>
  );
};

// ─── Slider row ───────────────────────────────────────────────────────────────

const SliderRow = ({
  label, value, min = 0, max = 100, step = 1,
  unit = "%", onChange, disabled = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange?: (v: number) => void;
  disabled?: boolean;
}) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 0,
    padding: "5px 0",
  }}>
    <span style={{
      fontSize: 11,
      color: "var(--tx-2)",
      width: 100,
      flexShrink: 0,
    }}>
      {label}
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(Number(e.target.value))}
      className="compact-range"
      style={{ flex: 1, opacity: disabled ? 0.35 : 1, cursor: disabled ? "default" : "pointer" }}
    />
    <span style={{
      fontSize: 11,
      color: "var(--tx-2)",
      width: 36,
      textAlign: "right",
      flexShrink: 0,
      fontFamily: "monospace",
    }}>
      {Math.round(value)}{unit}
    </span>
  </div>
);

// ─── Section wrapper ──────────────────────────────────────────────────────────

const PropSection = ({
  title, children,
}: { title: string; children: React.ReactNode }) => (
  <div style={{
    padding: "10px 14px",
    borderBottom: "1px solid var(--sep)",
  }}>
    <p style={{
      fontSize: 9,
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.09em",
      color: "var(--tx-4)",
      margin: "0 0 6px",
    }}>
      {title}
    </p>
    {children}
  </div>
);

// ─── IA suggestions card ──────────────────────────────────────────────────────

const IaSuggestionCard = ({
  label, action, onAction,
}: { label: string; action: string; onAction?: () => void }) => (
  <div style={{
    borderRadius: 8,
    border: "1px solid var(--accent-line)",
    background: "var(--accent-dim)",
    padding: "8px 10px",
    marginBottom: 6,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1C4 1 2.5 2.5 2.5 4c0 .9.4 1.7 1.1 2.2L3.8 7.5h4.4l.2-1.3C9.1 5.7 9.5 4.9 9.5 4c0-1.5-1.5-3-3.5-3z"
          stroke="var(--accent)" strokeWidth="1.1" fill="none"/>
        <path d="M4 9.5h4M4.5 7.5h3" stroke="var(--accent)" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
      <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600 }}>{label}</span>
    </div>
    <button
      type="button"
      onClick={onAction}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "5px 8px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 500,
        background: "var(--accent)",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        transition: "opacity 0.12s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
    >
      <span>{action}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface PropertiesPanelProps {
  selectedPiece: DrumPiece | null;
}

type PropTab = "properties" | "track";

export const PropertiesPanel = ({ selectedPiece }: PropertiesPanelProps) => {
  const [activeTab, setActiveTab] = useState<PropTab>("properties");

  const {
    project, drumMixer, patchDrumMixer,
    humanize, setHumanize,
    dicOutput,
  } = useProjectStore();

  // Map selected piece → mixer channel
  const channel: keyof DrumKitMixer | null = selectedPiece
    ? PIECE_TO_MIXER_CHANNEL[selectedPiece] ?? null
    : null;

  const displayPiece = selectedPiece ?? ("hihatClosed" as DrumPiece);
  const pieceName    = PIECE_LABELS[displayPiece] ?? displayPiece;

  // Volume: from drumMixer channel (0–100), default 80
  const channelVolume = channel ? Math.round((drumMixer[channel] ?? 0.8) * 100) : 80;
  const setChannelVolume = (v: number) => {
    if (!channel) return;
    patchDrumMixer({ [channel]: v / 100 } as Partial<DrumKitMixer>);
  };

  const hasProject = !!project;

  // IA suggestions from DIC output
  const hasSuggestions = !!dicOutput;
  const grooveStyle = dicOutput?.groove.style ?? null;
  const difficultyLevel = dicOutput?.difficulty.level ?? null;

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      borderLeft: "1px solid var(--sep)",
      background: "var(--bg-1)",
      overflow: "hidden",
    }}>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--sep)",
        flexShrink: 0,
        height: 36,
        background: "var(--bg-1)",
      }}>
        {(["properties", "track"] as PropTab[]).map((tab) => {
          const label = tab === "properties" ? "Propriétés" : "Piste";
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--tx-1)" : "var(--tx-3)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                transition: "color 0.12s, border-color 0.12s",
                marginBottom: "-1px",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* ── Propriétés tab ── */}
        {activeTab === "properties" && (
          <>
            {/* Instrument */}
            <PropSection title="Instrument">
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "4px 0",
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--bg-2)",
                  border: "1px solid var(--sep)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <InstrumentIcon piece={selectedPiece} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)", margin: 0 }}>
                    {pieceName}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--tx-3)", margin: "2px 0 0" }}>
                    {selectedPiece ? "Sélectionné" : "Aucune sélection"}
                  </p>
                </div>
              </div>
            </PropSection>

            {/* Réglages */}
            <PropSection title="Réglages">
              <SliderRow
                label="Volume"
                value={channelVolume}
                min={0} max={100}
                onChange={setChannelVolume}
                disabled={!hasProject}
              />
              <SliderRow
                label="Panoramique"
                value={0}
                min={-100} max={100}
                unit=""
                disabled
              />
              <SliderRow
                label="Hauteur"
                value={0}
                min={-12} max={12}
                unit=""
                disabled
              />
            </PropSection>

            {/* Dynamics */}
            <PropSection title="Dynamics">
              <SliderRow
                label="Accentuation"
                value={humanize.velocityAmount}
                min={0} max={100}
                onChange={(v) => setHumanize({ velocityAmount: v })}
                disabled={!hasProject}
              />
              <SliderRow
                label="Ghost Notes"
                value={Math.round(humanize.amount * 0.3)}
                min={0} max={100}
                onChange={(v) => setHumanize({ amount: Math.round(v / 0.3) })}
                disabled={!hasProject}
              />
            </PropSection>

            {/* Humanize */}
            <PropSection title="Humanize">
              <SliderRow
                label="Timing"
                value={humanize.timingAmount}
                min={0} max={100}
                onChange={(v) => setHumanize({ timingAmount: v })}
                disabled={!hasProject}
              />
              <SliderRow
                label="Vélocité"
                value={humanize.velocityAmount}
                min={0} max={100}
                onChange={(v) => setHumanize({ velocityAmount: v })}
                disabled={!hasProject}
              />
            </PropSection>

            {/* Apply button */}
            {hasProject && (
              <div style={{ padding: "10px 14px" }}>
                <button
                  type="button"
                  disabled={!humanize.enabled}
                  onClick={() => setHumanize({ enabled: !humanize.enabled })}
                  style={{
                    width: "100%",
                    padding: "9px 0",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    background: humanize.enabled ? "var(--accent)" : "var(--bg-3)",
                    color: humanize.enabled ? "#fff" : "var(--tx-3)",
                    border: `1px solid ${humanize.enabled ? "transparent" : "var(--sep)"}`,
                    cursor: "pointer",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {humanize.enabled ? "Humanize actif ✓" : "Appliquer à la piste"}
                </button>
              </div>
            )}

            {/* IA Suggestions */}
            <PropSection title="IA Suggestions">
              {hasSuggestions && grooveStyle ? (
                <>
                  <IaSuggestionCard
                    label="Variations possibles détectées"
                    action="Remplacer ce fill par une variation"
                  />
                  {difficultyLevel && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 0",
                      fontSize: 11,
                    }}>
                      <span style={{ color: "var(--tx-3)" }}>Style</span>
                      <span style={{
                        padding: "2px 7px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        background: "var(--bg-3)",
                        color: "var(--tx-2)",
                        textTransform: "capitalize" as const,
                      }}>
                        {grooveStyle}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p style={{
                  fontSize: 11, color: "var(--tx-4)", margin: 0,
                  lineHeight: 1.6, textAlign: "center", padding: "8px 0",
                }}>
                  {hasProject
                    ? "Lancez l'analyse IA pour obtenir des suggestions."
                    : "Importez un projet pour activer l'IA."}
                </p>
              )}
            </PropSection>
          </>
        )}

        {/* ── Piste tab ── */}
        {activeTab === "track" && (
          <div style={{ padding: "14px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.09em", color: "var(--tx-4)", margin: "0 0 10px" }}>
              Informations piste
            </p>
            {project ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Notes totales", value: project.hits.length.toString() },
                  { label: "BPM",           value: project.tempoBpm.toFixed(0)    },
                  { label: "Signature",     value: `${project.timeSignature.numerator}/${project.timeSignature.denominator}` },
                  { label: "Durée",         value: `${Math.ceil(project.hits.length / (project.tempoBpm / 60))}s` },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: "var(--bg-2)",
                    border: "1px solid var(--sep)",
                  }}>
                    <span style={{ fontSize: 11, color: "var(--tx-3)" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tx-1)", fontFamily: "monospace" }}>{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "var(--tx-4)", textAlign: "center", padding: "20px 0" }}>
                Aucun projet chargé.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
