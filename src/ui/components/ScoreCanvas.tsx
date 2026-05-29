import { useEffect, useRef, useState } from "react";
import { renderStaff } from "../../render/staffRenderer";
import { playDrumSound } from "../../audio/notePreviewEngine";
import { useProjectStore } from "../../store/projectStore";
import { LIMB_COLOR } from "../../analysis/limbAnalyzer";
import { SECTION_COLORS } from "../../analysis/sectionAnalyzer";
import { playabilityColor } from "../../analysis/playabilityEngine";
import type { HeatmapOpts } from "../../render/vexflowAdapter";
import type { CleanupOptions } from "../../render/notationCleanupEngine";
import type { RhythmResult, TimeSignature, DrumHit } from "../../core/types";
import type { LimbMap } from "../../analysis/limbAnalyzer";
import type { PlayabilityMap } from "../../analysis/playabilityEngine";
import type { Section } from "../../analysis/sectionAnalyzer";

interface ScoreCanvasProps {
  rhythm: RhythmResult | null;
  ppq: number;
  signature: TimeSignature;
  activeTick: number;
  zoomX: number;
  zoomY: number;
  heatmap: HeatmapOpts;
  cleanup: CleanupOptions;
  previewEnabled: boolean;
  hits?: DrumHit[];
  limbMap?: LimbMap;
  showLimbAnalysis?: boolean;
  playabilityMap?: PlayabilityMap;
  showPlayabilityOverlay?: boolean;
  sections?: Section[];
  showSectionTimeline?: boolean;
}

// ─── Section Overlay ──────────────────────────────────────────────────────────

interface SectionOverlayProps {
  sections: Section[];
  numerator: number;
  zoomX: number;
  zoomY: number;
  totalWidth: number;
  totalHeight: number;
}

const SectionOverlay = ({
  sections, numerator: _numerator, zoomX, zoomY, totalWidth, totalHeight,
}: SectionOverlayProps) => {
  const measureWidth = 290 * zoomX;
  const rowHeight    = 150 * zoomY;

  return (
    <svg
      className="pointer-events-none absolute top-0 left-0"
      width={totalWidth} height={totalHeight}
      style={{ overflow: "visible" }}
    >
      {sections.map((sec, i) => {
        const { hex } = SECTION_COLORS[sec.type];
        const rects: React.ReactNode[] = [];
        for (let m = sec.startMeasure; m <= sec.endMeasure; m++) {
          const row = Math.floor(m / 4);
          const col = m % 4;
          const x   = ORIGIN_X + col * measureWidth;
          const y   = ORIGIN_Y + row * rowHeight;
          rects.push(
            <rect
              key={`${i}-${m}`}
              x={x} y={y}
              width={measureWidth - 4} height={rowHeight - 6}
              fill={hex} fillOpacity={0.1}
              stroke={hex} strokeOpacity={0.35}
              strokeWidth={1.5} rx={3}
            />
          );
        }
        // Section label on first measure
        const labelRow = Math.floor(sec.startMeasure / 4);
        const labelCol = sec.startMeasure % 4;
        const labelX   = ORIGIN_X + labelCol * measureWidth + 4;
        const labelY   = ORIGIN_Y + labelRow * rowHeight + 12;
        rects.push(
          <text
            key={`lbl-${i}`}
            x={labelX} y={labelY}
            fontSize={8} fontWeight="600"
            fontFamily="system-ui, sans-serif"
            fill={hex} fillOpacity={0.85}
          >
            {SECTION_COLORS[sec.type].label}
          </text>
        );
        return rects;
      })}
    </svg>
  );
};

// ─── Playability Overlay ──────────────────────────────────────────────────────

interface PlayabilityOverlayProps {
  playabilityMap: PlayabilityMap;
  numerator: number;
  zoomX: number;
  zoomY: number;
  totalWidth: number;
  totalHeight: number;
}

