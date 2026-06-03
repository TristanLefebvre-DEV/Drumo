import { Midi } from "@tonejs/midi";

// GM standard drum note → canonical target (kit réduit à 8 pièces)
const NOTE_REMAP = new Map<number, number>([
  // Kick
  [35, 36], [36, 36],
  // Snare (side-stick + electric snare remappés sur 38)
  [37, 38], [38, 38], [40, 38],
  // Hi-hat fermé (pedal HH → fermé)
  [42, 42], [44, 42],
  // Hi-hat ouvert
  [46, 46],
  // Crash (splash + crash 2 → 49)
  [49, 49], [55, 49], [57, 49],
  // Ride (ride bell + ride 2 → 51)
  [51, 51], [53, 51], [59, 51],
  // Toms (floor toms bas → 45, mid-low → 47, mid-high → 48, high → 50)
  [41, 45], [43, 45], [45, 45],
  [47, 47], [48, 48], [50, 50],
]);

export interface NormalizerResult {
  bytes: Uint8Array;
  noteCount: number;
  warnings: string[];
}

/**
 * Normalise un fichier MIDI brut pour la génération de partition batterie :
 *  - détecte la (les) piste(s) batterie (canal 9 ou notes GM drums)
 *  - recrée sur canal 10 (index 9) avec le mapping standard
 *  - quantifie sur la double-croche (1/16)
 *  - déduplique les notes simultanées identiques
 *  - encode un MIDI type-0 propre (channel 10 uniquement)
 */
export function normalizeDrumMidi(input: Uint8Array): NormalizerResult {
  const warnings: string[] = [];

  let source: InstanceType<typeof Midi>;
  try {
    source = new Midi(input);
  } catch (err) {
    throw new Error(
      `Fichier MIDI invalide : ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const ppq = source.header.ppq || 480;
  const bpm = source.header.tempos[0]?.bpm ?? 120;
  const timeSig = source.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const quantStep = Math.round(ppq / 4); // 1/16th note

  // Identifier les pistes batterie : canal 9 OU contient des notes GM drums
  let drumTracks = source.tracks.filter(
    (t) =>
      t.notes.some((n) => (n as { channel?: number }).channel === 9) ||
      t.notes.some((n) => NOTE_REMAP.has(n.midi))
  );

  if (drumTracks.length === 0) {
    warnings.push(
      "Aucune piste batterie détectée (canal 9 absent) — normalisation de toutes les pistes."
    );
    drumTracks = [...source.tracks];
  }

  // Collecter et transformer les notes
  type RawNote = { ticks: number; midi: number; velocity: number };
  const collected: RawNote[] = [];
  const unknownNotes = new Set<number>();

  for (const track of drumTracks) {
    for (const note of track.notes) {
      const target = NOTE_REMAP.get(note.midi);
      if (target === undefined) {
        unknownNotes.add(note.midi);
        continue;
      }
      const quantized = Math.round(note.ticks / quantStep) * quantStep;
      collected.push({ ticks: quantized, midi: target, velocity: note.velocity });
    }
  }

  if (unknownNotes.size > 0) {
    warnings.push(
      `Notes ignorées (hors mapping batterie GM) : ${[...unknownNotes].sort((a, b) => a - b).join(", ")}`
    );
  }

  if (collected.length === 0) {
    throw new Error("Aucune note batterie valide trouvée après normalisation.");
  }

  // Trier + dédupliquer (même tick + même note = doublon)
  collected.sort((a, b) =>
    a.ticks !== b.ticks ? a.ticks - b.ticks : a.midi - b.midi
  );
  const seen = new Set<string>();
  const unique = collected.filter((n) => {
    const key = `${n.ticks}:${n.midi}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    bytes: encodeDrumMidi(unique, ppq, bpm, timeSig[0], timeSig[1]),
    noteCount: unique.length,
    warnings,
  };
}

// ─── Encodeur MIDI type-0 minimal (channel 10) ──────────────────────────────

type NoteEvt = { ticks: number; midi: number; velocity: number };

function encodeDrumMidi(
  notes: NoteEvt[],
  ppq: number,
  bpm: number,
  timeSigNum: number,
  timeSigDen: number
): Uint8Array {
  const track: number[] = [];

  // Meta : signature temporelle
  track.push(0x00, 0xff, 0x58, 0x04, timeSigNum, Math.log2(timeSigDen), 0x18, 0x08);

  // Meta : tempo (microsecondes par noire)
  const usPerBeat = Math.round(60_000_000 / bpm);
  track.push(
    0x00, 0xff, 0x51, 0x03,
    (usPerBeat >> 16) & 0xff,
    (usPerBeat >> 8) & 0xff,
    usPerBeat & 0xff
  );

  // Construire les événements note-on / note-off sur canal 10 (0x9n, n=9)
  type Evt = { tick: number; data: number[] };
  const events: Evt[] = [];
  const durationTicks = Math.round(ppq / 4); // durée 1/16

  for (const n of notes) {
    const vel = Math.max(1, Math.min(127, Math.round(n.velocity * 127)));
    events.push({ tick: n.ticks, data: [0x99, n.midi, vel] });
    events.push({ tick: n.ticks + durationTicks, data: [0x89, n.midi, 0] });
  }

  events.sort((a, b) => a.tick - b.tick);

  let cursor = 0;
  for (const evt of events) {
    track.push(...varLen(evt.tick - cursor), ...evt.data);
    cursor = evt.tick;
  }

  // End of track
  track.push(0x00, 0xff, 0x2f, 0x00);

  // En-tête MIDI (format 0, 1 piste)
  const fileHeader = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // taille chunk = 6
    0x00, 0x00,             // format 0
    0x00, 0x01,             // 1 piste
    (ppq >> 8) & 0xff, ppq & 0xff, // PPQ
  ];

  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    (track.length >> 24) & 0xff,
    (track.length >> 16) & 0xff,
    (track.length >> 8) & 0xff,
    track.length & 0xff,
  ];

  return new Uint8Array([...fileHeader, ...trackHeader, ...track]);
}

function varLen(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    bytes.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return bytes;
}
