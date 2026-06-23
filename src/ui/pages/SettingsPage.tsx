/**
 * Settings Page
 *
 * Full-page settings — rendered as a dedicated section instead of a modal.
 * Two-column layout: left nav + scrollable content.
 * All changes are live (no Apply button). Theme changes hit the DOM instantly.
 */

import { useState } from "react";
import {
  useSettingsStore,
  type VisualDensity,
  type FontSize,
  type Appearance,
  type GradientStyle,
} from "../../store/settingsStore";
import { buildPreviewGradient } from "../utils/gradientEngine";
import { ChromaticColorPicker } from "../components/ChromaticColorPicker";
import { ShortcutsSection } from "../components/ShortcutsSection";

// ─── Primitive UI components ──────────────────────────────────────────────────

const Toggle = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    onClick={() => onChange(!value)}
    style={{
      width: 44,
      height: 26,
      borderRadius: 13,
      background: value ? "var(--accent)" : "var(--bg-4)",
      border: "none",
      cursor: "pointer",
      position: "relative",
      flexShrink: 0,
      transition: "background 0.2s ease",
    }}
  >
    <span
      style={{
        position: "absolute",
        top: 3,
        left: value ? 21 : 3,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
        transition: "left 0.18s ease",
        display: "block",
      }}
    />
  </button>
);

const SettingSlider = ({
  value,
  onChange,
  min,
  max,
  unit = "",
  step = 1,
  width = 110,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit?: string;
  step?: number;
  width?: number;
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width, accentColor: "var(--accent)", cursor: "pointer" }}
    />
    <span
      style={{
        fontSize: 11,
        color: "var(--tx-2)",
        fontVariantNumeric: "tabular-nums",
        minWidth: 36,
        textAlign: "right",
      }}
    >
      {value}{unit}
    </span>
  </div>
);

function SettingSelect<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        const parsed = (isNaN(Number(raw)) ? raw : Number(raw)) as T;
        onChange(parsed);
      }}
      style={{
        background: "var(--bg-4)",
        color: "var(--tx-1)",
        border: "1px solid var(--sep-2)",
        borderRadius: 6,
        padding: "5px 8px",
        fontSize: 12,
        cursor: "pointer",
        outline: "none",
        flexShrink: 0,
      }}
    >
      {options.map(({ value: v, label }) => (
        <option key={String(v)} value={String(v)}>
          {label}
        </option>
      ))}
    </select>
  );
}

function PillGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--bg-3)",
        borderRadius: 8,
        padding: 3,
        gap: 2,
        flexShrink: 0,
      }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              background: active ? "var(--bg-2)" : "transparent",
              color: active ? "var(--tx-1)" : "var(--tx-3)",
              border: "none",
              cursor: "pointer",
              boxShadow: active ? "var(--shadow-sm)" : "none",
              transition: "all 0.12s ease",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────────

const SectionHeader = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <div style={{ marginBottom: 24 }}>
    <h2
      style={{
        margin: 0,
        fontSize: 18,
        fontWeight: 600,
        color: "var(--tx-1)",
        letterSpacing: "-0.01em",
      }}
    >
      {title}
    </h2>
    {description && (
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 13,
          color: "var(--tx-3)",
          lineHeight: 1.5,
          maxWidth: 540,
        }}
      >
        {description}
      </p>
    )}
  </div>
);

const SettingGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div style={{ marginBottom: 32 }}>
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--tx-3)",
        marginBottom: 2,
        paddingBottom: 8,
        borderBottom: "1px solid var(--sep)",
      }}
    >
      {title}
    </div>
    <div>{children}</div>
  </div>
);

