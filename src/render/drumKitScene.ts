import type { DrumPiece } from "../core/types";
import type { AnimState } from "./drumAnimator";

export interface SceneOptions {
  performanceMode: boolean;
  showLabels: boolean;
  time: number; // elapsed seconds (for vibration oscillations)
}

// ─── Layout ──────────────────────────────────────────────────────────────────

interface KitPiece {
  piece: DrumPiece;
  cx: number; // 0-1 fraction of canvas width
  cy: number; // 0-1 fraction of canvas height
  rw: number; // x-radius as fraction of width
  rh: number; // y-radius as fraction of height (= rw for toms/kick)
  kind: "cymbal" | "tom" | "kick" | "pedal" | "hihat";
  color: string;
  glowColor: string;
  label: string;
  z: number; // draw order (0 = back)
}

// Positions designed for a front-facing drum kit perspective
const KIT: KitPiece[] = [
  { piece: "kick",        cx: 0.49, cy: 0.70, rw: 0.162, rh: 0.195, kind: "kick",   color: "#3b0a0a", glowColor: "#f87171", label: "Kick",     z: 0 },
  { piece: "tomLow",      cx: 0.74, cy: 0.47, rw: 0.090, rh: 0.090, kind: "tom",    color: "#0a2015", glowColor: "#2dd4bf", label: "Tom L",    z: 1 },
  { piece: "hihatPedal",  cx: 0.22, cy: 0.78, rw: 0.048, rh: 0.048, kind: "pedal",  color: "#0a1525", glowColor: "#93c5fd", label: "Pedal",    z: 1 },
  { piece: "snare",       cx: 0.25, cy: 0.53, rw: 0.092, rh: 0.092, kind: "tom",    color: "#1c0d04", glowColor: "#fb923c", label: "Snare",    z: 2 },
  { piece: "snareRim",    cx: 0.25, cy: 0.53, rw: 0.092, rh: 0.092, kind: "tom",    color: "#1c1004", glowColor: "#fbbf24", label: "",         z: 2 },
  { piece: "tomHigh",     cx: 0.38, cy: 0.40, rw: 0.082, rh: 0.082, kind: "tom",    color: "#062010", glowColor: "#4ade80", label: "Tom H",    z: 3 },
  { piece: "tomMid",      cx: 0.55, cy: 0.39, rw: 0.082, rh: 0.082, kind: "tom",    color: "#061a12", glowColor: "#34d399", label: "Tom M",    z: 3 },
  { piece: "hihatClosed", cx: 0.24, cy: 0.30, rw: 0.072, rh: 0.022, kind: "hihat",  color: "#0a1830", glowColor: "#7dd3fc", label: "HH",       z: 4 },
  { piece: "crash",       cx: 0.13, cy: 0.24, rw: 0.094, rh: 0.026, kind: "cymbal", color: "#1a0820", glowColor: "#e879f9", label: "Crash",    z: 5 },
  { piece: "splash",      cx: 0.47, cy: 0.18, rw: 0.058, rh: 0.018, kind: "cymbal", color: "#150a20", glowColor: "#c084fc", label: "Splash",   z: 5 },
  { piece: "ride",        cx: 0.80, cy: 0.26, rw: 0.100, rh: 0.030, kind: "cymbal", color: "#10082a", glowColor: "#a78bfa", label: "Ride",     z: 5 },
  { piece: "otherCymbal", cx: 0.62, cy: 0.21, rw: 0.062, rh: 0.020, kind: "cymbal", color: "#120a25", glowColor: "#8b5cf6", label: "Cym+",     z: 5 },
];

// ─── Drawing helpers ──────────────────────────────────────────────────────────

const setGlow = (ctx: CanvasRenderingContext2D, color: string, radius: number) => {
  ctx.shadowColor = color;
  ctx.shadowBlur = radius;
};
const clearGlow = (ctx: CanvasRenderingContext2D) => {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
};

const hexToRgb = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
};

const blend = (a: string, b: string, t: number): string => {
  const ra = parseInt(a.slice(1, 3), 16), ga = parseInt(a.slice(3, 5), 16), ba = parseInt(a.slice(5, 7), 16);
  const rb = parseInt(b.slice(1, 3), 16), gb = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ra + (rb - ra) * t);
  const g = Math.round(ga + (gb - ga) * t);
  const bl = Math.round(ba + (bb - ba) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
};

// ─── Piece drawers ────────────────────────────────────────────────────────────

const drawCymbal = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rw: number, rh: number,
  impact: number, velocity: number, glowColor: string, baseColor: string,
  vibTime: number, perf: boolean
) => {
  const vib = impact * Math.sin(vibTime * 38) * rh * 0.35;
  const scale = 1 + impact * velocity * 0.05;
  const fill = blend(baseColor, glowColor, impact * velocity * 0.65);
  const rgb = hexToRgb(glowColor);

  if (!perf && impact > 0.05) setGlow(ctx, glowColor, impact * velocity * 40);

  // Main body
  ctx.save();
  ctx.translate(cx, cy + vib);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb}, ${0.5 + impact * 0.5})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bell (center dome)
  ctx.beginPath();
  ctx.ellipse(0, 0, rw * 0.18, rh * 1.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = blend(baseColor, glowColor, 0.4 + impact * 0.5);
  ctx.fill();
  ctx.restore();

  clearGlow(ctx);
};

