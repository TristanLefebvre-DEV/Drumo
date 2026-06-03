import { mapVelocityToColor } from "./velocityColor";
import type { GrooveGrid } from "./grooveGrid";
import type { HeatmapOpts } from "./renderTypes";
import type { DrumRow } from "../core/drumGrid";

export type DrummerViewMode = "compact" | "detailed";

export const COMPACT_PIECES = ["crash", "hihatOpen", "hihatClosed", "snare", "kick"] as const;

export interface DrummerRenderConfig {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  grid: GrooveGrid;
  rows: DrumRow[];
  activeStep: number;
  scrollLeft: number;
  cellW: number;
  rowH: number;
  heatmap: HeatmapOpts;
  mode: DrummerViewMode;
}

const LABEL_W = 84;
const HEADER_H = 28;

// ─── Colour helpers ───────────────────────────────────────────────────────────

const hexToRgb = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

const cellColor = (velocity: number, rowColor: string, heatmap: HeatmapOpts, alpha = 1): string => {
  if (heatmap.enabled) {
    const base = mapVelocityToColor(velocity, heatmap.sensitivity);
    if (alpha < 1) return base.replace("rgb(", "rgba(").replace(")", `,${alpha})`);
    return base;
  }
  const [r, g, b] = hexToRgb(rowColor);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ─── Symbol drawing ───────────────────────────────────────────────────────────

const drawCross = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
  ctx.beginPath();
  ctx.moveTo(cx - size, cy - size);
  ctx.lineTo(cx + size, cy + size);
  ctx.moveTo(cx + size, cy - size);
  ctx.lineTo(cx - size, cy + size);
  ctx.stroke();
};

const drawCircle = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: boolean) => {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (fill) ctx.fill();
  else ctx.stroke();
};

