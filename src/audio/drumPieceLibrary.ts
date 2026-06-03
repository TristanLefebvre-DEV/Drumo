/**
 * Bibliothèque de sons par pièce
 *
 * Chaque pièce de batterie (caisse claire, grosse caisse, etc.) dispose de
 * plusieurs variantes de timbre réellement différentes — pas des simples
 * ajustements d'EQ, mais des algorithmes de synthèse distincts.
 *
 * Structure :
 *   PieceSoundVariant  — définition d'une variante de son (paramètres de synthèse)
 *   PIECE_SOUND_LIBRARY — catalogue complet, organisé par pièce
 *
 * Utilisé par DrumKitBuilder pour permettre à l'utilisateur de construire
 * son kit pièce par pièce, comme sur une batterie électronique professionnelle.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Algorithme de synthèse utilisé pour cette variante. */
export type SynthAlgo =
  | "membrane"        // Tone.MembraneSynth — corps membranaire chaud
  | "membrane_punch"  // MembraneSynth agressif, court
  | "membrane_sub"    // MembraneSynth basse fréquence (808 style)
  | "noise_white"     // NoiseSynth bruit blanc filtré — claquements secs
  | "noise_pink"      // NoiseSynth bruit rose — plus chaud
  | "noise_band"      // Bruit passebande étroit — son électronique/rimshot
  | "dual"            // Corps (membrane) + bruit mélangés
  | "dual_metal"      // Corps métallique (haute fréquence) + bruit
  | "hihat_open"      // Bruit + filtre HP ouvert — long decay
  | "hihat_closed"    // Bruit + filtre HP — très court
  | "cymbal_bright"   // Bruit haute fréquence + longue réverbération
  | "cymbal_dark";    // Bruit filtré fréquence moyenne

export interface PieceSoundVariant {
  id:          string;
  name:        string;
  description: string;
  category:    "bois" | "métal" | "peau" | "électronique" | "acoustique" | "vintage";
  algo:        SynthAlgo;

  // Paramètres communs
  decay:       number;    // secondes
  velocity:    number;    // multiplicateur 0–1.5
  pitch?:      string;    // note MIDI (ex. "C1", "D2")

  // Membrane
  pitchDecay?: number;
  octaves?:    number;

  // Bruit
  noiseType?:  "white" | "pink" | "brown";
  filterFreq?: number;
  filterQ?:    number;
  filterType?: "highpass" | "bandpass" | "lowpass";

  // Dual
  bodyRatio?:  number;    // 0 = tout bruit, 1 = tout corps
  bodyNote?:   string;
  bodyDecay?:  number;
  bodyOctaves?:number;
}

// ─── Catalogue par pièce ──────────────────────────────────────────────────────

export interface PieceSoundCategory {
  pieceName:  string;
  pieceLabel: string;
  variants:   PieceSoundVariant[];
}

