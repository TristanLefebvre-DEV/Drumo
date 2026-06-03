/**
 * IsolationPanel
 *
 * "Learn one part at a time" — mutes everything except the selected
 * instrument group.  Connects directly to the store's isolationMode.
 *
 * Compact: designed to fit inside the TransportBar mixer area.
 */

import { useProjectStore } from "../../store/projectStore";
import {
  ISOLATION_LABELS,
  ISOLATION_DESCRIPTION,
} from "../../audio/grooveIsolation";
import type { IsolationMode } from "../../audio/grooveIsolation";

const MODES: NonNullable<IsolationMode>[] = [
  "kick-only",
  "snare-only",
  "cymbals-only",
  "toms-only",
  "ghost-notes-only",
];

export const IsolationPanel = () => {
  const { isolationMode, setIsolationMode, project } = useProjectStore();

  if (!project) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
      <span className="mr-1 text-xs text-zinc-600">Isolation :</span>

      {/* "All" button resets isolation */}
      <button
        type="button"
        onClick={() => setIsolationMode(null)}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${
          isolationMode === null
            ? "border-zinc-500/60 bg-zinc-700/60 text-zinc-200"
            : "border-zinc-700 bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"
        }`}
        title="Entendre tous les instruments"
      >
        All
      </button>

      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setIsolationMode(isolationMode === mode ? null : mode)}
          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${
            isolationMode === mode
              ? "border-teal-500/60 bg-teal-600/25 text-teal-300"
              : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
          }`}
          title={ISOLATION_DESCRIPTION[mode]}
        >
          <span>{ISOLATION_LABELS[mode]}</span>
        </button>
      ))}

      {isolationMode && (
        <span className="ml-1 rounded-full bg-teal-600/20 px-2 py-0.5 text-[10px] text-teal-400 border border-teal-500/30">
          {ISOLATION_DESCRIPTION[isolationMode]}
        </span>
      )}
    </div>
  );
};
