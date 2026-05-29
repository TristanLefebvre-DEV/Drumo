/**
 * Library Page
 *
 * Browse and manage drum kits, presets, and templates.
 * Currently shows the active kit collection with metadata.
 * Future: groove library, fill browser, template marketplace.
 */

import { useProjectStore }   from "../../store/projectStore";
import { DRUM_KIT_PRESETS } from "../../audio/drumKitManager";
import type { DrumKitId }   from "../../audio/drumKitManager";

const LibraryCard = ({
  title, description, count, tag,
  available = true,
}: {
  title: string; description: string; count?: number;
  tag?: string; available?: boolean;
}) => (
  <div
    className="rounded-xl p-4 space-y-2"
    style={{
      background: available ? "var(--bg-2)" : "var(--bg-1)",
      border: `1px solid var(--border-2)`,
      opacity: available ? 1 : 0.45,
    }}
  >
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold" style={{ color: "var(--text-1)" }}>{title}</p>
      <div className="flex items-center gap-1.5">
        {count !== undefined && (
          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold font-mono"
            style={{ background: "var(--bg-3)", color: "var(--text-2)" }}>
            {count}
          </span>
        )}
        {tag && (
          <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase"
            style={{ background: available ? "var(--accent-bg)" : "var(--bg-3)", color: available ? "var(--accent)" : "var(--text-3)" }}>
            {tag}
          </span>
        )}
      </div>
    </div>
    <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-3)" }}>{description}</p>
  </div>
);

const KitCard = ({
  kitId, active, onSelect,
}: { kitId: DrumKitId; active: boolean; onSelect: () => void }) => {
  const kit = DRUM_KIT_PRESETS[kitId];
  if (!kit) return null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-xl p-3 text-left transition"
      style={active
        ? { background: "var(--accent-bg)", border: `1px solid var(--accent-ring)` }
        : { background: "var(--bg-2)", border: "1px solid var(--border-2)" }
      }
    >
      <div className="flex items-center gap-2.5">
        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: kit.color }} />
        <div>
          <p className="text-[11px] font-semibold" style={{ color: active ? "var(--accent)" : "var(--text-1)" }}>
            {kit.name}
          </p>
          <p className="text-[9px]" style={{ color: "var(--text-3)" }}>{kit.description}</p>
        </div>
        {active && (
          <span className="ml-auto text-[9px] font-bold" style={{ color: "var(--accent)" }}>ACTIF</span>
        )}
      </div>
    </button>
  );
};

export const LibraryPage = () => {
  const { activeDrumKitId, setDrumKit } = useProjectStore();
  const kitIds = Object.keys(DRUM_KIT_PRESETS) as DrumKitId[];

  return (
    <div
      className="flex h-full gap-4 p-4 section-fade-in overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Left: kit browser ── */}
      <div className="flex w-72 shrink-0 flex-col gap-3 overflow-auto">
        <div>
          <h1 className="text-sm font-black" style={{ color: "var(--text-1)" }}>Drum Kits</h1>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
            {kitIds.length} kits disponibles
          </p>
        </div>

        <div className="space-y-1.5">
          {kitIds.map((id) => (
            <KitCard
              key={id}
              kitId={id}
              active={activeDrumKitId === id}
              onSelect={() => setDrumKit(id)}
            />
          ))}
        </div>
      </div>

      {/* ── Right: coming soon sections ── */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
          Bibliothèques
        </p>

        <div className="grid grid-cols-2 gap-3">
          <LibraryCard
            title="Groove Library"
            description="Patterns de groove prêts à l'emploi, classés par style et BPM."
            count={0}
            tag="Bientôt"
            available={false}
          />
          <LibraryCard
            title="Fill Browser"
            description="Collection de fills et transitions pour enrichir tes compositions."
            count={0}
            tag="Bientôt"
            available={false}
          />
          <LibraryCard
            title="Templates"
            description="Structures de morceaux complètes (intro → verse → chorus → outro)."
            count={0}
            tag="Bientôt"
            available={false}
          />
          <LibraryCard
            title="Projets récents"
            description="Accès rapide à tes derniers projets enregistrés."
            count={0}
            tag="Bientôt"
            available={false}
          />
          <LibraryCard
            title="Custom Kits"
            description="Kits personnalisés créés avec tes propres samples."
            count={0}
            tag="Bientôt"
            available={false}
          />
          <LibraryCard
            title="Marketplace"
            description="Télécharge des kits, grooves et presets partagés par la communauté."
            count={0}
            tag="Bientôt"
            available={false}
          />
        </div>
      </div>
    </div>
  );
};
