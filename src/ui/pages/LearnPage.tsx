/**
 * Learn Page
 *
 * Educational section — separated from the pro composer so learners
 * get a focused, guided experience without UI clutter.
 *
 * Current content: Body Simulation in educational mode.
 * Future: interactive courses, coach, challenges, exercises.
 */

import { DrummerVisualizer } from "../components/DrummerVisualizer";
import { useProjectStore }   from "../../store/projectStore";

const FeatureCard = ({
  title, description, available = true,
}: { title: string; description: string; available?: boolean }) => (
  <div
    className="rounded-xl p-4 space-y-1.5 transition"
    style={{
      background: available ? "var(--bg-2)" : "var(--bg-1)",
      border: `1px solid ${available ? "var(--border-2)" : "var(--border-1)"}`,
      opacity: available ? 1 : 0.5,
    }}
  >
    <div className="flex items-center gap-2">
      <p className="text-[11px] font-semibold" style={{ color: available ? "var(--text-1)" : "var(--text-3)" }}>
        {title}
      </p>
      {!available && (
        <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase"
          style={{ background: "var(--bg-3)", color: "var(--text-3)" }}>
          Bientôt
        </span>
      )}
    </div>
    <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-3)" }}>{description}</p>
  </div>
);

export const LearnPage = () => {
  const { project } = useProjectStore();

  return (
    <div
      className="flex h-full gap-4 p-4 section-fade-in overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Left: feature list ── */}
      <div className="flex w-72 shrink-0 flex-col gap-3">
        <div>
          <h1 className="text-sm font-black" style={{ color: "var(--text-1)" }}>Mode Apprentissage</h1>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
            Comprendre le mouvement physique du batteur.
          </p>
        </div>

        <FeatureCard
          title="Body Simulation"
          description="Visualise en temps réel où se placent tes mains et pieds sur le kit. Mode éducatif avec labels de membres."
          available
        />
        <FeatureCard
          title="Coach interactif"
          description="Feedback en temps réel sur ton sticking, tes croisements et tes erreurs ergonomiques."
          available={false}
        />
        <FeatureCard
          title="Cours structurés"
          description="Partitions annotées avec instructions pas-à-pas pour chaque rudiment."
          available={false}
        />
        <FeatureCard
          title="Challenge Mode"
          description="Défis chronométrés pour améliorer ta vitesse et ta précision."
          available={false}
        />
        <FeatureCard
          title="Analyse de performance"
          description="Compare ton timing et ta dynamique avec un modèle de référence."
          available={false}
        />

        {!project && (
          <div
            className="mt-auto rounded-xl p-3 text-[10px]"
            style={{ background: "rgba(6,212,240,0.06)", border: "1px solid var(--accent-ring)", color: "var(--accent)" }}
          >
            Charge un fichier MIDI dans <strong>Compose</strong> pour activer la simulation.
          </div>
        )}
      </div>

      {/* ── Right: Body Simulation (educational mode) ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
          Simulation Corps — Mode Éducatif
        </p>
        <div className="flex-1 min-h-0">
          <DrummerVisualizer showEducationalMode={true} />
        </div>
      </div>
    </div>
  );
};
