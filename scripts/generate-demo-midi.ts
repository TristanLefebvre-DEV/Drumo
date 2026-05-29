import fs from "node:fs/promises";
import path from "node:path";
import { Midi } from "@tonejs/midi";

const midi = new Midi();
const track = midi.addTrack();
track.channel = 9;

const ppq = midi.header.ppq;
const beat = ppq;
const addHit = (midiNote: number, tick: number, length = ppq / 4) => {
  track.addNote({
    midi: midiNote,
    ticks: tick,
    durationTicks: length,
    velocity: 0.85
  });
};

for (let bar = 0; bar < 4; bar += 1) {
  const start = bar * beat * 4;
  addHit(36, start);
  addHit(42, start);
  addHit(42, start + beat);
  addHit(38, start + beat);
  addHit(42, start + beat * 2);
  addHit(36, start + beat * 2);
  addHit(46, start + beat * 3);
  addHit(38, start + beat * 3);
  addHit(49, start + beat * 3.5, ppq / 2);
}

const main = async () => {
  const outputPath = path.join(process.cwd(), "assets", "demo.mid");
  await fs.writeFile(outputPath, Buffer.from(midi.toArray()));
  console.log(`Generated ${outputPath}`);
};

void main();
