/**
 * Energy Timeline
 *
 * Horizontal bar that visualises musical energy across the entire piece.
 *   • Smooth bezier area chart with a vertical colour gradient
 *     (blue = calm, orange = building, red = intense/peak)
 *   • Musical section labels (verse, chorus, breakdown…) at the bottom
 *   • AI suggestion markers (triangles) at the corresponding measure
 *   • Playback cursor + click-to-seek
 *   • Right panel: global stats (trend, avg, peak)
 *
 * Performance: pure SVG, no canvas. Handles ≤ 400 measures without lag.
 */

import { useMemo } from "react";
import { detectMusicalSections, MUSICAL_ROLE_LABELS } from "../../analysis/sectionEnergyDetector";
import type { EnergyFlow } from "../../analysis/energyFlowAnalyzer";
import type { Section } from "../../analysis/sectionAnalyzer";
import type { TimeSignature } from "../../core/types";

// ─── Layout constants (viewBox coords) ────────────────────────────────────────

const VW      = 1000;  // viewBox width
const CH      = 58;    // chart area height (curve drawn here)
const LH      = 17;    // label row height below chart
const VH      = CH + LH;
const PAD_T   = 5;     // top padding inside chart area
const CURVE_H = CH - PAD_T;   // usable height for curve

// ─── Coordinate mapping ────────────────────────────────────────────────────────

const mx = (measureIndex: number, total: number): number =>
  total <= 1 ? 0 : (measureIndex / (total - 1)) * VW;

const my = (score: number): number =>
  CH - PAD_T - (score / 100) * CURVE_H + PAD_T;

// ─── Smooth bezier path (Catmull-Rom → cubic bezier) ─────────────────────────

