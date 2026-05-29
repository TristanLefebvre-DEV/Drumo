import { useCallback, useEffect, useRef, useState } from "react";
import {
  metronomeEngine,
  TapTempoDetector,
  saveMetroPreset,
  loadMetroPresets,
  deleteMetroPreset,
  type MetroSound,
  type MetroSubdivision,
  type MetroSignature,
  type MetroPreset,
} from "../../audio/metronomeEngine";
import { useProjectStore } from "../../store/projectStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const SIGNATURES: { label: string; sig: MetroSignature }[] = [
  { label: "2/4", sig: { numerator: 2, denominator: 4 } },
  { label: "3/4", sig: { numerator: 3, denominator: 4 } },
  { label: "4/4", sig: { numerator: 4, denominator: 4 } },
  { label: "5/4", sig: { numerator: 5, denominator: 4 } },
  { label: "6/8", sig: { numerator: 6, denominator: 8 } },
  { label: "7/8", sig: { numerator: 7, denominator: 8 } },
];

const SUBDIVISIONS: { label: string; icon: string; value: MetroSubdivision }[] = [
  { label: "Noire",    icon: "♩",  value: "quarter"   },
  { label: "Croche",   icon: "♪♪", value: "eighth"    },
  { label: "Triolet",  icon: "3",  value: "triplet"   },
  { label: "Double",   icon: "⊱",  value: "sixteenth" },
];

const SOUNDS: { label: string; value: MetroSound; emoji: string }[] = [
  { label: "Click",     value: "click",    emoji: "🔔" },
  { label: "Woodblock", value: "woodblock",emoji: "🪵" },
  { label: "Beep",      value: "beep",     emoji: "📡" },
  { label: "Hi-Hat",    value: "hihat",    emoji: "🥁" },
  { label: "Rimshot",   value: "rimshot",  emoji: "🎯" },
];

const POLY_OPTIONS = [2, 3, 4, 5];

