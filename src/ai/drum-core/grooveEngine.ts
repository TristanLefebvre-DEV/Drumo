/**
 * Groove Intelligence Engine
 *
 * Musical-only analysis — no biomechanics here.
 *
 * Outputs:
 *   grooveScore             — rhythmic cohesion (0–100)
 *   detectedStyle           — genre classification
 *   subdivisionMap          — dominant grid + per-instrument breakdown
 *   swingRatio              — 0.5 straight → 0.67 full swing
 *   musicalIntentConfidence — clarity of the musical idea (0–1)
 *   patternDescription      — human-readable one-liner
 */

import type { MidiDrumData, MidiDrumHit, GrooveAnalysis, DetectedStyle } from "./types";
import type { DrumPiece } from "../../core/types";

// ─── Subdivision detection helpers ────────────────────────────────────────────

const GRIDS: Array<{ name: string; mult: number }> = [
  { name: "1/4",  mult: 1     },
  { name: "1/8",  mult: 0.5   },
  { name: "8T",   mult: 1/3   },
  { name: "1/16", mult: 0.25  },
  { name: "16T",  mult: 1/6   },
  { name: "1/32", mult: 0.125 },
];

const snapError = (tick: number, step: number): number => {
  const snapped = Math.round(tick / step) * step;
  return Math.abs(tick - snapped);
};

/** Best fitting subdivision grid for a set of ticks. */
const bestGrid = (ticks: number[], ppq: number): string => {
  if (ticks.length === 0) return "1/8";
  let bestName = "1/8";
  let bestErr  = Infinity;
  for (const g of GRIDS) {
    const step = ppq * g.mult;
    const rms  = Math.sqrt(ticks.reduce((s, t) => s + snapError(t, step) ** 2, 0) / ticks.length);
    const bias = step * 0.05; // slight preference for coarser grids (readability)
    if (rms + bias < bestErr) { bestErr = rms + bias; bestName = g.name; }
  }
  return bestName;
};

// ─── Swing ratio ──────────────────────────────────────────────────────────────

const computeSwingRatio = (hits: MidiDrumHit[], ppq: number): number => {
  const eighth = ppq / 2;
  const hhHits = hits.filter(h =>
    h.piece === "hihatClosed" || h.piece === "hihatOpen"
  );
  let sum = 0; let count = 0;
  for (const h of hhHits) {
    const barTick    = h.tick % (ppq * 4);
    const nearEighth = Math.round(barTick / eighth) * eighth;
    const isOffBeat  = Math.round(nearEighth / eighth) % 2 !== 0;
    if (!isOffBeat) continue;
    const offset = barTick - nearEighth;
    if (Math.abs(offset) > eighth * 0.4) continue;
    sum  += 0.5 + (offset / eighth) * 0.5;
    count++;
  }
  return count > 1 ? Math.min(0.75, Math.max(0.5, sum / count)) : 0.5;
};

// ─── Style classification ─────────────────────────────────────────────────────

interface StyleHints {
  bpmNorm:        number;
  swingRatio:     number;
  kickDominance:  number;
  snarePresence:  number;
  cymbalDensity:  number;
  syncopation:    number;
  kickOnBeat1:    number;
  snareOnBeat234: number;
  isTriplet:      boolean;
}

const classifyStyle = (h: StyleHints): DetectedStyle => {
  const { bpmNorm, swingRatio, kickDominance, snarePresence,
    cymbalDensity, syncopation, kickOnBeat1, snareOnBeat234, isTriplet } = h;

  // Blast beat: extreme speed + very dense hi-hat / cymbal
  if (bpmNorm > 0.85 && cymbalDensity > 0.55) return "blast-beat";

  // Jazz: swing + ride-dominant + moderate tempo
  if (swingRatio > 0.57 && bpmNorm < 0.7 && cymbalDensity > 0.4 && isTriplet) return "jazz";

  // Shuffle: swing feel without full jazz ride pattern
  if (swingRatio > 0.56 && isTriplet) return "shuffle";

  // Funk: high syncopation + ghost notes + moderate tempo
  if (syncopation > 0.4 && bpmNorm < 0.65 && cymbalDensity > 0.3) return "funk";

  // Halftime: snare on beat 3 only (snareOnBeat234 ≈ 0.33)
  if (snareOnBeat234 < 0.4 && snarePresence > 0.1 && bpmNorm < 0.7) return "halftime";

  // Metal: fast + kick dominant
  if (bpmNorm > 0.75 && kickDominance > 0.3) return "metal";

  // Latin: syncopated + moderate tempo
  if (syncopation > 0.5 && bpmNorm < 0.55) return "latin";

  // Trap: slow tempo + heavy kick + sparse snare
  if (bpmNorm < 0.4 && kickDominance > 0.35 && snarePresence < 0.15) return "trap";

  // LoFi: slow, very sparse
  if (bpmNorm < 0.4 && cymbalDensity < 0.2) return "lofi";

  // Pop: regular snare + kick pattern + medium tempo
  if (snareOnBeat234 > 0.6 && kickOnBeat1 > 0.5 && bpmNorm > 0.4 && bpmNorm < 0.75) return "pop";

  // Fusion: mixed signals
  if (syncopation > 0.3 && bpmNorm > 0.5 && bpmNorm < 0.8) return "fusion";

  // Rock: default backbeat pattern
  if (snareOnBeat234 > 0.5 && kickOnBeat1 > 0.3) return "rock";

  return "unknown";
};

// ─── Groove score ─────────────────────────────────────────────────────────────

/**
 * Measures how consistent the pattern is relative to the detected grid.
 * Higher score = events land closer to grid positions = tighter groove.
 */
