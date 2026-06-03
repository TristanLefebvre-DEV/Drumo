/**
 * Drummer Visualizer
 *
 * 2D top-down visualization of the drum kit with animated limb positions.
 * Shows:
 *   - stylized kit layout (pieces as labelled shapes)
 *   - 4 limb dots that move to active pieces in real time
 *   - hit glow effects on active instruments
 *   - educational mode: natural limb labels + ergonomics score overlay
 *
 * Canvas-based, GPU-accelerated via requestAnimationFrame.
 * Zero physics — lightweight spatial simulation only.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useProjectStore } from "../../store/projectStore";
import {
  buildBodyTimeline,
  KIT_POSITIONS,
  type BodyFrame,
} from "../../simulation/drummerBodyEngine";
import { getLimbSnapshots } from "../../simulation/limbTracker";
import { analyzeErgonomics } from "../../simulation/ergonomicsEngine";
import { NATURAL_LIMB } from "../../analysis/ergonomicRules";
import { LIMB_COLOR, type Limb } from "../../analysis/limbAnalyzer";
import type { DrumPiece } from "../../core/types";

// ─── Canvas coordinate system ──────────────────────────────────────────────────
// Kit space: x ∈ [-7, 8]  y ∈ [-5.5, 5.5]  (15 × 11 units)

const CX_MIN = -7;
const CX_MAX =  8;
const CY_MIN = -5.5;
const CY_MAX =  5.5;
const CW     = CX_MAX - CX_MIN;
const CH     = CY_MAX - CY_MIN;

const toScreen = (kx: number, ky: number, w: number, h: number) => ({
  sx: ((kx - CX_MIN) / CW) * w,
  sy: ((CY_MAX - ky) / CH) * h,
});

// ─── Visual piece config ───────────────────────────────────────────────────────

interface PieceVisual {
  rx:       number;    // half-width in kit units
  ry:       number;    // half-height in kit units
  baseColor: string;   // hex
  label:    string;
  isCymbal: boolean;
}

const PV: Record<DrumPiece, PieceVisual> = {
  snare:       { rx: 0.70, ry: 0.70, baseColor: "#e2e8f0", label: "SN",  isCymbal: false },
  snareRim:    { rx: 0.70, ry: 0.70, baseColor: "#94a3b8", label: "RIM", isCymbal: false },
  kick:        { rx: 1.10, ry: 1.10, baseColor: "#1e3a5f", label: "BD",  isCymbal: false },
  kick2:       { rx: 1.10, ry: 1.10, baseColor: "#1e4a6f", label: "BD2", isCymbal: false },
  hihatClosed: { rx: 0.85, ry: 0.28, baseColor: "#fbbf24", label: "HH",  isCymbal: true  },
  hihatOpen:   { rx: 0.85, ry: 0.28, baseColor: "#fcd34d", label: "HHo", isCymbal: true  },
  hihatPedal:  { rx: 0.45, ry: 0.18, baseColor: "#d97706", label: "HHp", isCymbal: true  },
  tomHigh:     { rx: 0.60, ry: 0.60, baseColor: "#60a5fa", label: "T1",  isCymbal: false },
  tomMid:      { rx: 0.65, ry: 0.65, baseColor: "#818cf8", label: "T2",  isCymbal: false },
  tomLow:      { rx: 0.80, ry: 0.80, baseColor: "#a78bfa", label: "FT",  isCymbal: false },
  ride:        { rx: 1.30, ry: 0.42, baseColor: "#f59e0b", label: "RD",  isCymbal: true  },
  crash:       { rx: 1.10, ry: 0.36, baseColor: "#fb923c", label: "CR",  isCymbal: true  },
  splash:      { rx: 0.65, ry: 0.22, baseColor: "#f97316", label: "SP",  isCymbal: true  },
  otherCymbal: { rx: 0.65, ry: 0.22, baseColor: "#c084fc", label: "CY",  isCymbal: true  },
};

const LIMBS: readonly Limb[] = ["RH", "LH", "RF", "LF"];

// ─── Component ────────────────────────────────────────────────────────────────

interface DrummerVisualizerProps {
  showEducationalMode?: boolean;
}

export const DrummerVisualizer = ({ showEducationalMode = false }: DrummerVisualizerProps) => {
  const { project, limbMap, isPlaying } = useProjectStore();

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef       = useRef(0);

  // Pre-compute body timeline (re-runs only when project / limbMap changes)
  const bodyTimeline = useMemo((): BodyFrame[] => {
    if (!project) return [];
    return buildBodyTimeline(project.hits, limbMap, project.ppq, project.tempoBpm);
  }, [project, limbMap]);

  // Ergonomics (shown in educational mode, cheap to compute once)
  const ergonomics = useMemo(() => {
    if (!project || Object.keys(limbMap).length === 0) return null;
    return analyzeErgonomics(project.hits, limbMap, project.ppq, project.tempoBpm);
  }, [project, limbMap]);

  // ── Draw ──────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const w   = container.offsetWidth;
    const h   = container.offsetHeight;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width        = Math.round(w * dpr);
      canvas.height       = Math.round(h * dpr);
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = "#1c1c1e";
    ctx.lineWidth   = 0.5;
    for (let gx = CX_MIN; gx <= CX_MAX; gx += 2) {
      const { sx } = toScreen(gx, 0, w, h);
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
    }
    for (let gy = CY_MIN; gy <= CY_MAX; gy += 2) {
      const { sy } = toScreen(0, gy, w, h);
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
    }

    // Drummer silhouette (bottom center)
    const { sx: dsx, sy: dsy } = toScreen(0, CY_MIN + 0.5, w, h);
    ctx.fillStyle = "#27272a";
    ctx.beginPath();
    ctx.arc(dsx, dsy, Math.min(w, h) * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle  = "#52525b";
    ctx.font       = `bold ${Math.max(8, Math.round(Math.min(w, h) * 0.025))}px monospace`;
    ctx.textAlign  = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("YOU", dsx, dsy);

    // Read active tick from store without subscribing (avoids stale closure in rAF)
    const { activeTick } = useProjectStore.getState();

    // Active pieces (glow trigger)
    const nearHits  = project?.hits.filter((h) => Math.abs(h.tick - activeTick) <= 15) ?? [];
    const activePcs = new Set(nearHits.map((h) => h.piece));

    // Scale factors for ellipse radii
    const scaleX = w / CW;
    const scaleY = h / CH;

    // ── Draw kit pieces ────────────────────────────────────────────────────

    for (const [piece, vis] of Object.entries(PV) as [DrumPiece, PieceVisual][]) {
      const pos            = KIT_POSITIONS[piece];
      const { sx, sy }     = toScreen(pos.x, pos.y, w, h);
      const erx            = vis.rx * scaleX * 0.72;
      const ery            = vis.ry * scaleY * 0.72;
      const isActive       = activePcs.has(piece);
      const col            = vis.baseColor;

      ctx.save();
      if (isActive) {
        ctx.shadowColor = col;
        ctx.shadowBlur  = 20;
      }

      if (vis.isCymbal) {
        ctx.strokeStyle = isActive ? col : col + "99";
        ctx.fillStyle   = isActive ? col + "35" : "transparent";
        ctx.lineWidth   = isActive ? 2.5 : 1.5;
      } else {
        ctx.fillStyle   = isActive ? col + "cc" : col + "22";
        ctx.strokeStyle = isActive ? col         : col + "55";
        ctx.lineWidth   = isActive ? 2.0 : 1.0;
      }

      ctx.beginPath();
      ctx.ellipse(sx, sy, Math.max(erx, 3), Math.max(ery, 2), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Piece label
      const fs = Math.max(7, Math.round(Math.min(erx, ery) * 0.85));
      ctx.fillStyle    = isActive ? "#ffffff" : col + "aa";
      ctx.font         = `bold ${fs}px monospace`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(vis.label, sx, sy);

      // Educational: show natural limb assignment
      if (showEducationalMode) {
        const naturalLimb = NATURAL_LIMB[piece];
        const lc          = LIMB_COLOR[naturalLimb];
        ctx.fillStyle     = lc.hex + "cc";
        ctx.font          = `${Math.max(7, fs - 2)}px monospace`;
        ctx.textAlign     = "left";
        ctx.textBaseline  = "alphabetic";
        ctx.fillText(naturalLimb, sx + erx + 3, sy - 2);
      }

      ctx.restore();
    }

    // ── Draw limbs ─────────────────────────────────────────────────────────

    const snapshots = getLimbSnapshots(bodyTimeline, activeTick);
    const isFoot    = (l: Limb) => l === "RF" || l === "LF";

    for (const limb of LIMBS) {
      const snap           = snapshots[limb];
      const { sx, sy }     = toScreen(snap.x, snap.y, w, h);
      const col            = LIMB_COLOR[limb].hex;
      const r              = Math.max(5, Math.min(w, h) * (isFoot(limb) ? 0.022 : 0.028));

      ctx.save();

      if (snap.isActive) {
        ctx.shadowColor = col;
        ctx.shadowBlur  = 16;
      }

      // Outer ring (always visible at rest)
      ctx.strokeStyle = col + (snap.isActive ? "ff" : "50");
      ctx.lineWidth   = snap.isActive ? 2 : 1;
      ctx.beginPath();
      ctx.arc(sx, sy, r + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Fill
      ctx.fillStyle = snap.isActive ? col : col + "55";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Limb label
      ctx.fillStyle    = snap.isActive ? "#fff" : col + "cc";
      ctx.font         = `bold ${Math.max(7, Math.round(r * 0.75))}px monospace`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(limb, sx, sy);

      ctx.restore();
    }

    // ── Educational overlay ────────────────────────────────────────────────

    if (showEducationalMode && ergonomics) {
      const boxW = Math.min(180, w * 0.35);
      const boxH = 90;
      const boxX = w - boxW - 8;
      const boxY = 8;

      ctx.fillStyle   = "#18181b" + "e0";
      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle    = "#e4e4e7";
      ctx.font         = `bold ${Math.max(9, Math.round(w * 0.022))}px monospace`;
      ctx.textAlign    = "left";
      ctx.textBaseline = "top";
      ctx.fillText("Ergonomics", boxX + 8, boxY + 8);

      const scoreColor = ergonomics.overallScore >= 70 ? "#4ade80"
        : ergonomics.overallScore >= 40 ? "#facc15"
        : "#f87171";

      ctx.font      = `bold ${Math.max(18, Math.round(w * 0.04))}px monospace`;
      ctx.fillStyle = scoreColor;
      ctx.fillText(`${ergonomics.overallScore}`, boxX + 8, boxY + 26);

      ctx.font      = `${Math.max(8, Math.round(w * 0.018))}px monospace`;
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText("/ 100", boxX + 8 + ctx.measureText(`${ergonomics.overallScore}`).width + 4, boxY + 32);

      ctx.font      = `${Math.max(7, Math.round(w * 0.016))}px sans-serif`;
      ctx.fillStyle = "#71717a";
      const summaryWords = ergonomics.summary.split(" ");
      let line = "";
      let lineY = boxY + 54;
      for (const word of summaryWords) {
        const test = line + word + " ";
        if (ctx.measureText(test).width > boxW - 16 && line !== "") {
          ctx.fillText(line.trim(), boxX + 8, lineY);
          line   = word + " ";
          lineY += 12;
          if (lineY > boxY + boxH - 6) break;
        } else {
          line = test;
        }
      }
      if (lineY <= boxY + boxH - 6) ctx.fillText(line.trim(), boxX + 8, lineY);
    }
  }, [project, bodyTimeline, ergonomics, showEducationalMode]);

  // ── rAF loop ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isPlaying) {
      const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop); };
      rafRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(rafRef.current);
    }
    draw();
    return undefined;
  }, [isPlaying, draw, bodyTimeline]);

  // Re-draw on activeTick change when NOT playing (scrubbing)
  const { activeTick } = useProjectStore();
  useEffect(() => {
    if (!isPlaying) draw();
  }, [activeTick, isPlaying, draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(container);
    return () => obs.disconnect();
  }, [draw]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/70 px-3 py-1.5">
        <span className="text-[11px] font-semibold text-zinc-300">Body Simulation</span>

        {/* Limb legend */}
        <div className="flex items-center gap-3 ml-2">
          {LIMBS.map((l) => (
            <div key={l} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: LIMB_COLOR[l].hex }}
              />
              <span className="text-[10px] text-zinc-500">{l}</span>
            </div>
          ))}
        </div>

        {/* Status */}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-zinc-600">
          {showEducationalMode && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-400">
              Mode éducatif
            </span>
          )}
          {project && bodyTimeline.length > 0 && (
            <span>{bodyTimeline.length} frames</span>
          )}
          {!project && (
            <span className="text-zinc-700">Charge un fichier MIDI pour voir le corps en action</span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1">
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Empty-state overlay */}
        {!project && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-4xl opacity-20">🥁</div>
              <p className="text-xs text-zinc-600">Importe un MIDI pour activer la simulation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
