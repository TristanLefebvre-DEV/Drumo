import type { QuantizeGrid } from "../../core/types";

interface TopBarProps {
  grid: QuantizeGrid;
  preserveGroove: boolean;
  zoomX: number;
  zoomY: number;
  onImport: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExportPdf: () => void;
  onExportMidi: () => void;
  onExportSvg: () => void;
  onGridChange: (value: QuantizeGrid) => void;
  onPreserveGroove: (value: boolean) => void;
  onZoomX: (value: number) => void;
  onZoomY: (value: number) => void;
}

const buttonClass =
  "rounded-lg border border-zinc-700/80 bg-zinc-800/90 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700";

const ghostButtonClass =
  "rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100";

export const TopBar = ({
  grid,
  preserveGroove,
  zoomX,
  zoomY,
  onImport,
  onSave,
  onLoad,
  onExportPdf,
  onExportMidi,
  onExportSvg,
  onGridChange,
  onPreserveGroove,
  onZoomX,
  onZoomY
}: TopBarProps) => (
  <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-linear-to-b from-zinc-950 to-zinc-900 px-4 py-3">
    <div className="mr-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2 py-2">
      <button className={buttonClass} onClick={onImport} type="button">Import MIDI</button>
    </div>

    <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2 py-2">
      <button className={ghostButtonClass} onClick={onExportPdf} type="button">PDF</button>
      <button className={ghostButtonClass} onClick={onExportMidi} type="button">MIDI</button>
      <button className={ghostButtonClass} onClick={onExportSvg} type="button">SVG</button>
      <button className={ghostButtonClass} onClick={onSave} type="button">Save</button>
      <button className={ghostButtonClass} onClick={onLoad} type="button">Load</button>
    </div>

    <div className="ml-auto flex flex-wrap items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-300">
      <label className="flex items-center gap-2 text-zinc-400">
        Grid
        <select
          value={grid}
          onChange={(event) => onGridChange(event.target.value as QuantizeGrid)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
        >
          {["1/4", "1/8", "1/16", "1/32", "8T", "16T"].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-zinc-400">
        <input
          type="checkbox"
          className="h-4 w-4 accent-blue-500"
          checked={preserveGroove}
          onChange={(e) => onPreserveGroove(e.target.checked)}
        />
        Preserve groove
      </label>
      <label className="flex items-center gap-2 text-zinc-400">
        Zoom X
        <input
          className="w-24 accent-blue-500"
          type="range" min={0.7} max={2} step={0.1}
          value={zoomX}
          onChange={(e) => onZoomX(Number(e.target.value))}
        />
        <span className="w-10 text-xs text-zinc-500">{Math.round(zoomX * 100)}%</span>
      </label>
      <label className="flex items-center gap-2 text-zinc-400">
        Zoom Y
        <input
          className="w-24 accent-blue-500"
          type="range" min={0.7} max={2} step={0.1}
          value={zoomY}
          onChange={(e) => onZoomY(Number(e.target.value))}
        />
        <span className="w-10 text-xs text-zinc-500">{Math.round(zoomY * 100)}%</span>
      </label>
    </div>
  </header>
);
