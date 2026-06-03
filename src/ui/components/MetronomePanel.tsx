/**
 * Panneau Métronome — v2
 *
 * Design unifié avec le design system (CSS variables, pas de Tailwind zinc).
 * Interface professionnelle, lisible, animations fluides.
 */

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

// ─── Constantes ───────────────────────────────────────────────────────────────

const SIGNATURES: { label: string; sig: MetroSignature }[] = [
  { label: "2/4", sig: { numerator: 2, denominator: 4 } },
  { label: "3/4", sig: { numerator: 3, denominator: 4 } },
  { label: "4/4", sig: { numerator: 4, denominator: 4 } },
  { label: "5/4", sig: { numerator: 5, denominator: 4 } },
  { label: "6/8", sig: { numerator: 6, denominator: 8 } },
  { label: "7/8", sig: { numerator: 7, denominator: 8 } },
];

const SUBDIVISIONS: { label: string; icon: string; value: MetroSubdivision }[] = [
  { label: "Noire",          icon: "♩",  value: "quarter"   },
  { label: "Croche",         icon: "♪",  value: "eighth"    },
  { label: "Triolet",        icon: "3",  value: "triplet"   },
  { label: "Double croche",  icon: "⋮",  value: "sixteenth" },
];

const SOUNDS: { label: string; value: MetroSound }[] = [
  { label: "Click",     value: "click"     },
  { label: "Bois",      value: "woodblock" },
  { label: "Bip",       value: "beep"      },
  { label: "Hi-Hat",    value: "hihat"     },
  { label: "Rimshot",   value: "rimshot"   },
];

const POLY_OPTIONS = [2, 3, 4, 5];

const tapDetector = new TapTempoDetector();

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Primitives ───────────────────────────────────────────────────────────────

const Chip = ({
  active, onClick, children, title,
}: {
  active: boolean; onClick: () => void;
  children: React.ReactNode; title?: string;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      padding: "3px 9px",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: active ? 600 : 400,
      background: active ? "var(--accent-dim)" : "var(--bg-3)",
      color:      active ? "var(--accent)"     : "var(--tx-3)",
      border:     `1px solid ${active ? "var(--accent-line)" : "var(--sep)"}`,
      cursor: "pointer",
      transition: "all 0.12s",
      whiteSpace: "nowrap" as const,
    }}
  >
    {children}
  </button>
);

const RowLabel = ({ children }: { children: React.ReactNode }) => (
  <span style={{
    fontSize: 9, fontWeight: 600,
    textTransform: "uppercase" as const, letterSpacing: "0.08em",
    color: "var(--tx-4)", width: 56, flexShrink: 0,
  }}>
    {children}
  </span>
);

const SectionTitle = ({
  children, expanded, onToggle, badge,
}: {
  children: React.ReactNode; expanded: boolean;
  onToggle: () => void; badge?: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onToggle}
    style={{
      width: "100%", display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 14px",
      background: "transparent", border: "none", cursor: "pointer",
      fontSize: 10, fontWeight: 600,
      textTransform: "uppercase" as const, letterSpacing: "0.08em",
      color: "var(--tx-3)",
      transition: "color 0.12s",
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tx-2)"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tx-3)"; }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {children}
      {badge}
    </div>
    <span style={{
      fontSize: 8, color: "var(--tx-4)",
      transform: expanded ? "rotate(180deg)" : "none",
      transition: "transform 0.18s ease",
      display: "inline-block",
    }}>▼</span>
  </button>
);

const ActiveDot = ({ color = "var(--accent)" }: { color?: string }) => (
  <span style={{
    display: "inline-block", width: 6, height: 6,
    borderRadius: "50%", background: color,
  }} />
);

// ─── Visualiseur de battements ────────────────────────────────────────────────

const BeatVisualizer = ({
  numerator,
  beatRefs,
  running,
}: {
  numerator: number;
  beatRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  running: boolean;
}) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, padding: "10px 0 6px",
  }}>
    {Array.from({ length: numerator }, (_, i) => (
      <div
        key={i}
        ref={(el) => { beatRefs.current[i] = el; }}
        data-beat={i}
        style={{
          width: 28, height: 28,
          borderRadius: "50%",
          border: `2px solid var(--sep-2)`,
          background: "var(--bg-3)",
          transition: "transform 0.06s ease, box-shadow 0.06s ease, opacity 0.06s ease",
          transform: "scale(1)",
          opacity: running ? 0.4 : 0.25,
        }}
      />
    ))}
  </div>
);

