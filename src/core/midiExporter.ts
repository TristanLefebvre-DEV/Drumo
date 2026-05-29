import { Midi } from "@tonejs/midi";
import type { ParsedDrumProject } from "./types";

export const exportProjectToMidiBytes = (project: ParsedDrumProject): number[] => {
  const midi = new Midi();
  midi.header.setTempo(project.tempoBpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    measures: 0,
    timeSignature: [project.timeSignature.numerator, project.timeSignature.denominator]
  });
  const track = midi.addTrack();
  track.channel = 9;

  for (const hit of project.hits) {
    track.addNote({
      midi: hit.midi,
      ticks: hit.tick,
      durationTicks: hit.durationTicks,
      velocity: hit.velocity
    });
  }

  return Array.from(midi.toArray());
};
