/**
 * Learn Page — v2
 *
 * Educational section — separated from the pro composer so learners
 * get a focused, guided experience. No UI clutter, no cartoons.
 * Transport is at app-shell level.
 */

import { DrummerVisualizer } from "../components/DrummerVisualizer";
import { useProjectStore }   from "../../store/projectStore";

// ─── Feature card ─────────────────────────────────────────────────────────────

const FeatureCard = ({
  title, description, available = true, comingSoon = false,
}: {
  title: string; description: string; available?: boolean; comingSoon?: boolean;
}) => (
  <div
    style={{
      borderRadius: 10,
      padding: "12px 14px",
      background: available ? "var(--bg-2)" : "var(--bg-1)",
      border: `1px solid ${available ? "var(--sep-2)" : "var(--sep)"}`,
      opacity: available ? 1 : 0.55,
      transition: "opacity 0.15s",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
      <p style={{
        fontSize: 12, fontWeight: 600, margin: 0,
        color: available ? "var(--tx-1)" : "var(--tx-3)",
      }}>
        {title}
      </p>
      {comingSoon && (
        <span style={{
          fontSize: 8, fontWeight: 700, textTransform: "uppercase" as const,
          letterSpacing: "0.07em",
          padding: "2px 6px", borderRadius: 4,
          background: "var(--bg-3)", color: "var(--tx-3)",
        }}>
          Bientôt
        </span>
      )}
    </div>
    <p style={{ fontSize: 11, margin: 0, color: "var(--tx-3)", lineHeight: 1.55 }}>
      {description}
    </p>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const LearnPage = () => {
  const { project } = useProjectStore();

  return (
    <div
      className="fade-in"
      style={{
        display: "flex",
        height: "100%",
        gap: 14,
        padding: 14,
        overflow: "hidden",
        background: "var(--bg-app)",
      }}
    >
      {/* ── Left: feature list ── */}
      <div style={{
        width: 260,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflowY: "auto",
      }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: "var(--tx-1)", margin: "0 0 5px" }}>
            Mode apprentissage
          </h1>
          <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0, lineHeight: 1.5 }}>
            Comprendre le mouvement physique du batteur.
          </p>
        </div>

        <FeatureCard
          title="Simulation corporelle"
          description="Visualise en temps réel où se placent les mains et pieds sur le kit. Mode éducatif avec labels de membres."
          available
        />
        <FeatureCard
          title="Coach interactif"
          description="Retour en temps réel sur ton sticking, tes croisements et tes erreurs ergonomiques."
          comingSoon
        />
        <FeatureCard
          title="Cours structurés"
          description="Partitions annotées avec instructions pas à pas pour chaque rudiment."
          comingSoon
        />
        <FeatureCard
          title="Mode défi"
          description="Défis chronométrés pour améliorer ta vitesse et ta précision."
          comingSoon
        />
        <FeatureCard
          title="Analyse de performance"
          description="Compare ton timing et ta dynamique avec un modèle de référence."
          comingSoon
        />

        {!project && (
          <div style={{
            marginTop: "auto",
            borderRadius: 10,
            padding: "10px 12px",
            background: "var(--accent-dim)",
            border: "1px solid var(--accent-line)",
            fontSize: 11,
            color: "var(--accent)",
            lineHeight: 1.5,
          }}>
            Charge un fichier MIDI dans <strong>Compose</strong> pour activer la simulation corporelle.
          </div>
        )}
      </div>

      {/* ── Right: Body Simulation ── */}
      <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0, minHeight: 0, gap: 10, overflow: "hidden" }}>
        <p style={{
          fontSize: 9, fontWeight: 700,
          textTransform: "uppercase" as const, letterSpacing: "0.09em",
          color: "var(--tx-3)", margin: 0, flexShrink: 0,
        }}>
          Simulation Corporelle — Mode Éducatif
        </p>
        <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: "hidden", border: "1px solid var(--sep)" }}>
          <DrummerVisualizer showEducationalMode={true} />
        </div>
      </div>
    </div>
  );
};
