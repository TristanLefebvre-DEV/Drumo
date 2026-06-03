/**
 * CircularRhythmView — premium canvas-based animated rhythm wheel.
 *
 * Uses requestAnimationFrame + AudioContext.currentTime for drift-free sync.
 * Never drives audio — reads position from PatternEngine.getCurrentPosition().
 */

import { useEffect, useRef, useState } from "react";
import { patternEngine } from "../../audio/patternEngine";
import type { RhythmPattern, StepAccent } from "../../audio/patternEngine";

const TAU     = Math.PI * 2;
const HALF_PI = Math.PI / 2;

// ─── Premium colour palette ───────────────────────────────────────────────────

const P = {
  // Background
  bgOuter:       "#0b0b0e",
  bgInner:       "#14141a",

  // Track ring segments
  trackBase:     "rgba(255,255,255,0.028)",
  trackBeat1:    "rgba(96,165,250,0.072)",
  trackActive:   "rgba(255,255,255,0.092)",
  trackActBt1:   "rgba(96,165,250,0.185)",

  // Ring boundary lines
  ringEdgeOuter: "rgba(255,255,255,0.055)",
  ringEdgeInner: "rgba(255,255,255,0.040)",

  // Beat boundary ticks
  tick1:         "#60a5fa",
  tickMajor:     "rgba(255,255,255,0.28)",
  tickMinor:     "rgba(255,255,255,0.08)",

  // Subdivision dots
  dotStrong:     "#4ade80",
  dotAccent:     "#60a5fa",
  dotNormal:     "rgba(255,255,255,0.56)",
  dotGhost:      "rgba(255,255,255,0.20)",
  dotInactive:   "rgba(255,255,255,0.055)",

  // Center disc
  discRim:       "rgba(255,255,255,0.070)",

  // Typography
  bpmColor:      "#f2f2f7",
  bpmUnit:       "rgba(255,255,255,0.20)",
  sigColor:      "rgba(255,255,255,0.28)",
  beatColor:     "#60a5fa",
  labelActive:   "rgba(255,255,255,0.80)",
  labelInactive: "rgba(255,255,255,0.17)",
} as const;

const DOT_COLOR: Record<StepAccent, string> = {
  strong: P.dotStrong,
  accent: P.dotAccent,
  normal: P.dotNormal,
  ghost:  P.dotGhost,
};

const DOT_RMULT: Record<StepAccent, number> = {
  strong: 1.20,
  accent: 1.00,
  normal: 0.80,
  ghost:  0.55,
};

// ─── Geometry helper ──────────────────────────────────────────────────────────

/**
 * Fills a closed annular sector path: the area between two concentric arcs.
 * Call ctx.fill() or ctx.stroke() after.
 */
function annularSector(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rOuter: number, rInner: number,
  aStart: number, aEnd: number,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, aStart, aEnd, false); // outer arc, clockwise
  ctx.arc(cx, cy, rInner, aEnd, aStart, true);  // inner arc, counter-clockwise
  ctx.closePath();
}

// ─── Core draw function ───────────────────────────────────────────────────────

interface DrawProps {
  ctx2d:        CanvasRenderingContext2D;
  pattern:      RhythmPattern | null;
  loopProgress: number;
  currentBeat:  number;
  currentStep:  number;
  isPlaying:    boolean;
  bpm:          number;
  size:         number;
}

