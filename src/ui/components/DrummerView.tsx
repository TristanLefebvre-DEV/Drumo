import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DRUM_ROWS } from "../../core/drumGrid";
import { buildGrooveGrid } from "../../render/grooveGrid";
import { computeTimeline, lerpScroll } from "../../render/drummerViewTimeline";
import { renderDrummerView, COMPACT_PIECES, type DrummerViewMode } from "../../render/drummerViewRenderer";
import { playDrumSound } from "../../audio/notePreviewEngine";
import { useProjectStore } from "../../store/projectStore";
import type { QuantizedHit, ParsedDrumProject, QuantizeGrid } from "../../core/types";
import type { HeatmapOpts } from "../../render/renderTypes";

const BASE_CELL_W = 18;
const ROW_H_COMPACT = 36;
const ROW_H_DETAILED = 28;

interface DrummerViewProps {
  project: ParsedDrumProject;
  quantizedHits: QuantizedHit[];
  quantizeGrid: QuantizeGrid;
  isPlaying: boolean;
  zoomX: number;
  heatmap: HeatmapOpts;
  previewEnabled: boolean;
}

export const DrummerView = ({
  project,
  quantizedHits,
  quantizeGrid,
  isPlaying,
  zoomX,
  heatmap,
  previewEnabled,
}: DrummerViewProps) => {
  const [mode, setMode] = useState<DrummerViewMode>("detailed");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0); // current lerped scroll position in pixels
  const rafRef = useRef(0);

  // Stable refs for values used inside rAF callback
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const heatmapRef = useRef(heatmap);
  heatmapRef.current = heatmap;
  const zoomRef = useRef(zoomX);
  zoomRef.current = zoomX;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const grid = useMemo(
    () => buildGrooveGrid(quantizedHits, project.ppq, project.timeSignature, quantizeGrid),
    [quantizedHits, project.ppq, project.timeSignature, quantizeGrid]
  );
  const gridRef = useRef(grid);
  gridRef.current = grid;

  const rows = useMemo(
    () =>
      mode === "compact"
        ? DRUM_ROWS.filter((r) => (COMPACT_PIECES as readonly string[]).includes(r.piece))
        : DRUM_ROWS,
    [mode]
  );
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Core render function — reads everything from refs so it's stable
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.offsetWidth;
    const h = container.offsetHeight;

    // Resize canvas if needed
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const g = gridRef.current;
    const currentMode = modeRef.current;
    const currentHeatmap = heatmapRef.current;
    const cellW = BASE_CELL_W * zoomRef.current;
    const rowH = currentMode === "compact" ? ROW_H_COMPACT : ROW_H_DETAILED;
    const LABEL_W = 84;

    // Compute target scroll
    const { activeTick } = useProjectStore.getState();
    const { activeStep, targetScrollLeft } = computeTimeline(
      activeTick,
      g.stepTicks,
      cellW,
      w - LABEL_W
    );

    // Lerp scroll: smooth during playback, snap when stopped
    scrollRef.current = lerpScroll(
      scrollRef.current,
      targetScrollLeft,
      isPlayingRef.current ? 0.1 : 1.0
    );

    renderDrummerView({
      ctx,
      width: w,
      height: h,
      grid: g,
      rows: rowsRef.current,
      activeStep,
      scrollLeft: scrollRef.current,
      cellW,
      rowH,
      heatmap: currentHeatmap,
      mode: currentMode,
    });
  }, []);

  // rAF loop during playback; single render on data/config changes
  useEffect(() => {
    if (isPlaying) {
      const loop = () => {
        renderFrame();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(rafRef.current);
    }
    renderFrame();
    return undefined;
  }, [isPlaying, renderFrame, grid, rows, heatmap, zoomX, mode]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => renderFrame());
    obs.observe(container);
    return () => obs.disconnect();
  }, [renderFrame]);

  // Click to preview sound
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!previewEnabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const LABEL_W = 84;
    const HEADER_H = 28;
    const cellW = BASE_CELL_W * zoomX;
    const rowH = mode === "compact" ? ROW_H_COMPACT : ROW_H_DETAILED;

    const xInGrid = e.clientX - rect.left - LABEL_W + scrollRef.current;
    const yInGrid = e.clientY - rect.top - HEADER_H;
    if (xInGrid < 0 || yInGrid < 0) return;

    const clickedStep = Math.floor(xInGrid / cellW);
    const clickedRow = Math.floor(yInGrid / rowH);
    if (clickedRow < 0 || clickedRow >= rows.length) return;

    const piece = rows[clickedRow]?.piece;
    if (!piece) return;

    // Play preview for all hits at the clicked step on any piece in this row
    const stepCells = grid.cellsByStep.get(clickedStep) ?? [];
    const hit = stepCells.find((c) => c.piece === piece);
    playDrumSound(piece, hit?.velocity ?? 0.75);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/70 px-3 py-1.5">
        {/* Mode toggle */}
        <div className="flex rounded-md border border-zinc-700 bg-zinc-900 p-0.5 gap-0.5">
          {(["detailed", "compact"] as DrummerViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize transition ${
                mode === m ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m === "detailed" ? "Détaillé" : "Compact"}
            </button>
          ))}
        </div>

        {/* Zoom indicator */}
        <span className="text-[11px] text-zinc-500">Zoom ×{zoomX.toFixed(1)}</span>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-4 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <span className="font-mono text-zinc-400">×</span> cymbal
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-zinc-400" /> note
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full border border-zinc-500" /> ghost
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-300" /> accent
          </span>
          <span className="text-zinc-500">f = flam · 2 = double</span>
          {previewEnabled && <span className="text-emerald-600">● Cliquer = jouer</span>}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ cursor: previewEnabled ? "pointer" : "default" }}
          onClick={handleCanvasClick}
        />
      </div>
    </div>
  );
};
