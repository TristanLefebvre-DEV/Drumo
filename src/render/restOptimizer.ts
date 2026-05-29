/**
 * Rest Optimizer & Slot Filler — drum notation rules
 *
 * Real drum score conventions this module enforces:
 *
 *   RESTS
 *   ─────
 *   • On a beat boundary: use the largest standard rest that fits
 *     (whole → dotted-half → half → quarter → 8th → 16th → 32nd).
 *     This gives "1 whole rest" for an empty voice, "1 half rest" for
 *     2 silent beats — exactly what a copyist would write.
 *   • Mid-beat (rest starting inside a beat): stay within that beat to
 *     keep the beat structure readable.
 *
 *   NOTES
 *   ─────
 *   • Duration = space to the next event in the same voice.
 *   • Capped at `maxNoteDur` (caller decides per voice):
 *       - Cymbal voice (hi-hat, ride): cap = 2 × subdivision step
 *         (a 16th-note hi-hat stays a 16th even if the next note is 2 beats away)
 *       - Drum voice (kick, snare): cap = 2 beats (half note max)
 *   • Single-note exception: when a voice has exactly one chord (e.g. a lone
 *     crash), it gets the full measure duration (whole note).
 */

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

// Standard durations from largest to smallest
const STD: Array<{ base: string; mult: number; dotted: boolean }> = [
  { base: "w",   mult: 4,      dotted: false },
  { base: "h",   mult: 3,      dotted: true  },
  { base: "h",   mult: 2,      dotted: false },
  { base: "q",   mult: 1.5,    dotted: true  },
  { base: "q",   mult: 1,      dotted: false },
  { base: "8",   mult: 0.75,   dotted: true  },
  { base: "8",   mult: 0.5,    dotted: false },
  { base: "16",  mult: 0.375,  dotted: true  },
  { base: "16",  mult: 0.25,   dotted: false },
  { base: "32",  mult: 0.125,  dotted: false },
];

const TOL = 5; // ±5 MIDI ticks tolerance for duration matching

/** Largest standard duration that fits within `ticks` (±TOL tolerance). */
const bestDur = (ticks: number, ppq: number): { dur: string; dotted: boolean; durTicks: number } => {
  for (const d of STD) {
    const dt = Math.round(ppq * d.mult);
    if (ticks + TOL >= dt) return { dur: d.base, dotted: d.dotted, durTicks: dt };
  }
  const last = STD[STD.length - 1];
  return { dur: last.base, dotted: last.dotted, durTicks: Math.round(ppq * last.mult) };
};

/**
 * Fill a gap with rest slots.
 *
 * At a beat boundary: use the largest rest that fits the remaining space
 * (produces whole/half rests for long silences — correct drum notation).
 * Mid-beat: stay within the current beat boundary.
 */
const makeRests = (fromTick: number, totalTicks: number, ppq: number, beatTicks: number): RestSlot[] => {
  const rests: RestSlot[] = [];
  let tick      = fromTick;
  let remaining = totalTicks;
  let guard     = 0;

  while (remaining > 4 && guard++ < 64) {
    const posInBeat = tick % beatTicks;

    // On a beat boundary → greedy: use the largest rest that fits the whole remaining gap.
    // Mid-beat → cap at the distance to the next beat so the beat structure stays clear.
    const allowed = posInBeat === 0
      ? remaining
      : Math.min(remaining, beatTicks - posInBeat);

    const { dur, dotted, durTicks } = bestDur(allowed, ppq);
    const consumed = Math.min(remaining, durTicks);

    rests.push({
      type: "rest",
      tickInMeasure: tick,
      durTicks: consumed,
      dur: dur + "r",
      dotted,
    });

    tick      += consumed;
    remaining -= consumed;
  }

  return rests;
};

/**
 * Convert a list of chords into an ordered NoteSlot + RestSlot sequence that
 * spans exactly the full measure.
 *
 * @param chords           Sorted or unsorted chord list for one voice.
 * @param ticksPerMeasure  Total MIDI tick span of the measure.
 * @param ppq              Pulses per quarter note.
 * @param beatTicks        Ticks per beat (ppq × 4 / denominator).
 * @param maxNoteDur       Maximum duration assigned to any note slot (ticks).
 *                         Pass subdivisionStep×2 for the cymbal voice and
 *                         beatTicks×2 for the drum voice.
 *                         Omit to use beatTicks×2 as the default.
 */
export const fillMeasureSlots = (
  chords:          DrumChord[],
  ticksPerMeasure: number,
  ppq:             number,
  beatTicks:       number,
  maxNoteDur?:     number
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

    // ── Note duration ──────────────────────────────────────────────────────────
    const nextTick   = sorted[i + 1]?.tickInMeasure ?? ticksPerMeasure;
    const spaceTicks = Math.max(
      1,
      Math.min(nextTick - chord.tickInMeasure, ticksPerMeasure - chord.tickInMeasure)
    );

    // Single-chord voice (e.g. lone crash): get the full measure (whole note).
    // Multi-chord: cap at maxNoteDur (or beatTicks×2 by default).
    const cap        = sorted.length <= 1 ? ticksPerMeasure : (maxNoteDur ?? beatTicks * 2);
    const cappedTicks = Math.min(spaceTicks, cap);
    const { dur, dotted, durTicks } = bestDur(cappedTicks, ppq);

    slots.push({
      type:         "note",
      tickInMeasure: chord.tickInMeasure,
      durTicks,
      dur,
      dotted,
      absoluteTick:  chord.absoluteTick,
      hits:          chord.hits,
    });

    cursor = chord.tickInMeasure + durTicks;
  }

  // Trailing silence → fill with rests
  if (cursor < ticksPerMeasure - 4) {
    slots.push(...makeRests(cursor, ticksPerMeasure - cursor, ppq, beatTicks));
  }

  return slots;
};