function smoothPath(pts: { x: number; y: number }[], tension = 0.32): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + tension * (p2.x - p0.x);
    const cp1y = p1.y + tension * (p2.y - p0.y);
    const cp2x = p2.x - tension * (p3.x - p1.x);
    const cp2y = p2.y - tension * (p3.y - p1.y);

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface EnergyTimelineProps {
  energyFlow:      EnergyFlow;
  sections:        Section[];
  activeTick:      number;
  totalMeasures:   number;
  ppq:             number;
  timeSignature:   TimeSignature;
  onSeekToMeasure: (measure: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EnergyTimeline = ({
  energyFlow,
  sections,
  activeTick,
  totalMeasures,
  ppq,
  timeSignature,
  onSeekToMeasure,
}: EnergyTimelineProps) => {
  const { measures, peakMeasure, avgScore, globalTrend, suggestions } = energyFlow;
  const n = measures.length;

  const musicalSections = useMemo(
    () => detectMusicalSections(sections, measures),
    [sections, measures]
  );

  // Pre-compute SVG path data
  const { strokePath, areaPath } = useMemo(() => {
    if (n === 0 || totalMeasures === 0) return { strokePath: "", areaPath: "" };
    const pts = measures.map((m) => ({ x: mx(m.measureIndex, totalMeasures), y: my(m.score) }));
    const stroke = smoothPath(pts);
    const area   = `${stroke} L ${pts[n - 1].x.toFixed(1)} ${CH} L ${pts[0].x.toFixed(1)} ${CH} Z`;
    return { strokePath: stroke, areaPath: area };
  }, [measures, n, totalMeasures]);

  if (n === 0 || totalMeasures === 0) return null;

  // Playback cursor position
  const ticksPerMeasure = ppq * timeSignature.numerator;
  const activeMeasure   = Math.floor(activeTick / ticksPerMeasure);
  const cursorX         = mx(Math.min(activeMeasure, totalMeasures - 1), totalMeasures);

  // Click-to-seek
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX  = (e.clientX - rect.left) / rect.width;
    onSeekToMeasure(Math.max(0, Math.min(totalMeasures - 1, Math.round(relX * (totalMeasures - 1)))));
  };

  // Trend badge
  const TREND_LABELS: Record<typeof globalTrend, string> = {
    rising:  "↑ Montée",
    falling: "↓ Descente",
    steady:  "→ Stable",
    dynamic: "⚡ Dynamique",
  };
  const TREND_COLORS: Record<typeof globalTrend, string> = {
    rising: "#4ade80", falling: "#94a3b8", steady: "#60a5fa", dynamic: "#f97316",
  };

  return (
    <div className="flex items-stretch gap-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/80">

      {/* Left label */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-r border-zinc-800 px-2.5">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">Energy</span>
        <span
          className="text-[11px] font-bold font-mono"
          style={{ color: avgScore >= 65 ? "#ef4444" : avgScore >= 35 ? "#f97316" : "#3b82f6" }}
        >
          {avgScore}
        </span>
      </div>

      {/* SVG timeline */}
      <div className="relative min-w-0 flex-1">
        <svg
          width="100%"
          height={VH}
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
          className="cursor-pointer select-none"
          onClick={handleClick}
        >
          <defs>
            {/* Vertical gradient: red (top/peak) → orange (mid) → blue (bottom/calm) */}
            <linearGradient id="etg" x1="0" y1="0" x2="0" y2={CH} gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.75" />
              <stop offset="38%"  stopColor="#f97316" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.18" />
            </linearGradient>
            {/* Cursor glow */}
            <filter id="etcursor">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
            </filter>
          </defs>

          {/* 50% reference line */}
          <line
            x1="0"  y1={my(50)}
            x2={VW} y2={my(50)}
            stroke="#3f3f46" strokeWidth="0.4" strokeDasharray="4 5"
          />

          {/* Musical section background shading */}
          {musicalSections.map((ms, i) => {
            const x1 = mx(ms.section.startMeasure, totalMeasures);
            const x2 = mx(ms.section.endMeasure + 1, totalMeasures);
            return (
              <rect
                key={i}
                x={x1} y={0} width={x2 - x1} height={CH}
                fill={ms.color + "09"}
              />
            );
          })}

          {/* Energy area fill */}
          <path d={areaPath} fill="url(#etg)" />

          {/* Energy stroke line */}
          <path
            d={strokePath}
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.7"
            strokeOpacity="0.55"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Section boundary lines */}
          {musicalSections.map((ms, i) => {
            const x = mx(ms.section.startMeasure, totalMeasures);
            return (
              <line
                key={i}
                x1={x} y1={0} x2={x} y2={CH}
                stroke={ms.color + "55"} strokeWidth="0.7"
              />
            );
          })}

          {/* Peak measure marker */}
          {peakMeasure >= 0 && (
            <line
              x1={mx(peakMeasure, totalMeasures)} y1={0}
              x2={mx(peakMeasure, totalMeasures)} y2={CH}
              stroke="#ef444488" strokeWidth="0.6" strokeDasharray="2 2"
            />
          )}

          {/* AI suggestion markers — colored triangles */}
          {suggestions
            .filter((s) => s.priority !== "low")
            .map((s, i) => {
              const x = mx(s.measureIndex, totalMeasures);
              const color = s.priority === "high" ? "#ef4444" : "#f97316";
              return (
                <g key={i} transform={`translate(${x}, ${PAD_T})`}>
                  <title>{s.description}</title>
                  <polygon
                    points="0,-3 3.5,2.5 -3.5,2.5"
                    fill={color}
                    opacity="0.9"
                  />
                </g>
              );
            })}

          {/* Playback cursor */}
          <line
            x1={cursorX} y1={0} x2={cursorX} y2={CH}
            stroke="#60a5fa" strokeWidth="1.2" strokeOpacity="0.85"
          />
          <circle
            cx={cursorX} cy={my(measures[activeMeasure]?.score ?? 0)}
            r="3" fill="#60a5fa" opacity="0.9"
          />

          {/* Section labels in the bottom label row */}
          {musicalSections.map((ms, i) => {
            const x1 = mx(ms.section.startMeasure, totalMeasures);
            const x2 = mx(Math.min(ms.section.endMeasure + 1, totalMeasures - 1), totalMeasures);
            const blockW = x2 - x1;
            if (blockW < VW * 0.04) return null;   // too narrow to show label

            return (
              <text
                key={i}
                x={x1 + blockW / 2}
                y={VH - 4}
                fontSize="7.5"
                fill={ms.color + "cc"}
                textAnchor="middle"
                fontFamily="monospace"
                fontWeight="600"
              >
                {MUSICAL_ROLE_LABELS[ms.musicalRole]}
              </text>
            );
          })}

          {/* Measure number hints every ~16 measures */}
          {Array.from({ length: Math.min(Math.floor(totalMeasures / 16), 15) }, (_, i) => {
            const m = (i + 1) * Math.round(totalMeasures / Math.max(Math.floor(totalMeasures / 16), 1));
            if (m >= totalMeasures) return null;
            return (
              <text
                key={`mn${i}`}
                x={mx(m, totalMeasures)}
                y={CH - 1}
                fontSize="5"
                fill="#52525b"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {m + 1}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Right stats panel */}
      <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 border-l border-zinc-800 px-2.5 text-right">
        <span
          className="text-[9px] font-semibold"
          style={{ color: TREND_COLORS[globalTrend] }}
        >
          {TREND_LABELS[globalTrend]}
        </span>
        <span className="text-[9px] text-zinc-600 font-mono">
          Peak m.{peakMeasure + 1}
        </span>
        {suggestions.filter((s) => s.priority !== "low").length > 0 && (
          <span className="text-[9px] text-amber-500">
            {suggestions.filter((s) => s.priority !== "low").length} tips
          </span>
        )}
      </div>
    </div>
  );
};
