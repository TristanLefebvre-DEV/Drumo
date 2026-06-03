/**
 * SettingsModal — DRUMO global settings
 *
 * 8 sections: AI · MIDI · Physics · Notation · Audio · Performance · Learn · Theme
 * Changes are live (no "Apply" button). Theme changes hit the DOM instantly.
 * All settings persist via localStorage through settingsStore (zustand/persist).
 */

import { useState } from "react";
import {
  useSettingsStore,
  type VisualDensity,
  type FontSize,
  type Appearance,
} from "../../store/settingsStore";
import { ChromaticColorPicker } from "./ChromaticColorPicker";

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
      {value}
      {unit}
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

// PillGroup — horizontal segmented control (Minimal/Standard/Dense, etc.)
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
  <div style={{ marginBottom: 20 }}>
    <h2
      style={{
        margin: 0,
        fontSize: 17,
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
          margin: "5px 0 0",
          fontSize: 12,
          color: "var(--tx-3)",
          lineHeight: 1.5,
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
  <div style={{ marginBottom: 28 }}>
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--tx-3)",
        marginBottom: 2,
        paddingBottom: 6,
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
      padding: "10px 0",
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
            bientôt
          </span>
        )}
      </div>
      {description && (
        <div
          style={{
            fontSize: 11,
            color: "var(--tx-3)",
            marginTop: 2,
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

// ─── Section content components ───────────────────────────────────────────────

const AISection = () => {
  const { ai, setAI } = useSettingsStore();
  return (
    <div>
      <SectionHeader
        title="IA & Intelligence DRUMO"
        description="Contrôle les moteurs d'analyse musicale, physique et pédagogique. Désactiver un moteur accélère le chargement mais réduit les insights."
      />

      <SettingGroup title="Moteurs actifs">
        <Row label="Détection de groove" description="Analyse le style, le swing et la cohésion rythmique">
          <Toggle value={ai.grooveDetection} onChange={(v) => setAI({ grooveDetection: v })} />
        </Row>
        <Row label="Détection de style auto" description="Classifie : rock, jazz, funk, metal, trap…">
          <Toggle value={ai.autoDetectStyle} onChange={(v) => setAI({ autoDetectStyle: v })} />
        </Row>
        <Row label="Simulation physique" description="Analyse la jouabilité biomécanique du pattern">
          <Toggle value={ai.physicalSimulation} onChange={(v) => setAI({ physicalSimulation: v })} />
        </Row>
        <Row label="Analyse de difficulté" description="Score pédagogique : Débutant → Virtuose">
          <Toggle value={ai.difficultyAnalysis} onChange={(v) => setAI({ difficultyAnalysis: v })} />
        </Row>
      </SettingGroup>

      <SettingGroup title="Quantisation intelligente">
        <Row
          label="Quantisation via IA (DIC)"
          description="Laisse le Drum Intelligence Core choisir la grille optimale à chaque chargement MIDI"
        >
          <Toggle value={ai.smartQuantization} onChange={(v) => setAI({ smartQuantization: v })} />
        </Row>
        <Row label="Variantes d'optimisation" description="Génère 3 versions : Simplifiée · Humanisée · Transcrite">
          <Toggle value={ai.optimizationVariants} onChange={(v) => setAI({ optimizationVariants: v })} />
        </Row>
      </SettingGroup>

      <SettingGroup title="Sensibilité">
        <Row
          label="Seuil de confiance IA"
          description="En dessous du seuil, l'IA affiche ses résultats avec une indication d'incertitude"
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
        title="Transcription MIDI"
        description="Paramètres appliqués lors de l'import MIDI. La quantisation IA peut les surcharger si activée."
      />

      <SettingGroup title="Grille par défaut">
        <Row label="Grille de quantisation" description="Utilisée si la détection automatique est désactivée">
          <SettingSelect
            value={midi.defaultGrid}
            onChange={(v) => setMidi({ defaultGrid: v })}
            options={[
              { value: "1/4",  label: "Noire (1/4)"        },
              { value: "1/8",  label: "Croche (1/8)"       },
              { value: "8T",   label: "Croche ternaire"    },
              { value: "1/16", label: "Double croche (1/16)"},
              { value: "16T",  label: "Double croche tern."},
              { value: "1/32", label: "Triple croche (1/32)"},
            ]}
          />
        </Row>
        <Row
          label="Préserver le groove (micro-timing)"
          description="Conserve les décalages intentionnels — essentiel pour jazz, funk, shuffle"
        >
          <Toggle value={midi.preserveGroove} onChange={(v) => setMidi({ preserveGroove: v })} />
        </Row>
        <Row label="Swing" description="Décalage ternaire des croches off-beat (0 = droit)">
          <SettingSlider
            value={midi.swingAmount}
            onChange={(v) => setMidi({ swingAmount: v })}
            min={0}
            max={100}
            unit="%"
          />
        </Row>
      </SettingGroup>

      <SettingGroup title="Vélocités">
        <Row
          label="Seuil notes ghost"
          description="Vélocité MIDI en dessous de laquelle une note est marquée ghost (jouée doucement)"
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
          label="Seuil accentuation"
          description="Vélocité MIDI au-dessus de laquelle une note est marquée accent"
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
        title="Simulation Physique"
        description="Analyse biomécanique déterministe — détecte les patterns injouables, surcharges de membres et conflits rythmiques."
      />

      <SettingGroup title="Activation">
        <Row label="Analyse physique active" description="Désactiver améliore les performances sur fichiers lourds">
          <Toggle value={physics.enabled} onChange={(v) => setPhysics({ enabled: v })} />
        </Row>
        <Row
          label="Afficher la charge des membres"
          description="Pourcentage de charge par membre (pied droit, gauche, main droite, gauche)"
        >
          <Toggle value={physics.showLimbLoad} onChange={(v) => setPhysics({ showLimbLoad: v })} />
        </Row>
      </SettingGroup>

      <SettingGroup title="Seuils">
        <Row
          label="Sensibilité aux conflits"
          description="Valeur haute = plus de détections, plus de faux positifs possibles"
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
          label="Seuil d'avertissement membre"
          description="Au-dessus de ce taux, le membre est signalé comme surchargé"
        >
          <SettingSlider
            value={physics.warningThreshold}
            onChange={(v) => setPhysics({ warningThreshold: v })}
            min={40}
            max={100}
            unit="%"
          />
        </Row>
        <Row label="Modèle d'endurance" description="Standard = règles générales · Avancé = fatigue cumulée" soon>
          <SettingSelect
            value={physics.staminaModel}
            onChange={(v) => setPhysics({ staminaModel: v })}
            options={[
              { value: "standard", label: "Standard" },
              { value: "advanced", label: "Avancé"   },
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
        title="Notation & Lisibilité"
        description="Paramètres de rendu VexFlow. Ces options s'appliquent en temps réel à la partition affichée."
      />

      <SettingGroup title="Optimisations">
        <Row label="Nettoyage de notation" description="Supprime les silences redondants, simplifie les durées">
          <Toggle value={notation.cleanup} onChange={(v) => setNotation({ cleanup: v })} />
        </Row>
        <Row label="Optimisation des silences" description="Groupe et simplifie les silences consécutifs">
          <Toggle value={notation.restOptimization} onChange={(v) => setNotation({ restOptimization: v })} />
        </Row>
        <Row label="Optimisation des liaisons" description="Calcul automatique des liaisons de croches (beaming)">
          <Toggle value={notation.beamOptimization} onChange={(v) => setNotation({ beamOptimization: v })} />
        </Row>
        <Row
          label="Détection de subdivision automatique"
          description="Détermine la grille d'affichage en fonction du contenu (override possible via IA)"
        >
          <Toggle
            value={notation.subdivisionAutoDetect}
            onChange={(v) => setNotation({ subdivisionAutoDetect: v })}
          />
        </Row>
      </SettingGroup>

      <SettingGroup title="Annotations">
        <Row
          label="Dynamiques de vélocité"
          description="Affiche p / mp / mf / f / ff sous les notes selon leur vélocité MIDI"
        >
          <Toggle
            value={notation.showVelocityDynamics}
            onChange={(v) => setNotation({ showVelocityDynamics: v })}
          />
        </Row>
        <Row label="Articulations" description="Accent (>), ghost (parenthèses), ghost note markings">
          <Toggle
            value={notation.showArticulations}
            onChange={(v) => setNotation({ showArticulations: v })}
          />
        </Row>
      </SettingGroup>

      <SettingGroup title="Affichage">
        <Row label="Zoom de la partition" description="Agrandit ou réduit le rendu VexFlow">
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
        title="Audio & Lecture"
        description="Volumes, métronome et compensation de latence. Les changements prennent effet immédiatement."
      />

      <SettingGroup title="Volumes">
        <Row label="Volume principal">
          <SettingSlider
            value={audio.masterVolume}
            onChange={(v) => setAudio({ masterVolume: v })}
            min={0}
            max={100}
            unit="%"
          />
        </Row>
        <Row label="Volume métronome">
          <SettingSlider
            value={audio.metronomeVolume}
            onChange={(v) => setAudio({ metronomeVolume: v })}
            min={0}
            max={100}
            unit="%"
          />
        </Row>
        <Row label="Volume de prévisualisation" description="Notes jouées en cliquant sur la partition ou la grille">
          <SettingSlider
            value={audio.previewVolume}
            onChange={(v) => setAudio({ previewVolume: v })}
            min={0}
            max={100}
            unit="%"
          />
        </Row>
      </SettingGroup>

      <SettingGroup title="Métronome">
        <Row label="Son du métronome">
          <SettingSelect
            value={audio.metronomeSound}
            onChange={(v) => setAudio({ metronomeSound: v })}
            options={[
              { value: "click",     label: "Click"      },
              { value: "woodblock", label: "Wood Block" },
              { value: "beep",      label: "Beep"       },
              { value: "hihat",     label: "Hi-Hat"     },
              { value: "rimshot",   label: "Rim Shot"   },
            ]}
          />
        </Row>
        <Row label="Décompte avant lecture" description="Mesures de métronome avant le départ">
          <SettingSelect
            value={audio.countInBars}
            onChange={(v) => setAudio({ countInBars: v })}
            options={[
              { value: 0, label: "Aucun"     },
              { value: 1, label: "1 mesure"  },
              { value: 2, label: "2 mesures" },
              { value: 4, label: "4 mesures" },
            ]}
          />
        </Row>
      </SettingGroup>

      <SettingGroup title="Synchronisation">
        <Row
          label="Compensation de latence"
          description="Ajuste l'avance de déclenchement des notes (valeur négative = en avance)"
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
        title="Performance Système"
        description="Ajuste le compromis qualité / fluidité. Utile sur les machines moins puissantes ou les fichiers MIDI volumineux."
      />

      <SettingGroup title="Traitement IA">
        <Row
          label="Mode de traitement IA"
          description="Arrière-plan : ne bloque pas l'UI · Synchrone : résultat immédiat mais peut geler"
          soon
        >
          <SettingSelect
            value={performance.aiProcessing}
            onChange={(v) => setPerformance({ aiProcessing: v })}
            options={[
              { value: "background",   label: "Arrière-plan" },
              { value: "synchronous",  label: "Synchrone"    },
            ]}
          />
        </Row>
      </SettingGroup>

      <SettingGroup title="Web Audio">
        <Row
          label="Taille du buffer audio"
          description="Valeur haute = moins de craquements · Valeur basse = latence réduite"
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

      <SettingGroup title="Rendu graphique">
        <Row label="Qualité de rendu VexFlow" description="Haute qualité augmente le temps de rendu sur les longues partitions">
          <SettingSelect
            value={performance.renderQuality}
            onChange={(v) => setPerformance({ renderQuality: v })}
            options={[
              { value: "standard", label: "Standard" },
              { value: "high",     label: "Haute"    },
            ]}
          />
        </Row>
        <Row label="Animations d'interface" description="Réduit ou désactive toutes les transitions CSS">
          <SettingSelect
            value={performance.animations}
            onChange={(v) => setPerformance({ animations: v })}
            options={[
              { value: "full",    label: "Complètes" },
              { value: "reduced", label: "Réduites"  },
              { value: "none",    label: "Aucune"    },
            ]}
          />
        </Row>
      </SettingGroup>

      <SettingGroup title="Sauvegarde">
        <Row label="Sauvegarde automatique" description="Sauvegarde le projet en cours à intervalle régulier" soon>
          <Toggle
            value={performance.autoSave}
            onChange={(v) => setPerformance({ autoSave: v })}
          />
        </Row>
        {performance.autoSave && (
          <Row label="Intervalle de sauvegarde" soon>
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
        title="Mode Apprentissage"
        description="Aide visuelle et pédagogique pour l'étude et la pratique des patterns de batterie."
      />

      <SettingGroup title="Overlays pédagogiques">
        <Row label="Overlay de difficulté" description="Colore les mesures selon leur niveau (vert → rouge)">
          <Toggle
            value={learn.showDifficultyOverlay}
            onChange={(v) => setLearn({ showDifficultyOverlay: v })}
          />
        </Row>
        <Row
          label="Avertissements physiques"
          description="Signale les passages injouables ou dangereux pour l'ergonomie"
        >
          <Toggle
            value={learn.showPhysicalWarnings}
            onChange={(v) => setLearn({ showPhysicalWarnings: v })}
          />
        </Row>
        <Row
          label="Indicateurs de groove"
          description="Met en évidence le style, le swing et les patrons rythmiques clés"
        >
          <Toggle
            value={learn.showGrooveHints}
            onChange={(v) => setLearn({ showGrooveHints: v })}
          />
        </Row>
        <Row
          label="Noms des rudiments"
          description="Identifie et étiquette les rudiments classiques (paradiddle, flam, ruff…)"
          soon
        >
          <Toggle
            value={learn.showRudimentNames}
            onChange={(v) => setLearn({ showRudimentNames: v })}
          />
        </Row>
      </SettingGroup>

      <SettingGroup title="Mode pratique">
        <Row label="Mode de pratique" description="Libre : lecture libre · Guidé : exercices progressifs" soon>
          <SettingSelect
            value={learn.practiceMode}
            onChange={(v) => setLearn({ practiceMode: v })}
            options={[
              { value: "free",   label: "Libre"  },
              { value: "guided", label: "Guidé"  },
            ]}
          />
        </Row>
        <Row
          label="Entraînement progressif au tempo"
          description="Commence lentement et accélère automatiquement à chaque réussite"
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

  return (
    <div>
      <SectionHeader
        title="Interface & Thèmes"
        description="L'interface adapte ses contrastes et couleurs pour optimiser la lisibilité des partitions et la fatigue visuelle."
      />

      {/* ── Appearance ─────────────────────────────────────────────── */}
      <SettingGroup title="Apparence">
        <div style={{ padding: "12px 0" }}>
          <div
            style={{
              display: "flex",
              gap: 10,
            }}
          >
            {(
              [
                {
                  id: "dark" as Appearance,
                  label: "Mode Sombre",
                  sub: "Studio · Production",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ),
                },
                {
                  id: "light" as Appearance,
                  label: "Mode Clair",
                  sub: "Lecture · Pédagogie",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
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
                    border: active
                      ? "1.5px solid var(--accent-line)"
                      : "1.5px solid var(--sep)",
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
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: active ? "var(--accent)" : "var(--tx-1)",
                      }}
                    >
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--tx-3)", marginTop: 2 }}>
                      {opt.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SettingGroup>

      {/* ── Gradient colors ─────────────────────────────────────────── */}
      <SettingGroup title="Couleurs du dégradé">
        <div style={{ padding: "10px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tx-2)" }}>Couleur 1</span>
              <ChromaticColorPicker
                value={theme.gradientColor1 ?? "#0071e3"}
                onChange={(hex) => setTheme({ gradientColor1: hex })}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tx-2)" }}>Couleur 2</span>
              <ChromaticColorPicker
                value={theme.gradientColor2 ?? "#bf5af2"}
                onChange={(hex) => setTheme({ gradientColor2: hex })}
              />
            </div>
          </div>
        </div>
      </SettingGroup>

      {/* ── Density ─────────────────────────────────────────────────── */}
      <SettingGroup title="Intensité visuelle">
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
          <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 8 }}>
            {theme.density === "minimal"
              ? "Espaces larges, éléments réduits — idéal pour la lecture de partitions"
              : theme.density === "dense"
              ? "Plus d'éléments à l'écran — adapté aux écrans larges / haute résolution"
              : "Équilibre entre lisibilité et densité d'information"}
          </div>
        </div>
      </SettingGroup>

      {/* ── Typography & accessibility ─────────────────────────────── */}
      <SettingGroup title="Typographie & accessibilité">
        <Row label="Taille de la police interface">
          <PillGroup
            value={theme.fontSize}
            onChange={(v: FontSize) => setTheme({ fontSize: v })}
            options={[
              { value: "small",  label: "S"  },
              { value: "medium", label: "M"  },
              { value: "large",  label: "L"  },
            ]}
          />
        </Row>
        <Row
          label="Animations d'interface"
          description="Désactiver pour réduire les effets de mouvement (accessibilité)"
        >
          <Toggle
            value={theme.animations}
            onChange={(v) => setTheme({ animations: v })}
          />
        </Row>
        <Row
          label="Contraste renforcé"
          description="Augmente les séparateurs et réduit la hiérarchie des gris"
        >
          <Toggle
            value={theme.highContrast}
            onChange={(v) => setTheme({ highContrast: v })}
          />
        </Row>
      </SettingGroup>

      {/* ── IA color key ───────────────────────────────────────────── */}
      <SettingGroup title="Code couleur IA (lecture seule)">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            padding: "6px 0",
          }}
        >
          {[
            { color: "var(--ia-ok)",     label: "Jouable"          },
            { color: "var(--ia-warn)",   label: "Difficile"        },
            { color: "var(--ia-danger)", label: "Injouable"        },
            { color: "var(--ia-info)",   label: "Analyse neutre"   },
            { color: "var(--ia-groove)", label: "Groove / swing"   },
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
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: "var(--tx-2)" }}>{label}</span>
            </div>
          ))}
        </div>
      </SettingGroup>
    </div>
  );
};

// ─── Section registry ─────────────────────────────────────────────────────────

type SectionId = "ai" | "midi" | "physics" | "notation" | "audio" | "performance" | "learn" | "theme";

const SECTIONS: { id: SectionId; label: string; Icon: () => React.ReactNode; Component: () => React.ReactNode }[] = [
  {
    id: "ai",
    label: "IA & Intelligence",
    Icon: () => (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    Component: AISection,
  },
  {
    id: "midi",
    label: "Transcription MIDI",
    Icon: () => (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <path d="M7 17V8l9-2v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="6" cy="17" r="2" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="15" cy="15" r="2" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
    Component: MidiSection,
  },
  {
    id: "physics",
    label: "Simulation Physique",
    Icon: () => (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="4" r="2" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M10 6v5m0 0-3 5m3-5 3 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 10H5m8 0h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    Component: PhysicsSection,
  },
  {
    id: "notation",
    label: "Notation",
    Icon: () => (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="3" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="3" y1="13" x2="17" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <circle cx="8" cy="5" r="2" fill="currentColor"/>
        <circle cx="13" cy="9" r="2" fill="currentColor"/>
        <circle cx="7" cy="13" r="2" fill="currentColor"/>
      </svg>
    ),
    Component: NotationSection,
  },
  {
    id: "audio",
    label: "Audio & Lecture",
    Icon: () => (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <path d="M5 13H2V8h3l5-4v13l-5-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M15 7a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M13 9a2.5 2.5 0 0 1 0 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    Component: AudioSection,
  },
  {
    id: "performance",
    label: "Performance",
    Icon: () => (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L13 9h5l-4 3.5L16 18l-6-4-6 4 2-5.5L2 9h5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ),
    Component: PerformanceSection,
  },
  {
    id: "learn",
    label: "Apprentissage",
    Icon: () => (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="2" width="14" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="7" y1="2" x2="7" y2="18" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
        <line x1="9.5" y1="7"  x2="14" y2="7"  stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="9.5" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="9.5" y1="13" x2="12" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    Component: LearnSection,
  },
  {
    id: "theme",
    label: "Interface & Thèmes",
    Icon: () => (
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="7"  cy="8.5" r="1.5" fill="currentColor"/>
        <circle cx="13" cy="8.5" r="1.5" fill="currentColor"/>
        <circle cx="10" cy="13" r="1.5" fill="currentColor"/>
      </svg>
    ),
    Component: ThemeSection,
  },
];

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const SettingsModal = ({ onClose }: { onClose: () => void }) => {
  const [active, setActive] = useState<SectionId>("ai");
  const { resetAll } = useSettingsStore();

  const ActiveComponent = SECTIONS.find((s) => s.id === active)?.Component ?? AISection;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.60)",
          zIndex: 999,
          animation: "fade-in 0.15s ease both",
        }}
      />

      {/* Modal card */}
      <div
        role="dialog"
        aria-label="Réglages DRUMO"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          width: "min(880px, 95vw)",
          maxHeight: "min(640px, 92vh)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-2)",
          border: "1px solid var(--sep-2)",
          borderRadius: 14,
          boxShadow: "0 24px 80px rgba(0,0,0,0.70)",
          overflow: "hidden",
          animation: "slide-up 0.18s ease both",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 52,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            borderBottom: "1px solid var(--sep)",
            background: "var(--bg-1)",
          }}
        >
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--tx-1)" }}>
            Réglages DRUMO
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Fermer"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "var(--bg-3)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--tx-2)",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-3)";
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Left nav */}
          <nav
            style={{
              width: 190,
              flexShrink: 0,
              background: "var(--bg-1)",
              borderRight: "1px solid var(--sep)",
              padding: "8px 0",
              overflowY: "auto",
            }}
          >
            {SECTIONS.map(({ id, label, Icon }) => {
              const isActive = active === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActive(id)}
                  style={{
                    width: "100%",
                    padding: "9px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
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
                  <span style={{ flexShrink: 0 }}>
                    <Icon />
                  </span>
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div
            key={active}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px 28px",
              animation: "fade-in 0.14s ease both",
            }}
          >
            <ActiveComponent />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            height: 52,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            borderTop: "1px solid var(--sep)",
            background: "var(--bg-1)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (confirm("Réinitialiser tous les réglages aux valeurs par défaut ?")) {
                resetAll();
              }
            }}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: 12,
              background: "transparent",
              color: "var(--c-red)",
              border: "1px solid rgba(255,69,58,0.25)",
              cursor: "pointer",
              transition: "all 0.12s",
            }}
          >
            Réinitialiser
          </button>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--tx-3)" }}>
              Les changements sont appliqués en temps réel
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "5px 18px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                transition: "opacity 0.12s",
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
