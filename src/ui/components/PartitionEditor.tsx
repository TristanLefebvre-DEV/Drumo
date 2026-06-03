/**
 * PartitionEditor — visual rhythm grid editor.
 *
 * Shows a pattern as a grid of measures → beats → steps.
 * Editing operations mutate the pattern via patternEngine.updatePattern().
 * Visual highlighting follows patternEngine.getCurrentPosition() via RAF.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { patternEngine, makeBeat } from "../../audio/patternEngine";
import type {
  RhythmPattern, RhythmMeasure, RhythmBeat, StepAccent,
} from "../../audio/patternEngine";
import type { MetroSignature } from "../../audio/metronomeEngine";

// ─── Types & constants ────────────────────────────────────────────────────────

const ACCENT_ORDER: StepAccent[] = ["normal", "accent", "strong", "ghost"];
function nextAccent(a: StepAccent): StepAccent {
  const i = ACCENT_ORDER.indexOf(a);
  return ACCENT_ORDER[(i + 1) % ACCENT_ORDER.length];
}

const ACCENT_STYLE: Record<StepAccent, { bg: string; border: string; label: string }> = {
  normal: { bg: "rgba(255,255,255,0.18)", border: "rgba(255,255,255,0.25)", label: "·" },
  accent: { bg: "rgba(0,113,227,0.35)",   border: "rgba(0,113,227,0.7)",    label: ">" },
  strong: { bg: "rgba(52,208,88,0.35)",   border: "rgba(52,208,88,0.7)",    label: "▲" },
  ghost:  { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)", label: "·" },
};

const SUBDIV_OPTS = [1, 2, 3, 4, 6, 8];

// ─── Primitive UI ─────────────────────────────────────────────────────────────

const IconBtn = ({
  onClick, title, children, danger, small,
}: {
  onClick: () => void; title?: string; children: React.ReactNode; danger?: boolean; small?: boolean;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    style={{
      width: small ? 24 : 28, height: small ? 24 : 28,
      borderRadius: small ? 4 : 5,
      background: danger ? "rgba(255,69,58,0.1)" : "rgba(255,255,255,0.07)",
      border: `1px solid ${danger ? "rgba(255,69,58,0.22)" : "rgba(255,255,255,0.12)"}`,
      color: danger ? "#ff453a" : "rgba(255,255,255,0.5)",
      fontSize: small ? 10 : 12, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.1s", flexShrink: 0,
    }}
  >
    {children}
  </button>
);

// ─── Step cell ────────────────────────────────────────────────────────────────

interface StepCellProps {
  active: boolean;
  accent: StepAccent;
  isHighlighted: boolean;
  onToggle: () => void;
  onCycleAccent: () => void;
  size: number;
}

const StepCell = ({ active, accent, isHighlighted, onToggle, onCycleAccent, size }: StepCellProps) => {
  const s = ACCENT_STYLE[accent];
  const bg =
    isHighlighted  ? (active ? "#fff" : "rgba(255,255,255,0.25)") :
    active         ? s.bg :
    "rgba(255,255,255,0.04)";
  const border =
    isHighlighted  ? "rgba(255,255,255,0.8)" :
    active         ? s.border :
    "rgba(255,255,255,0.1)";

  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: 4,
        background: bg,
        border: `1.5px solid ${border}`,
        cursor: "pointer",
        transition: "all 0.07s",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.4,
        color: isHighlighted ? "#000" : (active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)"),
        userSelect: "none" as const,
        flexShrink: 0,
        boxSizing: "border-box" as const,
      }}
      onClick={onToggle}
      onContextMenu={(e) => { e.preventDefault(); if (active) onCycleAccent(); }}
    >
      {active && !isHighlighted && s.label}
    </div>
  );
};

// ─── Beat column ──────────────────────────────────────────────────────────────

interface BeatColumnProps {
  beatIndex: number;
  beat: RhythmBeat;
  isActiveBeat: boolean;
  activeStep: number;
  onSubdivChange: (subs: number) => void;
  onToggleStep: (si: number) => void;
  onCycleAccent: (si: number) => void;
  maxSteps: number; // for layout consistency within a measure
}

const BeatColumn = ({
  beatIndex, beat, isActiveBeat, activeStep,
  onSubdivChange, onToggleStep, onCycleAccent, maxSteps,
}: BeatColumnProps) => {
  const subs     = beat.subdivisions;
  const stepSize = Math.max(18, Math.min(28, Math.floor(210 / maxSteps)));

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 5, alignItems: "center", flexShrink: 0 }}>
      {/* Beat number */}
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: isActiveBeat ? "#0071e3" : "rgba(255,255,255,0.28)",
        letterSpacing: "0.06em", height: 14, lineHeight: "14px",
      }}>
        {beatIndex + 1}
      </div>

      {/* Subdivision count selector */}
      <select
        value={subs}
        onChange={(e) => onSubdivChange(Number(e.target.value))}
        style={{
          height: 22, borderRadius: 4, fontSize: 10, fontWeight: 600,
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)",
          color: "rgba(255,255,255,0.75)", cursor: "pointer", outline: "none",
          padding: "0 3px", width: stepSize * subs + (subs - 1) * 3,
          minWidth: 36, maxWidth: 200,
        }}
      >
        {SUBDIV_OPTS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      {/* Step cells */}
      <div style={{
        display: "flex", gap: 3, alignItems: "center",
        padding: `4px ${4}px`,
        borderRadius: 6,
        background: isActiveBeat ? "rgba(0,113,227,0.1)" : "transparent",
        border: `1px solid ${isActiveBeat ? "rgba(0,113,227,0.25)" : "transparent"}`,
        transition: "all 0.1s",
        boxSizing: "border-box" as const,
      }}>
        {beat.steps.map((step, si) => (
          <StepCell
            key={si}
            active={step.active}
            accent={step.accent}
            isHighlighted={isActiveBeat && activeStep === si}
            onToggle={() => onToggleStep(si)}
            onCycleAccent={() => onCycleAccent(si)}
            size={stepSize}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Measure row ──────────────────────────────────────────────────────────────

interface MeasureRowProps {
  measureIndex: number;
  measure: RhythmMeasure;
  isActive: boolean;
  activeBeat: number;
  activeStep: number;
  onUpdateBeat: (bi: number, updater: (b: RhythmBeat) => RhythmBeat) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

const MeasureRow = ({
  measureIndex, measure, isActive, activeBeat, activeStep,
  onUpdateBeat, onDuplicate, onDelete, canDelete,
}: MeasureRowProps) => {
  const maxSteps = Math.max(...measure.beats.map((b) => b.subdivisions));

  return (
    <div style={{
      background: isActive ? "rgba(0,113,227,0.07)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${isActive ? "rgba(0,113,227,0.22)" : "rgba(255,255,255,0.09)"}`,
      borderRadius: 10,
      padding: "10px 12px",
      transition: "all 0.15s",
      boxShadow: isActive ? "0 0 20px rgba(0,113,227,0.1)" : "none",
    }}>
      {/* Row header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isActive && (
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0071e3", boxShadow: "0 0 6px rgba(0,113,227,0.7)" }} className="play-dot" />
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? "#0071e3" : "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>
            Mesure {measureIndex + 1} · {measure.signature.numerator}/{measure.signature.denominator}
          </span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <IconBtn onClick={onDuplicate} title="Dupliquer cette mesure" small>⧉</IconBtn>
          {canDelete && <IconBtn onClick={onDelete} title="Supprimer cette mesure" danger small>✕</IconBtn>}
        </div>
      </div>

      {/* Beat columns */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", overflowX: "auto", paddingBottom: 4 }}>
        {measure.beats.map((beat, bi) => (
          <BeatColumn
            key={bi}
            beatIndex={bi}
            beat={beat}
            isActiveBeat={isActive && activeBeat === bi}
            activeStep={isActive && activeBeat === bi ? activeStep : -1}
            maxSteps={maxSteps}
            onSubdivChange={(subs) => {
              onUpdateBeat(bi, (b) => {
                const newSteps = Array.from({ length: subs }, (_, si) => ({
                  active: si < b.steps.length ? b.steps[si].active : true,
                  accent: si < b.steps.length ? b.steps[si].accent : (si === 0 ? "accent" : "normal") as StepAccent,
                }));
                return { subdivisions: subs, steps: newSteps };
              });
            }}
            onToggleStep={(si) => {
              onUpdateBeat(bi, (b) => {
                const steps = [...b.steps];
                steps[si] = { ...steps[si], active: !steps[si].active };
                return { ...b, steps };
              });
            }}
            onCycleAccent={(si) => {
              onUpdateBeat(bi, (b) => {
                const steps = [...b.steps];
                steps[si] = { ...steps[si], accent: nextAccent(steps[si].accent) };
                return { ...b, steps };
              });
            }}
          />
        ))}
      </div>

      {/* Accent legend */}
      <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.22)" }}>
        <span>Clic: activer/désactiver</span>
        <span>Clic droit: changer accent</span>
        <span style={{ color: "rgba(52,208,88,0.8)" }}>▲ Fort</span>
        <span style={{ color: "rgba(0,113,227,0.9)" }}>{'>'} Accent</span>
        <span style={{ color: "rgba(255,255,255,0.55)" }}>· Normal</span>
        <span style={{ color: "rgba(255,255,255,0.25)" }}>· Ghost</span>
      </div>
    </div>
  );
};

// ─── PartitionEditor main component ──────────────────────────────────────────

interface PartitionEditorProps {
  onPatternChange?: (p: RhythmPattern) => void;
}

export const PartitionEditor = ({ onPatternChange }: PartitionEditorProps) => {
  const [pattern, setPatternState] = useState<RhythmPattern | null>(
    patternEngine.pattern,
  );
  const [activeMeasure, setActiveMeasure] = useState(-1);
  const [activeBeat,    setActiveBeat]    = useState(-1);
  const [activeStep,    setActiveStep]    = useState(-1);
  const rafRef = useRef<number>(0);

  // ── Sync highlight from engine ──────────────────────────────────────────────
  useEffect(() => {
    const updateHighlight = () => {
      const pos = patternEngine.getCurrentPosition();
      if (pos) {
        setActiveMeasure(pos.measureIndex);
        setActiveBeat(pos.beatIndex);
        setActiveStep(pos.stepIndex);
      } else {
        setActiveMeasure(-1);
        setActiveBeat(-1);
        setActiveStep(-1);
      }
      rafRef.current = requestAnimationFrame(updateHighlight);
    };
    rafRef.current = requestAnimationFrame(updateHighlight);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Pattern change sync ────────────────────────────────────────────────────
  const setPattern = useCallback((p: RhythmPattern) => {
    patternEngine.setPattern(p);
    setPatternState(p);
    onPatternChange?.(p);
  }, [onPatternChange]);

  // ── Measure operations ─────────────────────────────────────────────────────

  const addMeasure = () => {
    if (!pattern) return;
    const lastSig = pattern.measures[pattern.measures.length - 1]?.signature
      ?? { numerator: 4, denominator: 4 };
    const newMeasure: RhythmMeasure = {
      signature: lastSig,
      beats: Array.from({ length: lastSig.numerator }, (_, i) =>
        makeBeat(1) && ({
          subdivisions: 1,
          steps: [{ active: true, accent: (i === 0 ? "strong" : "normal") as StepAccent }],
        })
      ),
    };
    setPattern({ ...pattern, measures: [...pattern.measures, newMeasure] });
  };

  const duplicateMeasure = (mi: number) => {
    if (!pattern) return;
    const copy = JSON.parse(JSON.stringify(pattern.measures[mi])) as RhythmMeasure;
    const measures = [...pattern.measures];
    measures.splice(mi + 1, 0, copy);
    setPattern({ ...pattern, measures });
  };

  const deleteMeasure = (mi: number) => {
    if (!pattern || pattern.measures.length <= 1) return;
    const measures = pattern.measures.filter((_, i) => i !== mi);
    setPattern({ ...pattern, measures });
  };

  const updateBeat = (mi: number, bi: number, updater: (b: RhythmBeat) => RhythmBeat) => {
    if (!pattern) return;
    const measures = pattern.measures.map((m, i) => {
      if (i !== mi) return m;
      const beats = m.beats.map((b, j) => (j === bi ? updater(b) : b));
      return { ...m, beats };
    });
    const next = { ...pattern, measures };
    patternEngine.updatePattern(() => next);
    setPatternState(next);
    onPatternChange?.(next);
  };

  const resetMeasure = (mi: number) => {
    if (!pattern) return;
    const sig = pattern.measures[mi].signature;
    const reset: RhythmMeasure = {
      signature: sig,
      beats: Array.from({ length: sig.numerator }, (_, i) => ({
        subdivisions: 1,
        steps: [{ active: true, accent: (i === 0 ? "strong" : "normal") as StepAccent }],
      })),
    };
    const measures = pattern.measures.map((m, i) => (i === mi ? reset : m));
    setPattern({ ...pattern, measures });
  };

  const changeSig = (mi: number, sig: MetroSignature) => {
    if (!pattern) return;
    const cur = pattern.measures[mi];
    const newBeats = Array.from({ length: sig.numerator }, (_, i) =>
      i < cur.beats.length ? cur.beats[i] : {
        subdivisions: 1,
        steps: [{ active: true, accent: (i === 0 ? "strong" : "normal") as StepAccent }],
      }
    );
    const measures = pattern.measures.map((m, i) =>
      i === mi ? { signature: sig, beats: newBeats } : m
    );
    setPattern({ ...pattern, measures });
  };

  if (!pattern) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
        Aucun pattern chargé. Sélectionne un pattern pour commencer.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>

      {/* Pattern header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{pattern.name}</div>
        <div style={{ display: "flex", gap: 5 }}>
          <IconBtn onClick={addMeasure} title="Ajouter une mesure">＋</IconBtn>
        </div>
      </div>

      {/* Measures */}
      {pattern.measures.map((measure, mi) => (
        <div key={mi}>
          {/* Signature selector above measure */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Mesure {mi + 1}</span>
            <select
              value={`${measure.signature.numerator}/${measure.signature.denominator}`}
              onChange={(e) => {
                const [n, d] = e.target.value.split("/").map(Number);
                changeSig(mi, { numerator: n, denominator: d });
              }}
              style={{ height: 20, borderRadius: 4, fontSize: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.7)", outline: "none", cursor: "pointer" }}
            >
              {["2/4","3/4","4/4","5/4","6/8","7/8","9/8","11/8"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button type="button" onClick={() => resetMeasure(mi)}
              style={{ height: 20, padding: "0 7px", borderRadius: 4, fontSize: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
              Réinit.
            </button>
          </div>

          <MeasureRow
            measureIndex={mi}
            measure={measure}
            isActive={activeMeasure === mi}
            activeBeat={activeBeat}
            activeStep={activeStep}
            onUpdateBeat={(bi, updater) => updateBeat(mi, bi, updater)}
            onDuplicate={() => duplicateMeasure(mi)}
            onDelete={() => deleteMeasure(mi)}
            canDelete={pattern.measures.length > 1}
          />
        </div>
      ))}

      {/* Add measure button */}
      <button type="button" onClick={addMeasure}
        style={{
          height: 36, borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: "rgba(255,255,255,0.04)", border: "1.5px dashed rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.12s",
        }}>
        + Ajouter une mesure
      </button>
    </div>
  );
};