function drawWheel({
  ctx2d: ctx, pattern, loopProgress, currentBeat, currentStep,
  isPlaying, bpm, size,
}: DrawProps): void {
  const cx  = size / 2;
  const cy  = size / 2;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── Background ────────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, size, size);
  const bgGrd = ctx.createRadialGradient(cx, cy * 0.50, 0, cx, cy, size * 0.52);
  bgGrd.addColorStop(0, P.bgInner);
  bgGrd.addColorStop(1, P.bgOuter);
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, TAU);
  ctx.fillStyle = bgGrd;
  ctx.fill();

  if (!pattern) {
    drawIdle(ctx, cx, cy, size, bpm);
    return;
  }

  // ── Geometry ──────────────────────────────────────────────────────────────
  const rOut   = size * 0.455;  // outer edge of track ring
  const rIn    = size * 0.308;  // inner edge of track ring
  const rDot   = size * 0.382;  // subdivision dot radius
  const rDisc  = size * 0.252;  // center disc radius
  const rTickO = size * 0.482;  // beat-1 tick outer tip
  const rLabel = size * 0.500;  // beat number label anchor
  const ringW  = rOut - rIn;

  // Measure layout
  const measure  = pattern.measures[0];
  const numBeats = measure.signature.numerator;

  const beatStart: number[] = [];
  let totalSteps = 0;
  for (let bi = 0; bi < numBeats; bi++) {
    beatStart.push(totalSteps);
    totalSteps += measure.beats[bi].subdivisions || 1;
  }
  const stepToAngle = (s: number): number => -HALF_PI + (s / totalSteps) * TAU;

  // ── Layer 1 — Track ring segments ─────────────────────────────────────────
  for (let bi = 0; bi < numBeats; bi++) {
    const subs   = measure.beats[bi].subdivisions || 1;
    const aStart = stepToAngle(beatStart[bi]);
    const aEnd   = stepToAngle(beatStart[bi] + subs);
    const isFirst  = bi === 0;
    const isActive = isPlaying && currentBeat === bi;

    const fill = isActive && isFirst ? P.trackActBt1
               : isActive            ? P.trackActive
               : isFirst             ? P.trackBeat1
               :                       P.trackBase;

    annularSector(ctx, cx, cy, rOut, rIn, aStart, aEnd);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // ── Layer 2 — Ring boundary lines ─────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(cx, cy, rOut, 0, TAU);
  ctx.strokeStyle = P.ringEdgeOuter;
  ctx.lineWidth   = 0.75;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, rIn, 0, TAU);
  ctx.strokeStyle = P.ringEdgeInner;
  ctx.lineWidth   = 0.5;
  ctx.stroke();

  // ── Layer 3 — Beat tick marks & labels ────────────────────────────────────
  ctx.lineCap = "round";
  for (let bi = 0; bi < numBeats; bi++) {
    const subs   = measure.beats[bi].subdivisions || 1;
    const aStart = stepToAngle(beatStart[bi]);
    const aEnd   = stepToAngle(beatStart[bi] + subs);
    const isFirst  = bi === 0;
    const isActive = isPlaying && currentBeat === bi;

    // Beat boundary radial tick
    const tickOuter = isFirst ? rTickO : rOut;
    ctx.beginPath();
    ctx.moveTo(cx + rIn      * Math.cos(aStart), cy + rIn      * Math.sin(aStart));
    ctx.lineTo(cx + tickOuter * Math.cos(aStart), cy + tickOuter * Math.sin(aStart));
    ctx.strokeStyle = isFirst ? P.tick1 : P.tickMajor;
    ctx.lineWidth   = isFirst ? 2.0 : 1.0;
    ctx.stroke();

    // Beat 1 accent dot at outer tip
    if (isFirst) {
      ctx.beginPath();
      ctx.arc(cx + rTickO * Math.cos(aStart), cy + rTickO * Math.sin(aStart), 3.5, 0, TAU);
      ctx.fillStyle = P.tick1;
      ctx.fill();
    }

    // Beat number label
    const midA = (aStart + aEnd) / 2;
    ctx.fillStyle    = isActive ? P.labelActive : P.labelInactive;
    ctx.font         = `${isActive ? 600 : 400} ${size * 0.044}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(bi + 1), cx + rLabel * Math.cos(midA), cy + rLabel * Math.sin(midA));
  }

  // ── Layer 4 — Subdivision minor ticks ────────────────────────────────────
  for (let bi = 0; bi < numBeats; bi++) {
    const subs = measure.beats[bi].subdivisions || 1;
    for (let si = 1; si < subs; si++) {
      const a  = stepToAngle(beatStart[bi] + si);
      const r1 = rIn;
      const r2 = rIn + ringW * 0.28;
      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
      ctx.strokeStyle = P.tickMinor;
      ctx.lineWidth   = 0.75;
      ctx.stroke();
    }
  }

  // ── Layer 5 — Subdivision dots ────────────────────────────────────────────
  for (let bi = 0; bi < numBeats; bi++) {
    const beat = measure.beats[bi];
    const subs = beat.subdivisions || 1;
    for (let si = 0; si < subs; si++) {
      const a    = stepToAngle(beatStart[bi] + si + 0.5);
      const step = beat.steps[si];
      if (!step) continue;

      const dx = cx + rDot * Math.cos(a);
      const dy = cy + rDot * Math.sin(a);
      const isActiveStep = isPlaying && currentBeat === bi && currentStep === si;

      if (!step.active) {
        ctx.beginPath();
        ctx.arc(dx, dy, size * 0.010, 0, TAU);
        ctx.fillStyle = P.dotInactive;
        ctx.fill();
        continue;
      }

      const baseR = isActiveStep ? size * 0.034 : size * 0.020;
      const dotR  = baseR * DOT_RMULT[step.accent];

      if (isActiveStep) {
        // Glow halo
        const glowR = dotR * 4.2;
        const grd   = ctx.createRadialGradient(dx, dy, 0, dx, dy, glowR);
        if (step.accent === "strong") {
          grd.addColorStop(0, "rgba(74,222,128,0.45)");
          grd.addColorStop(1, "rgba(74,222,128,0)");
        } else if (step.accent === "accent") {
          grd.addColorStop(0, "rgba(96,165,250,0.45)");
          grd.addColorStop(1, "rgba(96,165,250,0)");
        } else {
          grd.addColorStop(0, "rgba(255,255,255,0.30)");
          grd.addColorStop(1, "rgba(255,255,255,0)");
        }
        ctx.beginPath();
        ctx.arc(dx, dy, glowR, 0, TAU);
        ctx.fillStyle = grd;
        ctx.fill();

        // Bright white core
        ctx.beginPath();
        ctx.arc(dx, dy, dotR, 0, TAU);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(dx, dy, dotR, 0, TAU);
        ctx.fillStyle = DOT_COLOR[step.accent];
        ctx.fill();
      }
    }
  }

  // ── Layer 6 — Cursor (drawn before disc so disc clips inner area) ─────────
  if (isPlaying) {
    const ca = -HALF_PI + loopProgress * TAU;

    // Comet trail — linear gradient arc along the dot ring
    const trailLen = 0.092 * TAU;
    const tStart   = ca - trailLen;
    const tx1 = cx + rDot * Math.cos(tStart);
    const ty1 = cy + rDot * Math.sin(tStart);
    const tx2 = cx + rDot * Math.cos(ca);
    const ty2 = cy + rDot * Math.sin(ca);
    const trailGrd = ctx.createLinearGradient(tx1, ty1, tx2, ty2);
    trailGrd.addColorStop(0,   "rgba(255,255,255,0)");
    trailGrd.addColorStop(0.5, "rgba(255,255,255,0.05)");
    trailGrd.addColorStop(1,   "rgba(255,255,255,0.20)");
    ctx.beginPath();
    ctx.arc(cx, cy, rDot, tStart, ca);
    ctx.strokeStyle = trailGrd;
    ctx.lineWidth   = ringW * 0.52;
    ctx.lineCap     = "butt";
    ctx.stroke();

    // Radial cursor needle (from just outside disc to outer ring)
    ctx.beginPath();
    ctx.moveTo(
      cx + (rDisc + size * 0.022) * Math.cos(ca),
      cy + (rDisc + size * 0.022) * Math.sin(ca),
    );
    ctx.lineTo(cx + rOut * Math.cos(ca), cy + rOut * Math.sin(ca));
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = "round";
    ctx.stroke();

    // Cursor head — radial glow at outer ring
    const hx  = cx + rOut * Math.cos(ca);
    const hy  = cy + rOut * Math.sin(ca);
    const gr  = size * 0.052;
    const hGrd = ctx.createRadialGradient(hx, hy, 0, hx, hy, gr);
    hGrd.addColorStop(0,    "rgba(255,255,255,0.88)");
    hGrd.addColorStop(0.22, "rgba(255,255,255,0.35)");
    hGrd.addColorStop(1,    "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(hx, hy, gr, 0, TAU);
    ctx.fillStyle = hGrd;
    ctx.fill();

    // Bright tip dot
    ctx.beginPath();
    ctx.arc(hx, hy, 2.8, 0, TAU);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  // ── Layer 7 — Center disc (drawn last to cover cursor in center area) ─────
  const discGrd = ctx.createRadialGradient(cx, cy - rDisc * 0.18, 0, cx, cy, rDisc);
  discGrd.addColorStop(0, "#1e1e28");
  discGrd.addColorStop(1, "#0d0d12");
  ctx.beginPath();
  ctx.arc(cx, cy, rDisc, 0, TAU);
  ctx.fillStyle = discGrd;
  ctx.fill();

  // Disc rim
  ctx.beginPath();
  ctx.arc(cx, cy, rDisc, 0, TAU);
  ctx.strokeStyle = P.discRim;
  ctx.lineWidth   = 1;
  ctx.stroke();

  // ── Layer 8 — Center typography ───────────────────────────────────────────
  const bpmY = isPlaying ? cy - size * 0.055 : cy - size * 0.020;

  // BPM number (hero)
  ctx.fillStyle    = P.bpmColor;
  ctx.font         = `700 ${size * 0.122}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(bpm), cx, bpmY);

  // Time signature
  const sigStr = `${measure.signature.numerator}/${measure.signature.denominator}`;
  ctx.fillStyle = P.sigColor;
  ctx.font      = `500 ${size * 0.046}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(sigStr, cx, bpmY + size * 0.100);

  // Current beat counter (playing only)
  if (isPlaying) {
    ctx.fillStyle = P.beatColor;
    ctx.font      = `600 ${size * 0.040}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(String(currentBeat + 1), cx, bpmY + size * 0.170);
  }
}