const drawTom = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  impact: number, velocity: number, glowColor: string, baseColor: string,
  perf: boolean
) => {
  const bounce = impact * velocity * r * 0.04;
  const scale = 1 + impact * velocity * 0.07;
  const rgb = hexToRgb(glowColor);

  // Shell shadow (depth)
  ctx.beginPath();
  ctx.arc(cx, cy + bounce + r * 0.08, r * 1.06, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,0.7)`;
  ctx.fill();

  if (!perf && impact > 0.05) setGlow(ctx, glowColor, impact * velocity * 36);

  // Shell
  ctx.save();
  ctx.translate(cx, cy + bounce);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = baseColor;
  ctx.fill();

  // Head (drum skin)
  const headBrightness = impact * velocity;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  const headGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r * 0.88);
  headGrad.addColorStop(0, `rgba(${rgb},${0.25 + headBrightness * 0.75})`);
  headGrad.addColorStop(0.6, `rgba(${rgb},${0.08 + headBrightness * 0.4})`);
  headGrad.addColorStop(1, `rgba(${rgb},0.04)`);
  ctx.fillStyle = headGrad;
  ctx.fill();

  // Rim
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${rgb},${0.3 + headBrightness * 0.6})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tension rods
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#2a2a35";
    ctx.fill();
  }
  ctx.restore();
  clearGlow(ctx);
};

const drawKick = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rw: number, rh: number,
  impact: number, velocity: number, glowColor: string,
  perf: boolean
) => {
  const pulse = 1 + impact * velocity * 0.06;
  const rgb = hexToRgb(glowColor);

  // Floor shadow
  ctx.beginPath();
  ctx.ellipse(cx, cy + rh * 0.95, rw * 0.85, rh * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fill();

  if (!perf && impact > 0.05) setGlow(ctx, glowColor, impact * velocity * 50);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);

  // Outer hoop
  ctx.beginPath();
  ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#0a0a12";
  ctx.fill();
  ctx.strokeStyle = "#1a1a28";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner rim ring
  ctx.beginPath();
  ctx.ellipse(0, 0, rw * 0.91, rh * 0.91, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#20202f";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Drum head
  const headGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rw * 0.75);
  headGrad.addColorStop(0,   `rgba(${rgb},${0.08 + impact * velocity * 0.6})`);
  headGrad.addColorStop(0.5, `rgba(${rgb},${0.04 + impact * velocity * 0.3})`);
  headGrad.addColorStop(1,   `rgba(${rgb},0.02)`);
  ctx.beginPath();
  ctx.ellipse(0, 0, rw * 0.78, rh * 0.78, 0, 0, Math.PI * 2);
  ctx.fillStyle = headGrad;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},${0.3 + impact * velocity * 0.6})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Kick ripple rings (expand outward on impact)
  if (impact > 0.1) {
    for (let ring = 0; ring < 3; ring++) {
      const phase = (1 - impact) + ring * 0.2;
      const ringR = rw * 0.4 * (0.6 + phase * 0.8);
      const alpha = impact * velocity * (1 - ring * 0.3) * 0.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, ringR, ringR * (rh / rw), 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rgb},${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Logo dot
  ctx.beginPath();
  ctx.ellipse(0, 0, rw * 0.2, rh * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#060610";
  ctx.fill();
  ctx.restore();
  clearGlow(ctx);

  // Bass drum legs (hardware)
  ctx.strokeStyle = "#1a1a22";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - rw * 0.6, cy + rh * 0.8);
  ctx.lineTo(cx - rw * 0.8, cy + rh * 1.3);
  ctx.moveTo(cx + rw * 0.6, cy + rh * 0.8);
  ctx.lineTo(cx + rw * 0.8, cy + rh * 1.3);
  ctx.stroke();
};

const drawHiHat = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rw: number, rh: number,
  impact: number, velocity: number, glowColor: string, baseColor: string,
  hihatOpenAmount: number, vibTime: number, perf: boolean
) => {
  const openGap = hihatOpenAmount * rh * 2.5;
  const vib = impact * Math.sin(vibTime * 40) * rh * 0.3;
  const fill = blend(baseColor, glowColor, impact * velocity * 0.6);
  const rgb = hexToRgb(glowColor);

  if (!perf && impact > 0.05) setGlow(ctx, glowColor, impact * velocity * 35);

  // Bottom cymbal (fixed)
  ctx.beginPath();
  ctx.ellipse(cx, cy + rh * 0.5, rw * 0.92, rh * 0.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},0.4)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Top cymbal (moves with open state)
  const topCy = cy - openGap + vib;
  ctx.beginPath();
  ctx.ellipse(cx, topCy, rw, rh, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},${0.4 + impact * velocity * 0.5})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bell on top cymbal
  ctx.beginPath();
  ctx.ellipse(cx, topCy, rw * 0.2, rh * 1.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = blend(baseColor, glowColor, 0.5 + impact * 0.4);
  ctx.fill();

  // Stand rod
  ctx.strokeStyle = "#1a1a26";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy + rh);
  ctx.lineTo(cx, cy + rh * 8);
  ctx.stroke();

  clearGlow(ctx);
};

const drawPedal = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  impact: number, velocity: number, glowColor: string,
  perf: boolean
) => {
  const rgb = hexToRgb(glowColor);
  if (!perf && impact > 0.05) setGlow(ctx, glowColor, impact * velocity * 25);

  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb},${0.08 + impact * velocity * 0.3})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},${0.3 + impact * velocity * 0.6})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pedal rod up to hi-hat
  ctx.strokeStyle = "#1a1a26";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.35);
  ctx.lineTo(cx, cy - r * 6);
  ctx.stroke();

  clearGlow(ctx);
};

// ─── Hit test ────────────────────────────────────────────────────────────────

/**
 * Returns the DrumPiece at canvas position (x, y) for a canvas of size (w, h).
 * Hit areas are expanded beyond the visual size so thin cymbals are easy to click.
 */
export const hitTestPiece = (x: number, y: number, w: number, h: number): DrumPiece | null => {
  const nx = x / w;
  const ny = y / h;

  // Test highest z-order first (cymbals on top)
  const sorted = [...KIT].sort((a, b) => b.z - a.z);

  for (const kp of sorted) {
    const isCymbalKind = kp.kind === "cymbal" || kp.kind === "hihat";
    // Expand hit area: cymbals are visually thin, so we widen the y-tolerance
    const hitRw = kp.rw * (isCymbalKind ? 1.0 : 1.25);
    const hitRh = isCymbalKind ? Math.max(0.055, kp.rh * 3.5) : kp.rh * 1.25;

    const dx = (nx - kp.cx) / hitRw;
    const dy = (ny - kp.cy) / hitRh;

    if (dx * dx + dy * dy <= 1) {
      // For hihat area, always return hihatClosed as the canonical trigger
      if (kp.piece === "hihatClosed") return "hihatClosed";
      return kp.piece;
    }
  }
  return null;
};

// ─── Main scene renderer ──────────────────────────────────────────────────────

export const drawScene = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: AnimState,
  opts: SceneOptions
): void => {
  // Background
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, w * 0.65);
  bg.addColorStop(0, "#0c0c18");
  bg.addColorStop(1, "#020206");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Stage light cone
  const light = ctx.createRadialGradient(w * 0.5, 0, 0, w * 0.5, h * 0.5, w * 0.55);
  light.addColorStop(0, "rgba(255,248,220,0.04)");
  light.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, h);

  // Floor line
  ctx.strokeStyle = "#111120";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.88);
  ctx.lineTo(w, h * 0.88);
  ctx.stroke();

  // Draw pieces in z-order
  const sorted = [...KIT].sort((a, b) => a.z - b.z);

  const px = (v: number) => v * w;
  const py = (v: number) => v * h;

  for (const kp of sorted) {
    const s = state.pieces.get(kp.piece) ?? { impact: 0, velocity: 0 };
    const cx = px(kp.cx), cy = py(kp.cy);
    const rw = px(kp.rw), rh = py(kp.rh);

    switch (kp.kind) {
      case "cymbal":
        drawCymbal(ctx, cx, cy, rw, rh, s.impact, s.velocity, kp.glowColor, kp.color, opts.time, opts.performanceMode);
        break;
      case "tom":
        if (kp.piece !== "snareRim") // snare rim uses same position, skip duplicate draw
          drawTom(ctx, cx, cy, rw, s.impact, s.velocity, kp.glowColor, kp.color, opts.performanceMode);
        break;
      case "kick":
        drawKick(ctx, cx, cy, rw, rh, s.impact, s.velocity, kp.glowColor, opts.performanceMode);
        break;
      case "hihat":
        if (kp.piece === "hihatClosed") // draw hihat once
          drawHiHat(ctx, cx, cy, rw, rh,
            Math.max(s.impact, (state.pieces.get("hihatOpen") ?? { impact: 0 }).impact),
            Math.max(s.velocity, (state.pieces.get("hihatOpen") ?? { velocity: 0 }).velocity),
            kp.glowColor, kp.color, state.hihatOpenAmount, opts.time, opts.performanceMode);
        break;
      case "pedal":
        drawPedal(ctx, cx, cy, rw, s.impact, s.velocity, kp.glowColor, opts.performanceMode);
        break;
    }

    // Labels
    if (opts.showLabels && kp.label) {
      ctx.fillStyle = `rgba(${hexToRgb(kp.glowColor)},${0.35 + s.impact * 0.55})`;
      ctx.font = `${Math.round(w * 0.018)}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(kp.label, cx, cy + rh + py(0.025));
    }
  }
};
