/**
 * RhythmWorkshop — full-screen rhythm editor + circular visualizer.
 *
 * Opened from MetronomePanel. Combines:
 *   - CircularRhythmView (animated canvas wheel)
 *   - PartitionEditor (beat grid)
 *   - PatternEngine controls (BPM, play/stop, presets, save/load)
 *
 * PatternEngine is used for pattern audio. MetronomeEngine is paused while
 * RhythmWorkshop is active (they share synths).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { patternEngine, DEFAULT_PATTERNS, savePattern, loadPatterns, deletePattern } from "../../audio/patternEngine";
import { metronomeEngine } from "../../audio/metronomeEngine";
import { TapTempoDetector } from "../../audio/metronomeEngine";
import { CircularRhythmView } from "./CircularRhythmView";
import { PartitionEditor }    from "./PartitionEditor";
import type { RhythmPattern } from "../../audio/patternEngine";

// ─── View mode ────────────────────────────────────────────────────────────────

type ViewMode = "circle" | "partition" | "both";

// ─── Top bar ──────────────────────────────────────────────────────────────────

const TopBar = ({
  name, bpm, onBpmChange, isPlaying, onTogglePlay, onTap, tapCount, onClose,
}: {
  name: string;
  bpm: number;
  onBpmChange: (v: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onTap: () => void;
  tapCount: number;
  onClose: () => void;
}) => {
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  return (
    <div style={{
      height: 56,
      background: "rgba(14,15,18,0.96)",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      display: "flex", alignItems: "center",
      padding: "0 16px", gap: 12, flexShrink: 0,
    }}>
      {/* Close */}
      <button type="button" onClick={onClose}
        style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 16, cursor: "pointer", flexShrink: 0 }}>
        ←
      </button>

      {/* Pattern name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {name}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
          Partition Mode
        </div>
      </div>

      {/* BPM control */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button type="button" onClick={() => onBpmChange(bpmRef.current - 5)}
          style={{ width: 26, height: 26, borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
          −
        </button>
        <div
          onWheel={(e) => onBpmChange(bpmRef.current + (e.deltaY < 0 ? 1 : -1))}
          style={{ minWidth: 56, textAlign: "center", fontVariantNumeric: "tabular-nums" as const }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f5f5f7", letterSpacing: "-0.03em", lineHeight: 1 }}>{bpm}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>BPM</div>
        </div>
        <button type="button" onClick={() => onBpmChange(bpmRef.current + 5)}
          style={{ width: 26, height: 26, borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
          ＋
        </button>
      </div>

      {/* BPM slider */}
      <input type="range" min={20} max={300} step={1} value={bpm}
        onChange={(e) => onBpmChange(Number(e.target.value))}
        className="compact-range"
        style={{ width: 80, flexShrink: 0, accentColor: "#0071e3" }} />

      {/* Tap */}
      <button type="button" onClick={onTap}
        style={{
          height: 32, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.8)", cursor: "pointer", flexShrink: 0,
        }}>
        Tap{tapCount > 1 ? ` ${tapCount}` : ""}
      </button>

      {/* Play / Stop */}
      <button type="button" onClick={onTogglePlay}
        style={{
          height: 36, padding: "0 20px", borderRadius: 9, fontSize: 14, fontWeight: 700, flexShrink: 0,
          background: isPlaying ? "rgba(255,69,58,0.15)" : "#0071e3",
          color: isPlaying ? "#ff453a" : "#fff",
          border: `1.5px solid ${isPlaying ? "rgba(255,69,58,0.3)" : "transparent"}`,
          cursor: "pointer", transition: "all 0.12s",
          boxShadow: isPlaying ? "none" : "0 0 20px rgba(0,113,227,0.4)",
        }}>
        {isPlaying ? "⏹ Stop" : "▶ Start"}
      </button>
    </div>
  );
};

// ─── Preset row ───────────────────────────────────────────────────────────────

const PresetRow = ({
  current, onSelect, onSave, onDelete,
}: {
  current: RhythmPattern | null;
  onSelect: (p: RhythmPattern) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) => {
  const [userPatterns, setUser] = useState<RhythmPattern[]>(() => loadPatterns());
  const refreshUser = () => setUser(loadPatterns());

  return (
    <div style={{
      height: 52, background: "rgba(14,15,18,0.9)", borderTop: "1px solid rgba(255,255,255,0.07)",
      display: "flex", alignItems: "center", padding: "0 12px", gap: 8, flexShrink: 0, overflowX: "auto",
    }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", flexShrink: 0 }}>Presets</span>

      {DEFAULT_PATTERNS.map((p) => (
        <button key={p.id} type="button" onClick={() => onSelect(p)}
          style={{
            height: 30, padding: "0 11px", borderRadius: 100, fontSize: 11, fontWeight: 500,
            background: current?.id === p.id ? "rgba(0,113,227,0.2)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${current?.id === p.id ? "rgba(0,113,227,0.4)" : "rgba(255,255,255,0.1)"}`,
            color: current?.id === p.id ? "#0071e3" : "rgba(255,255,255,0.6)",
            cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" as const,
          }}>
          {p.name}
        </button>
      ))}

      {userPatterns.length > 0 && (
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
      )}

      {userPatterns.map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <button type="button" onClick={() => onSelect(p)}
            style={{
              height: 30, padding: "0 9px", borderRadius: "100px 0 0 100px", fontSize: 11,
              background: current?.id === p.id ? "rgba(52,208,88,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${current?.id === p.id ? "rgba(52,208,88,0.3)" : "rgba(255,255,255,0.1)"}`,
              borderRight: "none",
              color: current?.id === p.id ? "#34d058" : "rgba(255,255,255,0.6)",
              cursor: "pointer", whiteSpace: "nowrap" as const,
            }}>
            {p.name}
          </button>
          <button type="button" onClick={() => { onDelete(p.id); refreshUser(); }}
            style={{
              height: 30, width: 26, borderRadius: "0 100px 100px 0", fontSize: 11,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none",
              color: "rgba(255,69,58,0.7)", cursor: "pointer",
            }}>×</button>
        </div>
      ))}

      <button type="button" onClick={() => { onSave(); refreshUser(); }}
        style={{
          height: 30, padding: "0 11px", borderRadius: 100, fontSize: 11, fontWeight: 600,
          background: "rgba(0,113,227,0.1)", border: "1px solid rgba(0,113,227,0.25)",
          color: "#0071e3", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" as const,
        }}>
        + Sauvegarder
      </button>
    </div>
  );
};

// ─── RhythmWorkshop main ──────────────────────────────────────────────────────

interface RhythmWorkshopProps {
  onClose: () => void;
}

export const RhythmWorkshop = ({ onClose }: RhythmWorkshopProps) => {
  const [isPlaying, setIsPlaying] = useState(patternEngine.isRunning);
  const [bpm,       setBpmState]  = useState(patternEngine.bpm || 100);
  const [viewMode,  setViewMode]  = useState<ViewMode>("both");
  const [pattern,   setPatternSt] = useState<RhythmPattern | null>(
    patternEngine.pattern ?? DEFAULT_PATTERNS[0],
  );
  const [tapCnt,    setTapCnt]    = useState(0);

  const tapDetector = useRef(new TapTempoDetector());

  // ── Init: load default pattern if none set ────────────────────────────────
  useEffect(() => {
    if (!patternEngine.pattern) {
      const first = DEFAULT_PATTERNS[0];
      patternEngine.setPattern({ ...first, bpm });
      setPatternSt(first);
    }
    // Stop main metronome to avoid double-sound
    if (metronomeEngine.isRunning) metronomeEngine.stop();

    return () => {
      patternEngine.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Callbacks ──────────────────────────────────────────────────────────────

  useEffect(() => {
    patternEngine.onStop(() => setIsPlaying(false));
  }, []);

  const togglePlay = async () => {
    if (patternEngine.isRunning) {
      patternEngine.stop();
      setIsPlaying(false);
    } else {
      // Sync BPM before starting
      if (pattern) patternEngine.setPattern({ ...pattern, bpm });
      await patternEngine.start();
      setIsPlaying(true);
    }
  };

  const handleBpmChange = useCallback((v: number) => {
    const clamped = Math.max(20, Math.min(300, Math.round(v)));
    setBpmState(clamped);
    patternEngine.setBpm(clamped);
    // Sync to main metronome engine so the synths use the right config
    metronomeEngine.setBpm(clamped);
  }, []);

  const handleTap = () => {
    const det = tapDetector.current.tap();
    setTapCnt(tapDetector.current.tapCount);
    if (det !== null) handleBpmChange(det);
  };

  const handlePatternChange = useCallback((p: RhythmPattern) => {
    setPatternSt({ ...p, bpm });
  }, [bpm]);

  const selectPattern = (p: RhythmPattern) => {
    const loaded = { ...p, bpm };
    patternEngine.setPattern(loaded);
    setPatternSt(loaded);
    if (patternEngine.isRunning) {
      patternEngine.stop();
      void patternEngine.start().then(() => setIsPlaying(true));
    }
  };

  const saveCurrentPattern = () => {
    if (!pattern) return;
    const name = prompt("Nom du pattern :", pattern.name);
    if (!name?.trim()) return;
    const toSave = {
      ...pattern,
      bpm,
      id: `user_${Date.now()}`,
      name: name.trim(),
    };
    savePattern(toSave);
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      if (e.code === "Space")  { e.preventDefault(); void togglePlay(); }
      if (e.code === "KeyT")   { e.preventDefault(); handleTap(); }
      if (e.code === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, bpm, pattern]);

  const circleSize = viewMode === "both" ? 220 : 320;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2001,
      background: "linear-gradient(160deg,#07080f 0%,#0b0d1c 55%,#080910 100%)",
      display: "flex", flexDirection: "column" as const,
      fontFamily: "-apple-system, system-ui, sans-serif",
      color: "#f5f5f7",
    }}>
    {/* Ambient glow */}
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
      background: "radial-gradient(ellipse 70% 40% at 50% 20%, rgba(0,80,190,0.07) 0%, transparent 70%)",
    }} />
      {/* ── Top bar ── */}
      <TopBar
        name={pattern?.name ?? "Pattern"}
        bpm={bpm}
        onBpmChange={handleBpmChange}
        isPlaying={isPlaying}
        onTogglePlay={() => void togglePlay()}
        onTap={handleTap}
        tapCount={tapCnt}
        onClose={onClose}
      />

      {/* ── View mode tabs ── */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
        padding: "8px 0", background: "rgba(7,8,15,0.6)",
        borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0,
      }}>
        {([
          { id: "circle",    label: "◯ Roue" },
          { id: "both",      label: "⊕ Complet" },
          { id: "partition", label: "▦ Partition" },
        ] as { id: ViewMode; label: string }[]).map(({ id, label }) => (
          <button key={id} type="button" onClick={() => setViewMode(id)}
            style={{
              height: 28, padding: "0 14px", borderRadius: 100, fontSize: 12, fontWeight: viewMode === id ? 600 : 400,
              background: viewMode === id ? "rgba(0,113,227,0.2)" : "transparent",
              border: `1px solid ${viewMode === id ? "rgba(0,113,227,0.4)" : "transparent"}`,
              color: viewMode === id ? "#0071e3" : "rgba(255,255,255,0.5)",
              cursor: "pointer", transition: "all 0.12s",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" as const, position: "relative", zIndex: 1 }}>
        {(viewMode === "circle" || viewMode === "both") && (
          <div style={{
            display: "flex", flexDirection: "column" as const, alignItems: "center",
            padding: viewMode === "circle" ? "40px 20px" : "20px 20px 10px",
            gap: 12,
          }}>
            <CircularRhythmView
              size={circleSize}
              bpm={bpm}
              isPlaying={isPlaying}
              onBeatClick={(bi) => {
                // Selecting a beat from the circle scrolls/highlights it in the partition
                setPatternSt((p) => p ? { ...p } : p);
                void bi; // future: highlight beat in partition
              }}
            />

            {viewMode === "circle" && (
              <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                La roue représente la 1ère mesure du pattern
              </div>
            )}
          </div>
        )}

        {(viewMode === "partition" || viewMode === "both") && (
          <div style={{
            flex: 1,
            padding: viewMode === "partition" ? "20px" : "0 16px 16px",
            minHeight: 0,
          }}>
            {viewMode === "both" && (
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 10 }}>
                Éditeur de partition
              </div>
            )}
            <PartitionEditor onPatternChange={handlePatternChange} />
          </div>
        )}
      </div>

      {/* ── Preset bar ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
      <PresetRow
        current={pattern}
        onSelect={selectPattern}
        onSave={saveCurrentPattern}
        onDelete={(id) => { deletePattern(id); }}
      />

      {/* ── Keyboard hints ── */}
      <div style={{
        height: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
        background: "rgba(0,0,0,0.5)", fontSize: 10, color: "rgba(255,255,255,0.2)",
        flexShrink: 0,
      }}>
        {[["Espace","Start/Stop"],["T","Tap Tempo"],["Échap","Fermer"]].map(([k,l]) => (
          <span key={k}>
            <kbd style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.07)", padding: "1px 5px", borderRadius: 3 }}>{k}</kbd>
            {" "}{l}
          </span>
        ))}
      </div>
      </div>
    </div>
  );
};
