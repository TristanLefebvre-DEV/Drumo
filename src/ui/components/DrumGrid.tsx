/**
 * DrumGrid — v4  (Ableton-style MIDI editor)
 *
 * Fonctionnalités :
 *   - Sélection multi-notes par rectangle (clic+glisser sur zone vide)
 *   - Shift+clic pour ajouter/retirer une note de la sélection
 *   - Ctrl+C / Ctrl+V : copier / coller à la position du playhead
 *   - Alt+drag sur note sélectionnée : dupliquer la sélection
 *   - Ctrl+D : dupliquer la sélection vers la droite (quantized)
 *   - Escape : désélectionner tout
 *   - Move/resize individuels (comportement v3 conservé)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DRUM_ROWS, PIECE_TO_ROW, gridStepTicks } from "../../core/drumGrid";
import { mapVelocityToColor, mapVelocityToColorAlpha } from "../../render/velocityColor";
import { playDrumSound } from "../../audio/notePreviewEngine";
import type { DrumHit, DrumPiece, NoteType, ParsedDrumProject, QuantizeGrid } from "../../core/types";
import type { HeatmapOpts } from "../../render/renderTypes";
import { useDrumGridKeyboard } from "../hooks/useDrumGridKeyboard";

// ─── Constantes layout ────────────────────────────────────────────────────────

const CELL_W       = 18;
const CELL_H       = 26;
const LABEL_W      = 84;
const HEADER_H     = 24;
const RESIZE_W     = 7;
const DRAG_THRESH  = 4;
const MAX_STEPS    = 1024;
const VEL_LANE_H   = 56;

// ─── Types ────────────────────────────────────────────────────────────────────

type DragMode = "move" | "resize";

interface DragState {
  mode: DragMode;
  hitId: string;
  piece: DrumPiece;
  startX: number;
  isDragging: boolean;
  wasSelected: boolean;
  originalStep: number;
  currentStep: number;
  originalDurSteps: number;
  currentDurSteps: number;
}

interface TooltipState {
  label: string; velocity: number; type: string; dur: string;
}

interface PulseState {
  piece: DrumPiece; step: number; seq: number;
}

/** Content-space coords of the rubber-band selection rect. */
interface SelectRectState {
  startCX: number;
  startCY: number;
  currentCX: number;
  currentCY: number;
}

/** Deferred note-add — converts to rubber-band selection if the mouse drags. */
interface PotentialAdd {
  piece: DrumPiece;
  midi: number;
  step: number;
  velocity: number;
  startX: number;
  startY: number;
  startCX: number;
  startCY: number;
}

/** Alt+drag duplicate state. */
interface DupDragState {
  hits: DrumHit[];
  startX: number;
  deltaSteps: number;
  isDragging: boolean;
}

/** Velocity lane drag state. */
interface VelDragState {
  hitId: string;
  startY: number;
  startVelocity: number;
}

// ─── Descriptor for pasted / duplicated notes ─────────────────────────────────