const drawHitSymbol = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  isCymbal: boolean,
  velocity: number,
  isGhost: boolean,
  isAccent: boolean,
  isFlam: boolean,
  isDouble: boolean,
  rowColor: string,
  heatmap: HeatmapOpts
) => {
  const alpha = isGhost ? 0.35 : 1.0;
  const color = cellColor(velocity, rowColor, heatmap, alpha);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = isGhost ? 1 : 1.5;

  if (isCymbal) {
    const size = isAccent ? 6 : isGhost ? 4 : 5;
    drawCross(ctx, cx, cy, size);
    if (isAccent) {
      // outer ring for accent
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      drawCircle(ctx, cx, cy, size + 3, false);
      ctx.globalAlpha = 1;
    }
  } else {
    const r = isAccent ? 6.5 : isGhost ? 4 : 5.5;
    if (isGhost) {
      drawCircle(ctx, cx, cy, r, false);
    } else {
      drawCircle(ctx, cx, cy, r, true);
      if (isAccent) {
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = color;
        drawCircle(ctx, cx, cy, r + 3.5, false);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Flam indicator: small dot offset to the left
  if (isFlam) {
    ctx.fillStyle = cellColor(velocity * 0.6, rowColor, heatmap, 0.7);
    ctx.beginPath();
    ctx.arc(cx - (isCymbal ? 8 : 8), cy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Double-kick indicator: small "2" superscript
  if (isDouble) {
    ctx.fillStyle = cellColor(velocity, rowColor, heatmap, 0.85);
    ctx.font = "bold 7px 'Segoe UI', sans-serif";
    ctx.fillText("2", cx + 5, cy - 4);
  }
};

// ─── Main render ─────────────────────────────────────────────────────────────

export const renderDrummerView = ({
  ctx,
  width,
  height,
  grid,
  rows,
  activeStep,
  scrollLeft,
  cellW,
  rowH,
  heatmap,
  mode,
}: DrummerRenderConfig) => {
  const gridW = width - LABEL_W;

  // Clear
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, width, height);

  // ── Clipped scrollable area ─────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(LABEL_W, 0, gridW, height);
  ctx.clip();

  const ox = LABEL_W - scrollLeft; // origin offset

  // Row backgrounds (alternating)
  rows.forEach((_row, ri) => {
    const y = HEADER_H + ri * rowH;
    ctx.fillStyle = ri % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent";
    ctx.fillRect(ox, y, grid.totalSteps * cellW, rowH);
  });

  // Measure / beat vertical lines + header numbers
  const totalW = grid.totalSteps * cellW;
  for (let step = 0; step <= grid.totalSteps; step++) {
    const x = ox + step * cellW;
    if (x < LABEL_W - cellW || x > width + cellW) continue; // cull offscreen

    const isMeasure = step % grid.stepsPerMeasure === 0;
    const isBeat = !isMeasure && step % grid.stepsPerBeat === 0;
    const isHalf = !isMeasure && !isBeat && step % grid.stepsPerHalfBeat === 0;

    if (isMeasure) {
      ctx.strokeStyle = "rgba(82,82,91,0.9)";
      ctx.lineWidth = 1.5;
    } else if (isBeat) {
      ctx.strokeStyle = "rgba(63,63,70,0.8)";
      ctx.lineWidth = 1;
    } else if (isHalf) {
      ctx.strokeStyle = "rgba(39,39,42,0.7)";
      ctx.lineWidth = 0.5;
    } else {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(x, isMeasure ? 0 : HEADER_H);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Measure number in header
    if (isMeasure) {
      const measureNum = step / grid.stepsPerMeasure + 1;
      ctx.fillStyle = "#52525b";
      ctx.font = "10px 'Segoe UI', sans-serif";
      ctx.fillText(String(measureNum), x + 3, HEADER_H - 8);

      // Beat ticks in header
      for (let b = 1; b < (grid.stepsPerMeasure / grid.stepsPerBeat); b++) {
        const bx = ox + (step + b * grid.stepsPerBeat) * cellW;
        ctx.fillStyle = "rgba(63,63,70,0.6)";
        ctx.fillRect(bx - 0.5, HEADER_H - 6, 1, 6);
      }
    }
  }

  // Horizontal row separator lines
  rows.forEach((_, ri) => {
    const y = HEADER_H + ri * rowH;
    ctx.strokeStyle = "rgba(39,39,42,0.8)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + totalW, y);
    ctx.stroke();
  });

  // Active beat column highlight
  const beatHighlightX = ox + (Math.floor(activeStep / grid.stepsPerBeat) * grid.stepsPerBeat) * cellW;
  ctx.fillStyle = "rgba(59,130,246,0.05)";
  ctx.fillRect(beatHighlightX, HEADER_H, grid.stepsPerBeat * cellW, height - HEADER_H);

  // Hit symbols
  ctx.save();
  for (const [step, cells] of grid.cellsByStep) {
    const sx = ox + step * cellW + cellW / 2;
    for (const cell of cells) {
      const ri = rows.findIndex((r) => r.piece === cell.piece);
      if (ri === -1) continue;
      const sy = HEADER_H + ri * rowH + rowH / 2;
      const row = rows[ri];
      const isCymbal = ["crash", "ride", "splash", "otherCymbal", "hihatOpen", "hihatClosed", "hihatPedal"].includes(cell.piece);
      drawHitSymbol(ctx, sx, sy, isCymbal, cell.velocity, cell.isGhost, cell.isAccent, cell.isFlam, cell.isDouble, row.color, heatmap);
    }
  }
  ctx.restore();

  // Playback cursor — glowing vertical line
  const cursorX = ox + activeStep * cellW;
  const gradient = ctx.createLinearGradient(cursorX - 5, 0, cursorX + 5, 0);
  gradient.addColorStop(0, "rgba(96,165,250,0)");
  gradient.addColorStop(0.5, "rgba(96,165,250,0.85)");
  gradient.addColorStop(1, "rgba(96,165,250,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(cursorX - 5, HEADER_H, 10, height - HEADER_H);

  // Cursor tick in header
  ctx.fillStyle = "#60a5fa";
  ctx.fillRect(cursorX - 1, 0, 2, HEADER_H);

  ctx.restore(); // end clipped area

  // ── Fixed label column ──────────────────────────────────────────────────
  // Background (covers overflowing grid content)
  ctx.fillStyle = "#111113";
  ctx.fillRect(0, 0, LABEL_W, height);

  // Header background
  ctx.fillStyle = "#0d0d10";
  ctx.fillRect(0, 0, LABEL_W, HEADER_H);
  ctx.strokeStyle = "rgba(63,63,70,0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(LABEL_W, HEADER_H);
  ctx.stroke();

  // Right border of label column
  ctx.strokeStyle = "rgba(63,63,70,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LABEL_W, 0);
  ctx.lineTo(LABEL_W, height);
  ctx.stroke();

  // Instrument labels
  rows.forEach((row, ri) => {
    const y = HEADER_H + ri * rowH;
    const cy = y + rowH / 2;

    // Row background tint
    const [r, g, b] = hexToRgb(row.color);
    ctx.fillStyle = `rgba(${r},${g},${b},0.06)`;
    ctx.fillRect(0, y, LABEL_W, rowH);

    // Color dot
    ctx.fillStyle = heatmap.enabled ? mapVelocityToColor(0.6, heatmap.sensitivity) : row.color;
    ctx.beginPath();
    ctx.arc(10, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Label text
    ctx.fillStyle = heatmap.enabled ? mapVelocityToColor(0.6, heatmap.sensitivity) : row.color;
    ctx.font = `${mode === "compact" ? "12" : "11"}px 'Segoe UI', sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(row.label, 20, cy);
  });

  // Mode label in header corner
  ctx.fillStyle = "#3f3f46";
  ctx.font = "9px 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(mode === "compact" ? "COMPACT" : "DÉTAILLÉ", 6, HEADER_H / 2);
};