// ─── Affichage BPM ────────────────────────────────────────────────────────────

const BpmDisplay = ({
  bpm, onChange, running,
}: {
  bpm: number; onChange: (bpm: number) => void; running: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(bpm));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setInputVal(String(bpm));
  }, [bpm, editing]);

  const commit = () => {
    const parsed = parseInt(inputVal, 10);
    if (!isNaN(parsed)) onChange(Math.max(20, Math.min(300, parsed)));
    setEditing(false);
  };

  return (
    <div style={{ textAlign: "center", padding: "4px 0 2px" }}>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min={20} max={300}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          style={{
            width: 120, background: "transparent",
            textAlign: "center", fontFamily: "monospace",
            fontSize: 52, fontWeight: 800, color: "var(--tx-1)",
            border: "none", outline: "none",
          }}
        />
      ) : (
        <div
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "baseline", gap: 6 }}
          onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.select(), 10); }}
          onWheel={(e) => { e.preventDefault(); onChange(bpm + (e.deltaY < 0 ? 1 : -1)); }}
          title="Cliquer pour modifier · Molette pour ajuster"
        >
          <span style={{
            fontFamily: "monospace", fontSize: 56, fontWeight: 800,
            color: running ? "var(--accent)" : "var(--tx-1)",
            letterSpacing: "-0.02em",
            transition: "color 0.3s ease",
          }}>
            {bpm}
          </span>
          <span style={{ fontSize: 12, color: "var(--tx-4)", fontWeight: 500 }}>BPM</span>
        </div>
      )}
      <p style={{
        fontSize: 10, color: "var(--tx-3)", margin: "2px 0 0",
        fontStyle: "italic",
      }}>
        {tempoLabel(bpm)}
      </p>
    </div>
  );
};

// ─── Panneau principal ────────────────────────────────────────────────────────

