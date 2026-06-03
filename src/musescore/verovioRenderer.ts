/**
 * verovioRenderer.ts
 *
 * Pipeline : MusicXML (produit par MuseScore) → SVG interactif via Verovio WASM.
 * Le WASM ne se charge qu'une fois (singleton lazy).
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — verovio n'a pas de types complets
import createVerovioModule from "verovio/wasm";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { VerovioToolkit as _VerovioToolkitClass } from "verovio/esm";

// ── Types ────────────────────────────────────────────────────────────────────

interface VerovioToolkit {
  loadData(xml: string): boolean;
  setOptions(opts: Record<string, unknown>): void;
  getPageCount(): number;
  renderToSVG(page: number, options?: unknown): string;
  renderToTimemap(options?: unknown): unknown;
  getElementsAtTime(timeMs: number): { notes: string[]; chords: string[] };
  getTimeForElement(id: string): { qtime: number; on: number; off: number };
}

interface VerovioModule {
  toolkit: new () => VerovioToolkit;
}

export interface ScorePage {
  svg: string;
  pageIndex: number; // 1-based
}

/** Entrée de la carte temporelle : note SVG + fenêtre de temps en ms */
export interface TimemapEntry {
  on:  number; // début en ms
  off: number; // fin en ms
  id:  string; // @xml:id dans le SVG
}

export interface VerovioRenderResult {
  pages: ScorePage[];
  pageCount: number;
  /** Carte tick-ms → id SVG, générée depuis le MusicXML non-filtré */
  timemap: TimemapEntry[];
}

// ── Pièces batterie masquables ────────────────────────────────────────────────

export type MutablePiece =
  | "kick" | "snare" | "hihatClosed" | "hihatOpen" | "crash" | "ride"
  | "tomLow" | "tomMid" | "tomHigh";

/** MIDI note → pièce batterie */
const MIDI_TO_PIECE: Record<number, MutablePiece> = {
  36: "kick",
  38: "snare",
  42: "hihatClosed",
  46: "hihatOpen",
  49: "crash",
  51: "ride",
  45: "tomLow",
  47: "tomMid",
  48: "tomMid",
  50: "tomHigh",
};

/** Notes MIDI correspondant à chaque pièce */
const PIECE_MIDI_NOTES: Record<MutablePiece, number[]> = {
  kick:        [36],
  snare:       [38],
  hihatClosed: [42],
  hihatOpen:   [46],
  crash:       [49],
  ride:        [51],
  tomLow:      [45],
  tomMid:      [47, 48],
  tomHigh:     [50],
};

// ── Singleton Verovio ────────────────────────────────────────────────────────

let _toolkitPromise: Promise<VerovioToolkit> | null = null;

async function getToolkit(): Promise<VerovioToolkit> {
  if (!_toolkitPromise) {
    _toolkitPromise = (async () => {
      // 1. Charger le module WASM (verovio/wasm = verovio-module.mjs, WASM inliné)
      const wasmModule: VerovioModule = await createVerovioModule();
      // 2. Instancier le toolkit avec le module WASM
      return new _VerovioToolkitClass(wasmModule) as VerovioToolkit;
    })();
  }
  return _toolkitPromise;
}

// ── Options de rendu ─────────────────────────────────────────────────────────

const VEROVIO_OPTIONS = {
  adjustPageHeight:   0,
  pageWidth:          2100,   // ~A4 en unités Verovio
  pageHeight:         2970,
  scale:              45,
  footer:             "none",
  header:             "none",
  svgBoundingBoxes:   1,      // active les bounding boxes pour le playhead
  svgHtml5:           1,
};

// ── Filtrage MusicXML (masquer des pièces) ────────────────────────────────────

