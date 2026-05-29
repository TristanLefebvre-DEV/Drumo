import type { ParsedDrumProject, QuantizeGrid, QuantizeOptions, QuantizedHit } from "./types";

const gridToTicks = (ppq: number, grid: QuantizeGrid): number => {
  switch (grid) {
    case "1/4":
      return ppq;
    case "1/8":
      return ppq / 2;
    case "1/16":
      return ppq / 4;
    case "1/32":
      return ppq / 8;
    case "8T":
      return ppq / 3;
    case "16T":
      return ppq / 6;
  }
};

const detectSwing = (hits: ParsedDrumProject["hits"], step: number): number => {
  const offbeats = hits
    .map((h) => h.tick % (step * 2))
    .filter((value) => value > 0.2 * step && value < 1.9 * step);
  if (offbeats.length === 0) return 0;
  const avg = offbeats.reduce((acc, value) => acc + value, 0) / offbeats.length;
  const straight = step;
  return Math.max(0, Math.min(0.25, (avg - straight) / step));
};

const snapTickToGrid = (tick: number, step: number, swing: number): number => {
  const pair = step * 2;
  const pairStart = Math.floor(tick / pair) * pair;
  const candidates = [pairStart, pairStart + step + step * swing, pairStart + pair];
  let best = candidates[0];
  let distance = Math.abs(tick - best);
  for (const candidate of candidates.slice(1)) {
    const nextDistance = Math.abs(tick - candidate);
    if (nextDistance < distance) {
      best = candidate;
      distance = nextDistance;
    }
  }
  return Math.round(best);
};

export const quantizeHits = (
  project: ParsedDrumProject,
  inputOptions: Partial<QuantizeOptions>
): { hits: QuantizedHit[]; options: QuantizeOptions } => {
  const options: QuantizeOptions = {
    grid: inputOptions.grid ?? "1/16",
    preserveGroove: inputOptions.preserveGroove ?? true,
    swing: inputOptions.swing ?? 0
  };
  const step = gridToTicks(project.ppq, options.grid);
  const autoSwing = options.swing > 0 ? options.swing : detectSwing(project.hits, step);

  const hits: QuantizedHit[] = project.hits.map((hit) => {
    // Strict global quantization: every hit is snapped to shared grid buckets first.
    const quantizedTick = snapTickToGrid(hit.tick, step, autoSwing);

    return {
      ...hit,
      originalTick: hit.tick,
      quantizedTick,
      quantizedDuration: Math.max(step, Math.round(hit.durationTicks / step) * step),
      velocity: options.preserveGroove ? hit.velocity : Math.round(hit.velocity * 100) / 100
    };
  });

  hits.sort((a, b) => a.quantizedTick - b.quantizedTick);
  return { hits, options: { ...options, swing: autoSwing } };
};
