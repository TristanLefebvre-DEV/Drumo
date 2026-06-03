/**
 * Panneau d'humanisation — v2
 *
 * Contrôles indépendants pour chaque dimension du jeu humain :
 *
 *   Timing       — décalages temporels (ms avant/après le temps)
 *   Vélocité     — variation d'intensité entre les frappes
 *   Accents      — renforcement des temps forts
 *   Groove       — placement dans le "pocket" du groove
 *   Swing        — triolet / sensation shuffle
 *   Micro-déplac.— micro-variations aléatoires imperceptibles mais naturelles
 *   Ghost Lift   — remontée du volume des ghost notes
 *
 * Chaque curseur est indépendant.  Un seul profil de groove peut être
 * appliqué en base, puis chaque paramètre est affinable.
 */

import { useProjectStore } from "../../store/projectStore";
import {
  HUMANIZE_PROFILE_META,
  getPocketDisplayMs,
  type HumanizeProfileId,
  type HumanizeSettings,
} from "../../playback/humanizeEngine";
import { DISPLAY_PIECES } from "../../playback/groovePocketEngine";
import { DRUM_PIECE_LABELS } from "../../audio/transportController";

// ─── Primitives ───────────────────────────────────────────────────────────────

interface SliderProps {
  label:      string;
  value:      number;
  onChange:   (v: number) => void;
  min?:       number;
  max?:       number;
  step?:      number;
  unit?:      string;
  leftLabel?: string;
  rightLabel?:string;
  color?:     string;
  disabled?:  boolean;
}

const Slider = ({
  label, value, onChange,
  min = 0, max = 100, step = 1, unit = "%",
  leftLabel, rightLabel, color = "var(--accent)", disabled = false,
}: SliderProps) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 11, color: disabled ? "var(--tx-4)" : "var(--tx-2)" }}>{label}</span>
      <span style={{
        fontSize: 11, fontFamily: "monospace", fontWeight: 600,
        color: disabled ? "var(--tx-4)" : color,
        minWidth: 36, textAlign: "right",
      }}>
        {value}{unit}
      </span>
    </div>
    {(leftLabel || rightLabel) && (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--tx-4)" }}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    )}
    <input
      type="range"
      min={min} max={max} step={step} value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: "100%", accentColor: disabled ? "var(--tx-4)" : color, cursor: disabled ? "not-allowed" : "pointer" }}
    />
  </div>
);

// Barre de niveau colorée (0–100)
const LevelBar = ({ value, color = "var(--accent)" }: { value: number; color?: string }) => (
  <div style={{
    display: "flex", height: 3, gap: 1, overflow: "hidden", borderRadius: 2, marginTop: 2,
  }}>
    {Array.from({ length: 20 }, (_, i) => (
      <div
        key={i}
        style={{
          flex: 1, borderRadius: 1,
          background: i < Math.round(value / 5) ? color : "var(--bg-4)",
          opacity: i < Math.round(value / 5) ? (0.5 + i / 30) : 0.3,
          transition: "background 0.08s",
        }}
      />
    ))}
  </div>
);

// Section pliable
const Section = ({
  title, children, accent = false,
}: {
  title: string; children: React.ReactNode; accent?: boolean;
}) => (
  <div style={{
    borderRadius: 10,
    padding: "10px 12px",
    background: accent ? "var(--accent-dim)" : "var(--bg-2)",
    border: `1px solid ${accent ? "var(--accent-line)" : "var(--sep)"}`,
    display: "flex", flexDirection: "column", gap: 10,
  }}>
    <p style={{
      fontSize: 9, fontWeight: 700,
      textTransform: "uppercase" as const, letterSpacing: "0.09em",
      color: accent ? "var(--accent)" : "var(--tx-4)",
      margin: 0,
    }}>
      {title}
    </p>
    {children}
  </div>
);

// ─── Pocket visualizer ────────────────────────────────────────────────────────

const PocketBar = ({ ms, maxMs }: { ms: number; maxMs: number }) => {
  const pct    = Math.min(Math.abs(ms) / maxMs, 1);
  const isLate = ms > 0;
  const color  = isLate ? "var(--accent)" : "var(--c-orange)";
  return (
    <div style={{
      position: "relative", height: 5, width: "100%",
      background: "var(--bg-4)", borderRadius: 999, overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 1, bottom: 1, borderRadius: 999,
        background: "var(--sep-2)", left: "calc(50% - 0.5px)", width: 1,
      }} />
      <div style={{
        position: "absolute", top: 1, bottom: 1, borderRadius: 999,
        width: `${pct * 50}%`,
        left:   isLate ? "50%" : `${50 - pct * 50}%`,
        background: color,
        transition: "width 0.18s, left 0.18s",
      }} />
    </div>
  );
};