const PlayabilityOverlay = ({
  playabilityMap, zoomX, zoomY, totalWidth, totalHeight,
}: PlayabilityOverlayProps) => {
  const measureWidth = 290 * zoomX;
  const rowHeight    = 150 * zoomY;

  return (
    <svg
      className="pointer-events-none absolute top-0 left-0"
      width={totalWidth} height={totalHeight}
      style={{ overflow: "visible" }}
    >
      {Object.entries(playabilityMap).map(([idxStr, entry]) => {
        const m   = Number(idxStr);
        const row = Math.floor(m / 4);
        const col = m % 4;
        const x   = ORIGIN_X + col * measureWidth;
        const y   = ORIGIN_Y + row * rowHeight;
        const bg  = playabilityColor(entry.score);
        const badgeColor =
          entry.level === "impossible" ? "#ef4444" :
          entry.level === "very-hard"  ? "#f97316" : "#eab308";

        return (
          <g key={m}>
            <rect
              x={x} y={y}
              width={measureWidth - 4} height={rowHeight - 6}
              fill={bg} rx={3}
            />
            {/* Score badge at top-right of measure */}
            <rect x={x + measureWidth - 28} y={y + 2} width={22} height={11} rx={3} fill={badgeColor} fillOpacity={0.9} />
            <text
              x={x + measureWidth - 17} y={y + 10}
              textAnchor="middle" fontSize={7} fontWeight="700"
              fontFamily="monospace" fill="white"
            >
              {entry.score}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Limb Overlay ─────────────────────────────────────────────────────────────

/**
 * Renders coloured R/L/RF/LF badges below each note using an SVG overlay
 * positioned inside the same scrollable container as the score.
 *
 * Layout constants mirror staffRenderer.ts so labels align with notes.
 * The staff in VexFlow is ~50px tall; notes and stems extend to ~80px.
 * Labels are placed at STAFF_LABEL_Y_OFFSET below each row start.
 */
const STAFF_LABEL_Y_OFFSET = 98; // px below row start (below lowest note stem)
const LABEL_R  = 8;               // badge circle radius
const LABEL_FS = 7;               // font size inside badge

interface LimbOverlayProps {
  hits: DrumHit[];
  limbMap: LimbMap;
  ppq: number;
  numerator: number;
  zoomX: number;
  zoomY: number;
  totalWidth: number;
  totalHeight: number;
}

const LimbOverlay = ({
  hits, limbMap, ppq, numerator, zoomX, zoomY, totalWidth, totalHeight,
}: LimbOverlayProps) => {
  const measureWidth   = 290 * zoomX;
  const rowHeight      = 150 * zoomY;
  const noteAreaW      = measureWidth - NOTE_PAD_L - NOTE_PAD_R;
  const ticksPerMeasure = ppq * numerator;

  // Group hits by approximate pixel x (same tick = same column)
  // so we can stack multiple labels vertically
  type HitWithPos = { hit: DrumHit; x: number; rowY: number };
  const withPos: HitWithPos[] = hits.map((hit) => {
    const measure      = Math.floor(hit.tick / ticksPerMeasure);
    const row          = Math.floor(measure / 4);
    const col          = measure % 4;
    const tickInMeasure = hit.tick % ticksPerMeasure;
    const frac         = tickInMeasure / ticksPerMeasure;
    const x            = ORIGIN_X + col * measureWidth + NOTE_PAD_L + frac * noteAreaW;
    const rowY         = ORIGIN_Y + row * rowHeight + STAFF_LABEL_Y_OFFSET * zoomY;
    return { hit, x, rowY };
  });

  // Group by (x rounded, rowY) to stack simultaneous hits
  const grouped = new Map<string, HitWithPos[]>();
  for (const item of withPos) {
    const key = `${Math.round(item.x / 2) * 2}_${Math.round(item.rowY)}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  return (
    <svg
      className="pointer-events-none absolute top-0 left-0"
      width={totalWidth}
      height={totalHeight}
      style={{ overflow: "visible" }}
    >
      {[...grouped.values()].map((group) => {
        const baseX = group[0].x;
        const baseY = group[0].rowY;
        return group.map(({ hit }, stackIdx) => {
          const assignment = limbMap[hit.id];
          if (!assignment) return null;
          const { hex } = LIMB_COLOR[assignment.limb];
          const cy = baseY + stackIdx * (LABEL_R * 2 + 2);
          const label = assignment.limb;
          // Opacity encodes confidence: 0.5 → dim, 1.0 → opaque
          const opacity = 0.5 + assignment.confidence * 0.5;
          return (
            <g key={hit.id}>
              {/* Crossover marker: dashed outline ring */}
              {assignment.isCrossover && (
                <circle
                  cx={baseX} cy={cy} r={LABEL_R + 2}
                  fill="none" stroke={hex} strokeWidth={1}
                  strokeDasharray="2 2" opacity={opacity * 0.7}
                />
              )}
              <circle cx={baseX} cy={cy} r={LABEL_R} fill={hex} opacity={opacity} />
              <text
                x={baseX} y={cy + LABEL_FS * 0.4}
                textAnchor="middle"
                fontSize={LABEL_FS}
                fontWeight="700"
                fontFamily="monospace"
                fill="white"
                opacity={opacity}
              >
                {label}
              </text>
            </g>
          );
        });
      })}
    </svg>
  );
};

interface Ripple { x: number; y: number; seq: number }

// Layout constants matching staffRenderer.ts
const ORIGIN_X = 20;
const ORIGIN_Y = 20;
const NOTE_PAD_L = 28;   // approx VexFlow left padding per measure
const NOTE_PAD_R = 18;   // approx VexFlow right padding per measure

/** Compute cursor pixel position for a given tick. Returns null when no project. */
const tickToPixel = (
  tick: number,
  ppq: number,
  numerator: number,
  zoomX: number,
  zoomY: number
): { x: number; y: number; rowH: number } => {
  const measureWidth = 290 * zoomX;
  const rowHeight = 150 * zoomY;
  const noteAreaW = measureWidth - NOTE_PAD_L - NOTE_PAD_R;
  const ticksPerMeasure = ppq * numerator;

  const measure = Math.floor(tick / ticksPerMeasure);
  const row = Math.floor(measure / 4);
  const col = measure % 4;
  const tickInMeasure = tick % ticksPerMeasure;
  const frac = tickInMeasure / ticksPerMeasure;

  const x = ORIGIN_X + col * measureWidth + NOTE_PAD_L + frac * noteAreaW;
  const y = ORIGIN_Y + row * rowHeight;
  return { x, y, rowH: rowHeight };
};

export const ScoreCanvas = ({
  rhythm,
  ppq,
  signature,
  activeTick,
  zoomX,
  zoomY,
  heatmap,
  cleanup,
  previewEnabled,
  hits = [],
  limbMap = {},
  showLimbAnalysis = false,
  playabilityMap = {},
  showPlayabilityOverlay = false,
  sections = [],
  showSectionTimeline = false,
}: ScoreCanvasProps) => {
  const scoreRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const prevRowRef = useRef(-1);
  const tickRef = useRef(activeTick);
  const [ripple, setRipple] = useState<Ripple | null>(null);

  // ── 1. Re-render SVG when score structure changes (not on every tick) ────────
  useEffect(() => {
    if (!scoreRef.current || !rhythm) return;
    renderStaff({ target: scoreRef.current, rhythm, ppq, signature, activeTick: 0, zoomX, zoomY, heatmap, cleanup });
  }, [rhythm, ppq, signature, zoomX, zoomY, heatmap, cleanup]);

  // ── 2. Highlight active note in SVG on tick change (lightweight pass) ────────
  useEffect(() => {
    tickRef.current = activeTick;
    if (!scoreRef.current || !rhythm) return;
    // Decorate existing SVG note elements with active class
    // We re-delegate this to staffRenderer for full correctness
    renderStaff({ target: scoreRef.current, rhythm, ppq, signature, activeTick, zoomX, zoomY, heatmap, cleanup });
  }, [activeTick, rhythm, ppq, signature, zoomX, zoomY, heatmap, cleanup]);

  // ── 3. Smooth cursor overlay via RAF — bypasses React state for 60fps ────────
  const { isPlaying } = useProjectStore();
  useEffect(() => {
    if (!isPlaying) {
      // Position cursor at rest position
      updateCursor(activeTick);
      return;
    }

    let rafId: number;
    const update = () => {
      updateCursor(tickRef.current);
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, ppq, signature.numerator, zoomX, zoomY]);

  const updateCursor = (tick: number) => {
    const el = cursorRef.current;
    const scroll = scrollRef.current;
    if (!el || !scroll) return;

    const { x, y, rowH } = tickToPixel(tick, ppq, signature.numerator, zoomX, zoomY);
    const cursorH = 110 * (zoomY ?? 1);

    el.style.transform = `translate(${x - 1}px, ${y}px)`;
    el.style.height = `${cursorH}px`;
    el.style.opacity = tick === 0 && !isPlaying ? "0" : "1";

    // Auto-scroll: keep current row visible
    const row = Math.floor(Math.floor(tick / (ppq * signature.numerator)) / 4);
    if (row !== prevRowRef.current) {
      prevRowRef.current = row;
      const rowTop = ORIGIN_Y + row * rowH * (zoomY ?? 1);
      const scrollTarget = Math.max(0, rowTop - 40);
      scroll.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
  };

  // ── Click-to-preview ──────────────────────────────────────────────────────────
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rhythm || !previewEnabled) return;
    const inner = scoreRef.current;
    if (!inner) return;
    const rect = inner.getBoundingClientRect();
    const svgX = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    const svgY = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);

    const measureWidth = 290 * zoomX;
    const rowHeight = 150 * zoomY;
    const col = Math.floor((svgX - ORIGIN_X) / measureWidth);
    const row = Math.floor((svgY - ORIGIN_Y) / rowHeight);
    if (col < 0 || col > 3 || row < 0) return;
    const measureIndex = row * 4 + col;
    if (measureIndex >= rhythm.measures.length) return;
    const measure = rhythm.measures[measureIndex];
    if (!measure || measure.chords.length === 0) return;

    const xInMeasure = svgX - ORIGIN_X - col * measureWidth;
    let closestChord = measure.chords[0];
    let minDist = Infinity;
    for (const chord of measure.chords) {
      const frac = chord.tickInMeasure / rhythm.ticksPerMeasure;
      const approxX = NOTE_PAD_L + frac * (measureWidth - NOTE_PAD_L - NOTE_PAD_R);
      const dist = Math.abs(xInMeasure - approxX);
      if (dist < minDist) { minDist = dist; closestChord = chord; }
    }
    for (const hit of closestChord.hits) playDrumSound(hit.piece, hit.velocity);

    const outerRect = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - outerRect.left, y: e.clientY - outerRect.top, seq: Date.now() });
    setTimeout(() => setRipple(null), 450);
  };

  return (
    <div
      className="relative h-full w-full rounded-xl border border-zinc-800 bg-zinc-950/90 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
      onClick={previewEnabled ? handleClick : undefined}
      style={{ cursor: previewEnabled ? "pointer" : "default" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b from-zinc-900/40 to-transparent z-10" />

      {/* Scrollable score */}
      <div ref={scrollRef} className="h-full w-full overflow-auto rounded-lg relative">
        <div ref={scoreRef} className="inline-block min-w-full" />

        {/* Section coloring overlay (behind notes, very low opacity) */}
        {showSectionTimeline && sections.length > 0 && rhythm && (
          <SectionOverlay
            sections={sections}
            numerator={signature.numerator}
            zoomX={zoomX}
            zoomY={zoomY}
            totalWidth={1220 * zoomX}
            totalHeight={Math.max(280, Math.ceil(rhythm.measures.length / 4) * 150 * zoomY)}
          />
        )}

        {/* Playability highlight overlay */}
        {showPlayabilityOverlay && Object.keys(playabilityMap).length > 0 && rhythm && (
          <PlayabilityOverlay
            playabilityMap={playabilityMap}
            numerator={signature.numerator}
            zoomX={zoomX}
            zoomY={zoomY}
            totalWidth={1220 * zoomX}
            totalHeight={Math.max(280, Math.ceil(rhythm.measures.length / 4) * 150 * zoomY)}
          />
        )}

        {/* Limb analysis overlay */}
        {showLimbAnalysis && hits.length > 0 && rhythm && (
          <LimbOverlay
            hits={hits}
            limbMap={limbMap}
            ppq={ppq}
            numerator={signature.numerator}
            zoomX={zoomX}
            zoomY={zoomY}
            totalWidth={1220 * zoomX}
            totalHeight={Math.max(280, Math.ceil(rhythm.measures.length / 4) * 150 * zoomY)}
          />
        )}

        {/* Playhead cursor — animated via RAF, not React state */}
        <div
          ref={cursorRef}
          className="pointer-events-none absolute top-0 left-0 w-0.5 rounded-full bg-blue-400/80 shadow-[0_0_6px_2px_rgba(96,165,250,0.4)] transition-opacity duration-150"
          style={{ opacity: 0, willChange: "transform" }}
        />
      </div>

      {/* Click ripple */}
      {ripple && (
        <div
          key={ripple.seq}
          className="score-click-ripple pointer-events-none absolute h-8 w-8 rounded-full bg-white/25"
          style={{ left: ripple.x, top: ripple.y }}
        />
      )}

      {previewEnabled && (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-zinc-700/40 bg-zinc-900/70 px-2 py-1 text-[10px] text-zinc-500">
          Cliquer sur une note pour la jouer
        </div>
      )}
    </div>
  );
};
