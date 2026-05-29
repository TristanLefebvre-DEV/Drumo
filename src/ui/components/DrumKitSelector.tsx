import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { useProjectStore } from "../../store/projectStore";
import { ALL_DRUM_KITS, DRUM_KIT_PRESETS } from "../../audio/drumKitManager";
import { previewKitPiece } from "../../audio/drumKitSampler";
import { recommendKits } from "../../audio/drumKitRecommendationEngine";
import { hitsToGrooveFrame } from "../../ai/grooveClassifier";
import { classifyGroove } from "../../ai/grooveClassifier";
import type { DrumKitId } from "../../audio/drumKitManager";

// ─── Kit card in the dropdown ─────────────────────────────────────────────────

const KitCard = ({
  kit,
  isActive,
  isFavorite,
  onSelect,
  onFavorite,
  onPreview,
}: {
  kit: (typeof ALL_DRUM_KITS)[number];
  isActive: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  onPreview: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all ${
      isActive
        ? "bg-zinc-700/70 border border-zinc-600/60"
        : "hover:bg-zinc-800/80 border border-transparent"
    }`}
  >
    {/* Color dot */}
    <span
      className="shrink-0 h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: kit.color }}
    />

    {/* Name + description */}
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className={`text-[12px] font-semibold ${isActive ? "text-zinc-100" : "text-zinc-300"}`}>
          {kit.name}
        </span>
        <span className="text-[10px]">{kit.emoji}</span>
      </div>
      <p className="mt-0.5 truncate text-[10px] text-zinc-500 leading-tight">
        {kit.description}
      </p>
    </div>

    {/* Action buttons (appear on hover) */}
    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        title="Preview kick"
        onClick={(e) => { e.stopPropagation(); onPreview(); }}
        className="flex h-5 w-5 items-center justify-center rounded bg-zinc-700 text-[9px] text-zinc-300 hover:bg-zinc-600 hover:text-white transition"
      >
        ▶
      </button>
      <button
        type="button"
        title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        onClick={(e) => { e.stopPropagation(); onFavorite(); }}
        className={`flex h-5 w-5 items-center justify-center rounded text-[10px] transition ${
          isFavorite ? "text-amber-400" : "text-zinc-600 hover:text-amber-400"
        }`}
      >
        {isFavorite ? "★" : "☆"}
      </button>
    </div>

    {/* Active checkmark */}
    {isActive && (
      <span className="shrink-0 text-[10px] font-bold" style={{ color: kit.color }}>✓</span>
    )}
  </button>
);

// ─── AI Recommendation badge ──────────────────────────────────────────────────

const AiBadge = ({ kitId, recommendation }: {
  kitId: DrumKitId;
  recommendation: ReturnType<typeof recommendKits> | null;
}) => {
  if (!recommendation) return null;
  const rec = recommendation.recommendations.find((r) => r.kitId === kitId);
  if (!rec) return null;
  return (
    <span
      title={rec.reason}
      className={`ml-auto shrink-0 rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
        rec.isPrimary
          ? "bg-violet-600/30 text-violet-300"
          : "bg-zinc-700/50 text-zinc-500"
      }`}
    >
      {rec.isPrimary ? "✨ AI" : "AI"}
    </span>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const DrumKitSelector = () => {
  const [open, setOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [localRec, setLocalRec] = useState<ReturnType<typeof recommendKits> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const {
    activeDrumKitId,
    activeDrumKit,
    setDrumKit,
    kitFavorites,
    toggleKitFavorite,
    project,
    kitRecommendation,
    setKitRecommendation,
  } = useProjectStore();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Run AI groove analysis when dropdown opens and project is loaded
  useEffect(() => {
    if (!open || !project) return;
    const rec = kitRecommendation ?? (() => {
      const frame = hitsToGrooveFrame(project.hits, project.ppq, project.tempoBpm);
      const pred = classifyGroove(frame);
      const result = recommendKits(pred, project.tempoBpm);
      setKitRecommendation(result);
      return result;
    })();
    setLocalRec(rec);
  }, [open, project]);

  const handleSelect = async (id: DrumKitId) => {
    if (id === activeDrumKitId) { setOpen(false); return; }
    await Tone.start();
    setAnimating(true);
    setDrumKit(id);
    setTimeout(() => setAnimating(false), 600);
    setOpen(false);
  };

  const handlePreview = async (kitId: DrumKitId) => {
    await Tone.start();
    const kit = DRUM_KIT_PRESETS[kitId];
    previewKitPiece("kick", kit, 0.8);
    setTimeout(() => previewKitPiece("snare", kit, 0.75), 350);
    setTimeout(() => previewKitPiece("hihatClosed", kit, 0.65), 700);
  };

  // Sort kits: favorites first, then alphabetical
  const sortedKits = [...ALL_DRUM_KITS].sort((a, b) => {
    const aFav = kitFavorites.includes(a.id);
    const bFav = kitFavorites.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div ref={containerRef} className="relative select-none">

      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all ${
          open
            ? "border-zinc-500 bg-zinc-700 text-zinc-100 shadow-md"
            : "border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/80"
        } ${animating ? "scale-95" : "scale-100"}`}
        style={{ transition: "transform 0.15s ease, background 0.15s" }}
      >
        {/* Color dot with pulse on change */}
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${animating ? "animate-ping" : ""}`}
          style={{ backgroundColor: activeDrumKit.color }}
        />
        <span>{activeDrumKit.name}</span>
        <span className="text-[10px] text-zinc-500">{activeDrumKit.emoji}</span>
        <svg
          className={`h-3 w-3 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/60">

          {/* Header */}
          <div className="border-b border-zinc-800 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Drum Kit Style
            </p>
            {localRec && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[9px] text-violet-400 font-medium">AI détecté :</span>
                <span className="text-[9px] text-zinc-300">{localRec.grooveLabel}</span>
                <span className="text-[9px] text-zinc-600">
                  ({Math.round(localRec.confidence * 100)}%)
                </span>
              </div>
            )}
          </div>

          {/* Kit list */}
          <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {sortedKits.map((kit) => (
              <div key={kit.id} className="relative">
                <KitCard
                  kit={kit}
                  isActive={kit.id === activeDrumKitId}
                  isFavorite={kitFavorites.includes(kit.id)}
                  onSelect={() => void handleSelect(kit.id as DrumKitId)}
                  onFavorite={() => toggleKitFavorite(kit.id)}
                  onPreview={() => void handlePreview(kit.id as DrumKitId)}
                />
                {localRec && (
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
                    <AiBadge kitId={kit.id as DrumKitId} recommendation={localRec} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-800 px-3 py-2">
            <p className="text-[9px] text-zinc-600 text-center">
              Le pattern MIDI reste intact · Sons offline Tone.js
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
