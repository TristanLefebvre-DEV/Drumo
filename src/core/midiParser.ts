import { Midi } from "@tonejs/midi";
import { mapMidiToDrum } from "./drumMapper";
import type { DrumHit, ParsedDrumProject } from "./types";

const drumScoreForTrack = (track: Midi["tracks"][number]): number =>
  track.notes.reduce((count, note) => count + (mapMidiToDrum(note.midi) ? 1 : 0), 0);

const detectDrumTracks = (midi: Midi) => {
  const channel10 = midi.tracks.filter((track) => track.channel === 9);
  if (channel10.length > 0) return channel10;

  const withScore = midi.tracks
    .map((track) => ({ track, score: drumScoreForTrack(track) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (withScore.length === 0) return [];
  const top = withScore[0].score;
  return withScore.filter((entry) => entry.score >= top * 0.35).map((entry) => entry.track);
};

export const parseDrumMidi = (bytes: Uint8Array, fileName: string): ParsedDrumProject => {
  const midi = new Midi(bytes);
  const drumTracks = detectDrumTracks(midi);
  if (drumTracks.length === 0) {
    throw new Error("Aucune piste batterie detectee.");
  }

  const hits: DrumHit[] = [];
  let idx = 0;
  for (const track of drumTracks) {
    for (const note of track.notes) {
      const mapped = mapMidiToDrum(note.midi);
      if (!mapped) continue;
      hits.push({
        id: `hit-${idx++}`,
        midi: note.midi,
        piece: mapped.piece,
        tick: note.ticks,
        durationTicks: Math.max(note.durationTicks, midi.header.ppq / 8),
        velocity: note.velocity,
        isGhost: note.velocity < 0.42,
        isAccent: note.velocity > 0.85
      });
    }
  }
  hits.sort((a, b) => a.tick - b.tick);

  const tempoBpm = midi.header.tempos[0]?.bpm ?? 120;
  const signature = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];

  return {
    ppq: midi.header.ppq,
    tempoBpm,
    timeSignature: { numerator: signature[0], denominator: signature[1] },
    sourceName: fileName,
    hits
  };
};
