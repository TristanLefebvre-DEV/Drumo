import type { DrumChord, QuantizedHit } from "../core/types";

export interface NoteSlot {
  type: "note";
  tickInMeasure: number;
  durTicks: number;
  dur: string;      // VexFlow duration: 'q' '8' '16' 'h' 'w' '32'
  dotted: boolean;
  absoluteTick: number;
  hits: QuantizedHit[];
}

export interface RestSlot {
  type: "rest";
  tickInMeasure: number;
  durTicks: number;
  dur: string;      // VexFlow rest: 'qr' '8r' 'hr' 'wr'
  dotted: boolean;
}

export type DisplaySlot = NoteSlot | RestSlot;

// Standard durations from largest to smallest (sorted for greedy selection)
const STD: Array<{ base: string; mult: number; dotted: boolean }> = [
  { base: "w",  mult: 4,     dotted: false },
  { base: "h",  mult: 3,     dotted: true  },
  { base: "h",  mult: 2,     dotted: false },
  { base: "q",  mult: 1.5,   dotted: true  },
  { base: "q",  mult: 1,     dotted: false },
  { base: "8",  mult: 0.75,  dotted: true  },
  { base: "8",  mult: 0.5,   dotted: false },
  { base: "16", mult: 0.375, dotted: true  },
  { base: "16", mult: 0.25,  dotted: false },
  { base: "32", mult: 0.125, dotted: false },
];

/** Largest standard VexFlow duration that fits within `ticks` (±5 tick tolerance). */
const bestDur = (ticks: number, ppq: number): { dur: string; dotted: boolean; durTicks: number } => {
  const TOL = 5;
  for (const d of STD) {
    const dt = Math.round(ppq * d.mult);
    if (ticks + TOL >= dt) return { dur: d.base, dotted: d.dotted, durTicks: dt };
  }
  const last = STD[STD.length - 1];
  return { dur: last.base, dotted: last.dotted, durTicks: Math.round(ppq * last.mult) };
};

/**
 * Fill a gap [fromTick, fromTick+totalTicks) with rest slots.
 * Rests are kept within beat boundaries to follow notation conventions.
 */
const makeRests = (fromTick: number, totalTicks: number, ppq: number, beatTicks: number): RestSlot[] => {
  const rests: RestSlot[] = [];
  let tick = fromTick;
  let remaining = totalTicks;
  let guard = 0;

  while (remaining > 4 && guard++ < 64) {
    // Limit to within the current beat to avoid cross-beat rests
    const beatBoundary = (Math.floor(tick / beatTicks) + 1) * beatTicks;
    const maxTicks = Math.min(remaining, beatBoundary - tick);
    const { dur, dotted, durTicks } = bestDur(maxTicks, ppq);
    const consumed = Math.min(remaining, durTicks);

    rests.push({
      type: "rest",
      tickInMeasure: tick,
      durTicks: consumed,
      dur: dur + "r",
      dotted,
    });

    tick += consumed;
    remaining -= consumed;
  }

  return rests;
};

/**
 * Convert a measure's chords into an ordered list of NoteSlot and RestSlot,
 * filling all empty positions with rests and assigning correct display durations
 * to each note (based on the space until the next event).
 */
export const fillMeasureSlots = (
  chords: DrumChord[],
  ticksPerMeasure: number,
  ppq: number,
  beatTicks: number
): DisplaySlot[] => {
  const sorted = [...chords].sort((a, b) => a.tickInMeasure - b.tickInMeasure);
  const slots: DisplaySlot[] = [];
  let cursor = 0;

  for (let i = 0; i < sorted.length; i++) {
    const chord = sorted[i];

    // Gap before this chord → fill with rests
    if (chord.tickInMeasure > cursor + 4) {
      slots.push(...makeRests(cursor, chord.tickInMeasure - cursor, ppq, beatTicks));
    }

    // Note duration = space to the next chord (or measure end).
    // Capped at the full measure so single-note measures can use whole/dotted-half notes.
    const nextTick = sorted[i + 1]?.tickInMeasure ?? ticksPerMeasure;
    const spaceTicks = Math.min(nextTick - chord.tickInMeasure, ticksPerMeasure - chord.tickInMeasure);
    const cappedTicks = Math.min(spaceTicks, ticksPerMeasure);
    const { dur, dotted, durTicks } = bestDur(cappedTicks, ppq);

    slots.push({
      type: "note",
      tickInMeasure: chord.tickInMeasure,
      durTicks,
      dur,
      dotted,
      absoluteTick: chord.absoluteTick,
      hits: chord.hits,
    });

    cursor = chord.tickInMeasure + durTicks;
  }

  // Fill trailing space with rests
  if (cursor < ticksPerMeasure - 4) {
    slots.push(...makeRests(cursor, ticksPerMeasure - cursor, ppq, beatTicks));
  }

  return slots;
};