const Row = ({
  label,
  description,
  children,
  soon = false,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  soon?: boolean;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "11px 0",
      borderBottom: "1px solid var(--sep)",
      gap: 16,
    }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--tx-1)",
        }}
      >
        {label}
        {soon && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--tx-3)",
              background: "var(--bg-4)",
              padding: "1px 5px",
              borderRadius: 4,
            }}
          >
            soon
          </span>
        )}
      </div>
      {description && (
        <div
          style={{
            fontSize: 11,
            color: "var(--tx-3)",
            marginTop: 3,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      )}
    </div>
    {children}
  </div>
);

// ─── Section content ──────────────────────────────────────────────────────────

const AISection = () => {
  const { ai, setAI } = useSettingsStore();
  return (
    <div>
      <SectionHeader
        title="AI & Intelligence"
        description="Control the musical analysis, physical simulation and pedagogical engines. Disabling an engine speeds up loading but reduces insights."
      />
      <SettingGroup title="Active engines">
        <Row label="Groove detection" description="Analyses style, swing and rhythmic cohesion">
          <Toggle value={ai.grooveDetection} onChange={(v) => setAI({ grooveDetection: v })} />
        </Row>
        <Row label="Auto style detection" description="Classifies: rock, jazz, funk, metal, trap…">
          <Toggle value={ai.autoDetectStyle} onChange={(v) => setAI({ autoDetectStyle: v })} />
        </Row>
        <Row label="Physical simulation" description="Biomechanical playability analysis of the pattern">
          <Toggle value={ai.physicalSimulation} onChange={(v) => setAI({ physicalSimulation: v })} />
        </Row>
        <Row label="Difficulty analysis" description="Pedagogical score: Beginner → Virtuoso">
          <Toggle value={ai.difficultyAnalysis} onChange={(v) => setAI({ difficultyAnalysis: v })} />
        </Row>
      </SettingGroup>
      <SettingGroup title="Smart quantization">
        <Row
          label="AI quantization (DIC)"
          description="Let the Drum Intelligence Core choose the optimal grid on each MIDI import"
        >
          <Toggle value={ai.smartQuantization} onChange={(v) => setAI({ smartQuantization: v })} />
        </Row>
        <Row label="Optimization variants" description="Generate 3 versions: Simplified · Humanized · Transcribed">
          <Toggle value={ai.optimizationVariants} onChange={(v) => setAI({ optimizationVariants: v })} />
        </Row>
      </SettingGroup>
      <SettingGroup title="Sensitivity">
        <Row
          label="AI confidence threshold"
          description="Below the threshold, AI shows results with an uncertainty indicator"
        >
          <SettingSlider
            value={ai.confidenceThreshold}
            onChange={(v) => setAI({ confidenceThreshold: v })}
            min={30}
            max={100}
            unit="%"
          />
        </Row>
      </SettingGroup>
    </div>
  );
};

const MidiSection = () => {
  const { midi, setMidi } = useSettingsStore();
  return (
    <div>
      <SectionHeader
        title="MIDI Transcription"
        description="Settings applied during MIDI import. AI quantization can override them when enabled."
      />
      <SettingGroup title="Default grid">
        <Row label="Quantization grid" description="Used if automatic detection is disabled">
          <SettingSelect
            value={midi.defaultGrid}
            onChange={(v) => setMidi({ defaultGrid: v })}
            options={[
              { value: "1/4",  label: "Quarter note (1/4)"       },
              { value: "1/8",  label: "Eighth note (1/8)"        },
              { value: "8T",   label: "Eighth note triplet"      },
              { value: "1/16", label: "Sixteenth note (1/16)"    },
              { value: "16T",  label: "Sixteenth triplet"        },
              { value: "1/32", label: "Thirty-second note (1/32)"},
            ]}
          />
        </Row>
        <Row
          label="Preserve groove (micro-timing)"
          description="Keeps intentional offsets — essential for jazz, funk, shuffle"
        >
          <Toggle value={midi.preserveGroove} onChange={(v) => setMidi({ preserveGroove: v })} />
        </Row>
        <Row label="Swing" description="Ternary offset on off-beat eighths (0 = straight)">
          <SettingSlider
            value={midi.swingAmount}
            onChange={(v) => setMidi({ swingAmount: v })}
            min={0}
            max={100}
            unit="%"
          />
        </Row>
      </SettingGroup>
      <SettingGroup title="Velocities">
        <Row
          label="Ghost note threshold"
          description="MIDI velocity below which a note is marked ghost (played softly)"
        >
          <SettingSlider
            value={midi.ghostNoteThreshold}
            onChange={(v) => setMidi({ ghostNoteThreshold: v })}
            min={1}
            max={80}
            unit=" vel"
          />
        </Row>
        <Row
          label="Accent threshold"
          description="MIDI velocity above which a note is marked as an accent"
        >
          <SettingSlider
            value={midi.accentThreshold}
            onChange={(v) => setMidi({ accentThreshold: v })}
            min={64}
            max={127}
            unit=" vel"
          />
        </Row>
      </SettingGroup>
    </div>
  );
};

const PhysicsSection = () => {
  const { physics, setPhysics } = useSettingsStore();
  return (
    <div>
      <SectionHeader
        title="Physical Simulation"
        description="Deterministic biomechanical analysis — detects unplayable patterns, limb overloads, and rhythmic conflicts."
      />
      <SettingGroup title="Activation">
        <Row label="Physical analysis active" description="Disabling improves performance on large files">
          <Toggle value={physics.enabled} onChange={(v) => setPhysics({ enabled: v })} />
        </Row>
        <Row
          label="Show limb workload"
          description="Percentage load per limb (right foot, left, right hand, left)"
        >
          <Toggle value={physics.showLimbLoad} onChange={(v) => setPhysics({ showLimbLoad: v })} />
        </Row>
      </SettingGroup>
      <SettingGroup title="Thresholds">
        <Row
          label="Conflict sensitivity"
          description="Higher value = more detections, more possible false positives"
        >
          <SettingSlider
            value={physics.conflictSensitivity}
            onChange={(v) => setPhysics({ conflictSensitivity: v })}
            min={10}
            max={100}
            unit="%"
          />
        </Row>
        <Row
          label="Limb warning threshold"
          description="Above this rate, the limb is flagged as overloaded"
        >
          <SettingSlider
            value={physics.warningThreshold}
            onChange={(v) => setPhysics({ warningThreshold: v })}
            min={40}
            max={100}
            unit="%"
          />
        </Row>
        <Row label="Stamina model" description="Standard = general rules · Advanced = cumulative fatigue" soon>
          <SettingSelect
            value={physics.staminaModel}
            onChange={(v) => setPhysics({ staminaModel: v })}
            options={[
              { value: "standard", label: "Standard" },
              { value: "advanced", label: "Advanced" },
            ]}
          />
        </Row>
      </SettingGroup>
    </div>
  );
};

const NotationSection = () => {
  const { notation, setNotation } = useSettingsStore();
  return (
    <div>
      <SectionHeader
        title="Notation & Readability"
        description="VexFlow rendering settings. These options apply in real time to the displayed score."
      />
      <SettingGroup title="Optimizations">
        <Row label="Notation cleanup" description="Removes redundant rests, simplifies durations">
          <Toggle value={notation.cleanup} onChange={(v) => setNotation({ cleanup: v })} />
        </Row>
        <Row label="Rest optimization" description="Groups and simplifies consecutive rests">
          <Toggle value={notation.restOptimization} onChange={(v) => setNotation({ restOptimization: v })} />
        </Row>
        <Row label="Beam optimization" description="Automatic calculation of eighth-note beaming">
          <Toggle value={notation.beamOptimization} onChange={(v) => setNotation({ beamOptimization: v })} />
        </Row>
        <Row
          label="Auto subdivision detection"
          description="Determines display grid from content (overridable via AI)"
        >
          <Toggle
            value={notation.subdivisionAutoDetect}
            onChange={(v) => setNotation({ subdivisionAutoDetect: v })}
          />
        </Row>
      </SettingGroup>
      <SettingGroup title="Annotations">
        <Row
          label="Velocity dynamics"
          description="Shows p / mp / mf / f / ff under notes according to MIDI velocity"
        >
          <Toggle
            value={notation.showVelocityDynamics}
            onChange={(v) => setNotation({ showVelocityDynamics: v })}
          />
        </Row>
        <Row label="Articulations" description="Accent (>), ghost (parentheses), ghost note markings">
          <Toggle
            value={notation.showArticulations}
            onChange={(v) => setNotation({ showArticulations: v })}
          />
        </Row>
      </SettingGroup>
      <SettingGroup title="Display">
        <Row label="Score zoom" description="Enlarges or reduces VexFlow rendering">
          <SettingSlider
            value={notation.scoreScale}
            onChange={(v) => setNotation({ scoreScale: v })}
            min={70}
            max={150}
            unit="%"
          />
        </Row>
      </SettingGroup>
    </div>
  );
};

const AudioSection = () => {
  const { audio, setAudio } = useSettingsStore();
  return (
    <div>
      <SectionHeader
        title="Audio & Playback"
        description="Volumes, metronome and latency compensation. Changes take effect immediately."
      />
      <SettingGroup title="Volumes">
        <Row label="Master volume">
          <SettingSlider
            value={audio.masterVolume}
            onChange={(v) => setAudio({ masterVolume: v })}
            min={0}
            max={100}
            unit="%"
          />
        </Row>
        <Row label="Metronome volume" description="Boost up to 200% for loud practice sessions">
          <SettingSlider
            value={audio.metronomeVolume}
            onChange={(v) => setAudio({ metronomeVolume: v })}
            min={0}
            max={200}
            unit="%"
          />
        </Row>
        <Row label="Preview volume" description="Notes played when clicking the score or grid">
          <SettingSlider
            value={audio.previewVolume}
            onChange={(v) => setAudio({ previewVolume: v })}
            min={0}
            max={100}
            unit="%"
          />
        </Row>
      </SettingGroup>
      <SettingGroup title="Metronome">
        <Row label="Metronome sound">
          <SettingSelect
            value={audio.metronomeSound}
            onChange={(v) => setAudio({ metronomeSound: v })}
            options={[
              { value: "click",       label: "Click"       },
              { value: "sharp-click", label: "Sharp Click" },
              { value: "woodblock",   label: "Wood Block"  },
              { value: "beep",        label: "Beep"        },
              { value: "hihat",       label: "Hi-Hat"      },
              { value: "rimshot",     label: "Rim Shot"    },
            ]}
          />
        </Row>
        <Row label="Count-in before playback" description="Metronome bars before start">
          <SettingSelect
            value={audio.countInBars}
            onChange={(v) => setAudio({ countInBars: v })}
            options={[
              { value: 0, label: "None"    },
              { value: 1, label: "1 bar"   },
              { value: 2, label: "2 bars"  },
              { value: 4, label: "4 bars"  },
            ]}
          />
        </Row>
      </SettingGroup>
      <SettingGroup title="Synchronization">
        <Row
          label="Latency compensation"
          description="Adjusts note trigger advance (negative value = early)"
        >
          <SettingSlider
            value={audio.latencyCompensationMs}
            onChange={(v) => setAudio({ latencyCompensationMs: v })}
            min={-80}
            max={80}
            unit=" ms"
            width={120}
          />
        </Row>
      </SettingGroup>
    </div>
  );
};

const PerformanceSection = () => {
  const { performance, setPerformance } = useSettingsStore();
  return (
    <div>
      <SectionHeader
        title="System Performance"
        description="Adjust the quality / fluidity tradeoff. Useful on less powerful machines or large MIDI files."
      />
      <SettingGroup title="AI processing">
        <Row
          label="AI processing mode"
          description="Background: non-blocking · Synchronous: immediate but may freeze"
          soon
        >
          <SettingSelect
            value={performance.aiProcessing}
            onChange={(v) => setPerformance({ aiProcessing: v })}
            options={[
              { value: "background",  label: "Background"  },
              { value: "synchronous", label: "Synchronous" },
            ]}
          />
        </Row>
      </SettingGroup>
      <SettingGroup title="Web Audio">
        <Row
          label="Audio buffer size"
          description="Higher = fewer pops · Lower = reduced latency"
          soon
        >
          <SettingSelect
            value={performance.audioBufferSize}
            onChange={(v) => setPerformance({ audioBufferSize: v })}
            options={[
              { value: 256,  label: "256 (4 ms)"   },
              { value: 512,  label: "512 (11 ms)"  },
              { value: 1024, label: "1024 (23 ms)" },
              { value: 2048, label: "2048 (46 ms)" },
            ]}
          />
        </Row>
      </SettingGroup>
      <SettingGroup title="Rendering">
        <Row label="VexFlow render quality" description="High quality increases render time on long scores">
          <SettingSelect
            value={performance.renderQuality}
            onChange={(v) => setPerformance({ renderQuality: v })}
            options={[
              { value: "standard", label: "Standard" },
              { value: "high",     label: "High"     },
            ]}
          />
        </Row>
        <Row label="Interface animations" description="Reduces or disables all CSS transitions">
          <SettingSelect
            value={performance.animations}
            onChange={(v) => setPerformance({ animations: v })}
            options={[
              { value: "full",    label: "Full"    },
              { value: "reduced", label: "Reduced" },
              { value: "none",    label: "None"    },
            ]}
          />
        </Row>
      </SettingGroup>
      <SettingGroup title="Auto-save">
        <Row label="Auto-save" description="Saves the current project at regular intervals" soon>
          <Toggle
            value={performance.autoSave}
            onChange={(v) => setPerformance({ autoSave: v })}
          />
        </Row>
        {performance.autoSave && (
          <Row label="Save interval" soon>
            <SettingSlider
              value={performance.autoSaveIntervalMin}
              onChange={(v) => setPerformance({ autoSaveIntervalMin: v })}
              min={1}
              max={30}
              unit=" min"
            />
          </Row>
        )}
      </SettingGroup>
    </div>
  );
};

const LearnSection = () => {
  const { learn, setLearn } = useSettingsStore();
  return (
    <div>
      <SectionHeader
        title="Learning Mode"
        description="Visual and pedagogical aids for studying and practising drum patterns."
      />
      <SettingGroup title="Pedagogical overlays">
        <Row label="Difficulty overlay" description="Colours measures by level (green → red)">
          <Toggle
            value={learn.showDifficultyOverlay}
            onChange={(v) => setLearn({ showDifficultyOverlay: v })}
          />
        </Row>
        <Row
          label="Physical warnings"
          description="Flags unplayable or ergonomically dangerous passages"
        >
          <Toggle
            value={learn.showPhysicalWarnings}
            onChange={(v) => setLearn({ showPhysicalWarnings: v })}
          />
        </Row>
        <Row
          label="Groove hints"
          description="Highlights style, swing and key rhythmic patterns"
        >
          <Toggle
            value={learn.showGrooveHints}
            onChange={(v) => setLearn({ showGrooveHints: v })}
          />
        </Row>
        <Row
          label="Rudiment names"
          description="Identifies and labels classic rudiments (paradiddle, flam, ruff…)"
          soon
        >
          <Toggle
            value={learn.showRudimentNames}
            onChange={(v) => setLearn({ showRudimentNames: v })}
          />
        </Row>
      </SettingGroup>
      <SettingGroup title="Practice mode">
        <Row label="Practice mode" description="Free: open playback · Guided: progressive exercises" soon>
          <SettingSelect
            value={learn.practiceMode}
            onChange={(v) => setLearn({ practiceMode: v })}
            options={[
              { value: "free",   label: "Free"   },
              { value: "guided", label: "Guided" },
            ]}
          />
        </Row>
        <Row
          label="Progressive tempo training"
          description="Starts slowly and accelerates automatically on each success"
          soon
        >
          <Toggle
            value={learn.bpmTrainingEnabled}
            onChange={(v) => setLearn({ bpmTrainingEnabled: v })}
          />
        </Row>
      </SettingGroup>
    </div>
  );
};

const ThemeSection = () => {
  const { theme, setTheme } = useSettingsStore();

  const previewGrad = buildPreviewGradient(
    theme.gradientColor1 ?? "#0071e3",
    theme.gradientColor2 ?? "#bf5af2",
    theme.gradientStyle  ?? "mesh",
    theme.appearance,
    theme.gradientAngle  ?? 135,
    theme.gradientInvert ?? false,
  );

  return (
    <div>
      <SectionHeader
        title="Appearance & Themes"
        description="The interface adapts its contrasts and colours to optimise score readability and visual fatigue."
      />

      {/* ── Live full-screen preview ─────────────────────────── */}
      <div style={{ padding: "0 0 16px" }}>
        <div
          style={{
            height: 140,
            borderRadius: 14,
            background: previewGrad,
            backgroundAttachment: "unset",
            backgroundSize: "cover",
            border: "1px solid var(--sep-2)",
            position: "relative",
            overflow: "hidden",
            transition: "background 0.5s ease",
          }}
        >
          {/* Floating mock panels to show glassmorphism */}
          <div style={{
            position: "absolute", top: 16, left: 16,
            width: 110, height: 70, borderRadius: 10,
            background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.14)",
            backdropFilter: "blur(14px)",
            display: "flex", flexDirection: "column", padding: "8px 10px", gap: 5,
          }}>
            <div style={{ width: 60, height: 6, borderRadius: 4, background: "rgba(255,255,255,0.55)" }} />
            <div style={{ width: 40, height: 5, borderRadius: 4, background: "rgba(255,255,255,0.30)" }} />
            <div style={{ width: 50, height: 5, borderRadius: 4, background: "rgba(255,255,255,0.20)" }} />
            <div style={{ width: 30, height: 5, borderRadius: 4, background: "rgba(255,255,255,0.15)" }} />
          </div>
          <div style={{
            position: "absolute", top: 16, left: 144,
            width: 140, height: 50, borderRadius: 10,
            background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(14px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 90, height: 6, borderRadius: 4, background: "rgba(255,255,255,0.45)" }} />
          </div>
          <div style={{
            position: "absolute", bottom: 12, right: 16,
            width: 130, height: 60, borderRadius: 10,
            background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(14px)",
            display: "flex", flexDirection: "column", padding: "8px 10px", gap: 4,
          }}>
            <div style={{ width: 50, height: 5, borderRadius: 4, background: "rgba(255,255,255,0.40)" }} />
            <div style={{ width: 80, height: 5, borderRadius: 4, background: "rgba(255,255,255,0.25)" }} />
            <div style={{ width: 65, height: 5, borderRadius: 4, background: "rgba(255,255,255,0.18)" }} />
          </div>
          {/* Label */}
          <div style={{
            position: "absolute", bottom: 10, left: 14,
            fontSize: 10, color: "rgba(255,255,255,0.50)", fontWeight: 500,
          }}>
            Aperçu en temps réel
          </div>
        </div>
      </div>

      <SettingGroup title="Appearance">
        <div style={{ padding: "12px 0" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {(
              [
                {
                  id: "dark" as Appearance,
                  label: "Dark Mode",
                  sub: "Studio · Production",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"
                        stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"
                      />
                    </svg>
                  ),
                },
                {
                  id: "light" as Appearance,
                  label: "Light Mode",
                  sub: "Reading · Pedagogy",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                      />
                    </svg>
                  ),
                },
              ] as const
            ).map((opt) => {
              const active = theme.appearance === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme({ appearance: opt.id })}
                  style={{
                    flex: 1,
                    padding: "16px 12px",
                    borderRadius: 10,
                    background: active ? "var(--accent-dim)" : "var(--bg-3)",
                    border: active ? "1.5px solid var(--accent-line)" : "1.5px solid var(--sep)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.15s ease",
                    color: active ? "var(--accent)" : "var(--tx-3)",
                  }}
                >
                  {opt.icon}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--accent)" : "var(--tx-1)" }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--tx-3)", marginTop: 2 }}>{opt.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SettingGroup>

      <SettingGroup title="Couleurs du dégradé">
        <div style={{ padding: "10px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tx-2)" }}>Couleur 1</span>
              <ChromaticColorPicker
                value={theme.gradientColor1 ?? "#0071e3"}
                onChange={(hex) => setTheme({ gradientColor1: hex })}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tx-2)" }}>Couleur 2</span>
              <ChromaticColorPicker
                value={theme.gradientColor2 ?? "#bf5af2"}
                onChange={(hex) => setTheme({ gradientColor2: hex })}
              />
            </div>
          </div>
        </div>
      </SettingGroup>

      <SettingGroup title="Densité visuelle">
        <div style={{ padding: "10px 0 4px" }}>
          <PillGroup
            value={theme.density}
            onChange={(v: VisualDensity) => setTheme({ density: v })}
            options={[
              { value: "minimal",  label: "Minimal"  },
              { value: "standard", label: "Standard" },
              { value: "dense",    label: "Dense"    },
            ]}
          />
          <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 10 }}>
            {theme.density === "minimal"
              ? "Espaces larges, éléments réduits — idéal pour la lecture de partitions"
              : theme.density === "dense"
              ? "Plus d'éléments à l'écran — adapté aux écrans larges / haute résolution"
              : "Équilibre entre lisibilité et densité d'information"}
          </div>
        </div>
      </SettingGroup>

      <SettingGroup title="Arrière-plan dynamique">
        <div style={{ padding: "10px 0 4px" }}>
          {/* ── Gradient style buttons with mini swatch previews ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {([
              { value: "flat",   label: "Uni",     desc: "Fond plat"      },
              { value: "subtle", label: "Subtil",  desc: "Gradient doux"  },
              { value: "radial", label: "Radial",  desc: "Halos lumineux" },
              { value: "mesh",   label: "Mesh",    desc: "Multi-sources"  },
              { value: "aurora", label: "Aurora",  desc: "Animé"          },
              { value: "neon",   label: "Neon",    desc: "Lueurs vives"   },
              { value: "prism",  label: "Prisme",  desc: "Bandes spectr." },
              { value: "wave",   label: "Vague",   desc: "Flux croisés"   },
            ] as { value: GradientStyle; label: string; desc: string }[]).map((g) => {
              const active = (theme.gradientStyle ?? "mesh") === g.value;
              const swatch = buildPreviewGradient(
                theme.gradientColor1 ?? "#0071e3",
                theme.gradientColor2 ?? "#bf5af2",
                g.value,
                theme.appearance,
                theme.gradientAngle  ?? 135,
                theme.gradientInvert ?? false,
              );
              return (
                <button
                  key={g.value}
                  type="button"
                  title={g.desc}
                  onClick={() => setTheme({ gradientStyle: g.value })}
                  style={{
                    padding: 0,
                    borderRadius: 10,
                    cursor: "pointer",
                    background: "none",
                    border: active ? "2px solid var(--accent)" : "2px solid var(--sep)",
                    display: "flex", flexDirection: "column",
                    alignItems: "stretch", gap: 0,
                    overflow: "hidden",
                    transition: "border-color 0.15s",
                    outline: active ? "none" : undefined,
                    boxShadow: active ? "0 0 0 3px var(--accent-dim)" : "none",
                  }}
                >
                  {/* Swatch */}
                  <div style={{
                    height: 44,
                    background: swatch,
                    backgroundSize: "cover",
                    backgroundAttachment: "unset",
                  }} />
                  {/* Label */}
                  <div style={{
                    padding: "5px 6px 6px",
                    background: active ? "var(--accent-dim)" : "var(--bg-3)",
                    display: "flex", flexDirection: "column", gap: 1,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--tx-2)" }}>
                      {g.label}
                    </span>
                    <span style={{ fontSize: 9, color: "var(--tx-4)", lineHeight: 1.2 }}>
                      {g.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Angle slider ── */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--tx-2)", fontWeight: 500 }}>Angle</span>
              <span style={{ fontSize: 11, color: "var(--tx-3)", fontFamily: "monospace" }}>
                {theme.gradientAngle ?? 135}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={theme.gradientAngle ?? 135}
              onChange={(e) => setTheme({ gradientAngle: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
            />
          </div>

          {/* ── Invert toggle ── */}
          <Row label="Inverser le sens">
            <Toggle
              value={theme.gradientInvert ?? false}
              onChange={(v) => setTheme({ gradientInvert: v })}
            />
          </Row>
        </div>
      </SettingGroup>

      <SettingGroup title="Typography & accessibility">
        <Row label="Interface font size">
          <PillGroup
            value={theme.fontSize}
            onChange={(v: FontSize) => setTheme({ fontSize: v })}
            options={[
              { value: "small",  label: "S" },
              { value: "medium", label: "M" },
              { value: "large",  label: "L" },
            ]}
          />
        </Row>
        <Row
          label="Interface animations"
          description="Disable to reduce motion effects (accessibility)"
        >
          <Toggle value={theme.animations} onChange={(v) => setTheme({ animations: v })} />
        </Row>
        <Row
          label="High contrast"
          description="Increases separators and reduces grey hierarchy"
        >
          <Toggle value={theme.highContrast} onChange={(v) => setTheme({ highContrast: v })} />
        </Row>
      </SettingGroup>

      <SettingGroup title="AI colour key (read-only)">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            padding: "6px 0",
          }}
        >
          {[
            { color: "var(--ia-ok)",     label: "Playable"       },
            { color: "var(--ia-warn)",   label: "Difficult"      },
            { color: "var(--ia-danger)", label: "Unplayable"     },
            { color: "var(--ia-info)",   label: "Neutral analysis"},
            { color: "var(--ia-groove)", label: "Groove / swing" },
          ].map(({ color, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                background: "var(--bg-3)",
                borderRadius: 6,
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--tx-2)" }}>{label}</span>
            </div>
          ))}
        </div>
      </SettingGroup>
    </div>
  );
};