const tapDetector = new TapTempoDetector();

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionTitle = ({ children, expanded, onToggle }: {
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition"
  >
    <span>{children}</span>
    <span className={`text-[8px] transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
  </button>
);

const ChipBtn = ({ active, onClick, children, color = "blue" }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: "blue" | "amber" | "violet" | "emerald" | "rose";
}) => {
  const activeClass: Record<string, string> = {
    blue:    "border-blue-500/50 bg-blue-600/20 text-blue-300",
    amber:   "border-amber-500/50 bg-amber-600/20 text-amber-300",
    violet:  "border-violet-500/50 bg-violet-600/20 text-violet-300",
    emerald: "border-emerald-500/50 bg-emerald-600/20 text-emerald-300",
    rose:    "border-rose-500/50 bg-rose-600/20 text-rose-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-0.5 text-[10px] font-medium transition ${
        active
          ? (activeClass[color] ?? activeClass.blue)
          : "border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
};

// ─── Beat Visualizer ──────────────────────────────────────────────────────────

const BeatVisualizer = ({
  numerator,
  beatRefs,
}: {
  numerator: number;
  beatRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}) => (
  <div className="flex items-center justify-center gap-2 py-2">
    {Array.from({ length: numerator }, (_, i) => (
      <div
        key={i}
        ref={(el) => { beatRefs.current[i] = el; }}
        data-beat={i}
        className="beat-circle h-7 w-7 rounded-full border-2 border-zinc-700 bg-zinc-800 transition-all duration-75"
        style={{ transform: "scale(1)", opacity: 0.35 }}
      />
    ))}
  </div>
);

// ─── BPM Display ─────────────────────────────────────────────────────────────

const BpmDisplay = ({
  bpm,
  onChange,
}: {
  bpm: number;
  onChange: (bpm: number) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(bpm));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setInputVal(String(bpm));
  }, [bpm, editing]);

  const commit = () => {
    const parsed = parseInt(inputVal, 10);
    if (!isNaN(parsed)) onChange(parsed);
    setEditing(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onChange(bpm + (e.deltaY < 0 ? 1 : -1));
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={20} max={300}
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        autoFocus
        className="w-32 bg-transparent text-center font-mono text-6xl font-black tracking-tight text-white outline-none"
      />
    );
  }

  return (
    <div
      className="flex cursor-pointer select-none items-baseline justify-center gap-1.5"
      onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.select(), 10); }}
      onWheel={handleWheel}
      title="Cliquer pour éditer · Molette pour ajuster"
    >
      <span className="font-mono text-6xl font-black tracking-tight text-white tabular-nums hover:text-blue-100 transition">
        {bpm}
      </span>
      <span className="text-[11px] text-zinc-600 font-medium">BPM</span>
    </div>
  );
};

// ─── Tempo label ──────────────────────────────────────────────────────────────

function tempoLabel(bpm: number): string {
  if (bpm < 40)  return "Larghissimo";
  if (bpm < 60)  return "Largo";
  if (bpm < 66)  return "Larghetto";
  if (bpm < 76)  return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 156) return "Allegro";
  if (bpm < 176) return "Vivace";
  if (bpm < 200) return "Presto";
  return "Prestissimo";
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export const MetronomePanel = ({ onClose }: { onClose?: () => void }) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [running, setRunning]           = useState(false);
  const [bpm, setBpmState]              = useState(metronomeEngine.bpm);
  const [sig, setSig]                   = useState<MetroSignature>(metronomeEngine.signature);
  const [subdivision, setSubdivision]   = useState<MetroSubdivision>(metronomeEngine.subdivision);
  const [soundType, setSoundType]       = useState<MetroSound>(metronomeEngine.soundType);
  const [volume, setVolume]             = useState(metronomeEngine.volume);
  const [visualOnly, setVisualOnly]     = useState(false);
  const [training, setTraining]         = useState(metronomeEngine.training);
  const [poly, setPoly]                 = useState(metronomeEngine.poly);
  const [presets, setPresets]           = useState<MetroPreset[]>(() => loadMetroPresets());
  const [tapCount, setTapCount]         = useState(0);
  const [showTraining, setShowTraining] = useState(false);
  const [showPoly, setShowPoly]         = useState(false);
  const [showPresets, setShowPresets]   = useState(false);
  const [presetName, setPresetName]     = useState("");

  // ── Refs ───────────────────────────────────────────────────────────────────
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevBeatRef = useRef(-1);

  // ── Project sync ──────────────────────────────────────────────────────────
  const project = useProjectStore((s) => s.project);

  // ── Beat callback (direct DOM mutation — no React re-render) ──────────────
  const handleBeat = useCallback((beatIndex: number, isAccent: boolean, subdivIdx: number, _total: number) => {
    if (subdivIdx !== 0) return; // only update on main beats for visual
    const prev = prevBeatRef.current;

    // Reset previous
    const prevEl = beatRefs.current[prev];
    if (prevEl) {
      prevEl.style.transform = "scale(1)";
      prevEl.style.opacity = "0.35";
      prevEl.style.borderColor = "#3f3f46"; // zinc-700
      prevEl.style.backgroundColor = "#27272a"; // zinc-800
      prevEl.style.boxShadow = "none";
    }

    // Activate current
    const el = beatRefs.current[beatIndex];
    if (el) {
      el.style.transform = "scale(1.25)";
      el.style.opacity = "1";
      if (isAccent) {
        el.style.borderColor = "#93c5fd"; // blue-300
        el.style.backgroundColor = "#1d4ed8"; // blue-700
        el.style.boxShadow = "0 0 14px 4px rgba(59,130,246,0.5)";
      } else {
        el.style.borderColor = "#a1a1aa"; // zinc-400
        el.style.backgroundColor = "#52525b"; // zinc-600
        el.style.boxShadow = "0 0 8px 2px rgba(161,161,170,0.25)";
      }
      // Decay animation
      setTimeout(() => {
        if (el) {
          el.style.transform = "scale(1)";
          el.style.opacity = "0.5";
          el.style.boxShadow = "none";
        }
      }, 120);
    }

    prevBeatRef.current = beatIndex;
  }, []);

  // ── BPM change from engine (training mode) ────────────────────────────────
  const handleBpmChange = useCallback((newBpm: number) => {
    setBpmState(newBpm);
  }, []);

  // ── Setup engine callbacks ─────────────────────────────────────────────────
  useEffect(() => {
    metronomeEngine.onBeat(handleBeat);
    metronomeEngine.onBpmChange(handleBpmChange);
    metronomeEngine.onStop(() => setRunning(false));
    return () => {
      metronomeEngine.onBeat(null as unknown as Parameters<typeof metronomeEngine.onBeat>[0]);
    };
  }, [handleBeat, handleBpmChange]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === "Space") { e.preventDefault(); void togglePlay(); }
      if (e.code === "KeyT") { e.preventDefault(); handleTap(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [running, bpm]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const togglePlay = async () => {
    if (running) {
      metronomeEngine.stop();
      setRunning(false);
      // Reset all beat circles
      beatRefs.current.forEach((el) => {
        if (el) {
          el.style.transform = "scale(1)";
          el.style.opacity = "0.35";
          el.style.borderColor = "#3f3f46";
          el.style.backgroundColor = "#27272a";
          el.style.boxShadow = "none";
        }
      });
      prevBeatRef.current = -1;
    } else {
      await metronomeEngine.start();
      setRunning(true);
    }
  };

  const handleTap = () => {
    const detected = tapDetector.tap();
    setTapCount(tapDetector.tapCount);
    if (detected) {
      setBpm(detected);
    }
    // Clear tap count after 3 seconds of no tapping
    setTimeout(() => {
      if (tapDetector.tapCount === 0) setTapCount(0);
    }, 3100);
  };

  const setBpm = (val: number) => {
    const clamped = Math.max(20, Math.min(300, Math.round(val)));
    metronomeEngine.setBpm(clamped);
    setBpmState(clamped);
  };

  const setSigAndApply = (s: MetroSignature) => {
    setSig(s);
    metronomeEngine.setSignature(s);
    prevBeatRef.current = -1;
  };

  const setSubdivAndApply = (s: MetroSubdivision) => {
    setSubdivision(s);
    metronomeEngine.setSubdivision(s);
  };

  const setSoundAndApply = (s: MetroSound) => {
    setSoundType(s);
    metronomeEngine.setSoundType(s);
  };

  const setVolumeAndApply = (v: number) => {
    setVolume(v);
    metronomeEngine.setVolume(v);
  };

  const setVisualOnlyAndApply = (v: boolean) => {
    setVisualOnly(v);
    metronomeEngine.setVisualOnly(v);
  };

  const setTrainingField = (patch: Partial<typeof training>) => {
    const next = { ...training, ...patch };
    setTraining(next);
    metronomeEngine.setTraining(next);
  };

  const setPolyField = (patch: Partial<typeof poly>) => {
    const next = { ...poly, ...patch };
    setPoly(next);
    metronomeEngine.setPoly(next);
  };

  const syncFromProject = () => {
    if (project) setBpm(Math.round(project.tempoBpm));
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    saveMetroPreset({ name: presetName.trim(), bpm, signature: sig, subdivision, soundType });
    setPresets(loadMetroPresets());
    setPresetName("");
  };

  const handleLoadPreset = (preset: MetroPreset) => {
    setBpm(preset.bpm);
    setSigAndApply(preset.signature);
    setSubdivAndApply(preset.subdivision);
    setSoundAndApply(preset.soundType);
  };

  const handleDeletePreset = (id: string) => {
    deleteMetroPreset(id);
    setPresets(loadMetroPresets());
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex w-72 flex-col rounded-xl border border-zinc-700/80 bg-zinc-900/98 shadow-2xl shadow-black/70 backdrop-blur-sm"
      style={{ minHeight: 440 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full transition ${running ? "bg-blue-400 animate-pulse" : "bg-zinc-600"}`} />
          <span className="text-[11px] font-semibold text-zinc-300">Métronome</span>
        </div>
        <div className="flex items-center gap-1.5">
          {project && (
            <button
              type="button"
              onClick={syncFromProject}
              title="Synchroniser le BPM depuis le projet"
              className="rounded px-1.5 py-0.5 text-[9px] text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition uppercase tracking-wide"
            >
              Sync {Math.round(project.tempoBpm)} BPM
            </button>
          )}
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

      {/* ── Beat visualizer ── */}
      <div className="border-b border-zinc-800/60 bg-zinc-950/30 px-3">
        <BeatVisualizer numerator={sig.numerator} beatRefs={beatRefs} />
        <div className="pb-1 text-center">
          <span className="text-[9px] text-zinc-600 italic">{tempoLabel(bpm)}</span>
        </div>
      </div>

      {/* ── BPM section ── */}
      <div className="px-3 py-3">
        <BpmDisplay bpm={bpm} onChange={setBpm} />

        {/* BPM adjust buttons */}
        <div className="mt-2 flex items-center justify-center gap-1">
          {[-10, -5, -1].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setBpm(bpm + d)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition"
            >
              {d}
            </button>
          ))}
          <div className="w-2" />
          {[+1, +5, +10].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setBpm(bpm + d)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition"
            >
              +{d}
            </button>
          ))}
        </div>

        {/* BPM slider */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[9px] text-zinc-700 tabular-nums w-6">20</span>
          <input
            type="range" min={20} max={300} step={1}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="flex-1 accent-blue-500"
          />
          <span className="text-[9px] text-zinc-700 tabular-nums w-7 text-right">300</span>
        </div>
      </div>

      {/* ── Main controls ── */}
      <div className="flex items-center gap-2 border-t border-zinc-800/60 px-3 py-2.5">
        {/* Play / Stop */}
        <button
          type="button"
          onClick={() => void togglePlay()}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-bold transition ${
            running
              ? "border-blue-500/50 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
              : "border-zinc-600 bg-zinc-700 text-zinc-100 hover:bg-zinc-600"
          }`}
        >
          {running ? "⏹ Stop" : "▶ Start"}
          <span className="text-[9px] text-zinc-500 font-normal">[Space]</span>
        </button>

        {/* Tap Tempo */}
        <button
          type="button"
          onClick={handleTap}
          className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-[11px] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 transition active:scale-95"
          title="Tap tempo [T]"
          style={{ transition: "transform 0.05s, background 0.1s" }}
        >
          ✋ Tap
          {tapCount > 0 && (
            <span className="text-[9px] text-blue-400 font-mono">{tapCount}</span>
          )}
        </button>
      </div>

      {/* ── Signature + Subdivision ── */}
      <div className="border-t border-zinc-800/60 px-3 py-2 space-y-2">
        {/* Time signature */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] text-zinc-600 w-12 shrink-0">Mesure</span>
          {SIGNATURES.map(({ label, sig: s }) => (
            <ChipBtn
              key={label}
              active={sig.numerator === s.numerator && sig.denominator === s.denominator}
              onClick={() => setSigAndApply(s)}
            >
              {label}
            </ChipBtn>
          ))}
        </div>

        {/* Subdivision */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] text-zinc-600 w-12 shrink-0">Subdiv</span>
          {SUBDIVISIONS.map(({ label, icon, value }) => (
            <ChipBtn
              key={value}
              active={subdivision === value}
              onClick={() => setSubdivAndApply(value)}
              color="violet"
            >
              <span title={label}>{icon}</span>
            </ChipBtn>
          ))}
        </div>
      </div>

      {/* ── Sound + Volume ── */}
      <div className="border-t border-zinc-800/60 px-3 py-2 space-y-2">
        {/* Sound type */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] text-zinc-600 w-12 shrink-0">Son</span>
          {SOUNDS.map(({ label, value, emoji }) => (
            <ChipBtn
              key={value}
              active={soundType === value}
              onClick={() => setSoundAndApply(value)}
              color="emerald"
            >
              <span title={label}>{emoji}</span>
            </ChipBtn>
          ))}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-600 w-12 shrink-0">Volume</span>
          <input
            type="range" min={0} max={1} step={0.02}
            value={volume}
            onChange={(e) => setVolumeAndApply(Number(e.target.value))}
            className="flex-1 accent-emerald-500"
          />
          <span className="w-7 text-right font-mono text-[9px] text-zinc-500 tabular-nums">
            {Math.round(volume * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setVisualOnlyAndApply(!visualOnly)}
            title="Mode visuel uniquement (silencieux)"
            className={`rounded px-1.5 py-0.5 text-[9px] transition border ${
              visualOnly
                ? "border-amber-500/50 bg-amber-600/20 text-amber-300"
                : "border-zinc-700 text-zinc-600 hover:text-zinc-300"
            }`}
          >
            {visualOnly ? "👁 Vis" : "🔈"}
          </button>
        </div>
      </div>

      {/* ── Training Mode ── */}
      <div className="border-t border-zinc-800/60">
        <SectionTitle expanded={showTraining} onToggle={() => setShowTraining((v) => !v)}>
          🎯 Training Mode
          {training.enabled && <span className="ml-1 text-blue-400">●</span>}
        </SectionTitle>
        {showTraining && (
          <div className="px-3 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="training-enabled"
                checked={training.enabled}
                onChange={(e) => setTrainingField({ enabled: e.target.checked })}
                className="accent-blue-500"
              />
              <label htmlFor="training-enabled" className="text-[10px] text-zinc-300 cursor-pointer">
                Accélération progressive
              </label>
            </div>
            {training.enabled && (
              <div className="space-y-2 pl-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-500 w-20 shrink-0">Cible BPM</span>
                  <input
                    type="number" min={20} max={300}
                    value={training.targetBpm}
                    onChange={(e) => setTrainingField({ targetBpm: Number(e.target.value) })}
                    className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 text-center"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-500 w-20 shrink-0">+BPM / step</span>
                  <input
                    type="number" min={1} max={20}
                    value={training.stepBpm}
                    onChange={(e) => setTrainingField({ stepBpm: Number(e.target.value) })}
                    className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 text-center"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-500 w-20 shrink-0">Toutes N mesures</span>
                  <input
                    type="number" min={1} max={32}
                    value={training.stepMeasures}
                    onChange={(e) => setTrainingField({ stepMeasures: Number(e.target.value) })}
                    className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 text-center"
                  />
                </div>
                <p className="text-[9px] text-zinc-600 italic">
                  {bpm} → {training.targetBpm} BPM, +{training.stepBpm} toutes {training.stepMeasures} mesures
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Polyrhythm ── */}
      <div className="border-t border-zinc-800/60">
        <SectionTitle expanded={showPoly} onToggle={() => setShowPoly((v) => !v)}>
          ⬡ Polyrythmie
          {poly.enabled && <span className="ml-1 text-violet-400">●</span>}
        </SectionTitle>
        {showPoly && (
          <div className="px-3 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="poly-enabled"
                checked={poly.enabled}
                onChange={(e) => setPolyField({ enabled: e.target.checked })}
                className="accent-violet-500"
              />
              <label htmlFor="poly-enabled" className="text-[10px] text-zinc-300 cursor-pointer">
                Rythme croisé actif
              </label>
            </div>
            {poly.enabled && (
              <div className="flex items-center gap-2 pl-1">
                <span className="text-[9px] text-zinc-500">Contre</span>
                <div className="flex gap-1">
                  {POLY_OPTIONS.map((n) => (
                    <ChipBtn key={n} active={poly.against === n} onClick={() => setPolyField({ against: n })} color="violet">
                      {n}
                    </ChipBtn>
                  ))}
                </div>
                <span className="text-[9px] text-zinc-600">contre {sig.numerator}</span>
              </div>
            )}
            {poly.enabled && (
              <p className="text-[9px] text-zinc-600 italic pl-1">
                {poly.against} temps (↑ aigu) sur {sig.numerator}/{sig.denominator}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Presets ── */}
      <div className="border-t border-zinc-800/60">
        <SectionTitle expanded={showPresets} onToggle={() => setShowPresets((v) => !v)}>
          💾 Presets ({presets.length})
        </SectionTitle>
        {showPresets && (
          <div className="px-3 pb-3 space-y-2">
            {/* Save */}
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Nom du preset..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); }}
                className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200 placeholder-zinc-600"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition"
              >
                Sauver
              </button>
            </div>

            {/* Preset list */}
            {presets.length === 0 ? (
              <p className="text-[9px] text-zinc-700 text-center italic">Aucun preset sauvegardé</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 group"
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(preset)}
                      className="flex-1 text-left text-[10px] text-zinc-300 hover:text-white transition"
                    >
                      <span className="font-medium">{preset.name}</span>
                      <span className="ml-1.5 text-zinc-600">
                        {preset.bpm}bpm · {preset.signature.numerator}/{preset.signature.denominator}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(preset.id)}
                      className="text-zinc-700 hover:text-rose-400 transition opacity-0 group-hover:opacity-100 text-[10px]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="mt-auto border-t border-zinc-800 px-3 py-1.5">
        <p className="text-center text-[9px] text-zinc-700">
          Espace = Start/Stop · T = Tap · Molette sur BPM
        </p>
      </div>
    </div>
  );
};
