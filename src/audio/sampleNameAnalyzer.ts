/**
 * Sample Name Analyzer
 *
 * Identifies drum instruments and articulations from sample file names
 * and folder paths — the way an experienced sound designer would read them.
 *
 * Algorithm:
 *   1. Normalize the filename (lowercase, strip extension, split on separators).
 *   2. Try to match compound tokens ("ridebell" → ride + bell).
 *   3. Score each DrumPiece candidate via keyword dictionary.
 *   4. Detect articulation modifiers (ghost, open, rim, brush …).
 *   5. Extract velocity layer hints ("v1"/"127" → layer index).
 *   6. Collect style hints (808, jazz, trap …).
 *
 * Examples:
 *   "Kick_808.wav"          → kick, electronic style hint
 *   "HH_Open_127.wav"       → hihatOpen, vel layer 4
 *   "RideBell_Jazz.wav"     → ride + bell articulation, jazz hint
 *   "SnareGhostSoft.wav"    → snare, ghost articulation
 *   "Clap_Trap_v2.wav"      → snare (clap), trap hint, layer 2
 */

import type { DrumPiece } from "../core/types";

// ─── Public types ─────────────────────────────────────────────────────────────

export type SampleArticulation =
  | "normal"
  | "ghost"       // pp / soft / parenthesised
  | "accent"      // ff / strong marker
  | "open"        // hi-hat open
  | "closed"      // hi-hat closed
  | "pedal"       // hi-hat foot
  | "rimshot"     // full-rim cross-stick
  | "sidestick"   // rim click / side-stick
  | "bell"        // ride bell
  | "bow"         // ride bow
  | "brush"       // brush technique
  | "flam"        // flam ornament
  | "roll"        // buzz / press roll
  | "choke";      // choked cymbal

export type KitStyleHint =
  | "808" | "jazz" | "trap" | "lofi" | "latin"
  | "metal" | "funk" | "rock" | "pop" | "electronic";

export interface SampleAnalysis {
  /** Best-match drum piece. */
  piece: DrumPiece;
  /** Specific playing technique / articulation. */
  articulation: SampleArticulation;
  /** 1–4 if multiple velocity layers are encoded in the name, else undefined. */
  velocityLayer?: number;
  /** Style character inferred from the name (e.g. "808", "jazz"). */
  styleHint?: KitStyleHint;
  /** 0–1: how confident the identification is. */
  confidence: number;
  /** Short human text explaining the decision. */
  reasoning: string;
}

// ─── Keyword dictionaries ─────────────────────────────────────────────────────

/**
 * Maps each DrumPiece to a list of token groups.
 * A token group is a list of synonyms — matching ANY token in the group
 * adds its score to the piece total.
 *
 * Scoring: first group in the list has the highest base weight (1.0),
 * subsequent groups lower (0.7, 0.4).
 */
const PIECE_KEYWORDS: Record<DrumPiece, string[][]> = {
  kick: [
    ["kick", "kk", "bd", "bassdrum", "bass_drum"],
    ["808", "606"],
    ["sub", "boomkick", "low_end"],
  ],
  snare: [
    ["snare", "snr", "sd", "sn"],
    ["clap", "clp", "rimclap"],
    ["backbeat", "wack", "crack"],
  ],
  snareRim: [
    ["rimshot", "rim_shot", "xstick", "cross_stick", "sidestick", "side_stick"],
    ["rimclick", "rim_click", "stick"],
  ],
  hihatClosed: [
    ["hihat", "hi_hat", "hh", "hat"],
    ["closed", "close", "cl"],
    ["chh", "clsd"],
  ],
  hihatOpen: [
    ["hihat", "hi_hat", "hh", "hat"],
    ["open", "op", "ohh"],
    ["pedal_release"],
  ],
  hihatPedal: [
    ["pedal", "foot", "foothat", "phh"],
    ["hihat", "hi_hat", "hh", "hat"],
  ],
  tomHigh: [
    ["tomhigh", "tom_high", "hi_tom", "hitom", "tom1", "rack1"],
    ["tom", "tl"],
  ],
  tomMid: [
    ["tommid", "tom_mid", "mid_tom", "midtom", "tom2", "rack2"],
    ["tom"],
  ],
  tomLow: [
    ["tomlow", "tom_low", "lo_tom", "lotom", "floor_tom", "floortom", "tom3", "ftom"],
    ["tom"],
  ],
  crash: [
    ["crash", "crsh", "csh"],
    ["accent_cymbal", "accentcymbal"],
  ],
  ride: [
    ["ride", "rd", "ridebow", "bow"],
    ["ride_bell", "ridebell", "bell"],
  ],
  splash: [
    ["splash", "spl", "mini_cymbal"],
  ],
  otherCymbal: [
    ["china", "trash", "stack", "effect_cymbal", "efx_cym", "fx_cym"],
    ["chine", "cymbal", "cym"],
  ],
};

