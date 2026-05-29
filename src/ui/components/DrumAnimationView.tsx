import { useCallback, useEffect, useRef, useState } from "react";
import { buildTimeline, getHitsInRange } from "../../render/animationTimeline";
import { createAnimState, decayStateStep, triggerPiece } from "../../render/drumAnimator";
import { drawScene, hitTestPiece } from "../../render/drumKitScene";
import { playDrumSound } from "../../audio/notePreviewEngine";
import { useProjectStore } from "../../store/projectStore";
import type { QuantizedHit, ParsedDrumProject, QuantizeGrid } from "../../core/types";

interface DrumAnimationViewProps {
  project: ParsedDrumProject;
  quantizedHits: QuantizedHit[];
  quantizeGrid: QuantizeGrid;
  isPlaying: boolean;
}

export const DrumAnimationView = ({
  quantizedHits,
  isPlaying,
}: DrumAnimationViewProps) => {
  const [speed, setSpeed] = useState(1.0);
  const [perfMode, setPerfMode] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animStateRef = useRef(createAnimState());
  const timelineRef = useRef(buildTimeline(quantizedHits));
  const lastTickRef = useRef(-1);
  const rafRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const timeRef = useRef(0);

  // Stable refs so the rAF loop always reads latest values
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const perfRef = useRef(perfMode);
  perfRef.current = perfMode;
  const labelsRef = useRef(showLabels);
  labelsRef.current = showLabels;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Rebuild timeline when hits change
  useEffect(() => {
    timelineRef.current = buildTimeline(quantizedHits);
    lastTickRef.current = -1;
  }, [quantizedHits]);

  // Reset animation when playback stops
  useEffect(() => {
    if (!isPlaying) {
      lastTickRef.current = -1;
    }
  }, [isPlaying]);

  const renderFrame = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dt = Math.min(0.05, (timestamp - lastTimestampRef.current) / 1000);
    lastTimestampRef.current = timestamp;
    timeRef.current += dt;

    // Resize canvas to container if needed
    const dpr = perfRef.current ? 1 : (window.devicePixelRatio || 1);
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Check for new hits in the current tick window
    if (isPlayingRef.current) {
      const { activeTick } = useProjectStore.getState();
      if (activeTick !== lastTickRef.current) {
        const from = lastTickRef.current;
        const to = activeTick;
        const hits = from >= 0 && to > from
          ? getHitsInRange(timelineRef.current, from, to)
          : from < 0
          ? getHitsInRange(timelineRef.current, to - 10, to)
          : [];
        for (const hit of hits) triggerPiece(animStateRef.current, hit.piece, hit.velocity);
        lastTickRef.current = activeTick;
      }
    }

    // Decay impacts
    decayStateStep(animStateRef.current, dt, speedRef.current);

    // Draw
    drawScene(ctx, w, h, animStateRef.current, {
      performanceMode: perfRef.current,
      showLabels: labelsRef.current,
      time: timeRef.current,
    });
  }, []);

  // rAF loop
  useEffect(() => {
    let alive = true;
    const loop = (ts: number) => {
      if (!alive) return;
      renderFrame(ts);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [renderFrame]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => renderFrame(performance.now()));
    obs.observe(el);
    return () => obs.disconnect();
  }, [renderFrame]);

  // Click on a drum piece → play sound + trigger animation
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const piece = hitTestPiece(x, y, rect.width, rect.height);
    if (!piece) return;
    const velocity = 0.82;
    playDrumSound(piece, velocity);
    triggerPiece(animStateRef.current, piece, velocity);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
      {/* Options toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
        {/* Speed */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500">Decay</span>
          <input
            type="range" min={30} max={300} step={10}
            value={Math.round(speed * 100)}
            onChange={(e) => setSpeed(Number(e.target.value) / 100)}
            className="w-20 accent-violet-500"
          />
          <span className="w-6 text-right text-[11px] tabular-nums text-zinc-300">
            ×{speed.toFixed(1)}
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-700/60" />

        {/* Performance mode */}
        <button
          type="button"
          onClick={() => setPerfMode((p) => !p)}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium transition ${
            perfMode
              ? "border-amber-600/50 bg-amber-900/25 text-amber-300"
              : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${perfMode ? "bg-amber-400" : "bg-zinc-600"}`} />
          Perf Mode
        </button>

        {/* Labels toggle */}
        <button
          type="button"
          onClick={() => setShowLabels((l) => !l)}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium transition ${
            showLabels
              ? "border-zinc-500 bg-zinc-700 text-zinc-100"
              : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Labels
        </button>

        {/* Playing indicator */}
        <div className="ml-auto flex items-center gap-1.5 text-[11px]">
          <span className={`h-2 w-2 rounded-full ${isPlaying ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
          <span className="text-zinc-500">{isPlaying ? "Live" : "Cliquer sur un instrument"}</span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-pointer"
          onClick={handleCanvasClick}
          title="Cliquer sur un instrument pour le jouer"
        />
      </div>
    </div>
  );
};