// ─── Idle state (no pattern loaded) ──────────────────────────────────────────

function drawIdle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number, bpm: number,
): void {
  const rOut  = size * 0.455;
  const rIn   = size * 0.308;
  const rDisc = size * 0.252;

  // Annular ring fill (evenodd punches inner hole)
  ctx.beginPath();
  ctx.arc(cx, cy, rOut, 0, TAU);
  ctx.arc(cx, cy, rIn,  0, TAU);
  ctx.fillStyle = P.trackBase;
  ctx.fill("evenodd");

  // Ring edges
  ctx.beginPath();
  ctx.arc(cx, cy, rOut, 0, TAU);
  ctx.strokeStyle = P.ringEdgeOuter;
  ctx.lineWidth   = 0.75;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, rIn, 0, TAU);
  ctx.strokeStyle = P.ringEdgeInner;
  ctx.lineWidth   = 0.5;
  ctx.stroke();

  // 12 tick marks
  const ringW = rOut - rIn;
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a       = -HALF_PI + (i / 12) * TAU;
    const isMajor = i % 3 === 0;
    const isFirst = i === 0;
    const r1 = isMajor ? rIn : rIn + ringW * 0.15;
    const r2 = isMajor
      ? (isFirst ? rOut + size * 0.026 : rOut)
      : rOut - ringW * 0.15;

    ctx.beginPath();
    ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
    ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
    ctx.strokeStyle = isFirst ? P.tick1 : isMajor ? P.tickMajor : P.tickMinor;
    ctx.lineWidth   = isFirst ? 2.0 : isMajor ? 1.25 : 0.75;
    ctx.stroke();

    if (isFirst) {
      ctx.beginPath();
      ctx.arc(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a), 3.5, 0, TAU);
      ctx.fillStyle = P.tick1;
      ctx.fill();
    }
  }

  // Center disc
  const dGrd = ctx.createRadialGradient(cx, cy - rDisc * 0.18, 0, cx, cy, rDisc);
  dGrd.addColorStop(0, "#1e1e28");
  dGrd.addColorStop(1, "#0d0d12");
  ctx.beginPath();
  ctx.arc(cx, cy, rDisc, 0, TAU);
  ctx.fillStyle = dGrd;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, rDisc, 0, TAU);
  ctx.strokeStyle = P.discRim;
  ctx.lineWidth   = 1;
  ctx.stroke();

  // BPM
  ctx.fillStyle    = P.bpmColor;
  ctx.font         = `700 ${size * 0.130}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(bpm), cx, cy - size * 0.022);

  ctx.fillStyle = P.bpmUnit;
  ctx.font      = `500 ${size * 0.042}px -apple-system, system-ui, sans-serif`;
  ctx.fillText("BPM", cx, cy + size * 0.070);
}

// ─── React component ──────────────────────────────────────────────────────────

interface CircularRhythmViewProps {
  size?: number;
  bpm: number;
  isPlaying: boolean;
  onBeatClick?: (beatIndex: number) => void;
}

export const CircularRhythmView = ({
  size = 280,
  bpm,
  isPlaying,
  onBeatClick,
}: CircularRhythmViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const posRef    = useRef({ loopProgress: 0, currentBeat: 0, currentStep: 0 });
  const [pattern, setPattern] = useState<RhythmPattern | null>(patternEngine.pattern);

  useEffect(() => {
    const id = setInterval(() => {
      setPattern(patternEngine.pattern ? { ...patternEngine.pattern } : null);
    }, 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width        = size * dpr;
    canvas.height       = size * dpr;
    canvas.style.width  = `${size}px`;
    canvas.style.height = `${size}px`;

    const draw = () => {
      const pos = patternEngine.getCurrentPosition();
      if (pos) {
        posRef.current = {
          loopProgress: pos.loopProgress,
          currentBeat:  pos.beatIndex,
          currentStep:  pos.stepIndex,
        };
      }
      drawWheel({
        ctx2d,
        pattern,
        loopProgress: posRef.current.loopProgress,
        currentBeat:  posRef.current.currentBeat,
        currentStep:  posRef.current.currentStep,
        isPlaying,
        bpm,
        size,
      });
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pattern, bpm, isPlaying, size]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onBeatClick || !pattern) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x    = e.clientX - rect.left - size / 2;
    const y    = e.clientY - rect.top  - size / 2;
    const dist = Math.sqrt(x * x + y * y);

    const rOut = size * 0.455;
    const rIn  = size * 0.308;
    if (dist < rIn || dist > rOut) return;

    const measure = pattern.measures[0];
    let angle     = Math.atan2(y, x) + HALF_PI;
    if (angle < 0) angle += TAU;

    const beatIndex = Math.floor((angle / TAU) * measure.signature.numerator);
    onBeatClick(Math.min(beatIndex, measure.signature.numerator - 1));
  };

  return (
    <canvas
      ref={canvasRef}
      style={{
        display:      "block",
        borderRadius: "50%",
        cursor:       onBeatClick ? "pointer" : "default",
      }}
      onClick={handleClick}
    />
  );
};