// ─── Articulation keywords ────────────────────────────────────────────────────

const ARTICULATION_KEYWORDS: Record<SampleArticulation, string[]> = {
  normal:   [],
  ghost:    ["ghost", "soft", "light", "quiet", "pp", "gentle", "whisper", "vel30", "v30", "low_vel"],
  accent:   ["accent", "hard", "strong", "loud", "ff", "hit", "crack", "snap", "power", "vel127", "v127"],
  open:     ["open", "op", "ohh", "opened"],
  closed:   ["closed", "close", "cl", "chh", "shut"],
  pedal:    ["pedal", "foot", "phh"],
  rimshot:  ["rimshot", "rim_shot", "xstick", "cross_stick", "rimclap"],
  sidestick:["sidestick", "side_stick", "rimclick", "rim_click"],
  bell:     ["bell", "cup", "ping"],
  bow:      ["bow", "surface", "tip"],
  brush:    ["brush", "brsh", "wire"],
  flam:     ["flam"],
  roll:     ["roll", "buzz", "press", "tremolo"],
  choke:    ["choke", "chk", "mute", "muted"],
};

// ─── Style hint keywords ──────────────────────────────────────────────────────

const STYLE_KEYWORDS: Record<KitStyleHint, string[]> = {
  "808":       ["808", "606", "tr808", "tr606", "roland", "analog"],
  jazz:        ["jazz", "brush", "wire", "bebop", "swing", "bop"],
  trap:        ["trap", "drill", "arp", "hihat_roll", "triplet"],
  lofi:        ["lofi", "lo_fi", "vintage", "dusty", "tape", "warm", "bitcrush"],
  latin:       ["latin", "conga", "bongo", "timbale", "cajon", "afro", "samba", "bossa"],
  metal:       ["metal", "blast", "thrash", "heavy", "brutal"],
  funk:        ["funk", "groove", "pocket", "dirty"],
  rock:        ["rock", "live", "acoustic"],
  pop:         ["pop", "clean", "bright"],
  electronic:  ["electronic", "digital", "synth", "seq", "machine"],
};

// ─── Velocity layer extraction ────────────────────────────────────────────────

/**
 * Detect velocity layer index from tokens.
 * Patterns: "v1", "v2", "vel1", "layer2", "127", "64", "30" (numeric vel)
 */
const extractVelocityLayer = (tokens: string[]): number | undefined => {
  for (const t of tokens) {
    // "v1"–"v4", "vel1"–"vel4", "layer1"–"layer4"
    const layerMatch = t.match(/^(?:v|vel|layer)([1-4])$/);
    if (layerMatch) return parseInt(layerMatch[1], 10);

    // Explicit MIDI velocity: map to 1–4 layers
    const velMatch = t.match(/^(\d{2,3})$/);
    if (velMatch) {
      const v = parseInt(velMatch[1], 10);
      if (v >= 0 && v <= 127) {
        if (v <= 32)  return 1;
        if (v <= 64)  return 2;
        if (v <= 96)  return 3;
        return 4;
      }
    }
  }
  return undefined;
};

// ─── Normalisation ────────────────────────────────────────────────────────────

