/**
 * Groove DNA
 *
 * Extracts a comprehensive "genetic fingerprint" of a drum groove.
 * The DNA is a rich, multi-dimensional description suitable for:
 *   - Style classification
 *   - Groove-to-groove similarity comparison
 *   - ML embedding generation
 *   - Musical feedback and suggestions
 *
 * Components:
 *   Six 16-step velocity grids (kick, snare, hihat, ride, crash, toms)
 *   Fourteen global scalar characteristics
 *
 * Total raw feature count: 96 + 14 = 110 dimensions.
 */

import type { DrumHit, ParsedDrumProject } from "../core/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GrooveDNA {
  /** 16-step averaged velocity grids (0–1) */
  kick:    readonly number[];
  snare:   readonly number[];
  hihat:   readonly number[];
  ride:    readonly number[];
  crash:   readonly number[];
  toms:    readonly number[];

  /** Global scalar characteristics (all 0–1 unless noted) */
  bpmNorm:         number;  // BPM / 200
  density:         number;  // notes per beat, normalized (max 8 = 1)
  swingRatio:      number;  // 0.5=straight, 0.67=full swing (already 0–1 friendly)
  syncopation:     number;  // off-beat hit proportion
  kickDominance:   number;  // kick / total
  snarePresence:   number;  // snare / total
  cymbalDensity:   number;  // (hihat+ride+crash+splash) / total
  tomUsage:        number;  // toms / total
  dynamicRange:    number;  // velocity spread
  ghostRatio:      number;  // ghost notes / total
  accentRatio:     number;  // accent notes / total
  kickOnBeat1:     number;  // 1 if kick hits step 0 consistently
  snareOnBeat234:  number;  // 1 if snare is on expected backbeats
  polyrhythmScore: number;  // heuristic for simultaneous cross-rhythms
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ZERO16 = Array(16).fill(0) as number[];

const build16Grid = (hits: DrumHit[], ppq: number, barTicks: number, windowEnd: number,
  filter: (h: DrumHit) => boolean): number[] => {
  const stepTicks = ppq / 4;
  const acc = new Float32Array(16);
  const cnt = new Float32Array(16);
  for (const hit of hits) {
    if (hit.tick >= windowEnd || !filter(hit)) continue;
    const step = Math.min(15, Math.round((hit.tick % barTicks) / stepTicks) % 16);
    acc[step] += hit.velocity;
    cnt[step]++;
  }
  return Array.from({ length: 16 }, (_, i) => cnt[i] > 0 ? acc[i] / cnt[i] : 0);
};

// ─── DNA Extraction ───────────────────────────────────────────────────────────