// ─── Section registry ─────────────────────────────────────────────────────────

type SectionId = "theme" | "ai" | "midi" | "audio" | "notation" | "physics" | "performance" | "learn" | "shortcuts";

const SECTIONS: {
  id: SectionId;
  label: string;
  group: "workspace" | "engine" | "system";
  Icon: () => React.ReactNode;
  Component: () => React.ReactNode;
}[] = [
  {
    id: "theme",
    label: "Appearance",
    group: "workspace",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="7"  cy="8.5" r="1.5" fill="currentColor"/>
        <circle cx="13" cy="8.5" r="1.5" fill="currentColor"/>
        <circle cx="10" cy="13" r="1.5" fill="currentColor"/>
      </svg>
    ),
    Component: ThemeSection,
  },
  {
    id: "audio",
    label: "Audio",
    group: "workspace",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <path d="M5 13H2V8h3l5-4v13l-5-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M15 7a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M13 9a2.5 2.5 0 0 1 0 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    Component: AudioSection,
  },
  {
    id: "notation",
    label: "Notation",
    group: "workspace",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <line x1="3" y1="5"  x2="17" y2="5"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="3" y1="9"  x2="17" y2="9"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="3" y1="13" x2="17" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="8"  cy="5"  r="2" fill="currentColor"/>
        <circle cx="13" cy="9"  r="2" fill="currentColor"/>
        <circle cx="7"  cy="13" r="2" fill="currentColor"/>
      </svg>
    ),
    Component: NotationSection,
  },
  {
    id: "ai",
    label: "AI & Intelligence",
    group: "engine",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    Component: AISection,
  },
  {
    id: "midi",
    label: "MIDI Import",
    group: "engine",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <path d="M7 17V8l9-2v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="6"  cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="15" cy="15" r="2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    Component: MidiSection,
  },
  {
    id: "physics",
    label: "Physics Engine",
    group: "engine",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="4" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 6v5m0 0-3 5m3-5 3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 10H5m8 0h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    Component: PhysicsSection,
  },
  {
    id: "performance",
    label: "Performance",
    group: "system",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <path d="M3 17l4-8 4 4 3-6 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    Component: PerformanceSection,
  },
  {
    id: "learn",
    label: "Learning",
    group: "system",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="2" width="14" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="7"   y1="2"  x2="7"  y2="18" stroke="currentColor" strokeWidth="1"   opacity="0.5"/>
        <line x1="9.5" y1="7"  x2="14" y2="7"  stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="9.5" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="9.5" y1="13" x2="12" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    Component: LearnSection,
  },
  {
    id: "shortcuts",
    label: "Shortcuts",
    group: "system",
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="5" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="11" y="5" width="7" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="6" y="12" width="8" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
    Component: ShortcutsSection,
  },
];