export const MetronomePanel = ({ onClose }: { onClose?: () => void }) => {
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

  const beatRefs    = useRef<(HTMLDivElement | null)[]>([]);
  const prevBeatRef = useRef(-1);
  const project     = useProjectStore((s) => s.project);

  // ── Beat callback (DOM direct) ────────────────────────────────────────────
  const handleBeat = useCallback((beatIndex: number, isAccent: boolean, subdivIdx: number) => {
    if (subdivIdx !== 0) return;
    const prev = prevBeatRef.current;
    const prevEl = beatRefs.current[prev];
    if (prevEl) {
      prevEl.style.transform = "scale(1)";
      prevEl.style.opacity = "0.4";
      prevEl.style.borderColor = "var(--sep-2)";
      prevEl.style.background = "var(--bg-3)";
      prevEl.style.boxShadow = "none";
    }
    const el = beatRefs.current[beatIndex];
    if (el) {
      el.style.transform = isAccent ? "scale(1.35)" : "scale(1.22)";
      el.style.opacity = "1";
      el.style.borderColor = isAccent ? "var(--accent)" : "var(--tx-2)";
      el.style.background   = isAccent ? "var(--accent-dim)" : "var(--bg-4)";
      el.style.boxShadow = isAccent
        ? "0 0 16px 4px var(--accent-dim)"
        : "0 0 8px 2px rgba(255,255,255,0.08)";
      setTimeout(() => {
        if (el) {
          el.style.transform = "scale(1)";
          el.style.opacity = "0.5";
          el.style.boxShadow = "none";
        }
      }, 130);
    }
    prevBeatRef.current = beatIndex;
  }, []);

  const handleBpmChange = useCallback((newBpm: number) => setBpmState(newBpm), []);

  useEffect(() => {
    metronomeEngine.onBeat(handleBeat);
    metronomeEngine.onBpmChange(handleBpmChange);
    metronomeEngine.onStop(() => setRunning(false));
    return () => metronomeEngine.onBeat(null as unknown as Parameters<typeof metronomeEngine.onBeat>[0]);
  }, [handleBeat, handleBpmChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === "Space") { e.preventDefault(); void togglePlay(); }
      if (e.code === "KeyT") { e.preventDefault(); handleTap(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [running, bpm]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const togglePlay = async () => {
    if (running) {
      metronomeEngine.stop();
      setRunning(false);
      beatRefs.current.forEach((el) => {
        if (el) {
          el.style.transform = "scale(1)";
          el.style.opacity = "0.25";
          el.style.borderColor = "var(--sep-2)";
          el.style.background = "var(--bg-3)";
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
    if (detected) setBpm(detected);
    setTimeout(() => { if (tapDetector.tapCount === 0) setTapCount(0); }, 3100);
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

  const setSubdivAndApply = (s: MetroSubdivision) => { setSubdivision(s); metronomeEngine.setSubdivision(s); };
  const setSoundAndApply  = (s: MetroSound)       => { setSoundType(s);   metronomeEngine.setSoundType(s);   };
  const setVolumeAndApply = (v: number)            => { setVolume(v);      metronomeEngine.setVolume(v);      };
  const setVisualOnlyApply = (v: boolean)          => { setVisualOnly(v);  metronomeEngine.setVisualOnly(v);  };

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

  const syncFromProject = () => { if (project) setBpm(Math.round(project.tempoBpm)); };

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

  // ─── Render ───────────────────────────────────────────────────────────────

  const panelBorder: React.CSSProperties = {
    borderTop: "1px solid var(--sep)",
  };

  return (
    <div style={{
      width: 284,
      display: "flex",
      flexDirection: "column",
      borderRadius: 14,
      border: "1px solid var(--sep-2)",
      background: "var(--bg-2)",
      boxShadow: "var(--shadow-md)",
      overflow: "hidden",
      minHeight: 460,
    }}>

      {/* ── En-tête ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: "1px solid var(--sep)",
        background: "var(--bg-1)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: running ? "var(--accent)" : "var(--tx-4)",
            transition: "background 0.3s ease",
            boxShadow: running ? "0 0 8px var(--accent)" : "none",
          }} className={running ? "play-dot" : undefined} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-1)" }}>Métronome</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {project && (
            <button
              type="button"
              onClick={syncFromProject}
              title="Synchroniser le BPM depuis le projet"
              style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 5,
                background: "transparent", border: "1px solid var(--sep)",
                color: "var(--tx-3)", cursor: "pointer",
                textTransform: "uppercase" as const, letterSpacing: "0.06em",
                transition: "all 0.12s",
              }}
            >
              Sync {Math.round(project.tempoBpm)}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 22, height: 22, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--bg-3)", border: "none", cursor: "pointer",
                fontSize: 13, color: "var(--tx-3)", transition: "all 0.12s",
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Visualiseur de battements ── */}
      <div style={{
        padding: "0 14px",
        borderBottom: "1px solid var(--sep)",
        background: "var(--bg-1)",
        flexShrink: 0,
      }}>
        <BeatVisualizer numerator={sig.numerator} beatRefs={beatRefs} running={running} />
      </div>

      {/* ── Affichage BPM ── */}
      <div style={{ padding: "8px 14px 4px", flexShrink: 0 }}>
        <BpmDisplay bpm={bpm} onChange={setBpm} running={running} />

        {/* Boutons ±BPM */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 4, marginTop: 6, marginBottom: 4,
        }}>
          {[-10, -5, -1].map((d) => (
            <button
              key={d} type="button"
              onClick={() => setBpm(bpm + d)}
              style={{
                padding: "3px 8px", borderRadius: 6,
                fontSize: 10, cursor: "pointer",
                background: "var(--bg-3)", color: "var(--tx-3)",
                border: "1px solid var(--sep)",
                transition: "all 0.1s",
              }}
            >{d}</button>
          ))}
          <div style={{ width: 8 }} />
          {[1, 5, 10].map((d) => (
            <button
              key={d} type="button"
              onClick={() => setBpm(bpm + d)}
              style={{
                padding: "3px 8px", borderRadius: 6,
                fontSize: 10, cursor: "pointer",
                background: "var(--bg-3)", color: "var(--tx-3)",
                border: "1px solid var(--sep)",
                transition: "all 0.1s",
              }}
            >+{d}</button>
          ))}
        </div>

        {/* Slider BPM */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 9, color: "var(--tx-4)", width: 20 }}>20</span>
          <input
            type="range" min={20} max={300} step={1} value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            style={{ flex: 1, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: 9, color: "var(--tx-4)", width: 24, textAlign: "right" }}>300</span>
        </div>
      </div>

      {/* ── Démarrer / Tap ── */}
      <div style={{
        display: "flex", gap: 8, padding: "8px 14px",
        ...panelBorder, flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => void togglePlay()}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, padding: "9px 12px", borderRadius: 9,
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            background: running ? "var(--accent-dim)" : "var(--bg-3)",
            color:      running ? "var(--accent)"     : "var(--tx-1)",
            border:     `1px solid ${running ? "var(--accent-line)" : "var(--sep-2)"}`,
            transition: "all 0.15s",
          }}
        >
          {running ? "⏹ Stop" : "▶ Démarrer"}
          <span style={{ fontSize: 9, color: "var(--tx-4)", fontWeight: 400 }}>[Espace]</span>
        </button>

        <button
          type="button"
          onClick={handleTap}
          title="Tap tempo [T]"
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "9px 14px", borderRadius: 9,
            fontSize: 11, fontWeight: 600, cursor: "pointer",
            background: "var(--bg-3)", color: "var(--tx-2)",
            border: "1px solid var(--sep-2)",
            transition: "transform 0.05s, background 0.1s",
            userSelect: "none" as const,
          }}
          onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.95)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        >
          Tap
          {tapCount > 0 && (
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--accent)" }}>
              {tapCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Mesure + Subdivision ── */}
      <div style={{ padding: "10px 14px", ...panelBorder, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
          <RowLabel>Mesure</RowLabel>
          {SIGNATURES.map(({ label, sig: s }) => (
            <Chip
              key={label}
              active={sig.numerator === s.numerator && sig.denominator === s.denominator}
              onClick={() => setSigAndApply(s)}
            >
              {label}
            </Chip>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
          <RowLabel>Subdiv</RowLabel>
          {SUBDIVISIONS.map(({ label, icon, value }) => (
            <Chip
              key={value}
              active={subdivision === value}
              onClick={() => setSubdivAndApply(value)}
              title={label}
            >
              {icon}
            </Chip>
          ))}
        </div>
      </div>

      {/* ── Son + Volume ── */}
      <div style={{ padding: "10px 14px", ...panelBorder, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
          <RowLabel>Son</RowLabel>
          {SOUNDS.map(({ label, value }) => (
            <Chip
              key={value}
              active={soundType === value}
              onClick={() => setSoundAndApply(value)}
            >
              {label}
            </Chip>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RowLabel>Volume</RowLabel>
          <input
            type="range" min={0} max={1} step={0.02}
            value={volume}
            onChange={(e) => setVolumeAndApply(Number(e.target.value))}
            style={{ flex: 1, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: 10, color: "var(--tx-3)", fontFamily: "monospace", width: 34, textAlign: "right" }}>
            {Math.round(volume * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setVisualOnlyApply(!visualOnly)}
            title="Visuel uniquement (silencieux)"
            style={{
              padding: "2px 7px", borderRadius: 5, fontSize: 9,
              cursor: "pointer",
              background: visualOnly ? "var(--accent-dim)" : "var(--bg-3)",
              color:      visualOnly ? "var(--accent)"     : "var(--tx-4)",
              border:     `1px solid ${visualOnly ? "var(--accent-line)" : "var(--sep)"}`,
              transition: "all 0.12s",
            }}
          >
            👁
          </button>
        </div>
      </div>

      {/* ── Mode entraînement ── */}
      <div style={{ ...panelBorder }}>
        <SectionTitle
          expanded={showTraining}
          onToggle={() => setShowTraining((v) => !v)}
          badge={training.enabled ? <ActiveDot /> : null}
        >
          Entraînement progressif
        </SectionTitle>
        {showTraining && (
          <div style={{ padding: "4px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={training.enabled}
                onChange={(e) => setTrainingField({ enabled: e.target.checked })}
                style={{ accentColor: "var(--accent)", width: 13, height: 13 }}
              />
              <span style={{ fontSize: 11, color: "var(--tx-2)" }}>Accélération automatique</span>
            </label>
            {training.enabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 4 }}>
                {[
                  { label: "BPM cible", key: "targetBpm" as const, min: 20, max: 300 },
                  { label: "+BPM / palier", key: "stepBpm"  as const, min: 1,  max: 20  },
                  { label: "Mesures / palier", key: "stepMeasures" as const, min: 1, max: 32 },
                ].map(({ label, key, min, max }) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "var(--tx-3)" }}>{label}</span>
                    <input
                      type="number" min={min} max={max}
                      value={training[key]}
                      onChange={(e) => setTrainingField({ [key]: Number(e.target.value) })}
                      style={{
                        width: 60, textAlign: "center",
                        borderRadius: 6, padding: "3px 6px",
                        background: "var(--bg-3)", color: "var(--tx-1)",
                        border: "1px solid var(--sep)", fontSize: 11,
                      }}
                    />
                  </div>
                ))}
                <p style={{ fontSize: 10, color: "var(--tx-4)", fontStyle: "italic", margin: 0 }}>
                  {bpm} → {training.targetBpm} BPM, +{training.stepBpm} toutes {training.stepMeasures} mesures
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Polyrythmie ── */}
      <div style={{ ...panelBorder }}>
        <SectionTitle
          expanded={showPoly}
          onToggle={() => setShowPoly((v) => !v)}
          badge={poly.enabled ? <ActiveDot color="var(--ia-groove)" /> : null}
        >
          Polyrythmie
        </SectionTitle>
        {showPoly && (
          <div style={{ padding: "4px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={poly.enabled}
                onChange={(e) => setPolyField({ enabled: e.target.checked })}
                style={{ accentColor: "var(--ia-groove)", width: 13, height: 13 }}
              />
              <span style={{ fontSize: 11, color: "var(--tx-2)" }}>Rythme croisé actif</span>
            </label>
            {poly.enabled && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--tx-3)" }}>Contre</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {POLY_OPTIONS.map((n) => (
                      <Chip key={n} active={poly.against === n} onClick={() => setPolyField({ against: n })}>
                        {n}
                      </Chip>
                    ))}
                  </div>
                  <span style={{ fontSize: 10, color: "var(--tx-4)" }}>sur {sig.numerator}</span>
                </div>
                <p style={{ fontSize: 10, color: "var(--tx-4)", fontStyle: "italic", margin: 0 }}>
                  {poly.against} pulsations (aigu) contre {sig.numerator}/{sig.denominator}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Presets ── */}
      <div style={{ ...panelBorder }}>
        <SectionTitle
          expanded={showPresets}
          onToggle={() => setShowPresets((v) => !v)}
        >
          Presets ({presets.length})
        </SectionTitle>
        {showPresets && (
          <div style={{ padding: "4px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                placeholder="Nom du preset…"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); }}
                style={{
                  flex: 1, padding: "5px 8px", borderRadius: 6,
                  background: "var(--bg-3)", color: "var(--tx-1)",
                  border: "1px solid var(--sep)",
                  fontSize: 11,
                }}
              />
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                style={{
                  padding: "5px 10px", borderRadius: 6, fontSize: 11,
                  cursor: presetName.trim() ? "pointer" : "not-allowed",
                  background: "var(--bg-3)", color: "var(--tx-2)",
                  border: "1px solid var(--sep)",
                  opacity: presetName.trim() ? 1 : 0.4,
                  transition: "opacity 0.12s",
                }}
              >
                Sauver
              </button>
            </div>

            {presets.length === 0 ? (
              <p style={{ fontSize: 10, color: "var(--tx-4)", textAlign: "center", fontStyle: "italic", margin: 0 }}>
                Aucun preset sauvegardé
              </p>
            ) : (
              <div style={{ maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 8px", borderRadius: 6,
                      background: "var(--bg-3)", border: "1px solid var(--sep)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(preset)}
                      style={{
                        flex: 1, textAlign: "left", background: "none", border: "none",
                        cursor: "pointer", fontSize: 11, color: "var(--tx-2)",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--tx-1)" }}>{preset.name}</span>
                      <span style={{ marginLeft: 8, fontSize: 10, color: "var(--tx-4)", fontFamily: "monospace" }}>
                        {preset.bpm} BPM · {preset.signature.numerator}/{preset.signature.denominator}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(preset.id)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 13, color: "var(--tx-4)", padding: "0 2px",
                        transition: "color 0.12s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--c-red)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--tx-4)"; }}
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

      {/* ── Pied de page ── */}
      <div style={{
        marginTop: "auto",
        padding: "8px 14px",
        borderTop: "1px solid var(--sep)",
        background: "var(--bg-1)",
        flexShrink: 0,
      }}>
        <p style={{ fontSize: 9, color: "var(--tx-4)", textAlign: "center", margin: 0 }}>
          Espace = Démarrer/Stop · T = Tap · Molette sur le BPM
        </p>
      </div>
    </div>
  );
};
