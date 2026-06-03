/**
 * Humanize Engine
 *
 * Orchestrates the full humanization pipeline.
 *
 * Usage (in the store, after any settings change):
 *
 *   const { timingFn, velocityFn } = buildHumanizeProcessors(settings, project);
 *   playbackEngine.setHumanizeProcessors(timingFn, velocityFn);
 *
 * The processors are pure functions — no state, no timers.
 * Installing them into the scheduler is zero-latency and zero-disruption
 * (takes effect on the next lookahead window, ~100ms ahead).
 *
 * Profiles:
 *   tight-studio     — Recording session control (tiny deviations)
 *   loose-jazz       — Behind the beat, ride-dominant, large micro-variation
 *   aggressive-metal — Rushing, tight, nearly mechanical
 *   funk-pocket      — Kick on the grid, ghost-note dynamics
 *   vintage-human    — Loose, drifty, old-school feel
 */

import type { DrumHit, ParsedDrumProject } from "../core/types";
import { POCKET_PROFILES, scaledPocket, type PocketProfile } from "./groovePocketEngine";
import {
  computeTimingOffsetMs,
  computeVelocityScale,
  msToTicks,
  type TimingContext,
} from "./timingVariationEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type HumanizeProfileId =
  | "tight-studio"
  | "loose-jazz"
  | "aggressive-metal"
  | "funk-pocket"
  | "vintage-human";

export interface HumanizeSettings {
  enabled:           boolean;
  profileId:         HumanizeProfileId;
  /** Main slider: 0 (Robot) → 100 (Human) */
  amount:            number;
  /** Sub-slider: how much timing deviates (0–100) */
  timingAmount:      number;
  /** Sub-slider: how much velocity deviates (0–100) */
  velocityAmount:    number;
  /** Swing amount (0–100, 0=straight, 100=full triplet swing) */
  swingAmount:       number;
  /** Accent strength on strong beats (0–100) */
  accentAmount:      number;
  /** Groove pocket depth — how far behind/ahead the pocket sits (0–100) */
  pocketDepth:       number;
  /** Micro-displacement of individual hits (0–100) */
  microDisplacement: number;
  /** Ghost note level lift (0–100) */
  ghostLift:         number;
}

export const DEFAULT_HUMANIZE: HumanizeSettings = {
  enabled:           false,
  profileId:         "tight-studio",
  amount:            60,
  timingAmount:      75,
  velocityAmount:    60,
  swingAmount:       0,
  accentAmount:      50,
  pocketDepth:       50,
  microDisplacement: 30,
  ghostLift:         40,
};

// ─── Profile metadata ─────────────────────────────────────────────────────────

export interface HumanizeProfileMeta {
  id:          HumanizeProfileId;
  name:        string;
  description: string;
  style:       string;    // associated DrumStyle string (for hints)
}

export const HUMANIZE_PROFILE_META: Record<HumanizeProfileId, HumanizeProfileMeta> = {
  "tight-studio": {
    id:          "tight-studio",
    name:        "Tight Studio",
    description: "Contrôle parfait — déviations minimales, son professionnel",
    style:       "rock",
  },
  "loose-jazz": {
    id:          "loose-jazz",
    name:        "Loose Jazz",
    description: "Derrière le temps — swing naturel, ride dominant",
    style:       "jazz",
  },
  "aggressive-metal": {
    id:          "aggressive-metal",
    name:        "Aggressive Metal",
    description: "Légèrement en avance — rush d'énergie, groove serré",
    style:       "metal",
  },
  "funk-pocket": {
    id:          "funk-pocket",
    name:        "Funk Pocket",
    description: "Kick sur la grille, snare pousse, ghost notes dynamiques",
    style:       "funk",
  },
  "vintage-human": {
    id:          "vintage-human",
    name:        "Vintage Human",
    description: "Feeling old-school — dérive, imperfections naturelles",
    style:       "rock",
  },
};

// ─── Processor factory ────────────────────────────────────────────────────────

/**
 * Builds real-time timing + velocity processors for the given settings.
 * Returns null processors when humanization is disabled or amount = 0.
 *
 * These closures are lightweight and called ~once per scheduled hit.
 */
export const buildHumanizeProcessors = (
  settings: HumanizeSettings,
  project:  ParsedDrumProject
): {
  timingFn:   ((hit: DrumHit) => number) | null;
  velocityFn: ((hit: DrumHit, vel: number) => number) | null;
} => {
  if (!settings.enabled || settings.amount === 0) {
    return { timingFn: null, velocityFn: null };
  }

  const profile = POCKET_PROFILES[settings.profileId] as PocketProfile | undefined;
  if (!profile) return { timingFn: null, velocityFn: null };

  const { ppq, tempoBpm: bpm, timeSignature: { numerator } } = project;
  const masterAmount  = settings.amount         / 100;
  const timingAmount  = settings.timingAmount   / 100 * masterAmount;
  const velocityAmt   = settings.velocityAmount / 100 * masterAmount;
  const swingAmt      = settings.swingAmount    / 100;

  const pocket: ReturnType<typeof scaledPocket> = profile.pocketMs;
  const ctx: TimingContext = { ppq, bpm, numerator };

  const timingFn = (hit: DrumHit): number => {
    const ms = computeTimingOffsetMs(hit, pocket, profile, ctx, timingAmount, swingAmt);
    return Math.round(msToTicks(ms, ppq, bpm));
  };

  const velocityFn = (hit: DrumHit, vel: number): number => {
    const scale = computeVelocityScale(hit, ppq, numerator, velocityAmt);
    return Math.max(0.02, Math.min(1.0, vel * scale));
  };

  return { timingFn, velocityFn };
};

// ─── Visualization helper ─────────────────────────────────────────────────────

/** Pocket offset for display in the UI visualization (ms, scaled by amount). */
export const getPocketDisplayMs = (
  settings: HumanizeSettings,
  piece: import("../core/types").DrumPiece
): number => {
  const profile = POCKET_PROFILES[settings.profileId] as PocketProfile | undefined;
  if (!profile) return 0;
  const scale = settings.amount / 100 * settings.timingAmount / 100;
  return (profile.pocketMs[piece] ?? 0) * scale;
};