/**
 * Filtre le MusicXML produit par MuseScore pour masquer certaines pièces.
 *
 * MuseScore encode les sons de batterie via <midi-instrument> dans le header :
 *   <midi-instrument id="P1-I1">
 *     <midi-unpitched>37</midi-unpitched>  ← 1-indexé, donc note MIDI = 36
 *   </midi-instrument>
 * Puis chaque note référence l'instrument : <instrument id="P1-I1"/>
 *
 * On construit le map instrId→midi, puis on retire/remplace les notes muted.
 */
export function filterMusicXml(
  musicXml: string,
  mutedPieces: Set<MutablePiece>
): string {
  if (mutedPieces.size === 0) return musicXml;

  const mutedMidi = new Set<number>();
  for (const piece of mutedPieces) {
    for (const n of PIECE_MIDI_NOTES[piece] ?? []) mutedMidi.add(n);
  }

  // Parsing DOM (disponible dans le renderer Electron)
  const parser = new DOMParser();
  const doc = parser.parseFromString(musicXml, "application/xml");
  if (doc.querySelector("parsererror")) return musicXml; // parse échoué → pas de filtre

  // 1. Construire map instrument-id → note MIDI
  const instrMidi = new Map<string, number>();
  doc.querySelectorAll("midi-instrument").forEach((mi) => {
    const id = mi.getAttribute("id");
    const upEl = mi.querySelector("midi-unpitched");
    if (id && upEl?.textContent) {
      instrMidi.set(id, parseInt(upEl.textContent, 10) - 1); // 1-indexé → 0-indexé
    }
  });

  if (instrMidi.size === 0) return musicXml; // pas de mapping → rien à faire

  // 2. Parcourir les notes et masquer celles des pièces muted
  doc.querySelectorAll("note").forEach((note) => {
    const instrId = note.querySelector("instrument")?.getAttribute("id");
    if (!instrId) return;
    const midi = instrMidi.get(instrId);
    if (midi === undefined || !mutedMidi.has(midi)) return;

    const isChord = note.querySelector("chord") !== null;

    if (isChord) {
      // Note simultanée → suppression directe sans casser le timing
      note.parentNode?.removeChild(note);
    } else {
      // Première note du groupe → promouvoir la suivante ou mettre un silence
      const next = note.nextElementSibling;
      const nextChordEl = next?.querySelector("chord");
      if (next && nextChordEl) {
        // Retirer <chord> du suivant pour en faire la note principale
        next.removeChild(nextChordEl);
        note.parentNode?.removeChild(note);
      } else {
        // Remplacer par un silence de même durée
        const dur   = note.querySelector("duration")?.textContent ?? "1";
        const voice = note.querySelector("voice")?.textContent ?? "1";
        const type  = note.querySelector("type")?.textContent ?? "quarter";
        const staff = note.querySelector("staff")?.textContent ?? "1";
        const rest  = doc.createElementNS(null, "note");
        rest.innerHTML =
          `<rest/><duration>${dur}</duration><voice>${voice}</voice>` +
          `<type>${type}</type><staff>${staff}</staff>`;
        note.parentNode?.replaceChild(rest, note);
      }
    }
  });

  return new XMLSerializer().serializeToString(doc);
}

export { MIDI_TO_PIECE };

// ── Rendu principal ───────────────────────────────────────────────────────────

/**
 * Rend le MusicXML en pages SVG via Verovio.
 *
 * - Le timemap est généré depuis le XML non-filtré (timing correct même en mode masquage).
 * - Les pages SVG sont générées depuis le XML filtré (pièces masquées remplacées par silences).
 */
