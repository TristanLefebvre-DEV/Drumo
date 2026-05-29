import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DRUM_ROWS, PIECE_TO_ROW, gridStepTicks } from "../../core/drumGrid";
import { mapVelocityToColor, mapVelocityToColorAlpha } from "../../render/velocityColor";
import { playDrumSound } from "../../audio/notePreviewEngine";
import type { DrumHit, DrumPiece, ParsedDrumProject, QuantizeGrid } from "../../core/types";
import type { HeatmapOpts } from "../../render/vexflowAdapter";

const CELL_W = 18;
const CELL_H = 26;
const LABEL_W = 80;
const HEADER_H = 24;
const DRAG_THRESHOLD = 4;
const MAX_STEPS = 1024;

interface DragState {
  hitId: string;
  piece: DrumPiece;
  originalStep: number;
  currentStep: number;
  startX: number;
  isDragging: boolean;
}

interface TooltipState {
  label: string;
  velocity: number;
  type: string;
  x: number;
  y: number;
}

// Identifies a cell for the click-pulse animation
interface PulseState {
  piece: DrumPiece;
  step: number;
  seq: number;
}

interface DrumGridProps {
  project: ParsedDrumProject;
  quantizeGrid: QuantizeGrid;
  activeTick: number;
  heatmap: HeatmapOpts;
  previewEnabled: boolean;
  onAddHit: (piece: DrumPiece, midi: number, tick: number, velocity: number) => void;
  onRemoveHit: (hitId: string) => void;
  onMoveHit: (hitId: string, deltaTicks: number) => void;
  onSetVelocity: (hitId: string, velocity: number) => void;
}