export const PIECE_SOUND_LIBRARY: Record<string, PieceSoundCategory> = {

  // ─── GROSSE CAISSE ──────────────────────────────────────────────────────────

  kick: {
    pieceName: "kick", pieceLabel: "Grosse caisse",
    variants: [
      {
        id: "kick_classic",    name: "Classique",     description: "Son rond et profond, idéal rock/pop",
        category: "peau",      algo: "membrane",
        pitch: "C1",           pitchDecay: 0.10, octaves: 9,   decay: 0.40, velocity: 1.0,
      },
      {
        id: "kick_punch",      name: "Punchy",        description: "Attaque courte et claquante, metal/punk",
        category: "métal",     algo: "membrane_punch",
        pitch: "C1",           pitchDecay: 0.04, octaves: 6,   decay: 0.22, velocity: 1.1,
      },
      {
        id: "kick_808",        name: "808 Sub",       description: "Grosse caisse électronique basse sub, hip-hop/trap",
        category: "électronique", algo: "membrane_sub",
        pitch: "A-1",          pitchDecay: 0.60, octaves: 15,  decay: 0.80, velocity: 1.1,
      },
      {
        id: "kick_deep",       name: "Profonde",      description: "Son très grave et étouffé, jazz/acoustique",
        category: "acoustique", algo: "membrane",
        pitch: "D1",           pitchDecay: 0.06, octaves: 5.5, decay: 0.30, velocity: 0.85,
      },
      {
        id: "kick_click",      name: "Click",         description: "Attaque ultra-courte avec click de beater, metal moderne",
        category: "métal",     algo: "dual",
        pitch: "E1",           pitchDecay: 0.03, octaves: 4,   decay: 0.18, velocity: 1.05,
        noiseType: "white",    filterFreq: 3000, filterType: "highpass",
        bodyRatio: 0.7,        bodyNote: "E1",   bodyDecay: 0.14,
      },
      {
        id: "kick_vintage",    name: "Vintage",       description: "Son chaud des années 60-70, soul/r&b",
        category: "vintage",   algo: "membrane",
        pitch: "D1",           pitchDecay: 0.09, octaves: 7,   decay: 0.40, velocity: 0.88,
      },
    ],
  },

  // ─── CAISSE CLAIRE ──────────────────────────────────────────────────────────

  snare: {
    pieceName: "snare", pieceLabel: "Caisse claire",
    variants: [
      {
        id: "snare_wood",      name: "Érable",        description: "Corps chaleureux en bois d'érable, polyvalente",
        category: "bois",      algo: "dual",
        pitch: "D2",           pitchDecay: 0.01, bodyOctaves: 3.5, decay: 0.18, velocity: 1.0,
        noiseType: "white",    filterFreq: 1200, filterType: "highpass",
        bodyRatio: 0.40,       bodyNote: "D2",   bodyDecay: 0.13,
      },
      {
        id: "snare_metal",     name: "Métal",         description: "Corps métallique brillant et tranchant",
        category: "métal",     algo: "dual_metal",
        pitch: "E2",           pitchDecay: 0.008, bodyOctaves: 2.5, decay: 0.12, velocity: 1.05,
        noiseType: "white",    filterFreq: 2500, filterType: "highpass",
        bodyRatio: 0.28,       bodyNote: "E2",   bodyDecay: 0.08,
      },
      {
        id: "snare_piccolo",   name: "Piccolo",       description: "Caisse claire haute et courte, reggae/funk",
        category: "métal",     algo: "dual",
        pitch: "G2",           pitchDecay: 0.012, bodyOctaves: 2.0, decay: 0.10, velocity: 1.0,
        noiseType: "white",    filterFreq: 2000, filterType: "highpass",
        bodyRatio: 0.35,       bodyNote: "G2",   bodyDecay: 0.07,
      },
      {
        id: "snare_vintage",   name: "Vintage",       description: "Son chaud et ouvert des années 70, jazz/soul",
        category: "vintage",   algo: "dual",
        pitch: "C2",           pitchDecay: 0.015, bodyOctaves: 3.0, decay: 0.22, velocity: 0.88,
        noiseType: "pink",     filterFreq: 900,  filterType: "highpass",
        bodyRatio: 0.52,       bodyNote: "C2",   bodyDecay: 0.18,
      },
      {
        id: "snare_fat",       name: "Fat",           description: "Son gros et lourd, rock alternatif/grunge",
        category: "peau",      algo: "dual",
        pitch: "C2",           pitchDecay: 0.02, bodyOctaves: 4.0, decay: 0.22, velocity: 1.02,
        noiseType: "pink",     filterFreq: 600,  filterType: "highpass",
        bodyRatio: 0.60,       bodyNote: "C2",   bodyDecay: 0.20,
      },
      {
        id: "snare_electronic", name: "Électronique", description: "Clap synthétique sec, hip-hop/électro",
        category: "électronique", algo: "noise_white",
        decay: 0.08, velocity: 0.98,
        noiseType: "white",    filterFreq: 1800, filterType: "bandpass", filterQ: 0.6,
      },
      {
        id: "snare_brush",     name: "Balais",        description: "Son doux au balai pour le jazz",
        category: "acoustique", algo: "noise_pink",
        decay: 0.28, velocity: 0.72,
        noiseType: "pink",     filterFreq: 800,  filterType: "highpass",
      },
    ],
  },

  // ─── HI-HAT ─────────────────────────────────────────────────────────────────

  hihatClosed: {
    pieceName: "hihatClosed", pieceLabel: "Hi-Hat fermé",
    variants: [
      {
        id: "hh_closed_thin",  name: "Fin",           description: "Hi-hat brillant et tranchant",
        category: "métal",     algo: "hihat_closed",
        decay: 0.028, velocity: 0.42,
        filterFreq: 5000, filterQ: 0.8,
      },
      {
        id: "hh_closed_dark",  name: "Sombre",        description: "Hi-hat chaleureux, jazz/soul",
        category: "vintage",   algo: "hihat_closed",
        decay: 0.048, velocity: 0.30,
        filterFreq: 3200, filterQ: 0.6,
      },
      {
        id: "hh_closed_tight", name: "Serré",         description: "Hi-hat très court, metal/punk",
        category: "métal",     algo: "hihat_closed",
        decay: 0.015, velocity: 0.52,
        filterFreq: 6000, filterQ: 1.0,
      },
      {
        id: "hh_closed_elec",  name: "Électronique",  description: "Hi-hat synthétique ultra court, trap",
        category: "électronique", algo: "noise_band",
        decay: 0.012, velocity: 0.46,
        filterFreq: 7000, filterType: "bandpass", filterQ: 2.0,
      },
    ],
  },

  hihatOpen: {
    pieceName: "hihatOpen", pieceLabel: "Hi-Hat ouvert",
    variants: [
      {
        id: "hh_open_thin",    name: "Fin",           description: "Ouvert brillant, decay moyen",
        category: "métal",     algo: "hihat_open",
        decay: 0.55, velocity: 0.38,
        filterFreq: 4800, filterQ: 0.7,
      },
      {
        id: "hh_open_washy",   name: "Wash",          description: "Très ouvert et prolongé, jazz",
        category: "acoustique", algo: "hihat_open",
        decay: 1.00, velocity: 0.30,
        filterFreq: 3000, filterQ: 0.5,
      },
      {
        id: "hh_open_crunch",  name: "Crunch",        description: "Ouvert agressif, rock/metal",
        category: "métal",     algo: "hihat_open",
        decay: 0.38, velocity: 0.45,
        filterFreq: 5800, filterQ: 0.9,
      },
    ],
  },

  // ─── CRASH ──────────────────────────────────────────────────────────────────

  crash: {
    pieceName: "crash", pieceLabel: "Crash",
    variants: [
      {
        id: "crash_bright",    name: "Brillant",      description: "Crash vif avec attaque forte",
        category: "métal",     algo: "cymbal_bright",
        decay: 1.90, velocity: 0.35,
        filterFreq: 3200, filterQ: 0.4,
      },
      {
        id: "crash_dark",      name: "Sombre",        description: "Crash chaleureux, moins agressif",
        category: "acoustique", algo: "cymbal_dark",
        decay: 2.20, velocity: 0.30,
        filterFreq: 2200, filterQ: 0.3,
      },
      {
        id: "crash_china",     name: "China",         description: "Crash China tranchant, metal extrême",
        category: "métal",     algo: "cymbal_bright",
        decay: 1.50, velocity: 0.40,
        filterFreq: 4800, filterQ: 0.8,
      },
      {
        id: "crash_vintage",   name: "Vintage",       description: "Crash chaud années 60-70",
        category: "vintage",   algo: "cymbal_dark",
        decay: 2.50, velocity: 0.28,
        filterFreq: 1800, filterQ: 0.3,
      },
    ],
  },

  // ─── RIDE ───────────────────────────────────────────────────────────────────

  ride: {
    pieceName: "ride", pieceLabel: "Ride",
    variants: [
      {
        id: "ride_jazz",       name: "Jazz",          description: "Ride doux et défini, idéal jazz/fusion",
        category: "acoustique", algo: "cymbal_dark",
        decay: 1.20, velocity: 0.42,
        filterFreq: 2600, filterQ: 0.5,
      },
      {
        id: "ride_rock",       name: "Rock",          description: "Ride plus brillant et projeté, rock/metal",
        category: "métal",     algo: "cymbal_bright",
        decay: 0.90, velocity: 0.35,
        filterFreq: 3600, filterQ: 0.6,
      },
      {
        id: "ride_bell",       name: "Cloche",        description: "Son de cloche du ride, jazz/fusion",
        category: "métal",     algo: "cymbal_bright",
        decay: 0.60, velocity: 0.50,
        filterFreq: 5000, filterQ: 1.2,
      },
    ],
  },

  // ─── TOMS ───────────────────────────────────────────────────────────────────

  tomHigh: {
    pieceName: "tomHigh", pieceLabel: "Tom aigu",
    variants: [
      {
        id: "tom_high_wood",   name: "Bois",          description: "Tom acajou chaleureux",
        category: "bois",      algo: "membrane",
        pitch: "A3",           pitchDecay: 0.055, octaves: 4.5, decay: 0.22, velocity: 1.0,
      },
      {
        id: "tom_high_elec",   name: "Électronique",  description: "Tom synthétique défini",
        category: "électronique", algo: "membrane_punch",
        pitch: "C4",           pitchDecay: 0.035, octaves: 6.0, decay: 0.15, velocity: 0.90,
      },
      {
        id: "tom_high_vintage",name: "Vintage",       description: "Tom Ludwig vintage années 70",
        category: "vintage",   algo: "membrane",
        pitch: "B3",           pitchDecay: 0.068, octaves: 4.0, decay: 0.30, velocity: 0.85,
      },
    ],
  },

  tomMid: {
    pieceName: "tomMid", pieceLabel: "Tom médium",
    variants: [
      {
        id: "tom_mid_wood",    name: "Bois",          description: "Tom bouleau équilibré",
        category: "bois",      algo: "membrane",
        pitch: "E3",           pitchDecay: 0.055, octaves: 4.5, decay: 0.30, velocity: 1.0,
      },
      {
        id: "tom_mid_elec",    name: "Électronique",  description: "Tom médium synthétique",
        category: "électronique", algo: "membrane_punch",
        pitch: "G3",           pitchDecay: 0.035, octaves: 6.0, decay: 0.22, velocity: 0.90,
      },
      {
        id: "tom_mid_vintage", name: "Vintage",       description: "Tom médium Ludwig vintage",
        category: "vintage",   algo: "membrane",
        pitch: "F3",           pitchDecay: 0.068, octaves: 4.0, decay: 0.38, velocity: 0.85,
      },
    ],
  },

  tomLow: {
    pieceName: "tomLow", pieceLabel: "Tom grave (floor)",
    variants: [
      {
        id: "tom_low_wood",    name: "Bois",          description: "Floor tom en érable, grave et résonnant",
        category: "bois",      algo: "membrane",
        pitch: "B2",           pitchDecay: 0.055, octaves: 4.5, decay: 0.38, velocity: 1.0,
      },
      {
        id: "tom_low_elec",    name: "Électronique",  description: "Floor tom électronique percutant",
        category: "électronique", algo: "membrane_punch",
        pitch: "D3",           pitchDecay: 0.035, octaves: 6.0, decay: 0.30, velocity: 0.90,
      },
      {
        id: "tom_low_deep",    name: "Profond",       description: "Floor tom très grave, acoustique naturel",
        category: "acoustique", algo: "membrane",
        pitch: "A2",           pitchDecay: 0.070, octaves: 4.0, decay: 0.52, velocity: 0.90,
      },
    ],
  },

  // ─── SPLASH ─────────────────────────────────────────────────────────────────

  splash: {
    pieceName: "splash", pieceLabel: "Splash",
    variants: [
      {
        id: "splash_standard", name: "Standard",      description: "Splash clair et court",
        category: "métal",     algo: "cymbal_bright",
        decay: 0.38, velocity: 0.30,
        filterFreq: 3500, filterQ: 0.6,
      },
      {
        id: "splash_trashy",   name: "Trash",         description: "Splash agressif, metal/grunge",
        category: "métal",     algo: "cymbal_bright",
        decay: 0.22, velocity: 0.35,
        filterFreq: 5500, filterQ: 1.0,
      },
    ],
  },
};

