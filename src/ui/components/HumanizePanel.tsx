/**
 * Humanize Panel
 *
 * Side panel for controlling the Humanize Engine.
 *
 * Controls:
 *   • Main slider: Robot (0%) ←→ Human (100%)
 *   • 5 groove profiles (Tight Studio, Loose Jazz, Aggressive Metal, Funk Pocket, Vintage Human)
 *   • Sub-sliders: Timing, Velocity, Swing
 *   • Pocket Visualization: per-instrument timing offset indicator (behind/ahead)
 */

import { useProjectStore } from "../../store/projectStore";
import { HUMANIZE_PROFILE_META, getPocketDisplayMs, type HumanizeProfileId, type HumanizeSettings } from "../../playback/humanizeEngine";
import { DISPLAY_PIECES } from "../../playback/groovePocketEngine";
import { DRUM_PIECE_LABELS } from "../../audio/transportController";

// ─── Sub-components ────────────────────────────────────────────────────────────

const Slider = ({
  label, value, onChange, min = 0, max = 100, leftLabel, rightLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  leftLabel?: string;
  rightLabel?: string;
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-300">{value}%</span>
    </div>
    {(leftLabel || rightLabel) && (
      <div className="flex justify-between text-[9px] text-zinc-600">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    )}
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-orange-500"
    />
  </div>
);

// ─── Pocket visualization ──────────────────────────────────────────────────────

const PocketBar = ({ ms, maxMs }: { ms: number; maxMs: number }) => {
  const pct   = Math.min(Math.abs(ms) / maxMs, 1);
  const isLate = ms > 0;   // positive = late = behind the beat
  const color  = isLate ? "#60a5fa" : "#f97316";  // blue = behind, orange = ahead

  return (
    <div className="relative h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
      {/* Centre line */}
      <div className="absolute left-1/2 top-0 h-full w-px bg-zinc-600" />
      {/* Offset bar */}
      <div
        className="absolute top-0.5 h-1 rounded-full transition-all duration-200"
        style={{
          width:      `${pct * 50}%`,
          left:       isLate  ? "50%" : `${50 - pct * 50}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
};

const PocketVisualizer = ({ settings }: { settings: HumanizeSettings }) => {
  const MAX_DISPLAY_MS = 16;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[9px] text-zinc-600">
        <span>← Avant</span>
        <span className="text-zinc-700">Pocket</span>
        <span>Après →</span>
      </div>
      {DISPLAY_PIECES.map((piece) => {
        const ms = getPocketDisplayMs(settings, piece);
        return (
          <div key={piece} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-right text-[9px] font-mono text-zinc-500">
              {DRUM_PIECE_LABELS[piece]}
            </span>
            <PocketBar ms={ms} maxMs={MAX_DISPLAY_MS} />
            <span className="w-10 shrink-0 text-right text-[9px] font-mono text-zinc-600">
              {ms >= 0 ? "+" : ""}{ms.toFixed(1)}ms
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Profile selector ────────────────────────────────────────────────────────

const PROFILES = Object.values(HUMANIZE_PROFILE_META);

const ProfileSelector = ({
  active, onChange,
}: {
  active: HumanizeProfileId;
  onChange: (id: HumanizeProfileId) => void;
}) => (
  <div className="space-y-1">
    {PROFILES.map((p) => (
      <button
        key={p.id}
        type="button"
        onClick={() => onChange(p.id)}
        className={`w-full rounded-lg border px-2.5 py-1.5 text-left transition ${
          active === p.id
            ? "border-orange-500/50 bg-orange-600/15 text-orange-300"
            : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
        }`}
      >
        <p className="text-[11px] font-semibold">{p.name}</p>
        <p className="text-[9px] opacity-70 mt-0.5 leading-tight">{p.description}</p>
      </button>
    ))}
  </div>
);

// ─── Main panel ────────────────────────────────────────────────────────────────

interface HumanizePanelProps {
  onClose: () => void;
}

export const HumanizePanel = ({ onClose }: HumanizePanelProps) => {
  const { humanize, setHumanize, project, isPlaying } = useProjectStore();

  return (
    <div className="flex h-full w-72 flex-col gap-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 text-sm shadow-[0_8px_32px_rgba(0,0,0,0.5)]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-100">Humanize Engine</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold border ${
            humanize.enabled
              ? "bg-orange-600/20 text-orange-400 border-orange-500/30"
              : "bg-zinc-800 text-zinc-500 border-zinc-700"
          }`}>
            {humanize.enabled ? "ON" : "OFF"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setHumanize({ enabled: !humanize.enabled })}
            className={`rounded px-2 py-1 text-[10px] font-medium transition border ${
              humanize.enabled
                ? "border-orange-500/50 bg-orange-600/20 text-orange-300"
                : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {humanize.enabled ? "Désactiver" : "Activer"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-zinc-500 hover:text-zinc-200 text-xs transition"
          >
            ×
          </button>
        </div>
      </div>

      {/* Live indicator */}
      {isPlaying && humanize.enabled && (
        <div className="flex items-center gap-1.5 rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-[10px] text-orange-400">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
          En cours · Changements appliqués en temps réel
        </div>
      )}

      {!project && (
        <p className="text-center text-xs text-zinc-600 py-4">
          Charge un fichier MIDI pour activer l'humanisation.
        </p>
      )}

      {project && (
        <>
          {/* ── Main Robot ←→ Human slider ── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Humanisation
              </span>
              <span className="font-mono text-lg font-bold text-orange-400">
                {humanize.amount}%
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-zinc-600">
                <span>Robot</span>
                <span>Human</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={humanize.amount}
                onChange={(e) => setHumanize({ amount: Number(e.target.value) })}
                className="w-full accent-orange-500"
              />
              {/* Visual indicator */}
              <div className="flex h-1.5 gap-0.5">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full transition-all duration-100"
                    style={{
                      backgroundColor:
                        i < Math.round(humanize.amount / 5)
                          ? `hsl(${20 + i * 1.5}, 85%, 55%)`
                          : "#27272a",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Profile selector ── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Profil de Groove
            </p>
            <ProfileSelector
              active={humanize.profileId}
              onChange={(id) => setHumanize({ profileId: id })}
            />
          </div>

          {/* ── Sub-sliders ── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Détail
            </p>
            <Slider
              label="Timing"
              value={humanize.timingAmount}
              onChange={(v) => setHumanize({ timingAmount: v })}
              leftLabel="Précis"
              rightLabel="Relâché"
            />
            <Slider
              label="Vélocité"
              value={humanize.velocityAmount}
              onChange={(v) => setHumanize({ velocityAmount: v })}
              leftLabel="Uniforme"
              rightLabel="Dynamique"
            />
            <Slider
              label="Swing"
              value={humanize.swingAmount}
              onChange={(v) => setHumanize({ swingAmount: v })}
              leftLabel="Droit"
              rightLabel="Swing"
            />
          </div>

          {/* ── Pocket Visualization ── */}
          {humanize.amount > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Pocket — Timing par instrument
              </p>
              <PocketVisualizer settings={humanize} />
              <p className="text-[9px] text-zinc-700">
                Bleu = derrière le temps · Orange = en avance
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
