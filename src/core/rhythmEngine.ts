import type { MeasureData, QuantizedHit, RhythmResult, TimeSignature } from "./types";

const groupByTick = (hits: QuantizedHit[]): Map<number, QuantizedHit[]> => {
  const buckets = new Map<number, QuantizedHit[]>();
  for (const hit of hits) {
    const group = buckets.get(hit.quantizedTick);
    if (group) {
      group.push(hit);
    } else {
      buckets.set(hit.quantizedTick, [hit]);
    }
  }
  return buckets;
};

export const buildRhythm = (
  hits: QuantizedHit[],
  ppq: number,
  signature: TimeSignature
): RhythmResult => {
  const ticksPerBeat = ppq * (4 / signature.denominator);
  const ticksPerMeasure = ticksPerBeat * signature.numerator;
  const maxTick = hits.reduce((max, hit) => Math.max(max, hit.quantizedTick), 0);
  const measuresCount = Math.max(1, Math.ceil((maxTick + 1) / ticksPerMeasure));
  const measures: MeasureData[] = Array.from({ length: measuresCount }, (_, index) => ({
    index,
    startTick: index * ticksPerMeasure,
    chords: []
  }));

  const tickBuckets = groupByTick(hits);
  const sortedTicks = [...tickBuckets.keys()].sort((a, b) => a - b);

  for (const tick of sortedTicks) {
    const groupedHits = tickBuckets.get(tick) ?? [];
    if (groupedHits.length === 0) continue;
    const measureIndex = Math.min(measures.length - 1, Math.floor(tick / ticksPerMeasure));
    const measure = measures[measureIndex];
    const tickInMeasure = tick - measure.startTick;
    measure.chords.push({
      tickInMeasure,
      absoluteTick: tick,
      hits: groupedHits
    });
  }

  for (const measure of measures) {
    measure.chords.sort((a, b) => a.tickInMeasure - b.tickInMeasure);
    for (const chord of measure.chords) {
      chord.hits.sort((a, b) => a.midi - b.midi);
    }
  }

  return { measures, ticksPerMeasure };
};