const GROUP_LABELS: Record<string, string> = {
  workspace: "Workspace",
  engine: "Engines",
  system: "System",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const SettingsPage = () => {
  const [active, setActive] = useState<SectionId>("theme");
  const { resetAll } = useSettingsStore();

  const ActiveComponent = SECTIONS.find((s) => s.id === active)?.Component ?? ThemeSection;

  const groups = ["workspace", "engine", "system"] as const;

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        overflow: "hidden",
        background: "transparent",
      }}
      className="fade-in"
    >
      {/* ── Left nav ── */}
      <nav
        className="glass"
        style={{
          width: 220,
          flexShrink: 0,
          background: "var(--bg-1)",
          borderRight: "1px solid var(--sep)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          paddingBottom: 16,
        }}
      >
        {/* Title */}
        <div style={{
          padding: "20px 16px 16px",
          borderBottom: "1px solid var(--sep)",
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-1)", margin: 0 }}>Settings</p>
          <p style={{ fontSize: 11, color: "var(--tx-3)", margin: "3px 0 0" }}>DRUMO Workstation</p>
        </div>

        {/* Nav groups */}
        <div style={{ flex: 1, paddingTop: 8 }}>
          {groups.map((group) => {
            const items = SECTIONS.filter((s) => s.group === group);
            return (
              <div key={group}>
                <p style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  color: "var(--tx-4)",
                  padding: "12px 16px 4px",
                  margin: 0,
                }}>
                  {GROUP_LABELS[group]}
                </p>
                {items.map(({ id, label, Icon }) => {
                  const isActive = active === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActive(id)}
                      style={{
                        width: "100%",
                        padding: "8px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: isActive ? "var(--accent-dim)" : "transparent",
                        border: "none",
                        borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                        cursor: "pointer",
                        color: isActive ? "var(--accent)" : "var(--tx-3)",
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 400,
                        textAlign: "left",
                        transition: "all 0.12s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          const el = e.currentTarget as HTMLElement;
                          el.style.background = "var(--bg-hover)";
                          el.style.color = "var(--tx-2)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          const el = e.currentTarget as HTMLElement;
                          el.style.background = "transparent";
                          el.style.color = "var(--tx-3)";
                        }
                      }}
                    >
                      <span style={{ flexShrink: 0, color: "inherit" }}>
                        <Icon />
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Reset */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--sep)", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset all settings to defaults?")) resetAll();
            }}
            style={{
              width: "100%",
              padding: "7px 12px",
              borderRadius: 7,
              fontSize: 12,
              background: "transparent",
              color: "var(--c-red)",
              border: "1px solid rgba(255,69,58,0.22)",
              cursor: "pointer",
              transition: "all 0.12s",
            }}
          >
            Reset all settings
          </button>
        </div>
      </nav>

      {/* ── Content ── */}
      <div
        key={active}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "36px 48px",
          maxWidth: 680,
          animation: "fade-in 0.14s ease both",
        }}
      >
        <ActiveComponent />

        <p style={{
          marginTop: 40,
          fontSize: 11,
          color: "var(--tx-4)",
        }}>
          Changes apply immediately. No restart required.
        </p>
      </div>
    </div>
  );
};
