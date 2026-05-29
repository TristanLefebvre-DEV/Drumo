import { gridStepTicks } from "../core/drumGrid";
import type { DrumPiece, QuantizeGrid, QuantizedHit, TimeSignature } from "../core/types";

export interface GridCell {
  step: number;
  piece: DrumPiece;
  velocity: number;
  isGhost: boolean;
  isAccent: boolean;
  isFlam: boolean;
  isDouble: boolean; // double-trigger (rapid double-kick etc.)
}

export interface GrooveGrid {
  cells: GridCell[];
  cellsByStep: Map<number, GridCell[]>; // step → cells for that step
  totalSteps: number;
  stepsPerMeasure: number;
  stepsPerBeat: number;
  stepsPerHalfBeat: number;
  stepTicks: number;
  measureCount: number;
}

export const buildGrooveGrid = (
  hits: QuantizedHit[],
  ppq: number,
  timeSignature: TimeSignature,
  quantizeGrid: QuantizeGrid
): GrooveGrid => {
  const stepTicks = gridStepTicks(ppq, quantizeGrid);
  const ticksPerBeat = ppq * (4 / timeSignature.denominator);
  const ticksPerMeasure = ticksPerBeat * timeSignature.numerator;
  const stepsPerMeasure = Math.round(ticksPerMeasure / stepTicks);
  const stepsPerBeat = Math.round(ticksPerBeat / stepTicks);
  const stepsPerHalfBeat = Math.max(1, Math.round(stepsPerBeat / 2));

  const maxTick = hits.length > 0 ? Math.max(...hits.map((h) => h.quantizedTick)) : 0;
  const measureCount = Math.max(4, Math.ceil(maxTick / ticksPerMeasure) + 1);
  const totalSteps = Math.min(1024, measureCount * stepsPerMeasure);

  // Build a map piece:step → best hit (highest velocity wins)
  const cellMap = new Map<string, GridCell>();
  for (const hit of hits) {
    const step = Math.round(hit.quantizedTick / stepTicks);
    if (step >= totalSteps) continue;
    const key = `${hit.piece}:${step}`;
    const existing = cellMap.get(key);
    if (!existing || hit.velocity > existing.velocity) {
      cellMap.set(key, {
        step,
        piece: hit.piece,
        velocity: hit.velocity,
        isGhost: hit.isGhost,
        isAccent: hit.isAccent,
        isFlam: false,
        isDouble: false,
      });
    }
  }

  const cells = [...cellMap.values()];

  // Detect flams: same piece on two consecutive steps
  const stepsByPiece = new Map<DrumPiece, number[]>();
  for (const c of cells) {
    const s = stepsByPiece.get(c.piece) ?? [];
    s.push(c.step);
    stepsByPiece.set(c.piece, s);
  }
  for (const [piece, steps] of stepsByPiece) {
    const sorted = [...steps].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] <= 1) {
        cellMap.get(`${piece}:${sorted[i]}`)!.isFlam = true;
        cellMap.get(`${piece}:${sorted[i + 1]}`)!.isFlam = true;
      }
    }
  }

  // Detect double-trigger: kick hits within half a beat
  const kickSteps = (stepsByPiece.get("kick") ?? []).sort((a, b) => a - b);
  for (let i = 0; i < kickSteps.length - 1; i++) {
    if (kickSteps[i + 1] - kickSteps[i] <= stepsPerHalfBeat) {
      const c1 = cellMap.get(`kick:${kickSteps[i]}`);
      const c2 = cellMap.get(`kick:${kickSteps[i + 1]}`);
      if (c1) c1.isDouble = true;
      if (c2) c2.isDouble = true;
    }
  }

  // Index by step for fast lookup during render
  const cellsByStep = new Map<number, GridCell[]>();
  for (const cell of cells) {
    const list = cellsByStep.get(cell.step) ?? [];
    list.push(cell);
    cellsByStep.set(cell.step, list);
  }

  return { cells, cellsByStep, totalSteps, stepsPerMeasure, stepsPerBeat, stepsPerHalfBeat, stepTicks, measureCount };
};
