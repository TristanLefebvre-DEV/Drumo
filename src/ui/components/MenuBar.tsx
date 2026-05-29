import type { QuantizeGrid } from "../../core/types";

type AppTheme = "graphite" | "blue";

export interface MenuBarProps {
  focusMode: boolean;
  theme: AppTheme;
  canEditSelection: boolean;
  grid: QuantizeGrid;
  preserveGroove: boolean;
  zoomX: number;
  zoomY: number;
  onToggleFocus: () => void;
  onThemeChange: (t: AppTheme) => void;
  onImport: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExportPdf: () => void;
  onExportMidi: () => void;
  onExportSvg: () => void;
  onGridChange: (g: QuantizeGrid) => void;
  onPreserveGroove: (v: boolean) => void;
  onZoomX: (v: number) => void;
  onZoomY: (v: number) => void;
  onNudgeLeft: () => void;
  onNudgeRight: () => void;
  onDelete: () => void;
}

const primaryBtn =
  "rounded border border-zinc-700/80 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100";
const ghostBtn =
  "rounded border border-zinc-800 bg-transparent px-2 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800/60 hover:text-zinc-200";
const Sep = () => <div className="h-4 w-px shrink-0 bg-zinc-800" />;

const DrumoLogo = () => (
  <div className="flex select-none items-center gap-2 shrink-0">
    <svg width="28" height="23" viewBox="0 0 36 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="22" width="2.5" height="7" rx="1" fill="#dc2626" />
      <rect x="3.5" y="17" width="2.5" height="12" rx="1" fill="#dc2626" />
      <rect x="30" y="19" width="2.5" height="10" rx="1" fill="#dc2626" />
      <rect x="33.5" y="14" width="2.5" height="15" rx="1" fill="#dc2626" />
      <ellipse cx="9" cy="13" rx="4.5" ry="2.2" stroke="#dc2626" strokeWidth="1.8" fill="none" />
      <circle cx="18" cy="19" r="9" stroke="#dc2626" strokeWidth="2" fill="none" />
      <circle cx="18" cy="19" r="5" stroke="#dc2626" strokeWidth="1.2" fill="none" />
      <line x1="18" y1="10" x2="27" y2="4" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="27" cy="3.5" rx="4" ry="1.3" stroke="#dc2626" strokeWidth="1.5" fill="none" />
      <line x1="18" y1="10" x2="9" y2="4" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="6.5" y1="4" x2="6.5" y2="10.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="6.5" cy="3.5" rx="4" ry="1.3" stroke="#dc2626" strokeWidth="1.5" fill="none" />
    </svg>
    <div className="flex flex-col leading-none">
      <span className="font-black tracking-[0.12em] text-zinc-200" style={{ fontSize: "14px" }}>
        DRUMO
      </span>
      <span className="text-[7px] font-medium uppercase tracking-[0.2em] text-zinc-600">
        Groove Station
      </span>
    </div>
  </div>
);

export const MenuBar = ({
  focusMode, theme, canEditSelection,
  grid, preserveGroove, zoomX, zoomY,
  onToggleFocus, onThemeChange,
  onImport, onSave, onLoad,
  onExportPdf, onExportMidi, onExportSvg,
  onGridChange, onPreserveGroove, onZoomX, onZoomY,
  onNudgeLeft, onNudgeRight, onDelete,
}: MenuBarProps) => (
  <nav className="flex min-h-10 items-center gap-2 border-b border-zinc-800 bg-zinc-950/98 px-3 py-1 text-xs">
    <DrumoLogo />
    <Sep />

    {!focusMode && (
      <>
        {/* ── File ops ── */}
        <div className="flex items-center gap-1">
          <button className={primaryBtn} onClick={onImport} type="button">
            Import MIDI
          </button>
          <button className={ghostBtn} onClick={onSave} type="button">Save</button>
          <button className={ghostBtn} onClick={onLoad} type="button">Load</button>
        </div>

        <Sep />

        {/* ── Export ── */}
        <div className="flex items-center gap-1">
          <span className="pr-0.5 text-[9px] uppercase tracking-wider text-zinc-600">Export</span>
          <button className={ghostBtn} onClick={onExportPdf} type="button">PDF</button>
          <button className={ghostBtn} onClick={onExportMidi} type="button">MIDI</button>
          <button className={ghostBtn} onClick={onExportSvg} type="button">SVG</button>
        </div>

        <Sep />

        {/* ── Quantize & Zoom ── */}
        <div className="flex items-center gap-3 text-zinc-400">
          <label className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-zinc-600">Grid</span>
            <select
              value={grid}
              onChange={(e) => onGridChange(e.target.value as QuantizeGrid)}
              className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-100 focus:outline-none focus:border-blue-600"
            >
              {["1/4", "1/8", "1/16", "1/32", "8T", "16T"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={preserveGroove}
              onChange={(e) => onPreserveGroove(e.target.checked)}
              className="h-3 w-3 accent-blue-500"
            />
            <span className="text-[11px] text-zinc-500">Preserve groove</span>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[9px] text-zinc-600">X</span>
            <input
              type="range" min={0.7} max={2} step={0.1}
              value={zoomX}
              onChange={(e) => onZoomX(Number(e.target.value))}
              className="w-14 accent-blue-500"
            />
            <span className="w-7 text-right text-[10px] tabular-nums text-zinc-500">
              {Math.round(zoomX * 100)}%
            </span>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[9px] text-zinc-600">Y</span>
            <input
              type="range" min={0.7} max={2} step={0.1}
              value={zoomY}
              onChange={(e) => onZoomY(Number(e.target.value))}
              className="w-14 accent-blue-500"
            />
            <span className="w-7 text-right text-[10px] tabular-nums text-zinc-500">
              {Math.round(zoomY * 100)}%
            </span>
          </label>
        </div>

        {/* ── Edit (selection) ── */}
        {canEditSelection && (
          <>
            <Sep />
            <div className="flex items-center gap-1">
              <span className="pr-0.5 text-[9px] uppercase tracking-wider text-zinc-600">Edit</span>
              <button className={ghostBtn} onClick={onNudgeLeft} type="button">← Tick</button>
              <button className={ghostBtn} onClick={onNudgeRight} type="button">Tick →</button>
              <button
                className="rounded border border-red-800/50 bg-red-900/20 px-2 py-1 text-[11px] text-red-400 transition hover:bg-red-900/40 hover:text-red-300"
                onClick={onDelete}
                type="button"
              >
                Delete
              </button>
            </div>
          </>
        )}

        <Sep />
      </>
    )}

    {/* ── Right side ── */}
    <div className="ml-auto flex items-center gap-2">
      {!focusMode && (
        <>
          <select
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as AppTheme)}
            className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-500 focus:outline-none"
          >
            <option value="graphite">Graphite</option>
            <option value="blue">Blue</option>
          </select>
          <Sep />
          <span className="hidden xl:block rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-0.5 text-[9px] text-zinc-600">
            Space · Ctrl+O · Ctrl+S
          </span>
        </>
      )}
      <button
        type="button"
        onClick={onToggleFocus}
        className={`rounded border px-2.5 py-1 text-[11px] transition ${
          focusMode
            ? "border-blue-500/60 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
            : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        }`}
      >
        {focusMode ? "Exit Focus" : "Focus"}
      </button>
    </div>
  </nav>
);