export const DrumGrid = ({
  project,
  quantizeGrid,
  activeTick,
  heatmap,
  previewEnabled,
  onAddHit,
  onRemoveHit,
  onMoveHit,
  onSetVelocity,
}: DrumGridProps) => {
  const stepTicks = gridStepTicks(project.ppq, quantizeGrid);
  const { numerator, denominator } = project.timeSignature;
  const ticksPerBeat = project.ppq * (4 / denominator);
  const ticksPerMeasure = ticksPerBeat * numerator;
  const stepsPerMeasure = Math.round(ticksPerMeasure / stepTicks);
  const stepsPerBeat = Math.round(ticksPerBeat / stepTicks);

  const maxTick = project.hits.length > 0 ? Math.max(...project.hits.map((h) => h.tick)) : 0;
  const totalMeasures = Math.max(4, Math.ceil(maxTick / ticksPerMeasure) + 1);
  const totalSteps = Math.min(MAX_STEPS, totalMeasures * stepsPerMeasure);
  const visibleMeasures = Math.floor(totalSteps / stepsPerMeasure);

  const totalStepsRef = useRef(totalSteps);
  totalStepsRef.current = totalSteps;

  const activeStep = Math.round(activeTick / stepTicks);

  const hitMap = useMemo(() => {
    const map = new Map<DrumPiece, Map<number, DrumHit>>();
    for (const row of DRUM_ROWS) map.set(row.piece, new Map());
    for (const hit of project.hits) {
      const step = Math.round(hit.tick / stepTicks);
      if (step >= totalSteps) continue;
      const rowMap = map.get(hit.piece);
      if (rowMap) {
        const existing = rowMap.get(step);
        if (!existing || hit.velocity > existing.velocity) rowMap.set(step, hit);
      }
    }
    return map;
  }, [project.hits, stepTicks, totalSteps]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const [selectedHitId, setSelectedHitId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverCell, setHoverCell] = useState<{ piece: DrumPiece; step: number } | null>(null);
  const [pulse, setPulse] = useState<PulseState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const triggerPreview = useCallback(
    (piece: DrumPiece, step: number, velocity: number) => {
      if (previewEnabled) playDrumSound(piece, velocity);
      setPulse({ piece, step, seq: Date.now() });
    },
    [previewEnabled]
  );

  const getStepFromClientX = useCallback((clientX: number): number => {
    if (!scrollRef.current) return 0;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = clientX - rect.left + scrollRef.current.scrollLeft;
    return Math.max(0, Math.min(totalStepsRef.current - 1, Math.floor(x / CELL_W)));
  }, []);

  // Global drag listeners
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const currentStep = getStepFromClientX(e.clientX);
      const isDragging = d.isDragging || Math.abs(e.clientX - d.startX) > DRAG_THRESHOLD;
      const next = { ...d, currentStep, isDragging };
      dragRef.current = next;
      setDrag(next);
    };
    const handleUp = () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.isDragging) {
        const delta = d.currentStep - d.originalStep;
        if (delta !== 0) onMoveHit(d.hitId, delta * stepTicks);
      } else {
        setSelectedHitId((prev) => (prev === d.hitId ? null : d.hitId));
      }
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [onMoveHit, stepTicks, getStepFromClientX]);

  // Auto-scroll during playback
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const targetX = activeStep * CELL_W;
    const visible = el.clientWidth;
    const left = el.scrollLeft;
    if (targetX < left || targetX > left + visible - CELL_W * 8) {
      el.scrollTo({ left: Math.max(0, targetX - visible / 3), behavior: "smooth" });
    }
  }, [activeStep]);

  const handleCellMouseDown = (
    e: React.MouseEvent,
    piece: DrumPiece,
    step: number,
    existingHit: DrumHit | undefined
  ) => {
    e.preventDefault();
    setTooltip(null);
    if (e.button === 2) {
      if (existingHit) {
        onRemoveHit(existingHit.id);
        if (selectedHitId === existingHit.id) setSelectedHitId(null);
      }
      return;
    }
    if (e.button !== 0) return;
    if (existingHit) {
      triggerPreview(piece, step, existingHit.velocity);
      const next: DragState = {
        hitId: existingHit.id,
        piece,
        originalStep: step,
        currentStep: step,
        startX: e.clientX,
        isDragging: false,
      };
      dragRef.current = next;
      setDrag(next);
    } else {
      const velocity = e.shiftKey ? 0.35 : e.altKey ? 0.95 : 0.75;
      const row = PIECE_TO_ROW.get(piece)!;
      onAddHit(piece, row.midi, step * stepTicks, velocity);
      triggerPreview(piece, step, velocity);
    }
  };

  // Touch: tap to add/preview (no drag — mobile UX)
  const handleCellTouch = (e: React.TouchEvent, piece: DrumPiece, step: number, existingHit: DrumHit | undefined) => {
    e.preventDefault();
    setTooltip(null);
    if (existingHit) {
      triggerPreview(piece, step, existingHit.velocity);
    } else {
      const row = PIECE_TO_ROW.get(piece)!;
      onAddHit(piece, row.midi, step * stepTicks, 0.75);
      triggerPreview(piece, step, 0.75);
    }
  };

  const handleCellHover = (e: React.MouseEvent, hit: DrumHit | undefined, piece: DrumPiece, step: number) => {
    setHoverCell({ piece, step });
    if (!hit) { setTooltip(null); return; }
    setTooltip({
      label: PIECE_TO_ROW.get(piece)?.label ?? piece,
      velocity: Math.round(hit.velocity * 127),
      type: hit.isGhost ? "ghost" : hit.isAccent ? "accent" : "normal",
      x: e.clientX + 14,
      y: e.clientY - 36,
    });
  };

  const hitColor = (hit: DrumHit, row: (typeof DRUM_ROWS)[number]): string => {
    if (!heatmap.enabled) return hit.isGhost ? "#3f3f46" : hit.isAccent ? "#fbbf24" : row.color;
    return hit.isGhost
      ? mapVelocityToColorAlpha(hit.velocity, heatmap.sensitivity, 0.5)
      : mapVelocityToColor(hit.velocity, heatmap.sensitivity);
  };

  const selectedHit = selectedHitId ? (project.hits.find((h) => h.id === selectedHitId) ?? null) : null;
  const totalWidth = totalSteps * CELL_W;

  return (
    <div
      className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 select-none overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => { setTooltip(null); setHoverCell(null); }}
    >
      <div className="flex">
        {/* Instrument labels */}
        <div className="shrink-0 border-r border-zinc-800 bg-zinc-900/80" style={{ width: LABEL_W }}>
          <div className="border-b border-zinc-800" style={{ height: HEADER_H }} />
          {DRUM_ROWS.map((row) => (
            <div
              key={row.piece}
              className="flex items-center justify-end border-b border-zinc-800/60 pr-2 text-[11px] font-medium"
              style={{
                height: CELL_H,
                color: heatmap.enabled ? mapVelocityToColor(0.6, heatmap.sensitivity) : row.color,
              }}
            >
              {row.label}
            </div>
          ))}
        </div>

        {/* Scrollable grid */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
          <div style={{ width: totalWidth }}>
            {/* Measure header */}
            <div className="flex border-b border-zinc-700" style={{ height: HEADER_H }}>
              {Array.from({ length: visibleMeasures }, (_, mi) => (
                <div
                  key={mi}
                  className="relative flex items-center border-l-2 border-zinc-600 px-1 shrink-0"
                  style={{ width: stepsPerMeasure * CELL_W, fontSize: 10, color: "#71717a" }}
                >
                  <span>{mi + 1}</span>
                  {Array.from({ length: numerator - 1 }, (_, bi) => (
                    <div
                      key={bi}
                      className="absolute top-0 bottom-0 border-l border-zinc-700/50"
                      style={{ left: (bi + 1) * stepsPerBeat * CELL_W }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Instrument rows */}
            {DRUM_ROWS.map((row) => {
              const rowHits = hitMap.get(row.piece)!;
              return (
                <div key={row.piece} className="flex border-b border-zinc-800/50" style={{ height: CELL_H }}>
                  {Array.from({ length: totalSteps }, (_, step) => {
                    let hit = rowHits.get(step);
                    if (drag?.piece === row.piece) {
                      const dragged = rowHits.get(drag.originalStep);
                      if (dragged?.id === drag.hitId) {
                        if (step === drag.originalStep) hit = undefined;
                        if (step === drag.currentStep) hit = dragged;
                      }
                    }

                    const isActiveBeat = step === activeStep;
                    const isMeasureStart = step % stepsPerMeasure === 0;
                    const isBeatStart = !isMeasureStart && step % stepsPerBeat === 0;
                    const isEven = step % 2 === 0;
                    const isHovered = hoverCell?.piece === row.piece && hoverCell?.step === step;
                    const isSelected = !!hit && hit.id === selectedHitId;
                    const isDimmed = !!drag?.isDragging && drag.hitId === hit?.id;
                    const isPlaybackPulse = isActiveBeat && !!hit;
                    const isClickPulse = pulse?.piece === row.piece && pulse?.step === step;

                    return (
                      <div
                        key={step}
                        className="relative flex items-center justify-center shrink-0"
                        style={{
                          width: CELL_W,
                          height: CELL_H,
                          borderLeft: isMeasureStart
                            ? "2px solid #52525b"
                            : isBeatStart
                            ? "1px solid #3f3f46"
                            : "1px solid #27272a",
                          background: isActiveBeat
                            ? "rgba(59,130,246,0.13)"
                            : isHovered && !!hit
                            ? "rgba(255,255,255,0.06)"
                            : !isEven
                            ? "rgba(255,255,255,0.012)"
                            : "transparent",
                          cursor: hit ? (previewEnabled ? "pointer" : "grab") : "crosshair",
                        }}
                        onMouseDown={(e) => handleCellMouseDown(e, row.piece, step, hit)}
                        onMouseEnter={(e) => handleCellHover(e, hit, row.piece, step)}
                        onMouseLeave={() => { setTooltip(null); setHoverCell(null); }}
                        onTouchStart={(e) => handleCellTouch(e, row.piece, step, hit)}
                      >
                        {hit && (
                          <div
                            key={isPlaybackPulse ? `pb-${activeTick}` : isClickPulse ? `cl-${pulse!.seq}` : undefined}
                            className={isPlaybackPulse || isClickPulse ? "heatmap-hit-pulse" : undefined}
                            style={{
                              width: CELL_W - 4,
                              height: CELL_H - 6,
                              borderRadius: 3,
                              flexShrink: 0,
                              background: hitColor(hit, row),
                              opacity: isDimmed ? 0.3 : 1,
                              outline: isSelected ? "2px solid #fff" : "none",
                              outlineOffset: 1,
                              transition: "background 0.15s ease",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Velocity strip */}
      {selectedHit && (
        <div className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300">
          <span className="shrink-0 text-zinc-500">Vélocité</span>
          <input
            type="range" min={1} max={127}
            value={Math.round(selectedHit.velocity * 127)}
            onChange={(e) => onSetVelocity(selectedHit.id, Number(e.target.value) / 127)}
            className="flex-1"
            style={{ accentColor: heatmap.enabled ? mapVelocityToColor(selectedHit.velocity, heatmap.sensitivity) : "#3b82f6" }}
          />
          <span
            className="w-8 text-right tabular-nums font-semibold"
            style={{ color: heatmap.enabled ? mapVelocityToColor(selectedHit.velocity, heatmap.sensitivity) : "#e4e4e7" }}
          >
            {Math.round(selectedHit.velocity * 127)}
          </span>
          <span className="text-zinc-500">
            {selectedHit.isGhost ? "• ghost" : selectedHit.isAccent ? "• accent" : "• normal"}
          </span>
          <span className="ml-auto text-zinc-600">
            {PIECE_TO_ROW.get(selectedHit.piece)?.label} · tick {selectedHit.tick}
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 border-t border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-[10px] text-zinc-600">
        <span>Clic = ajouter / prévisualiser</span>
        <span>Shift = ghost</span>
        <span>Alt = accent</span>
        <span>Drag = déplacer</span>
        <span>Clic droit = supprimer</span>
        <span>Clic note = vélocité</span>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-zinc-700 bg-zinc-900/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <span className="font-semibold text-zinc-100">{tooltip.label}</span>
          <span
            className="ml-2 tabular-nums font-bold"
            style={{ color: heatmap.enabled ? mapVelocityToColor(tooltip.velocity / 127, heatmap.sensitivity) : "#e4e4e7" }}
          >
            {tooltip.velocity}
          </span>
          <span className="ml-1 text-zinc-500">/ 127</span>
          <span className="ml-2 text-zinc-500">{tooltip.type}</span>
        </div>
      )}
    </div>
  );
};
