import type { DrumHit } from "../core/types";

export interface VelocityStats {
  min: number;
  max: number;
  mean: number;
  p25: number;
  p75: number;
  ghostCount: number;
  normalCount: number;
  accentCount: number;
  total: number;
}

export const analyzeVelocity = (hits: DrumHit[]): VelocityStats | null => {
  if (hits.length === 0) return null;
  const sorted = [...hits.map((h) => h.velocity)].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const ghostCount = hits.filter((h) => h.isGhost).length;
  const accentCount = hits.filter((h) => h.isAccent).length;
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    p25,
    p75,
    ghostCount,
    accentCount,
    normalCount: hits.length - ghostCount - accentCount,
    total: hits.length,
  };
};
