/**
 * Expanded heatmap + sound-preview controls.
 * Rendered below the toolbar when either feature is active.
 * The toggle buttons themselves live in the toolbar (DrumScorePage).
 */

import { heatmapGradientCss, mapVelocityToColor } from "../../render/velocityColor";
import { setPreviewVol } from "../../audio/notePreviewEngine";
import type { VelocityStats } from "../../render/velocityAnalyzer";

interface HeatmapControlsProps {
  heatmapEnabled: boolean;
  sensitivity: number;
  stats: VelocityStats | null;
  previewEnabled: boolean;
  previewVolume: number;
  onSensitivity: (value: number) => void;
  onPreviewVolume: (value: number) => void;
}

export const HeatmapControls = ({
  heatmapEnabled,
  sensitivity,
  stats,
  previewEnabled,
  previewVolume,
  onSensitivity,
  onPreviewVolume,
}: HeatmapControlsProps) => {
  if (!heatmapEnabled && !previewEnabled) return null;

  const handlePreviewVolume = (v: number) => {
    setPreviewVol(v);
    onPreviewVolume(v);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-3 py-1.5 text-[11px]">
      {/* ── Heatmap expanded ── */}
      {heatmapEnabled && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-2">
            <span className="text-zinc-600">Sensibilité</span>
            <input
              type="range" min={30} max={200} step={5}
              value={Math.round(sensitivity * 100)}
              onChange={(e) => onSensitivity(Number(e.target.value) / 100)}
              className="w-20 accent-orange-500"
            />
            <span className="w-6 text-right tabular-nums text-zinc-300">
              {sensitivity.toFixed(1)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-600">pp</span>
            <div
              className="h-3 w-28 rounded-sm border border-zinc-700/40"
              style={{ background: heatmapGradientCss(sensitivity) }}
            />
            <span className="text-zinc-600">ff</span>
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            <span style={{ color: mapVelocityToColor(0.15, sensitivity) }}>● ghost</span>
            <span style={{ color: mapVelocityToColor(0.55, sensitivity) }}>● normal</span>
            <span style={{ color: mapVelocityToColor(0.95, sensitivity) }}>● accent</span>
          </div>

          {stats && (
            <div className="flex items-center gap-3 text-[10px] text-zinc-500">
              <span>
                moy{" "}
                <span className="font-semibold" style={{ color: mapVelocityToColor(stats.mean, sensitivity) }}>
                  {Math.round(stats.mean * 127)}
                </span>
              </span>
              <span>min <span style={{ color: mapVelocityToColor(stats.min, sensitivity) }}>{Math.round(stats.min * 127)}</span></span>
              <span>max <span style={{ color: mapVelocityToColor(stats.max, sensitivity) }}>{Math.round(stats.max * 127)}</span></span>
              <span className="text-zinc-700">{stats.ghostCount}g · {stats.accentCount}a · {stats.normalCount}n</span>
              <span
                className="rounded border border-yellow-700/40 bg-yellow-900/20 px-1.5 py-px text-yellow-500/70"
                title="Désactiver le heatmap pour un PDF en noir et blanc"
              >⚠ PDF</span>
            </div>
          )}
        </div>
      )}

      {/* Separator between sections */}
      {heatmapEnabled && previewEnabled && (
        <div className="h-4 w-px bg-zinc-700/60" />
      )}

      {/* ── Sound Preview expanded ── */}
      {previewEnabled && (
        <div className="flex items-center gap-2">
          <span className="text-zinc-600">Volume preview</span>
          <input
            type="range" min={0} max={100} step={5}
            value={Math.round(previewVolume * 100)}
            onChange={(e) => handlePreviewVolume(Number(e.target.value) / 100)}
            className="w-20 accent-emerald-500"
          />
          <span className="w-7 text-right tabular-nums text-zinc-300">
            {Math.round(previewVolume * 100)}%
          </span>
        </div>
      )}
    </div>
  );
};
