import * as Tone from "tone";
import type { DrumHit, ParsedDrumProject } from "../core/types";

const frequencyForHit = (hit: DrumHit): number => {
  switch (hit.piece) {
    case "kick":
      return 65;
    case "snare":
    case "snareRim":
      return 180;
    case "tomLow":
      return 140;
    case "tomMid":
      return 170;
    case "tomHigh":
      return 220;
    default:
      return 480;
  }
};

export const createDrumPlayer = (project: ParsedDrumProject, onTick: (tick: number) => void) => {
  const synth = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { sustain: 0 } }).toDestination();
  let raf: number | null = null;
  let playing = false;
  let start = 0;
  let index = 0;
  const sorted = [...project.hits].sort((a, b) => a.tick - b.tick);
  const ticksPerSecond = (project.ppq * project.tempoBpm) / 60;
  const maxTick = sorted.length > 0 ? sorted[sorted.length - 1].tick + project.ppq : project.ppq * 4;

  const loop = async () => {
    if (!playing) return;
    const elapsed = Tone.now() - start;
    const tick = Math.floor(elapsed * ticksPerSecond);
    onTick(tick);

    while (index < sorted.length && sorted[index].tick <= tick) {
      const hit = sorted[index];
      synth.triggerAttackRelease(frequencyForHit(hit), "32n", undefined, Math.max(0.1, hit.velocity));
      index += 1;
    }

    if (tick >= maxTick) {
      playing = false;
      onTick(0);
      return;
    }
    raf = window.requestAnimationFrame(() => void loop());
  };

  return {
    play: async () => {
      if (playing) return;
      await Tone.start();
      playing = true;
      start = Tone.now();
      index = 0;
      raf = window.requestAnimationFrame(() => void loop());
    },
    stop: () => {
      playing = false;
      if (raf !== null) window.cancelAnimationFrame(raf);
      onTick(0);
    },
    isPlaying: () => playing
  };
};