// ─── Accès rapide ─────────────────────────────────────────────────────────────

/** Retourne la variante par défaut (première de la liste) pour une pièce. */
export function getDefaultVariant(pieceName: string): PieceSoundVariant | null {
  return PIECE_SOUND_LIBRARY[pieceName]?.variants[0] ?? null;
}

/** Retourne toutes les variantes disponibles pour une pièce. */
export function getVariantsForPiece(pieceName: string): PieceSoundVariant[] {
  return PIECE_SOUND_LIBRARY[pieceName]?.variants ?? [];
}

/** Retourne une variante par son ID. */
export function getVariantById(variantId: string): PieceSoundVariant | null {
  for (const cat of Object.values(PIECE_SOUND_LIBRARY)) {
    const v = cat.variants.find((v) => v.id === variantId);
    if (v) return v;
  }
  return null;
}

/** Toutes les catégories disponibles pour filtrage. */
export const ALL_PIECE_CATEGORIES = ["bois", "métal", "peau", "électronique", "acoustique", "vintage"] as const;
export type PieceCategory = typeof ALL_PIECE_CATEGORIES[number];

/** Couleurs par catégorie */
export const CATEGORY_COLORS: Record<PieceCategory, string> = {
  bois:         "#a16207",
  métal:        "#6b7280",
  peau:         "#b45309",
  électronique: "#0284c7",
  acoustique:   "#16a34a",
  vintage:      "#7c3aed",
};