const computeGrooveScore = (hits: MidiDrumHit[], ppq: number, dominant: string): number => {
  if (hits.length === 0) return 0;
  const gridEntry = GRIDS.find(g => g.name === dominant) ?? GRIDS[1];
  const step = ppq * gridEntry.mult;
  const errors = hits.map(h => snapError(h.tick, step) / step);
  const avgErr = errors.reduce((s, e) => s + e, 0) / errors.length;
  // avgErr = 0 → score 100; avgErr = 0.5 → score 0
  return Math.round(Math.max(0, Math.min(100, (1 - avgErr * 2) * 100)));
};

// ─── Musical intent confidence ────────────────────────────────────────────────

const musicalIntentConfidence = (
  grooveScore:    number,
  hitCount:       number,
  styleKnown:     boolean,
  subdivKnown:    boolean
): number => {
  let conf = grooveScore / 100;
  if (hitCount < 8)   conf *= 0.6;
  if (!styleKnown)    conf *= 0.7;
  if (!subdivKnown)   conf *= 0.8;
  return Math.max(0, Math.min(1, conf));
};

// ─── Pattern description ──────────────────────────────────────────────────────

const describePattern = (
  style:     DetectedStyle,
  subdiv:    string,
  swing:     number,
  bpmNorm:   number
): string => {
  const tempoAdj = bpmNorm < 0.4 ? "lent" : bpmNorm < 0.65 ? "medium" : bpmNorm < 0.85 ? "rapide" : "très rapide";
  const swingAdj = swing > 0.57 ? " swingué" : "";
  const subdivStr = subdiv === "1/16" ? "doubles croches" :
    subdiv === "1/8"  ? "croches" :
    subdiv === "1/32" ? "triples croches" :
    subdiv === "8T"   ? "croches ternaires" :
    subdiv === "16T"  ? "doubles croches ternaires" : "noires";

  return `Groove ${style} ${tempoAdj}${swingAdj} — subdivision ${subdivStr}`;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const analyzeGroove = (data: MidiDrumData): GrooveAnalysis => {
  const { hits, ppq, bpm } = data;

  if (hits.length === 0) {
    return {
      grooveScore: 0, detectedStyle: "unknown",
      subdivisionMap: { dominant: "1/8", byPiece: {}, isTriplet: false },
      swingRatio: 0.5, musicalIntentConfidence: 0,
      patternDescription: "Aucune frappe détectée",
    };
  }

  // ── Per-instrument dominant subdivision ──────────────────────────────────────
  const pieces = new Set(hits.map(h => h.piece));
  const byPiece: Partial<Record<DrumPiece, string>> = {};
  for (const piece of pieces) {
    const ticks = hits.filter(h => h.piece === piece).map(h => h.tick);
    byPiece[piece] = bestGrid(ticks, ppq);
  }

  // Global dominant: majority vote (prefer subdivision of hi-hat / kick)
  const votePriority: DrumPiece[] = ["hihatClosed", "kick", "snare", "hihatOpen", "ride"];
  const dominantPiece = votePriority.find(p => byPiece[p] !== undefined);
  const dominant = dominantPiece ? byPiece[dominantPiece]! : bestGrid(hits.map(h => h.tick), ppq);
  const isTriplet = dominant === "8T" || dominant === "16T";

  // ── Category counts ──────────────────────────────────────────────────────────
  const total        = Math.max(1, hits.length);
  const barTicks     = ppq * 4;
  const stepTicks    = ppq / 4;
  const kickHits     = hits.filter(h => h.piece === "kick");
  const snareHits    = hits.filter(h => h.piece === "snare" || h.piece === "snareRim");
  const cymbalHits   = hits.filter(h =>
    h.piece === "hihatClosed" || h.piece === "hihatOpen" || h.piece === "hihatPedal" ||
    h.piece === "ride" || h.piece === "crash" || h.piece === "splash" || h.piece === "otherCymbal"
  );

  const offQuarterKickSnare = hits.filter(h => {
    if (h.piece !== "kick" && h.piece !== "snare") return false;
    const step = Math.round((h.tick % barTicks) / stepTicks) % 16;
    return step % 4 !== 0;
  });

  const step16 = ppq / 4;
  const kickOnBeat1 = kickHits.filter(h => Math.abs((h.tick % barTicks) - 0) < step16 * 0.5).length /
    Math.max(1, Math.ceil(data.totalTicks / barTicks));

  const snareBack = snareHits.filter(h => {
    const step = Math.round((h.tick % barTicks) / stepTicks) % 16;
    return step === 4 || step === 8 || step === 12;
  }).length / Math.max(1, Math.ceil(data.totalTicks / barTicks) * 2);

  const bpmNorm     = Math.min(1, bpm / 200);
  const swingRatio  = computeSwingRatio(hits, ppq);
  const syncopation = offQuarterKickSnare.length / Math.max(1, kickHits.length + snareHits.length);

  const hints: StyleHints = {
    bpmNorm,
    swingRatio,
    kickDominance:  kickHits.length / total,
    snarePresence:  snareHits.length / total,
    cymbalDensity:  cymbalHits.length / total,
    syncopation:    Math.min(1, syncopation),
    kickOnBeat1:    Math.min(1, kickOnBeat1),
    snareOnBeat234: Math.min(1, snareBack),
    isTriplet,
  };

  const detectedStyle  = classifyStyle(hints);
  const grooveScore    = computeGrooveScore(hits, ppq, dominant);
  const intentConf     = musicalIntentConfidence(
    grooveScore, hits.length,
    detectedStyle !== "unknown",
    dominant !== "1/8"
  );

  return {
    grooveScore,
    detectedStyle,
    subdivisionMap: { dominant, byPiece, isTriplet },
    swingRatio,
    musicalIntentConfidence: intentConf,
    patternDescription: describePattern(detectedStyle, dominant, swingRatio, bpmNorm),
  };
};