export async function renderMusicXml(
  musicXml: string,
  mutedPieces: Set<MutablePiece> = new Set()
): Promise<VerovioRenderResult> {
  const toolkit = await getToolkit();
  toolkit.setOptions(VEROVIO_OPTIONS);

  // 1. Charger le XML non-filtré pour générer la carte temporelle exacte
  toolkit.loadData(musicXml);

  // Format Verovio : [{tstamp: ms, on: [id, ...], off: [id, ...], ...}]
  // → on reconstruit un map noteId → {on, off}
  const rawTimemap = toolkit.renderToTimemap({}) as unknown;
  const rawEntries = Array.isArray(rawTimemap)
    ? (rawTimemap as Array<{ tstamp?: number; on?: string[]; off?: string[] }>)
    : [];

  const noteTimeMap = new Map<string, { on: number; off: number }>();
  for (const entry of rawEntries) {
    const ts = entry.tstamp;
    if (typeof ts !== "number") continue;
    for (const id of entry.on ?? []) {
      noteTimeMap.set(id, { on: ts, off: ts + 50_000 }); // off mis à jour ci-dessous
    }
    for (const id of entry.off ?? []) {
      const existing = noteTimeMap.get(id);
      if (existing) existing.off = ts;
    }
  }

  const timemap: TimemapEntry[] = [...noteTimeMap.entries()]
    .map(([id, { on, off }]) => ({ id, on, off }))
    .sort((a, b) => a.on - b.on);

  // 2. Rendu SVG (assigne les IDs stables AVANT de générer la timemap)
  //    Les IDs sont créés lors du layout — la timemap doit venir APRÈS.
  const filteredXml = filterMusicXml(musicXml, mutedPieces);
  if (filteredXml !== musicXml) {
    toolkit.loadData(filteredXml);
    toolkit.setOptions(VEROVIO_OPTIONS);
  }

  const pageCount = toolkit.getPageCount();
  const pages: ScorePage[] = [];
  for (let i = 1; i <= pageCount; i++) {
    pages.push({ svg: toolkit.renderToSVG(i), pageIndex: i });
  }

  // 3. Timemap APRÈS le rendu — les IDs SVG et timemap sont cohérents
  //    On recharge le XML non-filtré pour avoir le timing de toutes les notes
  toolkit.loadData(musicXml);
  toolkit.setOptions(VEROVIO_OPTIONS);
  toolkit.renderToSVG(1); // force le layout

  const rawTimemap2 = toolkit.renderToTimemap({}) as unknown;
  const rawEntries2 = Array.isArray(rawTimemap2)
    ? (rawTimemap2 as Array<{ tstamp?: number; on?: string[]; off?: string[] }>)
    : [];

  const noteTimeMap2 = new Map<string, { on: number; off: number }>();
  for (const entry of rawEntries2) {
    const ts = entry.tstamp;
    if (typeof ts !== "number") continue;
    for (const id of entry.on ?? []) {
      noteTimeMap2.set(id, { on: ts, off: ts + 50_000 });
    }
    for (const id of entry.off ?? []) {
      const ex = noteTimeMap2.get(id);
      if (ex) ex.off = ts;
    }
  }
  const timemap2: TimemapEntry[] = [...noteTimeMap2.entries()]
    .map(([id, { on, off }]) => ({ id, on, off }))
    .sort((a, b) => a.on - b.on);

  return { pages, pageCount, timemap: timemap2.length > 0 ? timemap2 : timemap };
}

// ── Playhead synchrone : cherche dans la timemap sans appel async ─────────────

/**
 * Cherche dans la timemap l'ID SVG de la note active à un instant donné.
 * 100 % synchrone — utilisable directement dans un requestAnimationFrame.
 *
 * @param timeMs   Position en millisecondes depuis le début du score
 * @param timemap  Carte générée par renderMusicXml()
 */
export function getNoteIdAtTimeSync(
  timeMs: number,
  timemap: TimemapEntry[]
): string | null {
  if (timemap.length === 0) return null;
  // Recherche linéaire depuis la fin (la plupart des accès sont récents)
  for (let i = timemap.length - 1; i >= 0; i--) {
    const e = timemap[i];
    if (e.on <= timeMs) return e.id;
  }
  return timemap[0].id;
}

/** Convertit un tick MIDI en millisecondes (tempo constant) */
export function tickToMs(tick: number, ppq: number, bpm: number): number {
  return (tick / ppq) * (60_000 / bpm);
}