const normalize = (filename: string): string[] => {
  const noExt = filename.replace(/\.[^.]+$/, ""); // strip extension
  return noExt
    .toLowerCase()
    .replace(/[_\-\s.()[\]{}]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
};

/** Try to split a camelCase or compound token: "RideBell" → ["ride", "bell"] */
const decompound = (token: string): string[] => {
  // CamelCase split
  const camel = token.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(" ");
  // Additional known compounds
  const compounds: Record<string, string[]> = {
    ridebell: ["ride", "bell"],
    hihat: ["hi", "hat"],
    bassdrum: ["bass", "drum"],
    floortom: ["floor", "tom"],
    snareghost: ["snare", "ghost"],
    kickdrum: ["kick", "drum"],
  };
  return compounds[token] ?? camel;
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score a candidate DrumPiece against a token list.
 * Returns a score 0–3+ (higher = better match).
 */
const scorePiece = (piece: DrumPiece, tokens: string[]): number => {
  const groups = PIECE_KEYWORDS[piece];
  let total = 0;
  const weights = [1.0, 0.65, 0.35];

  for (let gi = 0; gi < groups.length; gi++) {
    const w = weights[Math.min(gi, weights.length - 1)];
    for (const kw of groups[gi]) {
      if (tokens.some(t => t === kw || t.includes(kw))) {
        total += w;
        break; // one match per group
      }
    }
  }
  return total;
};

// ─── Articulation detection ───────────────────────────────────────────────────

const detectArticulation = (tokens: string[], piece: DrumPiece): SampleArticulation => {
  // Priority order: most specific first
  const checks: SampleArticulation[] = [
    "roll", "flam", "choke", "brush",
    "bell", "bow",
    "rimshot", "sidestick",
    "pedal", "open", "closed",
    "ghost", "accent",
  ];

  for (const art of checks) {
    const kws = ARTICULATION_KEYWORDS[art];
    if (kws.length > 0 && tokens.some(t => kws.some(kw => t.includes(kw)))) {
      return art;
    }
  }

  // Infer articulation from piece + token context
  if (piece === "hihatOpen")  return "open";
  if (piece === "hihatPedal") return "pedal";
  if (piece === "snareRim")   return "rimshot";
  return "normal";
};

// ─── Style hint detection ─────────────────────────────────────────────────────

const detectStyleHint = (tokens: string[]): KitStyleHint | undefined => {
  // Check in order of specificity
  const order: KitStyleHint[] = ["808", "trap", "jazz", "latin", "metal", "lofi", "funk", "rock", "pop", "electronic"];
  for (const style of order) {
    if (tokens.some(t => STYLE_KEYWORDS[style].some(kw => t.includes(kw)))) {
      return style;
    }
  }
  return undefined;
};

// ─── Open/closed disambiguation ───────────────────────────────────────────────

/**
 * When sample name says "hihat" without open/closed qualifier,
 * apply context rules to disambiguate.
 */
const disambiguateHihat = (
  tokens: string[],
  _piece: DrumPiece
): DrumPiece => {
  const hasOpen   = tokens.some(t => ARTICULATION_KEYWORDS.open.some(kw => t.includes(kw)));
  const hasClosed = tokens.some(t => ARTICULATION_KEYWORDS.closed.some(kw => t.includes(kw)));
  const hasPedal  = tokens.some(t => ARTICULATION_KEYWORDS.pedal.some(kw => t.includes(kw)));

  if (hasPedal)  return "hihatPedal";
  if (hasOpen)   return "hihatOpen";
  if (hasClosed) return "hihatClosed";
  return "hihatClosed"; // default: closed hat is more common in grooves
};

// ─── Main analysis function ───────────────────────────────────────────────────

/**
 * Analyse a sample filename (and optional folder path) and return a full
 * drum instrument + articulation identification.
 *
 * @param filename  e.g. "HH_Open_127.wav"
 * @param folderPath  e.g. "My Trap Kit/HiHats/"  (optional, adds context)
 */
export const analyzeSampleName = (filename: string, folderPath = ""): SampleAnalysis => {
  const rawTokens    = normalize(filename);
  const folderTokens = normalize(folderPath);

  // Expand compound tokens ("ridebell" → ["ride", "bell"])
  const tokens = [
    ...folderTokens,
    ...rawTokens.flatMap(t => decompound(t)),
    ...rawTokens, // keep originals too
  ];

  // ── Score all pieces ────────────────────────────────────────────────────────
  const scores = (Object.keys(PIECE_KEYWORDS) as DrumPiece[]).map(p => ({
    piece: p,
    score: scorePiece(p, tokens),
  }));

  scores.sort((a, b) => b.score - a.score);
  const best   = scores[0];
  const second = scores[1];

  // Confidence: gap between first and second place
  const rawConf = best.score > 0
    ? Math.min(1, (best.score - second.score) / Math.max(0.1, best.score) + 0.3)
    : 0.2;

  // Fallback: if no piece got any score, guess kick (most common in sample packs)
  const piece = best.score > 0 ? best.piece : "kick";

  // ── Hihat disambiguation ────────────────────────────────────────────────────
  const resolvedPiece: DrumPiece =
    piece === "hihatClosed" || piece === "hihatOpen" || piece === "hihatPedal"
      ? disambiguateHihat(tokens, piece)
      : piece;

  // ── Articulation ────────────────────────────────────────────────────────────
  const articulation = detectArticulation(tokens, resolvedPiece);

  // ── Velocity layer ──────────────────────────────────────────────────────────
  const velocityLayer = extractVelocityLayer(rawTokens);

  // ── Style hint ───────────────────────────────────────────────────────────────
  const styleHint = detectStyleHint(tokens);

  // ── Reasoning text ──────────────────────────────────────────────────────────
  const parts: string[] = [`Identifié: ${resolvedPiece}`];
  if (articulation !== "normal") parts.push(`Articulation: ${articulation}`);
  if (velocityLayer)             parts.push(`Couche vélocité: ${velocityLayer}`);
  if (styleHint)                 parts.push(`Style: ${styleHint}`);
  if (rawConf < 0.5)             parts.push("⚠ Confiance faible — vérifier manuellement");

  return {
    piece:         resolvedPiece,
    articulation,
    velocityLayer,
    styleHint,
    confidence:    rawConf,
    reasoning:     parts.join(" | "),
  };
};
