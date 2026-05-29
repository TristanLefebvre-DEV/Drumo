import type { DrumPiece } from "../core/types";

/** Per-frame exponential decay lambda (higher = faster decay). */
const DECAY_LAMBDA: Partial<Record<DrumPiece, number>> = {
  kick:        9,    // punchy
  snare:       6,
  snareRim:    8,
  hihatClosed: 5,
  hihatOpen:   2.5,  // long sustain
  hihatPedal:  6,
  tomHigh:     5,
  tomMid:      4.5,
  tomLow:      4,
  crash:       2,    // long sustain
  ride:        3,
  splash:      3.5,
  otherCymbal: 3,
};

const DEFAULT_LAMBDA = 5;

export interface PieceState {
  impact: number;   // 0 – 1, decays each frame
  velocity: number; // velocity of the last hit
}

export interface AnimState {
  pieces: Map<DrumPiece, PieceState>;
  hihatOpenAmount: number; // 0 = closed, 1 = open (visual lerp target)
}

const ALL_PIECES: DrumPiece[] = [
  "kick", "snare", "snareRim",
  "hihatClosed", "hihatOpen", "hihatPedal",
  "tomHigh", "tomMid", "tomLow",
  "crash", "ride", "splash", "otherCymbal",
];

export const createAnimState = (): AnimState => {
  const pieces = new Map<DrumPiece, PieceState>();
  for (const p of ALL_PIECES) pieces.set(p, { impact: 0, velocity: 0 });
  return { pieces, hihatOpenAmount: 0 };
};

/** Trigger a piece hit — immediately sets impact to velocity-scaled value. */
export const triggerPiece = (state: AnimState, piece: DrumPiece, velocity: number): void => {
  state.pieces.set(piece, { impact: Math.min(1, velocity * 1.25), velocity });
  // Drive hi-hat open/close state
  if (piece === "hihatOpen")   state.hihatOpenAmount = Math.min(1, state.hihatOpenAmount + 0.6);
  if (piece === "hihatClosed" || piece === "hihatPedal") state.hihatOpenAmount = 0;
};

/** Step all impacts forward by dt seconds at the given speed multiplier. */
export const decayStateStep = (state: AnimState, dt: number, speed: number): void => {
  for (const [piece, s] of state.pieces) {
    const lambda = (DECAY_LAMBDA[piece] ?? DEFAULT_LAMBDA) * speed;
    const next = s.impact * Math.exp(-lambda * dt);
    state.pieces.set(piece, { ...s, impact: next < 0.002 ? 0 : next });
  }
  // Hihat slowly closes when open
  state.hihatOpenAmount *= Math.exp(-4 * speed * dt);
  if (state.hihatOpenAmount < 0.01) state.hihatOpenAmount = 0;
};
