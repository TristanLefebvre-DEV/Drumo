interface RightPanelProps {
  message: string;
  hitCount: number;
  tempo: number;
  signature: string;
  onNudgeSelected: (delta: number) => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  selectedHitId: string | null;
  editableHits: Array<{ id: string; label: string }>;
  onSelectHit: (id: string) => void;
}

export const RightPanel = ({
  message,
  hitCount,
  tempo,
  signature,
  onNudgeSelected,
  onDeleteSelected,
  hasSelection,
  selectedHitId,
  editableHits,
  onSelectHit
}: RightPanelProps) => (
  <aside className="w-80 shrink-0 border-l border-zinc-800 bg-zinc-900/75 p-4 text-sm text-zinc-300">
    <h2 className="mb-3 text-base font-semibold text-zinc-100">Inspector</h2>
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <p className="text-xs leading-relaxed text-zinc-400">{message}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-zinc-900 p-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Hits</p>
          <p className="text-sm font-semibold text-zinc-100">{hitCount}</p>
        </div>
        <div className="rounded-md bg-zinc-900 p-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Tempo</p>
          <p className="text-sm font-semibold text-zinc-100">{tempo.toFixed(1)} BPM</p>
        </div>
        <div className="col-span-2 rounded-md bg-zinc-900 p-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Signature</p>
          <p className="text-sm font-semibold text-zinc-100">{signature}</p>
        </div>
      </div>
    </div>

    <div className="mt-5 space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <h3 className="font-medium text-zinc-100">Quick Edit</h3>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!hasSelection}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 disabled:opacity-40"
          onClick={() => onNudgeSelected(-24)}
        >
          - Tick
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 disabled:opacity-40"
          onClick={() => onNudgeSelected(24)}
        >
          + Tick
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          className="rounded-md border border-rose-800 bg-rose-900/70 px-2 py-1 disabled:opacity-40"
          onClick={onDeleteSelected}
        >
          Delete
        </button>
      </div>
    </div>

    <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
      <h3 className="mb-2 font-medium text-zinc-100">Notes</h3>
      <div className="max-h-56 space-y-1 overflow-auto pr-1">
        {editableHits.map((hit) => (
          <button
            key={hit.id}
            type="button"
            onClick={() => onSelectHit(hit.id)}
            className={`w-full rounded-md border px-2 py-1 text-left text-xs transition ${
              selectedHitId === hit.id
                ? "border-blue-700 bg-blue-900/70 text-blue-100"
                : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            {hit.label}
          </button>
        ))}
      </div>
    </div>
  </aside>
);
