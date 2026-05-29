import { useProjectStore } from "../../store/projectStore";
import type { DrumKitMixer } from "../../audio/drumKitManager";

// ─── Channel config ───────────────────────────────────────────────────────────

interface ChannelDef {
  key: keyof DrumKitMixer;
  label: string;
  shortLabel: string;
  color: string;
  icon: string;
}

const CHANNELS: ChannelDef[] = [
  { key: "kickVolume",   label: "Kick",    shortLabel: "K",  color: "#3b82f6", icon: "●" },
  { key: "snareVolume",  label: "Snare",   shortLabel: "S",  color: "#ef4444", icon: "◆" },
  { key: "hihatVolume",  label: "Hi-Hat",  shortLabel: "HH", color: "#22c55e", icon: "✦" },
  { key: "cymbalVolume", label: "Cymbals", shortLabel: "CY", color: "#f59e0b", icon: "◎" },
  { key: "tomVolume",    label: "Toms",    shortLabel: "T",  color: "#8b5cf6", icon: "▼" },
  { key: "roomAmount",   label: "Room",    shortLabel: "R",  color: "#64748b", icon: "≋" },
];

// ─── Single channel strip ─────────────────────────────────────────────────────

const ChannelStrip = ({
  def,
  volume,
  muted,
  soloed,
  anySoloed,
  onVolume,
  onMute,
  onSolo,
}: {
  def: ChannelDef;
  volume: number;
  muted: boolean;
  soloed: boolean;
  anySoloed: boolean;
  onVolume: (v: number) => void;
  onMute: () => void;
  onSolo: () => void;
}) => {
  const dimmed = anySoloed && !soloed;
  const pct = Math.round(volume * 100);

  return (
    <div
      className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg border transition-all ${
        soloed
          ? "border-amber-500/40 bg-amber-500/5"
          : muted
          ? "border-zinc-800/60 bg-zinc-950/40 opacity-50"
          : dimmed
          ? "border-zinc-800/40 bg-zinc-950/30 opacity-40"
          : "border-zinc-800/60 bg-zinc-900/40"
      }`}
    >
      {/* Icon + label */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-sm" style={{ color: def.color }}>{def.icon}</span>
        <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">
          {def.shortLabel}
        </span>
      </div>

      {/* Vertical slider */}
      <div className="relative flex h-24 items-center justify-center">
        <div className="absolute h-full w-1 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="absolute bottom-0 w-full rounded-full transition-all duration-75"
            style={{ height: `${pct}%`, backgroundColor: muted ? "#52525b" : def.color, opacity: 0.7 }}
          />
        </div>
        <input
          type="range"
          min={0} max={100} step={1}
          value={pct}
          onChange={(e) => onVolume(parseInt(e.target.value, 10) / 100)}
          disabled={muted}
          className="h-24 w-1.5 cursor-pointer appearance-none bg-transparent"
          style={{
            writingMode: "vertical-lr",
            direction: "rtl",
            WebkitAppearance: "slider-vertical",
          }}
          title={`${def.label}: ${pct}%`}
        />
      </div>

      {/* Volume % */}
      <span className="font-mono text-[9px] tabular-nums text-zinc-500">
        {pct}%
      </span>

      {/* Mute button */}
      <button
        type="button"
        onClick={onMute}
        title={muted ? "Unmute" : "Mute"}
        className={`flex h-5 w-8 items-center justify-center rounded text-[8px] font-bold uppercase transition ${
          muted
            ? "bg-red-600/40 text-red-300 border border-red-600/40"
            : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700"
        }`}
      >
        M
      </button>

      {/* Solo button */}
      <button
        type="button"
        onClick={onSolo}
        title={soloed ? "Unsolo" : "Solo"}
        className={`flex h-5 w-8 items-center justify-center rounded text-[8px] font-bold uppercase transition ${
          soloed
            ? "bg-amber-500/40 text-amber-300 border border-amber-500/40"
            : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700"
        }`}
      >
        S
      </button>
    </div>
  );
};

// ─── Main mixer component ─────────────────────────────────────────────────────

export const DrumMixer = ({ onClose }: { onClose?: () => void }) => {
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

  const anySoloed = Object.values(drumMixerSolo).some(Boolean);

  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/95 shadow-2xl shadow-black/60 backdrop-blur-sm">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: activeDrumKit.color }}
          />
          <p className="text-[11px] font-semibold text-zinc-300">
            Mixer — {activeDrumKit.name}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={resetDrumMixer}
            title="Reset to kit defaults"
            className="rounded px-1.5 py-0.5 text-[9px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition uppercase tracking-wide"
          >
            Reset
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-4 w-4 items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Channel strips */}
      <div className="flex gap-0.5 p-2">
        {CHANNELS.map((ch) => (
          <ChannelStrip
            key={ch.key}
            def={ch}
            volume={drumMixer[ch.key]}
            muted={!!drumMixerMute[ch.key]}
            soloed={!!drumMixerSolo[ch.key]}
            anySoloed={anySoloed}
            onVolume={(v) => patchDrumMixer({ [ch.key]: v })}
            onMute={() => setMixerChannelMute(ch.key, !drumMixerMute[ch.key])}
            onSolo={() => setMixerChannelSolo(ch.key, !drumMixerSolo[ch.key])}
          />
        ))}
      </div>

      {/* Footer: kit description */}
      <div className="border-t border-zinc-800 px-3 py-1.5">
        <p className="text-[9px] text-zinc-600 text-center italic">
          {activeDrumKit.description}
        </p>
      </div>
    </div>
  );
};