const PocketVisualizer = ({ settings }: { settings: HumanizeSettings }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "var(--tx-4)" }}>
      <span>← En avance</span>
      <span style={{ color: "var(--tx-3)" }}>Pocket</span>
      <span>En retard →</span>
    </div>
    {DISPLAY_PIECES.map((piece) => {
      const ms = getPocketDisplayMs(settings, piece);
      return (
        <div key={piece} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 28, textAlign: "right", fontSize: 9, fontFamily: "monospace",
            color: "var(--tx-3)", flexShrink: 0,
          }}>
            {DRUM_PIECE_LABELS[piece]}
          </span>
          <div style={{ flex: 1 }}>
            <PocketBar ms={ms} maxMs={16} />
          </div>
          <span style={{
            width: 38, textAlign: "right", fontSize: 9, fontFamily: "monospace",
            color: Math.abs(ms) > 8 ? "var(--c-orange)" : "var(--tx-4)", flexShrink: 0,
          }}>
            {ms >= 0 ? "+" : ""}{ms.toFixed(1)}ms
          </span>
        </div>
      );
    })}
  </div>
);

// ─── Sélecteur de profil ──────────────────────────────────────────────────────

const PROFILES = Object.values(HUMANIZE_PROFILE_META);

const ProfileSelector = ({
  active, onChange, disabled,
}: {
  active: HumanizeProfileId; onChange: (id: HumanizeProfileId) => void; disabled: boolean;
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {PROFILES.map((p) => {
      const isActive = active === p.id;
      return (
        <button
          key={p.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(p.id)}
          style={{
            width: "100%", padding: "8px 10px", borderRadius: 8,
            textAlign: "left", cursor: disabled ? "not-allowed" : "pointer",
            background: isActive ? "var(--accent-dim)" : "var(--bg-3)",
            border: `1px solid ${isActive ? "var(--accent-line)" : "var(--sep)"}`,
            opacity: disabled ? 0.5 : 1,
            transition: "all 0.12s",
          }}
        >
          <p style={{
            fontSize: 11, fontWeight: 600, margin: 0,
            color: isActive ? "var(--accent)" : "var(--tx-2)",
          }}>
            {p.name}
          </p>
          <p style={{
            fontSize: 9, margin: "2px 0 0", lineHeight: 1.4,
            color: "var(--tx-3)",
          }}>
            {p.description}
          </p>
        </button>
      );
    })}
  </div>
);

// ─── Panneau principal ────────────────────────────────────────────────────────

interface HumanizePanelProps { onClose: () => void; }

export const HumanizePanel = ({ onClose }: HumanizePanelProps) => {
  const { humanize, setHumanize, project, isPlaying } = useProjectStore();

  const enabled = humanize.enabled;
  const amount  = humanize.amount;

  // Calcule la couleur dynamique en fonction du taux d'humanisation
  const amountColor = amount < 25 ? "var(--c-green)" : amount < 60 ? "var(--accent)" : amount < 85 ? "var(--c-orange)" : "var(--c-red)";
  const amountLabel = amount < 10 ? "Machine" : amount < 30 ? "Très précis" : amount < 55 ? "Studio" : amount < 75 ? "Naturel" : amount < 90 ? "Live" : "Hors tempo";

  return (
    <div style={{
      width: 284,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      overflowY: "auto",
      borderRadius: 14,
      border: "1px solid var(--sep-2)",
      background: "var(--bg-2)",
      padding: 12,
      boxShadow: "var(--shadow-md)",
      maxHeight: "100%",
    }}>

      {/* ── En-tête ── */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-1)" }}>
            Humanisation
          </span>
          <span style={{
            padding: "1px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700,
            background: enabled ? "rgba(255,159,10,0.15)" : "var(--bg-3)",
            color:      enabled ? "var(--c-orange)"       : "var(--tx-4)",
            border:     `1px solid ${enabled ? "rgba(255,159,10,0.30)" : "var(--sep)"}`,
          }}>
            {enabled ? "ACTIF" : "INACTIF"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button
            type="button"
            onClick={() => setHumanize({ enabled: !enabled })}
            style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: "pointer",
              background: enabled ? "rgba(255,159,10,0.15)" : "var(--bg-3)",
              color:      enabled ? "var(--c-orange)"       : "var(--tx-3)",
              border:     `1px solid ${enabled ? "rgba(255,159,10,0.30)" : "var(--sep)"}`,
              transition: "all 0.15s",
            }}
          >
            {enabled ? "Désactiver" : "Activer"}
          </button>
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
        </div>
      </div>

      {/* ── Indicateur de lecture ── */}
      {isPlaying && enabled && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "5px 10px", borderRadius: 7,
          background: "rgba(255,159,10,0.08)",
          border: "1px solid rgba(255,159,10,0.18)",
          fontSize: 10, color: "var(--c-orange)",
        }}>
          <span className="play-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-orange)" }} />
          En lecture · Changements en temps réel
        </div>
      )}

      {!project && (
        <p style={{ fontSize: 11, color: "var(--tx-3)", textAlign: "center", padding: "16px 0", margin: 0 }}>
          Charge un fichier MIDI pour activer l'humanisation.
        </p>
      )}

      {project && (<>

        {/* ── Taux global ── */}
        <Section title="Taux global" accent={enabled && amount > 0}>
          <div style={{ textAlign: "center", padding: "2px 0 4px" }}>
            <span style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 800, color: amountColor }}>
              {amount}
            </span>
            <span style={{ fontSize: 12, color: "var(--tx-4)", marginLeft: 4 }}>%</span>
            <p style={{ fontSize: 10, color: "var(--tx-3)", margin: "3px 0 0" }}>{amountLabel}</p>
          </div>
          <Slider
            label="" value={amount}
            onChange={(v) => setHumanize({ amount: v })}
            min={0} max={100}
            leftLabel="Machine" rightLabel="Hors tempo"
            color={amountColor}
            disabled={!enabled}
          />
          <LevelBar value={amount} color={amountColor} />
        </Section>

        {/* ── Profil de groove ── */}
        <Section title="Profil de groove">
          <ProfileSelector
            active={humanize.profileId}
            onChange={(id) => setHumanize({ profileId: id })}
            disabled={!enabled}
          />
        </Section>

        {/* ── Contrôles indépendants ── */}
        <Section title="Contrôles détaillés">

          <Slider
            label="Variation de timing"
            value={humanize.timingAmount}
            onChange={(v) => setHumanize({ timingAmount: v })}
            leftLabel="Précis" rightLabel="Flottant"
            color="var(--accent)"
            disabled={!enabled}
          />

          <Slider
            label="Variation de vélocité"
            value={humanize.velocityAmount}
            onChange={(v) => setHumanize({ velocityAmount: v })}
            leftLabel="Uniforme" rightLabel="Dynamique"
            color="var(--c-green)"
            disabled={!enabled}
          />

          <Slider
            label="Swing"
            value={humanize.swingAmount}
            onChange={(v) => setHumanize({ swingAmount: v })}
            leftLabel="Droit" rightLabel="Shuffle"
            color="var(--ia-groove)"
            disabled={!enabled}
          />

          <Slider
            label="Intensité des accents"
            value={humanize.accentAmount ?? 50}
            onChange={(v) => setHumanize({ accentAmount: v } as Partial<HumanizeSettings>)}
            leftLabel="Plat" rightLabel="Marqué"
            color="var(--c-orange)"
            disabled={!enabled}
          />

          <Slider
            label="Profondeur du groove pocket"
            value={humanize.pocketDepth ?? 50}
            onChange={(v) => setHumanize({ pocketDepth: v } as Partial<HumanizeSettings>)}
            leftLabel="Sur le temps" rightLabel="Profond"
            color="var(--c-yellow)"
            disabled={!enabled}
          />

          <Slider
            label="Micro-déplacements"
            value={humanize.microDisplacement ?? 30}
            onChange={(v) => setHumanize({ microDisplacement: v } as Partial<HumanizeSettings>)}
            leftLabel="Aucun" rightLabel="Expressif"
            color="var(--accent)"
            disabled={!enabled}
          />

          <Slider
            label="Remontée des ghost notes"
            value={humanize.ghostLift ?? 40}
            onChange={(v) => setHumanize({ ghostLift: v } as Partial<HumanizeSettings>)}
            leftLabel="Discret" rightLabel="Audible"
            color="var(--tx-2)"
            disabled={!enabled}
          />
        </Section>

        {/* ── Pocket par instrument ── */}
        {enabled && amount > 0 && (
          <Section title="Pocket — décalage par instrument">
            <PocketVisualizer settings={humanize} />
            <p style={{ fontSize: 9, color: "var(--tx-4)", margin: 0 }}>
              Orange = en avance · Bleu accent = en retard
            </p>
          </Section>
        )}

        {/* ── Réinitialiser ── */}
        <button
          type="button"
          onClick={() => setHumanize({
            amount: 0, timingAmount: 0, velocityAmount: 0, swingAmount: 0,
            accentAmount: 50, pocketDepth: 50, microDisplacement: 30, ghostLift: 40,
          } as Partial<HumanizeSettings>)}
          style={{
            width: "100%", padding: "7px 12px", borderRadius: 8,
            fontSize: 11, fontWeight: 500, cursor: "pointer",
            background: "var(--bg-1)", color: "var(--tx-3)",
            border: "1px solid var(--sep)",
            transition: "all 0.12s",
          }}
        >
          Réinitialiser tous les paramètres
        </button>
      </>)}
    </div>
  );
};