export interface PasteHitDescriptor {
  piece: DrumPiece;
  midi: number;
  tick: number;
  velocity: number;
  durationTicks: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DrumGridProps {
  project:        ParsedDrumProject;
  quantizeGrid:   QuantizeGrid;
  activeTick:     number;
  heatmap:        HeatmapOpts;
  previewEnabled: boolean;
  onAddHit:       (piece: DrumPiece, midi: number, tick: number, velocity: number) => void;
  onRemoveHit:    (hitId: string) => void;
  onMoveHit:      (hitId: string, deltaTicks: number) => void;
  onSetVelocity:  (hitId: string, velocity: number) => void;
  onSetDuration:  (hitId: string, durationTicks: number) => void;
  onPasteHits:    (hits: PasteHitDescriptor[]) => void;
  onToggleMute:      (hitId: string) => void;
  onSetNoteType:     (hitId: string, type: NoteType) => void;
  onSetProbability:  (hitId: string, probability: number) => void;
  onUndo:            () => void;
  onRedo:            () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const durationLabel = (ticks: number, ppq: number): string => {
  const r = ticks / ppq;
  if (r >= 1.9)  return "∞";
  if (r >= 0.95) return "1/1";
  if (r >= 0.45) return "1/2";
  if (r >= 0.22) return "1/4";
  if (r >= 0.11) return "1/8";
  if (r >= 0.05) return "1/16";
  return "1/32";
};

// ─── Main component ───────────────────────────────────────────────────────────

export const DrumGrid = ({
  project, quantizeGrid, activeTick, heatmap, previewEnabled,
  onAddHit, onRemoveHit, onMoveHit, onSetVelocity, onSetDuration, onPasteHits,
  onToggleMute, onSetNoteType, onSetProbability, onUndo, onRedo,
}: DrumGridProps) => {

  const stepTicks       = gridStepTicks(project.ppq, quantizeGrid);
  const { numerator, denominator } = project.timeSignature;
  const ticksPerBeat    = project.ppq * (4 / denominator);
  const ticksPerMeasure = ticksPerBeat * numerator;
  const stepsPerMeasure = Math.round(ticksPerMeasure / stepTicks);
  const stepsPerBeat    = Math.round(ticksPerBeat / stepTicks);

  const maxTick       = project.hits.length > 0 ? Math.max(...project.hits.map((h) => h.tick)) : 0;
  const totalMeasures = Math.max(4, Math.ceil(maxTick / ticksPerMeasure) + 1);
  const totalSteps    = Math.min(MAX_STEPS, totalMeasures * stepsPerMeasure);
  const visibleMeas   = Math.floor(totalSteps / stepsPerMeasure);

  const totalStepsRef = useRef(totalSteps);
  totalStepsRef.current = totalSteps;

  const activeStep = Math.round(activeTick / stepTicks);

  // ── Maps de hits ─────────────────────────────────────────────────────────

  const hitByStep = useMemo(() => {
    const map = new Map<DrumPiece, Map<number, DrumHit>>();
    for (const row of DRUM_ROWS) map.set(row.piece, new Map());
    for (const hit of project.hits) {
      const step = Math.round(hit.tick / stepTicks);
      if (step >= totalSteps) continue;
      const rowMap = map.get(hit.piece);
      if (rowMap) {
        const ex = rowMap.get(step);
        if (!ex || hit.velocity > ex.velocity) rowMap.set(step, hit);
      }
    }
    return map;
  }, [project.hits, stepTicks, totalSteps]);

  const coverageSet = useMemo(() => {
    const map = new Map<DrumPiece, Set<number>>();
    for (const row of DRUM_ROWS) map.set(row.piece, new Set());
    for (const hit of project.hits) {
      const startStep = Math.round(hit.tick / stepTicks);
      const durSteps  = Math.max(1, Math.round(hit.durationTicks / stepTicks));
      const pieceSet  = map.get(hit.piece);
      if (pieceSet) {
        for (let s = startStep; s < startStep + durSteps && s < totalSteps; s++) {
          pieceSet.add(s);
        }
      }
    }
    return map;
  }, [project.hits, stepTicks, totalSteps]);

  // ── État local ────────────────────────────────────────────────────────────

  // Note drag (move / resize) — single note
  const [drag, setDrag]           = useState<DragState | null>(null);
  const dragRef                   = useRef<DragState | null>(null);
  dragRef.current                 = drag;

  // Multi-selection
  const [selectedHitIds, setSelectedHitIds] = useState<Set<string>>(new Set());
  const selectedHitIdsRef                   = useRef<Set<string>>(new Set());
  selectedHitIdsRef.current                 = selectedHitIds;

  // Internal clipboard (no need for state — doesn't affect rendering)
  const clipboardRef = useRef<DrumHit[]>([]);

  // Rubber-band selection rectangle
  const [selectRect, setSelectRect] = useState<SelectRectState | null>(null);
  const selectRectRef               = useRef<SelectRectState | null>(null);

  // Deferred note-add (so a drag can become a selection rect instead)
  const potentialAddRef = useRef<PotentialAdd | null>(null);

  // Alt+drag duplicate
  const [dupDrag, setDupDrag] = useState<DupDragState | null>(null);
  const dupDragRef            = useRef<DupDragState | null>(null);
  dupDragRef.current          = dupDrag;

  // Velocity lane drag
  const [velDrag, setVelDrag] = useState<VelDragState | null>(null);
  const velDragRef            = useRef<VelDragState | null>(null);
  velDragRef.current          = velDrag;

  // Live velocity override during drag (hitId → 0-1)
  const [velDragLive, setVelDragLive] = useState<Map<string, number>>(new Map());

  // Stable-ref proxies for callbacks used inside global event handlers
  const onAddHitRef      = useRef(onAddHit);       onAddHitRef.current      = onAddHit;
  const onMoveHitRef     = useRef(onMoveHit);      onMoveHitRef.current     = onMoveHit;
  const onSetDurationRef = useRef(onSetDuration);  onSetDurationRef.current = onSetDuration;
  const onPasteHitsRef   = useRef(onPasteHits);    onPasteHitsRef.current   = onPasteHits;
  const onSetVelocityRef = useRef(onSetVelocity);  onSetVelocityRef.current = onSetVelocity;
  const projectRef       = useRef(project);        projectRef.current       = project;
  const activeTickRef    = useRef(activeTick);     activeTickRef.current    = activeTick;
  const stepTicksRef     = useRef(stepTicks);      stepTicksRef.current     = stepTicks;

  const [tooltip,   setTooltip]   = useState<TooltipState | null>(null);
  const [hoverCell, setHoverCell] = useState<{ piece: DrumPiece; step: number } | null>(null);
  const [pulse,     setPulse]     = useState<PulseState | null>(null);
  const scrollRef                 = useRef<HTMLDivElement>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const triggerPreview = useCallback((piece: DrumPiece, velocity: number, step: number) => {
    if (previewEnabled) playDrumSound(piece, velocity);
    setPulse({ piece, step, seq: Date.now() });
  }, [previewEnabled]);

  const triggerPreviewRef = useRef(triggerPreview);
  triggerPreviewRef.current = triggerPreview;

  /** clientX → step index in the scrollable content. */
  const getStepFromClientX = useCallback((clientX: number): number => {
    if (!scrollRef.current) return 0;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = clientX - rect.left + scrollRef.current.scrollLeft;
    return Math.max(0, Math.min(totalStepsRef.current - 1, Math.floor(x / CELL_W)));
  }, []);

  /**
   * Convert a client (screen) position to content-space coordinates.
   * Content space: (0,0) = top-left of the scrollable inner div (includes the header).
   */
  const getContentCoords = useCallback((clientX: number, clientY: number): { cx: number; cy: number } => {
    if (!scrollRef.current) return { cx: 0, cy: 0 };
    const rect = scrollRef.current.getBoundingClientRect();
    return {
      cx: clientX - rect.left + scrollRef.current.scrollLeft,
      cy: clientY - rect.top,
    };
  }, []);

  /** Returns the set of hit IDs whose visual bounding box intersects the selection rect. */
  const hitsInRect = useCallback((sr: SelectRectState): Set<string> => {
    const proj   = projectRef.current;
    const stTick = stepTicksRef.current;
    const x1 = Math.min(sr.startCX, sr.currentCX);
    const x2 = Math.max(sr.startCX, sr.currentCX);
    const y1 = Math.min(sr.startCY, sr.currentCY) - HEADER_H;
    const y2 = Math.max(sr.startCY, sr.currentCY) - HEADER_H;
    const result = new Set<string>();
    for (const hit of proj.hits) {
      const startStep = Math.round(hit.tick / stTick);
      const durSteps  = Math.max(1, Math.round(hit.durationTicks / stTick));
      const rowIdx    = DRUM_ROWS.findIndex((r) => r.piece === hit.piece);
      if (rowIdx < 0) continue;
      const nx1 = startStep * CELL_W;
      const nx2 = (startStep + durSteps) * CELL_W;
      const ny1 = rowIdx * CELL_H;
      const ny2 = (rowIdx + 1) * CELL_H;
      if (nx2 > x1 && nx1 < x2 && ny2 > y1 && ny1 < y2) result.add(hit.id);
    }
    return result;
  }, []);

  // ── Listeners globaux drag + sélection ────────────────────────────────────

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      // Priority 0: velocity lane drag
      const vd = velDragRef.current;
      if (vd) {
        const deltaY = vd.startY - e.clientY;
        const newVel = Math.max(1 / 127, Math.min(1, vd.startVelocity + deltaY / VEL_LANE_H));
        setVelDragLive(new Map([[vd.hitId, newVel]]));
        return;
      }

      // Priority 1: note drag (move / resize)
      const d = dragRef.current;
      if (d) {
        const isDragging = d.isDragging || Math.abs(e.clientX - d.startX) > DRAG_THRESH;
        if (d.mode === "move") {
          const currentStep = getStepFromClientX(e.clientX);
          const next = { ...d, currentStep, isDragging };
          dragRef.current = next;
          setDrag(next);
        } else {
          const deltaSteps     = Math.round((e.clientX - d.startX) / CELL_W);
          const currentDurSteps = Math.max(1, d.originalDurSteps + deltaSteps);
          const next = { ...d, currentDurSteps, isDragging };
          dragRef.current = next;
          setDrag(next);
        }
        return;
      }

      // Priority 2: potential add → may convert to rubber-band selection
      const pa = potentialAddRef.current;
      if (pa) {
        const dx = Math.abs(e.clientX - pa.startX);
        const dy = Math.abs(e.clientY - pa.startY);
        if (dx > DRAG_THRESH || dy > DRAG_THRESH) {
          const { cx, cy } = getContentCoords(e.clientX, e.clientY);
          const sr: SelectRectState = {
            startCX: pa.startCX, startCY: pa.startCY,
            currentCX: cx, currentCY: cy,
          };
          potentialAddRef.current = null;
          selectRectRef.current = sr;
          setSelectRect(sr);
        }
        return;
      }

      // Priority 3: alt+drag duplicate
      const dd = dupDragRef.current;
      if (dd) {
        const deltaSteps = Math.round((e.clientX - dd.startX) / CELL_W);
        const isDragging = Math.abs(e.clientX - dd.startX) > DRAG_THRESH;
        const next = { ...dd, deltaSteps, isDragging };
        dupDragRef.current = next;
        setDupDrag(next);
        return;
      }

      // Priority 4: rubber-band rect update
      const sr = selectRectRef.current;
      if (sr) {
        const { cx, cy } = getContentCoords(e.clientX, e.clientY);
        const next = { ...sr, currentCX: cx, currentCY: cy };
        selectRectRef.current = next;
        setSelectRect(next);
      }
    };

    const handleUp = (e: MouseEvent) => {
      // Priority 0: velocity lane drag — commit
      const vd = velDragRef.current;
      if (vd) {
        const deltaY = vd.startY - e.clientY;
        const newVel = Math.max(1 / 127, Math.min(1, vd.startVelocity + deltaY / VEL_LANE_H));
        onSetVelocityRef.current(vd.hitId, newVel);
        velDragRef.current = null;
        setVelDrag(null);
        setVelDragLive(new Map());
        return;
      }

      // Priority 1: note drag
      const d = dragRef.current;
      if (d) {
        if (d.isDragging) {
          if (d.mode === "move") {
            const delta = d.currentStep - d.originalStep;
            if (delta !== 0) onMoveHitRef.current(d.hitId, delta * stepTicksRef.current);
          } else {
            if (d.currentDurSteps !== d.originalDurSteps) {
              onSetDurationRef.current(d.hitId, d.currentDurSteps * stepTicksRef.current);
            }
          }
        } else {
          // Simple click without drag: toggle selection
          if (d.wasSelected) {
            setSelectedHitIds((prev) => {
              const next = new Set(prev);
              next.delete(d.hitId);
              return next;
            });
          } else {
            setSelectedHitIds(new Set([d.hitId]));
          }
        }
        dragRef.current = null;
        setDrag(null);
        return;
      }

      // Priority 2: potential add — commit as note creation
      const pa = potentialAddRef.current;
      if (pa) {
        onAddHitRef.current(pa.piece, pa.midi, pa.step * stepTicksRef.current, pa.velocity);
        triggerPreviewRef.current(pa.piece, pa.velocity, pa.step);
        potentialAddRef.current = null;
        return;
      }

      // Priority 3: alt+drag duplicate commit
      const dd = dupDragRef.current;
      if (dd) {
        if (dd.isDragging && dd.deltaSteps !== 0) {
          const deltaTicks = dd.deltaSteps * stepTicksRef.current;
          const newHits: PasteHitDescriptor[] = dd.hits.map((h) => ({
            piece: h.piece, midi: h.midi,
            tick: Math.max(0, h.tick + deltaTicks),
            velocity: h.velocity,
            durationTicks: h.durationTicks,
          }));
          onPasteHitsRef.current(newHits);
        }
        dupDragRef.current = null;
        setDupDrag(null);
        return;
      }

      // Priority 4: rubber-band selection commit
      const sr = selectRectRef.current;
      if (sr) {
        const newSelected = hitsInRect(sr);
        if (e.shiftKey) {
          setSelectedHitIds((prev) => new Set([...prev, ...newSelected]));
        } else {
          setSelectedHitIds(newSelected);
        }
        selectRectRef.current = null;
        setSelectRect(null);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup",   handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup",   handleUp);
    };
  }, [getStepFromClientX, getContentCoords, hitsInRect]);

  // ── Keyboard shortcuts (via centralised hook) ────────────────────────────

  useDrumGridKeyboard({
    selectedHitIdsRef,
    clipboardRef,
    projectRef,
    activeTickRef,
    stepTicksRef,
    scrollRef,
    setSelectedHitIds: (s) => setSelectedHitIds(s),
    onRemoveHit,
    onMoveHit,
    onSetVelocity,
    onPasteHits: (hits) => onPasteHitsRef.current(hits),
    onToggleMute,
    onSetNoteType,
    onUndo,
    onRedo,
  });

  // ── Auto-scroll pendant la lecture ────────────────────────────────────────

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const targetX = activeStep * CELL_W;
    const visible = el.clientWidth;
    const left    = el.scrollLeft;
    if (targetX < left || targetX > left + visible - CELL_W * 8) {
      el.scrollTo({ left: Math.max(0, targetX - visible / 3), behavior: "smooth" });
    }
  }, [activeStep]);

  // ── Handler cellule vide ──────────────────────────────────────────────────

  const handleEmptyCellDown = useCallback((e: React.MouseEvent, piece: DrumPiece, step: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // Clicking empty area always clears current selection
    setSelectedHitIds(new Set());
    const velocity = e.shiftKey ? 0.35 : e.altKey ? 0.95 : 0.75;
    const row      = PIECE_TO_ROW.get(piece)!;
    const { cx, cy } = getContentCoords(e.clientX, e.clientY);
    // Defer: if user just clicks → add note; if user drags → start selection rect
    potentialAddRef.current = {
      piece, midi: row.midi, step, velocity,
      startX: e.clientX, startY: e.clientY,
      startCX: cx, startCY: cy,
    };
  }, [getContentCoords]);

  // ── Handler note existante ────────────────────────────────────────────────

  const handleNoteBodyDown = useCallback((e: React.MouseEvent, hit: DrumHit, step: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.button === 2) {
      onRemoveHit(hit.id);
      setSelectedHitIds((prev) => { const next = new Set(prev); next.delete(hit.id); return next; });
      return;
    }
    if (e.button !== 0) return;

    triggerPreview(hit.piece, hit.velocity, step);

    // Shift+clic → toggle membership in selection (no drag)
    if (e.shiftKey) {
      setSelectedHitIds((prev) => {
        const next = new Set(prev);
        if (next.has(hit.id)) next.delete(hit.id);
        else next.add(hit.id);
        return next;
      });
      return;
    }

    // Alt+drag → duplicate the current selection (or just this note)
    if (e.altKey) {
      const ids      = selectedHitIdsRef.current;
      const targets  = ids.has(hit.id) ? ids : new Set([hit.id]);
      const hitsToMove = projectRef.current.hits.filter((h) => targets.has(h.id));
      const next: DupDragState = { hits: hitsToMove, startX: e.clientX, deltaSteps: 0, isDragging: false };
      dupDragRef.current = next;
      setDupDrag(next);
      return;
    }

    // Normal click: remember whether the note was already selected (for toggle on mouseup)
    const wasSelected = selectedHitIdsRef.current.has(hit.id);
    if (!wasSelected) {
      // Select only this note immediately so the outline appears
      setSelectedHitIds(new Set([hit.id]));
    }

    // Start move drag
    const durSteps = Math.max(1, Math.round(hit.durationTicks / stepTicks));
    const next: DragState = {
      mode: "move",
      hitId: hit.id, piece: hit.piece,
      startX: e.clientX, isDragging: false, wasSelected,
      originalStep: step, currentStep: step,
      originalDurSteps: durSteps, currentDurSteps: durSteps,
    };
    dragRef.current = next;
    setDrag(next);
  }, [onRemoveHit, triggerPreview, stepTicks]);

  const handleResizeDown = useCallback((e: React.MouseEvent, hit: DrumHit) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    const durSteps = Math.max(1, Math.round(hit.durationTicks / stepTicks));
    const step     = Math.round(hit.tick / stepTicks);
    const next: DragState = {
      mode: "resize",
      hitId: hit.id, piece: hit.piece,
      startX: e.clientX, isDragging: false, wasSelected: false,
      originalStep: step, currentStep: step,
      originalDurSteps: durSteps, currentDurSteps: durSteps,
    };
    dragRef.current = next;
    setDrag(next);
  }, [stepTicks]);

  // ── Couleur note ──────────────────────────────────────────────────────────

  const hitColor = (hit: DrumHit, row: (typeof DRUM_ROWS)[number]): string => {
    if (hit.muted) return "#3f3f46";
    if (!heatmap.enabled) return hit.isGhost ? "#3f3f46" : hit.isAccent ? "#fbbf24" : row.color;
    return hit.isGhost
      ? mapVelocityToColorAlpha(hit.velocity, heatmap.sensitivity, 0.5)
      : mapVelocityToColor(hit.velocity, heatmap.sensitivity);
  };

  // ── Largeur visuelle d'une note ───────────────────────────────────────────

  const noteWidthForHit = (hit: DrumHit): number => {
    if (drag?.hitId === hit.id && drag.mode === "resize" && drag.isDragging) {
      return Math.max(1, drag.currentDurSteps) * CELL_W - 2;
    }
    return Math.max(1, Math.round(hit.durationTicks / stepTicks)) * CELL_W - 2;
  };

  // ── Derived values ────────────────────────────────────────────────────────

  // Show velocity slider only when exactly one note is selected
  const selectedHit = selectedHitIds.size === 1
    ? (project.hits.find((h) => h.id === [...selectedHitIds][0]) ?? null)
    : null;

  const totalWidth = totalSteps * CELL_W;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex", flexDirection: "column",
        borderRadius: 10, border: "1px solid var(--sep-2)",
        background: "var(--bg-app)", userSelect: "none", overflow: "hidden",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => { setTooltip(null); setHoverCell(null); }}
    >
      {/* ── Grid ── */}
      <div style={{ display: "flex" }}>

        {/* Labels colonne (fixe) */}
        <div style={{
          width: LABEL_W, flexShrink: 0,
          borderRight: "1px solid var(--sep-2)",
          background: "var(--bg-1)",
        }}>
          <div style={{ height: HEADER_H, borderBottom: "1px solid var(--sep)" }} />
          {DRUM_ROWS.map((row) => (
            <div
              key={row.piece}
              style={{
                height: CELL_H,
                display: "flex", alignItems: "center", justifyContent: "flex-end",
                padding: "0 8px",
                fontSize: 10, fontWeight: 500,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                color: heatmap.enabled ? mapVelocityToColor(0.6, heatmap.sensitivity) : row.color,
              }}
            >
              {row.label}
            </div>
          ))}
        </div>

        {/* Zone scrollable */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowX: "auto", overflowY: "hidden" }}
        >
          {/* position:relative enables absolute overlays (selection rect, dup ghosts) */}
          <div style={{ width: totalWidth, position: "relative" }}>

            {/* Header mesures */}
            <div style={{
              display: "flex", height: HEADER_H,
              borderBottom: "1px solid #52525b",
            }}>
              {Array.from({ length: visibleMeas }, (_, mi) => (
                <div
                  key={mi}
                  style={{
                    position: "relative", display: "flex", alignItems: "center",
                    width: stepsPerMeasure * CELL_W, flexShrink: 0,
                    borderLeft: "2px solid #52525b",
                    padding: "0 4px", fontSize: 10, color: "#71717a",
                    cursor: "pointer",
                  }}
                  title={`Clic = sélectionner mesure ${mi + 1}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const measStart = mi * stepsPerMeasure * stepTicks;
                    const measEnd   = (mi + 1) * stepsPerMeasure * stepTicks;
                    const inMeas = new Set(project.hits.filter((h) => h.tick >= measStart && h.tick < measEnd).map((h) => h.id));
                    if (e.ctrlKey || e.metaKey) {
                      setSelectedHitIds((prev) => new Set([...prev, ...inMeas]));
                    } else {
                      setSelectedHitIds(inMeas);
                    }
                  }}
                >
                  <span>{mi + 1}</span>
                  {Array.from({ length: numerator - 1 }, (_, bi) => (
                    <div
                      key={bi}
                      style={{
                        position: "absolute", top: 0, bottom: 0,
                        left: (bi + 1) * stepsPerBeat * CELL_W,
                        borderLeft: "1px solid #3f3f46",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Lignes instruments */}
            {DRUM_ROWS.map((row) => {
              const rowHits = hitByStep.get(row.piece)!;
              const covered = coverageSet.get(row.piece)!;

              const visibleNotes: Array<{ hit: DrumHit; startStep: number }> = [];
              rowHits.forEach((hit, step) => {
                if (drag?.mode === "move" && drag.hitId === hit.id) return;
                visibleNotes.push({ hit, startStep: step });
              });

              let ghostNote: { hit: DrumHit; startStep: number } | null = null;
              if (drag?.mode === "move" && drag.piece === row.piece) {
                const draggedHit = project.hits.find((h) => h.id === drag.hitId);
                if (draggedHit) ghostNote = { hit: draggedHit, startStep: drag.currentStep };
              }

              return (
                <div
                  key={row.piece}
                  style={{
                    position: "relative",
                    height: CELL_H,
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    overflow: "visible",
                  }}
                >
                  {/* Fond : cellules cliquables */}
                  <div style={{ display: "flex", height: "100%" }}>
                    {Array.from({ length: totalSteps }, (_, step) => {
                      const isActive    = step === activeStep;
                      const isMeasStart = step % stepsPerMeasure === 0;
                      const isBeatStart = !isMeasStart && step % stepsPerBeat === 0;
                      const isEven      = step % 2 === 0;
                      const isHovered   = hoverCell?.piece === row.piece && hoverCell.step === step;
                      const isCovered   = covered.has(step);

                      return (
                        <div
                          key={step}
                          style={{
                            width: CELL_W, height: CELL_H, flexShrink: 0,
                            borderLeft: isMeasStart
                              ? "2px solid #52525b"
                              : isBeatStart
                              ? "1px solid #3f3f46"
                              : "1px solid #27272a",
                            background: isActive
                              ? "rgba(59,130,246,0.13)"
                              : isHovered && !isCovered
                              ? "rgba(255,255,255,0.06)"
                              : !isEven
                              ? "rgba(255,255,255,0.012)"
                              : "transparent",
                            cursor: isCovered ? "default" : "crosshair",
                          }}
                          onMouseDown={(e) => {
                            if (!isCovered) handleEmptyCellDown(e, row.piece, step);
                          }}
                          onMouseEnter={() => setHoverCell({ piece: row.piece, step })}
                          onMouseLeave={() => setHoverCell(null)}
                        />
                      );
                    })}
                  </div>

                  {/* Blocs notes */}
                  {visibleNotes.map(({ hit, startStep }) => {
                    const noteW      = noteWidthForHit(hit);
                    const isSelected = selectedHitIds.has(hit.id);
                    const color      = hitColor(hit, row);
                    const isResizing = drag?.hitId === hit.id && drag.mode === "resize";
                    const isPbPulse  = startStep === activeStep;
                    const isClkPulse = pulse?.piece === row.piece && pulse.step === startStep;
                    const isMoving   = drag?.hitId === hit.id && drag.mode === "move" && drag.isDragging;

                    return (
                      <div
                        key={hit.id}
                        onMouseEnter={() => {
                          setHoverCell({ piece: row.piece, step: startStep });
                          setTooltip({
                            label:    row.label,
                            velocity: Math.round(hit.velocity * 127),
                            type:     hit.isGhost ? "ghost" : hit.isAccent ? "accent" : "normal",
                            dur:      durationLabel(hit.durationTicks, project.ppq),
                          });
                        }}
                        onMouseLeave={() => { setHoverCell(null); setTooltip(null); }}
                        style={{
                          position: "absolute",
                          left: startStep * CELL_W + 1,
                          top: 3,
                          width: noteW,
                          height: CELL_H - 6,
                          borderRadius: 3,
                          background: color,
                          opacity: isMoving ? 0.4 : 1,
                          // Selected: white outline; selected + multi: accent outline
                          outline: isSelected
                            ? selectedHitIds.size > 1
                              ? "2px solid #60a5fa"
                              : "2px solid #fff"
                            : "none",
                          outlineOffset: 1,
                          cursor: "grab",
                          transition: isResizing ? "none" : "opacity 0.15s",
                          display: "flex",
                          alignItems: "center",
                          overflow: "hidden",
                          zIndex: 2,
                        }}
                        className={(isPbPulse || isClkPulse) ? "heatmap-hit-pulse" : undefined}
                        onMouseDown={(e) => handleNoteBodyDown(e, hit, startStep)}
                      >
                        {noteW > 28 && (
                          <span style={{
                            fontSize: 8, fontWeight: 700, paddingLeft: 4,
                            color: hit.muted ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.65)",
                            pointerEvents: "none",
                            overflow: "hidden", whiteSpace: "nowrap",
                            textDecoration: hit.muted ? "line-through" : "none",
                          }}>
                            {durationLabel(hit.durationTicks, project.ppq)}
                          </span>
                        )}
                        {/* Articulation badge */}
                        {hit.noteType === "flam" && (
                          <span style={{
                            position: "absolute", right: RESIZE_W + 2, top: 1,
                            fontSize: 7, fontWeight: 900, color: "#a78bfa",
                            pointerEvents: "none", lineHeight: 1,
                          }}>f</span>
                        )}
                        {hit.noteType === "roll" && (
                          <span style={{
                            position: "absolute", right: RESIZE_W + 2, top: 1,
                            fontSize: 7, fontWeight: 900, color: "#34d399",
                            pointerEvents: "none", lineHeight: 1,
                          }}>≈</span>
                        )}
                        {hit.muted && (
                          <span style={{
                            position: "absolute", right: RESIZE_W + 2, top: 1,
                            fontSize: 7, fontWeight: 900, color: "#f87171",
                            pointerEvents: "none", lineHeight: 1,
                          }}>M</span>
                        )}
                        {hit.probability !== undefined && hit.probability < 100 && (
                          <span style={{
                            position: "absolute", left: 2, bottom: 1,
                            fontSize: 6, color: "rgba(255,255,255,0.7)",
                            pointerEvents: "none", lineHeight: 1,
                          }}>{hit.probability}%</span>
                        )}
                        {/* Handle resize */}
                        <div
                          style={{
                            position: "absolute", right: 0, top: 0, bottom: 0,
                            width: RESIZE_W,
                            cursor: "col-resize",
                            background: "rgba(255,255,255,0.20)",
                            borderRadius: "0 3px 3px 0",
                            opacity: 0,
                            transition: "opacity 0.1s",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
                          onMouseDown={(e) => handleResizeDown(e, hit)}
                        />
                      </div>
                    );
                  })}

                  {/* Fantôme move drag (note originale cachée, preview à destination) */}
                  {ghostNote && (() => {
                    const { hit, startStep } = ghostNote;
                    return (
                      <div
                        key={`ghost-${hit.id}`}
                        style={{
                          position: "absolute",
                          left: startStep * CELL_W + 1,
                          top: 3,
                          width: noteWidthForHit(hit),
                          height: CELL_H - 6,
                          borderRadius: 3,
                          background: hitColor(hit, row),
                          opacity: 0.55,
                          border: "1px dashed rgba(255,255,255,0.4)",
                          pointerEvents: "none",
                          zIndex: 2,
                        }}
                      />
                    );
                  })()}
                </div>
              );
            })}

            {/* ── Alt+drag duplicate ghost notes (overlay sur tout le grid) ── */}
            {dupDrag?.isDragging && DRUM_ROWS.map((row) => {
              const rowIdx      = DRUM_ROWS.indexOf(row);
              const rowGhosts   = dupDrag.hits.filter((h) => h.piece === row.piece);
              if (rowGhosts.length === 0) return null;
              return rowGhosts.map((hit) => {
                const step  = Math.round(hit.tick / stepTicks) + dupDrag.deltaSteps;
                const noteW = Math.max(1, Math.round(hit.durationTicks / stepTicks)) * CELL_W - 2;
                return (
                  <div
                    key={`dupghost-${hit.id}`}
                    style={{
                      position: "absolute",
                      left: step * CELL_W + 1,
                      top: HEADER_H + rowIdx * CELL_H + 3,
                      width: noteW,
                      height: CELL_H - 6,
                      borderRadius: 3,
                      background: hitColor(hit, row),
                      opacity: 0.5,
                      border: "1px dashed rgba(255,255,255,0.55)",
                      pointerEvents: "none",
                      zIndex: 5,
                    }}
                  />
                );
              });
            })}

            {/* ── Lane de vélocité ── */}
            <div style={{
              height: VEL_LANE_H, position: "relative",
              borderTop: "1px solid #3f3f46",
              background: "rgba(0,0,0,0.18)",
            }}>
              {/* axe de référence à mi-hauteur */}
              <div style={{
                position: "absolute", left: 0, right: 0,
                top: VEL_LANE_H / 2,
                borderTop: "1px dashed rgba(255,255,255,0.06)",
                pointerEvents: "none",
              }} />
              {project.hits.map((hit) => {
                const step    = Math.round(hit.tick / stepTicks);
                const liveVel = velDragLive.get(hit.id);
                const vel     = liveVel ?? hit.velocity;
                const barH    = Math.max(2, Math.round(vel * (VEL_LANE_H - 4)));
                const row     = DRUM_ROWS.find((r) => r.piece === hit.piece);
                const isSelected = selectedHitIds.has(hit.id);
                const color   = hit.muted ? "#3f3f46" : isSelected ? "#60a5fa" : (row ? hitColor(hit, row) : "#71717a");
                return (
                  <div
                    key={`vel-${hit.id}`}
                    title={`${hit.piece} — vélocité ${Math.round(vel * 127)}/127${hit.probability !== undefined && hit.probability < 100 ? ` — proba ${hit.probability}%` : ""}`}
                    style={{
                      position: "absolute",
                      left: step * CELL_W + 2,
                      bottom: 2,
                      width: CELL_W - 4,
                      height: barH,
                      background: color,
                      borderRadius: "2px 2px 0 0",
                      opacity: hit.muted ? 0.35 : 1,
                      cursor: "ns-resize",
                      transition: liveVel !== undefined ? "none" : "height 0.1s",
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const next: VelDragState = { hitId: hit.id, startY: e.clientY, startVelocity: hit.velocity };
                      velDragRef.current = next;
                      setVelDrag(next);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Right-click cycles probability: 100 → 75 → 50 → 25 → 100
                      const cur = hit.probability ?? 100;
                      const next = cur === 100 ? 75 : cur === 75 ? 50 : cur === 50 ? 25 : 100;
                      onSetProbability(hit.id, next);
                    }}
                  />
                );
              })}
            </div>

            {/* ── Rectangle de sélection ── */}
            {selectRect && (() => {
              const x1 = Math.min(selectRect.startCX, selectRect.currentCX);
              const x2 = Math.max(selectRect.startCX, selectRect.currentCX);
              const y1 = Math.min(selectRect.startCY, selectRect.currentCY);
              const y2 = Math.max(selectRect.startCY, selectRect.currentCY);
              if (x2 - x1 < 2 && y2 - y1 < 2) return null;
              return (
                <div
                  style={{
                    position: "absolute",
                    left: x1, top: y1,
                    width: x2 - x1, height: y2 - y1,
                    border: "1px solid #3b82f6",
                    background: "rgba(59,130,246,0.09)",
                    pointerEvents: "none",
                    zIndex: 10,
                    borderRadius: 2,
                  }}
                />
              );
            })()}

          </div>
        </div>
      </div>

      {/* ── Barre de statut sélection ── */}
      {selectedHitIds.size > 1 && !selectedHit && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          borderTop: "1px solid var(--sep)", background: "var(--bg-1)",
          padding: "5px 12px", fontSize: 11,
        }}>
          <span style={{
            padding: "1px 8px", borderRadius: 10, fontWeight: 600,
            background: "rgba(59,130,246,0.18)", color: "#60a5fa",
          }}>
            {selectedHitIds.size} notes
          </span>
          <span style={{ color: "var(--tx-4)" }}>
            Ctrl+C copier · Ctrl+D répéter · Alt+Drag dupliquer · Escape désélectionner
          </span>
        </div>
      )}

      {/* ── Bande vélocité (1 note sélectionnée) ── */}
      {selectedHit && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          borderTop: "1px solid var(--sep)", background: "var(--bg-1)",
          padding: "5px 12px", fontSize: 11,
        }}>
          <span style={{ color: "var(--tx-4)", flexShrink: 0 }}>Vélocité</span>
          <input
            type="range" min={1} max={127}
            value={Math.round(selectedHit.velocity * 127)}
            onChange={(e) => onSetVelocity(selectedHit.id, Number(e.target.value) / 127)}
            style={{
              flex: 1,
              accentColor: heatmap.enabled
                ? mapVelocityToColor(selectedHit.velocity, heatmap.sensitivity)
                : "#3b82f6",
            }}
          />
          <span style={{
            width: 28, textAlign: "right", fontFamily: "monospace", fontWeight: 600,
            color: heatmap.enabled
              ? mapVelocityToColor(selectedHit.velocity, heatmap.sensitivity)
              : "var(--tx-1)",
          }}>
            {Math.round(selectedHit.velocity * 127)}
          </span>
          <span style={{ color: "var(--tx-4)" }}>
            {selectedHit.muted ? "muet" : selectedHit.isGhost ? "ghost" : selectedHit.isAccent ? "accent" : "normal"}
            {selectedHit.noteType && selectedHit.noteType !== "normal" && ` · ${selectedHit.noteType}`}
            {" · "}
            {durationLabel(selectedHit.durationTicks, project.ppq)}
          </span>
          {/* Probability control */}
          <span style={{ color: "var(--tx-4)", marginLeft: 8 }}>Proba</span>
          <input
            type="range" min={0} max={100} step={5}
            value={selectedHit.probability ?? 100}
            onChange={(e) => onSetProbability(selectedHit.id, Number(e.target.value))}
            style={{ width: 72, accentColor: "#a78bfa" }}
            title="Probabilité de déclenchement"
          />
          <span style={{ width: 30, fontFamily: "monospace", fontSize: 10, color: "var(--tx-2)" }}>
            {selectedHit.probability ?? 100}%
          </span>
          <span style={{ marginLeft: "auto", color: "var(--tx-4)", fontFamily: "monospace", fontSize: 10 }}>
            {PIECE_TO_ROW.get(selectedHit.piece)?.label} · tick {selectedHit.tick}
          </span>
        </div>
      )}

      {/* ── Légende ── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "2px 12px",
        borderTop: "1px solid var(--sep)", background: "var(--bg-app)",
        padding: "5px 12px", fontSize: 10, color: "var(--tx-4)",
      }}>
        {/* Souris */}
        <span>Clic = ajouter</span>
        <span>Clic droit = supprimer</span>
        <span>Shift+clic = ghost / +sélect.</span>
        <span>Alt+clic = accent</span>
        <span>Drag = déplacer</span>
        <span>Alt+drag = dupliquer</span>
        <span>▶| = étirer</span>
        <span style={{ opacity: 0.2, userSelect: "none" }}>│</span>
        {/* Clavier */}
        <span>Del = supprimer</span>
        <span>Ctrl+A = tout sélect.</span>
        <span>Clic mesure = sélect. mesure</span>
        <span>Esc = désélect.</span>
        <span>← → = déplacer</span>
        <span>↑ ↓ = rangée</span>
        <span>Shift+↑↓ = vélocité ±10</span>
        <span>Q = quantizer</span>
        <span>M = mute</span>
        <span>F = flam</span>
        <span>R = roll</span>
        <span>Ctrl+Z / Y = annuler / rétablir</span>
        <span>Ctrl+C / V / D = copier / coller / répéter</span>
        <span>Space = lecture</span>
        <span style={{ color: "var(--tx-3)" }}>Clic droit barre vélo = proba</span>
      </div>

      {/* ── Tooltip flottant ── */}
      {tooltip && hoverCell && (() => {
        const el = scrollRef.current;
        if (!el) return null;
        const rect   = el.getBoundingClientRect();
        const step   = hoverCell.step;
        const x      = rect.left + step * CELL_W - el.scrollLeft + CELL_W + 6;
        const rowIdx = DRUM_ROWS.findIndex((r) => r.piece === hoverCell.piece);
        const y      = rect.top + HEADER_H + rowIdx * CELL_H - 36;
        return (
          <div
            style={{
              position: "fixed", zIndex: 9999,
              left: x, top: y,
              padding: "5px 9px", borderRadius: 7,
              background: "var(--bg-3)", border: "1px solid var(--sep-2)",
              boxShadow: "var(--shadow-md)", fontSize: 11,
              pointerEvents: "none",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--tx-1)" }}>{tooltip.label}</span>
            <span style={{ marginLeft: 8, fontFamily: "monospace", color: "var(--tx-2)" }}>
              {tooltip.velocity}
            </span>
            <span style={{ marginLeft: 2, color: "var(--tx-4)" }}>/ 127</span>
            <span style={{ marginLeft: 6, color: "var(--accent)" }}>{tooltip.dur}</span>
            <span style={{ marginLeft: 6, color: "var(--tx-4)" }}>{tooltip.type}</span>
          </div>
        );
      })()}
    </div>
  );
};