export const extractGrooveDNA = (project: ParsedDrumProject): GrooveDNA => {
  const { hits, ppq, tempoBpm } = project;
  if (hits.length === 0) {
    return {
      kick: ZERO16, snare: ZERO16, hihat: ZERO16,
      ride: ZERO16, crash: ZERO16, toms: ZERO16,
      bpmNorm: tempoBpm / 200, density: 0, swingRatio: 0.5,
      syncopation: 0, kickDominance: 0, snarePresence: 0,
      cymbalDensity: 0, tomUsage: 0, dynamicRange: 0,
      ghostRatio: 0, accentRatio: 0,
      kickOnBeat1: 0, snareOnBeat234: 0, polyrhythmScore: 0,
    };
  }

  const barTicks  = ppq * 4;
  const maxTick   = hits.reduce((m, h) => Math.max(m, h.tick), 0);
  const bars      = Math.min(4, Math.max(1, Math.ceil(maxTick / barTicks)));
  const windowEnd = bars * barTicks;
  const stepTicks = ppq / 4;

  // ── 16-step grids ──────────────────────────────────────────────────────────
  const kick  = build16Grid(hits, ppq, barTicks, windowEnd, h => h.piece === "kick");
  const snare = build16Grid(hits, ppq, barTicks, windowEnd,
    h => h.piece === "snare" || h.piece === "snareRim");
  const hihat = build16Grid(hits, ppq, barTicks, windowEnd,
    h => h.piece === "hihatClosed" || h.piece === "hihatOpen" || h.piece === "hihatPedal");
  const ride  = build16Grid(hits, ppq, barTicks, windowEnd, h => h.piece === "ride");
  const crash = build16Grid(hits, ppq, barTicks, windowEnd,
    h => h.piece === "crash" || h.piece === "splash" || h.piece === "otherCymbal");
  const toms  = build16Grid(hits, ppq, barTicks, windowEnd,
    h => h.piece === "tomHigh" || h.piece === "tomMid" || h.piece === "tomLow");

  // ── Subset of hits inside analysis window ─────────────────────────────────
  const w = hits.filter(h => h.tick < windowEnd);
  const total = Math.max(1, w.length);
  const beats = bars * 4;

  // ── Category counts ───────────────────────────────────────────────────────
  const kickHits   = w.filter(h => h.piece === "kick");
  const snareHits  = w.filter(h => h.piece === "snare" || h.piece === "snareRim");
  const cymbalHits = w.filter(h =>
    h.piece === "hihatClosed" || h.piece === "hihatOpen" || h.piece === "hihatPedal" ||
    h.piece === "ride" || h.piece === "crash" || h.piece === "splash" || h.piece === "otherCymbal");
  const tomHits    = w.filter(h =>
    h.piece === "tomHigh" || h.piece === "tomMid" || h.piece === "tomLow");
  const ghostHits  = w.filter(h => h.isGhost);
  const accentHits = w.filter(h => h.isAccent);

  // ── Swing ratio (hi-hat off-beats) ────────────────────────────────────────
  const hhHits = w.filter(h => h.piece === "hihatClosed" || h.piece === "hihatOpen");
  let swingSum = 0, swingCount = 0;
  for (const h of hhHits) {
    const barTick    = h.tick % barTicks;
    const nearEighth = Math.round(barTick / (ppq / 2)) * (ppq / 2);
    const isOffBeat  = Math.round(nearEighth / (ppq / 2)) % 2 !== 0;
    if (!isOffBeat) continue;
    const offset = barTick - nearEighth;
    if (Math.abs(offset) > (ppq / 2) * 0.4) continue;
    swingSum  += 0.5 + (offset / (ppq / 2)) * 0.5;
    swingCount++;
  }
  const swingRatio = swingCount > 1 ? Math.min(0.75, Math.max(0.5, swingSum / swingCount)) : 0.5;

  // ── Syncopation (off-quarter-beat hits) ───────────────────────────────────
  const offQuarterHits = w.filter(h => {
    const step = Math.round((h.tick % barTicks) / stepTicks) % 16;
    return step % 4 !== 0; // not on a quarter-note beat
  });
  const syncopation = w.filter(h => h.piece === "kick" || h.piece === "snare").length > 0
    ? offQuarterHits.filter(h => h.piece === "kick" || h.piece === "snare").length /
      Math.max(1, kickHits.length + snareHits.length)
    : 0;

  // ── Beat placement heuristics ─────────────────────────────────────────────
  const kickOnBeat1 = kick[0] > 0.15 ? 1 : 0;
  const snareOnBeat234 =
    ((snare[4] > 0.2 ? 1 : 0) + (snare[8] > 0.2 ? 1 : 0) + (snare[12] > 0.2 ? 1 : 0)) / 3;

  // ── Dynamic range ─────────────────────────────────────────────────────────
  const vels = w.map(h => h.velocity);
  const dynamicRange = vels.length > 1
    ? Math.max(...vels) - Math.min(...vels)
    : 0;

  // ── Polyrhythm: toms or rides on non-standard subdivisions ───────────────
  const polyHits = tomHits.filter(h => {
    const step = Math.round((h.tick % barTicks) / stepTicks) % 16;
    return step % 2 !== 0; // on odd 16th steps
  });
  const polyrhythmScore = Math.min(1, polyHits.length / Math.max(1, tomHits.length));

  return {
    kick, snare, hihat, ride, crash, toms,
    bpmNorm:         Math.min(1, tempoBpm / 200),
    density:         Math.min(1, total / (beats * 8)),
    swingRatio,
    syncopation:     Math.min(1, syncopation),
    kickDominance:   kickHits.length / total,
    snarePresence:   snareHits.length / total,
    cymbalDensity:   cymbalHits.length / total,
    tomUsage:        tomHits.length / total,
    dynamicRange:    Math.min(1, dynamicRange),
    ghostRatio:      ghostHits.length / total,
    accentRatio:     accentHits.length / total,
    kickOnBeat1,
    snareOnBeat234,
    polyrhythmScore: Math.min(1, polyrhythmScore),
  };
};

/** Flatten a GrooveDNA to a plain number array (110 dimensions). */
export const dnaToVector = (dna: GrooveDNA): number[] => [
  ...dna.kick, ...dna.snare, ...dna.hihat,
  ...dna.ride, ...dna.crash, ...dna.toms,
  dna.bpmNorm, dna.density, dna.swingRatio, dna.syncopation,
  dna.kickDominance, dna.snarePresence, dna.cymbalDensity, dna.tomUsage,
  dna.dynamicRange, dna.ghostRatio, dna.accentRatio,
  dna.kickOnBeat1, dna.snareOnBeat234, dna.polyrhythmScore,
];
